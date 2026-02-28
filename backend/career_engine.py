"""
Career Execution Engine
Phase 1: Pure Python HTTP scrape of SimplifyJobs README → find first Greenhouse/Lever URL (instant)
Phase 2: Browser-use agent fills the form (navigate → upload resume → wait → scrape fields + values → fill only blank/wrong → submit).

Other tools that can complement or replace browser-use for ATS form filling:
- Playwright (Python/Node): deterministic selectors per ATS (e.g. Lever/Greenhouse), no LLM; more reliable but requires maintaining selectors.
- Puppeteer: same idea in Node.
- Browser-use evaluate tool: run JS to read form state (e.g. input values) and pass to the agent for smarter “what to fill” decisions.
"""
import json
import asyncio
import os
import re
import httpx
from dotenv import load_dotenv
from database import save_job_application

load_dotenv()

SUPPORTED_ATS = {
    "greenhouse.io": "greenhouse",
    "lever.co": "lever",
    "ashbyhq.com": "ashby",
    "jobs.ashby.io": "ashby",
}

SIMPLIFY_README = "https://raw.githubusercontent.com/SimplifyJobs/Summer2026-Internships/dev/README.md"

# ── Demo override ─────────────────────────────────────────────────────────────
# Set to a job dict to skip scraping and always apply to this job.
# Set to None to re-enable live scraping.
DEMO_JOB: dict | None = {
    "company": "Sigma Computing",
    "role": "Software Engineering Intern",
    "apply_url": "https://job-boards.greenhouse.io/sigmacomputing/jobs/7639837003?utm_source=Simplify&ref=Simplify",
    "ats": "greenhouse",
}


# ── Phase 1: Instant Python HTTP Scrape ──────────────────────────────────────

def scrape_first_supported_job() -> dict | None:
    """
    Fetch the SimplifyJobs README (HTML table format) and return the first
    row whose Apply link goes to Greenhouse, Lever, or Ashby.
    Returns {company, role, apply_url, ats} or None.
    """
    try:
        resp = httpx.get(SIMPLIFY_README, timeout=10, follow_redirects=True)
        resp.raise_for_status()
        text = resp.text
    except Exception as e:
        print(f"[scraper] Failed to fetch README: {e}")
        return None

    # The README uses HTML table rows. Each job spans several lines:
    #   <td><strong><a href="...simplify...">Company</a></strong></td>
    #   <td>Role Title</td>
    #   <td>Location</td>
    #   <td><div ...><a href="APPLY_URL"><img ... alt="Apply"></a> ...
    #
    # Strategy: scan all lines. When we find a <td> that contains a
    # supported ATS URL in an <a href>, grab company & role from the
    # preceding lines in the same <tr> block.

    lines = text.splitlines()
    # Collect contiguous <tr> blocks
    in_row = False
    current_row: list[str] = []

    for line in lines:
        stripped = line.strip()
        if stripped == "<tr>":
            in_row = True
            current_row = []
        elif stripped == "</tr>":
            if in_row and current_row:
                result = _try_extract_job(current_row)
                if result:
                    return result
            in_row = False
            current_row = []
        elif in_row:
            current_row.append(stripped)

    return None


def _try_extract_job(row_lines: list[str]) -> dict | None:
    """Given the lines inside a <tr>, try to extract a supported job."""
    row_text = "\n".join(row_lines)

    # Look for a supported ATS URL in an href
    url_match = re.search(
        r'href="(https?://[^"]*(?:greenhouse\.io|lever\.co|ashbyhq\.com|jobs\.ashby\.io)[^"]*)"',
        row_text,
    )
    if not url_match:
        return None

    apply_url = url_match.group(1)

    # Detect ATS type
    ats_type = None
    for domain, name in SUPPORTED_ATS.items():
        if domain in apply_url:
            ats_type = name
            break
    if not ats_type:
        return None

    # Extract company name from first <td> (has <strong><a ...>Name</a></strong>)
    company_match = re.search(r'<a[^>]+>([^<]+)</a>\s*</strong>', row_text)
    company = company_match.group(1).strip() if company_match else "Company"

    # Extract role from second <td> (plain text cell: <td>Role Title</td>)
    # Find all plain <td>...</td> with no child tags
    plain_cells = re.findall(r'<td>([^<]+)</td>', row_text)
    role = plain_cells[0].strip() if plain_cells else "Software Engineer Intern"

    return {"company": company, "role": role, "apply_url": apply_url, "ats": ats_type}



# ── Phase 2: ATS Form Filling (browser-use) ─────────────────────────────────

