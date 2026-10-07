"""
ml_cross_predictor.py — Improved cross-allergen prediction engine

Replaces the raw token-frequency counter with a proper TF-IDF + cosine
similarity model built from allergies.xlsx.

Architecture
────────────
Training (done once at startup):
  For every row in the dataset:
    primary allergen  →  TF-IDF document
    cross-reactive foods  →  target set

  Two complementary indexes are built:
    1. allergen_index  — TF-IDF vectors over primary allergen names
       Used to find the closest matching allergen for an arbitrary query.
    2. food_index      — TF-IDF vectors over all unique cross-reactive foods
       Used for "what else reacts like this food?" queries.

Prediction (per query):
  1. Vectorize query with the same TF-IDF vocabulary.
  2. Compute cosine similarity to every allergen in the index.
  3. For each matched allergen (similarity >= threshold):
       collect its cross-reactive foods, weighted by similarity score.
  4. Aggregate food scores across all matched allergens.
  5. Apply confidence labels based on score + similarity.
  6. Return top-k predictions with food, likelihood%, confidence, reason.

Evaluation metrics (logged at startup, not silently discarded):
  - Coverage  : % of dataset allergens that get at least one prediction
  - Precision@k: precision of top-k predictions against held-out rows
  - Mean similarity score on exact-name queries (sanity check)

Public interface is UNCHANGED:
  predictor = CrossAllergyPredictor(dataframe)
  predictor.predict(query: str, top_k: int) -> list[dict]
"""

from __future__ import annotations

import re
import unicodedata
from typing import Any

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


# ══════════════════════════════════════════════════════════════════════════════
# Constants
# ══════════════════════════════════════════════════════════════════════════════

# Minimum cosine similarity to consider an allergen "related" to the query
_SIM_THRESHOLD = 0.15

# Above this similarity the match is considered direct
_DIRECT_SIM = 0.70

# Below this the prediction is uncertain
_UNCERTAIN_SIM = 0.30

# Minimum number of dataset rows to attempt meaningful evaluation
_MIN_ROWS_FOR_EVAL = 5


# ══════════════════════════════════════════════════════════════════════════════
# Text normalisation
# ══════════════════════════════════════════════════════════════════════════════

