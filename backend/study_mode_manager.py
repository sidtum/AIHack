import json
import os
import openai
from dotenv import load_dotenv

load_dotenv()

# ── In-memory state ──────────────────────────────────────────────────────────
_study_mode_active = False

DISTRACTION_DOMAINS = [
    "reddit.com", "youtube.com", "twitter.com", "x.com",
    "instagram.com", "tiktok.com", "facebook.com", "twitch.tv",
    "netflix.com", "hulu.com", "snapchat.com",
]

# ── OSU resource templates (subject-agnostic fallbacks + dynamic ones) ───────
OSU_BASE_RESOURCES = [
    {
        "title": "Carmen (Canvas) — Course Forums & Announcements",
        "url": "https://carmen.osu.edu",
        "tag": "Canvas",
    },
    {
        "title": "OSU Libraries — Study Rooms & Resources",
        "url": "https://library.osu.edu/study-spaces",
        "tag": "Study Rooms",
    },
    {
        "title": "BuckeyeLink — Academic Support & Tutoring",
        "url": "https://buckeyelink.osu.edu",
        "tag": "Tutoring",
    },
    {
        "title": "OSU CSE Discord (unofficial student server)",
        "url": "https://discord.gg/osu-cse",
        "tag": "Discord",
    },
    {
        "title": "Piazza — Q&A for OSU Courses",
        "url": "https://piazza.com",
        "tag": "Q&A",
    },
]


def toggle_study_mode(enable: bool) -> bool:
    """Enable or disable study mode. Returns the new state."""
    global _study_mode_active
    _study_mode_active = enable
    return _study_mode_active


def is_study_mode_active() -> bool:
    return _study_mode_active


async def generate_anki_cards(page_text: str, subject: str = "") -> list[dict]:
    """
    Given raw page text, produce 5-8 Anki-style flashcards using GPT-4o.
    Each card: {"front": "question/term", "back": "answer/definition"}
    """
    try:
        client = openai.AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

        subject_hint = f' The subject area appears to be: "{subject}".' if subject else ""

        prompt = f"""You are a study assistant helping a student create flashcards.{subject_hint}

Based on the following web page content, generate 5-8 Anki-style flashcards that cover the most important concepts, definitions, or facts.

Page content:
{page_text[:6000]}

Return ONLY a valid JSON array with no markdown, no explanation:
[
  {{"front": "What is X?", "back": "X is ..."}},
  ...
]

Rules:
- fronts should be concise questions or terms (max 15 words)
- backs should be clear, self-contained answers (1-3 sentences)
- focus on key concepts, not trivia
- generate 5-8 cards total"""

        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.25,
            response_format={"type": "json_object"},
        )

        raw = response.choices[0].message.content.strip()
        # GPT json_object mode wraps in an object — handle both array and object
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            cards = parsed
        elif isinstance(parsed, dict):
            # Try common wrapper keys
            for key in ("cards", "flashcards", "items", "data"):
                if key in parsed and isinstance(parsed[key], list):
                    cards = parsed[key]
                    break
            else:
                # Attempt to extract any list value
                for v in parsed.values():
                    if isinstance(v, list):
                        cards = v
                        break
                else:
                    cards = []

        # Validate structure
        valid = [c for c in cards if isinstance(c, dict) and "front" in c and "back" in c]
        return valid[:8]

    except Exception as e:
        print(f"Anki card generation error: {e}")
        return []


async def find_osu_study_resources(subject: str) -> list[dict]:
    """
    Return a mix of static OSU resources plus AI-generated subject-specific ones.
    """
    resources = list(OSU_BASE_RESOURCES)

    if not subject.strip():
        return resources

    try:
        client = openai.AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

        prompt = f"""An OSU student is studying: "{subject}".

Suggest 2-3 additional online resources (could be OSU specific, or general academic resources like Khan Academy, MIT OpenCourseWare, etc.) that would be most helpful for this subject.

Return ONLY a valid JSON array:
[{{"title": "Resource Name", "url": "https://...", "tag": "Short tag"}}]

Keep URLs real and accurate. Prefer free resources."""

        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            response_format={"type": "json_object"},
        )

        raw = response.choices[0].message.content.strip()
        parsed = json.loads(raw)
        extras = []
        if isinstance(parsed, list):
            extras = parsed
        elif isinstance(parsed, dict):
            for v in parsed.values():
                if isinstance(v, list):
                    extras = v
                    break

        for r in extras:
            if isinstance(r, dict) and "title" in r and "url" in r:
                resources.append(r)

    except Exception as e:
        print(f"OSU resources generation error: {e}")

    return resources
