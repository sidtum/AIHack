import asyncio
from browser_use import Agent, Browser, Tools, ActionResult
from browser_use.browser.session import BrowserSession
from langchain_openai import ChatOpenAI

tools = Tools()

@tools.action("download_canvas_file")
async def download_canvas_file(filename: str, browser_session: BrowserSession) -> ActionResult:
    page = await browser_session.get_current_page()
    try:
        # Instead of evaluation, try checking the page object directly
        html = await page.content()
        print(f"Page content length: {len(html)}")
        
        # Test simplified evaluation for UA
        ua = await page.evaluate("navigator.userAgent")
        print(f"UA: {ua}")
        return ActionResult(extracted_content=f"Evaluated")
    except Exception as e:
        print(f"ERROR: {e}")
        return ActionResult(error=str(e))

async def main():
    browser = Browser()
    from langchain_core._api.deprecation import suppress_langchain_deprecation_warning
    with suppress_langchain_deprecation_warning():
        llm = ChatOpenAI(model="gpt-4o-mini", api_key="test")
        
    task_prompt = "Call download_canvas_file with filename 'L2-CSE3244-cloud-pros-cons.pdf'"
    agent = Agent(task=task_prompt, llm=llm, tools=tools, browser=browser)
    try:
        await agent.run(max_steps=1)
    except Exception as e:
        print(f"Agent run failed: {e}")

if __name__ == "__main__":
    asyncio.run(main())
