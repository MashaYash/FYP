# Cross Allergen Detection — Investigation Report

## Summary Answer (Root Causes First)

The Cross Allergen module has **four distinct failure points**, ordered by severity:

1. **PRIMARY — Docker container runs a stale `ocr.py`** with a hardcoded list of only 7 allergens. The local codebase has a fully rewritten, dynamic `ocr.py` (28 KB, 800+ lines) that was never rebuilt into the container. This means the running system recognises at most 5 real allergens. Any SPT report with allergens outside that list produces an empty `allergies{}` dict, and `get_positive_allergens()` returns `[]`, so `crossAllergens` always returns an empty list.

2. **SECONDARY — Knowledge base is very small (7 rows, 5 unique allergens)** and does not cover many common SPT allergens (Milk, Wheat, Alternaria, Cockroach, Dog, Birch, etc.). When a positive allergen is not in the KB, the system correctly returns `cross_reactive_foods: []` but communicates this only via `notes: "No match found"` — no structured "not-in-KB" flag is returned, and the frontend still renders a risk badge.

3. **TERTIARY — `_find_row()` token-overlap fallback causes false positives.** Single shared tokens like `epithelium`, `mix`, `dust`, `pollen`, or `grass` are enough to match completely unrelated allergens (e.g. `Dog Epithelium → Cat Epithelium`, `Cockroach Mix → Grass Pollen Mix`). The results are medically wrong.

4. **QUATERNARY — ML predictor returns misleading global-fallback results.** When a query allergen has no token match (e.g. `Milk`), the old token-counter model (Docker) returns the globally most-common cross-reactive foods across all KB rows (Shrimp, Crab, Lobster) — which are correct for Dust Mite but completely wrong for Milk. The local codebase has a TF-IDF replacement that would be better, but it is not deployed.

The API contract, field names, and frontend rendering are all **correct** — those are not the problem.

---

## Evidence

### 1. Knowledge Base (`allergies.xlsx`)

**File:** `middle-layer/app/allergies.xlsx`  
**Sheet:** `Sheet1` (only sheet)  
**Shape:** 7 rows × 3 columns

| Primary Allergen | Cross-reactive foods | Risk notes |
|---|---|---|
| House Dust Mite (D. pteronyssinus) | Shrimp, Crab, Lobster, Snails, Clams | Tropomyosin... |
| Cat Epithelium | Pork, Beef, Rabbit, Lamb | Fel d 1... |
| Grass Pollen Mix | Tomato, Melon, Orange, Peach, Celery, Wheat | Oral allergy syndrome... |
| Egg White | Chicken, Turkey, Duck, Quail | Bird-egg syndrome... |
| Peanut | Soy, Lupin, Peas, Chickpeas, Lentils, Tree nuts | Legume... |
| Egg | Chicken, Turkey, Duck, Quail | Bird-egg syndrome... |
| Dust Mite | Shrimp, Crab, Lobster, Snails | Tropomyosin... |

**Column names after `df.columns.str.strip().str.lower()`:**  
`['primary allergen', 'cross-reactive foods', 'risk notes']`  
All three columns map correctly to `MCPServer._row_to_result()` accessors (`row.get('cross-reactive foods', '')`, `row.get('risk notes', '')`). No NaN, no duplicates (Egg and Egg White are intentionally separate rows). No whitespace or capitalization issues after normalization.

**Allergens absent from KB** (common in SPT reports): Milk, Wheat, Dog Epithelium, Alternaria alternata, Cockroach, Birch Pollen, Timothy Grass, D. farinae, Aspergillus, Latex — all return `cross_reactive_foods: []`, `notes: "No match found"`.

---

### 2. Backend — `mcp_server.py` (`MCPServer`)

**File:** `middle-layer/app/mcp_server.py`

**`get_cross_reactive(allergen)`** calls `_find_row(allergen)`, which applies three matching strategies in order:

