import asyncio
import os
from dotenv import load_dotenv

load_dotenv("backend/.env")

from backend.ocr_pipeline import process_document

async def test():
    with open('docs/pdf_text.txt', 'rb') as f:
        data = f.read()
    res = await process_document(data, 'dummy.txt', 'text/plain')
    print('MEDS:', res.get('medications'))
    print('DIAGS:', res.get('diagnoses'))
    print('LABS:', res.get('lab_values'))

asyncio.run(test())
