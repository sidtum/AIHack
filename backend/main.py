from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
import json
import pdfplumber
import io
import os
import asyncio
from watsonx_client import wx_chat, wx_json
from orchestrate_client import orchestrate_chat, is_configured as orchestrate_configured
from dotenv import load_dotenv
from database import (
    init_db, get_user_profile, update_user_profile,
    update_eeo_fields, get_profile_completeness, save_study_session,
    get_study_session, get_linq_config, get_job_applications,
    update_job_application_status,
    save_lecture_session, get_lecture_sessions, get_lecture_session,
    update_lecture_session_title,
)

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

app = FastAPI(title="Sayam Backend")

@app.on_event("startup")
async def startup_event():
    init_db()
    from ngrok_manager import start_ngrok_and_register_webhook
    await start_ngrok_and_register_webhook()

from sms_handler import sms_router
app.include_router(sms_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Single active websocket (single-user demo app) ──────────────────────────
# Instead of broadcasting to all connections, we track only the latest one.
# This prevents duplicates when React hot-reloads or reconnects.
active_ws: WebSocket | None = None
# Track the currently running background task so it can be cancelled
current_task: asyncio.Task | None = None

async def ws_send(message: str):
    """Send to the single active websocket."""
    global active_ws
    if active_ws:
        try:
            await active_ws.send_text(message)
        except Exception:
            active_ws = None

# Conversation history per session (in-memory, single-user demo)
_conversation_history: list[dict] = []

# ── Pending action state (per-session, single-user demo) ─────────────────────
pending_action = {"type": None, "data": None, "course": None}

# ── REST Endpoints ───────────────────────────────────────────────────────────

@app.get("/")
def read_root():
    return {"status": "Sayam Backend is running"}

@app.get("/profile")
def get_profile():
    return get_user_profile()

@app.get("/profile/status")
def profile_status():
    return get_profile_completeness()

@app.get("/linq-config")
def linq_config_endpoint():
    config = get_linq_config()
    return {"linq_phone_number": config.get("linq_phone_number")}

@app.post("/update-profile")
async def update_profile_endpoint(request: Request):
    data = await request.json()
    update_user_profile(data)
    return {"status": "success", "profile": get_user_profile()}

@app.get("/job-applications")
def job_applications_endpoint():
    return get_job_applications()

@app.patch("/job-applications/{app_id}/status")
async def update_application_status(app_id: int, request: Request):
    data = await request.json()
    update_job_application_status(app_id, data["status"])
    return {"status": "ok"}


@app.post("/upload-resume")
async def upload_resume(file: UploadFile = File(...)):
    content = await file.read()
    text = ""
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                text += t + "\n"

    if not text.strip():
        return {"status": "error", "message": "Could not extract text from PDF. Try a text-based PDF."}

    uploads_dir = os.path.join(os.path.dirname(__file__), "uploads")
    os.makedirs(uploads_dir, exist_ok=True)
    pdf_path = os.path.join(uploads_dir, "resume.pdf")
    with open(pdf_path, "wb") as f:
        f.write(content)

    prompt = f"""Extract the following fields from this resume text and return ONLY valid JSON with no markdown, no explanation.

Fields to extract:
- name: full name
- email: email address
- phone: phone number or null if not mentioned
- gpa: GPA as a string (e.g. "3.8") or null if not mentioned
- location: city/state or "Remote" if not mentioned
- university: university name or null
- graduation_year: expected graduation year as string or null
- skills: array of technical skills (languages, frameworks, tools)
- target_roles: array of job title strings the candidate is targeting based on their experience

Resume text:
{text[:4000]}

Return only this JSON structure:
{{"name": "", "email": "", "phone": null, "gpa": null, "location": "", "university": null, "graduation_year": null, "skills": [], "target_roles": []}}"""

    response_text = await wx_chat(prompt)
    raw = response_text.replace("```json", "").replace("```", "").strip()

    try:
        extracted_data = json.loads(raw)
    except json.JSONDecodeError:
        return {"status": "error", "message": "Failed to parse extracted resume data.", "raw": raw}

    extracted_data["resume_base_text"] = text
    extracted_data["resume_pdf_path"] = pdf_path
    update_user_profile(extracted_data)

    return {"status": "success", "profile": get_user_profile()}

@app.post("/process-lecture-audio")
async def process_lecture_audio(file: UploadFile = File(...)):
    from notes_engine import transcribe_audio, generate_notes
    audio_bytes = await file.read()
    mimetype = file.content_type or "audio/webm"

    transcript = await transcribe_audio(audio_bytes, mimetype)
    if not transcript:
        return {"status": "error", "message": "Transcription returned empty. Try speaking closer to the mic."}

    # Auto-title: first 60 chars stripped to the last complete word
    raw_title = transcript[:60]
    if len(transcript) > 60:
        raw_title = raw_title.rsplit(" ", 1)[0]
    title = raw_title.strip().rstrip(".,;:") or "Untitled Lecture"

    notes = await generate_notes(transcript, title)
    session_id = save_lecture_session(title, transcript, notes)
    return get_lecture_session(session_id)


@app.get("/lecture-sessions")
def lecture_sessions_list():
    return get_lecture_sessions()


@app.get("/lecture-sessions/{session_id}")
def lecture_session_detail(session_id: int):
    from fastapi import HTTPException
    session = get_lecture_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@app.post("/lecture-sessions/{session_id}/qa")
async def lecture_session_qa(session_id: int, request: Request):
    from notes_engine import answer_question
    data = await request.json()
    question = data.get("question", "").strip()
    session = get_lecture_session(session_id)
    if not session:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Session not found")
    answer = await answer_question(question, session.get("notes", ""), session.get("transcript", ""))
    return {"answer": answer}


@app.patch("/lecture-sessions/{session_id}/title")
async def update_session_title(session_id: int, request: Request):
    data = await request.json()
    update_lecture_session_title(session_id, data.get("title", ""))
    return {"status": "ok"}


@app.post("/lecture-sessions/{session_id}/flashcards")
async def flashcards_from_session(session_id: int):
    from study_mode_manager import generate_anki_cards
    from fastapi import HTTPException
    session = get_lecture_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    content = session.get("notes") or session.get("transcript") or ""
    title = session.get("title") or ""
    cards = await generate_anki_cards(content, title)
    return {"cards": cards}


@app.post("/lecture-sessions/{session_id}/quiz")
async def quiz_from_session(session_id: int):
    from quiz_generator import generate_study_material
    from fastapi import HTTPException
    session = get_lecture_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    content = session.get("notes") or session.get("transcript") or ""
    title = session.get("title") or ""
    result = await generate_study_material(content, title)
    if not result:
        raise HTTPException(status_code=500, detail="Failed to generate quiz from notes")
    return result


@app.post("/upload-transcript")
async def upload_transcript(file: UploadFile = File(...)):
    content = await file.read()
    uploads_dir = os.path.join(os.path.dirname(__file__), "uploads")
    os.makedirs(uploads_dir, exist_ok=True)
    pdf_path = os.path.join(uploads_dir, "transcript.pdf")
    with open(pdf_path, "wb") as f:
        f.write(content)
        
    update_user_profile({"transcript_pdf_path": pdf_path})
    return {"status": "success", "profile": get_user_profile()}

# ── WebSocket ────────────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    global active_ws, pending_action, current_task
    await websocket.accept()
    active_ws = websocket  # Always use the latest connection
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                msg_type = msg.get("type", "")

                if msg_type == "update_profile":
                    update_user_profile(msg.get("data", {}))
                    await ws_send(json.dumps({
                        "type": "agent_response",
                        "text": "Profile updated successfully."
                    }))
                    continue

                if msg_type == "cancel":
                    if current_task and not current_task.done():
                        current_task.cancel()
                        current_task = None
                    pending_action = {"type": None, "data": None, "course": None}
                    await ws_send(json.dumps({"type": "status", "text": "Idle"}))
                    await ws_send(json.dumps({"type": "agent_response", "text": "⛔ Stopped."}))
                    continue

                if msg_type == "set_course":
                    # User picked a specific course for the pending academic action
                    course_name = msg.get("course", "").strip()
                    if pending_action["type"] == "academic" and course_name:
                        pending_action["course"] = course_name
                        await ws_send(json.dumps({
                            "type": "course_confirmed",
                            "course": course_name,
                            "text": f'Course set to **{course_name}**. Shall I proceed with the study plan?'
                        }))
                    continue

                if msg_type == "generate_cards_from_page":
                    asyncio.create_task(handle_generate_cards(msg))
                    continue

                if msg_type == "study_mode_off":
                    from study_mode_manager import toggle_study_mode
                    toggle_study_mode(False)
                    await ws_send(json.dumps({
                        "type": "study_mode_inactive",
                        "text": "Study mode disabled. Stay focused! 💪"
                    }))
                    continue

                if msg_type == "quiz_complete":
                    asyncio.create_task(handle_quiz_complete(msg))
                    continue

                if msg_type == "study_qa":
                    question = msg.get("text", "")
                    context = msg.get("context", "")
                    asyncio.create_task(handle_study_qa(question, context))
                    continue

                if msg_type == "start_study_session":
                    # Direct trigger from Study Mode page — no chat intent needed
                    course = msg.get("course", "").strip()
                    query = msg.get("query", "help me prepare for my upcoming exam").strip()
                    if not course:
                        await ws_send(json.dumps({"type": "agent_response", "text": "Please enter a course name to start a study session."}))
                        continue
                    pending_action = {"type": "academic", "data": query, "course": course}
                    asyncio.create_task(handle_academic_confirm(pending_action))
                    continue

                if msg_type == "user_message":
                    text = msg.get("text", "")

                    # Route through IBM watsonx Orchestrate (falls back to Granite if unconfigured)
                    try:
                        orc = await orchestrate_chat(text, _conversation_history)
                        intent = orc.get("intent", "general")
                        orc_reply = orc.get("reply", "")
                    except Exception as _orc_err:
                        print(f"[Orchestrate] routing error: {_orc_err}")
                        intent = "general"
                        orc_reply = "I can help with internship applications and exam prep. What would you like to do?"

                    # Append to conversation history (keep last 10 turns)
                    _conversation_history.append({"role": "user", "content": text})
                    _conversation_history.append({"role": "assistant", "content": orc_reply})
                    if len(_conversation_history) > 20:
                        _conversation_history[:] = _conversation_history[-20:]


                    if intent == "career":
                        pending_action = {"type": "career", "data": text}
                        plan = (
                            "Action Plan Generated:\n"
                            "1. Find a Summer 2026 SWE internship on SimplifyJobs.\n"
                            "2. Ask whether to tailor your resume for the specific role.\n"
                            "3. Generate tailored PDF if requested, then auto-apply via Chromium.\n\n"
                            f"{orc_reply}\n\nShall I proceed?"
                        )
                        await ws_send(json.dumps({"type": "agent_response", "text": plan}))

                    elif intent == "academic":
                        pending_action = {"type": "academic", "data": text, "course": None}
                        await ws_send(json.dumps({
                            "type": "course_picker",
                            "text": f"{orc_reply}\n\nAction Plan:\n1. Open Canvas — log in manually.\n2. Navigate to your course and scrape content.\n3. Generate key concepts and study material via IBM Granite.\n4. Enter Study Mode with flashcards and Q&A.\n5. Take a 5-question quiz to test your knowledge.",
                        }))

                    elif intent == "confirm":
                        if pending_action["type"] == "career":
                            pending_action_copy = dict(pending_action)
                            pending_action = {"type": None, "data": None, "course": None}
                            await handle_career_confirm(pending_action_copy)
                        elif pending_action["type"] == "resume_choice":
                            pending_action_copy = dict(pending_action)
                            pending_action = {"type": None, "data": None}
                            asyncio.create_task(handle_resume_choice(pending_action_copy, use_tailored=True))
                        elif pending_action["type"] == "academic":
                            pending_action_copy = dict(pending_action)
                            pending_action = {"type": None, "data": None, "course": None}
                            await handle_academic_confirm(pending_action_copy)
                        else:
                            await ws_send(json.dumps({"type": "agent_response", "text": orc_reply}))

                    elif intent == "decline":
                        if pending_action["type"] == "resume_choice":
                            pending_action_copy = dict(pending_action)
                            pending_action = {"type": None, "data": None}
                            asyncio.create_task(handle_resume_choice(pending_action_copy, use_tailored=False))
                        else:
                            await ws_send(json.dumps({"type": "agent_response", "text": orc_reply}))

                    elif intent == "study_mode":
                        asyncio.create_task(handle_study_mode_activate(text))

                    else:
                        # General / unknown — use Orchestrate's conversational reply
                        await ws_send(json.dumps({"type": "agent_response", "text": orc_reply}))

            except json.JSONDecodeError:
                await ws_send(json.dumps({"type": "agent_response", "text": f"Error parsing: {data}"}))
    except WebSocketDisconnect:
        if active_ws is websocket:
            active_ws = None


async def handle_career_confirm(action: dict):
    from career_engine import scrape_first_supported_job
    profile = get_user_profile()

    eeo_fields = ["gender", "race_ethnicity", "veteran_status", "disability_status", "work_authorization"]
    missing_eeo = [f for f in eeo_fields if not profile.get(f)]
    has_basic = bool(profile.get("email") and profile.get("resume_base_text"))

    if not has_basic:
        await ws_send(json.dumps({
            "type": "profile_needed",
            "missing": ["email", "resume_base_text"],
            "text": "I need your resume first. Please click Profile and upload your resume."
        }))
        return

    if missing_eeo:
        await ws_send(json.dumps({
            "type": "profile_needed",
            "missing": missing_eeo,
            "text": f"Job applications require EEO disclosures. Please fill in: {', '.join(f.replace('_', ' ').title() for f in missing_eeo)}.\n\nOpen your Profile to complete these fields."
        }))
        return

    global pending_action
    await ws_send(json.dumps({"type": "status", "text": "Executing"}))
    await ws_send(json.dumps({"type": "thought", "text": "Scanning SimplifyJobs for a matching internship..."}))

    job = await asyncio.get_event_loop().run_in_executor(None, scrape_first_supported_job)

    if not job:
        await ws_send(json.dumps({
            "type": "agent_response",
            "text": "No open Greenhouse or Lever internship found on SimplifyJobs right now. Try again later."
        }))
        await ws_send(json.dumps({"type": "status", "text": "Idle"}))
        return

    await ws_send(json.dumps({
        "type": "thought",
        "text": f"Found: {job['company']} — {job['role']} ({job['ats'].title()})"
    }))

    pending_action = {"type": "resume_choice", "data": {"job": job, "profile": profile}}

    await ws_send(json.dumps({
        "type": "agent_response",
        "text": (
            f"Found **{job['company']}** — {job['role']}.\n\n"
            "Would you like me to create a **tailored resume** for this application? "
            "I'll rephrase your existing experience bullets to highlight skills matching the job — "
            "no fabrication, just better framing.\n\n"
            "**Yes** — create a tailored resume\n"
            "**No** — use your existing resume"
        )
    }))
    await ws_send(json.dumps({"type": "status", "text": "Idle"}))


async def handle_resume_choice(action: dict, use_tailored: bool):
    from career_engine import run_career_flow
    job = action["data"]["job"]
    profile = action["data"]["profile"]
    tailored_resume_path = None

    if use_tailored:
        from resume_tailor import tailor_resume
        await ws_send(json.dumps({"type": "status", "text": "Executing"}))
        await ws_send(json.dumps({"type": "thought", "text": "Creating your tailored resume..."}))
        try:
            tailored_resume_path = await tailor_resume(profile, job, ws_send)
            await ws_send(json.dumps({
                "type": "thought",
                "text": f"Tailored resume ready: {os.path.basename(tailored_resume_path)}"
            }))
        except Exception as e:
            await ws_send(json.dumps({
                "type": "thought",
                "text": f"Resume tailoring failed ({e}). Falling back to original resume."
            }))
            tailored_resume_path = None
    else:
        await ws_send(json.dumps({
            "type": "agent_response",
            "text": "Using your existing resume. Starting application..."
        }))

    await ws_send(json.dumps({"type": "status", "text": "Executing"}))
    asyncio.create_task(run_career_flow(profile, ws_send, job=job, tailored_resume_path=tailored_resume_path))


async def handle_academic_confirm(action: dict):
    global current_task
    from academic_engine import run_academic_flow
    await ws_send(json.dumps({"type": "status", "text": "Executing"}))
    course = action.get("course") or ""
    query = action.get("data", "")
    course_label = course or "your course"
    await ws_send(json.dumps({"type": "agent_response", "text": f"Starting academic sequence for **{course_label}**..."}))
    current_task = asyncio.create_task(run_academic_flow(query, ws_send, course_name=course))


async def handle_quiz_complete(msg: dict):
    from quiz_generator import generate_study_plan
    score = msg.get("score", 0)
    total = msg.get("total", 0)
    wrong_questions = msg.get("wrong_questions", [])
    course_name = msg.get("course_name", "")
    concepts = msg.get("concepts", [])

    await ws_send(json.dumps({"type": "status", "text": "Generating Study Plan..."}))
    result = await generate_study_plan(concepts, wrong_questions, course_name, score, total)
    await ws_send(json.dumps({
        "type": "study_results",
        "score": score,
        "total": total,
        "feedback": result.get("feedback", ""),
        "study_plan": result.get("study_plan", []),
        "flashcard_questions": wrong_questions,
    }))
    await ws_send(json.dumps({"type": "status", "text": "Idle"}))


async def handle_study_mode_activate(query: str):
    """Enable study mode: block sites + fetch OSU resources."""
    from study_mode_manager import toggle_study_mode, find_osu_study_resources, DISTRACTION_DOMAINS
    toggle_study_mode(True)

    # Detect subject from the query
    subject = query
    for kw in ["study mode", "focus mode", "i'm studying", "im studying", "block sites", "enter study mode", "start study mode"]:
        subject = subject.lower().replace(kw, "").strip()

    await ws_send(json.dumps({"type": "status", "text": "Study Mode"}))
    await ws_send(json.dumps({
        "type": "study_mode_active",
        "blocked_count": len(DISTRACTION_DOMAINS),
        "blocked_domains": DISTRACTION_DOMAINS,
        "subject": subject,
        "text": f"📚 Study Mode activated! Blocking {len(DISTRACTION_DOMAINS)} distracting sites. Stay focused!"
    }))

    # Fetch OSU resources asynchronously
    resources = await find_osu_study_resources(subject)
    await ws_send(json.dumps({
        "type": "osu_resources",
        "resources": resources,
        "subject": subject,
    }))


async def handle_generate_cards(msg: dict):
    """Generate Anki flashcards from RAG store (downloaded PDFs) + current page text."""
    from study_mode_manager import generate_anki_cards
    from rag import query_rag, storage as rag_storage
    page_text = msg.get("page_text", "").strip()
    subject = msg.get("subject", "")

    # 1. Try RAG first — this contains all the Canvas PDFs the agent downloaded
    rag_content = ""
    if rag_storage:
        rag_content = await query_rag(
            f"key concepts, definitions, and topics for {subject} exam" if subject else "important concepts",
            top_k=8
        )

    # 2. Combine RAG + live page text (RAG takes priority, page text fills gaps)
    combined = ""
    if rag_content.strip():
        combined = rag_content
        if page_text and len(page_text) > 200:
            # Append page text as supplementary context, capped to avoid token overflow
            combined += f"\n\n--- Additional page context ---\n{page_text[:2000]}"
    else:
        combined = page_text

    if not combined.strip():
        await ws_send(json.dumps({
            "type": "agent_response",
            "text": "No lecture material found yet. Use **Start a Study Session** to scrape your Canvas slides first, or navigate to a lecture page and click **Cards from page**."
        }))
        return

    await ws_send(json.dumps({"type": "thought", "text": f"Generating flashcards from {'lecture slides + RAG' if rag_content else 'current page'}..."}))
    cards = await generate_anki_cards(combined, subject)

    if not cards:
        await ws_send(json.dumps({
            "type": "agent_response",
            "text": "Couldn't generate flashcards from this content. Try navigating to a text-rich lecture page."
        }))
        return

    await ws_send(json.dumps({
        "type": "anki_cards",
        "cards": cards,
        "subject": subject,
    }))

    # 3. Also generate a dynamic study plan if we have RAG content
    if rag_content.strip():
        asyncio.create_task(handle_generate_study_plan(combined, subject))


async def handle_generate_study_plan(content: str, subject: str):
    """Generate an AI study plan from lecture content and broadcast it."""
    try:
        subject_hint = f' for **{subject}**' if subject else ''
        prompt = f"""You are a study coach. Based on the following lecture material{subject_hint}, create a concise, actionable 5-step study plan the student should follow to prepare for their exam.

Lecture material:
{content[:6000]}

Return ONLY a JSON array of exactly 5 steps, each with "step" (1-5) and "text" (one sentence, max 20 words, actionable):
[{{"step": 1, "text": "..."}}, ...]"""

        raw = await wx_json(prompt)
        parsed = json.loads(raw)
        steps = []
        if isinstance(parsed, list):
            steps = parsed
        elif isinstance(parsed, dict):
            for v in parsed.values():
                if isinstance(v, list):
                    steps = v
                    break

        if steps:
            await ws_send(json.dumps({
                "type": "study_plan",
                "steps": steps[:5],
                "subject": subject,
            }))
    except Exception as e:
        print(f"Study plan generation error: {e}")


async def handle_study_qa(question: str, context: str):
    from rag import query_rag
    try:
        rag_context = await query_rag(question, top_k=5)
        # Fallback to the default scraped context if RAG has no data
        final_context = rag_context if rag_context.strip() else context[:6000]
        
        answer = await wx_chat(question, system=f"You are a helpful tutor. Use the following course material to answer the student's question. Be concise but thorough.\n\nCourse Material:\n{final_context}")
        await ws_send(json.dumps({
            "type": "study_qa_response",
            "text": answer,
        }))
    except Exception as e:
        await ws_send(json.dumps({
            "type": "study_qa_response",
            "text": f"Sorry, I couldn't process that question: {str(e)}",
        }))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
