import asyncio
import websockets
import json
import logging

logging.basicConfig(level=logging.INFO)

async def trigger():
    uri = "ws://127.0.0.1:8000/ws"
    try:
        async with websockets.connect(uri) as websocket:
            logging.info("Connected to websocket")
            await websocket.send(json.dumps({
                "type": "user_message",
                "text": "I have an exam tomorrow"
            }))
            
            while True:
                response = await websocket.recv()
                data = json.loads(response)
                logging.info(f"Received: {data}")
                if data.get("type") == "agent_response" and "Action Plan Generated" in data.get("text", ""):
                    logging.info("Got plan, confirming...")
                    break
                    
            await websocket.send(json.dumps({
                "type": "user_message",
                "text": "yes"
            }))
            logging.info("Triggered study mode! Leaving websocket open to let it stream...")
            
            # just keep listening so it doesn't disconnect
            while True:
                resp = await websocket.recv()
                logging.info(f"Stream: {resp[:100]}")
    except Exception as e:
        logging.error(f"Error: {e}")

asyncio.run(trigger())
