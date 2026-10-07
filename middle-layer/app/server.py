import os
import shutil
from urllib import response
from aiohttp import request
from fastapi import FastAPI, UploadFile, File,Form, HTTPException
from pydantic import BaseModel
from PIL import Image
import io
import re
from datetime import datetime
from typing import Literal
from app.ocr import OCRService
from app.LLM_connection import gpt_connection
from app.mcp_server import MCPServer
from app.ml_cross_predictor import CrossAllergyPredictor
from app.output_formatter import clean_display_text, format_structured_response
from fastapi import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dateutil.parser import parse
app = FastAPI()
import requests
import httpx
from utilities import LoginRequest,RegisterRequest
from datetime import datetime, timedelta, timezone
from jose import jwt
from pdf2image import convert_from_bytes

from difflib import SequenceMatcher

origins = [
    "http://localhost:8081",  # your Expo web
    "http://localhost:8082",
    "http://192.168.56.1:8081",
]
DB_SERVICE_URL = os.getenv(
    "DB_SERVICE_URL",
    "http://db-service:8010"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # or ["*"] for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class DiagnoseRequest(BaseModel):
    symptoms: list[str]


class RecommendRequest(BaseModel):
    diagnosis: str

class DeleteRequest(BaseModel):
    user_id: int


def text_similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, str(a).lower(), str(b).lower()).ratio()


def normalize_date(date_str: str):
    if not date_str:
        return None

    formats = [
        "%B %d, %Y",  # April 12, 2026
        "%d/%m/%Y",   # 12/04/2026
        "%Y-%m-%d",   # 2026-04-12
    ]

    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt).date()
        except ValueError:
            pass

    return None


def report_similarity_score(report1: dict, report2: dict) -> float:
    score = 0.0

    p1 = report1.get("patient", {})
    p2 = report2.get("patient", {})

    # Date (50%)
    d1 = normalize_date(p1.get("test_date"))
    d2 = normalize_date(p2.get("test_date"))

    if d1 and d2:
        if d1 == d2:
            score += 50
        else:
            days_apart = abs((d1 - d2).days)

            if days_apart <= 1:
                score += 40
            elif days_apart <= 7:
                score += 20

    # Name (20%)
    score += 20 * text_similarity(
        p1.get("name", ""),
        p2.get("name", "")
    )

    # DOB (10%)
    if p1.get("date_of_birth") == p2.get("date_of_birth"):
        score += 10

    # Allergies (20%)
    allergies1 = report1.get("allergies", {})
    allergies2 = report2.get("allergies", {})

    common = set(allergies1.keys()) & set(allergies2.keys())

    if common:
        matches = 0

        for allergen in common:
            a1 = allergies1[allergen]
            a2 = allergies2[allergen]

            if (
                a1.get("result") == a2.get("result")
                and a1.get("wheal_diameter") == a2.get("wheal_diameter")
            ):
                matches += 1

        score += 20 * (matches / len(common))

    return round(score, 2)

def compare_reports(report: dict, id: int) -> bool:
    """
    Returns True if the report should be saved (not a duplicate), False if it is.
    Never raises — any failure defaults to True (allow save).
    """
    report_date = report.get("patient", {}).get("test_date", None)

    # Normalise / fallback date
    if not report_date:
        report_date = datetime.today().date().isoformat()
        report.setdefault("patient", {})["test_date"] = report_date
    else:
        try:
            report_date = parse(str(report_date)).date().isoformat()
            report.setdefault("patient", {})["test_date"] = report_date
        except Exception:
            report_date = datetime.today().date().isoformat()
            report.setdefault("patient", {})["test_date"] = report_date

    try:
        with httpx.Client(timeout=8.0) as client:
            response = client.get(
                f"{DB_SERVICE_URL}/get-reports-by-id",
                params={"user_id": id, "report_date": report_date}
            )
        if response.status_code != 200:
            return True   # can't verify → allow save

        existing = response.json()
        print("existing reports on this date:", existing.get("count"))

        if existing.get("count", 0) == 0:
            return True

        for row in existing.get("reports", []):
            # report column may come back as a JSON string — parse if needed
            existing_report = row.get("report", {})
            if isinstance(existing_report, str):
                try:
                    import json
                    existing_report = json.loads(existing_report)
                except Exception:
                    existing_report = {}

            similarity = report_similarity_score(report, existing_report)
            print(f"Similarity: {similarity}%")
            if similarity >= 80:
                print("Duplicate detected — skipping save.")
                return False

        return True

    except Exception as e:
        print(f"compare_reports error (allowing save): {e}")
        return True   # always allow on any error


def save_report_to_db(report: dict, user_id: int) -> bool:
    """
    Saves the report to the DB via the db-service.
    Returns True on success, False on any failure — never raises.
    """
    report_date = report.get("patient", {}).get("test_date") or datetime.today().date().isoformat()

    payload = {
        "user_id": int(user_id),
        "report_date": report_date,
        "report": report,
    }

    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.post(f"{DB_SERVICE_URL}/save-report", json=payload)

        if response.status_code != 200:
            print(f"save_report_to_db HTTP {response.status_code}: {response.text}")
            return False

        print("Report saved to DB:", response.json())
        return True

    except Exception as e:
        print(f"save_report_to_db error: {e}")
        return False
    

def _build_ocr_service() -> OCRService:
    """
    Configure OCR from environment when provided.
    Falls back to system PATH tesseract for local development.
    """
    env_tesseract_cmd = os.getenv("TESSERACT_CMD", "").strip()
    path_tesseract_cmd = shutil.which("tesseract")
    common_windows_paths = [
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    ]
    detected_windows_path = next((p for p in common_windows_paths if os.path.isfile(p)), None)
    tesseract_cmd = env_tesseract_cmd or path_tesseract_cmd or detected_windows_path or None
    tessdata_dir = os.getenv("TESSDATA_DIR", "").strip()
    tessdata_config = f'--tessdata-dir "{tessdata_dir}"' if tessdata_dir else ""
    return OCRService(tesseract_cmd=tesseract_cmd, tessdata_dir_config=tessdata_config)


ocr = _build_ocr_service()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

