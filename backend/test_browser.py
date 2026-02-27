import asyncio
from browser_use import Agent, Browser, Tools, ActionResult
from browser_use import ChatOpenAI

tools = Tools()

@tools.action("Test action")
async def test_action(browser_session) -> ActionResult:
    print("Browser Session Type:", type(browser_session))
    print("Dir BrowserSession:", dir(browser_session))
    page = await browser_session.get_current_page()
    print("Page Type:", type(page))
    try:
        print("Does page have context?", hasattr(page, 'context'))
        print("Page Context Type:", type(page.context))
    except Exception as e:
        print("Error accessing context:", e)
    return ActionResult(extracted_content="Tested by me")

async def main():
    browser = Browser()
    llm = ChatOpenAI(model="gpt-4o-mini")
    agent = Agent(task="Call 'Test action'", llm=llm, tools=tools, browser=browser)
    await agent.run(max_steps=2)

if __name__ == "__main__":
    asyncio.run(main())
