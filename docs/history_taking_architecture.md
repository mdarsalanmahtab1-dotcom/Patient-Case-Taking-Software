# SwasthyaSync v3: History-Taking Architecture Overview

This document provides a detailed overview of the core architecture used for the conversational history-taking module in the SwasthyaSync application. It explains the interplay between the State Machine (FSM), the LLM context engine, state management, and the logic driving the dynamic generation of questions.

---

## 1. Core Architectural Components

The history-taking module is divided into three primary layers:
1. **State Management (FSM)** (`fsm.py`): Controls the macro-level flow of the interview (which clinical section we are currently in).
2. **Dialogue Manager** (`dialogue_manager.py`): The orchestrator. It manages the session data, tracks mandatory slot completions, bridges the FSM with the LLM, and formats the output for the frontend.
3. **LLM Context Engine** (`conversation_engine.py` & `clinical_prompts.py`): Handles the prompt construction, language translation, context injection, and parsing of the structured JSON response from the LLM.

---

## 2. Finite State Machine (FSM)

The system uses a strict State Machine to guarantee that the interview progresses logically and completely through all necessary medical domains, preventing the LLM from hallucinating endless questions or skipping important sections.

### **FSM States (Macro-States):**
1. **`CHIEF_COMPLAINT`**: Establishes the primary reason for the visit.
2. **`HPI`** (History of Present Illness): Deep dive into the chief complaint (SOCRATES/OLDCARTS).
3. **`PMH`** (Past Medical History): Screening for chronic conditions (diabetes, HTN, etc.).
4. **`PSH`** (Past Surgical History): Surgeries and anesthesia complications.
5. **`DRUG_ALLERGY`**: Current medications and known allergies.
6. **`FAMILY_HX`**: Hereditary conditions in first-degree relatives.
7. **`SOCIAL_HX`**: Lifestyle, smoking, alcohol, diet, and stress.
8. **`ROS`** (Review of Systems): Broad systemic symptom check.
9. **`AYUSH_ASSESSMENT`**: (If clinic_mode is ayush/integrative) Assess Prakriti, Vikriti, Agni.
10. **`SUMMARY_CONFIRMATION`**: The final state where the FSM stops and hands off the complete data to the frontend for verification.

### **FSM Transitions:**
- The FSM only transitions to the next state when `advance()` is explicitly called by the `DialogueManager`.
- If an emergency is detected, it enters an `interrupt_state` (e.g., Red Flag triage) and halts normal progression.

---

## 3. Data Storage (`patient_record.py`)

All conversation history and extracted entities are stored in a `PatientRecord` model.

For every section (e.g., `HPI`, `PMH`), there is a dedicated `SectionData` object which stores:
- **`messages`**: The verbatim chat history for that specific section.
- **`extracted`**: A dynamic dictionary of key-value pairs (the clinical entities found by the LLM).
- **`summary`**: A plain-text clinical summary of the section written by the LLM.
- **`completed`**: A boolean flag indicating if the section is done.

Because data is partitioned by section, when the LLM is prompted for the `PMH` state, we only feed it the `PMH` chat history and `PMH` extracted data, keeping the context window clean, highly relevant, and focused.

---

## 4. How the Next Question is Decided

The process of generating the next question is highly dynamic but heavily guided by "Guardrails" (Meso-Templates) and LLM Reasoning.

### Step 1: Input Processing
When the patient speaks or taps an option, the frontend sends the payload to `process_patient_input()` in the `DialogueManager`.

### Step 2: Progress & Guardrail Calculation
The DialogueManager looks at `meso_templates.py` to see what fields are *mandatory* for the current state.
It calculates: `unfilled_slots = [mandatory_fields] - [keys in SectionData.extracted]`.
If `unfilled_slots` reaches 0, the DialogueManager forces the FSM to advance to the next state immediately (Auto-Advance).

### Step 3: LLM Context Construction (`conversation_engine.py`)
If the section is not complete, the system builds a prompt for the LLM. The prompt includes:
1. **The System Prompt** (from `clinical_prompts.py`): Contains medical guidelines (e.g., "If chest pain, you MUST ask about radiation").
2. **Missing Information Block**: The `unfilled_slots` list is directly injected into the prompt as a strict directive ("You MUST ask about these missing fields").
3. **Already Extracted Data**: "=== ALREADY EXTRACTED IN THIS SECTION ===". This prevents the LLM from repeating questions it has already gathered answers for.
4. **Chat History**: The recent back-and-forth for context.
5. **Language Directives**: Strict rules enforcing output in the chosen localized language.

### Step 4: The LLM Call
The LLM (Gemini) evaluates the clinical context and returns a structured JSON payload:
```json
{
  "reasoning": "Patient reported stomach pain. Need to check for radiation and vomiting.",
  "spoken_text": "Is the pain spreading anywhere else, or have you experienced any vomiting?",
  "suggested_options": [{"label": "Yes", "label_translated": "हाँ"}, ...],
  "extracted_data": {"location": "Stomach", "severity": "8/10"},
  "section_complete": false,
  "red_flag_check": null
}
```

### Step 5: State Update & Response
- The DialogueManager takes the `extracted_data` from the JSON and merges it into `SectionData.extracted`.
- The FSM checks `section_complete`. If the LLM returned `true` (and there are no unfilled mandatory slots), the FSM advances to the next state.
- The UI instruction is compiled (combining the `spoken_text`, dynamic progress bar status, and `suggested_options`) and sent back to the frontend.

---

## 5. Handling Red Flags

If the LLM detects a critical medical emergency (e.g., sudden chest pain with jaw radiation), it outputs the warning string into the `red_flag_check` field instead of `null`.

The `DialogueManager` intercepts this:
1. It immediately calls `fsm.interrupt(...)` to freeze the FSM.
2. It returns a special `red_flag` payload to the frontend.
3. The frontend displays a triage warning screen, stopping the interview until a human (or doctor) clears the flag.

---

## Summary of the "Dynamic yet Guided" Philosophy

By combining a rigid FSM for macro-flow with an autonomous LLM for micro-interactions within a state, we achieve the best of both worlds:
- **No missing data**: The FSM and mandatory slots ensure the AI cannot skip crucial sections.
- **Natural Conversation**: Within a state, the LLM is free to ask deep, contextual follow-up questions (like exploring the character of a pain) without sounding like a robotic form.
- **Self-Correcting**: By feeding the LLM its own `extracted_data` back in every prompt, it is self-aware of what it has already collected, completely eliminating the "amnesia" hallucination where it forgets previous answers.
