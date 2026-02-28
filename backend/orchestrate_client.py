"""
orchestrate_client.py -- IBM watsonx Orchestrate REST client for the Sayam chatbot.

Uses the Orchestrate OpenAI-compatible chat/completions endpoint to power
intent routing and conversational responses.

Required env vars:
  IBM_ORCHESTRATE_URL         -- e.g. https://api.us-south.watsonx-orchestrate.cloud.ibm.com
  IBM_ORCHESTRATE_INSTANCE_ID -- tenant_id from Orchestrate Settings > API details
  IBM_WATSONX_API_KEY         -- same IAM key used for watsonx.ai (reused for auth)

The Orchestrate endpoint format:
  POST {URL}/instances/{INSTANCE_ID}/v1/chat/completions
"""

import os
import httpx
from watsonx_client import _get_iam_token   # reuse the shared IAM token cache

_ORC_URL = os.environ.get("IBM_ORCHESTRATE_URL", "").rstrip("/")
_ORC_INSTANCE = os.environ.get("IBM_ORCHESTRATE_INSTANCE_ID", "")

# Sayam's Orchestrate system prompt — describes the agent's role and available intents
_SYSTEM_PROMPT = """You are Sayam, an AI assistant for Ohio State University students.
You help with two primary tasks:
1. Career / Internship applications — finding and auto-applying to SWE internships.
2. Academic Study — scraping Canvas lecture slides and generating flashcards, quizzes, and study plans.

When a student sends a message, classify their intent and respond naturally.
Always output a JSON object with two fields:
  "intent": one of ["career", "academic", "study_mode", "confirm", "decline", "general"]
  "reply": your conversational response to the student (max 3 sentences, friendly tone)

Examples:
  User: "Apply to SWE internships" -> {"intent": "career", "reply": "On it! I'll find an internship on SimplifyJobs and get your application ready. Want me to tailor your resume for the role?"}
  User: "I have a CSE 3244 exam tomorrow" -> {"intent": "academic", "reply": "Let's get you ready! Tell me which course and I'll scrape your Canvas lecture slides and build a study set."}
  User: "Yes go ahead" -> {"intent": "confirm", "reply": "Great, proceeding now!"}
  User: "No thanks" -> {"intent": "decline", "reply": "No problem! Let me know if you need anything else."}
  User: "Enter study mode" -> {"intent": "study_mode", "reply": "Study mode activated! I'm blocking distracting sites so you can focus."}
  User: "What's the weather?" -> {"intent": "general", "reply": "I'm focused on helping with internships and studying. Try asking me to apply to jobs or help you prep for an exam!"}
"""


async def orchestrate_chat(user_message: str, conversation_history: list[dict] | None = None) -> dict:
    """
    Send a message to IBM watsonx Orchestrate and get back intent + reply.

    Returns a dict:
      {"intent": str, "reply": str}

    Falls back to watsonx.ai (Granite) if Orchestrate credentials are not configured.
    """
    if not _ORC_URL or not _ORC_INSTANCE:
        # Fallback to watsonx.ai Granite for intent classification
        return await _granite_fallback(user_message, conversation_history)

    messages = [{"role": "system", "content": _SYSTEM_PROMPT}]
    if conversation_history:
        messages.extend(conversation_history[-6:])  # keep last 3 turns
    messages.append({"role": "user", "content": user_message})

    try:
        token = await _get_iam_token()
        url = f"{_ORC_URL}/instances/{_ORC_INSTANCE}/v1/chat/completions"

        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post(
                url,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                json={
                    "messages": messages,
                    "temperature": 0.2,
                    "max_tokens": 300,
                },
            )
            r.raise_for_status()
            data = r.json()

        # Extract the assistant reply
        raw = data["choices"][0]["message"]["content"].strip()
        return _parse_response(raw)

    except Exception as e:
        print(f"[Orchestrate] Error: {e} — falling back to Granite")
        return await _granite_fallback(user_message, conversation_history)


def _parse_response(raw: str) -> dict:
    """Parse the JSON intent+reply from the model response."""
    import json
    # Strip markdown fences if present
    cleaned = raw.replace("```json", "").replace("```", "").strip()
    try:
        parsed = json.loads(cleaned)
        intent = parsed.get("intent", "general")
        reply = parsed.get("reply", raw)
        return {"intent": intent, "reply": reply}
    except Exception:
        # If model didn't return JSON, treat as general
        return {"intent": "general", "reply": raw}


async def _granite_fallback(user_message: str, history: list[dict] | None) -> dict:
    """
    Fallback: use watsonx.ai Granite to classify intent + generate reply.
    Used when Orchestrate credentials are absent or the API is unavailable.
    """
    from watsonx_client import wx_json
    prompt = f"""{_SYSTEM_PROMPT}

User message: "{user_message}"

Respond with ONLY a JSON object: {{"intent": "...", "reply": "..."}}"""
    try:
        raw = await wx_json(prompt, max_tokens=200)
        return _parse_response(raw)
    except Exception as e:
        print(f"[Granite fallback] Error: {e}")
        return {"intent": "general", "reply": "I can help with internship applications and exam prep. What do you need?"}


def is_configured() -> bool:
    """Returns True if Orchestrate credentials are set."""
    return bool(_ORC_URL and _ORC_INSTANCE)
