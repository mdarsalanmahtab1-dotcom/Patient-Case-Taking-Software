# SwasthyaSync Clinical Engine - Technical Knowledge Base

## 1. Executive Summary & Architecture Overview
SwasthyaSync is a server-driven, multimodal clinical history-taking application. It conducts dynamic patient interviews, extracts clinical entities, and digitizes uploaded documents (like prescriptions or lab reports) using OCR.

**Core architectural pillars:**
- **Server-Driven UI via WebSockets**: The frontend (`App.tsx`) is a thin client. All state transitions, dialogue generation, and UI options are computed by the backend `DialogueManager` and sent over WebSockets.
- **Simplified Macro FSM**: The patient journey moves sequentially through states (`INIT`, `DEMOGRAPHICS`, `CHIEF_COMPLAINT`, `SCHEMA_GENERATION`, `DYNAMIC_INTERVIEW`, `DOCUMENT_SCAN`, `SUMMARY_CONFIRMATION`, `COMPLETE`).
- **Two-Stage LLM Pipeline**:
  - **Stage 1 (Schema Generation)**: Triggered after the chief complaint. Calls Gemini 3.6 Flash to generate a dynamic schema (fields to collect) specific to the complaint.
  - **Stage 2 (Dynamic Interview)**: The main loop. Extracts data from patient responses, evaluates safety red flags, selects the next unfilled field, and generates the next conversational question.
- **Multimodal & Safety Integration**: OCR pipeline using Gemini 3.5 Flash Lite for document parsing. A deterministic `red_flag_library.py` (Rule-based) overrides the LLM for safety floor guarantees.

## 2. Directory Structure
```text
c:\SmartIndiaHackathon\Prototype\
├── backend/
│   ├── main.py (FastAPI entrypoint, WebSocket routing)
│   ├── dialogue_manager.py (FSM orchestrator, Stage 1/2 controller)
│   ├── macro_fsm.py (State machine sequence)
│   ├── patient_record.py (Pydantic source of truth for session data)
│   ├── schema_generator.py (Stage 1 LLM call)
│   ├── conversation_engine.py (Stage 2 LLM extraction and generation)
│   ├── field_selector.py (Logic for choosing next question)
│   ├── llm_client.py (Google GenAI wrapper with circuit breaker)
│   ├── fast_path_cache.py (Zero-latency cache for standard questions)
│   ├── red_flag_library.py (Deterministic safety rules)
│   ├── document_red_flags.py & ocr_pipeline.py (Document scanning & checks)
│   ├── sarvam_client.py (Voice integration API)
│   └── swasthyasync.db / medikiosk.db (SQLite databases)
├── frontend/
│   └── src/
│       ├── App.tsx (Main router based on FSM state)
│       ├── config.ts (Dynamic endpoint resolution)
│       ├── hooks/useConversation.ts (WebSocket management)
│       └── screens/ (UI Components mapped to FSM states)
└── docs/
```

## 3. Backend: Core Engine Deep Dive

### 3.1 `main.py`
- Initializes FastAPI, serves static files, and defines REST endpoints (e.g., `/api/ocr`).
- Maintains a global `sessions` dictionary holding `DialogueManager` instances for state persistence.
- Handles WebSocket connections (`/ws/chat/{session_id}`): receives patient input, routes it to `dialogue_manager.process_patient_input()`, and sends back the updated UI instruction.

### 3.2 `dialogue_manager.py`
- The brain of the application. Encapsulates `MacroFSM` and `PatientRecord`.
- **`process_patient_input`**: Main routing function. 
  - Handles "back" navigation (includes logic to "double-jump" backward over `SCHEMA_GENERATION`).
  - Calls `_handle_chief_complaint` to trigger Stage 1.
  - Calls `_handle_dynamic_turn` to execute the Stage 2 extraction/generation loop.
- **`resume_session`**: Allows re-connection without side effects (useful if the client reconnects).

