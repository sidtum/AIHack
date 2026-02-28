# Sayam

Sayam is an AI-powered desktop assistant built for students at Ohio State University. It automates two of the most time-consuming parts of student life — applying to internships and studying for exams — while also providing a live lecture notes tool. Built on Electron, React, and FastAPI with agentic browser automation.

---

## Features

### Career Engine
Automates the full internship application pipeline from sourcing to submission.

- **Job sourcing** — Scrapes the [SimplifyJobs/Summer2026-Internships](https://github.com/SimplifyJobs/Summer2026-Internships) GitHub repo for open roles, filtering for supported ATS platforms (Greenhouse, Lever, Ashby).
- **Resume tailoring** — Uses GPT-4o to rephrase your existing experience bullets to match the target job's language. No fabrication — only better framing.
- **Autonomous application** — The `browser-use` agent (Playwright + CDP) navigates to the application URL inside the embedded browser, uploads your resume, waits for ATS autofill, and intelligently fills remaining fields (EEO, demographics, custom questions) from your profile.
- **Application tracker** — Every submitted application is saved to SQLite with company, role, date, and status. A **Career Dashboard** lets you update statuses (Applied → OA → Interview → Offer → Rejected) and open tailored resume PDFs directly.

### Academic Engine
Turns your Canvas course materials into an interactive study session.

- **Canvas scraping** — Connects to your authenticated carmen.osu.edu session via CDP, navigates to your course's Files tab, and downloads lecture slides (PDF/PPTX).
- **RAG pipeline** — Extracted text is chunked and stored in an in-memory LangChain vector store, enabling retrieval-augmented Q&A over your actual course content.
- **Study panel** — Displays AI-generated key concepts for the course and lets you ask free-form questions answered using your lecture slides as context.
- **5-question quiz** — GPT-4o generates a multiple-choice quiz from the course concepts. After submission, you receive a score, personalized feedback, and a 5-step study plan highlighting your weak areas.
- **Anki flashcards** — Generates front/back flashcard pairs from RAG content or the current browser page for spaced repetition review.

### Study Mode
A dedicated focus environment that activates when you need to eliminate distractions.

- **Site blocking** — Instructs Electron's main process to block 11 distraction domains (Reddit, YouTube, Twitter/X, Instagram, TikTok, Facebook, Twitch, Netflix, Hulu, Snapchat) via `will-navigate` intercept.
- **OSU resource panel** — Surfaces curated links to Carmen, OSU Libraries study rooms, BuckeyeLink tutoring, Piazza, and subject-specific resources.
- **Study session launcher** — Directly triggers the Academic Engine for a specific course without going through the chat flow.
- **AI study plan** — Generates and displays a 5-step action plan from lecture content once flashcards are produced.

### Lecture Notes (Notes Dashboard)
Records live lectures and converts them into persistent, searchable notes.

- **Live recording** — Uses the browser's `MediaRecorder` API to capture microphone audio directly in Electron (no file picker, no upload UI).
- **Transcription** — Sends the recorded `audio/webm` blob to Deepgram's nova-2 model via direct REST (`httpx`) with the correct `Content-Type` header, returning a clean transcript.
- **AI notes generation** — GPT-4o organizes the transcript into structured markdown: a 2–3 sentence summary, `##` key concept headings with bullet points, and a glossary of important terms.
- **Session management** — Every recording is saved to SQLite as a session with title (auto-derived from the first words of the transcript), transcript, notes, and timestamp. Sessions persist across app restarts.
- **Inline title editing** — Double-click any session title to rename it in place.
- **Follow-up Q&A** — Ask questions about any session; GPT-4o answers using the notes as primary context and the raw transcript as a supplement.

### SMS Agent
Allows Sayam to be used over text message via the Linq platform.

- **Webhook integration** — An ngrok tunnel is started on backend launch, a Linq webhook is registered, and incoming messages are HMAC-verified before processing.
- **Full state machine** — Supports multi-turn SMS conversations: intent detection, career/academic flows, quiz sessions (with answer tracking and scoring), and a STOP command to cancel running tasks.
- **Bidirectional display** — SMS messages appear inline in the main chat alongside desktop messages, visually tagged with an SMS badge.

### Chat Interface
The primary way to interact with Sayam.

- **Intent classification** — Keyword-based zero-latency router sends messages to the correct engine (career, academic, study mode, confirm/decline flows).
- **Thought boxes** — Agent execution steps stream in real time and can be expanded/collapsed inline in the chat.
- **Voice input** — Web Speech API (STT) fills the text input with spoken words; interim results update as you speak.
- **Text-to-speech** — Toggle TTS to have agent responses read aloud.
- **Stop button** — Cancels the currently running `asyncio.Task` mid-flight.
- **Collapsible sidebar** — The chat panel can be collapsed to a 48px icon strip to give more space to the browser.

### Embedded Browser
A native `WebContentsView` (Electron) renders full websites inside the app.

- The React overlay tracks the browser pane's exact bounds via `ResizeObserver`, keeping the native view perfectly synced.
- Quick-access toolbar buttons: **Carmen** (OSU Canvas), **Career** (opens Career Dashboard), **Notes** (opens Notes Dashboard).
- Standard browser controls: back, forward, reload/stop, URL bar with autocomplete.

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
│  │  career_engine  → browser-use + Playwright   │ │
│  │  academic_engine → Canvas scraper + RAG      │ │
│  │  notes_engine   → Deepgram + GPT-4o          │ │
│  │  study_mode_manager → Anki cards + blocking  │ │
│  │  sms_handler    → Linq webhook + ngrok        │ │
│  └─────────────────────────────────────────────┘ │
│         │ CDP localhost:9222                       │
│         ▼                                         │
│  WebContentsView (browser automation target)      │
└─────────────────────────────────────────────────┘
```

**Frontend:** Electron · React 18 · TypeScript · Vite · Framer Motion · Lucide React

**Backend:** Python 3.13 · FastAPI · uvicorn · SQLite · LangChain (RAG)

**AI:** OpenAI GPT-4o (notes, academics, tailoring) · GPT-4o-mini (parsing, study plans) · o3 (job application form-filling) · Deepgram nova-2 (transcription)

**Automation:** browser-use 0.11.11 · Playwright · CDP

**SMS:** Linq API · pyngrok

---

## Project Structure

```
IBMHack/
├── README.md
├── frontend/
│   ├── main.js                       # Electron main process, window management,
│   │                                 # CDP setup, site blocking, IPC handlers
│   └── src/
│       ├── App.tsx                   # Root component, WebSocket, mode state machine
│       ├── components/
│       │   ├── AgentBrowser.tsx      # Toolbar + WebContentsView bounds tracking
│       │   ├── CareerDashboard.tsx   # Job application tracker overlay
│       │   ├── NotesDashboard.tsx    # Lecture notes overlay (record → transcribe → notes)
│       │   ├── StudyModePage.tsx     # Focus mode full-page view
│       │   ├── StudyPanel.tsx        # Concepts list + RAG Q&A
│       │   ├── QuizView.tsx          # Multiple-choice quiz UI
│       │   ├── StudyResults.tsx      # Score + feedback + study plan
│       │   ├── FlashcardView.tsx     # Anki-style flip cards
│       │   ├── ProfileDrawer.tsx     # Resume upload + EEO fields sidebar
│       │   ├── OnboardingWizard.tsx  # First-run profile setup
│       │   └── SmsBadge.tsx          # "SMS" source tag on messages
│       └── hooks/
│           ├── useSpeechRecognition.ts   # Web Speech API STT
│           └── useTTS.ts                 # Browser TTS
└── backend/
    ├── main.py                   # FastAPI app, WebSocket handler, intent router
    ├── database.py               # SQLite schema + all DB query functions
    ├── career_engine.py          # SimplifyJobs scraping + browser-use application flow
    ├── resume_tailor.py          # GPT-4o resume tailoring → PDF generation
    ├── academic_engine.py        # Canvas navigation + PDF scraping + RAG ingestion
    ├── notes_engine.py           # Deepgram transcription (httpx) + GPT-4o notes + Q&A
    ├── study_mode_manager.py     # Site blocking state, OSU resources, Anki card generation
    ├── quiz_generator.py         # GPT-4o quiz + study plan generation
    ├── rag.py                    # LangChain in-memory vector store for course PDFs
    ├── sms_handler.py            # Linq webhook router + SMS state machine
    ├── ngrok_manager.py          # ngrok tunnel startup + webhook registration
    ├── scraper.py                # Canvas page scraping utilities
    ├── browser_agent.py          # browser-use Agent wrapper
    └── requirements.txt
```

---

## Setup

### Prerequisites
- Node.js 18+
- Python 3.11+

### 1. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create `backend/.env`:

```env
OPENAI_API_KEY=sk-...
OPENAI_ACADEMIC_MODEL=o3
DEEPGRAM_API_KEY=...
NGROK_AUTH_TOKEN=...
LINQ_API_TOKEN=...             # optional — only needed for SMS feature
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
On first launch, an onboarding wizard walks you through uploading your resume (PDF). The backend parses it with GPT-4o and populates your profile (name, email, GPA, skills, target roles). You must also complete the EEO fields before job applications can be submitted.

### Applying to Internships
1. Type *"Apply to SWE internships"* in the chat.
2. Sayam proposes an action plan — confirm with *"yes"* to proceed.
3. The backend scrapes SimplifyJobs, finds an open Greenhouse/Lever role, and asks whether to tailor your resume.
4. Confirm or decline tailoring, then watch the `browser-use` agent fill the form autonomously in the embedded browser.
5. Track the application in **Career Dashboard** (toolbar → CAREER).

### Studying for an Exam
1. Type *"I have an exam for CSE 3244"* — Sayam shows a course picker card.
2. Enter your course (e.g. `CSE 3244`), confirm to proceed.
3. Log into Carmen in the embedded browser when prompted.
4. The agent scrapes your lecture slides, builds a RAG index, and opens a Study Panel with key concepts.
5. Click **Start Quiz** for a 5-question exam, then review your personalized study plan.

### Study Mode (Focus)
Toggle the **Study** switch in the header (or type *"enter study mode"*) to block distractions and surface OSU resources. Use **Start a Study Session** inside Study Mode to launch the full academic flow without the chat.

### Recording Lecture Notes
1. Click **NOTES** in the browser toolbar.
2. Click **Record Lecture** — grant microphone access if prompted.
3. Speak (lecture, notes, anything). Click **Stop Recording**.
4. "Processing audio..." appears while Deepgram transcribes and GPT-4o generates notes.
5. The new session appears in the list. Click it to read the notes, view the raw transcript, or ask follow-up questions.
6. Double-click the session title to rename it.

### SMS (via Linq)
If `LINQ_API_TOKEN` is set, Sayam registers a webhook on startup. Text your Linq number with the same phrases you'd type in the chat. Responses and the student's incoming messages appear in the desktop chat as well, tagged with an SMS badge.

---

## Database Schema

SQLite file: `backend/sayam.db`

| Table | Description |
|---|---|
| `users` | Single-row profile: name, email, resume text, skills, EEO fields, etc. |
| `job_applications` | Submitted applications: company, role, URL, status, tailored resume path |
| `lecture_sessions` | Recorded lectures: title, transcript, notes, created\_at (no audio stored) |
| `study_sessions` | Canvas study sessions: course, concepts, questions, quiz score |
| `sms_sessions` | Per-chat-ID SMS state machine state |

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `WS` | `/ws` | Primary real-time channel (chat, thoughts, status, navigation) |
| `GET` | `/profile` | Fetch user profile |
| `POST` | `/update-profile` | Update profile fields |
| `GET` | `/profile/status` | Profile completeness check |
| `GET` | `/linq-config` | Fetch the configured Linq phone number |
| `POST` | `/upload-resume` | Parse resume PDF → update profile |
| `POST` | `/upload-transcript` | Upload academic transcript PDF |
| `GET` | `/job-applications` | List all tracked applications |
| `PATCH` | `/job-applications/{id}/status` | Update application status |
| `POST` | `/process-lecture-audio` | Transcribe audio + generate notes → new session |
| `GET` | `/lecture-sessions` | List all lecture sessions (id, title, date) |
| `GET` | `/lecture-sessions/{id}` | Full session with notes + transcript |
| `POST` | `/lecture-sessions/{id}/qa` | Ask a follow-up question about a session |
| `PATCH` | `/lecture-sessions/{id}/title` | Rename a session |
| `POST` | `/sms/webhook` | Linq incoming message webhook |

---

*Built to streamline student productivity by intelligently bridging native browser state with autonomous AI execution.*
