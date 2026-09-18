import asyncio
import database

async def main():
    await database.setup_database()
    doctors = await database.get_doctors()
    print("Found doctors:", len(doctors))
    if doctors:
        print("First doctor:", dict(doctors[0]))

asyncio.run(main())
