import asyncio
import httpx

async def t():
    async with httpx.AsyncClient() as c:
        try:
            r = await c.get('http://localhost:8000/api/admin/doctors')
            j = r.json()
            if isinstance(j, dict):
                print("Dict keys:", list(j.keys()))
            else:
                print("List length:", len(j))
        except Exception as e:
            print("Error:", e)

asyncio.run(t())
