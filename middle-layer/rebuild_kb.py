"""
rebuild_kb.py — Rebuilds allergies.xlsx from the in-code knowledge base.

Run once from the middle-layer directory:
    python rebuild_kb.py
"""
import os
import shutil
import sys

import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from app.mcp_server import DEFAULT_CROSS_ALLERGY_ROWS

EXCEL_PATH = os.path.join(HERE, "app", "allergies.xlsx")
BACKUP_PATH = os.path.join(HERE, "app", "allergies_backup.xlsx")


def main():
    if os.path.isfile(EXCEL_PATH):
        shutil.copy2(EXCEL_PATH, BACKUP_PATH)
        print(f"[KB] Backed up existing file to: {BACKUP_PATH}")

    rows = [
        {
            "Primary Allergen": item["primary allergen"],
            "Cross-reactive foods": item["cross-reactive foods"],
            "Risk notes": item["risk notes"],
        }
        for item in DEFAULT_CROSS_ALLERGY_ROWS
    ]
    df = pd.DataFrame(rows)
    df.to_excel(EXCEL_PATH, index=False, sheet_name="Sheet1")
    print(f"[KB] Written {len(df)} rows to: {EXCEL_PATH}")
    print(f"[KB] Columns: {list(df.columns)}")
    print("[KB] Allergens:")
    for i, row in df.iterrows():
        print(f"  {i + 1:2}. {row['Primary Allergen']}")


if __name__ == "__main__":
    main()
