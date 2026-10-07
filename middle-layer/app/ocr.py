"""
ocr.py — Improved document processing pipeline for AllergyGenie

Pipeline:
  File bytes
  → File type detection
  → PDF: try native text extraction (PyMuPDF) first
      → if native text is good → use directly
      → if scanned/poor → convert pages to images → preprocessing → Tesseract
  → Image: preprocessing → Tesseract
  → Confidence-weighted line assembly
  → SPT field extraction
  → Structured JSON output with confidence scores

Public interface is unchanged:
  ocr.process(bytes, filename) → {"lines": [...], "data": {...}}
  ocr.parse_report(result)     → {"patient": {...}, "allergies": {...}}
"""

from __future__ import annotations

import io
import re
import unicodedata
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
import pytesseract
from PIL import Image

# ── Optional imports — degrade gracefully if not yet installed ─────────────────
try:
    import fitz  # PyMuPDF
    _PYMUPDF_AVAILABLE = True
except ImportError:
    _PYMUPDF_AVAILABLE = False

try:
    import cv2
    _OPENCV_AVAILABLE = True
except ImportError:
    _OPENCV_AVAILABLE = False

try:
    from pdf2image import convert_from_bytes as _pdf2image_convert
    _PDF2IMAGE_AVAILABLE = True
except ImportError:
    _PDF2IMAGE_AVAILABLE = False


# ══════════════════════════════════════════════════════════════════════════════
# Constants
# ══════════════════════════════════════════════════════════════════════════════

# Minimum characters per page to consider native PDF text usable
_MIN_NATIVE_TEXT_CHARS = 80

# Tesseract confidence threshold — words below this are flagged uncertain
_OCR_CONF_THRESHOLD = 45

# Re-attempt threshold — if average page confidence is below this, retry with
# a different preprocessing strategy
_PAGE_CONF_RETRY_THRESHOLD = 60.0

# Units that confirm a numeric value is a wheal/flare measurement
_MM_PATTERNS = re.compile(r"\b(\d{1,2}(?:\.\d)?)\s*(?:mm|MM|Mm)?\b")

# Controls that must never be reported as patient allergens
_CONTROL_ALLERGEN_KEYWORDS = {
    "negative control", "positive control", "saline", "histamine",
    "neg control", "pos control", "buffer control",
}

# ── Canonical allergen name map ────────────────────────────────────────────────
# Maps lowercase normalised variants → canonical display name.
# Extend this list as needed; the parser is no longer limited to this list —
# it will dynamically extract any allergen it finds in the report.
CANONICAL_ALLERGEN_MAP: dict[str, str] = {
    # Dust mites
    "house dust mite": "House Dust Mite (D. pteronyssinus)",
    "d pteronyssinus": "House Dust Mite (D. pteronyssinus)",
    "d. pteronyssinus": "House Dust Mite (D. pteronyssinus)",
    "dermatophagoides pteronyssinus": "House Dust Mite (D. pteronyssinus)",
    "d farinae": "House Dust Mite (D. farinae)",
    "d. farinae": "House Dust Mite (D. farinae)",
    "dust mite": "House Dust Mite (D. pteronyssinus)",
    # Animal dander
    "cat epithelium": "Cat Epithelium",
    "cat dander": "Cat Epithelium",
    "cat hair": "Cat Epithelium",
    "cat": "Cat Epithelium",
    "dog epithelium": "Dog Epithelium",
    "dog dander": "Dog Epithelium",
    "dog": "Dog Epithelium",
    # Pollens
    "grass pollen": "Grass Pollen Mix",
    "grass pollen mix": "Grass Pollen Mix",
    "grass mix": "Grass Pollen Mix",
    "grass": "Grass Pollen Mix",
    "timothy grass": "Grass Pollen Mix",
    "bermuda grass": "Grass Pollen Mix",
    "tree pollen": "Tree Pollen Mix",
    "birch pollen": "Birch Pollen",
    "birch": "Birch Pollen",
    "mugwort": "Mugwort Pollen",
    "ragweed": "Ragweed Pollen",
    # Foods
    "egg white": "Egg White",
    "egg": "Egg White",
    "hen egg": "Egg White",
    "cow milk": "Cow's Milk",
    "cow's milk": "Cow's Milk",
    "milk": "Cow's Milk",
    "peanut": "Peanut",
    "peanuts": "Peanut",
    "ground nut": "Peanut",
    "groundnut": "Peanut",
    "wheat": "Wheat",
    "soy": "Soy",
    "soya": "Soy",
    "soybean": "Soy",
    "fish": "Fish (Cod)",
    "codfish": "Fish (Cod)",
    "cod": "Fish (Cod)",
    "shrimp": "Shrimp",
    "prawn": "Shrimp",
    "shellfish": "Shrimp",
    "tree nut": "Tree Nut Mix",
    "walnut": "Walnut",
    "cashew": "Cashew",
    "almond": "Almond",
    "hazelnut": "Hazelnut",
    "sesame": "Sesame",
    "latex": "Latex",
    # Moulds
    "alternaria": "Alternaria alternata",
    "alternaria alternata": "Alternaria alternata",
    "cladosporium": "Cladosporium",
    "aspergillus": "Aspergillus fumigatus",
    "aspergillus fumigatus": "Aspergillus fumigatus",
    # Insects
    "cockroach": "Cockroach",
    "cockroach mix": "Cockroach",
}


