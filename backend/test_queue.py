import asyncio
import httpx

async def t():
    async with httpx.AsyncClient() as c:
        try:
            r = await c.get('http://localhost:8000/api/queue')
            print(r.status_code, r.text[:100])
        except Exception as e:
            print("Error:", e)

asyncio.run(t())
