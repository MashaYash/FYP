import pytesseract
from PIL import Image
import io
import re
from collections import defaultdict

class OCRService:
    def __init__(self, tesseract_cmd: str = None, tessdata_dir_config: str = ""):
        """
        Optionally pass tesseract executable path (needed on Windows)
        """
        if tesseract_cmd:
            pytesseract.pytesseract.tesseract_cmd = tesseract_cmd
        
        self.tessdata_dir_config = tessdata_dir_config

    def read_from_bytes(self, image_bytes: bytes) -> str:
        """
        Convert raw bytes → image → text
        """
        try:
            image = Image.open(io.BytesIO(image_bytes))
            text = pytesseract.image_to_string(
                image,
                config=f"{self.tessdata_dir_config} --psm 6"
                )
            return text.strip()
        except Exception as e:
            print(f"OCR error: {e}")
            return ""

    def read_from_file(self, file_path: str) -> str:
        """
        Read image from file path
        """
        try:
            image = Image.open(file_path)
            text = pytesseract.image_to_string(image)
            return text.strip()
        except Exception as e:
            print(f"OCR error: {e}")
            return ""

    def preprocess_and_read(self, image_bytes: bytes) -> str:
        """
        Optional preprocessing for better accuracy
        """
        try:
            image = Image.open(io.BytesIO(image_bytes)).convert("L")  # grayscale
            text = pytesseract.image_to_string(image)
            return text.strip()
        except Exception as e:
            print(f"OCR error: {e}")
            return ""
        


    def parse_report(self,result):
        lines = result["lines"]

        output = {
            "patient": {},
            "allergies": {}
        }

        allergies = [
            "Negative Control (Saline)",
            "Positive Control (Histamine)",
            "House Dust Mite (D. pteronyssinus)",
            "Cat Epithelium",
            "Grass Pollen Mix",
            "Egg White",
            "Peanut"
        ]

        # Normalize helper
        def normalize(text):
            return text.lower().replace(" ", "").replace(".", "").replace(",", "")

        normalized_allergies = {normalize(a): a for a in allergies}

        # -------------------------
        # 1. Patient info
        # -------------------------
        for line in lines:
            l = line.lower()

            if "patient name" in l:
                name_match = re.search(r"patient name[:\-]?\s*(.*?)\s*date of birth", line, re.IGNORECASE)
                dob_match = re.search(r"date of birth[:\-]?\s*([0-9/]+)", line, re.IGNORECASE)

                if name_match:
                    output["patient"]["name"] = name_match.group(1).strip()

                if dob_match:
                    output["patient"]["date_of_birth"] = dob_match.group(1)

            if "gender" in l:
                match = re.search(r"gender[:\-]?\s*(\w+)", line, re.IGNORECASE)
                if match:
                    output["patient"]["gender"] = match.group(1)

            if "patient id" in l:
                match = re.search(r"patient id[:\-]?\s*(\S+)", line, re.IGNORECASE)
                if match:
                    output["patient"]["patient_id"] = match.group(1)

            if "date of test" in l:
                match = re.search(r"date of test[:\-]?\s*(.*)", line, re.IGNORECASE)
                if match:
                    output["patient"]["test_date"] = match.group(1).strip()

        # -------------------------
        # 2. Allergy extraction
        # -------------------------
        for line in lines:
            norm_line = normalize(line)

            for key in normalized_allergies:
                if key in norm_line:
                    original_name = normalized_allergies[key]

                    # Extract number (wheal diameter)
                    number_match = re.search(r"\b(\d+)\b", line)

                    # Extract result
                    if "positive" in line.lower():
                        result_value = "positive"
                    elif "negative" in line.lower():
                        result_value = "negative"
                    else:
                        result_value = "unknown"

                    output["allergies"][original_name] = {
                        "wheal_diameter": int(number_match.group(1)) if number_match else None,
                        "result": result_value
                    }

        return output
    
    def process(self, image_bytes: bytes):
        # Step 1: Load image
        image = Image.open(io.BytesIO(image_bytes)).convert("L")

        # Step 2: OCR structured output
        data = pytesseract.image_to_data(
            image,
            config=self.tessdata_dir_config,
            output_type=pytesseract.Output.DICT
        )

        # Step 3: Filter valid words
        words = []
        for i in range(len(data["text"])):
            text = data["text"][i].strip()
            conf = int(data["conf"][i])

            if text and conf > 50:  # filter noise
                words.append({
                    "text": text,
                    "x": data["left"][i],
                    "y": data["top"][i]
                })

        # Step 4: Group into lines
        lines = defaultdict(list)

        for word in words:
            # Group by Y (tolerance helps merge nearby words)
            line_key = word["y"] // 10
            lines[line_key].append(word)

        # Step 5: Sort words in each line (left → right)
        structured_lines = []
        for key in sorted(lines.keys()):
            sorted_words = sorted(lines[key], key=lambda w: w["x"])
            line_text = " ".join(w["text"] for w in sorted_words)
            structured_lines.append(line_text)

        # Step 6: Extract structured data
        result = self.extract_fields(structured_lines)

        return {
            "lines": structured_lines,
            "data": result
        }

    def extract_fields(self, lines):
        result = {}

        for line in lines:
            # Example rules (customize for your reports)

            if "name" in line.lower():
                match = re.search(r"name[:\-]?\s*(.*)", line, re.IGNORECASE)
                if match:
                    result["name"] = match.group(1)

            elif "age" in line.lower():
                match = re.search(r"age[:\-]?\s*(\d+)", line, re.IGNORECASE)
                if match:
                    result["age"] = match.group(1)

            elif "result" in line.lower():
                match = re.search(r"(positive|negative)", line, re.IGNORECASE)
                if match:
                    result["result"] = match.group(1).lower()

        return result

        