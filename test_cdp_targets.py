import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp("http://localhost:9222")
        print("Connected to top level browser CDP")
        
        # Access the CDP session of the main browser to find targets
        try:
            client = await browser.new_cdp_session(browser.contexts[0].pages[0])
            targets = await client.send("Target.getTargets")
            print("Targets:")
            for t in targets.get('targetInfos', []):
                print(t)
        except Exception as e:
            print(f"Error: {e}")
            
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
