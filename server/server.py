import os
import shutil
from urllib import response
from aiohttp import request
from fastapi import FastAPI, UploadFile, File
from pydantic import BaseModel
from PIL import Image
import io
import re
from datetime import datetime
from typing import Literal
from ocr import OCRService
from LLM_connection import gpt_connection
from mcp_server import MCPServer
from ml_cross_predictor import CrossAllergyPredictor
from output_formatter import clean_display_text, format_structured_response
from fastapi import HTTPException
from fastapi.middleware.cors import CORSMiddleware
app = FastAPI()
import requests
import httpx
from utilClasses import LoginRequest,RegisterRequest

origins = [
    "http://localhost:8081",  # your Expo web
    "http://localhost:8082",
    "http://192.168.56.1:8081",
]

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

mcp_server = MCPServer("allergies.xlsx")
ml_predictor = CrossAllergyPredictor(mcp_server.df)
gpt_con = gpt_connection(api_key=os.getenv("OPENAI_API_KEY"), mcp_server=mcp_server)

report =None

@app.on_event("startup")
def startup():
    app.state.report = None


def has_uploaded_report() -> bool:
    report = getattr(app.state, "report", None)
    return isinstance(report, dict) and len(report) > 0

@app.get("/health")
def health():
    return {"status": "ok", "message": "Server is running"}


@app.post("/imageToText")
async def image_to_text(file: UploadFile = File(...)):
    try:
        content = await file.read()
        text = ocr.process(content)
        report_json = ocr.parse_report(text)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unable to read image: {str(e)}. "
                "Install Tesseract OCR and set TESSERACT_CMD to tesseract.exe path "
                "(example: C:\\Program Files\\Tesseract-OCR\\tesseract.exe), "
                "or add tesseract to PATH."
            ),
        )

    try:
        summary = gpt_con.send_initial_report_for_summary(report_json)
    except Exception as e:
        print(f"Summary generation failed: {e}")
        # Fallback so frontend still gets a useful response.
        lines = text.get("lines", []) if isinstance(text, dict) else []
        summary = clean_display_text(
            "We could not generate an AI summary right now.\n\n"
            "Extracted report text:\n" +
            "\n".join(f"- {line}" for line in lines[:15])
        ) if lines else "No text found in the uploaded report."

    print(f"Summsary: {summary}")
    app.state.report = report_json
    return {
        "filename": file.filename,
        "text": clean_display_text(summary),
        "summary": clean_display_text(summary),
        "report": report_json
    }
    


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
}


def get_positive_allergens(report):
    return [
        name
        for name, details in report.get("allergies", {}).items()
        if details.get("result", "").lower() == "positive"
        and name.strip().lower() not in CONTROL_ALLERGENS
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
        cross_allergens_list = []
        allergens = get_positive_allergens(app.state.report)
        for allergen in allergens:
            cross_allergies = mcp_server.get_cross_reactive(allergen)
            foods = [food.strip() for food in cross_allergies.get("cross_reactive_foods", [])]

            cross_allergens_list.append({
                "primary": cross_allergies.get("allergen", allergen),
                "cross_reactive": foods,
                "risk": "Medium",  # you can improve this later
                "notes": cross_allergies.get("notes", "")
            })
        print("Cross Allergens List:", cross_allergens_list)
        summary = gpt_con.send_cross_allergen_summary(cross_allergens_list)

        return {
            "success": True,
            "cross_allergens": cross_allergens_list,
            "summary": clean_display_text(summary),
            "message": ""
        }

    except Exception as e:
        return {
            "success": False,
            "cross_allergens": [],
            "summary": "",
            "message": clean_display_text(f"Sorry, we could not load cross-allergy results. {e}")
        }


@app.post("/clearReport")
def clear_report():
    app.state.report = None
    return {
        "success": True,
        "message": "Uploaded report context has been cleared."
    }


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
    profile = getattr(app.state, "user_profile", {})
    known_allergens = request.known_allergens or profile.get("known_allergens", [])

    if any(word in lower for word in ["meal", "planner", "breakfast", "lunch", "dinner"]):
        day_match = re.search(r"(\d+)\s*day", lower)
        requested_days = int(day_match.group(1)) if day_match else 3
        plan = meal_plan(
            MealPlanRequest(
                days=requested_days,
                meals_per_day=3,
                known_allergens=known_allergens,
                goals=profile.get("goals", []),
                dietary_preference=profile.get("dietary_preference", "balanced"),
                budget=profile.get("budget", "medium"),
                cuisine_preferences=profile.get("cuisine_preferences", []),
            )
        )
        return {
            "success": True,
            "intent": "Meal Plan",
            "response": format_structured_response(plan),
        }

    if any(word in lower for word in ["ingredient", "label", "safe to eat", "may contain"]):
        result = ingredient_risk_check(
            IngredientRiskRequest(ingredients_text=query, known_allergens=known_allergens)
        )
        return {
            "success": True,
            "intent": "Ingredient Risk",
            "response": format_structured_response(result),
        }

    if any(word in lower for word in ["emergency", "anaphylaxis", "trouble breathing", "throat"]):
        result = emergency_coach(EmergencyCoachRequest(symptoms=[query]))
        return {
            "success": True,
            "intent": "Emergency",
            "response": format_structured_response(result),
        }

    if any(word in lower for word in ["diet", "guidance", "substitute", "alternative"]):
        result = dietary_guidance(DietaryGuidanceRequest(meal=query, known_allergens=known_allergens))
        return {
            "success": True,
            "intent": "Dietary Guidance",
            "response": format_structured_response(result),
        }

    if any(word in lower for word in ["restaurant", "menu", "eat out", "dining"]):
        result = restaurant_safety(RestaurantSafetyRequest(cuisine="general", known_allergens=known_allergens))
        return {
            "success": True,
            "intent": "Restaurant Safety",
            "response": format_structured_response(result),
        }

    if any(word in lower for word in ["travel", "translation", "card"]):
        result = travel_card(TravelCardRequest(known_allergens=known_allergens, language="english"))
        return {
            "success": True,
            "intent": "Travel Card",
            "response": format_structured_response(result),
        }

    fallback = gpt_con.get_reply(query, app.state.report if has_uploaded_report() else None)
    return {"success": True, "intent": "General", "response": clean_display_text(fallback)}


def validate_email(email: str) -> bool:
    response = requests.get(
                "http://localhost:8010/check-email",
                params={"email": email}
            )

    data = response.json()
    exists = data["exists"]

    return exists

def register_user(first_name: str, last_name: str, email: str, password: str):
    url = "http://localhost:8010/register"

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
    if not validate_email(email):
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

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail= str(e)
        )

    return {
        "success": True,
        "message": "Validation passed"
    }

def authenticate_user(email: str, password: str):
    url = "http://localhost:8010/login"

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
            except Exception:
                error_data = {"error": response.text}

            raise Exception(
                f"Login failed: {error_data}"
            )

        return response.json()

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
        user_id = result.get("user_id")

        return {
            "success": True,
            "message": "Login successful",
            "user_id": user_id
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    
