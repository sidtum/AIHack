# Sayam — Powered by IBM watsonx.ai

Sayam is an AI-powered desktop assistant for Ohio State University students, built for the **IBM hackathon**. It automates internship applications and exam prep, using **IBM Granite 3.3 8B** (via IBM watsonx.ai) as the core AI throughout. Built on Electron, React, and FastAPI with agentic browser automation.

> **IBM watsonx.ai** powers every AI feature: flashcard generation, quiz creation, study plans, Canvas agent reasoning, resume parsing, lecture Q&A, and IBM SkillsBuild course recommendations.

---

## IBM watsonx Integration

All LLM calls route through IBM watsonx.ai — no OpenAI or Google dependencies for AI inference.

| Feature | IBM Tool Used |
|---|---|
| Flashcard generation from lecture slides | watsonx.ai · Granite 3.3 8B |
| Multiple-choice quiz generation | watsonx.ai · Granite 3.3 8B |
| Post-quiz study plan & feedback | watsonx.ai · Granite 3.3 8B |
| 5-step study plan from lecture content | watsonx.ai · Granite 3.3 8B |
| Canvas browser agent (scraping + reasoning) | watsonx.ai · Granite 3.3 8B via LangChain |
| Study Q&A with RAG retrieval | watsonx.ai · Granite 3.3 8B |
| Resume parsing & profile extraction | watsonx.ai · Granite 3.3 8B |
| IBM SkillsBuild course recommendations | watsonx.ai · Granite 3.3 8B |
| Study resources panel | IBM SkillsBuild courses |

### How watsonx.ai is called
The backend includes a custom REST client (`watsonx_client.py`) that calls the `/ml/v1/text/generation` endpoint directly using `httpx` with IAM token caching. A LangChain wrapper (`watsonx_langchain.py`) adapts the same client for use with `browser-use` agents. Model: `ibm/granite-3-3-8b-instruct`.

---

## Features

### Career Engine
Automates the full internship application pipeline from sourcing to submission.

