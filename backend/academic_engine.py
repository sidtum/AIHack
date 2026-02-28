import asyncio
import json
import os
from dotenv import load_dotenv

load_dotenv()

from rag import clear_rag



async def run_academic_flow(query: str, ws_broadcast, course_name: str = ""):
    """Full academic flow: Canvas -> scrape -> generate study material -> send to frontend."""
    course_label = course_name.strip() if course_name.strip() else "CSE 3244"
    try:
        clear_rag()
        await ws_broadcast(json.dumps({"type": "status", "text": "Accessing Canvas..."}))
        await ws_broadcast(json.dumps({
            "type": "thought",
            "text": "Opening carmen.osu.edu — Canvas session already saved."
        }))

        scraped_content = await scrape_canvas(query, ws_broadcast, course_label=course_label)

        if not scraped_content:
            await ws_broadcast(json.dumps({
                "type": "agent_response",
                "text": "I couldn't access Canvas or extract any content. Make sure you're logged in to Carmen in the browser pane, then try again."
            }))
            await ws_broadcast(json.dumps({"type": "status", "text": "Idle"}))
            return

        await ws_broadcast(json.dumps({"type": "status", "text": "Generating study material..."}))
        await ws_broadcast(json.dumps({
            "type": "thought",
            "text": "Sending scraped content to GPT-4o for concept extraction and quiz generation..."
        }))

        from quiz_generator import generate_study_material
        material = await generate_study_material(scraped_content, query)

        if not material:
            await ws_broadcast(json.dumps({
                "type": "agent_response",
                "text": "Failed to generate study material. Please try again."
            }))
            await ws_broadcast(json.dumps({"type": "status", "text": "Idle"}))
            return

        from database import save_study_session
        session_id = save_study_session(
            course_name=material["course_name"],
            content_raw=scraped_content[:10000],
            concepts_json=json.dumps(material["concepts"]),
            questions_json=json.dumps(material["questions"]),
        )

        await ws_broadcast(json.dumps({
            "type": "study_panel",
            "session_id": session_id,
            "course_name": material["course_name"],
            "concepts": material["concepts"],
            "questions": material["questions"],
            "content_raw": scraped_content[:5000],
        }))

        # Auto-generate flashcards, OSU resources, and study plan IN PARALLEL
        try:
            from study_mode_manager import generate_anki_cards, find_osu_study_resources
            from rag import add_to_rag
            import openai as _openai
            import os as _os

            # Kick off RAG embedding in background (doesn't need to block cards)
            asyncio.create_task(add_to_rag(scraped_content, material["course_name"]))

            await ws_broadcast(json.dumps({"type": "thought", "text": "Generating flashcards and study plan in parallel..."}))

            # Study plan helper (inline so we can await it in gather)
            async def _make_study_plan():
                try:
                    _client = _openai.AsyncOpenAI(api_key=_os.environ.get("OPENAI_API_KEY"))
                    _subject = material["course_name"]
                    _prompt = f"""You are a study coach. Based on the following lecture material for {_subject}, create a concise, actionable 5-step study plan.

Lecture material:
{scraped_content[:5000]}

Return ONLY a JSON object with key "steps" containing an array of exactly 5 steps, each with "step" (1-5) and "text" (one sentence, max 20 words, actionable):
{{"steps": [{{"step": 1, "text": "..."}}, ...]}}"""
                    _resp = await _client.chat.completions.create(
                        model="gpt-4o-mini",
                        messages=[{"role": "user", "content": _prompt}],
                        temperature=0.3,
                        response_format={"type": "json_object"},
                    )
                    import json as _json
                    _parsed = _json.loads(_resp.choices[0].message.content.strip())
                    _steps = _parsed.get("steps", [])
                    if _steps:
                        await ws_broadcast(_json.dumps({
                            "type": "study_plan",
                            "steps": _steps[:5],
                            "subject": _subject,
                        }))
                except Exception as _e:
                    print(f"Study plan generation error: {_e}")

            # Run all three concurrently
            cards, resources, _ = await asyncio.gather(
                generate_anki_cards(scraped_content[:8000], material["course_name"]),
                find_osu_study_resources(material["course_name"]),
                _make_study_plan(),
                return_exceptions=True,
            )

            if isinstance(cards, list) and cards:
                await ws_broadcast(json.dumps({
                    "type": "anki_cards",
                    "cards": cards,
                    "subject": material["course_name"],
                }))

            if isinstance(resources, list) and resources:
                await ws_broadcast(json.dumps({
                    "type": "osu_resources",
                    "resources": resources,
                }))

        except Exception as card_err:
            print(f"Auto card/plan generation error: {card_err}")

        await ws_broadcast(json.dumps({"type": "status", "text": "Study Mode"}))

    except asyncio.CancelledError:
        raise
    except Exception as e:
        await ws_broadcast(json.dumps({
            "type": "agent_response",
            "text": f"Academic flow error: {str(e)}"
        }))
        await ws_broadcast(json.dumps({"type": "status", "text": "Idle"}))