1. **Exact case-insensitive match** — `primary_col.str.lower() == allergen.lower()`  
   Works for: `Peanut`, `peanut`, `PEANUT`, `Egg White`, `Egg`, `Dust Mite`, `Grass Pollen Mix`.

2. **Substring / normalized contains** — checks if the allergen string is a substring of the KB row or vice versa (after `_normalize_allergen`).  
   Works for: `House dust mite` → `House Dust Mite (D. pteronyssinus)`.

3. **Token overlap** — splits both strings into tokens (length > 2), counts intersection.  
   **BUG:** Any single shared generic token triggers a match. Confirmed false positives:

   | Query allergen | False match in KB | Shared token |
   |---|---|---|
   | Dog Epithelium | Cat Epithelium | `epithelium` |
   | Cockroach Mix | Grass Pollen Mix | `mix` |
   | Bermuda Grass | Grass Pollen Mix | `grass` |
   | Timothy Grass | Grass Pollen Mix | `grass` |
   | Wheat Mix | Grass Pollen Mix | `mix` |
   | Egg Mix | Egg White / Egg | `egg` / `mix` |
   | Dust Mix | House Dust Mite / Dust Mite | `dust` |
   | Tree Pollen Mix | Grass Pollen Mix | `mix` + `pollen` |
   | Birch Pollen | Grass Pollen Mix | `pollen` |
   | Grass Mix | Grass Pollen Mix | `grass` + `mix` |

**`_row_to_result()`** reads `row.get('cross-reactive foods', '')` and `row.get('risk notes', '')` — both column names exist after normalization. This part is correct.

**Return for `Peanut`:**
```json
{
  "allergen": "Peanut",
  "cross_reactive_foods": ["Soy", "Lupin", "Peas", "Chickpeas", "Lentils", "Tree nuts"],
  "notes": "Legume and tree nut cross-reactivity is possible; verify with clinician."
}
```

**Return for `House Dust Mite (D. pteronyssinus)`:**
```json
{
  "allergen": "House Dust Mite (D. pteronyssinus)",
  "cross_reactive_foods": ["Shrimp", "Crab", "Lobster", "Snails", "Clams"],
  "notes": "Tropomyosin protein similarity may cause shellfish cross-reactivity."
}
```

**Return for `Milk` (not in KB):**
```json
{
  "allergen": "Milk",
  "cross_reactive_foods": [],
  "notes": "No match found"
}
```

---

### 3. Backend — `ml_cross_predictor.py`

**Two versions exist:**

**Docker (deployed):** `middle-layer/app/ml_cross_predictor.py` — token-counter model (240 lines).  
- No `sklearn` dependency — uses only `collections.Counter`.
- Trains a `token → Counter(foods)` mapping from the 7 KB rows.
- `predict("Peanut")` → `[{food: "Soy", likelihood: 16.7}, ...]` — correct result, low confidence (16.7%).
- `predict("Milk")` → **global fallback**: `[{food: "Shrimp", likelihood: 20.0}, {food: "Crab", ...}]` — **medically wrong**.
- For any allergen not in the KB, the fallback emits the globally most common cross-reactive foods across all KB rows, which happen to be shellfish (from dust mite rows). This produces nonsensical predictions (Milk → Shrimp).
- No model file is saved/loaded; the model trains from the DataFrame at every server startup.

**Local (not deployed):** TF-IDF + cosine similarity model (290 lines).  
- Requires `sklearn` (listed in `requirements.txt` but not installed in local Python, only in Docker via pip).
- Better architecture (char n-gram TF-IDF), but still only trained on 7 rows so the improvement is marginal.
- Also still uses `_fallback()` for unknown queries.

---

### 4. Backend — `server.py` — `/crossAllergens` endpoint

**Docker file:** `middle-layer/app/server.py`, line 565.