EXCEL_PATH = os.path.join(BASE_DIR, "allergies.xlsx")

mcp_server = MCPServer(EXCEL_PATH)
# Report-based cross-allergen results must come only from the workbook.
cross_allergen_kb = MCPServer(EXCEL_PATH, include_defaults=False)
ml_predictor = CrossAllergyPredictor(mcp_server.df)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
SECRET_KEY =os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

gpt_con = gpt_connection(
    api_key=OPENAI_API_KEY,
    mcp_server=mcp_server
)

report =None

@app.on_event("startup")
def startup():
    app.state.report = None
    # Conversation history: list of {"role": str, "content": str}
    # Kept server-side as a simple rolling buffer (last 20 turns).
    # NOTE: this is a single global buffer suitable for single-user / demo use.
    # For multi-user production, key this by session/user ID.
    app.state.conversation_history: list[dict] = []


def has_uploaded_report() -> bool:
    report = getattr(app.state, "report", None)
    return isinstance(report, dict) and len(report) > 0

@app.get("/health")
def health():
    return {"status": "ok", "message": "Server is running"}

# @app.post("/saveReport")
# def save_report(report_data: dict):
#     app.state.report = report_data
#     return {"success": True, "message": "Report data saved successfully"}


@app.post("/imageToText")
async def image_to_text(
    file: UploadFile = File(...),
    user_id: str = Form(...),
    user_token: str = Form(...)
):
    # ── 1. Validate user_id ───────────────────────────────────────────────────
    try:
        uid = int(user_id)
        if uid <= 0:
            raise ValueError("user_id must be a positive integer")
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid user_id — must be a positive integer.")

    # ── 2. Validate file presence ─────────────────────────────────────────────
    if file is None or not file.filename:
        raise HTTPException(status_code=400, detail="No file was uploaded.")

    filename = (file.filename or "").strip().lower()

    # ── 3. Validate file extension ────────────────────────────────────────────
    ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".tiff", ".tif", ".bmp", ".webp"}
    import os as _os
    _, ext = _os.path.splitext(filename)
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{ext}'. Accepted formats: PDF, JPG, PNG, TIFF, BMP."
        )

    # ── 4. Read file content ──────────────────────────────────────────────────
    try:
        content = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read uploaded file: {str(e)}")

    # ── 5. Validate file is not empty ─────────────────────────────────────────
    if not content or len(content) == 0:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    # ── 6. Validate file size (max 20 MB) ─────────────────────────────────────
    MAX_BYTES = 20 * 1024 * 1024  # 20 MB
    if len(content) > MAX_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File is too large ({len(content) // (1024*1024)} MB). Maximum allowed size is 20 MB."
        )

    # ── 7. Validate file is not obviously corrupted ───────────────────────────
    # Check magic bytes: PDF starts with %PDF, images have known headers
    def _is_likely_valid(data: bytes, ext: str) -> bool:
        if ext == ".pdf":
            return data[:4] == b"%PDF"
        if ext in (".jpg", ".jpeg"):
            return data[:2] == b"\xff\xd8"
        if ext == ".png":
            return data[:8] == b"\x89PNG\r\n\x1a\n"
        if ext in (".tiff", ".tif"):
            return data[:2] in (b"II", b"MM")
        return True  # BMP/WEBP — let the OCR engine reject if invalid

    if not _is_likely_valid(content, ext):
        raise HTTPException(
            status_code=422,
            detail="The uploaded file appears to be corrupted or is not a valid document."
        )

    # ── 8. Run OCR pipeline ───────────────────────────────────────────────────
    try:
        text = ocr.process(content, filename)
    except Exception as e:
        print(f"[OCR] Processing failed for user {uid}: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=422,
            detail="We were unable to read your document. Please try a clearer, higher-resolution image."
        )

    # ── 9. Parse structured SPT report ───────────────────────────────────────
    try:
        report_json = ocr.parse_report(text)
    except Exception as e:
        print(f"[Parser] SPT parsing failed for user {uid}: {type(e).__name__}: {e}")
        # Non-fatal: return empty report so the summary step can still run
        report_json = {"patient": {}, "allergies": {}, "extraction_meta": {"error": str(e)}}

    # ── 10. Validate we got something usable ──────────────────────────────────
    extracted_lines: list = text.get("lines", []) if isinstance(text, dict) else []
    avg_conf: float = float(text.get("avg_conf", 0.0)) if isinstance(text, dict) else 0.0
    extraction_method: str = text.get("extraction_method", "unknown") if isinstance(text, dict) else "unknown"

    if not extracted_lines:
        raise HTTPException(
            status_code=422,
            detail=(
                "No readable text was found in your document. "
                "Please upload a clearer image or ensure the PDF contains selectable text."
            )
        )

    # Low-confidence warning — log but do not block
    if avg_conf < 40.0 and extraction_method != "pymupdf_native":
        print(f"[OCR] Low average confidence ({avg_conf:.1f}) for user {uid} — results may be unreliable")

    # ── 11. Save to DB (fully isolated — never aborts the OCR response) ───────
    try:
        should_save = compare_reports(report_json, uid)
        print(f"[DB] should_save={should_save} for user {uid}")
        if should_save:
            saved = save_report_to_db(report_json, uid)
            print(f"[DB] Report saved={saved} for user {uid}")
    except Exception as save_err:
        print(f"[DB] Save step failed (non-fatal) for user {uid}: {save_err}")

    app.state.report = report_json

    # ── 12. Generate AI summary ───────────────────────────────────────────────
    try:
        summary = gpt_con.send_initial_report_for_summary(report_json)
        print(f"[LLM] Summary generated for user {uid} ({len(summary)} chars)")
    except Exception as e:
        print(f"[LLM] Summary generation failed for user {uid}: {type(e).__name__}: {e}")
        # Graceful fallback: show extracted allergens without AI summary
        allergens = report_json.get("allergies", {})
        if allergens:
            lines_out = ["We could not generate an AI summary right now. Here is what was extracted:\n"]
            for name, details in allergens.items():
                result = details.get("result", "unknown").title()
                wheal = details.get("wheal_diameter")
                wheal_str = f", wheal {wheal} mm" if wheal is not None else ""
                conf = details.get("confidence", "")
                conf_str = f" [{conf} confidence]" if conf else ""
                lines_out.append(f"- {name}: {result}{wheal_str}{conf_str}")
            summary = "\n".join(lines_out)
        else:
            summary = (
                "We could not generate an AI summary right now.\n\n"
                "Extracted report text (first 15 lines):\n" +
                "\n".join(f"- {ln}" for ln in extracted_lines[:15])
            ) if extracted_lines else "No text found in the uploaded report."

    return {
        "user_id": user_id,
        "summary": clean_display_text(summary),
        "report": report_json,
        # Extra metadata the frontend can use to show confidence indicators
        "extraction_method": extraction_method,
        "avg_ocr_confidence": round(avg_conf, 1),
        "overall_confidence": report_json.get("extraction_meta", {}).get("overall_confidence", "UNKNOWN"),
    }

@app.post("/deleteUserData")
def delete_user_data(data: DeleteRequest):
    user_id = data.user_id
    try:
        delete_url = f"{DB_SERVICE_URL}/delete-user-reports"

        with httpx.Client(timeout=10.0) as client:
            response = client.delete(
                delete_url,
                params={"user_id": user_id}
            )

        if response.status_code != 200:
            return {
                "success": False,
                "error": response.text
            }

        return response.json()

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="DB service timeout")

    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f"Network error: {str(e)}")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))




