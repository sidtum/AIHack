import asyncio
from browser_use import Agent, Browser, Tools

async def main():
    browser = Browser()
    context = await browser.new_context()
    page = await context.get_current_page()
    print("Page object:", type(page))
    print("Page dir:", dir(page))
    print("Page context:", getattr(page, 'context', 'No context attribute'))
    
    # Try getting cookies
    if hasattr(context, "get_cookies"):
         # typical playwright context
         pass
         
    # Print the context out
    print("Context object:", type(context))
    print("Context dir:", dir(context))
    
    await browser.close()
    
if __name__ == "__main__":
    asyncio.run(main())