def _build_task(job: dict, profile: dict, resume_path: str | None, transcript_path: str | None) -> str:
    name = profile.get("name", "N/A")
    first_name = name.split()[0] if name and name != "N/A" else "N/A"
    last_name = " ".join(name.split()[1:]) if name and len(name.split()) > 1 else "N/A"

    resume_line = f"Resume: {resume_path}" if resume_path else "No resume file available."
    transcript_line = f"Transcript (upload only if the form explicitly asks for it): {transcript_path}" if transcript_path else ""

    return f"""Fill out and submit this job application completely.

URL: {job['apply_url']}
Company: {job['company']} | Role: {job['role']}
The browser is ALREADY on the application page.

=== CANDIDATE INFO ===
First name: {first_name}
Last name: {last_name}
Email: type exactly the word   email_address   (auto-substituted)
Phone country: United States +1  ← fill this BEFORE the phone number field
Phone: type exactly the word   phone_number    (auto-substituted)
Location: {profile.get('location', 'N/A')}
University: {profile.get('university', 'N/A')}  ← type "Ohio State" to search
Degree: Bachelor's | Grad: May {profile.get('graduation_year', 'N/A')} | GPA: {profile.get('gpa', 'N/A')}
Work authorization: {profile.get('work_authorization') or 'US Citizen'}
H-1B sponsorship needed: No
Pronouns: He/Him  ← type "He" to search (the option is "He/ Him" with a space)
Gender: {profile.get('gender') or 'Male'}
Hispanic/Latino: No
Race: {profile.get('race_ethnicity') or 'Asian'}
Veteran: I am not a protected veteran
Disability: No disability
{resume_line}
{transcript_line}

=== RULES ===
1. Upload resume FIRST, wait 4 seconds for autofill, then only fill missing or wrong fields.
2. After typing "phone_number" or "email_address" the field looks blank — that is correct, DO NOT retype.
3. For every dropdown/combobox: click the field, type a short prefix, wait for suggestions to appear,
   then click the matching option. Never submit before all required fields are complete.
4. For graduation date: select the end month dropdown and click the suggestion BEFORE typing the end year.
"""


async def apply_to_job(job: dict, profile: dict, ws_broadcast, tailored_resume_path: str | None = None) -> str | None:
    """Browser-use agent fills the ATS form. Returns None on success, error string on failure."""
    try:
        from browser_use import Agent, Browser, ChatOpenAI, ChatGoogle

        sensitive_data = {}
        if profile.get("email"):
            sensitive_data["email_address"] = profile["email"]
        if profile.get("phone"):
            sensitive_data["phone_number"] = profile["phone"]

        file_paths = []
        # Use tailored resume if provided and file exists, otherwise fall back to original
        resume_path = (
            tailored_resume_path
            if (tailored_resume_path and os.path.exists(tailored_resume_path))
            else profile.get("resume_pdf_path")
        )
        transcript_path = profile.get("transcript_pdf_path")

        if resume_path and os.path.exists(resume_path):
            file_paths.append(resume_path)
        else:
            resume_path = None

        if transcript_path and os.path.exists(transcript_path):
            file_paths.append(transcript_path)
        else:
            transcript_path = None

        # ── Pre-navigate the embedded WebContentsView BEFORE connecting browser_use ──
        # This guarantees browser_use grabs the WebContentsView (on Lever) not the
        # React app window (on localhost) — eliminating the ghost-browser bug.
        # After the pre-navigate the CDP WS URL is stable (Lever doesn't cross-origin
        # navigate during form filling), so we never get ConnectionClosedError.
        await ws_broadcast(json.dumps({
            "type": "thought",
            "text": f"Opening {job['company']} application in browser..."
        }))
        await ws_broadcast(json.dumps({"type": "browser_navigate", "url": job["apply_url"]}))
        await asyncio.sleep(6)  # Let Electron load Lever and stabilise its CDP session

        # Poll until we find a non-localhost page target (= the WebContentsView on Lever)
        import requests as _rq
        cdp_ws_url = None
        for _ in range(6):
            try:
                targets = _rq.get("http://localhost:9222/json/list", timeout=2).json()
                target = next(
                    (t for t in targets
                     if t.get("type") == "page"
                     and not t.get("url", "").startswith("http://localhost")
                     and "devtools" not in t.get("url", "")),
                    None
                )
                if target:
                    cdp_ws_url = target["webSocketDebuggerUrl"]
                    await ws_broadcast(json.dumps({
                        "type": "thought",
                        "text": f"CDP connected to {target.get('url', 'page')[:60]}..."
                    }))
                    break
            except Exception:
                pass
            await asyncio.sleep(1)

        if not cdp_ws_url:
            # Last-resort fallback: browser-level endpoint (may still work if Electron
            # only has one non-React target at this point)
            cdp_ws_url = "http://localhost:9222"
            await ws_broadcast(json.dumps({
                "type": "thought",
                "text": "CDP fallback: using browser-level endpoint"
            }))

        browser = Browser(cdp_url=cdp_ws_url, no_viewport=True)

        task = _build_task(job, profile, resume_path, transcript_path)

        # Model selection — defaults to Gemini 3.1 Pro Preview.
        # Override via JOB_AGENT_MODEL env var.
        # Gemini models require GOOGLE_API_KEY; OpenAI models require OPENAI_API_KEY.
        model_name = os.environ.get("JOB_AGENT_MODEL", "gemini-3.1-pro-preview")
        if "gemini" in model_name.lower():
            llm = ChatGoogle(
                model=model_name,
                api_key=os.environ.get("GOOGLE_API_KEY"),
            )
        else:
            llm = ChatOpenAI(model=model_name, api_key=os.environ.get("OPENAI_API_KEY"))
        await ws_broadcast(json.dumps({"type": "thought", "text": f"Using {model_name}"}))

        # Broadcast each agent step's goal as a thought for live UI updates
        async def on_step(browser_state, agent_output, step_number: int) -> None:
            try:
                goal = getattr(getattr(agent_output, 'current_state', None), 'next_goal', None)
                if goal:
                    await ws_broadcast(json.dumps({
                        "type": "thought",
                        "text": f"Step {step_number + 1}: {goal}"
                    }))
            except Exception:
                pass

        initial_actions = [
            {"wait": {"seconds": 1}},
            {"evaluate": {"code": "document.getElementById('application-form')?.scrollIntoView({behavior:'instant',block:'start'})"}},
        ]

        agent = Agent(
            task=task,
            llm=llm,
            browser=browser,
            sensitive_data=sensitive_data if sensitive_data else None,
            available_file_paths=file_paths if file_paths else None,
            max_actions_per_step=10,
            use_vision=True,
            register_new_step_callback=on_step,
            directly_open_url=False,
            initial_actions=initial_actions,
            loop_detection_enabled=False,
        )

        result = await agent.run(max_steps=60)

        # Send agent's detailed result as a thought (visible in collapsed accordion)
        if result:
            detail = result.final_result() or ""
            if not isinstance(detail, str):
                detail = str(detail)
            import re as _re
            detail = _re.sub(r'\n*\[Simple judge:[^\]]*\]', '', detail).strip()
            detail = detail[:600]
            if detail:
                await ws_broadcast(json.dumps({
                    "type": "thought",
                    "text": detail
                }))

        return None  # success

    except Exception as e:
        return f"Application error for {job.get('company', 'job')}: {str(e)}"


