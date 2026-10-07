import os
import re

import pandas as pd


DEFAULT_CROSS_ALLERGY_ROWS = [
    {
        "primary allergen": "House Dust Mite (D. pteronyssinus)",
        "cross-reactive foods": "Shrimp, Crab, Lobster, Snails, Clams",
        "risk notes": "Tropomyosin protein similarity may cause shellfish cross-reactivity.",
    },
    {
        "primary allergen": "Cat Epithelium",
        "cross-reactive foods": "Pork, Beef, Rabbit, Lamb",
        "risk notes": "Fel d 1 and mammalian albumin may cross-react with other mammal proteins.",
    },
    {
        "primary allergen": "Grass Pollen Mix",
        "cross-reactive foods": "Tomato, Melon, Orange, Peach, Celery, Wheat",
        "risk notes": "Oral allergy syndrome (pollen-food syndrome) with fresh fruits and vegetables.",
    },
    {
        "primary allergen": "Egg White",
        "cross-reactive foods": "Chicken, Turkey, Duck, Quail",
        "risk notes": "Bird-egg syndrome: poultry meat may trigger reactions in egg-allergic patients.",
    },
    {
        "primary allergen": "Peanut",
        "cross-reactive foods": "Soy, Lupin, Peas, Chickpeas, Lentils, Tree nuts",
        "risk notes": "Legume and tree nut cross-reactivity is possible; verify with clinician.",
    },
    {
        "primary allergen": "Egg",
        "cross-reactive foods": "Chicken, Turkey, Duck, Quail",
        "risk notes": "Bird-egg syndrome with poultry cross-reactivity.",
    },
    {
        "primary allergen": "Dust Mite",
        "cross-reactive foods": "Shrimp, Crab, Lobster, Snails",
        "risk notes": "Tropomyosin cross-reactivity with shellfish.",
    },
]


def _normalize_allergen(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value).lower()).strip()


class MCPServer:
    """
    Simple MCP-style knowledge server for allergen cross-reactivity
    """

    def __init__(self, excel_path: str):
        if excel_path and os.path.isfile(excel_path):
            self.df = pd.read_excel(excel_path)
        else:
            self.df = pd.DataFrame(DEFAULT_CROSS_ALLERGY_ROWS)

        # normalize columns for safety
        self.df.columns = self.df.columns.str.strip().str.lower()

    def _row_to_result(self, allergen: str, row) -> dict:
        return {
            "allergen": allergen,
            "cross_reactive_foods": [
                food.strip()
                for food in str(row.get("cross-reactive foods", "")).split(",")
                if food.strip() and food.strip().lower() != "nan"
            ],
            "notes": row.get("risk notes", ""),
        }

    def _find_row(self, allergen: str):
        if self.df is None or self.df.empty:
            return None

        allergen_norm = _normalize_allergen(allergen)
        primary_col = self.df["primary allergen"].astype(str)

        exact = self.df[primary_col.str.lower() == allergen.lower()]
        if not exact.empty:
            return exact.iloc[0]

        contains = self.df[
            primary_col.str.lower().str.contains(re.escape(allergen), case=False, na=False)
            | primary_col.apply(lambda value: _normalize_allergen(value) in allergen_norm)
            | primary_col.apply(lambda value: allergen_norm in _normalize_allergen(value))
        ]
        if not contains.empty:
            return contains.iloc[0]

        allergen_tokens = {token for token in allergen_norm.split() if len(token) > 2}
        if not allergen_tokens:
            return None

        best_row = None
        best_score = 0
        for _, row in self.df.iterrows():
            row_tokens = {
                token
                for token in _normalize_allergen(row.get("primary allergen", "")).split()
                if len(token) > 2
            }
            overlap = len(allergen_tokens & row_tokens)
            if overlap > best_score:
                best_score = overlap
                best_row = row

        return best_row if best_score > 0 else None

    def get_cross_reactive(self, allergen: str):
        """
        Returns cross-reactive foods + notes for a given allergen
        """
        if self.df is None or self.df.empty:
            return {
                "allergen": allergen,
                "cross_reactive_foods": [],
                "notes": "No dataset loaded",
            }

        row = self._find_row(allergen)
        if row is None:
            return {
                "allergen": allergen,
                "cross_reactive_foods": [],
                "notes": "No match found",
            }

        return self._row_to_result(allergen, row)

    def search_allergens(self, query: str):
        """
        Optional: fuzzy or partial match (simple version for now)
        """
        matches = self.df[
            self.df["primary allergen"].str.contains(query, case=False, na=False)
        ]

        return matches.to_dict(orient="records")
