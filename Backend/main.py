from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from chatbot import process_query
from utils import load_schemes

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 🔥 Chat memory (session-based)
sessions = {}

@app.get("/")
def home():
    return {"message": "AI Scheme Assistant Running 🚀"}

@app.get("/schemes")
def get_all_schemes():
    """Return all 50 schemes from schemes.json for the frontend."""
    data = load_schemes()
    return data

@app.get("/schemes/categories")
def get_categories():
    """Return distinct categories and states for filter UI."""
    data = load_schemes()
    categories = sorted(set(s.get("category", "") for s in data["schemes"]))
    states = sorted(set(
        s.get("applicable_state", "") for s in data["schemes"]
        if s.get("applicable_state") != "all"
    ))
    return {"categories": categories, "states": states}

@app.post("/chat")
async def chat(request: Request):
    try:
        data = await request.json()
        user_input = data.get("message", "")
        session_id = data.get("session_id", "default")

        if session_id not in sessions:
            sessions[session_id] = []

        history = sessions[session_id]

        result = process_query(user_input, history)

        # store user message and bot response
        history.append({"role": "user", "content": user_input})
        history.append({"role": "assistant", "content": result["text"]})

        return result

    except Exception as e:
        print("🔥 ERROR OCCURRED:", e)
        return {"text": "Something went wrong", "schemes": []}