```python
@app.get("/crossAllergens")
def get_cross_allergens():
    if not has_uploaded_report():
        return {"success": False, "cross_allergens": [], ...
                "message": "Please upload a report first."}

    try:
        cross_allergens_list = []
        allergens = get_positive_allergens(app.state.report)   # line 577

        for allergen in allergens:
            cross_data = mcp_server.get_cross_reactive(allergen)
            foods = [food.strip() for food in cross_data.get("cross_reactive_foods", [])
                     if food.strip() and food.strip().lower() != "nan"]
            wheal = app.state.report.get("allergies", {}).get(allergen, {}).get("wheal_diameter")
            # risk derived from wheal_diameter ...
            notes = cross_data.get("notes", "")
            if notes and str(notes).lower() in ("nan", "none", "null", ""):
                notes = ""
            # NOTE: "No match found" is NOT caught by this check — it passes through to UI

            cross_allergens_list.append({
                "primary":       cross_data.get("allergen", allergen),
                "cross_reactive": foods,
                "risk":          risk,
                "notes":         notes,
                "wheal_mm":      wheal,
            })

        print("Cross Allergens List:", cross_allergens_list)  # line 610 — logs confirm []
        summary = gpt_con.send_cross_allergen_summary(cross_allergens_list)

        return {"success": True, "cross_allergens": cross_allergens_list, ...}
```

**`get_positive_allergens(report)`** (line 499):

```python
CONTROL_ALLERGENS = {
    "negative control (saline)",
    "positive control (histamine)",
}

def get_positive_allergens(report):
    return [
        name
        for name, details in report.get("allergies", {}).items()
        if details.get("result", "").lower() == "positive"
        and name.strip().lower() not in CONTROL_ALLERGENS
    ]
```

This is correct. The `result` field from Docker OCR is lowercase `"positive"`, and `.lower() == "positive"` matches it. Control allergens are excluded correctly.

**`has_uploaded_report()`:**
```python
def has_uploaded_report() -> bool:
    report = getattr(app.state, "report", None)
    return isinstance(report, dict) and len(report) > 0
```

An empty `{"patient": {}, "allergies": {}}` dict passes this check (len=2). So even a parse failure that produces an empty allergies dict still allows the `/crossAllergens` endpoint to run — it just returns `[]`.

**`/predictCrossAllergy`** (line in Docker): Accepts `{"query": str, "top_k": int}`, calls `ml_predictor.predict(query, top_k)`, returns `{"success": true, "query": ..., "predictions": [...]}`. No dependency on `app.state.report` — correctly isolated from the analyzer path.

---

### 5. Frontend — `crossAllergen.tsx`

**File:** `frontend/app/(tabs)/crossAllergen.tsx`

**`fetchCrossAllergens()`** (lines 58–76):
```typescript
const res  = await fetch(`${BASE_URL}/crossAllergens`);  // GET, no body
const data = await res.json();
if (!data.success) {
  setErrorMessage(data.message || '...');
  setCrossAllergens([]);
} else {
  setCrossAllergens(data.cross_allergens || []);
  setSummary(cleanDisplayText(data.summary || ''));
}
```

- Sends a plain `GET` with no body — correct, matches the `@app.get("/crossAllergens")` endpoint.
- Reads `data.cross_allergens` and `data.summary` — both match backend response keys.
- `CrossAllergenItem` type uses `cross_reactive?: string[]` — matches backend `cross_reactive` field.

**Allergen card rendering:** Filters `cross_reactive` for `nan` values, renders food pills. If `cross_reactive.length === 0`, renders `"No items listed"`. If `notes` is truthy, renders it. The `"No match found"` note text **will be displayed** to the user — there is no distinction between "confirmed empty" and "not in KB". No `"no KB entry"` state or message is shown.

**ML prediction section:** User types allergen in `TextInput`, presses "Predict Likely Foods" → `POST /predictCrossAllergy` with `{query, top_k: 6}`. Reads `data.predictions` as `PredictedFood[]` with `{food, likelihood, reason?}` — matches backend response shape. This path is **correctly independent** from the analyzer path.

