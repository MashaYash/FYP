import os
import re

import pandas as pd


DEFAULT_CROSS_ALLERGY_ROWS = [
    {
        "primary allergen": "House Dust Mite (D. pteronyssinus)",
        "cross-reactive foods": "Shrimp, Crab, Lobster, Prawn, Snails, Clams, Oyster, Scallop",
        "risk notes": "Tropomyosin (Der p 10) is heat-stable and cross-reacts with crustacean/mollusc tropomyosin. Cooking does not eliminate risk.",
    },
    {
        "primary allergen": "House Dust Mite (D. farinae)",
        "cross-reactive foods": "Shrimp, Crab, Lobster, Prawn, Snails, Clams",
        "risk notes": "Tropomyosin cross-reactivity with shellfish. Same mechanism as D. pteronyssinus.",
    },
    {
        "primary allergen": "Cat Epithelium",
        "cross-reactive foods": "Pork, Beef, Rabbit, Lamb, Venison",
        "risk notes": "Cat-pork syndrome: Fel d 2 (serum albumin) cross-reacts with mammalian albumins in pork, beef, rabbit.",
    },
    {
        "primary allergen": "Dog Epithelium",
        "cross-reactive foods": "Pork, Beef",
        "risk notes": "Dog serum albumin (Can f 3) may cross-react with pork and beef albumin in sensitised individuals.",
    },
    {
        "primary allergen": "Grass Pollen Mix",
        "cross-reactive foods": "Tomato, Melon, Watermelon, Orange, Peach, Celery, Wheat, Kiwi, Peanut",
        "risk notes": "Pollen-food syndrome (oral allergy syndrome) via profilins (Phl p 12) and PR-10 proteins. Reactions usually mild (oral itch/tingling) and reduced by cooking.",
    },
    {
        "primary allergen": "Birch Pollen",
        "cross-reactive foods": "Apple, Pear, Cherry, Peach, Apricot, Plum, Hazelnut, Almond, Carrot, Celery, Soy, Peanut, Kiwi, Fennel",
        "risk notes": "Bet v 1 (PR-10) is the major birch allergen. Cross-reacts with homologous PR-10 proteins in rosaceae fruits, nuts, vegetables. Most reactions are oral allergy syndrome (heat-labile).",
    },
    {
        "primary allergen": "Tree Pollen Mix",
        "cross-reactive foods": "Apple, Pear, Cherry, Peach, Hazelnut, Almond, Carrot, Celery, Kiwi",
        "risk notes": "Tree-pollen food syndrome (often birch-related PR-10). Fresh fruit and nut oral symptoms are common; cooking usually reduces risk.",
    },
    {
        "primary allergen": "Mugwort Pollen",
        "cross-reactive foods": "Celery, Carrot, Fennel, Parsley, Apple, Peach, Mango, Pepper, Coriander, Anise, Cumin",
        "risk notes": "Mugwort-celery-spice syndrome. Art v 1 (PR-10), profilins and nsLTPs involved. Spice reactions can be systemic.",
    },
    {
        "primary allergen": "Ragweed Pollen",
        "cross-reactive foods": "Melon, Watermelon, Cucumber, Zucchini, Banana, Sunflower seeds, Chamomile",
        "risk notes": "Ragweed-fruit syndrome via profilins and Amb a 8. Oral allergy syndrome pattern.",
    },
    {
        "primary allergen": "Peanut",
        "cross-reactive foods": "Soy, Lupin, Peas, Chickpeas, Lentils, Fenugreek, Tree nuts, Green bean",
        "risk notes": "Legume family cross-reactivity via 2S albumins (Ara h 2/6), vicilins (Ara h 1/3). Lupin is a significant hidden allergen in pasta and flour. Verify with clinician.",
    },
    {
        "primary allergen": "Egg White",
        "cross-reactive foods": "Chicken, Turkey, Duck, Quail, Goose",
        "risk notes": "Bird-egg syndrome: serum albumin (Gal d 5) cross-reacts with poultry meat albumins. Ovomucoid (Gal d 1) is heat-stable and persists after cooking.",
    },
    {
        "primary allergen": "Cow's Milk",
        "cross-reactive foods": "Goat milk, Sheep milk, Buffalo milk, Mare milk, Camel milk",
        "risk notes": "Casein (Bos d 8) and whey proteins (beta-lactoglobulin, alpha-lactalbumin) cross-react across ruminant milks. Mare and camel milk have lower cross-reactivity. Beef cross-reactivity is rare (<10%) due to heat denaturation of serum albumin.",
    },
    {
        "primary allergen": "Wheat",
        "cross-reactive foods": "Barley, Rye, Spelt, Kamut, Triticale, Oat (possible), Grass pollen",
        "risk notes": "Omega-5 gliadin (Tri a 19) causes wheat-dependent exercise-induced anaphylaxis. nsLTP (Tri a 14) cross-reacts with other grass cereals. Oat cross-reactivity is uncommon but possible.",
    },
    {
        "primary allergen": "Soy",
        "cross-reactive foods": "Peanut, Lupin, Peas, Lentils, Chickpeas, Mung bean",
        "risk notes": "Gly m 4 (PR-10) causes birch-pollen-related oral allergy syndrome. Gly m 5/6 (storage proteins) cause systemic reactions. Legume cross-reactivity possible.",
    },
    {
        "primary allergen": "Fish (Cod)",
        "cross-reactive foods": "Salmon, Tuna, Mackerel, Herring, Sardine, Anchovy, Halibut, Plaice, Haddock, Pollock",
        "risk notes": "Parvalbumin (Gad c 1) is the major pan-allergen across bony fish. Heat-stable — cooking does not eliminate. Patients allergic to cod are usually allergic to most bony fish.",
    },
    {
        "primary allergen": "Shrimp",
        "cross-reactive foods": "Crab, Lobster, Prawn, Crayfish, Squid, Octopus, Snails, House dust mite, Cockroach",
        "risk notes": "Tropomyosin is the pan-allergen for crustaceans and molluscs. Heat-stable. Cross-reactivity with insects (dust mite, cockroach) via tropomyosin also documented.",
    },
    {
        "primary allergen": "Tree Nut Mix",
        "cross-reactive foods": "Walnut, Cashew, Pistachio, Pecan, Brazil nut, Hazelnut, Almond, Macadamia, Pine nut, Peanut",
        "risk notes": "2S albumins, nsLTPs and vicilins mediate tree nut cross-reactivity. Walnut-pecan and cashew-pistachio are the highest-risk pairs. Peanut co-reactivity is frequent in clinical practice.",
    },
    {
        "primary allergen": "Hazelnut",
        "cross-reactive foods": "Walnut, Almond, Cashew, Birch pollen foods (apple, peach, carrot), Peanut",
        "risk notes": "Cor a 1 (PR-10, birch-related, OAS) and Cor a 8 (nsLTP, systemic risk). Patients sensitised to Cor a 8 have higher systemic reaction risk.",
    },
    {
        "primary allergen": "Walnut",
        "cross-reactive foods": "Pecan, Hazelnut, Cashew, Peanut",
        "risk notes": "Walnut-pecan is a high-risk pair via 2S albumins and vicilins. Other tree-nut co-reactivity is common.",
    },
    {
        "primary allergen": "Cashew",
        "cross-reactive foods": "Pistachio, Hazelnut, Walnut, Peanut",
        "risk notes": "Cashew-pistachio is a high-risk pair. Ana o 3 (2S albumin) is associated with systemic reactions.",
    },
    {
        "primary allergen": "Almond",
        "cross-reactive foods": "Hazelnut, Peach, Apricot, Birch pollen foods (apple, cherry)",
        "risk notes": "Almond can participate in PR-10 / nsLTP plant-food cross-reactivity, especially with other tree nuts and stone fruit.",
    },
    {
        "primary allergen": "Sesame",
        "cross-reactive foods": "Poppy seed, Kiwi, Rye, Peanut, Tree nuts",
        "risk notes": "Ses i 1 (2S albumin) and Ses i 3 (vicilin) are heat-stable and cause systemic reactions. Cross-reactivity with poppy seed via 2S albumins documented.",
    },
    {
        "primary allergen": "Latex",
        "cross-reactive foods": "Banana, Avocado, Kiwi, Chestnut, Papaya, Apple, Carrot, Celery, Potato, Tomato, Fig",
        "risk notes": "Latex-fruit syndrome: Hev b 6 (hevein) cross-reacts with class I chitinases in tropical fruits. Banana, avocado, kiwi and chestnut are the highest-risk foods.",
    },
    {
        "primary allergen": "Alternaria alternata",
        "cross-reactive foods": "Mushroom, Yeast (bread, beer, wine), Marmite",
        "risk notes": "Alt a 1 (major mould allergen) has structural homology with some fungal proteins. Food fungal cross-reactivity is limited but documented in sensitised individuals.",
    },
    {
        "primary allergen": "Aspergillus fumigatus",
        "cross-reactive foods": "Mushroom, Yeast extract, Fermented foods (wine, beer, cheese)",
        "risk notes": "Fungal pan-allergens (MnSOD, enolase) may cross-react with dietary fungi and fermented foods. Relevant mainly in allergic bronchopulmonary aspergillosis.",
    },
    {
        "primary allergen": "Cladosporium",
        "cross-reactive foods": "Mushroom, Yeast (bread, beer), Fermented foods",
        "risk notes": "Mould pan-allergens may confer limited cross-reactivity with dietary fungi. Food reactions are uncommon compared with inhalant symptoms.",
    },
    {
        "primary allergen": "Cockroach",
        "cross-reactive foods": "Shrimp, Crab, Lobster, Prawn, Snails",
        "risk notes": "Tropomyosin (Per a 7) from cockroach cross-reacts with shellfish tropomyosin. Patients with cockroach allergy may react to crustaceans.",
    },
    {
        "primary allergen": "Egg",
        "cross-reactive foods": "Chicken, Turkey, Duck, Quail",
        "risk notes": "Bird-egg syndrome with poultry cross-reactivity.",
    },
    {
        "primary allergen": "Dust Mite",
        "cross-reactive foods": "Shrimp, Crab, Lobster, Snails",
        "risk notes": "Tropomyosin cross-reactivity with crustacean shellfish.",
    },
]


