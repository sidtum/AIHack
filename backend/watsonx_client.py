"""
watsonx_client.py -- Async IBM watsonx.ai via direct REST (no SDK required).

The ibm-watsonx-ai SDK depends on pandas which cannot build on Python 3.14,
so we call the /ml/v1/text/generation endpoint directly with httpx.

Required env vars:
  IBM_WATSONX_API_KEY    -- IAM API key from cloud.ibm.com
  IBM_WATSONX_PROJECT_ID -- from dataplatform.cloud.ibm.com, Manage > General
  IBM_WATSONX_URL        -- e.g. https://us-south.ml.cloud.ibm.com (default)
"""
import os
import httpx
from datetime import datetime, timezone

_WX_URL = os.environ.get("IBM_WATSONX_URL", "https://us-south.ml.cloud.ibm.com")
_WX_PROJECT_ID = os.environ.get("IBM_WATSONX_PROJECT_ID", "")
_WX_API_KEY = os.environ.get("IBM_WATSONX_API_KEY", "")

# IBM Granite 3.3 8B instruction-tuned
MODEL_ID = "ibm/granite-3-3-8b-instruct"

_iam_token: str = ""
_iam_expires: float = 0.0


async def _get_iam_token() -> str:
    """Fetch (and cache) an IBM Cloud IAM bearer token."""
    global _iam_token, _iam_expires
    now = datetime.now(timezone.utc).timestamp()
    if _iam_token and now < _iam_expires - 60:
        return _iam_token
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.post(
            "https://iam.cloud.ibm.com/identity/token",
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            data={
                "grant_type": "urn:ibm:params:oauth:grant-type:apikey",
                "apikey": _WX_API_KEY,
            },
        )
        r.raise_for_status()
        d = r.json()
        _iam_token = d["access_token"]
        _iam_expires = now + d.get("expires_in", 3600)
    return _iam_token


async def _generate(
    prompt: str,
    max_new_tokens: int = 1024,
    temperature: float = 0.3,
) -> str:
    """Call the watsonx.ai text/generation endpoint and return generated text."""
    if not _WX_API_KEY or not _WX_PROJECT_ID:
        raise RuntimeError(
            "IBM_WATSONX_API_KEY and IBM_WATSONX_PROJECT_ID must be set in .env"
        )
    token = await _get_iam_token()
    payload = {
        "model_id": MODEL_ID,
        "project_id": _WX_PROJECT_ID,
        "input": prompt,
        "parameters": {
            "max_new_tokens": max_new_tokens,
            "temperature": temperature,
            "repetition_penalty": 1.05,
        },
    }
    async with httpx.AsyncClient(timeout=120) as c:
        r = await c.post(
            f"{_WX_URL}/ml/v1/text/generation?version=2023-05-29",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            json=payload,
        )
        r.raise_for_status()
        return r.json()["results"][0]["generated_text"].strip()


def _build_chat_prompt(system: str, user: str) -> str:
    """Build a plain text system+user prompt compatible with Granite instruct."""
    parts = []
    if system:
        parts.append(f"System: {system}")
    parts.append(f"User: {user}")
    parts.append("Assistant:")
    return "\n\n".join(parts)


# -- Public API ----------------------------------------------------------------

async def wx_chat(prompt: str, system: str = "", max_tokens: int = 1024) -> str:
    """
    General-purpose async chat. Returns the model reply as a plain string.
    Powered by IBM Granite via watsonx.ai.
    """
    full_prompt = _build_chat_prompt(system, prompt) if system else prompt
    return await _generate(full_prompt, max_new_tokens=max_tokens, temperature=0.35)


async def wx_json(prompt: str, max_tokens: int = 768) -> str:
    """
    JSON-focused generation (low temperature). Returns raw text -- caller
    must parse with json.loads(). Powered by IBM granite via watsonx.ai.
    """
    system = (
        "You are a precise AI assistant. Always respond with valid JSON only. "
        "Do not include any explanation, markdown, or text outside the JSON."
    )
    full_prompt = _build_chat_prompt(system, prompt)
    return await _generate(full_prompt, max_new_tokens=max_tokens, temperature=0.1)


async def test_connection() -> dict:
    """Quick smoke-test. Returns model info on success."""
    reply = await wx_chat("Reply with exactly: IBM watsonx OK")
    return {"status": "ok", "model": MODEL_ID, "reply": reply}