### 3.3 `macro_fsm.py`
- Strict ordered state list: `INIT` -> `DEMOGRAPHICS` -> `CHIEF_COMPLAINT` -> `SCHEMA_GENERATION` -> `DYNAMIC_INTERVIEW` -> `DOCUMENT_SCAN` -> `SUMMARY_CONFIRMATION` -> `COMPLETE`.
- Conditionally adds `AYUSH_ASSESSMENT`.
- Supports global interrupts: `EMERGENCY_PROTOCOL` (red flags) and `STAFF_ASSIST`.

### 3.4 `patient_record.py`
- Defines the `PatientRecord` Pydantic model.
- Evolved from per-section structure (HPI, PMH) to a unified `dynamic_schema` and `filled_state`.
- Stores `conversation_history` globally, simplifying context passing to the LLM.

### 3.5 Two-Stage LLM Pipeline
- **`schema_generator.py`**: Executes Stage 1. Prompts Gemini to generate a JSON array of clinical fields based on the chief complaint. Injects a mandatory safety floor (e.g., red flag symptoms).
- **`conversation_engine.py`**: Executes Stage 2.
  - `extract_from_response`: Uses LLM to extract values and confidence scores from free-text patient input.
  - `generate_question`: Creates a conversational question targeting the next unfilled field.
- **`field_selector.py`**: Decides which field to ask next based on schema category order and safety priority.
- **`fast_path_cache.py`**: Optimizes Stage 2. Pre-caches standard questions (like onset, severity, allergies) in multiple languages (Hindi, Tamil, Telugu, English) to bypass LLM latency.

### 3.6 Safety and Resilience
- **`red_flag_library.py`**: Non-LLM safety layer. Uses python lambdas to check `filled_state` values for emergencies (e.g., chest pain -> True). Forces FSM to `EMERGENCY_PROTOCOL`.
- **`llm_client.py`**: Wraps Google GenAI API. Implements a Circuit Breaker pattern. Disables AFC (Automated Function Calling) for standard conversational turns to reduce latency. Uses `gemini-3.6-flash` and `gemini-3.5-flash-lite`.

### 3.7 Integrations
- **`ocr_pipeline.py`**: Uses Gemini Vision (3.5 Flash Lite) to extract entities from documents.
- **`document_red_flags.py`**: Checks extracted labs against critical thresholds.
- **`sarvam_client.py`**: Client for Sarvam AI to handle potential Speech-to-Text / Text-to-Speech integration optimized with persistent HTTP connections.

## 4. Frontend Architecture
- **`App.tsx`**: A simple switch statement driven by `uiState.macro_state` and `uiState.screen`. It conditionally renders components from `src/screens/`. The frontend is "dumb"—it does not decide what happens next.
- **`useConversation.ts`**: Custom hook managing the WebSocket connection. Auto-reconnects and handles session resumption by sending a `{"type": "resume"}` message upon connection.
- **Screens**: 
  - `Screen3_ConversationalIntake`: Main chat interface. Renders options and prompts.
  - `Screen5_DocumentScanner`: Handles file uploads and sends to REST `/api/ocr`.

## 5. Recent Fixes & Critical Knowledge
1. **Model Upgrades**: Google deprecated `gemini-2.5-flash`. The codebase was successfully updated to `gemini-3.6-flash` for heavy generation and `gemini-3.5-flash-lite` for fast tasks/OCR.
2. **Double-Jump Navigation Bug**: The `MacroFSM` handles sequential backward movement. However, `SCHEMA_GENERATION` is a transient processing state. Moving backwards from `DYNAMIC_INTERVIEW` led to a frozen loading screen. This was fixed in `dialogue_manager.py` by adding a "double-jump" (`if state == "SCHEMA_GENERATION": fsm.go_back()`) to seamlessly return to `CHIEF_COMPLAINT`.
3. **Logger Syntax Error**: A missing `f` string format in `main.py` logging statements was fixed to allow the application to start properly.

## 6. How to Run and Test
- **Backend**: 
  ```bash
  cd backend
  pip install -r requirements.txt
  uvicorn main:app --reload
  ```
- **Frontend**:
  ```bash
  cd frontend
  npm install
  npm start # or npm run dev
  ```
- **Tests**:
  Run `pytest` in the backend directory. The test suite covers OCR verification, Red Flags, and full end-to-end simulated interviews.
