import asyncio
from browser_use import Agent, Browser, Tools, ActionResult
from browser_use.browser.session import BrowserSession

tools = Tools()

@tools.action("Download Canvas File by Text")
async def download_canvas_file(filename: str, browser_session: BrowserSession) -> ActionResult:
    print(f"Executing: download_canvas_file(filename={filename})")
    return ActionResult(extracted_content=f"Mock downloaded {filename}")

def main():
    print(tools.get_tools())
    
main()
