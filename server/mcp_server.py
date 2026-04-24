import pandas as pd

class MCPServer:
    """
    Simple MCP-style knowledge server for allergen cross-reactivity
    """

    def __init__(self, excel_path: str):
        self.df = pd.read_excel(excel_path)

        # normalize columns for safety
        self.df.columns = self.df.columns.str.strip().str.lower()

    def get_cross_reactive(self, allergen: str):
        """
        Returns cross-reactive foods + notes for a given allergen
        """

        if self.df is None or self.df.empty:
            return {
                "allergen": allergen,
                "cross_reactive_foods": [],
                "notes": "No dataset loaded"
            }

        result = self.df[
            self.df["primary allergen"].str.lower() == allergen.lower()
        ]

        if result.empty:
            return {
                "allergen": allergen,
                "cross_reactive_foods": [],
                "notes": "No match found"
            }

        row = result.iloc[0]

        return {
            "allergen": allergen,
            "cross_reactive_foods": str(row.get("cross-reactive foods", "")).split(","),
            "notes": row.get("risk notes", "")
        }

    def search_allergens(self, query: str):
        """
        Optional: fuzzy or partial match (simple version for now)
        """
        matches = self.df[
            self.df["primary allergen"].str.contains(query, case=False, na=False)
        ]

        return matches.to_dict(orient="records")