@app.post("/diagnose")
def diagnose(request: DiagnoseRequest):
    symptoms = request.symptoms

    # Simple mock logic
    if "fever" in symptoms and "cough" in symptoms:
        diagnosis = "Flu"
    elif "headache" in symptoms:
        diagnosis = "Migraine"
    else:
        diagnosis = "Unknown"

    return {
        "symptoms": symptoms,
        "diagnosis": diagnosis
    }


@app.post("/recommend")
def recommend(request: RecommendRequest):
    diagnosis = request.diagnosis

    # Simple recommendations
    recommendations = {
        "Flu": ["Rest", "Hydration", "Paracetamol"],
        "Migraine": ["Pain relievers", "Dark room", "Hydration"],
        "Unknown": ["Consult a doctor"]
    }

    return {
        "diagnosis": diagnosis,
        "recommendations": recommendations.get(diagnosis, ["Consult a doctor"])
    }

class ChatRequest(BaseModel):
    query: str


class CrossPredictRequest(BaseModel):
    query: str
    top_k: int = 5


class UserProfileRequest(BaseModel):
    name: str = "User"
    age: int | None = None
    goals: list[str] = []
    known_allergens: list[str] = []
    dietary_preference: str = "balanced"
    budget: Literal["low", "medium", "high"] = "medium"
    cuisine_preferences: list[str] = []
    region: str = "local"
    is_child_profile: bool = False


class IngredientRiskRequest(BaseModel):
    ingredients_text: str
    known_allergens: list[str] = []


class MealPlanRequest(BaseModel):
    days: int = 7
    meals_per_day: int = 3
    known_allergens: list[str] = []
    goals: list[str] = []
    dietary_preference: str = "balanced"
    budget: Literal["low", "medium", "high"] = "medium"
    cuisine_preferences: list[str] = []


class DietaryGuidanceRequest(BaseModel):
    meal: str
    known_allergens: list[str] = []
    goals: list[str] = []


class SymptomJournalEntryRequest(BaseModel):
    meal: str
    symptoms: list[str]
    severity: Literal["mild", "moderate", "severe"] = "mild"
    observed_at: str | None = None


class MedicationReminderRequest(BaseModel):
    medicine_name: str
    reminder_time: str
    frequency: str = "daily"
    note: str = ""


class RestaurantSafetyRequest(BaseModel):
    cuisine: str
    known_allergens: list[str] = []


class EmergencyCoachRequest(BaseModel):
    symptoms: list[str]


class TravelCardRequest(BaseModel):
    known_allergens: list[str]
    language: str = "english"


class AssistantQueryRequest(BaseModel):
    query: str
    known_allergens: list[str] = []
    history: list[dict] = []   # [{"role": "user"|"assistant", "content": str}, ...]




@app.post("/chatComplete")
def chat_complete(request: ChatRequest):
    if not has_uploaded_report():
        return {
            "success": False,
            "response": "Please upload and process a report first before asking report-based allergy questions."
        }

    try:
        # get response from GPT class
        reply = gpt_con.get_reply(request.query,app.state.report)

        return {
            "success": True,
            "response": clean_display_text(reply)
        }

    except Exception as e:
        return {
            "success": False,
            "response": clean_display_text(f"Sorry, something went wrong. {e}")
        }
    
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


def _allergen_result_text(details) -> str:
    if not isinstance(details, dict):
        return ""
    raw = details.get("result", "")
    if raw is None:
        return ""
    return str(raw).strip().lower()


def _is_positive_allergen(name, details) -> bool:
    if not name or str(name).strip().lower() in CONTROL_ALLERGENS:
        return False
    if not isinstance(details, dict):
        return False
    result_text = _allergen_result_text(details)
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
    if not isinstance(allergies, dict):
        return []
    return [
        name
        for name, details in allergies.items()
        if _is_positive_allergen(name, details)
    ]