# ══════════════════════════════════════════════════════════════════════════════
# Data structures
# ══════════════════════════════════════════════════════════════════════════════

@dataclass
class ExtractedWord:
    text: str
    x: int
    y: int
    conf: int
    page: int = 0


@dataclass
class AllergenEntry:
    name: str
    canonical_name: str
    wheal_diameter: Optional[float] = None
    flare_diameter: Optional[float] = None
    result: str = "unknown"          # positive | negative | unknown
    unit: str = "mm"
    confidence: str = "LOW"          # HIGH | MEDIUM | LOW
    ocr_conf_score: float = 0.0
    source_page: int = 0
    is_control: bool = False


# ══════════════════════════════════════════════════════════════════════════════
# Helpers
# ══════════════════════════════════════════════════════════════════════════════

def _normalise(text: str) -> str:
    """Lowercase, strip accents, collapse whitespace, remove punctuation."""
    text = unicodedata.normalize("NFKD", str(text))
    text = text.encode("ascii", "ignore").decode("ascii")
    text = text.lower()
    text = re.sub(r"[^\w\s]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _canonicalise(name: str) -> str:
    """Return canonical allergen name if known, otherwise title-case the input."""
    norm = _normalise(name)
    # exact match
    if norm in CANONICAL_ALLERGEN_MAP:
        return CANONICAL_ALLERGEN_MAP[norm]
    # substring match (longest key wins)
    best_key = ""
    for key in CANONICAL_ALLERGEN_MAP:
        if key in norm and len(key) > len(best_key):
            best_key = key
    if best_key:
        return CANONICAL_ALLERGEN_MAP[best_key]
    return name.strip().title()


def _is_control(name: str) -> bool:
    norm = _normalise(name)
    return any(kw in norm for kw in _CONTROL_ALLERGEN_KEYWORDS)


def _ocr_confidence_level(avg_conf: float) -> str:
    if avg_conf >= 75:
        return "HIGH"
    if avg_conf >= 50:
        return "MEDIUM"
    return "LOW"


def _extract_measurement(text: str) -> Optional[float]:
    """Extract the first plausible SPT measurement (0–25 mm) from a text chunk."""
    for m in _MM_PATTERNS.finditer(text):
        val = float(m.group(1))
        if 0 <= val <= 25:
            return val
    return None


# ══════════════════════════════════════════════════════════════════════════════
# Image preprocessing
# ══════════════════════════════════════════════════════════════════════════════

def _preprocess_image(pil_image: Image.Image, strategy: str = "auto") -> Image.Image:
    """
    Apply adaptive preprocessing based on image characteristics.
    strategy: "auto" | "light" | "aggressive"
    Returns a PIL Image ready for Tesseract.
    """
    if not _OPENCV_AVAILABLE:
        # Fallback: basic PIL grayscale only
        return pil_image.convert("L")

    # Convert PIL → numpy BGR
    img_np = np.array(pil_image.convert("RGB"))
    img_bgr = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)

    # ── 1. Upscale if image is small (improves Tesseract accuracy significantly)
    h, w = img_bgr.shape[:2]
    if max(h, w) < 1500:
        scale = 2.0
        img_bgr = cv2.resize(img_bgr, None, fx=scale, fy=scale,
                             interpolation=cv2.INTER_CUBIC)

    # ── 2. Grayscale
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

    # ── 3. Auto-detect whether image needs aggressive processing
    if strategy == "auto":
        # Measure contrast: std dev of pixel values
        std_dev = float(np.std(gray))
        mean_val = float(np.mean(gray))
        # Very low contrast or very dark/light → aggressive
        if std_dev < 30 or mean_val < 50 or mean_val > 220:
            strategy = "aggressive"
        else:
            strategy = "light"

    if strategy == "light":
        # Mild denoise + OTSU threshold
        denoised = cv2.fastNlMeansDenoising(gray, h=10)
        _, binary = cv2.threshold(denoised, 0, 255,
                                  cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        processed = binary

    else:  # aggressive
        # CLAHE for contrast enhancement
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)
        # Denoise more heavily
        denoised = cv2.fastNlMeansDenoising(enhanced, h=15)
        # Adaptive threshold handles uneven lighting
        binary = cv2.adaptiveThreshold(
            denoised, 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY, 31, 10
        )
        # Mild sharpening kernel
        kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]], dtype=np.float32)
        processed = cv2.filter2D(binary, -1, kernel)

    # ── 4. Deskew (correct rotation up to ±10 degrees)
    processed = _deskew(processed)

    return Image.fromarray(processed)


