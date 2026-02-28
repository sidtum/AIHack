"""
sms_handler.py — FastAPI router at /sms + full SMS state machine.

Mounts to main FastAPI app via:
    app.include_router(sms_router)
"""
import asyncio
import hashlib
import hmac
import json
import os
import re
import time
from typing import Callable

import httpx
from fastapi import APIRouter, HTTPException, Request
from dotenv import load_dotenv

load_dotenv()

sms_router = APIRouter(prefix="/sms", tags=["sms"])

LINQ_API_BASE = "https://api.linqapp.com"
CAPABILITIES_TEXT = (
    "hey! I can apply to internships for you or help you prep for an exam — just tell me which"
)

# Running tasks indexed by chat_id for STOP support
_active_tasks: dict[str, asyncio.Task] = {}


# ── LinqClient ────────────────────────────────────────────────────────────────

class LinqClient:
    def __init__(self, token: str):
        self.token = token
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

    async def send_message(
        self,
        chat_id: str,
        text: str,
        screen_effect: str | None = None,
        bubble_effect: str | None = None,
    ) -> dict:
        message: dict = {"parts": [{"type": "text", "value": text}]}
        if screen_effect:
            message["effect"] = {"screen_effect": screen_effect}
        elif bubble_effect:
            message["effect"] = {"bubble_effect": bubble_effect}
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{LINQ_API_BASE}/v3/chats/{chat_id}/messages",
                headers=self.headers,
                json={"message": message},
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json()

    async def create_chat(self, to_handle: str, text: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{LINQ_API_BASE}/v3/chats",
                headers=self.headers,
                json={"to": [to_handle], "message": {"parts": [{"type": "text", "value": text}]}},
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json()

    async def start_typing(self, chat_id: str) -> None:
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{LINQ_API_BASE}/v3/chats/{chat_id}/typing",
                    headers=self.headers,
                    timeout=5,
                )
        except Exception:
            pass

    async def stop_typing(self, chat_id: str) -> None:
        try:
            async with httpx.AsyncClient() as client:
                await client.delete(
                    f"{LINQ_API_BASE}/v3/chats/{chat_id}/typing",
                    headers=self.headers,
                    timeout=5,
                )
        except Exception:
            pass

    async def react_to_message(self, message_id: str, reaction_type: str) -> None:
        """reaction_type: 'love' | 'like' | 'dislike' | 'laugh' | 'emphasize' | 'question'"""
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{LINQ_API_BASE}/v3/messages/{message_id}/reactions",
                    headers=self.headers,
                    json={"operation": "add", "type": reaction_type},
                    timeout=5,
                )
        except Exception:
            pass


def _get_client() -> LinqClient:
    return LinqClient(os.environ.get("LINQ_API_TOKEN", ""))


# ── Signature verification ────────────────────────────────────────────────────

def _verify_signature(raw_body: bytes, timestamp: str, signature: str, secret: str) -> bool:
    """HMAC-SHA256 over '{timestamp}.{payload}' per Linq spec. Returns True if valid."""
    try:
        ts = int(timestamp)
        if abs(time.time() - ts) > 300:  # 5-minute replay window
            return False
        message = f"{timestamp}.{raw_body.decode('utf-8')}"
        expected = hmac.new(secret.encode("utf-8"), message.encode("utf-8"), hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature)
    except Exception:
        return False


# ── Phone normalization ───────────────────────────────────────────────────────

def phones_match(e164_phone: str, stored_phone: str) -> bool:
    """Strip non-digits from both, compare last 10 digits."""
    if not e164_phone or not stored_phone:
        return False
    a = re.sub(r"\D", "", e164_phone)[-10:]
    b = re.sub(r"\D", "", stored_phone)[-10:]
    return bool(a and b and a == b)


# ── Desktop broadcast ─────────────────────────────────────────────────────────

async def broadcast_sms_to_desktop(text: str, sender: str, direction: str, ws_send: Callable) -> None:
    """direction: 'inbound' | 'outbound'"""
    if direction == "inbound":
        msg_type = "user_message"
    else:
        msg_type = "agent_response"
    await ws_send(json.dumps({"type": msg_type, "text": text, "source": "sms"}))




# ── State machine handlers ────────────────────────────────────────────────────

