from __future__ import annotations

from collections import Counter
import re
from typing import Any

import pandas as pd


def _normalize_text(value: str) -> str:
    return re.sub(r"[^a-z0-9\s]", " ", str(value).lower()).strip()


def _tokenize(value: str) -> set[str]:
    normalized = _normalize_text(value)
    return {token for token in normalized.split() if token}


class CrossAllergyPredictor:
    """
    Lightweight ML-like predictor trained from allergies.xlsx rows.
    Learns allergen token -> cross-reactive food patterns.
    """

    def __init__(self, dataframe: pd.DataFrame):
        self.df = dataframe.copy()
        self.token_food_counter: dict[str, Counter] = {}
        self.food_global_counter: Counter = Counter()
        self.total_samples = 0
        self._train()

    def _train(self) -> None:
        if self.df is None or self.df.empty:
            return

        self.df.columns = self.df.columns.str.strip().str.lower()
        if "primary allergen" not in self.df.columns or "cross-reactive foods" not in self.df.columns:
            return

        for _, row in self.df.iterrows():
            allergen = str(row.get("primary allergen", ""))
            foods_raw = str(row.get("cross-reactive foods", ""))
            allergen_tokens = _tokenize(allergen)
            foods = [
                food.strip()
                for food in foods_raw.split(",")
                if food and str(food).strip() and str(food).strip().lower() != "nan"
            ]
            if not allergen_tokens or not foods:
                continue

            self.total_samples += 1
            for food in foods:
                self.food_global_counter[food] += 1
                for token in allergen_tokens:
                    if token not in self.token_food_counter:
                        self.token_food_counter[token] = Counter()
                    self.token_food_counter[token][food] += 1

    def predict(self, query: str, top_k: int = 5) -> list[dict[str, Any]]:
        query_tokens = _tokenize(query)
        if not query_tokens:
            return []

        score_counter: Counter = Counter()
        matched_token_count = 0
        for token in query_tokens:
            if token in self.token_food_counter:
                matched_token_count += 1
                score_counter.update(self.token_food_counter[token])

        if not score_counter:
            common = self.food_global_counter.most_common(top_k)
            total = sum(c for _, c in common) or 1
            return [
                {"food": food, "likelihood": round((count / total) * 100, 1), "reason": "global fallback pattern"}
                for food, count in common
            ]

        total_score = sum(score_counter.values()) or 1
        token_coverage = matched_token_count / max(len(query_tokens), 1)

        results = []
        for food, score in score_counter.most_common(top_k):
            likelihood = (score / total_score) * 100
            likelihood *= (0.6 + (0.4 * token_coverage))
            results.append(
                {
                    "food": food,
                    "likelihood": round(min(likelihood, 99.0), 1),
                    "reason": "token co-occurrence model",
                }
            )
        return results