# Normalised query aliases → canonical KB primary-allergen name
ALLERGEN_ALIASES = {
    "house dust mite": "House Dust Mite (D. pteronyssinus)",
    "d pteronyssinus": "House Dust Mite (D. pteronyssinus)",
    "dermatophagoides pteronyssinus": "House Dust Mite (D. pteronyssinus)",
    "dust mite": "Dust Mite",
    "d farinae": "House Dust Mite (D. farinae)",
    "dermatophagoides farinae": "House Dust Mite (D. farinae)",
    "cat epithelium": "Cat Epithelium",
    "cat dander": "Cat Epithelium",
    "cat hair": "Cat Epithelium",
    "cat": "Cat Epithelium",
    "dog epithelium": "Dog Epithelium",
    "dog dander": "Dog Epithelium",
    "dog hair": "Dog Epithelium",
    "dog": "Dog Epithelium",
    "grass pollen": "Grass Pollen Mix",
    "grass pollen mix": "Grass Pollen Mix",
    "grass mix": "Grass Pollen Mix",
    "timothy grass": "Grass Pollen Mix",
    "bermuda grass": "Grass Pollen Mix",
    "birch pollen": "Birch Pollen",
    "birch": "Birch Pollen",
    "tree pollen": "Tree Pollen Mix",
    "tree pollen mix": "Tree Pollen Mix",
    "mugwort": "Mugwort Pollen",
    "mugwort pollen": "Mugwort Pollen",
    "ragweed": "Ragweed Pollen",
    "ragweed pollen": "Ragweed Pollen",
    "peanut": "Peanut",
    "peanuts": "Peanut",
    "ground nut": "Peanut",
    "groundnut": "Peanut",
    "egg white": "Egg White",
    "hen egg": "Egg White",
    "egg": "Egg White",
    "cow milk": "Cow's Milk",
    "cows milk": "Cow's Milk",
    "cow s milk": "Cow's Milk",
    "milk": "Cow's Milk",
    "wheat": "Wheat",
    "soy": "Soy",
    "soya": "Soy",
    "soybean": "Soy",
    "fish": "Fish (Cod)",
    "cod": "Fish (Cod)",
    "codfish": "Fish (Cod)",
    "fish cod": "Fish (Cod)",
    "shrimp": "Shrimp",
    "prawn": "Shrimp",
    "shellfish": "Shrimp",
    "tree nut": "Tree Nut Mix",
    "tree nut mix": "Tree Nut Mix",
    "tree nuts": "Tree Nut Mix",
    "walnut": "Walnut",
    "cashew": "Cashew",
    "almond": "Almond",
    "hazelnut": "Hazelnut",
    "sesame": "Sesame",
    "latex": "Latex",
    "alternaria": "Alternaria alternata",
    "alternaria alternata": "Alternaria alternata",
    "alternaria alternata mould": "Alternaria alternata",
    "aspergillus": "Aspergillus fumigatus",
    "aspergillus fumigatus": "Aspergillus fumigatus",
    "aspergillus mould": "Aspergillus fumigatus",
    "cladosporium": "Cladosporium",
    "cladosporium mould": "Cladosporium",
    "cockroach": "Cockroach",
    "cockroach mix": "Cockroach",
}

