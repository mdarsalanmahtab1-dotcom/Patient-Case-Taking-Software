import asyncio
import os
import asyncpg
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

async def migrate():
    db_url = os.getenv("SUPABASE_DB_URL")
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")

    if not db_url or not supabase_url or not supabase_key:
        print("[Error] Missing database or supabase credentials.")
        return

    print(f"Connecting to Supabase Storage: {supabase_url}")
    supabase = create_client(supabase_url, supabase_key)

    print("Connecting to database...")
    conn = await asyncpg.connect(db_url)

    # Fetch rows with local paths
    rows = await conn.fetch("""
        SELECT summary_id, session_id, pdf_file_path
        FROM clinical_summaries
        WHERE pdf_file_path IS NOT NULL
          AND NOT (pdf_file_path LIKE 'http%')
    """)

    print(f"Found {len(rows)} clinical summaries with local PDF paths.")

    for r in rows:
        summary_id = r["summary_id"]
        local_path = r["pdf_file_path"]

        if not os.path.exists(local_path):
            print(f"[Skip] File does not exist on disk: {local_path}")
            continue

        print(f"Uploading {local_path} for summary {summary_id}...")
        try:
            with open(local_path, "rb") as f:
                pdf_bytes = f.read()

            storage_path = f"patient-documents/{summary_id}.pdf"

            # Upload or overwrite
            try:
                supabase.storage.from_("patient-records").upload(
                    path=storage_path,
                    file=pdf_bytes,
                    file_options={"content-type": "application/pdf", "upsert": "true"}
                )
            except Exception as up_err:
                print(f"  Upload note: {up_err} (trying upsert)")

            public_url = supabase.storage.from_("patient-records").get_public_url(storage_path)

            await conn.execute("""
                UPDATE clinical_summaries
                SET pdf_file_path = $1
                WHERE summary_id = $2
            """, public_url, summary_id)

            print(f"  [Success] Migrated {summary_id} -> {public_url}")

        except Exception as e:
            print(f"  [Error] Failed to migrate {summary_id}: {e}")

    await conn.close()
    print("Migration finished!")

if __name__ == "__main__":
    asyncio.run(migrate())
