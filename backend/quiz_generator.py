import json
import os
import openai
from dotenv import load_dotenv

load_dotenv()


async def generate_study_material(content: str, query: str) -> dict | None:
    """Generate concepts + quiz questions from scraped course content using GPT-4o."""
    try:
        client = openai.AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

        prompt = f"""You are an expert tutor. Based on the following course content and the student's query, generate comprehensive study material.

Student's query: "{query}"

Course content:
{content[:8000]}

Generate a JSON response with this exact structure:
{{
    "course_name": "Short course/topic name (e.g., 'Data Structures', 'Operating Systems')",
    "concepts": [
        {{
            "title": "Concept Name",
            "explanation": "Clear, concise explanation (2-4 sentences)",
            "key_points": ["point 1", "point 2", "point 3"]
        }}
    ],
    "questions": [
        {{
            "id": 1,
            "text": "Question text",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correct_index": 0,
            "explanation": "Why this answer is correct"
        }}
    ]
}}

Rules:
- Generate 5-8 key concepts with clear explanations
- Generate exactly 5 multiple-choice questions
- Questions should test understanding, not just memorization
- Each question must have exactly 4 options
- correct_index is 0-based
- Make explanations helpful for learning"""

        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            response_format={"type": "json_object"},
        )

        raw = response.choices[0].message.content.strip()
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
    """Generate personalized feedback and a 5-day study plan after quiz completion."""
    try:
        client = openai.AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

        concepts_text = "\n".join(f"- {c.get('title', '')}: {c.get('explanation', '')}" for c in concepts[:10])
        wrong_text = "\n".join(f"- {q.get('text', '')}" for q in wrong_questions[:10])

        prompt = f"""A student just completed a quiz for "{course_name}" and scored {score}/{total}.

Key concepts covered:
{concepts_text or "N/A"}

Questions they got wrong:
{wrong_text or "None — perfect score!"}

Generate a JSON response with:
{{
    "feedback": "2-3 sentence personalized feedback on their performance",
    "study_plan": [
        "Day 1 task",
        "Day 2 task",
        "Day 3 task",
        "Day 4 task",
        "Day 5 task"
    ]
}}

Rules:
- feedback should be encouraging but honest
- study_plan must have EXACTLY 5 items, one per day
- focus on weak areas from wrong questions
- tasks should be specific and actionable (30-60 min each)"""

        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
            response_format={"type": "json_object"},
        )

        raw = response.choices[0].message.content.strip()
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
