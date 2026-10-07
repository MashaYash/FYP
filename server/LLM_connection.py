from openai import OpenAI

from output_formatter import (
    PLAINTEXT_OUTPUT_RULES,
    clean_display_text,
    format_report_for_display,
)


class gpt_connection:
    def __init__(self, api_key: str, mcp_server=None):
        self.client = OpenAI(api_key=api_key)
        self.mcp = mcp_server

    def send_initial_report_for_summary(self, report_text):
        """
        Returns a simple, human-friendly explanation of the report
        """
        if isinstance(report_text, dict):
            report_content = format_report_for_display(report_text)
        else:
            report_content = clean_display_text(str(report_text))

        prompt = f"""
You are explaining a medical allergy test report to a person with no medical background.

Write a clear, organized summary with these sections:
About this report:
Positive allergens:
Negative allergens:
What this means:
Everyday advice:

Content to cover:
- Who the report is about (name, age if available)
- What the test checked
- Which allergies are positive (most important)
- Which are negative
- What the results mean in simple terms
- General non-medical advice (avoid triggers, consult a doctor when unsure)

{PLAINTEXT_OUTPUT_RULES}

Report:
\"\"\"{report_content}\"\"\"
"""

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You explain medical reports in simple, calm, website-friendly language. "
                            "Never use markdown or asterisks."
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.5,
            )

            return clean_display_text(response.choices[0].message.content)

        except Exception as e:
            return clean_display_text(f"Sorry, we could not generate a summary right now. {e}")

    def get_reply(self, query: str, report=None):
        try:
            system_prompt = f"""
You are an allergy-focused assistant for a health website.

You MUST follow these rules:
- Only answer questions related to allergies, allergic reactions, cross-reactivity, symptoms, food triggers, or general allergy care.
- You may also explain medical allergy reports provided in context.
- If the user asks anything unrelated (coding, general knowledge, math, politics, etc.), respond ONLY with:
"I can only help with allergy-related questions."
- Do NOT answer outside this scope under any circumstances.

{PLAINTEXT_OUTPUT_RULES}
"""

            mcp_data = None
            if self.mcp:
                mcp_data = self.mcp.get_cross_reactive(query)

            user_content = f"User question: {query}\n"

            if report is not None:
                if isinstance(report, dict):
                    user_content += f"\nMedical Report:\n{format_report_for_display(report)}\n"
                else:
                    user_content += f"\nMedical Report:\n{report}\n"

            if mcp_data:
                user_content += f"\nAllergy Knowledge Base:\n{mcp_data}\n"

            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content},
                ],
                temperature=0.5,
            )

            return clean_display_text(response.choices[0].message.content)

        except Exception as e:
            return clean_display_text(f"Sorry, something went wrong while preparing your answer. {e}")

    def send_cross_allergen_summary(self, cross_allergens: list):
        """
        Returns a simple, human-friendly explanation of cross-allergen results
        """

        prompt = f"""
You are explaining cross-allergen results from an allergy test to a person with no medical background.

Organize your answer with these sections:
What cross-reactivity means:
Your main findings:
Foods to be careful with:
Safe next steps:

Your job:
- Explain the results in very simple language
- Group similar ideas together if needed
- Clearly mention higher-risk items first
- Explain what cross-reactive foods means in plain language
- End with calm, practical advice

Rules:
- Use simple language (like explaining to a teenager)
- Keep it concise and easy to read on a website
- Do NOT sound scary or alarming
- Do NOT give medical treatment advice
- Be calm and reassuring

{PLAINTEXT_OUTPUT_RULES}

Data:
\"\"\"{cross_allergens}\"\"\"
"""

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You explain allergy cross-reactivity in simple, patient-friendly website language. "
                            "Never use markdown or asterisks."
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.5,
            )

            return clean_display_text(response.choices[0].message.content)

        except Exception as e:
            return clean_display_text(f"Sorry, we could not generate a cross-allergy summary right now. {e}")
