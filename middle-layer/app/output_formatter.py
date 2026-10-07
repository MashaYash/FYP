import re
from typing import Any


PLAINTEXT_OUTPUT_RULES = """
Formatting rules:
- Write in plain, friendly language for a general website audience.
- Do NOT use markdown, asterisks (*), hashtags (#), code blocks, or bold/italic markers.
- Use short section headings ending with a colon on their own line (example: Positive Allergens:).
- Use simple numbered lists (1. 2. 3.) or dash bullets (- item) when listing items.
- Keep paragraphs short and easy to scan.
- Avoid raw JSON, field names, snake_case labels, or technical database language.
"""


def clean_display_text(text: str) -> str:
    if text is None:
        return ""

    if not isinstance(text, str):
        text = str(text)

    cleaned = text.replace("\r\n", "\n").replace("\r", "\n")

    cleaned = re.sub(r"\*\*(.+?)\*\*", r"\1", cleaned)
    cleaned = re.sub(r"__(.+?)__", r"\1", cleaned)
    cleaned = re.sub(r"(?<!\w)\*(?!\s)(.+?)(?<!\s)\*(?!\w)", r"\1", cleaned)
    cleaned = re.sub(r"(?<!\w)_(.+?)_(?!\w)", r"\1", cleaned)
    cleaned = re.sub(r"^\s*[*•]\s+", "- ", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"^\s*#{1,6}\s+", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"`([^`]+)`", r"\1", cleaned)
    cleaned = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", cleaned)
    cleaned = cleaned.replace("*", "")
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)

    return cleaned.strip()


def _title_case_phrase(value: str) -> str:
    return value.replace("_", " ").strip().title()


def format_report_for_display(report: dict) -> str:
    if not isinstance(report, dict):
        return clean_display_text(str(report))

    lines: list[str] = []
    patient = report.get("patient", {})
    if patient:
        lines.append("Patient Information:")
        if patient.get("name"):
            lines.append(f"- Name: {patient['name']}")
        if patient.get("date_of_birth"):
            lines.append(f"- Date of birth: {patient['date_of_birth']}")
        if patient.get("gender"):
            lines.append(f"- Gender: {patient['gender']}")
        if patient.get("test_date"):
            lines.append(f"- Test date: {patient['test_date']}")
        lines.append("")

    allergies = report.get("allergies", {})
    if allergies:
        lines.append("Allergy Test Results:")
        for allergen, details in allergies.items():
            result = str(details.get("result", "unknown")).title()
            wheal = details.get("wheal_diameter")
            wheal_text = f", wheal size {wheal} mm" if wheal is not None else ""
            lines.append(f"- {allergen}: {result}{wheal_text}")

    return clean_display_text("\n".join(lines))


def format_structured_response(payload: Any) -> str:
    if payload is None:
        return "No response available."

    if isinstance(payload, str):
        return clean_display_text(payload)

    if not isinstance(payload, dict):
        return clean_display_text(str(payload))

    if payload.get("text"):
        return clean_display_text(str(payload["text"]))

    if payload.get("plan") and isinstance(payload["plan"], list):
        lines = ["Your Meal Plan:", ""]
        for day in payload["plan"]:
            lines.append(f"Day {day.get('day', '?')}")
            for meal_type, meal in (day.get("meals") or {}).items():
                lines.append(f"- {_title_case_phrase(meal_type)}: {meal}")
            lines.append("")

        guidance = payload.get("guidance") or []
        if guidance:
            lines.append("Helpful Tips:")
            lines.extend(f"- {tip}" for tip in guidance)

        filters = payload.get("allergen_filters") or []
        if filters:
            lines.append("")
            lines.append("Allergens avoided in this plan:")
            lines.append(", ".join(_title_case_phrase(item) for item in filters))

        return clean_display_text("\n".join(lines))

    if "risk" in payload and "direct_allergen_matches" in payload:
        risk = _title_case_phrase(str(payload.get("risk", "unknown")))
        lines = [f"Ingredient Safety Check: {risk} Risk", ""]

        direct = payload.get("direct_allergen_matches") or []
        if direct:
            lines.append("Direct allergen matches:")
            lines.extend(f"- {item}" for item in direct)
            lines.append("")

        cross = payload.get("cross_reactive_matches") or []
        if cross:
            lines.append("Possible cross-reactive matches:")
            for item in cross:
                ingredient = item.get("ingredient", "Unknown ingredient")
                linked = item.get("linked_allergen", "unknown allergen")
                lines.append(f"- {ingredient} (linked to {linked})")
            lines.append("")

        warnings = payload.get("label_warnings") or []
        if warnings:
            lines.append("Label warnings found:")
            lines.extend(f"- {item}" for item in warnings)
            lines.append("")

        if payload.get("safe_to_consider"):
            lines.append("This looks generally safe based on your known allergens, but always double-check labels.")
        else:
            lines.append("Use caution with this product and review ingredients with your clinician if unsure.")

        return clean_display_text("\n".join(lines))

    if payload.get("recommended_steps"):
        lines = ["Emergency Guidance:", ""]
        if payload.get("is_emergency"):
            lines.append("This may be a severe reaction. Seek emergency care immediately.")
            lines.append("")
        lines.extend(f"{index + 1}. {step}" for index, step in enumerate(payload["recommended_steps"]))
        return clean_display_text("\n".join(lines))

    if payload.get("guidance") and payload.get("is_safe") is not None:
        lines = ["Dietary Guidance:", ""]
        if payload.get("is_safe"):
            lines.append("This meal appears generally safe for your listed allergens.")
        else:
            lines.append("This meal may contain allergens you should avoid.")

        matched = payload.get("matched_allergens") or []
        if matched:
            lines.append("")
            lines.append("Matched allergens:")
            lines.append(", ".join(_title_case_phrase(item) for item in matched))

        guidance = payload.get("guidance") or []
        if guidance:
            lines.append("")
            lines.append("Suggestions:")
            lines.extend(f"- {tip}" for tip in guidance)

        tips = payload.get("nutrition_tips") or []
        if tips:
            lines.append("")
            lines.append("Nutrition tips:")
            lines.extend(f"- {tip}" for tip in tips)

        return clean_display_text("\n".join(lines))

    if payload.get("suggested_questions"):
        lines = ["Restaurant Safety Tips:", ""]
        cuisine = payload.get("cuisine")
        if cuisine:
            lines.append(f"Cuisine: {_title_case_phrase(str(cuisine))}")
            lines.append("")

        known = payload.get("known_allergens") or []
        if known:
            lines.append("Your allergens to mention:")
            lines.append(", ".join(_title_case_phrase(item) for item in known))
            lines.append("")

        safer = payload.get("safer_picks") or []
        if safer:
            lines.append("Safer menu choices:")
            lines.extend(f"- {item}" for item in safer)
            lines.append("")

        questions = payload.get("suggested_questions") or []
        if questions:
            lines.append("Questions to ask staff:")
            lines.extend(f"- {item}" for item in questions)

        return clean_display_text("\n".join(lines))

    if payload.get("card_text"):
        lines = ["Travel Allergy Card:", "", str(payload["card_text"])]
        return clean_display_text("\n".join(lines))

    if isinstance(payload.get("insights"), list):
        lines = ["Symptom Insights:", ""]
        lines.extend(f"- {item}" for item in payload["insights"])
        message = payload.get("message")
        if message:
            lines.append("")
            lines.append(str(message))
        return clean_display_text("\n".join(lines))

    return clean_display_text(str(payload))