async def scrape_canvas(query: str, ws_broadcast, course_label: str = "CSE 3244") -> str:
    """Use browser-use to navigate Canvas and scrape course content.
    Connects to the embedded Electron WebContentsView via CDP."""
    try:
        from browser_use import Agent, Browser, Tools, ActionResult, BrowserSession

        tools = Tools()

        # 1. Navigate the embedded WebContentsView to Canvas first
        await ws_broadcast(json.dumps({"type": "browser_navigate", "url": "https://carmen.osu.edu"}))
        await asyncio.sleep(8)  # Give extra time for SSO redirect to settle

        # 2. Poll CDP for the non-localhost page target
        import requests as _rq
        cdp_ws_url = None
        target = None
        for _ in range(6):
            try:
                targets = _rq.get("http://localhost:9222/json/list", timeout=2).json()
                found = next(
                    (t for t in targets
                     if t.get("type") == "page"
                     and not t.get("url", "").startswith("http://localhost")
                     and "devtools" not in t.get("url", "")),
                    None
                )
                if found:
                    target = found
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
            cdp_ws_url = "http://localhost:9222"
            await ws_broadcast(json.dumps({
                "type": "thought",
                "text": "CDP fallback: using browser-level endpoint"
            }))

        # 3. Wait an extra moment for any SSO redirect to complete, then re-poll the settled URL
        await asyncio.sleep(3)
        try:
            settled_targets = _rq.get("http://localhost:9222/json/list", timeout=2).json()
            settled = next(
                (t for t in settled_targets
                 if t.get("type") == "page"
                 and not t.get("url", "").startswith("http://localhost")
                 and "devtools" not in t.get("url", "")),
                None
            )
            if settled:
                target = settled
                cdp_ws_url = target.get("webSocketDebuggerUrl", cdp_ws_url)
        except Exception:
            pass

        # 4. Detect Canvas/SSO login page and wait for user to sign in
        LOGIN_PATTERNS = ["login.microsoftonline.com", "shibboleth", "webauth", "login.osu.edu"]
        current_url = (target or {}).get("url", "")
        # Treat SSO pages AND the unauthenticated Carmen homepage (no path / just root) as needing login
        needs_login = any(pat in current_url for pat in LOGIN_PATTERNS)
        if target and needs_login:
            await ws_broadcast(json.dumps({
                "type": "waiting_for_login",
                "text": "Canvas requires sign-in. Please log in in the browser — I'll continue automatically."
            }))
            for _ in range(30):  # Poll every 3s for up to 90s
                await asyncio.sleep(3)
                try:
                    targets = _rq.get("http://localhost:9222/json/list", timeout=2).json()
                    current_target = next(
                        (t for t in targets
                         if t.get("type") == "page"
                         and not t.get("url", "").startswith("http://localhost")
                         and "devtools" not in t.get("url", "")),
                        None
                    )
                    if current_target:
                        url = current_target.get("url", "")
                        if not any(pat in url for pat in LOGIN_PATTERNS):
                            cdp_ws_url = current_target["webSocketDebuggerUrl"]
                            await ws_broadcast(json.dumps({
                                "type": "thought",
                                "text": "Login detected — resuming Canvas scrape."
                            }))
                            break
                except Exception:
                    pass

        browser = Browser(cdp_url=cdp_ws_url, no_viewport=True)

        @tools.action("Navigate to URL and sync with frontend browser")
        async def navigate_to(url: str, browser_session: BrowserSession) -> ActionResult:
            page = await browser_session.get_current_page()
            await page.goto(url, wait_until="domcontentloaded", timeout=15000)
            await ws_broadcast(json.dumps({"type": "browser_navigate", "url": page.url}))
            return ActionResult(extracted_content=f"Navigated to {page.url}")

        @tools.action("Extract the course syllabus including the Tentative Schedule table")
        async def extract_syllabus(browser_session: BrowserSession) -> ActionResult:
            """Reads the syllabus page. Canvas embeds syllabus body inside an iframe — this action reads through it."""
            page = await browser_session.get_current_page()
            try:
                content = await page.evaluate("""() => {
                    // Canvas puts the syllabus HTML body inside an iframe
                    const frames = Array.from(document.querySelectorAll('iframe'));
                    for (const frame of frames) {
                        try {
                            if (frame.contentDocument && frame.contentDocument.body) {
                                const text = frame.contentDocument.body.innerText;
                                if (text.includes('Lecture') || text.includes('Schedule')) return text;
                            }
                        } catch (e) {}
                    }
                    // Fallback: main syllabus container div
                    const div = document.querySelector('#course_syllabus');
                    if (div) return div.innerText;
                    // Last resort: full page text
                    return document.body.innerText.substring(0, 6000);
                }""")
                if content and len(content.strip()) > 100:
                    return ActionResult(extracted_content=f"Syllabus content:\n{content[:5000]}")
                return ActionResult(error="Syllabus content not found or was empty.")
            except Exception as e:
                return ActionResult(error=f"extract_syllabus failed: {str(e)}")

        @tools.action("download_canvas_file")
        async def download_canvas_file(filename: str, browser_session: BrowserSession) -> ActionResult:
            """Finds a Canvas file by name, downloads it via authenticated request, extracts PDF text, adds to RAG."""
            page = await browser_session.get_current_page()
            try:
                import pdfplumber
                from rag import add_to_rag

                os.makedirs("./uploads", exist_ok=True)

                from bs4 import BeautifulSoup
                from urllib.parse import urlparse

                # page.content() does not exist in browser-use 0.11 — use evaluate instead
                raw_html = await page.evaluate("() => document.documentElement.outerHTML")
                soup = BeautifulSoup(raw_html, 'html.parser')

                href = None
                lower = filename.lower()
                base_search = lower.replace('.pdf', '').replace('.pptx', '')

                # Get current page URL (page.url is not a property — use async get_url())
                current_url = await page.get_url()
                parsed_current = urlparse(current_url)
                origin = f"{parsed_current.scheme}://{parsed_current.netloc}"

                for a in soup.find_all('a', href=True):
                    link_text = a.get_text(strip=True).lower()
                    title = (a.get('title') or a.get('aria-label') or '').lower()
                    raw_href = a['href']
                    link_href = raw_href.lower()

                    if lower in link_text or base_search in link_text or base_search in title or base_search in link_href:
                        href = raw_href
                        # Canvas relative links need the origin prepended
                        if href.startswith('/'):
                            href = origin + href
                        break

                if not href:
                    return ActionResult(error=f"No link found for '{filename}'. Ensure you are inside the Lecture Slides folder.")

                # Append Canvas forced-download param
                sep = "&" if "?" in href else "?"
                dl_url = href + sep + "download_frd=1"

                import requests
                
                # Fetch cookies and UA to authenticate the request
                cookies_list = await browser_session.cookies()
                cookies = {c["name"]: c["value"] for c in cookies_list}
                user_agent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36"
                
                def fetch_file():
                    return requests.get(
                        dl_url,
                        cookies=cookies,
                        headers={"User-Agent": user_agent},
                        allow_redirects=True,
                        timeout=30
                    )
                
                response = await asyncio.to_thread(fetch_file)
                if response.status_code not in (200, 206):
                    return ActionResult(error=f"HTTP {response.status_code} when downloading '{filename}' from {dl_url}")

                body = response.content
                save_name = filename if any(filename.lower().endswith(e) for e in (".pdf", ".pptx", ".ppt")) else filename + ".pdf"
                path = f"./uploads/{save_name}"
                with open(path, "wb") as f:
                    f.write(body)

                pdf_text = ""
                if path.endswith(".pdf"):
                    try:
                        with pdfplumber.open(path) as pdf:
                            for p in pdf.pages:
                                t = p.extract_text()
                                if t:
                                    pdf_text += t + "\n"
                    except Exception as parse_err:
                        return ActionResult(extracted_content=f"Saved '{save_name}' ({len(body)} bytes) but PDF parse failed: {parse_err}")

                if pdf_text.strip():
                    await add_to_rag(pdf_text, filename)
                    return ActionResult(extracted_content=f"Downloaded '{save_name}' — extracted {len(pdf_text)} chars and added to knowledge base.")
                else:
                    return ActionResult(extracted_content=f"Saved '{save_name}' ({len(body)} bytes). No text extracted (may be image-based PDF).")

            except Exception as e:
                return ActionResult(error=f"download_canvas_file('{filename}') error: {str(e)}")

        from browser_use import ChatOpenAI

        model = os.environ.get("OPENAI_ACADEMIC_MODEL", "gpt-4o")
        llm = ChatOpenAI(model=model, api_key=os.environ.get("OPENAI_API_KEY"))

        task_prompt = f"""You are helping an OSU student prep for their {course_label} exam. Goal: "{query}"

The Canvas dashboard is already open and the student is logged in. Do NOT navigate to any new page — start directly from what is on screen:

1. Find and click the {course_label} course card on the dashboard.
2. You will land on the Syllabus page. Call extract_syllabus — look for a schedule table listing lecture topics.
3. Click "Files" in the left sidebar, then click the "Lecture Slides" folder.
4. Download the most relevant lecture slide files for the upcoming exam using the download_canvas_file tool.
5. Return a summary of: exam topics from the schedule + which files were downloaded.

Stop immediately if you see a login form — call done(success=False, message="Canvas login required")."""

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

        agent = Agent(
            task=task_prompt,
            llm=llm,
            browser=browser,
            tools=tools,
            register_new_step_callback=on_step,
        )

        await ws_broadcast(json.dumps({
            "type": "thought",
            "text": "Agent started. Navigating to Canvas..."
        }))

        result = await agent.run(max_steps=40)

        final_result = result.final_result() if result else ""

        # Detect login/auth failure — return "" so run_academic_flow can handle it cleanly
        LOGIN_FAILURE_KEYWORDS = [
            "login required", "credentials", "log in first", "please log in",
            "sign in", "authentication", "not logged in", "unable to access",
            "login page", "log in to canvas",
        ]
        if final_result and any(kw in final_result.lower() for kw in LOGIN_FAILURE_KEYWORDS):
            await ws_broadcast(json.dumps({
                "type": "thought",
                "text": "Canvas login required — could not access course content."
            }))
            return ""

        extracted = result.extracted_content() if result else []
        content = "\n\n".join(str(item) for item in extracted if item)
        if not content.strip():
            content = final_result

        await ws_broadcast(json.dumps({
            "type": "thought",
            "text": f"Canvas scraping complete. Extracted {len(content)} characters."
        }))

        return content

    except asyncio.CancelledError:
        raise  # Let cancellations propagate
    except Exception as e:
        err_msg = str(e)
        await ws_broadcast(json.dumps({
            "type": "thought",
            "text": f"Canvas scraping error: {err_msg[:300]}"
        }))
        await ws_broadcast(json.dumps({
            "type": "agent_response",
            "text": f"Canvas automation error: {err_msg[:200]}\n\nMake sure Carmen is open and you're logged in, then try again."
        }))
        return ""
