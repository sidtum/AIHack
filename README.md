# Sayam - Siddarth Tummala

Sayam is an intelligent AI browser designed specifically for students to automate time-consuming tasks like applying for internships and studying for classes. Built with a combination of Electron, React, FastAPI, and Agentic Browser Automation, Sayam acts as a personalized assistant that operates directly within your browser session.

## Core Features

Sayam is composed of two primary engines:

### 1. Career Engine (Internship Automation)
The Career Engine automates the grueling process of applying to software engineering internships.
- **Job Sourcing:** Automatically scrapes the popular [SimplifyJobs/Summer2026-Internships](https://github.com/SimplifyJobs/Summer2026-Internships) repository for the latest open roles.
- **Smart Filtering:** Identifies applications hosted on supported ATS platforms like Greenhouse, Lever, and Ashby.
- **Agentic Application:** Uses the `browser-use` library and OpenAI's `o3` models to automatically navigate to the application URL, upload your resume, wait for ATS autofill, parse missing form fields, and intelligently answer required EEO/Demographic and custom questions based on your profile.

### 2. Academic Engine (Study Automation)
The Academic Engine turns Canvas course materials into interactive study sessions.
- **Canvas Integration:** Leverages CDP (Chrome DevTools Protocol) to navigate your authenticated Canvas session (e.g., carmen.osu.edu) inside the Electron webview.
- **Content Scraping:** Automatically finds your course, extracts syllabus details (Tentative Schedules), navigates to the "Files" tab, and downloads relevant lecture slides (PDF/PPTX).
- **AI Tutoring:** Extracts text from downloaded files using `pdfplumber` and chunks it into a Retrieval-Augmented Generation (RAG) pipeline.
- **Interactive Study Mode:** Uses `gpt-4o` to generate key concepts, custom flashcards, and a 5-question quiz. A built-in study panel lets you ask questions about the material and receive context-aware answers.

## Architecture

Sayam features a modern, decoupled architecture:

### Frontend (User Interface & Browser Window)
- **Framework:** React + TypeScript + Vite.
- **Desktop Container:** Electron ensures the application runs as an isolated desktop environment containing an embedded native browser view (`WebContentsView`).
- **Styling & Animations:** Tailwind CSS and Framer Motion provide a highly polished, aesthetic, and dynamic user experience with interactive chats, thought bubbles, and slide-over panels.
- **Hardware Integration:** Support for Voice input/output out of the box (Speech-to-Text and Text-to-Speech hooks).

### Backend (AI & Automation Services)
- **Framework:** Python FastAPI.
- **Real-Time Communication:** WebSockets (`/ws`) maintain a persistent, bidirectional channel with the frontend, broadcasting agent thoughts, status updates, and browser navigation commands.
- **Agentic Automation:** `browser-use` securely connects to the Electron embedded browser via CDP (`localhost:9222`), allowing the AI to read the DOM and perform actions seamlessly without interrupting the user.
- **Database:** SQLite (`sayam.db`) stores user profiles, EEO data, uploaded resumes, and historical study sessions.
- **LLMs:** Integration with standard OpenAI models (`gpt-4o-mini` for basic parsing, `gpt-4o` for academic generation, `o3` for robust form-filling).

## Setup & Installation

### Prerequisites
- Node.js (for the frontend and Electron)
- Python 3.11+ (for the backend)
- `uv` package manager (recommended for Python environment)

### 1. Backend Setup
1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   uv venv --python 3.11
   source .venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   uv pip install -r requirements.txt
   # (Ensure browser-use, fastapi, uvicorn, pdfplumber, httpx, etc., are installed)
   ```
4. Configure Environment Variables:
   Create a `.env` file in the `backend` directory and add:
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   OPENAI_JOB_AGENT_MODEL=o3-mini
   OPENAI_ACADEMIC_MODEL=gpt-4o
   ```
5. Run the Backend Server:
   ```bash
   uvicorn main:app --host 127.0.0.1 --port 8000
   ```

### 2. Frontend Setup
1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Development Server & Electron App:
   ```bash
   npm run dev
   # Or depending on the package.json scripts, you may need to run `npm run electron:dev`
   ```

## Usage Workflow

1. **Onboarding:** When you first open Sayam, you'll be prompted to provide basic details and upload your Resume. The backend uses AI to parse your resume into structured JSON.
2. **Career Mode:** Type something like *"Apply to SWE internships"*. The backend will fetch the SimplifyJobs list, locate a Greenhouse/Lever ATS form, navigate the embedded browser to the application, and autonomously complete and submit it.
3. **Academic Mode:** Type something like *"I have an exam tomorrow for CSE 3244"*. The agent connects to your active Canvas session, scrapes the lecture files, and transitions the app into **Study Mode**, generating a real-time quiz and flashcards while allowing you to ask questions about the slides.

---
*Built to streamline student productivity by intelligently bridging native browser states with autonomous AI execution.*