def _deskew(gray_np: np.ndarray) -> np.ndarray:
    """Correct small rotation angles using moments."""
    if not _OPENCV_AVAILABLE:
        return gray_np
    try:
        coords = np.column_stack(np.where(gray_np < 128))
        if len(coords) < 100:
            return gray_np
        angle = cv2.minAreaRect(coords)[-1]
        # minAreaRect returns angle in (-90, 0]; normalise
        if angle < -45:
            angle = 90 + angle
        if abs(angle) < 0.5:
            return gray_np  # negligible skew
        (h, w) = gray_np.shape[:2]
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        rotated = cv2.warpAffine(
            gray_np, M, (w, h),
            flags=cv2.INTER_CUBIC,
            borderMode=cv2.BORDER_REPLICATE
        )
        return rotated
    except Exception:
        return gray_np


# ══════════════════════════════════════════════════════════════════════════════
# Tesseract OCR runner
# ══════════════════════════════════════════════════════════════════════════════

def _run_tesseract(pil_image: Image.Image,
                   tessdata_config: str = "",
                   psm: int = 3,
                   page_num: int = 0) -> tuple[list[str], float]:
    """
    Run Tesseract on a preprocessed PIL image.
    Returns (list_of_text_lines, average_confidence).
    Tries psm=3 (auto) first; if average confidence is poor, retries with psm=6.
    """
    config = f"{tessdata_config} --psm {psm} --oem 1"

    try:
        data = pytesseract.image_to_data(
            pil_image,
            config=config,
            output_type=pytesseract.Output.DICT,
        )
    except Exception as e:
        print(f"[OCR] Tesseract error (psm={psm}): {e}")
        return [], 0.0

    words: list[ExtractedWord] = []
    conf_values: list[float] = []

    for i in range(len(data["text"])):
        raw_text = data["text"][i].strip()
        if not raw_text:
            continue
        try:
            conf = int(float(data["conf"][i]))
        except (ValueError, TypeError):
            continue
        if conf < 0:
            continue
        conf_values.append(conf)
        if conf >= _OCR_CONF_THRESHOLD:
            words.append(ExtractedWord(
                text=raw_text,
                x=data["left"][i],
                y=data["top"][i],
                conf=conf,
                page=page_num,
            ))

    avg_conf = float(np.mean(conf_values)) if conf_values else 0.0

    # Retry with psm=6 if confidence is low and we haven't already retried
    if avg_conf < _PAGE_CONF_RETRY_THRESHOLD and psm == 3:
        print(f"[OCR] Low confidence ({avg_conf:.1f}) with psm=3, retrying psm=6")
        return _run_tesseract(pil_image, tessdata_config, psm=6, page_num=page_num)

    # Group words into lines by y-coordinate proximity (±8 px)
    line_map: defaultdict[int, list[ExtractedWord]] = defaultdict(list)
    for w in words:
        bucket = w.y // 8
        line_map[bucket].append(w)

    lines: list[str] = []
    for bucket in sorted(line_map.keys()):
        row = sorted(line_map[bucket], key=lambda w: w.x)
        line_text = " ".join(w.text for w in row).strip()
        if line_text:
            lines.append(line_text)

    return lines, avg_conf