**`useFocusEffect`:** Calls `fetchCrossAllergens()` every time the tab gains focus. If the user navigates to the Cross Allergen tab before running the analyzer, `app.state.report` is `None` → `has_uploaded_report()` returns `False` → endpoint returns `{success: false, message: "Please upload a report first."}` → frontend shows error message. This is expected behavior.

---

### 6. Analyzer Output Structure

**`/imageToText`** stores the parsed report into `app.state.report`:

```python
app.state.report = report_json   # line 301 (Docker), line 464 (local)
```

**`report_json` structure** (from Docker `ocr.py`):
```json
{
  "patient": {
    "name": "John Doe",
    "date_of_birth": "01/01/1990",
    "test_date": "15/01/2024"
  },
  "allergies": {
    "House Dust Mite (D. pteronyssinus)": {
      "wheal_diameter": 8,
      "result": "positive"
    },
    "Peanut": {
      "wheal_diameter": 7,
      "result": "positive"
    }
  }
}
```

`result` values are **lowercase** (`"positive"`, `"negative"`, `"unknown"`). `get_positive_allergens()` uses `.lower() == "positive"` — this is a correct match.

**Local `ocr.py`** adds extra fields per allergen: `flare_diameter`, `confidence`, `ocr_avg_conf`, `source_page`, plus `extraction_meta` at the top level. These are harmless additions; `get_positive_allergens()` only looks at `result`.

**Race condition check:** The frontend calls `/crossAllergens` via `useFocusEffect` on every tab focus. If the user is on the Cross Allergen tab and has not yet run the analyzer, the response is `{success: false}`. After running the analyzer, the user must navigate back to the Cross Allergen tab (or press Refresh) to trigger the fetch. There is no push notification or auto-refresh — this is not a bug, but it may confuse users who stay on the Cross Allergen tab while the analyzer runs on another tab. There is **no race condition** per se because the GET is triggered on tab focus, not concurrently.

---

### 7. Docker vs Local Version Divergence

| File | Docker (running) | Local (not deployed) |
|---|---|---|
| `ocr.py` | 240 lines, hardcoded 7-allergen list | 800+ lines, dynamic `_parse_allergens_from_lines()`, no hardcoded list |
| `ml_cross_predictor.py` | token-counter model, no sklearn | TF-IDF + cosine similarity, requires sklearn |
| `server.py` (imageToText) | simple try/except, no input validation guards | 12-step validated pipeline, robust error handling |
| `server.py` (crossAllergens) | same logic | same logic |

The Docker container was **not rebuilt** after the local `ocr.py` was rewritten. This is confirmed by the Docker container's `ocr.py` size (7,663 bytes) vs local (28,764 bytes).

---

## Definitive Answers to Investigation Questions

**Q1: What is in `app.state.report` when `/crossAllergens` is called?**

One of three states:
- `None` — user has not uploaded any report yet (→ `has_uploaded_report() = False`)
- `{"patient": {}, "allergies": {}}` — OCR ran but found no allergen lines (→ empty result)
- `{"patient": {...}, "allergies": {"Peanut": {"result": "positive", ...}, ...}}` — OCR found matching allergens

**Q2: What does `get_positive_allergens(app.state.report)` return?**

It iterates `allergies` dict items, filters `result.lower() == "positive"` and excludes control allergens. Returns `[]` if allergies is empty or all results are negative. Returns `["Peanut"]` if Peanut is positive, etc.

**Q3: What does `mcp_server.get_cross_reactive()` return per positive allergen?**

