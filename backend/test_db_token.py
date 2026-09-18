from dotenv import load_dotenv
load_dotenv()
import asyncio
import database
async def test():
    await database.init_db_pool()
    rows = await database._pool.fetch('SELECT * FROM patient_sessions ORDER BY created_at DESC LIMIT 5')
    for row in rows:
        print(dict(row))
    await database.close_db_pool()
asyncio.run(test())
