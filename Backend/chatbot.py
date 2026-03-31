import os
import json
import re
import requests
from dotenv import load_dotenv
from utils import load_schemes
from eligibility import check_eligibility

load_dotenv()

# ─────────────────────────────────────────
# SARVAM CONFIG
# ─────────────────────────────────────────
SARVAM_API_KEY = os.getenv("SARVAM_API_KEY", "")
SARVAM_MODEL   = os.getenv("SARVAM_MODEL", "sarvam-m")
SARVAM_URL     = "https://api.sarvam.ai/v1/chat/completions"

HEADERS = {
    "Authorization": f"Bearer {SARVAM_API_KEY}",
    "Content-Type": "application/json",
}

# ─────────────────────────────────────────
# CALL SARVAM
# ─────────────────────────────────────────
def call_sarvam(system_prompt: str, user_message: str, history: list = []) -> str:
    messages = [{"role": "system", "content": system_prompt}]
    for turn in history[-6:]:
        messages.append(turn)
    messages.append({"role": "user", "content": user_message})

    payload = {
        "model": SARVAM_MODEL,
        "messages": messages,
        "temperature": 0.3,
        "max_tokens": 512,
    }

    try:
        resp = requests.post(SARVAM_URL, headers=HEADERS, json=payload, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"].strip()
    except Exception as e:
        print(f"[Sarvam API Error] {e}")
        return ""

# ─────────────────────────────────────────
# LANGUAGE DETECTION (ROBUST)
# ─────────────────────────────────────────
def detect_language(text: str) -> str:
    # 1. Devanagari Unicode script detection (actual Hindi/Marathi text)
    if re.search(r'[\u0900-\u097F]', text):
        mr_words = ["आहे", "माझा", "माझी", "मला", "शेतकरी", "महाराष्ट्र", "मी"]
        if any(w in text for w in mr_words):
            return "mr"
        return "hi"

    text_lower = text.lower()

    # 2. Minglish (Marathi written in English)
    mr_indicators = ["mi ", "aahe", "mala ", "shetkari", "mhanje", "amhi", "mazha",
                     "tyala", "kasa ", "kashi ", "kuthe", "kay aahe", "majhi"]
    if any(w in text_lower for w in mr_indicators):
        return "mr"

    # 3. Hinglish (Hindi written in English)
    hi_indicators = ["mai ", "mujhe", "mera ", "meri ", " hai ", " hain", "kisan",
                     "mere ", "humara", " hum ", " bhi ", "nahi ", "chahiye",
                     "achha", "theek", "karega", "karegi", "kya ", "kitna"]
    if any(w in text_lower for w in hi_indicators):
        return "hi"

    return "en"

# ─────────────────────────────────────────
# TRANSLATION
# ─────────────────────────────────────────
TRANSLATE_PROMPT = "Translate the following text to English. Return ONLY the translated text, no explanations."

def translate_to_english(text: str) -> str:
    result = call_sarvam(TRANSLATE_PROMPT, text)
    return result if result else text

# ─────────────────────────────────────────
# PROFILE EXTRACTION
# ─────────────────────────────────────────
EXTRACTION_SYSTEM = """You are a profile extractor. Extract user profile from the input and return ONLY valid JSON:
{
  "age": null,
  "gender": null,
  "occupation": [],
  "annualIncome": null,
  "state": "",
  "keywords": []
}

Rules:
- occupation: list like ["farmer", "student", "laborer", "business", "disabled"]
- gender: "male" or "female" or null
- annualIncome: number in INR or null
- state: lowercase state name or ""
- keywords: topics like ["scholarship", "health", "loan", "pension", "housing", "food", "skill", "agriculture"]
Return ONLY the JSON object, no extra text."""

def extract_user_profile_sarvam(user_input: str, history: list) -> dict:
    raw = call_sarvam(EXTRACTION_SYSTEM, user_input, history)
    try:
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if match:
            return json.loads(match.group())
    except:
        pass
    return extract_user_details_fallback(user_input)

# ─────────────────────────────────────────
# FALLBACK EXTRACTION
# ─────────────────────────────────────────
def extract_user_details_fallback(text: str) -> dict:
    text_lower = text.lower()
    user = {
        "age": None,
        "gender": None,
        "annualIncome": None,
        "occupation": [],
        "state": "",
        "keywords": []
    }

    if any(w in text_lower for w in ["farmer", "kisan", "shetkari", "krishi"]):
        user["occupation"].append("farmer")
    if any(w in text_lower for w in ["student", "vidyarthi", "school", "college"]):
        user["occupation"].append("student")
    if any(w in text_lower for w in ["business", "vyapar", "udyog"]):
        user["occupation"].append("business")

    if any(w in text_lower for w in ["female", "woman", "mahila", "stri", "beti"]):
        user["gender"] = "female"
    elif any(w in text_lower for w in ["male", "man", "purush"]):
        user["gender"] = "male"

    states = {
        "maharashtra": "maharashtra", "delhi": "delhi", "gujarat": "gujarat",
        "rajasthan": "rajasthan", "bihar": "bihar", "punjab": "punjab",
        "uttar pradesh": "uttar pradesh", " up ": "uttar pradesh",
        "madhya pradesh": "madhya pradesh", "karnataka": "karnataka",
        "tamilnadu": "tamilnadu", "tamil nadu": "tamilnadu",
        "andhra": "andhra pradesh", "kerala": "kerala", "odisha": "odisha"
    }
    for key, val in states.items():
        if key in text_lower:
            user["state"] = val
            break

    # Income: "1 lakh", "2.5 lakh", or plain number
    lakh_match = re.search(r'([\d.]+)\s*lakh', text_lower)
    if lakh_match:
        user["annualIncome"] = int(float(lakh_match.group(1)) * 100000)
    else:
        income_match = re.search(r'\b(\d{4,7})\b', text_lower)
        if income_match:
            user["annualIncome"] = int(income_match.group(1))

    # Keywords
    kw_map = {
        "scholarship": ["scholarship", "padhai", "education", "shiksha"],
        "health": ["health", "hospital", "swasthya", "bimari", "arogya"],
        "loan": ["loan", "rin", "karz", "karja"],
        "pension": ["pension", "retirement", "vriddha", "nivrutti"],
        "housing": ["housing", "house", "ghar", "awas", "vasahat"],
        "food": ["food", "ration", "anaj", "khana", "anna"],
        "skill": ["skill", "training", "prashikshan", "kaushal"],
        "agriculture": ["agriculture", "farming", "crop", "kisan", "shetkari"],
    }
    for kw, terms in kw_map.items():
        if any(t in text_lower for t in terms):
            user["keywords"].append(kw)

    return user

# ─────────────────────────────────────────
# MULTILINGUAL FORMATTER (FIXED)
# ─────────────────────────────────────────
def format_scheme_cards_multilang(schemes, lang="en"):

    cards = []

    for s in schemes:

        # --- SAFE ACCESS FOR ALL FIELDS ---

        name_field = s.get("scheme_name", {})
        benefits_field = s.get("benefits", {})
        docs_field = s.get("documents_required", {})
        application_field = s.get("application", {})

        # handle nested safely
        if isinstance(benefits_field, dict):
            benefit_field = benefits_field.get("summary", {})
        else:
            benefit_field = benefits_field

        if isinstance(application_field, dict):
            steps_field = application_field.get("steps", {})
            apply_url = application_field.get("apply_url")
        else:
            steps_field = {}
            apply_url = None

        # --- HANDLE DICT / STRING ---
        name = name_field.get(lang) if isinstance(name_field, dict) else name_field
        benefit = benefit_field.get(lang) if isinstance(benefit_field, dict) else benefit_field
        documents = docs_field.get(lang) if isinstance(docs_field, dict) else docs_field
        steps = steps_field.get(lang) if isinstance(steps_field, dict) else steps_field

        cards.append({
            "name": name or "",
            "benefit": benefit or "",
            "apply": apply_url,
            "documents": documents or [],
            "steps": steps or []
        })

    return cards
# ─────────────────────────────────────────
# MATCHING ENGINE
# ─────────────────────────────────────────
def get_str(field) -> str:
    """Safely get string value from a plain string or multilingual dict."""
    if isinstance(field, dict):
        return field.get("en") or next(iter(field.values()), "") or ""
    return str(field) if field else ""

def match_schemes(user_data: dict, schemes_data: dict) -> list:
    scored = []
    keywords = user_data.get("keywords", [])

    for s in schemes_data["schemes"]:
        score = 0
        eligibility = s.get("eligibility", {})

        # 1. Occupation
        scheme_occs = [o.lower() for o in eligibility.get("occupation", [])]
        user_occs   = user_data.get("occupation", [])
        if scheme_occs and user_occs:
            if not any(u in s_o or s_o in u for u in user_occs for s_o in scheme_occs):
                continue
            score += 5
        elif user_occs and not scheme_occs:
            score += 1

        # 2. Gender
        elig_gender = eligibility.get("gender", "any").lower()
        user_gender = user_data.get("gender")
        if user_gender:
            if elig_gender not in ("any", "all") and elig_gender != user_gender:
                continue
            if elig_gender == user_gender:
                score += 5

        # 3. State
        user_state   = str(user_data.get("state") or "").lower().strip()
        scheme_state = str(s.get("applicable_state") or "").lower().strip()
        if user_state:
            if scheme_state != "all" and scheme_state != user_state:
                continue
            score += (3 if scheme_state == user_state else 1)

        # 4. Income limit
        income_limit = eligibility.get("annual_income_limit")
        user_income  = user_data.get("annualIncome")
        if income_limit and user_income and user_income > income_limit:
            continue

        # 5. Keyword / category boost
        cat  = get_str(s.get("category", "")).lower()
        tags = " ".join(s.get("tags") or []).lower()
        kw_map = {
            "scholarship": ["education", "scholarship"],
            "education":   ["education", "scholarship"],
            "loan":        ["business", "loan"],
            "business":    ["business", "loan"],
            "pension":     ["pension"],
            "farmer":      ["agriculture", "farmer"],
            "agriculture": ["agriculture", "farmer"],
            "health":      ["health", "hospital", "insurance"],
            "hospital":    ["health", "hospital"],
            "insurance":   ["insurance", "health"],
            "housing":     ["housing"],
            "food":        ["food"],
            "ration":      ["food"],
            "skill":       ["skill"],
        }
        for kw in keywords:
            for t in kw_map.get(kw, []):
                if t in cat or t in tags:
                    score += 4

        if score > 0:
            scored.append((score, s))

    scored.sort(reverse=True, key=lambda x: x[0])
    has_specifics = bool(
        user_data.get("occupation") or user_data.get("gender") or
        user_data.get("state") or keywords
    )
    if has_specifics:
        return [s for sc, s in scored if sc >= 3][:5]
    return [s for _, s in scored[:5]]

# ─────────────────────────────────────────
# RESPONSE GENERATION
# ─────────────────────────────────────────
RESPONSE_SYSTEM = """You are SchemeSaathi — an intelligent government scheme assistant for India.

Your job is to generate a SHORT (2-3 sentences), warm, helpful response about the schemes found.

────────────────────────────
🌍 STRICT LANGUAGE RULES
────────────────────────────

- If user input is in English → respond in English
- If input is Hinglish (Hindi written in English like "mai kisan hu") → respond in PURE Hindi (Devanagari script only)
- If input is Minglish (Marathi written in English like "mi shetkari aahe") → respond in PURE Marathi (Devanagari script only)
- If input is already in Hindi (Devanagari) → respond in Hindi
- If input is already in Marathi (Devanagari) → respond in Marathi

STRICT RULES:
- DO NOT mix languages in your response
- DO NOT use Hinglish in output — always convert to pure Hindi Devanagari
- DO NOT use Minglish in output — always convert to pure Marathi Devanagari
- Keep response SHORT (2-3 sentences max)
- Be encouraging and friendly
- Mention how many schemes were found using the actual number
- DO NOT include any internal thoughts, reasoning, or explanations in your output. Greet and reply IMMEDIATELY.
- MANDATORY: You must prefix your final response with exactly "FINAL_ANSWER: ". Everything before this prefix will be ignored.

────────────────────────────
📋 EXAMPLES
────────────────────────────

English (N=3): "FINAL_ANSWER: Great! I found 3 schemes that match your profile. Check out the cards below for details on benefits and how to apply."

Hindi output when user writes Hinglish (N=3): "FINAL_ANSWER: बढ़िया! आपकी प्रोफ़ाइल के लिए 3 योजनाएँ मिली हैं। नीचे दिए गए कार्ड में लाभ और आवेदन की जानकारी देखें।"

Marathi output when user writes Minglish (N=3): "FINAL_ANSWER: छान! तुमच्या प्रोफाइलसाठी 3 योजना सापडल्या. खालील कार्डमध्ये फायदे आणि अर्ज कसा करायचा ते पाहा."

If 0 schemes found:
- English: "FINAL_ANSWER: I couldn't find schemes matching your profile. Try providing more details like your occupation, income, or state."
- Hindi: "FINAL_ANSWER: आपकी प्रोफ़ाइल से मेल खाती कोई योजना नहीं मिली। कृपया अपना व्यवसाय, आय या राज्य बताएं।"
- Marathi: "FINAL_ANSWER: तुमच्या प्रोफाइलशी जुळणारी कोणतीही योजना आढळली नाही. कृपया तुमचा व्यवसाय, उत्पन्न किंवा राज्य सांगा."
"""

def generate_response_text(user_input: str, history: list, scheme_count: int, user_lang: str = "en") -> str:

    prompt = f"""User input: "{user_input}"
Detected language code: {user_lang}
Number of schemes found: {scheme_count}

Generate a short friendly response (2-3 sentences) strictly following language rules above.
Use the actual number {scheme_count} in your response."""

    text = call_sarvam(RESPONSE_SYSTEM, prompt, history)

    # Extract clean response using FINAL_ANSWER: keyword
    if "FINAL_ANSWER:" in text:
        text = text.split("FINAL_ANSWER:")[-1].strip()
    elif "FINAL_ANSWER" in text:
        text = text.split("FINAL_ANSWER")[-1].strip()
    else:
        # Fallback: remove common prefixes just in case
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        if lines:
            text = lines[-1] 
            
        # Extra aggressive cleanup for standard CoT leak phrases
        text = re.sub(r'^(Okay|Alright|Let me|I will|Sure).*?(\.|!)\s+', '', text, flags=re.IGNORECASE).strip()
        text = re.sub(r'^tags without any extra text\.\s*', '', text, flags=re.IGNORECASE).strip()

    if not text:
        # Hardcoded fallback by language
        if user_lang == "hi":
            return f"आपकी प्रोफ़ाइल के लिए {scheme_count} योजनाएँ मिली हैं। नीचे देखें।" if scheme_count else "कोई योजना नहीं मिली। अधिक जानकारी दें।"
        elif user_lang == "mr":
            return f"तुमच्यासाठी {scheme_count} योजना सापडल्या. खाली पाहा." if scheme_count else "कोणतीही योजना आढळली नाही. अधिक माहिती द्या."
        else:
            return f"Found {scheme_count} schemes for you! Check the cards below." if scheme_count else "No schemes found. Try adding more details."

    return text

# ─────────────────────────────────────────
# MAIN FUNCTION (FIXED)
# ─────────────────────────────────────────
def process_query(user_input: str, history: list = []) -> dict:

    text_lower = user_input.lower().strip()
    schemes_data = load_schemes()

    # Greeting
    if text_lower in ["hi", "hello", "hey", "namaste", "namaskar"]:
        return {
            "text": "Hello 👋 I'm SchemeSaathi! Tell me about yourself — your occupation, annual income, gender, and state — and I'll find the best government schemes for you.",
            "schemes": []
        }

    # Detect language
    user_lang = detect_language(user_input)

    # Direct scheme name search — scheme_name may be a plain string OR a multilingual dict
    matched_direct = []

    for s in schemes_data["schemes"]:
        name_field = s.get("scheme_name", "")
        short_field = s.get("short_name", "")

        # collect all name variants to search against
        if isinstance(name_field, dict):
            name_variants = [v.lower() for v in name_field.values() if v]
        else:
            name_variants = [str(name_field).lower()]

        if isinstance(short_field, dict):
            name_variants += [v.lower() for v in short_field.values() if v]
        else:
            name_variants.append(str(short_field).lower())

        if any(n and n in text_lower for n in name_variants):
            matched_direct.append(s)

    if matched_direct:
        direct_text = {
            "en": "Here is the scheme you asked about:",
            "hi": "यह रही वह योजना जो आपने पूछी:",
            "mr": "तुम्ही विचारलेली योजना येथे आहे:"
        }.get(user_lang, "Here is the scheme you asked about:")
        return {
            "text": direct_text,
            "schemes": format_scheme_cards_multilang(matched_direct, user_lang),
            "lang": user_lang
        }

    # Translate
    english_input = user_input if user_lang == "en" else translate_to_english(user_input)

    # Extract
    user_data = extract_user_profile_sarvam(english_input, history)

    # Match
    schemes = match_schemes(user_data, schemes_data)

    # Response — pass user_lang so Sarvam responds in the right language
    response_text = generate_response_text(user_input, history, len(schemes), user_lang)

    return {
        "text": response_text,
        "schemes": format_scheme_cards_multilang(schemes, user_lang),
        "lang": user_lang
    }