- `Peanut` → `["Soy", "Lupin", "Peas", "Chickpeas", "Lentils", "Tree nuts"]` ✅
- `House Dust Mite (D. pteronyssinus)` → `["Shrimp", "Crab", "Lobster", "Snails", "Clams"]` ✅
- `Cat Epithelium` → `["Pork", "Beef", "Rabbit", "Lamb"]` ✅
- `Grass Pollen Mix` → `["Tomato", "Melon", "Orange", "Peach", "Celery", "Wheat"]` ✅
- `Milk` → `[]`, notes: `"No match found"` ✅ (correct — not in KB)
- `Wheat` → `[]`, notes: `"No match found"` ✅
- `Alternaria alternata` → `[]`, notes: `"No match found"` ✅
- `Dog Epithelium` → `["Pork", "Beef", "Rabbit", "Lamb"]` ❌ FALSE POSITIVE (matched via `epithelium` token)
- `Cockroach Mix` → `["Tomato", "Melon", ...]` ❌ FALSE POSITIVE (matched via `mix` token)

**Q4: Is `allergies.xlsx` being loaded? What does the DataFrame look like?**

Yes — loaded correctly. 7 rows × 3 columns. After `.str.strip().str.lower()`, columns are `['primary allergen', 'cross-reactive foods', 'risk notes']`. All column accessors in `_row_to_result()` and `MCPServer` work correctly. No loading errors.

**Q5: Does the frontend `/crossAllergens` call match what the backend expects?**

Yes — `GET /crossAllergens`, no body. Backend uses `@app.get`. Field names match: `cross_allergens`, `success`, `summary`, `message` on response; `primary`, `cross_reactive`, `risk`, `notes` per item. No mismatch.

**Q6: Is `MCPServer._find_row()` finding matches for real allergen names from the analyzer?**

For the 5 allergens in the hardcoded OCR list that match KB rows: yes, exact matches work. For allergens outside that set: token overlap may produce false positives. For allergens with no token overlap: correctly returns `None`.

**Q7: What is the exact response structure of `/crossAllergens` vs what the frontend expects?**

Backend returns:
```json
{
  "success": true,
  "cross_allergens": [
    {"primary": "Peanut", "cross_reactive": ["Soy", ...], "risk": "Medium-High", "notes": "...", "wheal_mm": 7}
  ],
  "summary": "...",
  "message": ""
}
```
Frontend `CrossAllergenItem` type: `{primary?, risk?, cross_reactive?: string[], notes?}`.  
All keys match. No field name mismatch.

**Q8: Is the TF-IDF ML model trained? Does it produce results?**

- Docker: token-counter model trains from 7 KB rows. Produces results for known allergens; produces global-fallback (wrong) results for unknown allergens.
- Local: TF-IDF model is coded correctly but `sklearn` is not installed in the local Python. It is installed in Docker. However, the Docker container has the OLD token-counter version (not the TF-IDF version) because the container was never rebuilt after the local `ml_cross_predictor.py` was rewritten.

**Q9: Are there Python exceptions being raised silently?**

Yes, one significant case in Docker `server.py`:  
- `save_report()` raises `Exception("Missing report_date in report payload")` inside the main `try` block of `imageToText`. This is caught by the outer `except`, raises `HTTPException(400, "Unable to read image: Missing report_date...")`.  
- However, `compare_reports()` also checks for `test_date` and returns `False` with a `print()` rather than raising — this is what actually fires (seen in logs). Since `compare_reports` returns `False`, `save_report` is never called. So in practice the 400 never fires for this case.

**Q10: What is the most likely root cause of empty/broken results?**

The Docker container runs the old `ocr.py` with a hardcoded 7-allergen list. Real SPT reports almost always contain allergens not on that list (Milk, Wheat, Dog, Cat with different formatting, Cockroach, Alternaria, etc.). Those are silently dropped during parsing, producing `allergies: {}`, and `get_positive_allergens()` returns `[]`, so Cross Allergens always returns an empty list. The pipeline itself (KB lookup, response structure, frontend rendering) is correct — the failure is purely in the OCR parsing step not being deployed.

---

## Conclusions and Recommended Fixes

### Fix 1 (CRITICAL): Rebuild the Docker container

The local `ocr.py` is a complete rewrite with dynamic allergen detection. It must be deployed.