# ══════════════════════════════════════════════════════════════════════════════
# Native PDF text extraction (PyMuPDF)
# ══════════════════════════════════════════════════════════════════════════════

def _extract_native_pdf_text(pdf_bytes: bytes) -> tuple[list[str], bool]:
    """
    Attempt to extract text directly from a PDF using PyMuPDF.
    Returns (lines, is_usable).
    is_usable=True means the native text is sufficient — skip OCR.
    """
    if not _PYMUPDF_AVAILABLE:
        return [], False

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        all_lines: list[str] = []
        total_chars = 0

        for page in doc:
            blocks = page.get_text("blocks")  # [(x0,y0,x1,y1,text,block_no,block_type)]
            page_lines: list[tuple[float, str]] = []
            for block in blocks:
                if block[6] != 0:  # skip non-text blocks (images)
                    continue
                block_text = block[4].strip()
                if not block_text:
                    continue
                total_chars += len(block_text)
                y0 = block[1]
                for raw_line in block_text.split("\n"):
                    clean = raw_line.strip()
                    if clean:
                        page_lines.append((y0, clean))

            # Sort lines by vertical position
            page_lines.sort(key=lambda t: t[0])
            all_lines.extend(line for _, line in page_lines)

        doc.close()
        is_usable = total_chars >= _MIN_NATIVE_TEXT_CHARS
        return all_lines, is_usable

    except Exception as e:
        print(f"[PDF] Native extraction failed: {e}")
        return [], False


def _pdf_to_images(pdf_bytes: bytes) -> list[Image.Image]:
    """Convert PDF pages to PIL images using pdf2image."""
    if not _PDF2IMAGE_AVAILABLE:
        print("[PDF] pdf2image not available — cannot OCR scanned PDF")
        return []
    try:
        return _pdf2image_convert(pdf_bytes, dpi=250)
    except Exception as e:
        print(f"[PDF] pdf2image conversion failed: {e}")
        return []


# ══════════════════════════════════════════════════════════════════════════════
# SPT Report Parser
# ══════════════════════════════════════════════════════════════════════════════

# Patterns for table-style SPT rows:
# "Peanut   6   positive"  or  "Cat Epithelium | 4mm | Pos"
_SPT_ROW_PATTERN = re.compile(
    r"^(.{3,40?}?)\s{2,}(\d{1,2}(?:\.\d)?)\s*(?:mm)?\s{2,}(positive|negative|pos|neg|\+|-)",
    re.IGNORECASE
)
_SPT_INLINE_PATTERN = re.compile(
    r"(.{3,40?}?)\s*[:\-]\s*(?:wheal\s*)?(\d{1,2}(?:\.\d)?)\s*(?:mm)?\s*[,;]?\s*(positive|negative|pos|neg|\+|-)?",
    re.IGNORECASE
)
# Positive / negative words in line
_POS_WORDS = re.compile(r"\b(positive|pos|\+)\b", re.IGNORECASE)
_NEG_WORDS = re.compile(r"\b(negative|neg|-)\b", re.IGNORECASE)

