from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
import json
import pdfplumber
import io
import os
import asyncio
import openai
from dotenv import load_dotenv
from database import (
    init_db, get_user_profile, update_user_profile,
    update_eeo_fields, get_profile_completeness, save_study_session,
    get_study_session, get_linq_config, get_job_applications,
    update_job_application_status,
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

async def ws_send(message: str):
    """Send to the single active websocket."""
    global active_ws
    if active_ws:
        try:
            await active_ws.send_text(message)
        except Exception:
            active_ws = None

# ── Intent Classification ────────────────────────────────────────────────────

def classify_intent(text: str) -> str:
    """Keyword-based intent classification. Zero-latency for demo."""
    t = text.lower().strip()
    if any(kw in t for kw in ["apply", "internship", "job", "career"]):
        return "career"
    if any(kw in t for kw in ["exam", "study", "canvas", "course", "class", "midterm", "final"]):
        return "academic"
    if any(kw in t for kw in ["yes", "proceed", "go ahead", "do it", "confirm"]):
        return "confirm"
    if any(kw in t for kw in ["no", "nope", "skip", "don't", "use existing", "use original", "no thanks"]):
        return "decline"
    if any(kw in t for kw in ["quiz", "test me", "start quiz"]):
        return "quiz"
    return "general"

# ── Pending action state (per-session, single-user demo) ─────────────────────
pending_action = {"type": None, "data": None}

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

    client = openai.AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

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

    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
    )

    raw = response.choices[0].message.content.strip()
    raw = raw.replace("```json", "").replace("```", "").strip()

    try:
        extracted_data = json.loads(raw)
    except json.JSONDecodeError:
        return {"status": "error", "message": "Failed to parse extracted resume data.", "raw": raw}

    extracted_data["resume_base_text"] = text
    extracted_data["resume_pdf_path"] = pdf_path
    update_user_profile(extracted_data)

    return {"status": "success", "profile": get_user_profile()}

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
    global active_ws, pending_action
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

                if msg_type == "quiz_complete":
                    asyncio.create_task(handle_quiz_complete(msg))
                    continue

                if msg_type == "study_qa":
                    question = msg.get("text", "")
                    context = msg.get("context", "")
                    asyncio.create_task(handle_study_qa(question, context))
                    continue

                if msg_type == "user_message":
                    text = msg.get("text", "")
                    intent = classify_intent(text)

                    if intent == "career":
                        pending_action = {"type": "career", "data": text}
                        plan = (
                            "Action Plan Generated:\n"
                            "1. Find a Summer 2026 SWE internship on SimplifyJobs.\n"
                            "2. Ask whether to tailor your resume for the specific role.\n"
                            "3. Generate tailored PDF if requested, then auto-apply via Chromium.\n\n"
                            "Shall I proceed?"
                        )
                        await ws_send(json.dumps({"type": "agent_response", "text": plan}))

                    elif intent == "academic":
                        pending_action = {"type": "academic", "data": text}
                        plan = (
                            "Action Plan Generated:\n"
                            "1. Open Canvas (carmen.osu.edu) — you'll log in manually.\n"
                            "2. Navigate to the relevant course and scrape content.\n"
                            "3. Generate key concepts and study material via GPT-4o.\n"
                            "4. Enter Study Mode with concept cards and Q&A.\n"
                            "5. Take a 5-question quiz to test your knowledge.\n\n"
                            "Shall I proceed?"
                        )
                        await ws_send(json.dumps({"type": "agent_response", "text": plan}))

                    elif intent == "confirm":
                        if pending_action["type"] == "career":
                            pending_action_copy = dict(pending_action)
                            pending_action = {"type": None, "data": None}
                            await handle_career_confirm(pending_action_copy)
                        elif pending_action["type"] == "resume_choice":
                            pending_action_copy = dict(pending_action)
                            pending_action = {"type": None, "data": None}
                            asyncio.create_task(handle_resume_choice(pending_action_copy, use_tailored=True))
                        elif pending_action["type"] == "academic":
                            pending_action_copy = dict(pending_action)
                            pending_action = {"type": None, "data": None}
                            await handle_academic_confirm(pending_action_copy)
                        else:
                            await ws_send(json.dumps({
                                "type": "agent_response",
                                "text": "I'm not sure what to confirm. Try asking me to apply to jobs or help you study."
                            }))

                    elif intent == "decline":
                        if pending_action["type"] == "resume_choice":
                            pending_action_copy = dict(pending_action)
                            pending_action = {"type": None, "data": None}
                            asyncio.create_task(handle_resume_choice(pending_action_copy, use_tailored=False))
                        else:
                            await ws_send(json.dumps({
                                "type": "agent_response",
                                "text": "Okay! Let me know if there's anything else I can help with."
                            }))

                    else:
                        await ws_send(json.dumps({
                            "type": "agent_response",
                            "text": "I can help with **Career Execution** or **Academic Study**.\n\nTry saying:\n- \"Apply to SWE internships\"\n- \"I have an exam tomorrow\""
                        }))

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
    from academic_engine import run_academic_flow
    await ws_send(json.dumps({"type": "status", "text": "Executing"}))
    await ws_send(json.dumps({"type": "agent_response", "text": "Starting academic sequence..."}))
    query = action.get("data", "")
    asyncio.create_task(run_academic_flow(query, ws_send))


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


async def handle_study_qa(question: str, context: str):
    from rag import query_rag
    try:
        rag_context = await query_rag(question, top_k=5)
        # Fallback to the default scraped context if RAG has no data
        final_context = rag_context if rag_context.strip() else context[:6000]
        
        client = openai.AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": f"You are a helpful tutor. Use the following course material to answer the student's question. Be concise but thorough.\n\nCourse Material:\n{final_context}"},
                {"role": "user", "content": question},
            ],
            temperature=0.3,
        )
        answer = response.choices[0].message.content
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
