from browser_use import Tools, ActionResult
from browser_use.agent.prompts import SystemPrompt

tools = Tools()
@tools.action('Download Canvas File by Text')
async def download_canvas_file(filename: str) -> ActionResult:
    pass

action_description = tools.get_tools() if hasattr(tools, 'get_tools') else ""
prompt = SystemPrompt(action_description=action_description, max_actions_per_step=1)
print(prompt.get_system_message().content)