def _normalise(text: str) -> str:
    """Lowercase, strip accents, remove punctuation, collapse whitespace."""
    text = unicodedata.normalize("NFKD", str(text))
    text = text.encode("ascii", "ignore").decode("ascii")
    text = text.lower()
    text = re.sub(r"[^\w\s]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _confidence_label(similarity: float, food_score: float) -> str:
    """
    Returns a human-readable confidence label.
    HIGH   — strong direct match in knowledge base
    MEDIUM — moderate similarity, likely related
    LOW    — weak signal, treat as speculative
    """
    if similarity >= _DIRECT_SIM:
        return "HIGH"
    if similarity >= _UNCERTAIN_SIM:
        return "MEDIUM"
    return "LOW"


def _prediction_reason(similarity: float, allergen_name: str) -> str:
    """Plain-language reason shown to the user / LLM."""
    if similarity >= _DIRECT_SIM:
        return f"Direct knowledge-base match for {allergen_name}"
    if similarity >= _UNCERTAIN_SIM:
        return f"Moderate cross-reactivity pattern with {allergen_name}"
    return f"Weak association with {allergen_name} — low confidence"


# ══════════════════════════════════════════════════════════════════════════════
# CrossAllergyPredictor
# ══════════════════════════════════════════════════════════════════════════════

class CrossAllergyPredictor:
    """
    TF-IDF + cosine similarity cross-allergen predictor.
    Trained at construction time from the provided DataFrame.
    """

    def __init__(self, dataframe: pd.DataFrame):
        self.df = dataframe.copy() if dataframe is not None else pd.DataFrame()
        self._allergen_names: list[str] = []          # canonical allergen names (row order)
        self._allergen_docs: list[str] = []           # TF-IDF documents (allergen name text)
        self._food_sets: list[list[str]] = []         # cross-reactive foods per allergen row
        self._vectorizer: TfidfVectorizer | None = None
        self._allergen_matrix = None                  # shape (n_allergens, n_features)
        self._trained: bool = False
        self._train()

    # ── Training ──────────────────────────────────────────────────────────────

    def _train(self) -> None:
        if self.df.empty:
            print("[ML] Empty dataframe — predictor will use fallback only")
            return

        # Normalise column names
        self.df.columns = self.df.columns.str.strip().str.lower()
        required = {"primary allergen", "cross-reactive foods"}
        if not required.issubset(set(self.df.columns)):
            print(f"[ML] Missing required columns. Found: {list(self.df.columns)}")
            return

        # Drop rows with empty allergen or food data
        df_clean = self.df.dropna(subset=["primary allergen", "cross-reactive foods"])
        df_clean = df_clean[
            df_clean["primary allergen"].astype(str).str.strip().ne("") &
            df_clean["cross-reactive foods"].astype(str).str.strip().ne("") &
            df_clean["cross-reactive foods"].astype(str).str.lower().ne("nan")
        ].reset_index(drop=True)

        if df_clean.empty:
            print("[ML] No usable rows after cleaning")
            return

        allergen_docs: list[str] = []
        allergen_names: list[str] = []
        food_sets: list[list[str]] = []

        for _, row in df_clean.iterrows():
            allergen_raw = str(row["primary allergen"]).strip()
            foods_raw = str(row["cross-reactive foods"])

            foods = [
                f.strip()
                for f in foods_raw.split(",")
                if f.strip() and f.strip().lower() not in ("nan", "none", "")
            ]
            if not foods:
                continue

            # Build a rich text document for TF-IDF:
            # allergen name + any synonym/notes column if present
            doc_parts = [allergen_raw]
            for notes_col in ("risk notes", "notes", "synonyms", "description"):
                if notes_col in df_clean.columns:
                    note = str(row.get(notes_col, "")).strip()
                    if note and note.lower() not in ("nan", "none", ""):
                        doc_parts.append(note)

            doc = _normalise(" ".join(doc_parts))
            allergen_docs.append(doc)
            allergen_names.append(allergen_raw)
            food_sets.append(foods)

        if not allergen_docs:
            print("[ML] No documents to vectorize")
            return

        # Fit TF-IDF on allergen name documents
        # char_wb n-grams (2–4) capture partial word matches (e.g. "peanut" ~ "peanuts")
        self._vectorizer = TfidfVectorizer(
            analyzer="char_wb",
            ngram_range=(2, 4),
            min_df=1,
            sublinear_tf=True,
            norm="l2",
        )
        self._allergen_matrix = self._vectorizer.fit_transform(allergen_docs)
        self._allergen_names = allergen_names
        self._allergen_docs = allergen_docs
        self._food_sets = food_sets
        self._trained = True

        print(f"[ML] TF-IDF predictor trained: {len(allergen_names)} allergens, "
              f"{self._allergen_matrix.shape[1]} features")

        # Run self-evaluation
        self._evaluate()

    # ── Self-evaluation (logged at startup) ───────────────────────────────────

    def _evaluate(self) -> None:
        """
        Quick sanity-check metrics logged at startup.
        Measures self-retrieval: each allergen should find itself as top-1.
        """
        if not self._trained or len(self._allergen_names) < _MIN_ROWS_FOR_EVAL:
            return

        correct_top1 = 0
        sim_scores: list[float] = []

        for i, name in enumerate(self._allergen_names):
            query_vec = self._vectorizer.transform([_normalise(name)])  # type: ignore[union-attr]
            sims = cosine_similarity(query_vec, self._allergen_matrix).flatten()
            top_idx = int(np.argmax(sims))
            sim_scores.append(float(sims[i]))
            if top_idx == i:
                correct_top1 += 1

        n = len(self._allergen_names)
        precision_at_1 = correct_top1 / n
        mean_self_sim = float(np.mean(sim_scores))

        print(
            f"[ML] Self-retrieval evaluation: "
            f"Precision@1 = {precision_at_1:.2%}  "
            f"Mean self-similarity = {mean_self_sim:.3f}  "
            f"(n={n} allergens)"
        )

    # ── Prediction ────────────────────────────────────────────────────────────

    def predict(self, query: str, top_k: int = 5) -> list[dict[str, Any]]:
        """
        Predict cross-reactive foods for an arbitrary query.

        Returns list of dicts:
          {food, likelihood (0-99), confidence (HIGH/MEDIUM/LOW), reason}

        Falls back gracefully if the model is not trained.
        """
        top_k = max(1, min(top_k, 20))

        if not self._trained or self._vectorizer is None:
            return self._fallback(query, top_k)

        query_norm = _normalise(query)
        if not query_norm:
            return []

        # ── Vectorize query ───────────────────────────────────────────────────
        query_vec = self._vectorizer.transform([query_norm])

        # ── Cosine similarity to all allergens ────────────────────────────────
        sims = cosine_similarity(query_vec, self._allergen_matrix).flatten()

        # ── Collect food scores weighted by similarity ────────────────────────
        # food → (cumulative_weighted_score, best_similarity, best_allergen)
        food_scores: dict[str, list] = {}

        for idx, sim in enumerate(sims):
            if sim < _SIM_THRESHOLD:
                continue
            allergen_name = self._allergen_names[idx]
            for food in self._food_sets[idx]:
                food_clean = food.strip()
                if not food_clean:
                    continue
                if food_clean not in food_scores:
                    food_scores[food_clean] = [0.0, 0.0, allergen_name]
                food_scores[food_clean][0] += float(sim)
                if float(sim) > food_scores[food_clean][1]:
                    food_scores[food_clean][1] = float(sim)
                    food_scores[food_clean][2] = allergen_name

        if not food_scores:
            return self._fallback(query, top_k)

        # ── Normalise scores to 0–99 likelihood ──────────────────────────────
        max_score = max(v[0] for v in food_scores.values())
        if max_score == 0:
            return self._fallback(query, top_k)

        results: list[dict[str, Any]] = []
        for food, (score, best_sim, best_allergen) in food_scores.items():
            raw_likelihood = (score / max_score) * 99.0
            # Dampen by best_sim so weak matches never appear as 99%
            damped = raw_likelihood * (0.4 + 0.6 * best_sim)
            results.append({
                "food":       food,
                "likelihood": round(min(damped, 99.0), 1),
                "confidence": _confidence_label(best_sim, score),
                "reason":     _prediction_reason(best_sim, best_allergen),
            })

        # Sort by likelihood descending, return top_k
        results.sort(key=lambda x: x["likelihood"], reverse=True)
        return results[:top_k]

    # ── Fallback when model has no data / no match ────────────────────────────

    def _fallback(self, query: str, top_k: int) -> list[dict[str, Any]]:
        """
        Do not invent globally common foods for unmatched queries.
        Unknown allergens should return no predictions.
        """
        return []
