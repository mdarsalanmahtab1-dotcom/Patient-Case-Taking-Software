import asyncio
import httpx

async def test():
    async with httpx.AsyncClient() as client:
        try:
            r1 = await client.get("http://localhost:8000/api/doctors")
            print("doctors:", r1.status_code, len(r1.text))
        except Exception as e:
            print("doctors error:", e)
            
        try:
            r2 = await client.get("http://localhost:8000/api/departments")
            print("departments:", r2.status_code, len(r2.text))
        except Exception as e:
            print("departments error:", e)

asyncio.run(test())
