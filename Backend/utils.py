import json

def load_schemes():
    with open("schemes.json", "r", encoding="utf-8") as f:
        return json.load(f)


def format_scheme_cards(schemes):

    cards = []

    for s in schemes:

        benefit = s.get("benefits", {}).get("summary", "No details")

        cards.append({
            "name": s.get("scheme_name"),
            "benefit": benefit,
            "reason": "Relevant",
            "apply": s.get("application", {}).get("apply_url"),
            "documents": s.get("documents_required", []),
            "steps": s.get("application", {}).get("steps", [])
        })

    return cards