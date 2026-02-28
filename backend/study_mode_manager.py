import json
import os
from watsonx_client import wx_json
from dotenv import load_dotenv

load_dotenv()

# ── In-memory state ──────────────────────────────────────────────────────────
_study_mode_active = False

DISTRACTION_DOMAINS = [
    "reddit.com", "youtube.com", "twitter.com", "x.com",
    "instagram.com", "tiktok.com", "facebook.com", "twitch.tv",
    "netflix.com", "hulu.com", "snapchat.com",
]

# ── IBM SkillsBuild courses (IBM hackathon showcase + always-relevant resources)
IBM_SKILLSBUILD_BASE = [
    {
        "title": "IBM SkillsBuild — Explore All Courses",
        "url": "https://skillsbuild.org/students/course-catalog",
        "tag": "IBM SkillsBuild",
    },
    {
        "title": "IBM SkillsBuild — AI Fundamentals",
        "url": "https://skillsbuild.org/students/digital-credentials/artificial-intelligence-fundamentals",
        "tag": "AI",
    },
    {
        "title": "IBM SkillsBuild — Data Science Foundations",
        "url": "https://skillsbuild.org/students/digital-credentials/data-science-foundations",
        "tag": "Data Science",
    },
    {
        "title": "IBM SkillsBuild — Cybersecurity Fundamentals",
        "url": "https://skillsbuild.org/students/digital-credentials/cybersecurity-fundamentals",
        "tag": "Cybersecurity",
    },
    {
        "title": "IBM SkillsBuild — Cloud Computing Fundamentals",
        "url": "https://skillsbuild.org/students/digital-credentials/cloud-computing-fundamentals",
        "tag": "Cloud",
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

        raw = await wx_json(prompt, max_tokens=900)
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
    resources = list(IBM_SKILLSBUILD_BASE)

    if not subject.strip():
        return resources

    try:
        prompt = f"""An OSU student is studying: "{subject}".

Suggest 2-3 relevant IBM SkillsBuild courses from skillsbuild.org that match this subject.
Only suggest real courses that exist on IBM SkillsBuild — do not invent URLs.
All URLs must start with https://skillsbuild.org/.

Return ONLY a valid JSON array:
[{{"title": "IBM SkillsBuild — Course Name", "url": "https://skillsbuild.org/...", "tag": "Short tag"}}]

If no IBM SkillsBuild course is a good match, return an empty array []"""

        raw = await wx_json(prompt, max_tokens=400)
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
                url = r.get("url", "")
                # Only add if URL is a SkillsBuild link (guards against hallucination)
                if "skillsbuild.org" in url:
                    if not any(existing["url"] == url for existing in resources):
                        resources.append(r)

    except Exception as e:
        print(f"IBM SkillsBuild resources generation error: {e}")

    return resources
