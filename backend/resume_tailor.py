"""
Resume tailoring module.
Fetches the job description from the apply URL, calls GPT-4o to minimally
rephrase existing resume bullets to highlight matching skills (no fabrication),
then renders the result as a clean PDF with reportlab.
"""
import os
import re
import json

import httpx
import openai
from bs4 import BeautifulSoup

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable


# ── Job Description Fetcher ───────────────────────────────────────────────────

async def fetch_job_description(apply_url: str) -> str:
    """Fetch the job posting page and return its cleaned text (max 8 000 chars)."""
    try:
        async with httpx.AsyncClient(timeout=12, follow_redirects=True) as client:
            resp = await client.get(
                apply_url,
                headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"},
            )
            soup = BeautifulSoup(resp.text, "lxml")
            for tag in soup(["script", "style", "nav", "footer", "header", "noscript"]):
                tag.decompose()
            return soup.get_text(" ", strip=True)[:8000]
    except Exception:
        return ""


# ── GPT-4o Tailoring ─────────────────────────────────────────────────────────

async def generate_tailored_content(
    resume_text: str,
    job_description: str,
    job: dict,
) -> dict:
    """
    Ask GPT-4o to produce a tailored resume JSON.
    Only experience/project bullets are rephrased — everything else is verbatim.
    """
    client = openai.AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

    job_context = (
        f"Job Description (scraped from posting):\n{job_description[:4000]}"
        if job_description.strip()
        else f"Role: {job['role']} at {job['company']}"
    )

    prompt = f"""You are a professional resume writer helping a student tailor their resume for a specific job application.

COMPANY: {job['company']}
ROLE: {job['role']}

{job_context}

ORIGINAL RESUME:
{resume_text[:4000]}

STRICT RULES:
1. Keep ALL personal info (name, email, phone, location) EXACTLY as in original.
2. Keep ALL dates, company names, and job titles EXACTLY as in original.
3. Keep the Education section EXACTLY as in original.
4. ONLY rephrase existing experience/project bullet points to better surface skills and keywords that match the job description. Do NOT add new accomplishments, metrics, or technologies the candidate did not mention.
5. You may reorder bullet points within a single job to put the most relevant first.
6. Keep bullets concise — do not expand them unnecessarily.

Return ONLY a valid JSON object with this exact structure (no markdown, no explanation):
{{
  "name": "Full Name",
  "email": "email@example.com",
  "phone": "555-555-5555",
  "location": "City, State",
  "sections": [
    {{
      "title": "EXPERIENCE",
      "type": "jobs",
      "entries": [
        {{
          "title": "Job Title",
          "company": "Company Name",
          "dates": "Jan 2024 – Present",
          "bullets": ["bullet 1", "bullet 2"]
        }}
      ]
    }},
    {{
      "title": "PROJECTS",
      "type": "jobs",
      "entries": [
        {{
          "title": "Project Name",
          "company": "",
          "dates": "2024",
          "bullets": ["bullet 1"]
        }}
      ]
    }},
    {{
      "title": "EDUCATION",
      "type": "education",
      "entries": [
        {{
          "degree": "B.S. Computer Science",
          "school": "Ohio State University",
          "dates": "2022 – 2026",
          "details": ["GPA: 3.8", "Relevant Coursework: Data Structures, Algorithms"]
        }}
      ]
    }},
    {{
      "title": "SKILLS",
      "type": "text",
      "content": "Python, Java, React, ..."
    }}
  ]
}}

Only include sections that exist in the original resume. Return only valid JSON."""

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        response_format={"type": "json_object"},
    )
    raw = response.choices[0].message.content.strip()
    return json.loads(raw)


# ── PDF Generation ────────────────────────────────────────────────────────────

def _sanitize(s: str) -> str:
    return re.sub(r"[^a-zA-Z0-9]", "_", s).strip("_")[:40]


