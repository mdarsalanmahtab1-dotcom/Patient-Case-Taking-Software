# SwasthyaSync — Patient Case Taking Software

AI-powered multilingual patient history-taking kiosk for Indian healthcare settings.

## Project Structure

```
Patient_case_taking_software/
├── backend/                 # Python FastAPI backend
│   ├── main.py              # FastAPI server (REST + WebSocket)
│   ├── llm_client.py        # Gemini AI (gemini-3.6-flash) — NLP
│   ├── sarvam_client.py     # Sarvam AI — STT + TTS (11 languages)
│   ├── dialogue_manager.py  # Conversation state machine
│   ├── meso_templates.py    # Clinical slot templates
│   ├── ocr_pipeline.py      # Document OCR pipeline
│   ├── patient_record.py    # Patient data models
│   ├── safety_watchdog.py   # Clinical safety rules
│   ├── macro_fsm.py         # Macro FSM states
│   ├── requirements.txt     # Python dependencies
│   └── .env                 # API keys (not committed)
│
├── frontend/                # React + Vite frontend
│   ├── src/
│   │   ├── hooks/
│   │   │   ├── useConversation.ts   # WebSocket conversation loop
│   │   │   ├── useSarvamSTT.ts      # Sarvam speech-to-text
│   │   │   └── useSarvamTTS.ts      # Sarvam text-to-speech
│   │   ├── screens/                 # 8 kiosk screens
│   │   ├── components/              # Orb, Layout
│   │   └── machines/                # XState FSM
│   ├── .env                 # Vite env vars (not committed)
│   └── package.json
│
├── docs/                    # Reference documents
│   ├── SwasthyaSync_Architecture_v2.pdf
│   ├── Problem Statement.txt
│   ├── Abstact_orb.txt      # Orb design notes
│   └── *.png                # UI inspiration mockups
│
├── .gitignore
├── README.md
└── start.ps1                # One-click launcher
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite + TypeScript |
| Backend | Python 3.11+ + FastAPI + WebSocket |
| LLM (NLP) | Google Gemini `gemini-3.6-flash` |
| STT/TTS | Sarvam AI `saarika:v2` / `bulbul:v3` |
| OCR | Tesseract via pytesseract |

## Supported Languages (STT + TTS)

Hindi · Tamil · Telugu · Kannada · Bengali · Marathi · Gujarati · Malayalam · Punjabi · Odia · English

## Quick Start

```powershell
.\start.ps1
```

Or manually:

```powershell
# Terminal 1 — Backend
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev
```

Open: http://localhost:5173

## API Keys

**`backend/.env`**
```
GEMINI_API_KEY=your_gemini_key_here
SARVAM_API_KEY=your_sarvam_key_here
```

**`frontend/.env`**
```
VITE_BACKEND_WS_URL=ws://localhost:8000/ws/session
VITE_BACKEND_HTTP_URL=http://localhost:8000
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/session` | Create patient session |
| GET | `/api/record/{id}` | Fetch patient record |
| POST | `/api/ocr` | Upload document for OCR |
| POST | `/api/stt` | Speech → Text (Sarvam AI) |
| POST | `/api/tts` | Text → Speech WAV (Sarvam AI) |
| WS | `/ws/session` | Real-time conversation loop |