async def handle_stop_command(chat_id: str, client: LinqClient, ws_send: Callable) -> None:
    from database import update_sms_session

    task = _active_tasks.pop(chat_id, None)
    if task and not task.done():
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
    update_sms_session(chat_id, state="idle", pending_action_type=None, pending_action_data=None)
    msg = "stopped! lmk whenever you want to try again"
    await client.send_message(chat_id, msg)
    await broadcast_sms_to_desktop(msg, "", "outbound", ws_send)


async def handle_new_intent(chat_id: str, text: str, client: LinqClient, ws_send: Callable) -> None:
    from database import update_sms_session
    from main import classify_intent

    intent = await classify_intent(text)

    if intent == "career":
        plan = "ok so I'll find you a solid Summer 2026 SWE internship, tailor your resume for it, then auto-fill and submit the application. sound good?"
        update_sms_session(
            chat_id,
            state="awaiting_confirm",
            pending_action_type="career",
            pending_action_data=text,
        )
        await client.send_message(chat_id, plan)
        await broadcast_sms_to_desktop(plan, "", "outbound", ws_send)

    elif intent in ("academic", "quiz"):
        plan = "got it — I'll pull your Canvas content, grab the key concepts, and quiz you on them one by one. wanna go?"
        update_sms_session(
            chat_id,
            state="awaiting_confirm",
            pending_action_type="academic",
            pending_action_data=text,
        )
        await client.send_message(chat_id, plan)
        await broadcast_sms_to_desktop(plan, "", "outbound", ws_send)

    else:
        await client.send_message(chat_id, CAPABILITIES_TEXT)
        await broadcast_sms_to_desktop(CAPABILITIES_TEXT, "", "outbound", ws_send)


async def handle_confirmation_response(
    chat_id: str,
    text: str,
    session: dict,
    client: LinqClient,
    incoming_message_id: str,
    ws_send: Callable,
) -> None:
    from database import update_sms_session
    from main import classify_intent

    pending_type = session.get("pending_action_type")
    intent = await classify_intent(text, pending_type)
    confirmed = (intent == "confirm")

    if confirmed:
        action_type = session.get("pending_action_type")
        action_data = session.get("pending_action_data", "")

        if action_type == "career":
            update_sms_session(chat_id, state="career_running")
            await client.react_to_message(incoming_message_id, "like")
            msg = "on it! finding you a good role and submitting now, I'll let you know when it's done"
            await client.send_message(chat_id, msg)
            await broadcast_sms_to_desktop(msg, "", "outbound", ws_send)
            task = asyncio.create_task(
                _run_career_flow_sms(chat_id, client, incoming_message_id, ws_send)
            )
            _active_tasks[chat_id] = task

        elif action_type == "academic":
            update_sms_session(chat_id, state="academic_running")
            await client.react_to_message(incoming_message_id, "like")
            msg = "pulling up your Canvas content now, give me a sec"
            await client.send_message(chat_id, msg)
            await broadcast_sms_to_desktop(msg, "", "outbound", ws_send)
            task = asyncio.create_task(
                _run_academic_flow_sms(chat_id, client, action_data, incoming_message_id, ws_send)
            )
            _active_tasks[chat_id] = task

        else:
            update_sms_session(chat_id, state="idle")
            msg = "all good, just lmk whenever"
            await client.send_message(chat_id, msg)
            await broadcast_sms_to_desktop(msg, "", "outbound", ws_send)
    else:
        update_sms_session(chat_id, state="idle", pending_action_type=None, pending_action_data=None)
        msg = "all good, just lmk whenever"
        await client.send_message(chat_id, msg)
        await broadcast_sms_to_desktop(msg, "", "outbound", ws_send)


