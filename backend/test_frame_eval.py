import asyncio
from browser_use import Agent, Browser, Tools, ActionResult
from browser_use.browser.session import BrowserSession
from langchain_openai import ChatOpenAI

tools = Tools()

@tools.action("download_canvas_file")
async def download_canvas_file(filename: str, browser_session: BrowserSession) -> ActionResult:
    page = await browser_session.get_current_page()
    print("PAGE DIR:", dir(page))
    try:
        # Check if the error is due to frame attachment state
        print(f"Executing simple evaluation")
        result = await page.evaluate("1 + 1")
        print(f"Result: {result}")
        return ActionResult(extracted_content=f"Evaluated to {result}")
    except Exception as e:
        print(f"ERROR: {e}")
        return ActionResult(error=str(e))

async def main():
    browser = Browser()
    from langchain_core._api.deprecation import suppress_langchain_deprecation_warning
    with suppress_langchain_deprecation_warning():
        llm = ChatOpenAI(model="gpt-4o-mini", api_key="dummy")
        
    task_prompt = "Call download_canvas_file with filename 'L2-CSE3244-cloud-pros-cons.pdf'"
    agent = Agent(task=task_prompt, llm=llm, tools=tools, browser=browser)
    try:
        await agent.run(max_steps=2)
    except Exception as e:
        print(f"Agent run failed: {e}")

if __name__ == "__main__":
    asyncio.run(main())
