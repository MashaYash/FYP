from openai import OpenAI


class gpt_connection:
    def __init__(self, api_key: str,mcp_server=None):
        self.client = OpenAI(api_key=api_key)
        self.mcp = mcp_server

    def send_initial_report_for_summary(self, report_text: str):
        """
        Returns a simple, human-friendly explanation of the report
        """

        prompt = f"""
You are explaining a medical allergy test report to a person with no medical background.

Write a clear and simple summary that includes:
- Who the report is about (name, age if available)
- What the test is (briefly)
- Which allergies are POSITIVE (very important)
- Which are NEGATIVE (less emphasis)
- What it means in simple terms
- Any general advice (non-medical, like "avoid exposure", "consult doctor")

Rules:
- Use simple language (like explaining to a 15-year-old)
- Avoid medical jargon
- Keep it short (5–8 sentences max)
- Use bullet points if helpful
- Be calm and not alarming

Report:
\"\"\"{report_text}\"\"\"
"""

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You explain medical reports in simple language."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.5
            )

            return response.choices[0].message.content

        except Exception as e:
            return f"Error: {str(e)}"
        
    def get_reply(self, query: str, report=None):

        print("report:", report)

        try:

            system_prompt = """
    You are an allergy-focused assistant.

    You MUST follow these rules:
    - Only answer questions related to allergies, allergic reactions, cross-reactivity, symptoms, food triggers, or general allergy care.
    - You may also explain medical allergy reports provided in context.
    - If the user asks anything unrelated (coding, general knowledge, math, politics, etc.), respond ONLY with:
    "I can only help with allergy-related questions."

    - Do NOT answer outside this scope under any circumstances.
    """

  
            # allowed_keywords = [
            #     "allergy", "allergic", "reaction", "histamine",
            #     "food", "cross", "dust", "mite", "pollen",
            #     "rash", "itch"    , "symptom", "anaphylaxis",
            #     "intolerance", "trigger", "immune"
            # ]

            # is_allowed = any(word in query.lower() for word in allowed_keywords)

            # if not is_allowed:
            #     return "I can only help with allergy-related questions."

            # 👇 MCP TOOL CALL
            mcp_data = None
            if self.mcp:
                mcp_data = self.mcp.get_cross_reactive(query)

            user_content = f"User question: {query}\n"

            if report is not None:
                user_content += f"\nMedical Report:\n{report}\n"

            if mcp_data:
                user_content += f"\nAllergy Knowledge Base:\n{mcp_data}\n"

            print(user_content)

            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content}
                ],
                temperature=0.5
            )

            return response.choices[0].message.content

        except Exception as e:
            return f"Error: {str(e)}"
        
    def send_cross_allergen_summary(self, cross_allergens: list):
        """
        Returns a simple, human-friendly explanation of cross-allergen results
        """

        prompt = f"""
    You are explaining cross-allergen results from an allergy test to a person with no medical background.

    Each item shows:
    - A primary allergen (what the person is allergic to)
    - Foods that may cause a reaction due to cross-reactivity
    - A risk level (Low / Medium / High)

    Your job:
    - Explain the results in very simple language
    - Group similar ideas together if needed
    - Clearly highlight HIGH risk items first
    - Mention which foods should be avoided in simple terms
    - Explain what "cross-reactive foods" means in plain language
    - End with general safe advice (e.g., avoid trigger foods, consult a doctor if unsure)

    Rules:
    - Use simple language (like explaining to a teenager)
    - Keep it 5–8 short sentences OR bullet points
    - Do NOT sound scary or alarming
    - Do NOT give medical treatment advice
    - Be calm and reassuring

    Data:
    \"\"\"{cross_allergens}\"\"\"
    """

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You explain allergy cross-reactivity in simple, patient-friendly language."
                    },
                    {"role": "user", "content": prompt}
                ],
                temperature=0.5
            )

            return response.choices[0].message.content

        except Exception as e:
            return f"Error: {str(e)}"