GENERIC_TOKENS = {
    "mix", "white", "mite", "dust", "pollen", "epithelium", "venom",
    "mould", "mold", "hair", "dander", "extract", "control", "food",
    "foods", "the", "and",
}


def _normalize_allergen(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value).lower()).strip()


def _prepare_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    prepared = df.copy()
    prepared.columns = prepared.columns.str.strip().str.lower()
    rename = {}
    for col in prepared.columns:
        compact = re.sub(r"[^a-z]+", "", col)
        if compact in {"primaryallergen", "allergen", "primary"}:
            rename[col] = "primary allergen"
        elif compact in {"crossreactivefoods", "crossreactive", "foods"}:
            rename[col] = "cross-reactive foods"
        elif compact in {"risknotes", "notes", "risk"}:
            rename[col] = "risk notes"
    if rename:
        prepared = prepared.rename(columns=rename)
    return prepared


def _resolve_alias(allergen: str) -> str:
    norm = _normalize_allergen(allergen)
    if not norm:
        return allergen
    if norm in ALLERGEN_ALIASES:
        return ALLERGEN_ALIASES[norm]
    best_alias = ""
    best_name = allergen
    for alias, canonical in ALLERGEN_ALIASES.items():
        if alias in norm and len(alias) > len(best_alias):
            best_alias = alias
            best_name = canonical
    return best_name


