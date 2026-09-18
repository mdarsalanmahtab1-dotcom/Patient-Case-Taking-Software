import asyncio
import os
import asyncpg
from dotenv import load_dotenv

load_dotenv()

async def main():
    db_url = os.getenv("SUPABASE_DB_URL")
    if not db_url:
        print("SUPABASE_DB_URL not found")
        return
        
    print("Connecting to DB...")
    conn = await asyncpg.connect(db_url)
    
    try:
        await conn.execute('ALTER TABLE doctors ADD COLUMN IF NOT EXISTS custom_instructions TEXT')
        print("Successfully added custom_instructions to doctors table")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
