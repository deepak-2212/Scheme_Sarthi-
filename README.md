# 🚀 SchemeSaathi — AI-Powered Government Scheme Assistant

## 📌 Overview

**SchemeSaathi** is an intelligent AI-based assistant that helps users discover relevant government schemes in India using natural language.

Unlike traditional search systems, SchemeSaathi understands user queries in **English, Hindi, Marathi, Hinglish, and Minglish**, extracts user information, and provides **personalized scheme recommendations**.

---

## 🎯 Problem Statement

* Government schemes are scattered and hard to understand
* Language barrier for rural users
* Complex eligibility criteria
* Users don’t know which schemes they qualify for

---

## 💡 Solution

SchemeSaathi solves this by:

* Accepting natural language input (e.g., *"mai kisan hu"*)
* Understanding user profile automatically
* Matching eligible schemes
* Responding in the user’s language

---

## 🌍 Multilingual Intelligence

| Input Type | Output  |
| ---------- | ------- |
| English    | English |
| Hinglish   | Hindi   |
| Minglish   | Marathi |
| Hindi      | Hindi   |
| Marathi    | Marathi |

---

## 🧠 Core Features

* 🌐 Multilingual Support (Hindi, Marathi, Hinglish, Minglish)
* 🧠 AI-based User Profile Extraction
* 🎯 Smart Scheme Matching Engine
* ⚡ Real-time Responses
* 📋 Clean Scheme Cards (Benefits, Documents, Apply Link)
* 🔄 Fallback system (rule-based extraction)

---

## 🏗️ Architecture

```
Frontend (HTML, CSS, JS)
        ↓
Backend API (FastAPI)
        ↓
AI Processing (Sarvam AI)
        ↓
Eligibility Engine (Python Logic)
        ↓
Response + Scheme Cards
```

---

## ⚙️ Tech Stack

* **Frontend:** HTML, CSS, JavaScript
* **Backend:** FastAPI (Python)
* **AI Model:** Sarvam AI

---

## 🧠 AI Prompt Logic

The system uses a structured AI prompt:

### Responsibilities:

1. Understand multilingual user input
2. Extract user profile (income, occupation, state, etc.)
3. Identify intent
4. Generate short response
5. Respond in correct language

### Language Rules:

* Hinglish → Hindi
* Minglish → Marathi
* No mixed language output

---

## 📊 Workflow

1. User sends query
2. Language detected
3. Input processed (translated internally if needed)
4. User profile extracted
5. Scheme matching applied
6. Response generated in correct language
7. Scheme cards returned

---

## 🔥 Example Inputs

| Input              | Output           |
| ------------------ | ---------------- |
| "mai kisan hu"     | Hindi response   |
| "mi shetkari aahe" | Marathi response |
| "I am student"     | English response |

---

## ⚠️ Edge Case Handling

If insufficient data:

* System asks for more details in same language

---

## 📦 Installation (Local Setup)

```bash
git clone https://github.com/deepak-2212/Scheme_Sarthi-
cd backend

python -m venv venv
source venv/Scripts/activate

pip install -r requirements.txt
python -m uvicorn main:app --reload
```

---

## 🔒 Environment Variables

```
SARVAM_API_KEY=your_api_key
SARVAM_MODEL=sarvam-m
```

---

## 🎯 Future Scope

* 🎙️ Voice input/output (vernacular languages)
* 📱 WhatsApp integration
* 📊 Advanced eligibility ranking
* 🗺️ State-specific scheme filtering
* 📂 Database integration

---

## 👨‍💻 Team

* Backend & AI Integration
* Frontend & UI/UX
* Data & Logic

---

## 🎬 Conclusion

SchemeSaathi bridges the gap between citizens and government benefits by transforming **complex information into simple, personalized, multilingual insights**.

---

## ⭐ Tagline

**“Your AI partner for finding the right government scheme, in your own language.”**
