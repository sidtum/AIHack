import json
import os
from watsonx_client import wx_json
from dotenv import load_dotenv

load_dotenv()


async def generate_study_material(content: str, query: str) -> dict | None:
    """Generate concepts + quiz questions from scraped course content using IBM watsonx Granite."""
    try:
        prompt = f"""You are an expert tutor. Based on the following course content and the student query, generate comprehensive study material.

Student query: "{query}"

Course content:
{content[:8000]}

Generate a JSON response with this exact structure:
{{"course_name": "Short course/topic name", "concepts": [{{"title": "Concept Name", "explanation": "2-4 sentence explanation", "key_points": ["point 1", "point 2"]}}], "questions": [{{"id": 1, "text": "Question text", "options": ["A", "B", "C", "D"], "correct_index": 0, "explanation": "Why correct"}}]}}

Rules: 5-8 concepts, exactly 5 questions, 4 options each, correct_index is 0-based."""
        raw = await wx_json(prompt, max_tokens=1500)
        material = json.loads(raw)

        # Validate structure
        if "concepts" not in material or "questions" not in material:
            return None

        # Ensure course_name exists
        if "course_name" not in material:
            material["course_name"] = query.strip().title()

        return material

    except Exception as e:
        print(f"Quiz generation error: {e}")
        return None


async def generate_study_plan(concepts: list, wrong_questions: list, course_name: str, score: int, total: int) -> dict:
    """Generate personalized feedback and a 5-day study plan after quiz completion using IBM watsonx Granite."""
    try:
        concepts_text = "\n".join(f"- {c.get('title', '')}: {c.get('explanation', '')}" for c in concepts[:10])
        wrong_text = "\n".join(f"- {q.get('text', '')}" for q in wrong_questions[:10])
        prompt = f"""A student completed a quiz for "{course_name}" and scored {score}/{total}.

Concepts covered:
{concepts_text or 'N/A'}

Questions answered wrong:
{wrong_text or 'None - perfect score!'}

Generate a JSON response: {{"feedback": "2-3 sentence personalized feedback", "study_plan": ["Day 1 task", "Day 2 task", "Day 3 task", "Day 4 task", "Day 5 task"]}}

Rules: feedback honest but encouraging, study_plan EXACTLY 5 items, focus on weak areas, tasks specific and actionable."""
        raw = await wx_json(prompt, max_tokens=800)
        result = json.loads(raw)

        # Validate and pad study_plan to exactly 5 items
        plan = result.get("study_plan", [])
        while len(plan) < 5:
            plan.append(f"Day {len(plan) + 1}: Review key concepts and practice problems")
        result["study_plan"] = plan[:5]

        if "feedback" not in result:
            result["feedback"] = f"You scored {score}/{total}. Keep reviewing the material and you'll improve!"

        return result

    except Exception as e:
        print(f"Study plan generation error: {e}")
        # Fallback plan
        return {
            "feedback": f"You scored {score}/{total}. Great effort! Keep reviewing the material to strengthen your understanding.",
            "study_plan": [
                "Day 1: Review lecture notes and key concepts",
                "Day 2: Re-read textbook sections on weak topics",
                "Day 3: Practice problems and past exam questions",
                "Day 4: Group study or teaching concepts to a peer",
                "Day 5: Final review and timed practice test",
            ]
        }