def generate_pdf(content: dict, job: dict) -> str:
    """Render the tailored resume as a PDF. Returns the absolute file path."""
    company = _sanitize(job["company"])
    role = _sanitize(job["role"])
    filename = f"{company}_{role}.pdf"

    output_dir = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "uploads", "tailored_resumes"
    )
    os.makedirs(output_dir, exist_ok=True)
    pdf_path = os.path.join(output_dir, filename)

    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=letter,
        rightMargin=0.75 * inch,
        leftMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
    )

    # ── Styles ────────────────────────────────────────────────────────────────
    name_style = ParagraphStyle(
        "Name", fontName="Helvetica-Bold", fontSize=18, spaceAfter=3,
    )
    contact_style = ParagraphStyle(
        "Contact", fontName="Helvetica", fontSize=9, spaceAfter=8,
        textColor=colors.HexColor("#555555"),
    )
    section_header_style = ParagraphStyle(
        "SectionHeader", fontName="Helvetica-Bold", fontSize=10,
        spaceBefore=10, spaceAfter=3, textColor=colors.HexColor("#1a1a1a"),
    )
    entry_title_style = ParagraphStyle(
        "EntryTitle", fontName="Helvetica-Bold", fontSize=10, spaceAfter=1,
    )
    entry_sub_style = ParagraphStyle(
        "EntrySub", fontName="Helvetica-Oblique", fontSize=9, spaceAfter=2,
        textColor=colors.HexColor("#555555"),
    )
    bullet_style = ParagraphStyle(
        "Bullet", fontName="Helvetica", fontSize=9.5, spaceAfter=2,
        leftIndent=14, firstLineIndent=-8,
    )
    text_style = ParagraphStyle(
        "Text", fontName="Helvetica", fontSize=9.5, spaceAfter=4,
    )

    story = []

    # ── Header ────────────────────────────────────────────────────────────────
    name = content.get("name", "")
    contact_parts = [
        p for p in [
            content.get("email", ""),
            content.get("phone", ""),
            content.get("location", ""),
        ]
        if p
    ]
    if name:
        story.append(Paragraph(name, name_style))
    if contact_parts:
        story.append(Paragraph(" · ".join(contact_parts), contact_style))
    story.append(
        HRFlowable(width="100%", thickness=1.0, color=colors.HexColor("#333333"), spaceAfter=6)
    )

    # ── Sections ──────────────────────────────────────────────────────────────
    for section in content.get("sections", []):
        title = section.get("title", "")
        stype = section.get("type", "text")

        story.append(Paragraph(title, section_header_style))
        story.append(
            HRFlowable(width="100%", thickness=0.4, color=colors.HexColor("#cccccc"), spaceAfter=4)
        )

        if stype == "jobs":
            for entry in section.get("entries", []):
                entry_title = entry.get("title", "")
                entry_company = entry.get("company", "")
                entry_dates = entry.get("dates", "")
                if entry_title:
                    story.append(Paragraph(entry_title, entry_title_style))
                sub_parts = [p for p in [entry_company, entry_dates] if p]
                if sub_parts:
                    story.append(Paragraph(" | ".join(sub_parts), entry_sub_style))
                for bullet in entry.get("bullets", []):
                    story.append(Paragraph(f"• {bullet}", bullet_style))
                story.append(Spacer(1, 4))

        elif stype == "education":
            for entry in section.get("entries", []):
                degree = entry.get("degree", "")
                school = entry.get("school", "")
                dates = entry.get("dates", "")
                if degree:
                    story.append(Paragraph(degree, entry_title_style))
                sub_parts = [p for p in [school, dates] if p]
                if sub_parts:
                    story.append(Paragraph(" | ".join(sub_parts), entry_sub_style))
                for detail in entry.get("details", []):
                    story.append(Paragraph(f"• {detail}", bullet_style))
                story.append(Spacer(1, 4))

        elif stype == "text":
            text_content = section.get("content", "")
            if text_content:
                story.append(Paragraph(text_content, text_style))

    doc.build(story)
    return pdf_path


# ── Entry Point ───────────────────────────────────────────────────────────────

async def tailor_resume(profile: dict, job: dict, ws_broadcast=None) -> str:
    """
    Main entry point: tailor the user's resume for a specific job.
    Returns the absolute path to the generated PDF.
    """
    async def _thought(text: str):
        if ws_broadcast:
            await ws_broadcast(json.dumps({"type": "thought", "text": text}))

    await _thought(f"Fetching job description from {job['company']}...")
    job_description = await fetch_job_description(job["apply_url"])

    await _thought("Generating tailored resume content with GPT-4o...")
    tailored_content = await generate_tailored_content(
        resume_text=profile.get("resume_base_text", ""),
        job_description=job_description,
        job=job,
    )

    await _thought("Rendering tailored resume PDF...")
    pdf_path = generate_pdf(tailored_content, job)

    return pdf_path
