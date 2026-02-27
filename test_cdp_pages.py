import asyncio
import requests
from playwright.async_api import async_playwright

async def main():
    r = requests.get("http://localhost:9222/json/list")
    targets = r.json()
    webview_target = next((t for t in targets if t.get('type') == 'webview'), None)
    
    if not webview_target:
        print("No webview target found!")
        return

    ws_url = webview_target['webSocketDebuggerUrl']
    print(f"Connecting to webview: {ws_url}")

    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(ws_url)
        print("Contexts:", browser.contexts)
        for i, ctx in enumerate(browser.contexts):
            print(f"Context {i} pages: {len(ctx.pages)}")
            print(f"Context {i} background pages: {len(ctx.background_pages)}")
            for j, page in enumerate(ctx.pages):
                print(f"  Page {j}: url={page.url}")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