# ── Orchestrator ──────────────────────────────────────────────────────────────

async def run_career_flow(
    profile: dict,
    ws_broadcast,
    job: dict | None = None,
    tailored_resume_path: str | None = None,
):
    try:
        await ws_broadcast(json.dumps({"type": "status", "text": "Executing"}))
        # Open a single agent bubble — all intermediates go in as thoughts
        await ws_broadcast(json.dumps({
            "type": "thought",
            "text": "Scanning SimplifyJobs for a Greenhouse or Lever internship..."
        }))

        # Phase 1: use provided job, demo override, or live scrape
        if job is None:
            if DEMO_JOB:
                job = DEMO_JOB
            else:
                job = await asyncio.get_event_loop().run_in_executor(None, scrape_first_supported_job)

        if not job:
            await ws_broadcast(json.dumps({
                "type": "agent_response",
                "text": "No open Greenhouse or Lever internship found on SimplifyJobs right now. Try again later."
            }))
            await ws_broadcast(json.dumps({"type": "status", "text": "Idle"}))
            return

        await ws_broadcast(json.dumps({
            "type": "thought",
            "text": f"Found: {job['company']} — {job['role']} ({job['ats'].title()})"
        }))
        await ws_broadcast(json.dumps({
            "type": "thought",
            "text": f"Starting {job['ats'].title()} application for {job['company']}..."
        }))

        # Phase 2: browser-use fills the form
        error = await apply_to_job(job, profile, ws_broadcast, tailored_resume_path=tailored_resume_path)

        if error:
            await ws_broadcast(json.dumps({
                "type": "agent_response",
                "text": error
            }))
        else:
            save_job_application(
                company=job["company"],
                role_title=job["role"],
                url=job["apply_url"],
                status="Applied",
                tailored_resume_path=tailored_resume_path,
            )
            await ws_broadcast(json.dumps({
                "type": "agent_response",
                "text": f"Application to **{job['company']}** — {job['role']} is complete."
            }))
        await ws_broadcast(json.dumps({"type": "status", "text": "Idle"}))

    except asyncio.CancelledError:
        raise
    except Exception as e:
        await ws_broadcast(json.dumps({
            "type": "agent_response",
            "text": f"Career flow error: {str(e)}"
        }))
        await ws_broadcast(json.dumps({"type": "status", "text": "Idle"}))