async def handle_quiz_answer(
    chat_id: str,
    text: str,
    session: dict,
    client: LinqClient,
    incoming_message_id: str,
) -> None:
    from database import update_sms_session

    questions_raw = session.get("quiz_questions_json") or "[]"
    questions = json.loads(questions_raw)
    idx = session.get("quiz_current_index", 0)
    score = session.get("quiz_score", 0)

    if idx >= len(questions):
        update_sms_session(chat_id, state="idle")
        await client.send_message(chat_id, "that's all the questions! nice work")
        return

    q = questions[idx]
    correct = q.get("correct_answer", "").upper().strip()
    answer_letter = text.strip().upper()[:1]

    if answer_letter == correct:
        score += 1
        await client.react_to_message(incoming_message_id, "like")
        feedback = "yep, that's right!"
    else:
        await client.react_to_message(incoming_message_id, "question")
        explanation = q.get("explanation", "")
        feedback = f"not quite — it's {correct}. {explanation}".strip()

    next_idx = idx + 1
    is_last = next_idx >= len(questions)

    if is_last:
        update_sms_session(chat_id, state="idle", quiz_current_index=next_idx, quiz_score=score)
        total = len(questions)
        summary = f"{feedback}\n\nfinal score: {score}/{total} — {'crushing it 🔥' if score == total else 'solid effort' if score >= total // 2 else 'keep grinding, you got this'}"
        effect = "confetti" if score == total else None
        await client.send_message(chat_id, summary, screen_effect=effect)
    else:
        update_sms_session(chat_id, quiz_current_index=next_idx, quiz_score=score)
        next_q = questions[next_idx]
        await client.send_message(chat_id, f"{feedback}\n\n{_format_question(next_q, next_idx + 1, len(questions))}")


def _format_question(q: dict, num: int, total: int) -> str:
    options = q.get("options", {})
    lines = [f"Q{num}/{total}: {q.get('question', '')}"]
    for letter in ["A", "B", "C", "D"]:
        opt = options.get(letter) or options.get(letter.lower())
        if opt:
            lines.append(f"{letter}) {opt}")
    lines.append("\na, b, c, or d?")
    return "\n".join(lines)


# ── Engine wrappers ───────────────────────────────────────────────────────────

async def _run_career_flow_sms(
    chat_id: str,
    client: LinqClient,
    confirm_message_id: str,
    ws_send: Callable,
) -> None:
    from database import get_user_profile, update_sms_session
    from career_engine import run_career_flow

    profile = get_user_profile()

    # Capture result from ws_broadcast
    result_text = [None]
    company_name = [None]

    async def sms_ws_broadcast(msg_str: str) -> None:
        await ws_send(msg_str)
        try:
            msg = json.loads(msg_str)
            if msg.get("type") == "agent_response":
                result_text[0] = msg.get("text", "")
                text = result_text[0]
                m = re.search(r"\*\*(.+?)\*\*", text)
                if m:
                    company_name[0] = m.group(1)
        except Exception:
            pass

    try:
        await client.start_typing(chat_id)
        await run_career_flow(profile, sms_ws_broadcast)
    except asyncio.CancelledError:
        await client.stop_typing(chat_id)
        update_sms_session(chat_id, state="idle")
        raise
    except Exception as e:
        await client.stop_typing(chat_id)
        await client.react_to_message(confirm_message_id, "question")
        update_sms_session(chat_id, state="idle")
        await client.send_message(chat_id, f"something went wrong on my end, sorry — {str(e)[:150]}")
        return

    await client.stop_typing(chat_id)
    update_sms_session(chat_id, state="idle")

    company = company_name[0] or "the company"
    summary = result_text[0] or f"Applied to {company}!"
    await client.react_to_message(confirm_message_id, "love")
    await client.send_message(chat_id, summary, screen_effect="fireworks")
    _active_tasks.pop(chat_id, None)


