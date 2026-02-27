#!/usr/bin/env python3
"""
Run the career flow and print every WebSocket-style message to stdout.
Usage: from backend/ run:  python scripts/test_career_flow.py
Requires: .env with OPENAI_API_KEY, sayam.db with profile (name, email, resume_pdf_path, EEO fields).
If o3 hits 429 (token limit), run with: OPENAI_JOB_AGENT_MODEL=gpt-4o python scripts/test_career_flow.py
"""
import asyncio
import json
import os
import sys
from datetime import datetime

# Run from backend so imports work
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.getcwd())

from dotenv import load_dotenv
load_dotenv()

from database import init_db, get_user_profile


def _log(msg: str):
    ts = datetime.now().strftime("%H:%M:%S")
    try:
        data = json.loads(msg)
        msg_type = data.get("type", "?")
        text = data.get("text", data.get("thought", str(data)))[:200]
        print(f"[{ts}] [{msg_type}] {text}")
    except Exception:
        print(f"[{ts}] {msg[:150]}")


async def ws_broadcast(message: str):
    _log(message)


def main():
    init_db()
    profile = get_user_profile()
    if not profile:
        print("No profile in DB. Add a user (id=1) with name, email, resume_pdf_path, and EEO fields.")
        return 1
    missing = []
    for k in ["email", "name", "resume_pdf_path"]:
        if not profile.get(k):
            missing.append(k)
    for k in ["gender", "race_ethnicity", "veteran_status", "disability_status", "work_authorization"]:
        if not profile.get(k):
            missing.append(k)
    if missing:
        print("Profile missing:", missing)
        print("Current profile keys:", list(profile.keys()))
        return 1
    if not os.path.exists(profile.get("resume_pdf_path", "")):
        print("Resume file not found:", profile.get("resume_pdf_path"))
        return 1
    print("Profile OK. Starting career flow (browser will open)...")
    print("-" * 60)
    asyncio.run(run_flow(profile))
    print("-" * 60)
    print("Career flow finished.")
    return 0


async def run_flow(profile):
    from career_engine import run_career_flow
    await run_career_flow(profile, ws_broadcast)


if __name__ == "__main__":
    sys.exit(main())