```bash
docker compose build middleware
docker compose up -d middleware
```

No code changes needed for this fix — it is purely a deployment gap.

### Fix 2 (CRITICAL): Expand the knowledge base

Add at minimum: Milk, Wheat, Egg (check for duplicate vs Egg White), Dog Epithelium, Alternaria alternata, Cockroach, D. farinae, Birch Pollen, Timothy Grass, Latex. Each row needs the three columns: `Primary Allergen`, `Cross-reactive foods`, `Risk notes`.

**File:** `middle-layer/app/allergies.xlsx`

### Fix 3 (HIGH): Remove token-overlap fallback from `_find_row()` or make it stricter

The current fallback triggers on a single shared token. Fix: require a minimum overlap score of 2, or require at least one domain-specific token (not `mix`, `white`, `mite`, `dust`). Better: maintain an explicit canonical alias map.

**File:** `middle-layer/app/mcp_server.py`, method `MCPServer._find_row()`

Example minimal fix:
```python
# Change threshold from > 0 to >= 2 to reduce false positives
return best_row if best_score >= 2 else None
```

Or add a stop-list for generic tokens:
```python
GENERIC_TOKENS = {"mix", "white", "mite", "dust", "pollen", "epithelium", "venom"}
allergen_tokens = {t for t in allergen_norm.split() if len(t) > 2 and t not in GENERIC_TOKENS}
```

### Fix 4 (HIGH): Return a structured "not in KB" indicator

When `cross_reactive_foods` is empty because the allergen is not in the KB, the backend should return a flag the frontend can use to show a clear message instead of a misleading risk badge and "No items listed".

**Backend fix** in `server.py` — `get_cross_allergens()`:
```python
in_kb = bool(foods)  # True if KB has data, False if not
cross_allergens_list.append({
    "primary":        cross_data.get("allergen", allergen),
    "cross_reactive": foods,
    "risk":           risk if in_kb else None,
    "notes":          notes if in_kb else "No cross-allergen information is available in the current knowledge base for this allergen.",
    "in_knowledge_base": in_kb,
    "wheal_mm":       wheal,
})
```

**Frontend fix** in `crossAllergen.tsx`: Render a distinct "Not in knowledge base" state for items where `in_knowledge_base === false`, hiding the risk badge and "No items listed" text.

### Fix 5 (MEDIUM): Fix ML predictor global fallback

When no token matches are found, the current fallback emits globally common foods (shellfish-biased), which is medically misleading. The fix is to return an **empty array** rather than a hallucinated fallback, with a clear message.

**File:** `middle-layer/app/ml_cross_predictor.py`, `_fallback()` method:
```python
def _fallback(self, query: str, top_k: int) -> list[dict]:
    # Return empty — do not invent cross-reactive foods for unknown allergens
    return []
```

The frontend already handles empty predictions: `if (next.length === 0) setPredictMessage('No likely cross-reactive foods could be predicted.')`.

### Fix 6 (LOW): Deploy updated `ml_cross_predictor.py`

The TF-IDF version in the local repo is better architecture. It will be deployed automatically when Fix 1 (container rebuild) is applied, since `requirements.txt` already includes `scikit-learn`.

---

## What Is Working Correctly (Do Not Modify)

- `/crossAllergens` endpoint logic and response structure
- `get_positive_allergens()` — correctly extracts positives, excludes controls
- `mcp_server.get_cross_reactive()` — exact match and substring match work correctly
- `/predictCrossAllergy` endpoint — correctly isolated from analyzer path
- Frontend API call (`GET /crossAllergens`, no body)
- Frontend field name consumption (`cross_allergens`, `cross_reactive`, `primary`, `risk`, `notes`)
- Frontend ML prediction section (user types allergen, POST to `/predictCrossAllergy`)
- Knowledge base loading and column normalization
- `has_uploaded_report()` guard
- `app.state.report` assignment in `imageToText` (set before returning 200)
