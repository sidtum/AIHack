"""
Notes Engine
Transcribes lecture audio via Deepgram (nova-2 prerecorded),
generates organized markdown notes via GPT-4o,
and answers follow-up Q&A using the notes as context.
Audio bytes are processed in memory — nothing is written to disk.
"""
import os
import httpx
from google import genai
from google.genai import types

async def transcribe_audio(audio_bytes: bytes, mimetype: str) -> str:
    """
    Send audio bytes to Deepgram REST API for transcription.
    Uses httpx directly so we can set Content-Type explicitly — the
    deepgram-sdk v6 does not forward the MIME type and Deepgram rejects the request.
    """
    api_key = os.environ["DEEPGRAM_API_KEY"]
    content_type = mimetype or "audio/webm"

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            "https://api.deepgram.com/v1/listen",
            headers={
                "Authorization": f"Token {api_key}",
                "Content-Type": content_type,
            },
            params={
                "model": "nova-2",
                "smart_format": "true",
                "punctuate": "true",
            },
            content=audio_bytes,
        )
        resp.raise_for_status()
        data = resp.json()

    channels = data.get("results", {}).get("channels", [])
    if not channels:
        return ""
    transcript = channels[0]["alternatives"][0].get("transcript", "")
    return transcript.strip()


async def generate_notes(transcript: str, title: str) -> str:
    """
    Ask Gemini to generate clean, organized markdown notes from a transcript.
    Returns a markdown string.
    """
    client = genai.Client(api_key=os.environ.get("GOOGLE_API_KEY"))

    prompt = (
        f"Lecture title: {title}\n\nTranscript:\n{transcript[:8000]}"
    )

    system_instruction = (
        "You are a lecture note-taking assistant. Given a lecture transcript, produce clean organized notes in markdown with:\n"
        "1. A short **Summary** paragraph (2–3 sentences).\n"
        "2. **Key Concepts** — bold headings (##) for each concept with bullet points underneath.\n"
        "3. **Important Terms/Definitions** — a brief glossary at the end if applicable.\n"
        "Be concise. Use markdown headings, bold, and bullet points."
    )

    response = await client.aio.models.generate_content(
        model="gemini-3-pro-preview",
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=0.3,
        )
    )
    return response.text.strip() if response.text else ""


async def answer_question(question: str, notes: str, transcript: str) -> str:
    """
    Answer a follow-up question using the session's notes as primary context.
    Falls back to the raw transcript if notes are empty.
    """
    client = genai.Client(api_key=os.environ.get("GOOGLE_API_KEY"))

    context = notes if notes and notes.strip() else transcript[:6000]
    supplement = transcript[:3000] if notes and notes.strip() else ""

    system_instruction = (
        "You are a helpful tutor. Answer the student's question using the lecture notes below. "
        "Be clear, concise, and use examples from the lecture when relevant.\n\n"
        f"## Lecture Notes:\n{context}"
    )
    if supplement:
        system_instruction += f"\n\n## Raw Transcript (supplemental):\n{supplement}"

    response = await client.aio.models.generate_content(
        model="gemini-3-pro-preview",
        contents=question,
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=0.4,
        )
    )
    return response.text.strip() if response.text else ""
