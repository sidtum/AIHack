import asyncio
import os
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), 'backend', '.env'))

from browser_use import Agent, Browser
from browser_use.llm.openai.chat import ChatOpenAI

async def run():
    print("Testing CDP Connection to localhost:9222...")
    llm = ChatOpenAI(model="gpt-4o")
    browser = Browser(
        cdp_url="http://localhost:9222"
    )
    
    agent = Agent(
        task="Navigate to example.com and extract the main heading text",
        llm=llm,
        browser=browser
    )
    result = await agent.run(max_steps=5)
    print("CDP SUCCESS! Result extracted:", result.extracted_content() if result else "None")

if __name__ == "__main__":
    asyncio.run(run())
