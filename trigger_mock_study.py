import asyncio
import websockets
import json
import logging

logging.basicConfig(level=logging.INFO)

async def trigger():
    uri = "ws://127.0.0.1:8000/ws"
    try:
        async with websockets.connect(uri) as websocket:
            logging.info("Connected to websocket. Sending mock study payload...")
            
            mock_data = {
                "type": "study_panel",
                "session_id": 101,
                "course_name": "CSE 3244 Cloud Systems",
                "concepts": [
                    {
                        "title": "MapReduce Architecture",
                        "explanation": "A programming model and an associated implementation for processing and generating large data sets. Users specify a map function that processes a key/value pair to generate a set of intermediate key/value pairs, and a reduce function that merges all intermediate values associated with the same intermediate key.",
                        "key_points": ["Map step: filtering/sorting", "Reduce step: summary operation", "Highly scalable across distributed clusters"]
                    },
                    {
                        "title": "Consistency vs Availability (CAP)",
                        "explanation": "The CAP theorem states that a distributed data store can only guarantee two out of the following three: Consistency, Availability, and Partition tolerance. In the presence of a network partition, one must choose between consistency and availability.",
                        "key_points": ["Consistency: every read receives most recent write", "Availability: every request receives a non-error response", "Partition Tolerance: system continues to operate despite network drops"]
                    }
                ],
                "questions": [
                    {
                        "id": 1,
                        "text": "What does the Map function primarily do in MapReduce?",
                        "options": ["Aggregates data", "Filters and sorts data", "Manages the cluster", "Visualizes the output"],
                        "correct_index": 1,
                        "explanation": "The Map function's primary role is to process input data, typically filtering and sorting it into intermediate key-value pairs which are then passed to the Reduce function."
                    },
                    {
                        "id": 2,
                        "text": "According to the CAP theorem, which two guarantees can you theoretically have in the presence of a network partition?",
                        "options": ["Consistency and Availability", "Only Partition Tolerance", "You must choose either Consistency OR Availability, alongside Partition Tolerance", "All three can be guaranteed"],
                        "correct_index": 2,
                        "explanation": "In the presence of a network partition (P), a distributed system must choose to either remain Available (A) returning potentially stale data, or remain Consistent (C) by failing the request until the partition heals."
                    }
                ],
                "content_raw": "This is mock raw content for the CSE 3244 course. It includes data about MapReduce and CAP theorem."
            }
            
            await websocket.send(json.dumps(mock_data))
            logging.info("Sent mock study data! You should see the UI update.")
            
    except Exception as e:
        logging.error(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(trigger())