def _normalize(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def _known_allergen_set(user_allergens: list[str], fallback_allergens: list[str]) -> set[str]:
    selected = user_allergens if user_allergens else fallback_allergens
    return {_normalize(a) for a in selected if a and a.strip()}


def _meal_templates() -> dict:
    return {
        "breakfast": [
            "Oatmeal with chia and berries",
            "Greek yogurt with banana and sunflower seeds",
            "Veggie omelet with whole-grain toast",
            "Rice porridge with apple slices",
        ],
        "lunch": [
            "Grilled chicken with quinoa and salad",
            "Lentil soup with brown rice",
            "Stir-fried tofu with mixed vegetables",
            "Baked fish with sweet potato and greens",
        ],
        "dinner": [
            "Turkey rice bowl with steamed vegetables",
            "Chickpea curry with basmati rice",
            "Beef and vegetable stew",
            "Vegetable pasta with olive oil and herbs",
        ],
        "snack": [
            "Apple slices with tahini",
            "Carrot sticks with hummus",
            "Roasted chickpeas",
            "Rice cakes with avocado",
        ],
    }


def _safety_filter(meal: str, allergen_set: set[str]) -> bool:
    lowered = _normalize(meal)
    return not any(a in lowered for a in allergen_set)


def _emergency_flag(symptoms: list[str]) -> bool:
    severe_markers = {
        "difficulty breathing",
        "trouble breathing",
        "wheezing",
        "throat swelling",
        "swollen throat",
        "swollen tongue",
        "fainting",
        "anaphylaxis",
    }
    symptom_set = {_normalize(s) for s in symptoms}
    return any(marker in symptom_set for marker in severe_markers)
    
@app.get("/crossAllergens")
def get_cross_allergens():
    if not has_uploaded_report():
        return {
            "success": False,
            "cross_allergens": [],
            "summary": "",
            "message": "Please upload a report first."
        }

    try:
        report = app.state.report if isinstance(app.state.report, dict) else {}
        allergies = report.get("allergies", {})
        if not isinstance(allergies, dict) or not allergies:
            return {
                "success": False,
                "cross_allergens": [],
                "summary": "",
                "message": "No allergens could be read from your report. Please upload a clearer report and run the analyser again."
            }

        cross_allergens_list = []
        allergens = get_positive_allergens(report)

        for allergen in allergens:
            cross_data = cross_allergen_kb.get_cross_reactive(allergen)
            foods = [food.strip() for food in cross_data.get("cross_reactive_foods", [])
                     if food.strip() and food.strip().lower() != "nan"]
            in_kb = bool(cross_data.get("matched")) and len(foods) > 0

            # ── Derive risk level from wheal diameter ──────────────────────
            details = allergies.get(allergen, {}) if isinstance(allergies.get(allergen, {}), dict) else {}
            wheal = details.get("wheal_diameter")
            try:
                wheal = float(wheal) if wheal is not None else None
            except (TypeError, ValueError):
                wheal = None
            if wheal is not None:
                if wheal >= 8:
                    risk = "High"
                elif wheal >= 5:
                    risk = "Medium-High"
                elif wheal >= 3:
                    risk = "Medium"
                else:
                    risk = "Low"
            else:
                risk = "Medium"   # confirmed positive but no wheal measurement

            notes = cross_data.get("notes", "")
            if notes and str(notes).lower() in ("nan", "none", "null", "", "no match found"):
                notes = ""
            if not in_kb:
                notes = "No cross allergen information available in the knowledge base."
                risk = None

            cross_allergens_list.append({
                "primary":           cross_data.get("allergen", allergen),
                "cross_reactive":    foods,
                "risk":              risk,
                "notes":             notes,
                "wheal_mm":          wheal,
                "in_knowledge_base": in_kb,
            })

        message = ""
        if not cross_allergens_list:
            message = "Your report was processed, but no positive allergens were found to map cross-reactive foods."

        return {
            "success":        True,
            "cross_allergens": cross_allergens_list,
            "summary":        "",
            "message":        message
        }

    except Exception as e:
        return {
            "success":        False,
            "cross_allergens": [],
            "summary":        "",
            "message":        clean_display_text(f"Sorry, we could not load cross-allergy results. {e}")
        }


@app.post("/clearReport")
def clear_report():
    app.state.report = None
    app.state.conversation_history = []   # also reset chat context when report is cleared
    return {
        "success": True,
        "message": "Uploaded report context has been cleared."
    }


@app.post("/clearConversation")
def clear_conversation():
    """Reset the server-side conversation history buffer."""
    app.state.conversation_history = []
    return {"success": True, "message": "Conversation history cleared."}


@app.post("/predictCrossAllergy")
def predict_cross_allergy(request: CrossPredictRequest):
    query = request.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query is required")

    top_k = max(1, min(request.top_k, 10))
    predictions = ml_predictor.predict(query, top_k=top_k)
    return {
        "success": True,
        "query": query,
        "predictions": predictions,
    }


@app.post("/userProfile")
def save_user_profile(request: UserProfileRequest):
    app.state.user_profile = request.model_dump()
    return {"success": True, "profile": app.state.user_profile}


@app.get("/userProfile")
def get_user_profile():
    profile = getattr(app.state, "user_profile", {})
    return {"success": True, "profile": profile}


@app.post("/ingredientRiskCheck")
def ingredient_risk_check(request: IngredientRiskRequest):
    profile = getattr(app.state, "user_profile", {})
    known = _known_allergen_set(request.known_allergens, profile.get("known_allergens", []))

    ingredients = [_normalize(i) for i in re.split(r"[,;\n]", request.ingredients_text) if i.strip()]
    direct_hits = [i for i in ingredients if any(allergen in i for allergen in known)]

    cross_hits = []
    for allergen in known:
        cross_data = mcp_server.get_cross_reactive(allergen)
        cross_foods = [str(f).strip().lower() for f in cross_data.get("cross_reactive_foods", []) if str(f).strip()]
        for ingredient in ingredients:
            if any(food in ingredient for food in cross_foods):
                cross_hits.append({"ingredient": ingredient, "linked_allergen": allergen})

    may_contain = [i for i in ingredients if "may contain" in i or "processed in facility" in i]
    risk = "low"
    if direct_hits:
        risk = "high"
    elif cross_hits or may_contain:
        risk = "medium"

    return {
        "success": True,
        "risk": risk,
        "direct_allergen_matches": direct_hits,
        "cross_reactive_matches": cross_hits[:10],
        "label_warnings": may_contain,
        "safe_to_consider": risk == "low",
    }


@app.post("/mealPlan")
def meal_plan(request: MealPlanRequest):
    profile = getattr(app.state, "user_profile", {})
    known = _known_allergen_set(request.known_allergens, profile.get("known_allergens", []))
    templates = _meal_templates()
    days = max(1, min(request.days, 14))
    meals_per_day = max(1, min(request.meals_per_day, 4))

    meal_order = ["breakfast", "lunch", "dinner", "snack"][:meals_per_day]
    generated = []
    for day in range(1, days + 1):
        day_plan = {"day": day, "meals": {}}
        for meal_type in meal_order:
            options = [m for m in templates[meal_type] if _safety_filter(m, known)]
            fallback = [m for m in templates[meal_type]]
            chosen = options[(day - 1) % max(1, len(options))] if options else fallback[(day - 1) % len(fallback)]
            day_plan["meals"][meal_type] = chosen
        generated.append(day_plan)

    guidance = [
        "Keep ingredient labels checked at every purchase.",
        "Prefer simple meals with fewer hidden ingredients.",
        "Rotate protein and vegetable sources for nutrient balance.",
    ]
    return {"success": True, "plan": generated, "guidance": guidance, "allergen_filters": sorted(known)}


@app.post("/dietaryGuidance")
def dietary_guidance(request: DietaryGuidanceRequest):
    profile = getattr(app.state, "user_profile", {})
    known = _known_allergen_set(request.known_allergens, profile.get("known_allergens", []))
    meal_lower = _normalize(request.meal)
    risky = [a for a in known if a in meal_lower]

    substitutes = {
        "milk": "oat or soy milk",
        "egg": "flaxseed egg or chickpea flour binding",
        "wheat": "rice, quinoa, or gluten-free oats",
        "peanut": "sunflower seed butter",
        "tree nut": "pumpkin or sunflower seeds",
        "soy": "lentils, beans, or pea protein",
        "fish": "chicken or legumes",
        "shellfish": "tofu or lean poultry",
    }
    alt = [f"Replace {a} with {substitutes.get(a, 'a safe alternative protein/carbohydrate')}" for a in risky]
    if not alt:
        alt.append("Meal looks generally safe for listed allergens. Re-check packaged ingredients for hidden risks.")

    return {
        "success": True,
        "is_safe": len(risky) == 0,
        "matched_allergens": risky,
        "guidance": alt,
        "nutrition_tips": [
            "Pair protein + fiber + healthy fat for stable energy.",
            "Aim for colorful vegetables and hydration daily.",
        ],
    }


@app.post("/symptomJournalEntry")
def add_symptom_journal_entry(request: SymptomJournalEntryRequest):
    entry_time = request.observed_at or datetime.utcnow().isoformat()
    entry = request.model_dump()
    entry["observed_at"] = entry_time
    if not hasattr(app.state, "symptom_journal"):
        app.state.symptom_journal = []
    app.state.symptom_journal.append(entry)
    return {"success": True, "entry": entry, "total_entries": len(app.state.symptom_journal)}


@app.get("/symptomJournalInsights")
def symptom_journal_insights():
    entries = getattr(app.state, "symptom_journal", [])
    if not entries:
        return {"success": True, "insights": [], "message": "No symptom entries yet."}

    meal_counter = {}
    severe_count = 0
    for item in entries:
        meal = _normalize(item.get("meal", ""))
        meal_counter[meal] = meal_counter.get(meal, 0) + 1
        if item.get("severity") == "severe":
            severe_count += 1

    top_triggers = sorted(meal_counter.items(), key=lambda x: x[1], reverse=True)[:5]
    insights = [f"Possible trigger meal: '{meal}' appeared {count} time(s)." for meal, count in top_triggers if meal]
    if severe_count:
        insights.append(f"{severe_count} severe episode(s) logged. Review emergency plan with a clinician.")
    return {"success": True, "insights": insights}


@app.post("/medicationReminder")
def add_medication_reminder(request: MedicationReminderRequest):
    if not hasattr(app.state, "medication_reminders"):
        app.state.medication_reminders = []
    reminder = request.model_dump()
    app.state.medication_reminders.append(reminder)
    return {"success": True, "reminder": reminder, "total_reminders": len(app.state.medication_reminders)}


@app.get("/shoppingList")
def get_shopping_list():
    profile = getattr(app.state, "user_profile", {})
    known = {_normalize(a) for a in profile.get("known_allergens", [])}
    default_items = [
        "Brown rice",
        "Oats (gluten-free if needed)",
        "Chicken breast",
        "Lentils",
        "Leafy greens",
        "Apples",
        "Olive oil",
        "Plain yogurt alternative",
    ]
    avoid_items = sorted(list(known))
    return {"success": True, "safe_grocery_suggestions": default_items, "avoid_based_on_profile": avoid_items}


@app.post("/restaurantSafety")
def restaurant_safety(request: RestaurantSafetyRequest):
    known = {_normalize(a) for a in request.known_allergens}
    suggested_questions = [
        "Can you confirm this dish has no cross-contact with my allergens?",
        "Is the fryer oil shared with breaded seafood/nuts items?",
        "Can the kitchen prepare this meal with clean utensils and surface?",
    ]
    safer_picks = [
        f"Grilled protein + plain rice + steamed vegetables ({request.cuisine})",
        "Simple salads with dressing on the side",
        "Avoid mixed sauces unless ingredients are fully verified",
    ]
    return {
        "success": True,
        "cuisine": request.cuisine,
        "known_allergens": sorted(list(known)),
        "suggested_questions": suggested_questions,
        "safer_picks": safer_picks,
    }


@app.post("/emergencyCoach")
def emergency_coach(request: EmergencyCoachRequest):
    emergency = _emergency_flag(request.symptoms)
    steps = [
        "Stop eating immediately and monitor symptoms.",
        "Use prescribed antihistamine for mild symptoms if advised by your clinician.",
        "Use epinephrine immediately for severe symptoms and call emergency services.",
        "Do not delay care if breathing, throat, or fainting symptoms appear.",
    ]
    return {"success": True, "is_emergency": emergency, "recommended_steps": steps}


@app.post("/travelCard")
def travel_card(request: TravelCardRequest):
    lang = request.language.lower()
    allergen_text = ", ".join(request.known_allergens) or "food allergens"
    translations = {
        "english": f"I have severe allergies to: {allergen_text}. Please avoid cross-contact.",
        "arabic": f"لدي حساسية شديدة من: {allergen_text}. رجاء تجنب التلوث المتبادل.",
        "spanish": f"Tengo alergias graves a: {allergen_text}. Por favor evite la contaminación cruzada.",
        "french": f"J'ai de graves allergies à : {allergen_text}. Évitez toute contamination croisée.",
    }
    return {"success": True, "language": lang, "card_text": translations.get(lang, translations["english"])}


@app.post("/assistantQuery")
def assistant_query(request: AssistantQueryRequest):
    query = request.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query is required")

    lower = query.lower()
    profile         = getattr(app.state, "user_profile", {})
    report          = app.state.report if has_uploaded_report() else None
    known_allergens = request.known_allergens or profile.get("known_allergens", [])

    # ── Derive known allergens from report if not supplied ────────────────────
    if not known_allergens and report:
        known_allergens = get_positive_allergens(report)

    # ── Merge server-side history with any client-provided history ────────────
    # Client may send its own history; server-side is the authoritative source.
    server_history: list[dict] = getattr(app.state, "conversation_history", [])
    # Prefer client history if longer (client may have more context)
    combined_history = request.history if len(request.history) > len(server_history) else server_history
    # Rolling window: keep last 20 turns
    combined_history = combined_history[-20:]

    # ── Build MCP context from ALLERGEN NAMES (not raw query) ─────────────────
    # Using the query text as an allergen lookup key was a bug — queries like
    # "what should I eat for breakfast?" will never match any allergen in the KB.
    # Instead: look up each confirmed positive allergen from the report.
    def _build_mcp_context(allergens: list) -> str:
        parts = []
        lookup_targets = allergens[:6] if allergens else []

        # Also check if the query itself is an allergen name (e.g. "tell me about peanut")
        query_mcp = mcp_server.get_cross_reactive(query)
        if query_mcp.get("cross_reactive_foods"):
            block = f"Knowledge base match for '{query}':"
            block += f"\n  Cross-reactive foods: {', '.join(query_mcp['cross_reactive_foods'])}"
            if query_mcp.get("notes"):
                block += f"\n  Clinical notes: {query_mcp['notes']}"
            parts.append(block)

        for allergen in lookup_targets:
            try:
                r = mcp_server.get_cross_reactive(allergen)
                cross = r.get("cross_reactive_foods", [])
                notes = r.get("notes", "")
                if cross or notes:
                    block = f"{allergen}:"
                    if cross:
                        block += f"\n  Cross-reactive: {', '.join(cross)}"
                    if notes:
                        block += f"\n  Notes: {notes}"
                    parts.append(block)
            except Exception:
                pass
        return "\n\n".join(parts) if parts else ""

    # ── Build ML context from allergen names (capped at 3) ────────────────────
    def _build_ml_context(allergens: list) -> str:
        parts = []
        targets = allergens[:3]
        for target in targets:
            try:
                preds = ml_predictor.predict(target, top_k=4)
                if preds:
                    lines = [
                        f"  - {p.get('food', '')} ({p.get('likelihood', '')}% — {p.get('confidence','')}) "
                        f"| {p.get('reason','')}"
                        for p in preds
                    ]
                    parts.append(f"ML cross-allergy predictions for '{target}':\n" + "\n".join(lines))
            except Exception:
                pass
        return "\n\n".join(parts) if parts else ""

    mcp_context = _build_mcp_context(known_allergens)
    ml_context  = _build_ml_context(known_allergens)
    enriched    = "\n\n".join(filter(None, [mcp_context, ml_context]))

    # ── Intent routing ────────────────────────────────────────────────────────
    # Each branch now passes enriched context to GPT instead of returning
    # raw template data — the AI interprets and personalises the response.

    # Helper: persist turn to server-side history buffer (rolling 20 turns)
    def _record_and_return(intent: str, reply_text: str) -> dict:
        history_buf = getattr(app.state, "conversation_history", [])
        history_buf.append({"role": "user",      "content": query})
        history_buf.append({"role": "assistant",  "content": reply_text})
        app.state.conversation_history = history_buf[-20:]
        return {"success": True, "intent": intent, "response": clean_display_text(reply_text)}
    if _emergency_flag([query]) or any(w in lower for w in [
        "emergency", "anaphylaxis", "trouble breathing", "throat closing",
        "swollen tongue", "fainting", "epinephrine", "epipen"
    ]):
        emergency_steps = [
            "Stop eating or drinking immediately.",
            "Use your prescribed epinephrine auto-injector (EpiPen) if available and call emergency services (999 / 112 / 911) right away.",
            "Lie down with legs elevated unless breathing is difficult — then sit upright.",
            "Do not take antihistamines as a substitute for epinephrine in a severe reaction.",
            "Go to the nearest emergency department even if symptoms improve after epinephrine — biphasic reactions can occur hours later.",
        ]
        prompt = (
            f"The user has described a possible severe allergic emergency: '{query}'\n\n"
            f"Their known allergens: {', '.join(known_allergens) if known_allergens else 'not specified'}\n\n"
            f"Emergency steps to follow:\n" +
            "\n".join(f"{i+1}. {s}" for i, s in enumerate(emergency_steps)) +
            "\n\nWrite a calm, urgent, specific response directly to this person. "
            "Reference their allergens if known. Tell them exactly what to do right now."
        )
        reply = gpt_con.get_reply(prompt, report, enriched, history=combined_history)
        return _record_and_return("Emergency", reply)

    # Meal plan
    if any(w in lower for w in ["meal plan", "meal planner", "weekly plan", "day plan",
                                  "breakfast", "lunch", "dinner", "what can i eat", "safe foods"]):
        day_match     = re.search(r"(\d+)\s*day", lower)
        requested_days = int(day_match.group(1)) if day_match else 3
        plan_data     = meal_plan(MealPlanRequest(
            days=requested_days, meals_per_day=3,
            known_allergens=known_allergens,
            goals=profile.get("goals", []),
            dietary_preference=profile.get("dietary_preference", "balanced"),
            budget=profile.get("budget", "medium"),
        ))
        prompt = (
            f"The user asked: '{query}'\n\n"
            f"Their allergens: {', '.join(known_allergens) if known_allergens else 'not specified'}\n\n"
            f"A {requested_days}-day allergen-safe meal plan has been generated:\n"
            f"{format_structured_response(plan_data)}\n\n"
            f"{f'Cross-reactivity context:{chr(10)}{mcp_context}' if mcp_context else ''}\n\n"
            "Explain this meal plan intelligently to the person — why each meal is safe, "
            "what nutritional balance it provides, and any specific hidden allergen risks to watch. "
            "Be specific to their actual allergens."
        )
        reply = gpt_con.get_reply(prompt, report, enriched, history=combined_history)
        return _record_and_return("Meal Plan", reply)

    # Ingredient / label check
    if any(w in lower for w in ["ingredient", "label", "safe to eat", "may contain",
                                  "can i eat", "is this safe", "contains", "check this"]):
        risk_data = ingredient_risk_check(IngredientRiskRequest(
            ingredients_text=query, known_allergens=known_allergens
        ))
        prompt = (
            f"The user asked about ingredient safety: '{query}'\n\n"
            f"Their allergens: {', '.join(known_allergens) if known_allergens else 'not specified'}\n\n"
            f"Ingredient analysis result:\n{format_structured_response(risk_data)}\n\n"
            f"{f'MCP knowledge base context:{chr(10)}{mcp_context}' if mcp_context else ''}\n\n"
            f"{f'ML cross-reactivity predictions:{chr(10)}{ml_context}' if ml_context else ''}\n\n"
            "Give an intelligent, specific response about the safety of these ingredients. "
            "Reference direct matches, cross-reactive risks, and hidden sources. "
            "Tell them exactly what to watch for on the label."
        )
        reply = gpt_con.get_reply(prompt, report, enriched, history=combined_history)
        return _record_and_return("Food Safety", reply)

    # Cross allergen / cross-reactive query
    if any(w in lower for w in ["cross", "cross-react", "cross reactive", "cross allerg",
                                  "related foods", "similar foods", "protein family", "pollen food",
                                  "oral allergy", "what else am i allergic"]):
        allergen_list = []
        if report:
            allergen_list = get_positive_allergens(report)
        prompt = (
            f"The user asked: '{query}'\n\n"
            f"Their confirmed positive allergens from their report: {', '.join(allergen_list) if allergen_list else 'not yet available'}\n\n"
            f"{f'Cross-reactivity knowledge base:{chr(10)}{mcp_context}' if mcp_context else ''}\n\n"
            f"{f'ML cross-allergy predictions:{chr(10)}{ml_context}' if ml_context else ''}\n\n"
            "Give a clinically intelligent, specific answer about cross-reactivity. "
            "Reference the protein families involved (tropomyosin, PR-10, nsLTP, profilins etc.), "
            "explain which cross-reactive foods are heat-stable vs heat-labile, "
            "and give concrete avoidance advice based on their actual allergens."
        )
        reply = gpt_con.get_reply(prompt, report, enriched, history=combined_history)
        return _record_and_return("Cross Allergen", reply)

    # Dietary substitutes / alternatives
    if any(w in lower for w in ["substitute", "alternative", "replace", "instead of",
                                  "without", "dairy free", "gluten free", "nut free"]):
        guidance_data = dietary_guidance(DietaryGuidanceRequest(
            meal=query, known_allergens=known_allergens
        ))
        prompt = (
            f"The user asked: '{query}'\n\n"
            f"Their allergens: {', '.join(known_allergens) if known_allergens else 'not specified'}\n\n"
            f"Dietary guidance result:\n{format_structured_response(guidance_data)}\n\n"
            f"{f'MCP knowledge:{chr(10)}{mcp_context}' if mcp_context else ''}\n\n"
            "Give intelligent, specific substitution advice. Name exact products or ingredients. "
            "Explain why each substitute is safe given their specific allergen profile. "
            "Mention any hidden risks in common substitutes (e.g. soy milk for milk allergy if soy is also positive)."
        )
        reply = gpt_con.get_reply(prompt, report, enriched, history=combined_history)
        return _record_and_return("Dietary Guidance", reply)

    # Restaurant / dining out
    if any(w in lower for w in ["restaurant", "menu", "eat out", "dining", "takeaway",
                                  "cafe", "order food", "eating out"]):
        cuisine_match = re.search(r"(thai|indian|chinese|italian|mexican|japanese|greek|turkish|lebanese|french|mediterranean)", lower)
        cuisine       = cuisine_match.group(1).title() if cuisine_match else "general"
        safety_data   = restaurant_safety(RestaurantSafetyRequest(cuisine=cuisine, known_allergens=known_allergens))
        prompt = (
            f"The user asked: '{query}'\n\n"
            f"Their allergens: {', '.join(known_allergens) if known_allergens else 'not specified'}\n\n"
            f"Cuisine: {cuisine}\n\n"
            f"Restaurant safety data:\n{format_structured_response(safety_data)}\n\n"
            f"{f'Cross-reactivity context:{chr(10)}{mcp_context}' if mcp_context else ''}\n\n"
            f"Give specific restaurant safety advice for {cuisine} cuisine. "
            "Name specific dishes to avoid and safer alternatives. "
            "Highlight hidden allergen risks in common sauces, marinades, or cooking oils for this cuisine. "
            "Give 3 specific questions to ask the server."
        )
        reply = gpt_con.get_reply(prompt, report, enriched, history=combined_history)
        return _record_and_return("Restaurant Safety", reply)

    # Travel allergy card
    if any(w in lower for w in ["travel", "translation", "allergy card", "trip", "abroad", "foreign language"]):
        lang_match = re.search(r"(arabic|spanish|french|german|italian|chinese|japanese|turkish)", lower)
        lang       = lang_match.group(1) if lang_match else "english"
        card_data  = travel_card(TravelCardRequest(known_allergens=known_allergens, language=lang))
        prompt = (
            f"The user asked: '{query}'\n\n"
            f"Their allergens: {', '.join(known_allergens) if known_allergens else 'not specified'}\n\n"
            f"Travel allergy card:\n{format_structured_response(card_data)}\n\n"
            f"Expand on this with 3 specific travel tips for managing their allergens abroad. "
            f"Include advice on reading labels in {lang}, high-risk cuisines to be careful with, "
            f"and what to carry in their travel kit."
        )
        reply = gpt_con.get_reply(prompt, report, enriched, history=combined_history)
        return _record_and_return("Travel Card", reply)

    # Report interpretation
    if any(w in lower for w in ["my report", "my results", "my test", "my allergy", "what does my",
                                  "explain my", "my positive", "my negative", "wheal"]):
        if not report:
            msg = (
                "You haven't uploaded an allergy report yet. "
                "Head to the Report Analyser tab, upload your skin-prick test result, "
                "and run the analysis — then come back and ask me anything about your specific results."
            )
            return _record_and_return("Report Query", msg)
        prompt = (
            f"The user asked about their allergy report: '{query}'\n\n"
            f"{f'MCP cross-reactivity data for their allergens:{chr(10)}{mcp_context}' if mcp_context else ''}\n\n"
            f"{f'ML predictions:{chr(10)}{ml_context}' if ml_context else ''}\n\n"
            "Answer their question with direct reference to their actual report data. "
            "Be specific about wheal sizes, sensitivity levels, and what the findings mean practically. "
            "Use correct allergy terminology (IgE sensitisation, wheal diameter thresholds, clinical relevance)."
        )
        reply = gpt_con.get_reply(prompt, report, enriched, history=combined_history)
        return _record_and_return("Report Query", reply)

    # ── Default: fully enriched GPT call ─────────────────────────────────────
    # Every unmatched query still gets report + MCP + ML context injected
    prompt = (
        f"The user asked: '{query}'\n\n"
        f"Their allergens: {', '.join(known_allergens) if known_allergens else 'not specified from report'}\n\n"
        f"{f'Knowledge base context:{chr(10)}{mcp_context}' if mcp_context else ''}\n\n"
        f"{f'ML predictions:{chr(10)}{ml_context}' if ml_context else ''}\n\n"
        "Answer with clinical intelligence and specificity. "
        "Reference their actual allergens and the data above wherever relevant."
    )
    reply = gpt_con.get_reply(prompt, report, enriched, history=combined_history)
    return _record_and_return("General", reply)


def validate_email(email: str) -> bool:
    response = requests.get(
                f"{DB_SERVICE_URL}/check-email",
                params={"email": email}
            )

    data = response.json()
    exists = data["exists"]

    return exists

def register_user(first_name: str, last_name: str, email: str, password: str):
    url = f"{DB_SERVICE_URL}/register" 
    payload = {
        "first_name": first_name,
        "last_name": last_name,
        "email": email,
        "password": password
    }

    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.post(url, json=payload)
        if response.status_code != 200:
            try:
                error_data = response.json()
            except Exception:
                error_data = {"error": response.text}

            raise Exception(
                f"Register failed: {error_data}"
            )

        return response.json()

    except httpx.TimeoutException:
        raise Exception("Request timed out")

    except httpx.RequestError as e:
        raise Exception(f"Network error: {str(e)}")

    except Exception as e:
        raise Exception(f"Unexpected error: {str(e)}")


@app.post("/register")
def register(request: RegisterRequest):

    
    EMAIL_REGEX = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
    PASSWORD_REGEX = r"^(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$"

    first_name = request.first_name
    last_name = request.last_name
    email = request.email
    password = request.password
   

    if (
        first_name is None or
        last_name is None or
        email is None or
        password is None
    ):
        raise HTTPException(
            status_code=400,
            detail="All fields are required"
        )

 
    if (
        first_name.strip() == "" or
        last_name.strip() == "" or
        email.strip() == "" or
        password.strip() == ""
    ):
        raise HTTPException(
            status_code=400,
            detail="Fields cannot be empty"
        )
    if not re.match(EMAIL_REGEX, email):
        raise HTTPException(
            status_code=400,
            detail="Invalid email format"
        )
    if validate_email(email):
        raise HTTPException(
            status_code=400,
            detail="Email is already registered"
        )


    if not re.match(PASSWORD_REGEX, password):
        raise HTTPException(
            status_code=400,
            detail=(
                "Password must contain at least "
                "1 uppercase letter, "
                "1 number, and "
                "1 special character"
            )
        )
    try:
        result = register_user(
            first_name=first_name,
            last_name=last_name,
            email=email,
            password=password
        )
        print(f"Registration result: {result}")

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail= str(e)
        )

    return {
        "success": True,
        "message": "Validation passed"
    }