# Patient info patterns
_PATIENT_PATTERNS = {
    "name":          re.compile(r"(?:patient\s+)?name[:\-\s]+([A-Za-z][A-Za-z\s\.\-]{1,50}?)(?:\s{2,}|\t|$)", re.IGNORECASE),
    "date_of_birth": re.compile(r"(?:date\s+of\s+birth|dob|d\.o\.b)[:\-\s]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})", re.IGNORECASE),
    "gender":        re.compile(r"gender[:\-\s]+(male|female|m|f)\b", re.IGNORECASE),
    "patient_id":    re.compile(r"(?:patient\s+id|patient\s+no\.?|id)[:\-\s]+([A-Za-z0-9\-]+)", re.IGNORECASE),
    "test_date":     re.compile(r"(?:date\s+of\s+test|test\s+date|date)[:\-\s]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})", re.IGNORECASE),
    "referring_dr":  re.compile(r"(?:referring\s+(?:doctor|dr\.?|physician))[:\-\s]+([A-Za-z][A-Za-z\s\.\-]{1,50}?)(?:\s{2,}|\t|$)", re.IGNORECASE),
}


def _parse_patient_info(lines: list[str]) -> dict:
    patient: dict = {}
    full_text = "\n".join(lines)

    for field, pattern in _PATIENT_PATTERNS.items():
        m = pattern.search(full_text)
        if m:
            value = m.group(1).strip()
            # Sanity: name should not be a pure number
            if field == "name" and re.match(r"^\d+$", value):
                continue
            patient[field] = value

    return patient


def _infer_result(line: str, wheal: Optional[float]) -> str:
    """
    Determine positive/negative from explicit keywords first,
    then from wheal diameter (>= 3mm positive) as fallback.
    """
    if _POS_WORDS.search(line):
        return "positive"
    if _NEG_WORDS.search(line):
        return "negative"
    if wheal is not None:
        return "positive" if wheal >= 3 else "negative"
    return "unknown"


def _parse_allergens_from_lines(
    lines: list[str],
    avg_conf: float,
    page_num: int = 0,
) -> dict[str, dict]:
    """
    Dynamically extract allergens from SPT report lines.
    Does NOT rely on a hardcoded allergen list — finds any allergen-like row.
    Filters out control allergens.
    Returns {canonical_name: {wheal_diameter, flare_diameter, result, confidence, ...}}
    """
    allergens: dict[str, dict] = {}
    conf_level = _ocr_confidence_level(avg_conf)

    for line in lines:
        stripped = line.strip()
        if len(stripped) < 4:
            continue

        # ── Strategy 1: table-row format (name  number  result) ──────────────
        m = _SPT_ROW_PATTERN.match(stripped)
        if m:
            name_raw = m.group(1).strip()
            wheal_str = m.group(2)
            result_raw = m.group(3).strip()

            if _is_control(name_raw):
                continue

            try:
                wheal = float(wheal_str)
                if not (0 <= wheal <= 25):
                    wheal = None
            except ValueError:
                wheal = None

            result = _infer_result(result_raw, wheal)
            canonical = _canonicalise(name_raw)
            allergens[canonical] = {
                "wheal_diameter": wheal,
                "flare_diameter": None,
                "result": result,
                "confidence": conf_level,
                "ocr_avg_conf": round(avg_conf, 1),
                "source_page": page_num,
            }
            continue

        # ── Strategy 2: inline format "allergen: 6mm positive" ───────────────
        # Only try if line looks like it contains a measurement
        if re.search(r"\b\d{1,2}\s*(?:mm)?\b", stripped):
            m2 = _SPT_INLINE_PATTERN.search(stripped)
            if m2:
                name_raw = m2.group(1).strip()
                wheal_str = m2.group(2)
                result_raw = m2.group(3) or ""

                # Reject if name looks like a number or is too long
                if re.match(r"^\d", name_raw) or len(name_raw) > 50:
                    continue
                if _is_control(name_raw):
                    continue

                try:
                    wheal = float(wheal_str)
                    if not (0 <= wheal <= 25):
                        wheal = None
                except ValueError:
                    wheal = None

                result = _infer_result(stripped, wheal)
                canonical = _canonicalise(name_raw)

                # Avoid overwriting a higher-confidence entry
                if canonical not in allergens:
                    allergens[canonical] = {
                        "wheal_diameter": wheal,
                        "flare_diameter": None,
                        "result": result,
                        "confidence": conf_level,
                        "ocr_avg_conf": round(avg_conf, 1),
                        "source_page": page_num,
                    }
                continue

        # ── Strategy 3: known canonical name appears anywhere in line ─────────
        norm_line = _normalise(stripped)
        for key, canonical in CANONICAL_ALLERGEN_MAP.items():
            if key in norm_line and not _is_control(key):
                wheal = _extract_measurement(stripped)
                result = _infer_result(stripped, wheal)
                if canonical not in allergens:
                    allergens[canonical] = {
                        "wheal_diameter": wheal,
                        "flare_diameter": None,
                        "result": result,
                        "confidence": conf_level if wheal is not None else "LOW",
                        "ocr_avg_conf": round(avg_conf, 1),
                        "source_page": page_num,
                    }
                break  # one match per line

    return allergens


