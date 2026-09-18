import os
import asyncio
import asyncpg
from dotenv import load_dotenv

load_dotenv('.env')

async def test():
    pool = await asyncpg.create_pool(os.getenv('SUPABASE_DB_URL'))
    print('Success')
    await pool.close()

asyncio.run(test())
