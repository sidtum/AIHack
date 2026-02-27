# Reproduce the exact error path: instantiate BrowserSession, call download_canvas_file manually
import asyncio
import sys

async def test():
    from browser_use.browser.session import BrowserSession
    
    # Check what methods BrowserSession actually has
    print("BrowserSession methods:")
    for m in dir(BrowserSession):
        if not m.startswith("__"):
            print(f"  {m}")

asyncio.run(test())
