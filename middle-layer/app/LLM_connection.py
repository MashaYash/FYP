from openai import OpenAI

from app.output_formatter import (
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
        Returns a personalised, first-person friendly explanation of the report.
        """
        if isinstance(report_text, dict):
            report_content = format_report_for_display(report_text)
        else:
            report_content = clean_display_text(str(report_text))

        prompt = f"""
You are a senior clinical allergist writing a personalised report summary directly for the person reading it.
Speak directly to them using "you" and "your" at all times. Never say "the patient", "this patient", "she", "he", or "they".
Never mention any name, age, date of birth, gender, or patient ID — these are irrelevant to the summary.

The summary must follow this exact structure. Write each section heading exactly as shown, on its own line:

Your Allergy Overview:
Write 2–3 warm, intelligent sentences explaining what a skin prick test measures, what it means to have a positive result, and briefly summarise the overall picture from this report. Be specific to the actual results — not generic.

POSITIVE ALLERGENS — REQUIRES YOUR ATTENTION:
This is the most critical section. For each positive allergen:
- Start the line with "POSITIVE: [Allergen Name]"
- State the wheal size if available and what it indicates about sensitivity level (e.g. >5mm = moderate-high)
- Explain in plain language what this allergen is and where it is commonly found (foods, environment)
- Mention the most important cross-reactive foods or triggers to be aware of
- Give one specific avoidance tip

If no allergens are confirmed positive, write: "Your results show no confirmed positive allergens in this test panel."

Your Negative Results:
List the allergens that came back negative in one clean sentence. Example: "The following allergens showed no significant immune response: [list]." Do not elaborate on each one.

What Your Results Mean:
2–3 sentences explaining the clinical significance. Mention IgE sensitisation, what a skin prick test can and cannot confirm, and whether a follow-up may be worthwhile. Be intelligent and specific — not vague.

Your Action Steps:
Give exactly 4 numbered, specific, actionable steps. Each step must be directly relevant to this person's actual results. No generic advice. Examples of good specificity:
- "Avoid all foods containing [allergen] including hidden derivatives such as [examples]"
- "A wheal of [X]mm suggests [level] sensitivity — discuss this with an allergist before reintroduction"
- "Carry a non-drowsy antihistamine such as cetirizine when eating out"
- "When buying packaged food, look for 'may contain [allergen]' warnings on the label"

Critical rules:
- Never use the word "unknown" anywhere in the response
- Never say "N/A", "not specified", or "not available" — if data is missing, skip it or handle it intelligently
- Never refer to the reader in third person
- Never mention personal identifiers
- Positive results must be visually prominent — use "POSITIVE: [name]" format exactly
- Write like a real specialist — intelligent, specific, empathetic, not templated

{PLAINTEXT_OUTPUT_RULES}

Report data:
\"\"\"{report_content}\"\"\"
"""

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a senior clinical allergist writing a personalised allergy report summary "
                            "directly for the patient. Always use second person (you/your). "
                            "Never mention name, age, gender, or any personal identifier. "
                            "Never use the word unknown. Never say 'the patient' or 'this patient'. "
                            "Positive allergens must be clearly marked with 'POSITIVE:' prefix. "
                            "Write intelligently and specifically based on the actual data provided."
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.3,
            )

            return clean_display_text(response.choices[0].message.content)

        except Exception as e:
            return clean_display_text("We were unable to generate your summary at this time. Please try again shortly.")

    def get_reply(self, query: str, report=None, enriched_context: str = None,
                  history: list[dict] | None = None):
        """
        Intelligent allergy assistant reply.
        Uses report data + MCP allergen knowledge + optional enriched context from ML/cross-reactive lookup.
        history: list of {"role": "user"|"assistant", "content": str} — last N turns for context.
        """
        try:
            # ── Build rich context block ──────────────────────────────────────
            context_parts = []

            # 1. Uploaded report (structured, personal)
            if report is not None:
                report_text = format_report_for_display(report) if isinstance(report, dict) else clean_display_text(str(report))
                if report_text.strip():
                    context_parts.append(f"== USER'S ALLERGY REPORT ==\n{report_text}")

            # 2. MCP knowledge base lookup — use allergen names extracted from report,
            #    NOT the raw query (queries like "what about dinner?" are not allergen names)
            if self.mcp and report and isinstance(report, dict):
                try:
                    allergies = report.get("allergies", {})
                    allergen_names = [
                        name for name, details in allergies.items()
                        if isinstance(details, dict)
                        and details.get("result", "").lower() == "positive"
                    ]
                    mcp_blocks = []
                    for allergen in allergen_names[:6]:   # cap to avoid bloat
                        mcp_result = self.mcp.get_cross_reactive(allergen)
                        cross_foods = mcp_result.get("cross_reactive_foods", [])
                        notes = mcp_result.get("notes", "")
                        if cross_foods or notes:
                            block = f"Allergen: {mcp_result.get('allergen', allergen)}"
                            if cross_foods:
                                block += f"\n  Cross-reactive foods: {', '.join(cross_foods)}"
                            if notes:
                                block += f"\n  Clinical notes: {notes}"
                            mcp_blocks.append(block)
                    if mcp_blocks:
                        context_parts.append(
                            "== ALLERGEN KNOWLEDGE BASE (from report) ==\n" + "\n\n".join(mcp_blocks)
                        )
                except Exception:
                    pass
            elif self.mcp:
                # No report — try query as allergen name (useful for direct allergen questions)
                try:
                    mcp_result = self.mcp.get_cross_reactive(query)
                    cross_foods = mcp_result.get("cross_reactive_foods", [])
                    notes = mcp_result.get("notes", "")
                    if cross_foods or notes:
                        mcp_block = f"== ALLERGEN KNOWLEDGE BASE ==\nAllergen: {mcp_result.get('allergen', query)}"
                        if cross_foods:
                            mcp_block += f"\nKnown cross-reactive foods: {', '.join(cross_foods)}"
                        if notes:
                            mcp_block += f"\nClinical notes: {notes}"
                        context_parts.append(mcp_block)
                except Exception:
                    pass

            # 3. Optional enriched context (ML predictions, pre-computed analysis)
            if enriched_context and enriched_context.strip():
                context_parts.append(f"== ML CROSS-REACTIVITY PREDICTIONS ==\n{enriched_context}")

            context_block = "\n\n".join(context_parts) if context_parts else ""

            system_prompt = f"""You are an expert clinical allergist and nutritional immunologist with 20 years of experience.
You specialise in IgE-mediated hypersensitivity, oral allergy syndrome, pollen-food syndrome, and cross-reactive allergy networks.

You are speaking DIRECTLY to the patient — use "you" and "your" throughout. Never say "the patient".

Your responses must be:
- Clinically intelligent: use correct allergy terminology (IgE sensitisation, wheal diameter, PR-10 proteins, tropomyosin, Bet v 1, profilins, LTPs, etc.) when relevant
- Specific to the actual query and data provided — never give generic advice unrelated to the question
- Actionable: every response should end with at least one concrete step the person can take
- Honest: if data is insufficient to give a confident answer, say so clearly — never fabricate
- Personal: if a report has been uploaded, weave the actual findings into every answer
- Context-aware: if the conversation history shows previous questions, understand follow-up questions in that context

Scope: Only answer questions about allergies, allergic reactions, cross-reactivity, food safety, allergen avoidance, symptoms, emergency signs, dietary substitutions, or interpreting allergy test results.
If asked anything outside this scope, respond: "I'm specifically designed to help with allergy-related questions. For other topics, please consult a relevant specialist."

{PLAINTEXT_OUTPUT_RULES}

{f"Context available for this response:{chr(10)}{context_block}" if context_block else "No report has been uploaded yet. Answer based on general allergy knowledge."}
"""

            # ── Build messages: system + history (last N turns) + current query ──
            messages: list[dict] = [{"role": "system", "content": system_prompt}]

            # Inject conversation history (last 6 turns = 3 exchanges) for context
            if history:
                for turn in history[-6:]:
                    role = turn.get("role", "user")
                    content = turn.get("content", "")
                    if role in ("user", "assistant") and content.strip():
                        messages.append({"role": role, "content": content})

            messages.append({"role": "user", "content": query})

            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                temperature=0.3,
                max_tokens=800,
            )

            return clean_display_text(response.choices[0].message.content)

        except Exception as e:
            return clean_display_text(f"We could not process your question right now. Please try again shortly.")

    def send_cross_allergen_summary(self, cross_allergens: list):
        """
        Intelligent cross-allergen summary with protein family enrichment,
        risk scoring, and molecular mechanism context.
        Never fabricates — only uses data provided.
        """

        # ── Guard: no data ────────────────────────────────────────────────────
        if not cross_allergens or len(cross_allergens) == 0:
            return (
                "No cross-allergen data is available yet.\n\n"
                "This section analyses cross-reactive foods based on your confirmed positive allergens. "
                "Please upload and analyse your allergy test report first using the Report Analyser. "
                "Once processed, your personalised cross-reactivity map will appear here."
            )

        # ── Guard: all entries empty/nan ──────────────────────────────────────
        real_entries = [
            item for item in cross_allergens
            if item.get("primary") and
            str(item.get("primary", "")).strip().lower() not in ("", "nan", "none", "null") and
            (item.get("cross_reactive") or item.get("risk"))
        ]

        if not real_entries:
            return (
                "Your cross-allergen analysis could not find confirmed allergen data to work with.\n\n"
                "This usually means no clearly readable positive allergen results were extracted from your report. "
                "Try uploading a clearer, higher-resolution image of your report and run the analysis again. "
                "You can also ask the AI Assistant directly about specific allergens you are concerned about."
            )

        # ── Protein family knowledge map ──────────────────────────────────────
        PROTEIN_FAMILIES = {
            "peanut":           ("Vicilin (Ara h 1), Legumin (Ara h 3), PR-10 (Ara h 8), nsLTP (Ara h 9)",
                                 "Legume family — shares storage proteins with soy, lupin, lentils, chickpeas"),
            "egg white":        ("Ovomucoid (Gal d 1), Ovalbumin (Gal d 2)",
                                 "Bird-egg syndrome — poultry meat albumins may cross-react"),
            "egg":              ("Ovomucoid (Gal d 1), Ovalbumin (Gal d 2)",
                                 "Bird-egg syndrome — poultry meat albumins may cross-react"),
            "house dust mite":  ("Tropomyosin (Der p 10), Group 1 (Der p 1), Group 2 (Der p 2)",
                                 "Tropomyosin is heat-stable — cross-reacts with shellfish shrimp crab lobster"),
            "d. pteronyssinus": ("Tropomyosin (Der p 10), Der p 1, Der p 2",
                                 "Tropomyosin cross-reactivity with crustacean shellfish"),
            "cat epithelium":   ("Fel d 1 (uteroglobin), Serum albumin (Fel d 2)",
                                 "Cat-pork syndrome — mammalian serum albumin cross-reactivity with pork beef"),
            "grass pollen":     ("PR-10 proteins, Profilins (Phl p 12), nsLTPs",
                                 "Pollen-food syndrome (oral allergy syndrome) with tomato melon orange peach celery"),
            "birch pollen":     ("Bet v 1 (PR-10), Bet v 2 (Profilin)",
                                 "Major oral allergy syndrome cause — apple cherry hazelnut carrot soy"),
            "latex":            ("Hev b 1, Hev b 3, Hev b 6 (hevein), Hev b 13",
                                 "Latex-fruit syndrome — banana avocado kiwi chestnut papaya"),
            "milk":             ("Casein (Bos d 8), Beta-lactoglobulin (Bos d 5), Alpha-lactalbumin (Bos d 4)",
                                 "Cross-reacts with goat sheep and buffalo milk — not typically with beef"),
            "wheat":            ("Omega-5 gliadin (Tri a 19), nsLTP (Tri a 14), Profilin",
                                 "Exercise-induced anaphylaxis risk; cross-reacts with other grass cereals"),
            "soy":              ("Gly m 4 (PR-10), Gly m 5 (Vicilin), Gly m 6 (Legumin)",
                                 "Birch-pollen related Gly m 4 causes oral allergy syndrome; Gly m 5/6 cause systemic reactions"),
            "fish":             ("Parvalbumin (Gad c 1)",
                                 "Pan-allergen across most bony fish — cod salmon tuna mackerel; usually heat-stable"),
            "shellfish":        ("Tropomyosin",
                                 "Pan-allergen across crustaceans — shrimp crab lobster; heat-stable, cooking does not eliminate risk"),
            "tree nut":         ("2S Albumins, nsLTPs, Vicilins",
                                 "Cross-reactivity within tree nut family and with peanut in some individuals"),
        }

        # ── Build enriched structured data for prompt ─────────────────────────
        risk_order = {"high": 0, "medium": 1, "low": 2, "": 3}
        sorted_entries = sorted(
            real_entries,
            key=lambda x: risk_order.get(str(x.get("risk", "")).lower(), 3)
        )

        data_sections = []
        for item in sorted_entries:
            primary = str(item.get("primary", "")).strip()
            risk    = str(item.get("risk", "")).strip() or "not specified"
            cross   = [f for f in (item.get("cross_reactive") or [])
                       if f and str(f).lower() not in ("nan", "none", "null", "")]
            notes   = str(item.get("notes", "")).strip()
            if notes.lower() in ("nan", "none", "null", ""):
                notes = ""

            # Protein family lookup
            lookup_key = primary.lower()
            protein_info = None
            for key, (proteins, mechanism) in PROTEIN_FAMILIES.items():
                if key in lookup_key or lookup_key in key:
                    protein_info = (
                        f"Key proteins: {proteins}\n"
                        f"Cross-reaction mechanism: {mechanism}"
                    )
                    break

            section = [f"ALLERGEN: {primary} | Risk: {risk}"]
            if cross:
                section.append(f"Cross-reactive foods: {', '.join(cross)}")
            if notes:
                section.append(f"Clinical notes: {notes}")
            if protein_info:
                section.append(protein_info)
            data_sections.append("\n".join(section))

        structured_data  = "\n\n---\n\n".join(data_sections)
        allergen_count   = len(sorted_entries)
        allergen_names   = ", ".join(item.get("primary", "") for item in sorted_entries)

        prompt = f"""
You are a senior clinical allergist and molecular allergology specialist writing a cross-allergen analysis directly for the person reading it.
Always use "you" and "your". Never say "the patient", "he", "she", or "they".
Never mention any name, age, or personal identifier.

You have been given REAL structured data for {allergen_count} allergen(s): {allergen_names}.
Only discuss allergens and cross-reactive foods in the data. Never invent anything not provided.

Write your response with exactly these sections:

Understanding Your Cross-Reactivity:
2-3 sentences explaining cross-reactivity specifically for the actual allergens identified. Reference the protein families or molecular mechanisms involved (e.g. tropomyosin, PR-10, oral allergy syndrome, pollen-food syndrome). Be clinically specific — not generic.

Your Cross-Reactive Allergen Profile:
For each allergen (highest risk first):
- Write exactly: "POSITIVE: [Allergen Name] — [Risk] Risk"
- List the specific cross-reactive foods from the data
- In one sentence, explain the molecular/protein reason these foods are linked
- State whether the reaction risk is heat-stable or heat-labile (important for cooking advice)
- Give one concrete, specific avoidance tip

Foods Requiring Your Attention:
A grouped, specific list of foods to be cautious with — organised by allergen.
Include hidden sources where relevant (e.g. "lupin flour in pasta and bread", "shrimp paste in Thai and Vietnamese sauces", "peanut oil in satay sauces").
Be specific — name real foods, not vague categories.

Your Personalised Action Plan:
Exactly 4 numbered steps. Each step must directly reference the actual allergens or cross-reactive foods from the data.
These are examples of the required quality and specificity:
- "Tropomyosin in [allergen] is heat-stable — avoid [cross-reactive foods] even when cooked"
- "Check labels for [hidden derivative] which is a common hidden source in [food category]"
- "Carry a non-drowsy antihistamine (cetirizine 10mg) for mild oral symptoms when eating fresh [fruit/vegetable]"
- "Request component-resolved diagnostics (CRD) from your allergist to identify whether your [allergen] reactivity involves nsLTP or PR-10 proteins — this determines your true systemic risk"

Rules:
- Never use "unknown"
- Never fabricate allergens or cross-reactive foods
- Use "POSITIVE: [Name]" format exactly for each allergen heading
- Reference protein science (IgE, nsLTP, tropomyosin, oral allergy syndrome) where the data supports it
- Be empowering and specific — clinical intelligence, not generic reassurance

{PLAINTEXT_OUTPUT_RULES}

Allergen data ({allergen_count} allergen(s)):
\"\"\"{structured_data}\"\"\"
"""

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a senior clinical allergist and molecular allergology specialist. "
                            "Write directly to the patient (you/your). "
                            "Use correct allergy science: IgE sensitisation, PR-10, tropomyosin, profilins, nsLTP, "
                            "oral allergy syndrome, pollen-food syndrome, heat-stable vs heat-labile allergens. "
                            "Never fabricate data. Never say 'unknown'. Never use third person for the patient. "
                            "Always use 'POSITIVE: [name]' prefix for each allergen heading."
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.3,
                max_tokens=1000,
            )

            return clean_display_text(response.choices[0].message.content)

        except Exception as e:
            return clean_display_text("We were unable to generate your cross-allergen summary right now. Please try again shortly.")