- **Job sourcing** — Scrapes [SimplifyJobs/Summer2026-Internships](https://github.com/SimplifyJobs/Summer2026-Internships) for open Greenhouse/Lever/Ashby roles.
- **Resume tailoring** — Rephrases experience bullets to match the target job's language. No fabrication — only better framing.
- **Autonomous application** — The `browser-use` agent (Playwright + CDP) navigates to the application URL, uploads your resume, waits for ATS autofill, and fills remaining fields from your profile.
- **Application tracker** — Every submitted application is saved to SQLite. A Career Dashboard lets you update statuses and open tailored resume PDFs.

### Academic Engine
Turns your Canvas course materials into an interactive study session powered by IBM Granite.

- **Canvas scraping** — Connects to your authenticated carmen.osu.edu session via CDP, navigates Files, and downloads lecture slides (PDF/PPTX). The Canvas navigation agent thinks with IBM Granite 3.3 8B.
- **RAG pipeline** — Extracted text is chunked and stored in an in-memory LangChain vector store for retrieval-augmented Q&A over your actual course content.
- **Study panel** — IBM Granite generates key concepts for the course and answers free-form questions using your lecture slides as context.
- **5-question quiz** — IBM Granite generates a multiple-choice quiz. After submission: score, personalized feedback, and a 5-step study plan.
- **Anki flashcards** — IBM Granite generates front/back flashcard pairs from RAG content or the current browser page.

### Study Mode
A distraction-free focus environment.

- **Site blocking** — Blocks 11 distraction domains (Reddit, YouTube, Twitter/X, Instagram, TikTok, etc.) via Electron's `will-navigate` intercept.
- **IBM SkillsBuild panel** — Surfaces IBM SkillsBuild courses relevant to your subject, plus IBM Granite-suggested additional resources.
- **Study session launcher** — Triggers the Academic Engine directly, without going through the chat flow.

### Lecture Notes
Records live lectures and converts them into persistent, searchable notes.

- **Live recording** — `MediaRecorder` API captures microphone audio in Electron.
- **Transcription** — Deepgram nova-2 transcribes the audio via REST.
- **Notes generation** — Structures the transcript into a summary, concept headings, and a glossary.
- **Session management** — Every recording saved to SQLite. Inline title editing, follow-up Q&A.

### SMS Agent
Full Sayam functionality over SMS via the Linq platform — multi-turn conversations, quiz sessions, intent detection, and a stop command.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Electron Process                 │
│  ┌─────────────────────────────────────────────┐ │
│  │          React + Vite (renderer)             │ │
│  │  ┌──────────┐  ┌──────────────────────────┐ │ │
│  │  │   Chat   │  │  AgentBrowser (toolbar)  │ │ │
│  │  │ Sidebar  │  │  + WebContentsView       │ │ │
│  │  └──────────┘  │  ┌──────────────────┐   │ │ │
│  │                │  │ CareerDashboard  │   │ │ │
│  │                │  │ NotesDashboard   │   │ │ │
│  │                │  │ StudyModePage    │   │ │ │
│  │                │  └──────────────────┘   │ │ │
│  │                └──────────────────────────┘ │ │
│  └─────────────────────────────────────────────┘ │
│         │ WebSocket ws://127.0.0.1:8000/ws        │
│         │ REST http://127.0.0.1:8000              │
│         ▼                                         │
│  ┌─────────────────────────────────────────────┐ │
│  │         FastAPI Backend (uvicorn)            │ │
│  │  main.py · database.py (SQLite)              │ │
│  │  watsonx_client.py  ← IBM watsonx.ai REST   │ │
│  │  watsonx_langchain.py ← LangChain wrapper   │ │
│  │  career_engine  → browser-use + Playwright   │ │
│  │  academic_engine → Canvas scraper + RAG      │ │
│  │  notes_engine   → Deepgram                   │ │
│  │  study_mode_manager → Anki + IBM SkillsBuild │ │
│  │  quiz_generator → flashcards + quizzes       │ │
│  │  sms_handler    → Linq webhook + ngrok        │ │
│  └─────────────────────────────────────────────┘ │
│         │ CDP localhost:9222                       │
│         ▼                                         │
│  WebContentsView (browser automation target)      │
└─────────────────────────────────────────────────┘
```

**Frontend:** Electron · React 18 · TypeScript · Vite · Framer Motion · Lucide React

**Backend:** Python 3.14 · FastAPI · uvicorn · SQLite · LangChain (RAG)

**AI:** IBM watsonx.ai · IBM Granite 3.3 8B · Deepgram nova-2 (transcription)

**Automation:** browser-use 0.11.11 · Playwright · CDP

**SMS:** Linq API · pyngrok

---

## Project Structure

```
AIHack/
├── README.md
├── frontend/
│   ├── electron/main.js              # Electron main process, CDP, site blocking, IPC
│   └── src/
│       ├── App.tsx                   # Root component, WebSocket, mode state machine
│       └── components/
│           ├── AgentBrowser.tsx      # Toolbar + WebContentsView bounds tracking
│           ├── CareerDashboard.tsx   # Job application tracker overlay
│           ├── NotesDashboard.tsx    # Lecture notes (record → transcribe → notes)
│           ├── StudyModePage.tsx     # Focus mode with IBM SkillsBuild resources
│           ├── StudyPanel.tsx        # Concepts + RAG Q&A
│           ├── QuizView.tsx          # Multiple-choice quiz UI
│           └── ProfileDrawer.tsx     # Resume upload + EEO fields
└── backend/
    ├── main.py                   # FastAPI app, WebSocket handler, intent router
    ├── watsonx_client.py         # IBM watsonx.ai REST client (IAM auth + generation)
    ├── watsonx_langchain.py      # LangChain ChatModel wrapper for browser-use agents
    ├── database.py               # SQLite schema + query functions
    ├── career_engine.py          # SimplifyJobs scraping + application flow
    ├── resume_tailor.py          # Resume tailoring → PDF generation
    ├── academic_engine.py        # Canvas navigation + PDF scraping + RAG ingestion
    ├── notes_engine.py           # Deepgram transcription + notes + Q&A
    ├── study_mode_manager.py     # Site blocking, IBM SkillsBuild resources, Anki cards
    ├── quiz_generator.py         # IBM Granite quiz + study plan generation
    ├── rag.py                    # LangChain in-memory vector store
    ├── sms_handler.py            # Linq webhook + SMS state machine
    └── requirements.txt
```

---

## Setup

### Prerequisites
- Node.js 18+
- Python 3.11+
- IBM Cloud account with watsonx.ai access ([cloud.ibm.com](https://cloud.ibm.com))

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Create `backend/.env`:

```env
# IBM watsonx.ai — required for all AI features
IBM_WATSONX_API_KEY=...         # IAM API key from cloud.ibm.com
IBM_WATSONX_PROJECT_ID=...      # From dataplatform.cloud.ibm.com > Manage > General
IBM_WATSONX_URL=https://us-south.ml.cloud.ibm.com

# Other services
DEEPGRAM_API_KEY=...            # For lecture transcription
NGROK_AUTH_TOKEN=...            # For SMS webhook tunnel
LINQ_API_TOKEN=...              # Optional — SMS feature only
```

Start the server:

```bash
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev        # starts Vite dev server + Electron
```

---

## Usage

### First Run
Upload your resume PDF in the onboarding wizard. IBM Granite parses it and populates your profile (name, email, GPA, skills, target roles).

### Studying for an Exam
1. Type *"I have an exam for CSE 3244"* — Sayam shows a course picker.
2. Log into Carmen in the embedded browser.
3. IBM Granite (via the Canvas browser agent) scrapes your lecture slides, builds a RAG index, and opens a Study Panel with key concepts.
4. Click **Start Quiz** — IBM Granite generates a 5-question exam. After submission: score, feedback, and a personalized 5-step study plan.

### Applying to Internships
1. Type *"Apply to SWE internships"* — confirm the action plan.
2. The browser-use agent (powered by IBM Granite) fills the application form autonomously.
3. Track the application in the Career Dashboard.

### Study Mode (Focus)
Toggle the **Study** switch to block distractions and surface IBM SkillsBuild courses relevant to your current subject.

### Recording Lectures
1. Click **NOTES** → **Record Lecture**.
2. Stop recording — Deepgram transcribes, then notes are structured and saved.

---

## Database Schema

SQLite file: `backend/sayam.db`

| Table | Description |
|---|---|
| `users` | Profile: name, email, resume, skills, EEO fields |
| `job_applications` | Applications: company, role, URL, status, tailored resume path |
| `lecture_sessions` | Recordings: title, transcript, notes, timestamp |
| `study_sessions` | Canvas sessions: course, concepts, questions, quiz score |
| `sms_sessions` | Per-chat SMS state machine state |

---

*Built for the IBM hackathon. Powered by IBM watsonx.ai and IBM Granite 3.3 8B.*