# ══════════════════════════════════════════════════════════════════════════════
# Public OCRService class (interface unchanged)
# ══════════════════════════════════════════════════════════════════════════════

class OCRService:
    """
    Drop-in replacement for the original OCRService.
    Public methods: process(), parse_report()
    """

    def __init__(self, tesseract_cmd: str = None, tessdata_dir_config: str = ""):
        if tesseract_cmd:
            pytesseract.pytesseract.tesseract_cmd = tesseract_cmd
        self.tessdata_dir_config = tessdata_dir_config

    # ── Internal: process one PIL image through preprocess + OCR ──────────────
    def _process_image(
        self,
        pil_image: Image.Image,
        page_num: int = 0,
        strategy: str = "auto",
    ) -> tuple[list[str], float]:
        preprocessed = _preprocess_image(pil_image, strategy=strategy)
        lines, avg_conf = _run_tesseract(
            preprocessed,
            tessdata_config=self.tessdata_dir_config,
            psm=3,
            page_num=page_num,
        )
        # If still low confidence, try aggressive preprocessing and retry
        if avg_conf < _PAGE_CONF_RETRY_THRESHOLD and strategy != "aggressive":
            print(f"[OCR] Page {page_num} avg conf {avg_conf:.1f} — retrying with aggressive preprocessing")
            preprocessed2 = _preprocess_image(pil_image, strategy="aggressive")
            lines2, avg_conf2 = _run_tesseract(
                preprocessed2,
                tessdata_config=self.tessdata_dir_config,
                psm=6,
                page_num=page_num,
            )
            if avg_conf2 > avg_conf:
                return lines2, avg_conf2
        return lines, avg_conf

    # ── Public: process() ─────────────────────────────────────────────────────
    def process(self, file_bytes: bytes, file_name: str = "") -> dict:
        """
        Main entry point.
        Returns {"lines": [...], "data": {...}, "avg_conf": float, "extraction_method": str}
        Preserves original keys so server.py is unaffected.
        """
        fname_lower = (file_name or "").lower()

        # ══════════════════════════════════════════════════════════════════════
        # PDF path
        # ══════════════════════════════════════════════════════════════════════
        if fname_lower.endswith(".pdf"):
            return self._process_pdf(file_bytes)

        # ══════════════════════════════════════════════════════════════════════
        # Image path
        # ══════════════════════════════════════════════════════════════════════
        try:
            pil_image = Image.open(io.BytesIO(file_bytes))
        except Exception as e:
            print(f"[OCR] Cannot open image: {e}")
            return {"lines": [], "data": {}, "avg_conf": 0.0, "extraction_method": "error"}

        lines, avg_conf = self._process_image(pil_image, page_num=0)
        return {
            "lines": lines,
            "data": self.extract_fields(lines),
            "avg_conf": round(avg_conf, 1),
            "extraction_method": "tesseract_image",
        }

    def _process_pdf(self, pdf_bytes: bytes) -> dict:
        """
        1. Try native text extraction (PyMuPDF).
        2. If native text is insufficient, fall back to pdf2image + Tesseract.
        """
        # ── Step 1: native text ────────────────────────────────────────────────
        native_lines, is_usable = _extract_native_pdf_text(pdf_bytes)

        if is_usable:
            print(f"[PDF] Native text extracted ({len(native_lines)} lines) — skipping OCR")
            return {
                "lines": native_lines,
                "data": self.extract_fields(native_lines),
                "avg_conf": 95.0,   # native text is treated as high confidence
                "extraction_method": "pymupdf_native",
            }

        # ── Step 2: scanned PDF → images → OCR ───────────────────────────────
        print("[PDF] Native text insufficient — converting to images for OCR")
        images = _pdf_to_images(pdf_bytes)

        if not images:
            # Last resort: treat file bytes as single image
            try:
                images = [Image.open(io.BytesIO(pdf_bytes))]
            except Exception:
                return {"lines": [], "data": {}, "avg_conf": 0.0, "extraction_method": "error"}

        all_lines: list[str] = []
        all_confs: list[float] = []

        for page_num, img in enumerate(images):
            lines, avg_conf = self._process_image(img, page_num=page_num)
            all_lines.extend(lines)
            all_confs.append(avg_conf)

        overall_conf = float(np.mean(all_confs)) if all_confs else 0.0
        return {
            "lines": all_lines,
            "data": self.extract_fields(all_lines),
            "avg_conf": round(overall_conf, 1),
            "extraction_method": "tesseract_pdf_ocr",
        }

    # ── Public: parse_report() ────────────────────────────────────────────────
    def parse_report(self, result: dict) -> dict:
        """
        Convert raw OCR output to structured SPT report JSON.
        Input:  {"lines": [...], "avg_conf": float, ...}
        Output: {"patient": {...}, "allergies": {name: {wheal, result, ...}}}
        Preserves original output shape so server.py is unaffected.
        """
        lines: list[str] = result.get("lines", [])
        avg_conf: float = float(result.get("avg_conf", 50.0))

        output: dict = {
            "patient": {},
            "allergies": {},
            "extraction_meta": {
                "method": result.get("extraction_method", "unknown"),
                "avg_ocr_confidence": round(avg_conf, 1),
                "overall_confidence": _ocr_confidence_level(avg_conf),
                "total_lines": len(lines),
            },
        }

        # Patient info
        output["patient"] = _parse_patient_info(lines)

        # Allergen table rows — pass avg_conf for confidence labelling
        output["allergies"] = _parse_allergens_from_lines(lines, avg_conf)

        # Strip extraction meta from allergen dicts for backward compat
        # (server.py reads .result and .wheal_diameter directly)
        # Keep the meta fields — they are new additions and server.py ignores unknown keys.

        return output

    # ── Kept for backward compatibility (used nowhere critical but was public) ─
    def extract_fields(self, lines: list[str]) -> dict:
        result: dict = {}
        for line in lines:
            if "name" in line.lower():
                m = re.search(r"name[:\-]?\s*(.*)", line, re.IGNORECASE)
                if m:
                    result["name"] = m.group(1).strip()
            elif "age" in line.lower():
                m = re.search(r"age[:\-]?\s*(\d+)", line, re.IGNORECASE)
                if m:
                    result["age"] = m.group(1)
            elif "result" in line.lower():
                m = re.search(r"(positive|negative)", line, re.IGNORECASE)
                if m:
                    result["result"] = m.group(1).lower()
        return result

    # ── Legacy helpers kept for any external references ────────────────────────
    def read_from_bytes(self, image_bytes: bytes) -> str:
        try:
            image = Image.open(io.BytesIO(image_bytes))
            lines, _ = self._process_image(image)
            return "\n".join(lines)
        except Exception as e:
            print(f"[OCR] read_from_bytes error: {e}")
            return ""

    def read_from_file(self, file_path: str) -> str:
        try:
            image = Image.open(file_path)
            lines, _ = self._process_image(image)
            return "\n".join(lines)
        except Exception as e:
            print(f"[OCR] read_from_file error: {e}")
            return ""

    def preprocess_and_read(self, image_bytes: bytes) -> str:
        return self.read_from_bytes(image_bytes)