class MCPServer:
    """
    Simple MCP-style knowledge server for allergen cross-reactivity
    """

    def __init__(self, excel_path: str, include_defaults: bool = True):
        default_df = _prepare_dataframe(pd.DataFrame(DEFAULT_CROSS_ALLERGY_ROWS))
        if excel_path and os.path.isfile(excel_path):
            excel_df = _prepare_dataframe(pd.read_excel(excel_path))
            combined = pd.concat(
                [default_df, excel_df] if include_defaults else [excel_df],
                ignore_index=True,
            )
            combined["primary allergen"] = combined["primary allergen"].astype(str).str.strip()
            combined = combined[combined["primary allergen"].str.lower() != "nan"]
            combined = combined.drop_duplicates(subset=["primary allergen"], keep="last")
            self.df = combined.reset_index(drop=True)
        else:
            self.df = default_df if include_defaults else pd.DataFrame(
                columns=["primary allergen", "cross-reactive foods", "risk notes"]
            )

    def _empty_result(self, allergen: str, notes: str) -> dict:
        return {
            "allergen": allergen,
            "cross_reactive_foods": [],
            "notes": notes,
            "matched": False,
        }

    def _row_to_result(self, allergen: str, row) -> dict:
        return {
            "allergen": allergen,
            "cross_reactive_foods": [
                food.strip()
                for food in str(row.get("cross-reactive foods", "")).split(",")
                if food.strip() and food.strip().lower() != "nan"
            ],
            "notes": row.get("risk notes", ""),
            "matched": True,
        }

    def _lookup_exact(self, name: str):
        if not name:
            return None
        primary_col = self.df["primary allergen"].astype(str)
        exact = self.df[primary_col.str.lower() == name.lower()]
        if not exact.empty:
            return exact.iloc[0]
        norm = _normalize_allergen(name)
        for _, row in self.df.iterrows():
            if _normalize_allergen(row.get("primary allergen", "")) == norm:
                return row
        return None

    def _find_row(self, allergen: str):
        if self.df is None or self.df.empty:
            return None

        aliased = _resolve_alias(allergen)
        # A matched pandas Series cannot be used with Python's `or`: pandas
        # raises an ambiguous-truth-value error for multi-column rows.
        row = self._lookup_exact(aliased)
        if row is None:
            row = self._lookup_exact(allergen)
        if row is not None:
            return row

        allergen_norm = _normalize_allergen(allergen)
        if not allergen_norm:
            return None

        # Conservative contains: only if the shorter name is distinctive (>= 4 chars)
        # and is not a generic token.
        best_row = None
        best_len = 0
        for _, candidate in self.df.iterrows():
            row_norm = _normalize_allergen(candidate.get("primary allergen", ""))
            if not row_norm:
                continue
            shorter, longer = (allergen_norm, row_norm) if len(allergen_norm) <= len(row_norm) else (row_norm, allergen_norm)
            if len(shorter) < 4 or shorter in GENERIC_TOKENS:
                continue
            if shorter == longer or shorter in longer:
                if len(shorter) > best_len:
                    best_len = len(shorter)
                    best_row = candidate
        if best_row is not None:
            return best_row

        allergen_tokens = {
            token for token in allergen_norm.split()
            if len(token) > 2 and token not in GENERIC_TOKENS
        }
        if not allergen_tokens:
            return None

        best_row = None
        best_score = 0
        for _, candidate in self.df.iterrows():
            row_tokens = {
                token
                for token in _normalize_allergen(candidate.get("primary allergen", "")).split()
                if len(token) > 2 and token not in GENERIC_TOKENS
            }
            overlap = len(allergen_tokens & row_tokens)
            if overlap > best_score:
                best_score = overlap
                best_row = candidate

        # Require two distinctive tokens, or one strong unique token (>= 5 chars)
        if best_score >= 2:
            return best_row
        if best_score == 1:
            shared = next(iter(
                allergen_tokens & {
                    token
                    for token in _normalize_allergen(best_row.get("primary allergen", "")).split()
                    if len(token) > 2 and token not in GENERIC_TOKENS
                }
            ), "")
            if len(shared) >= 5:
                return best_row
        return None

    def get_cross_reactive(self, allergen: str):
        """
        Returns cross-reactive foods + notes for a given allergen
        """
        if self.df is None or self.df.empty:
            return self._empty_result(allergen, "No dataset loaded")

        row = self._find_row(allergen)
        if row is None:
            return self._empty_result(allergen, "No match found")

        return self._row_to_result(allergen, row)

    def search_allergens(self, query: str):
        """
        Optional: fuzzy or partial match (simple version for now)
        """
        matches = self.df[
            self.df["primary allergen"].str.contains(query, case=False, na=False)
        ]

        return matches.to_dict(orient="records")