async def _run_academic_flow_sms(
    chat_id: str,
    client: LinqClient,
    query: str,
    confirm_message_id: str,
    ws_send: Callable,
) -> None:
    from database import update_sms_session, save_study_session, get_recent_study_session
    from academic_engine import run_academic_flow

    # Captured study panel data
    study_data = [None]

    async def sms_ws_broadcast(msg_str: str) -> None:
        await ws_send(msg_str)
        try:
            msg = json.loads(msg_str)
            if msg.get("type") == "study_panel":
                study_data[0] = msg
        except Exception:
            pass

    # Try cache first
    cached = get_recent_study_session(max_age_hours=24)
    if cached:
        study_data[0] = {
            "session_id": cached["id"],
            "course_name": cached.get("course_name", ""),
            "concepts": json.loads(cached.get("concepts_json") or "[]"),
            "questions": json.loads(cached.get("questions_json") or "[]"),
        }
        await client.send_message(chat_id, "using your recent study session, one sec")
    else:
        try:
            await client.start_typing(chat_id)
            await run_academic_flow(query, sms_ws_broadcast)
        except asyncio.CancelledError:
            await client.stop_typing(chat_id)
            update_sms_session(chat_id, state="idle")
            raise
        except Exception as e:
            await client.stop_typing(chat_id)
            await client.react_to_message(confirm_message_id, "question")
            update_sms_session(chat_id, state="idle")
            await client.send_message(chat_id, f"couldn't reach Canvas, sorry — {str(e)[:150]}")
            _active_tasks.pop(chat_id, None)
            return
        await client.stop_typing(chat_id)

    if not study_data[0]:
        await client.react_to_message(confirm_message_id, "question")
        update_sms_session(chat_id, state="idle")
        await client.send_message(chat_id, "Canvas isn't loading anything right now, try again in a bit")
        _active_tasks.pop(chat_id, None)
        return

    data = study_data[0]
    concepts = data.get("concepts", [])
    questions = data.get("questions", [])
    session_id = data.get("session_id")

    # Send concept summary (first 3, truncated)
    if concepts:
        lines = ["ok here's what you need to know:"]
        for c in concepts[:3]:
            title = c.get("title", "") if isinstance(c, dict) else str(c)
            lines.append(f"- {title[:80]}")
        if len(concepts) > 3:
            lines.append(f"...and {len(concepts) - 3} more.")
        await client.send_message(chat_id, "\n".join(lines))

    if not questions:
        update_sms_session(chat_id, state="idle")
        await client.send_message(chat_id, "got the content but couldn't generate quiz questions, check the desktop for the study panel")
        _active_tasks.pop(chat_id, None)
        return

    # Start quiz
    update_sms_session(
        chat_id,
        state="quiz_active",
        quiz_questions_json=json.dumps(questions),
        quiz_current_index=0,
        quiz_score=0,
        quiz_session_id=session_id,
    )
    await client.react_to_message(confirm_message_id, "love")
    first_q = _format_question(questions[0], 1, len(questions))
    await client.send_message(chat_id, first_q)
    _active_tasks.pop(chat_id, None)


# ── Top-level dispatcher ──────────────────────────────────────────────────────

async def handle_incoming_sms(payload: dict, ws_send: Callable) -> None:
    from database import get_user_profile, get_or_create_sms_session, update_sms_session

    # Extract fields from Linq v3 event envelope:
    # { event_type, data: { chat: {id}, id, sender_handle: {handle}, parts: [{type,value}] } }
    data = payload.get("data", {})
    chat_id = data.get("chat", {}).get("id", "")
    sender_handle = data.get("sender_handle", {}).get("handle", "")
    message_id = data.get("id", "")

    # Extract text from parts array
    parts = data.get("parts", [])
    text = ""
    for part in parts:
        if part.get("type") == "text":
            text = part.get("value", "").strip()
            break

    if not chat_id or not text:
        return

    # Whitelist check
    profile = get_user_profile()
    stored_phone = profile.get("phone", "")
    if not phones_match(sender_handle, stored_phone):
        return

    client = _get_client()
    session = get_or_create_sms_session(chat_id, sender_handle)

    # Track last received message ID for reactions
    if message_id:
        update_sms_session(chat_id, last_user_message_id=message_id)

    # Mirror inbound to desktop
    await broadcast_sms_to_desktop(text, sender_handle, "inbound", ws_send)

    # Emergency STOP
    if text.upper() == "STOP":
        await handle_stop_command(chat_id, client, ws_send)
        return

    state = session.get("state", "idle")

    await client.start_typing(chat_id)
    try:
        if state == "awaiting_confirm":
            await handle_confirmation_response(chat_id, text, session, client, message_id, ws_send)
        elif state == "quiz_active":
            await handle_quiz_answer(chat_id, text, session, client, message_id)
        else:
            await handle_new_intent(chat_id, text, client, ws_send)
    finally:
        await client.stop_typing(chat_id)


# ── Webhook endpoint ──────────────────────────────────────────────────────────

@sms_router.post("/webhook")
async def sms_webhook(request: Request):
    raw_body = await request.body()

    # Signature verification
    from database import get_linq_config
    config = get_linq_config()
    secret = config.get("linq_webhook_secret") or ""

    if secret:
        timestamp = request.headers.get("X-Webhook-Timestamp", "")
        signature = request.headers.get("X-Webhook-Signature", "")
        if not _verify_signature(raw_body, timestamp, signature, secret):
            raise HTTPException(status_code=401, detail="Invalid signature")

    try:
        payload = json.loads(raw_body)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    # Import ws_send lazily to avoid circular imports
    from main import ws_send as desktop_ws_send

    asyncio.create_task(handle_incoming_sms(payload, desktop_ws_send))
    return {"status": "ok"}