def create_access_token(data: dict):
    to_encode = data.copy()

    expire = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    to_encode.update({"exp": expire})

    return jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm=ALGORITHM
    )

def authenticate_user(email: str, password: str):
    url = f"{DB_SERVICE_URL}/login"

    payload = {
        "email": email,
        "password": password
    }

    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.post(url, json=payload)

        if response.status_code != 200:
            try:
                error_data = response.json()
                detail = error_data.get("detail") or error_data.get("message") or str(error_data)
            except Exception:
                detail = response.text

            raise Exception(detail)

        user = response.json()

        token = create_access_token({
            "sub": str(user["id"]),
            "email": user["email"]
        })

        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": user["id"],
                "first_name": user["first_name"],
                "last_name": user["last_name"],
                "email": user["email"]
            }
        }

    except httpx.TimeoutException:
        raise Exception("Login request timed out")

    except httpx.RequestError as e:
        raise Exception(f"Network error: {str(e)}")

    except Exception as e:
        raise Exception(f"Unexpected error: {str(e)}")  

@app.post("/login")
def login(request:LoginRequest):

    email=request.email
    password =request.password

    if email is None or password is None:
        raise HTTPException(status_code=400, detail="Email and password are required")
    
    try:
        result = authenticate_user(email=email, password=password)
        # user_id = result.get("user_id")

        # return {
        #     "success": True,
        #     "message": "Login successful",
        #     "user_id": user_id
        # }
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Report History ────────────────────────────────────────────────────────────
@app.get("/reportHistory")
def report_history(user_id: int):
    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.get(f"{DB_SERVICE_URL}/get-all-reports", params={"user_id": user_id})
        if response.status_code != 200:
            return {"success": False, "reports": [], "message": response.text}
        return response.json()
    except Exception as e:
        return {"success": False, "reports": [], "message": str(e)}


# ── Update user profile ───────────────────────────────────────────────────────
@app.post("/updateUser")
def update_user(data: dict):
    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.patch(f"{DB_SERVICE_URL}/update-user", json=data)
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        return response.json()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
