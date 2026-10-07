import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from app.mcp_server import MCPServer


CONTROL_ALLERGENS = {
    "negative control (saline)",
    "positive control (histamine)",
    "negative control",
    "positive control",
    "saline",
    "histamine",
}
_POSITIVE_RESULTS = {"positive", "pos", "+", "plus", "true", "yes", "reactive"}
_NEGATIVE_RESULTS = {"negative", "neg", "-", "false", "no", "non-reactive", "nonreactive"}


def _is_positive_allergen(name, details) -> bool:
    if not name or str(name).strip().lower() in CONTROL_ALLERGENS:
        return False
    if not isinstance(details, dict):
        return False
    raw = details.get("result", "")
    result_text = "" if raw is None else str(raw).strip().lower()
    if result_text in _NEGATIVE_RESULTS or result_text.startswith("neg"):
        return False
    if result_text in _POSITIVE_RESULTS or result_text.startswith("pos"):
        return True
    wheal = details.get("wheal_diameter")
    try:
        if wheal is not None and float(wheal) >= 3:
            return True
    except (TypeError, ValueError):
        pass
    return False


def get_positive_allergens(report):
    allergies = report.get("allergies", {}) if isinstance(report, dict) else {}
    return [name for name, details in allergies.items() if _is_positive_allergen(name, details)]


def main():
    excel = os.path.join(HERE, "app", "allergies.xlsx")
    mcp = MCPServer(excel)

    expected_foods = {
        "Peanut": "Soy",
        "House Dust Mite (D. pteronyssinus)": "Shrimp",
        "Cat Epithelium": "Pork",
        "Milk": "Goat milk",
        "Cow's Milk": "Goat milk",
        "Wheat": "Barley",
        "Dog Epithelium": "Pork",
        "Cockroach Mix": "Shrimp",
        "Alternaria alternata": "Mushroom",
        "Birch": "Apple",
        "Latex": "Banana",
    }
    for query, food in expected_foods.items():
        result = mcp.get_cross_reactive(query)
        foods = result["cross_reactive_foods"]
        assert result["matched"], f"{query} should match KB"
        assert any(food.lower() in f.lower() for f in foods), f"{query} missing {food}: {foods}"
        print("OK match", query, "->", foods[:3])

    dog = mcp.get_cross_reactive("Dog Epithelium")
    assert "rabbit" not in " ".join(dog["cross_reactive_foods"]).lower(), dog
    cockroach = mcp.get_cross_reactive("Cockroach Mix")
    assert "tomato" not in " ".join(cockroach["cross_reactive_foods"]).lower(), cockroach
    tree = mcp.get_cross_reactive("Tree Pollen Mix")
    grass = mcp.get_cross_reactive("Grass Pollen Mix")
    assert set(tree["cross_reactive_foods"]) != set(grass["cross_reactive_foods"])
    print("OK distinct matches")

    unknown = mcp.get_cross_reactive("Unobtainium")
    assert unknown["matched"] is False
    assert unknown["cross_reactive_foods"] == []
    print("OK unknown")

    report = {
        "allergies": {
            "Peanut": {"result": "Positive", "wheal_diameter": 7},
            "Milk": {"result": None, "wheal_diameter": 5},
            "Histamine": {"result": "positive", "wheal_diameter": 8},
            "Wheat": {"result": "neg", "wheal_diameter": 6},
            "Birch Pollen": {"result": "pos", "wheal_diameter": 4},
        }
    }
    positives = get_positive_allergens(report)
    print("positives", positives)
    assert "Peanut" in positives
    assert "Milk" in positives
    assert "Birch Pollen" in positives
    assert "Wheat" not in positives
    assert "Histamine" not in positives
    print("ALL CHECKS PASSED")


if __name__ == "__main__":
    main()
