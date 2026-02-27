import asyncio
from browser_use import Agent, Browser, Tools, ActionResult
from browser_use.agent.service import Agent as ServiceAgent

tools = Tools()

@tools.action("Download Canvas File by Text")
async def download_canvas_file(filename: str) -> ActionResult:
    print(f"Executing: download_canvas_file(filename={filename})")
    return ActionResult(extracted_content=f"Mock downloaded {filename}")

async def main():
    browser = Browser()
    from langchain_openai import ChatOpenAI
    from langchain_core._api.deprecation import suppress_langchain_deprecation_warning
    with suppress_langchain_deprecation_warning():
        llm = ChatOpenAI(model="gpt-4o-mini", api_key="dummy")
        
    task_prompt = "Call the 'Download Canvas File by Text' tool exactly once, providing the 'filename' parameter as 'L2-CSE3244.pdf'."
    agent = Agent(task=task_prompt, llm=llm, tools=tools, browser=browser)
    try:
        await agent.run(max_steps=2)
    except Exception as e:
        print(f"Agent run failed: {e}")

if __name__ == "__main__":
    asyncio.run(main())
