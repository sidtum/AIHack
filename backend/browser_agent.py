"""
Legacy browser agent module.
Career flow now lives in career_engine.py.
This module is kept for backward compatibility.
"""
import json
from dotenv import load_dotenv

load_dotenv()

from browser_use import Agent, Browser

browser = Browser(
    cdp_url="http://localhost:9222"
)

from career_engine import run_career_flow


async def execute_career_plan(profile: dict, ws_broadcast_callback):
    """Backward-compatible wrapper. Delegates to career_engine."""
    await run_career_flow(profile, ws_broadcast_callback)
