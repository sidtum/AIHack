"""
ngrok_manager.py — pyngrok tunnel lifecycle + Linq webhook auto-registration.

Called once at FastAPI startup:
  await start_ngrok_and_register_webhook()

Flow:
  1. Start ngrok tunnel → public HTTPS URL
  2. GET /v3/phonenumbers → store linq_phone_number
  3. If existing webhook_id in DB → PUT to update target_url (preserves secret)
  4. Else → POST to create webhook, store id + signing_secret
"""
import os
import asyncio
import httpx
from dotenv import load_dotenv

load_dotenv()

LINQ_API_BASE = "https://api.linqapp.com"
WEBHOOK_PATH = "/sms/webhook"


def _linq_headers() -> dict:
    token = os.environ.get("LINQ_API_TOKEN", "")
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


async def _fetch_linq_phone_number() -> str | None:
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{LINQ_API_BASE}/v3/phonenumbers",
                headers=_linq_headers(),
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
            # Expect list or object; grab first number
            if isinstance(data, list) and data:
                return data[0].get("phone_number") or data[0].get("number")
            if isinstance(data, dict):
                nums = data.get("phone_numbers") or data.get("data") or []
                if nums:
                    return nums[0].get("phone_number") or nums[0].get("number")
    except Exception as e:
        print(f"[ngrok] Failed to fetch Linq phone number: {e}")
    return None


async def _register_webhook(target_url: str) -> tuple[str, str] | tuple[None, None]:
    """POST to create a new webhook subscription. Returns (id, signing_secret)."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{LINQ_API_BASE}/v3/webhook-subscriptions",
                headers=_linq_headers(),
                json={"target_url": target_url, "subscribed_events": ["message.received"]},
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
            wh_id = data.get("id") or data.get("webhook_id")
            secret = data.get("signing_secret") or data.get("secret")
            return wh_id, secret
    except Exception as e:
        print(f"[ngrok] Failed to register Linq webhook: {e}")
        return None, None


async def _update_webhook(webhook_id: str, target_url: str) -> bool:
    """PUT to update an existing webhook's target URL."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.put(
                f"{LINQ_API_BASE}/v3/webhook-subscriptions/{webhook_id}",
                headers=_linq_headers(),
                json={"target_url": target_url, "subscribed_events": ["message.received"]},
                timeout=10,
            )
            resp.raise_for_status()
            return True
    except Exception as e:
        print(f"[ngrok] Failed to update Linq webhook {webhook_id}: {e}")
        return False


async def start_ngrok_and_register_webhook():
    """Main startup routine — call this from FastAPI startup event."""
    from database import get_linq_config, store_linq_config

    linq_token = os.environ.get("LINQ_API_TOKEN", "")
    if not linq_token:
        print("[ngrok] LINQ_API_TOKEN not set — skipping SMS setup")
        return

    # 1. Start ngrok tunnel
    try:
        from pyngrok import ngrok, conf

        ngrok_token = os.environ.get("NGROK_AUTH_TOKEN", "")
        if ngrok_token:
            conf.get_default().auth_token = ngrok_token

        tunnel = ngrok.connect(8000, "http")
        public_url = tunnel.public_url
        # Ensure HTTPS
        if public_url.startswith("http://"):
            public_url = "https://" + public_url[len("http://"):]
        print(f"[ngrok] Tunnel active: {public_url}")
    except Exception as e:
        print(f"[ngrok] Could not start tunnel: {e}")
        return

    target_url = public_url + WEBHOOK_PATH

    # 2. Fetch Linq phone number
    phone_number = await _fetch_linq_phone_number()
    if phone_number:
        store_linq_config(phone_number=phone_number)
        print(f"[ngrok] Linq phone number: {phone_number}")

    # 3. Register or update webhook
    config = get_linq_config()
    existing_id = config.get("linq_webhook_id")

    if existing_id:
        success = await _update_webhook(existing_id, target_url)
        if success:
            print(f"[ngrok] Webhook updated: {existing_id} → {target_url}")
        else:
            print("[ngrok] Webhook update failed — attempting fresh registration")
            wh_id, secret = await _register_webhook(target_url)
            if wh_id:
                store_linq_config(webhook_id=wh_id, webhook_secret=secret)
                print(f"[ngrok] New webhook registered: {wh_id}")
    else:
        wh_id, secret = await _register_webhook(target_url)
        if wh_id:
            store_linq_config(webhook_id=wh_id, webhook_secret=secret)
            print(f"[ngrok] Webhook registered: {wh_id} → {target_url}")
        else:
            print("[ngrok] Could not register webhook — check LINQ_API_TOKEN")
