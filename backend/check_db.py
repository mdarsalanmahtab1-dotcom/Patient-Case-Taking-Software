import asyncio
import database
from dotenv import load_dotenv

load_dotenv()

async def run():
    await database.init_db_pool()
    async with database._pool.acquire() as conn:
        res = await conn.fetch("SELECT session_status, created_at, token_id FROM patient_sessions WHERE patient_id='91-1001-2001-3001'")
        for r in res:
            print(dict(r))
    await database.close_db_pool()

if __name__ == "__main__":
    asyncio.run(run())
