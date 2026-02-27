import math
import openai
import os
import asyncio

storage = []

async def add_to_rag(text: str, title: str):
    """Chunk text, get embeddings, and store in memory."""
    global storage
    # Simple chunking: 1000 chars with 200 overlap
    chunks = [text[i:i+1000] for i in range(0, len(text), 800)]
    client = openai.AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
    
    for chunk in chunks:
        if not chunk.strip():
            continue
        try:
            res = await client.embeddings.create(input=chunk, model="text-embedding-3-small")
            storage.append({
                "text": chunk, 
                "title": title, 
                "embedding": res.data[0].embedding
            })
        except Exception as e:
            print(f"Error embedding chunk: {e}")

def cosine_similarity(v1, v2):
    dot = sum(a*b for a, b in zip(v1, v2))
    mag1 = math.sqrt(sum(a*a for a in v1))
    mag2 = math.sqrt(sum(b*b for b in v2))
    if mag1 == 0 or mag2 == 0: 
        return 0
    return dot / (mag1 * mag2)

async def query_rag(question: str, top_k: int = 5) -> str:
    """Embed the question and find top_k most similar chunks."""
    global storage
    if not storage:
        return ""
    
    try:
        client = openai.AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
        res = await client.embeddings.create(input=question, model="text-embedding-3-small")
        q_emb = res.data[0].embedding
        
        scored = []
        for item in storage:
            sim = cosine_similarity(q_emb, item["embedding"])
            scored.append((sim, item))
        
        scored.sort(key=lambda x: x[0], reverse=True)
        top = scored[:top_k]
        
        return "\n\n---\n\n".join([f"Source: {item[1]['title']}\n{item[1]['text']}" for item in top])
    except Exception as e:
        print(f"Error querying RAG: {e}")
        return ""

def clear_rag():
    """Clear memory."""
    global storage
    storage = []
