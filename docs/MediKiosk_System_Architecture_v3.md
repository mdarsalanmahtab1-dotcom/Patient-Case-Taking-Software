# MediKiosk — System Architecture v3
## AI-Powered Multilingual Clinical History-Taking & Document Intelligence Platform

---

**Scope:** End-to-end system design for a patient-facing clinical intake platform that conducts adaptive medical history interviews via voice and touch, digitizes physical medical documents, fuses both into a structured physician-ready summary, and integrates with India's ABDM ecosystem.

**Design Philosophy:** Inspired by Google AMIE's chain-of-reasoning approach, OSCE examination standards, Macleod's Clinical Examination framework, and Ada Health's conversational triage model.

**Date:** August 2026  
**Status:** Implementation-grade design reference

---

## Table of Contents

1. [Design Philosophy & Core Principles](#1-design-philosophy--core-principles)
2. [System Overview & High-Level Architecture](#2-system-overview--high-level-architecture)
3. [Module A — Conversational History-Taking Engine](#3-module-a--conversational-history-taking-engine)
4. [Module B — Medical Document Intelligence Pipeline](#4-module-b--medical-document-intelligence-pipeline)
5. [Module C — Data Fusion & Physician Summary Engine](#5-module-c--data-fusion--physician-summary-engine)
6. [Module D — ABDM/ABHA Integration & Consent Framework](#6-module-d--abdmabha-integration--consent-framework)
7. [Voice & Language Architecture](#7-voice--language-architecture)
8. [Safety & Red-Flag Architecture](#8-safety--red-flag-architecture)
9. [Technology Stack & Deployment Architecture](#9-technology-stack--deployment-architecture)
10. [End-to-End Patient Journey](#10-end-to-end-patient-journey)
11. [Appendix: Workflow Diagrams](#11-appendix-workflow-diagrams)

---

## 1. Design Philosophy & Core Principles

### The Problem with Free-Running LLM Conversations

The instinctive approach to building "an AI that talks to a patient" is a single large LLM conversation loop: feed it the transcript so far and ask it to decide what to say next. This fails for clinical-grade products for a demonstrated, non-hypothetical reason — when a general-purpose LLM is left to freely drive a diagnostic interview, it reliably **asks fewer questions and omits clinically relevant ones**, because it optimizes for a plausible-sounding conversation, not for interview completeness. This is precisely the failure mode that is unacceptable in an OPD intake tool a physician will trust.

### Core Principle: Separate What-to-Ask from How-to-Say-It

A **deterministic, auditable policy** (the FSM + dynamic schema + safety floor) decides the next piece of clinical information needed. The LLM's only jobs are:

1. **Phrasing** — turning that decision into a natural, correctly-translated, empathetic sentence
2. **Extraction** — turning the patient's free-form answer back into structured data

The LLM never decides clinical branching on its own.

### Three-Tier Architecture Rationale

| Tier | Answers | Mechanism | Why Not One FSM for Everything |
|------|---------|-----------|-------------------------------|
| **Macro** | Which stage of the patient journey are we in? | Hand-authored FSM (~8 states, deterministic transitions) | N/A — this is exactly the regime where a real FSM works: few states, no combinatorial blow-up |
| **Meso** | Given the chief complaint, which fields must we collect? | LLM-generated dynamic schema grounded by a safety floor | Branching depends on complaint content, not just position — a dynamic schema scales better than encoding every complaint as FSM states |
| **Micro** | What is the next question, and how do we fill fields from natural speech? | Deterministic field selector + constrained LLM I/O | The "state" is the entire accumulated set of answers, not a discrete position — modeling every combination as FSM states is combinatorially infeasible |

This maps directly onto Google AMIE's insight: use **chain-of-reasoning** for clinical thinking within a bounded, policy-governed interview structure. The interview feels natural because the LLM phrases questions conversationally, but it is **complete** because the policy layer ensures every critical clinical data point is collected.

---

## 2. System Overview & High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PATIENT-FACING LAYER                                │
│                                                                             │
│   ┌──────────────────────────────────────────────────────────────────┐      │
│   │  React + Vite Frontend (Progressive Web App)                     │      │
│   │  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌──────────────┐   │      │
│   │  │ Welcome  │→ │ Auth &   │→ │Conversa-  │→ │ Document     │   │      │
│   │  │ Screen   │  │ Consent  │  │tional     │  │ Scanner      │   │      │
│   │  └──────────┘  └──────────┘  │Intake     │  └──────────────┘   │      │
│   │                              └───────────┘         │            │      │
│   │  ┌──────────┐  ┌──────────┐  ┌───────────┐        ▼            │      │
│   │  │ Complete  │← │ Summary  │← │ Triage    │  ┌──────────────┐  │      │
│   │  │ Screen   │  │ Confirm  │  │ Alert     │  │ Verification │  │      │
│   │  └──────────┘  └──────────┘  └───────────┘  └──────────────┘  │      │
│   └──────────────────────────────────────────────────────────────────┘      │
│         │  WebSocket (real-time)                │  REST API                  │
│         │  Voice input/output                   │  Document upload           │
└─────────┼───────────────────────────────────────┼───────────────────────────┘
          │                                       │
┌─────────┼───────────────────────────────────────┼───────────────────────────┐
│         ▼              INTELLIGENCE LAYER       ▼                           │
│                                                                             │
│   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌──────────────┐  │
│   │ Dialogue     │   │ Schema      │   │ Document    │   │ Summary      │  │
│   │ Manager      │   │ Generator   │   │ Intelligence│   │ Generator    │  │
│   │ (FSM+Policy) │   │ (Stage 1)   │   │ Pipeline    │   │ (Module C)   │  │
│   └──────┬───────┘   └──────┬──────┘   └──────┬──────┘   └──────┬───────┘  │
│          │                  │                  │                 │          │
│   ┌──────┴──────────────────┴──────────────────┴─────────────────┴───────┐  │
│   │                   UNIFIED PATIENT RECORD                              │  │
│   │          (Pydantic-validated, provenance-tagged)                      │  │
│   └──────────────────────────┬────────────────────────────────────────────┘  │
│                              │                                              │
│   ┌──────────┐  ┌────────────┴────────────┐  ┌──────────────────────────┐  │
│   │ Safety   │  │ Conversation Engine     │  │ Field Selector           │  │
│   │ Watchdog │  │ (Extract + Generate)    │  │ (Priority-based, no LLM) │  │
│   └──────────┘  └─────────────────────────┘  └──────────────────────────┘  │
│                                                                             │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                        AI SERVICE LAYER                              │  │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐    │  │
│   │  │ Gemini   │  │ Sarvam   │  │ Sarvam   │  │ Gemini VLM       │    │  │
│   │  │ Flash    │  │ Saaras   │  │ Bulbul   │  │ (Doc Vision)     │    │  │
│   │  │ (NLP)    │  │ v3 (ASR) │  │ v3 (TTS) │  │                  │    │  │
│   │  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘    │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
          │
┌─────────┼───────────────────────────────────────────────────────────────────┐
│         ▼            INTEGRATION LAYER                                      │
│                                                                             │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│   │ ABDM Gateway │  │ FHIR R4      │  │ Hospital     │  │ Consent      │  │
│   │ (M1/M2/M3)   │  │ Transformer  │  │ HIS/EMR      │  │ Manager      │  │
│   │              │  │ (NRCeS)      │  │ Adapter      │  │ (HIE-CM)     │  │
│   └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                                             │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                     │
│   │ HFR/HPR      │  │ Fidelius     │  │ Audit        │                     │
│   │ Registries   │  │ Crypto       │  │ Logger       │                     │
│   └──────────────┘  └──────────────┘  └──────────────┘                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Module A — Conversational History-Taking Engine

### 3.1 Two-Stage LLM Pipeline

The conversational engine uses a **two-stage LLM pipeline** that cleanly separates the expensive one-time schema generation from the cheap per-turn conversation loop:

```
┌─────────────────────────────────────────────────────────────┐
│  STAGE 1 — SCHEMA GENERATION (Once per encounter)           │
│                                                             │
│  Chief Complaint + Demographics                             │
│       │                                                     │
│       ▼                                                     │
│  ┌─────────────┐    ┌─────────────────┐                    │
│  │ Complaint    │───▶│ Schema Generator │                    │
│  │ Classifier   │    │ (Gemini Flash)   │                    │
│  │ (LLM call)  │    │ Generates 15-30  │                    │
│  └─────────────┘    │ complaint-specific│                    │
│                     │ clinical fields   │                    │
│                     └────────┬──────────┘                    │
│                              │                               │
│                     ┌────────▼──────────┐                    │
│                     │ Safety Floor      │                    │
│                     │ Merge             │                    │
│                     │ (Force-insert     │                    │
│                     │  must-ask fields) │                    │
│                     └────────┬──────────┘                    │
│                              │                               │
│                     ┌────────▼──────────┐                    │
│                     │ Validated Schema  │                    │
│                     │ (Source of truth   │                    │
│                     │  for interview)   │                    │
│                     └───────────────────┘                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  STAGE 2 — PER-TURN LOOP (Repeats until complete)           │
│                                                             │
│  Patient Response (voice or tap)                            │
│       │                                                     │
│       ▼                                                     │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────┐  │
│  │ EXTRACT      │──▶│ SAFETY CHECK │──▶│ SELECT NEXT    │  │
│  │ Field values │   │ Deterministic│   │ FIELD          │  │
│  │ from patient │   │ rule scan    │   │ (Priority-     │  │
│  │ message      │   │ every turn   │   │  based, no LLM)│  │
│  │ (LLM call)   │   └──────────────┘   └───────┬────────┘  │
│  └──────────────┘                               │           │
│                                        ┌────────▼────────┐  │
│                                        │ GENERATE         │  │
│                                        │ QUESTION          │  │
│                                        │ (LLM call —       │  │
│                                        │  phrasing only)   │  │
│                                        └─────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Stage 1: Dynamic Schema Generation

When the patient states their chief complaint, a **heavier LLM model** (called once per encounter, not per turn) generates a complaint-specific clinical interview schema. This schema is not a generic questionnaire — it is a dynamic, clinically-grounded specification of exactly which data points matter for *this* patient's *this* complaint.

**How it works:**

1. **Complaint Classification:** The chief complaint (in any of 11 supported Indian languages) is classified into one of a fixed category set: `pain`, `fever`, `respiratory`, `gi`, `neuro`, `cardiac`, `musculoskeletal`, `skin`, `urinary`, `gynecological`, `psychiatric`, `ent`, `eye`, `general`.

2. **Schema Generation Prompt:** The classified category, patient demographics (age, sex), and a curated safety-floor field list are injected into a system prompt grounded by Macleod's Clinical Examination framework. The LLM generates 15–30 complaint-specific fields with:
   - `id` — unique snake_case identifier
   - `question_intent` — plain-language intent for the field
   - `priority` — `critical` | `high` | `medium` | `optional`
   - `red_flag` — boolean: does a positive answer indicate emergency?
   - `category` — `HPI` | `PMH` | `DH` | `FH` | `SH` | `ROS` | `red_flag_check`
   - `conditional_on` — dependency field (e.g., `"radiation:yes"`)

3. **Safety Floor Merge:** A hand-curated, category-indexed library of must-ask red-flag fields is **force-inserted** into the generated schema, regardless of what the LLM produced. This is the non-negotiable safety floor — the LLM elaborates *on top of* this floor, never from scratch.

4. **Fallback Chain:**
   - Primary model: Gemini Flash (heavier, higher quality)
   - Fallback model: Gemini Flash Lite (lighter, faster)
   - Static fallback: Safety floor + universal baseline fields (ensures the app never breaks even if all LLM calls fail)

**Example Generated Schema (for "chest pain, 55M"):**

```json
{
  "chief_complaint": "chest pain",
  "fields": [
    {"id": "pain_location",         "priority": "critical", "red_flag": false,  "category": "HPI"},
    {"id": "pain_onset",            "priority": "critical", "red_flag": true,   "category": "HPI"},
    {"id": "pain_character",        "priority": "critical", "red_flag": true,   "category": "HPI"},
    {"id": "pain_radiation",        "priority": "critical", "red_flag": true,   "category": "HPI"},
    {"id": "pain_severity",         "priority": "critical", "red_flag": true,   "category": "HPI"},
    {"id": "associated_sweating",   "priority": "critical", "red_flag": true,   "category": "red_flag_check"},
    {"id": "breathlessness_at_rest","priority": "critical", "red_flag": true,   "category": "red_flag_check"},
    {"id": "syncope_presyncope",    "priority": "critical", "red_flag": true,   "category": "red_flag_check"},
    {"id": "aggravating_factors",   "priority": "high",     "red_flag": false,  "category": "HPI"},
    {"id": "prior_cardiac_history", "priority": "high",     "red_flag": false,  "category": "PMH"},
    {"id": "current_medications",   "priority": "high",     "red_flag": false,  "category": "DH"},
    {"id": "family_heart_disease",  "priority": "medium",   "red_flag": false,  "category": "FH"},
    {"id": "smoking_status",        "priority": "medium",   "red_flag": false,  "category": "SH"},
    {"id": "diabetes_hypertension", "priority": "medium",   "red_flag": false,  "category": "PMH"}
  ]
}
```

### 3.3 Stage 2: Per-Turn Extract → Select → Generate Loop

Each conversational turn follows a strict 7-step pipeline:

```
STEP 1: Record Patient's Message
    Patient says "the pain started yesterday morning and it goes into my left arm"

STEP 2: EXTRACTION (LLM call — cheap model, low temperature)
    Extract field values from patient's message against unfilled fields.
    Schema-bound contract: only extract what was CLEARLY stated.
    Per-field confidence scoring (0.5–1.0).
    Opportunistic extraction: fills MULTIPLE open fields from a single utterance.

    Output: {"pain_onset": {"value": "yesterday morning", "confidence": 0.94},
             "pain_radiation": {"value": "left arm", "confidence": 0.91}}

STEP 3: Update Filled State (source of truth)
    Merge extracted values into the patient record with provenance tags.

STEP 4: SAFETY CHECK (deterministic — NO LLM)
    Run ALL safety rules against the full accumulated slot set.
    If red flag triggered → EMERGENCY_PROTOCOL interrupt → halt interview.

STEP 5: COMPLETION CHECK (deterministic — NO LLM)
    All critical + high priority fields filled? → advance to next stage.
    Max turns reached (safety cap: 30)? → advance.

STEP 6: FIELD SELECTION (deterministic — NO LLM)
    Select next unfilled field by priority order:
    1. critical + red_flag (patient safety first)
    2. critical non-red-flag
    3. high priority
    4. medium priority
    5. optional (only if time permits)
    Skip fields whose conditional_on prerequisite is unmet.

STEP 7: QUESTION GENERATION (LLM call — constrained)
    Generate ONE natural, empathetic question in the patient's language.
    Generate 3–6 contextual tap-to-answer options.
    Acknowledge patient's prior answer before asking next question.
    Output schema-bound: {spoken_text, suggested_options, reasoning}
```

### 3.4 Dynamic Schema Expansion via Conversational Feedback

A critical innovation in this architecture is the ability to **dynamically expand the schema during the interview** based on emergent clinical information. When the extraction step identifies clinically significant information that maps to no existing field in the schema, the system triggers a **mid-interview schema augmentation**:

```
┌──────────────────────────────────────────────────────────────────┐
│  SCHEMA EXPANSION TRIGGER                                        │
│                                                                  │
│  During extraction, if patient mentions something clinically     │
│  significant that doesn't map to any existing schema field:      │
│                                                                  │
│  1. The LLM extraction returns unrecognized_mention (non-null)   │
│  2. Dialogue Manager evaluates: is this clinically relevant?     │
│  3. If yes → call schema_expander with:                          │
│     - Current schema                                             │
│     - Unrecognized mention                                       │
│     - Filled state so far                                        │
│     - Chief complaint context                                    │
│                                                                  │
│  4. Schema expander generates 1–3 new fields:                    │
│     - Inserted at appropriate priority level                     │
│     - Validated against safety floor                             │
│     - Conditional dependencies resolved                          │
│                                                                  │
│  5. Expanded schema becomes the new source of truth              │
│     - Field selector naturally picks up new fields               │
│     - No disruption to the interview flow                        │
│                                                                  │
│  SAFETY CONSTRAINTS:                                             │
│  - Maximum 5 expansion events per encounter                      │
│  - New fields inherit priority <= "high" (never "critical")      │
│  - All expansions logged for physician review                    │
└──────────────────────────────────────────────────────────────────┘
```

**Example:** A patient presenting with "knee pain" mentions during the HPI that they recently returned from a rural area. The extraction step captures this as an `unrecognized_mention: "recent travel to rural area"`. The schema expander recognizes this is clinically relevant (Lyme disease, chikungunya, other vector-borne arthropathies in India) and generates new fields: `recent_travel_details` (high priority), `insect_bite_exposure` (high priority), `fever_with_joint_pain` (high, red_flag).

This mimics how a real physician dynamically adjusts their line of questioning based on unexpected information — the schema is not static, but it is always **policy-governed**, never free-form.

### 3.5 Macro Finite State Machine (FSM)

The macro FSM governs the high-level patient journey. It is deliberately simple (~8 linear states) because all the clinical complexity is pushed down to Stage 1 (schema generation) and Stage 2 (per-turn loop).

```
INIT → DEMOGRAPHICS → CHIEF_COMPLAINT → SCHEMA_GENERATION → DYNAMIC_INTERVIEW
                                                                     │
                         ┌── clinic_mode includes "ayush"? ──────────┤
                         │ yes                                  no   │
                         ▼                                           │
               AYUSH_ASSESSMENT                                      │
              (composite state —                                     │
               config flag, never                                    │
               a patient toggle)                                     │
                         │                                           │
                         └──────────────┬────────────────────────────┘
                                        ▼
                              DOCUMENT_SCAN (Module B)
                                        ▼
                             SUMMARY_CONFIRMATION
                                        ▼
                       COMPLETE  →  push to HIS / ABDM

Global interrupts (available from every state):
  [red flag detected]  → EMERGENCY_PROTOCOL (bypass queue, page triage)
  [patient taps Help]  → STAFF_ASSIST (pause; resume same state on return)
  [patient taps Back]  → previous state (re-open for edits)
```

**Transition Rules:**
- Advance to next state when the field selector reports all critical+high fields filled, OR the patient explicitly signals completion.
- Each state can be entered with some fields pre-filled from document extraction or prior ABHA record — the system skips re-asking anything already known with high confidence, and instead runs a lightweight confirm-only pass.

### 3.6 AYUSH Assessment Mode

The AYUSH module loads **only when `clinic_mode` is `"ayush"` or `"integrative"`**, determined by:

1. **Appointment/token record** — if the patient checked in against an AYUSH OPD department code, `clinic_mode` resolves automatically from a `department_config` lookup.
2. **Kiosk-level default** — a kiosk deployed inside an Ayurveda OPD wing carries a fixed default.
3. **Staff-assisted override** — for walk-ins, front-desk staff set the department flag.

The patient never sees a mode toggle.

**What Belongs in the AYUSH Module (patient-reportable via conversation):**

| Dashavidha Pariksha Parameter | Self-Reportable? | Implementation |
|-------------------------------|:-----------------:|----------------|
| Prakriti (constitution) | Yes | Vata/Pitta/Kapha questionnaire |
| Vikriti (current imbalance) | Yes | Dosha symptom mapping |
| Sara (tissue quality) | Yes | Self-reported proxy questions |
| Samhanana (body build) | Partial | Partly self-report, partly camera/manual |
| Pramana (body measurements) | No | Manual entry / camera — not spoken history |
| Satmya (adaptability) | Yes | Conversational assessment |
| Sattva (mental resilience) | Yes | Conversational assessment |
| Ahara Shakti (digestive fire) | Yes | Agni assessment questions |
| Vyayama Shakti (exercise tolerance) | Yes | Conversational assessment |
| Vaya (age assessment) | Yes | Demographic + self-report |

**What Does NOT Belong in the Patient-Facing Module (Ashtavidha Pariksha):**

- Nadi (pulse) — requires physician palpation
- Jihva (tongue) — requires physician visual exam
- Sparsha (touch) — requires physician palpation
- Drik (vision/gaze) — requires physician observation

These route to a **physician-facing structured examination form** in the consultation screen, filled by the doctor during the visit — never asked of the patient at the kiosk.

---

## 4. Module B — Medical Document Intelligence Pipeline

### 4.1 Vision-Language Model Architecture

The document intelligence pipeline processes patient-uploaded physical medical documents (prescriptions, lab reports, discharge summaries, imaging reports) through a multi-stage pipeline that leverages **multimodal Vision-Language Models (VLMs)** for semantic understanding beyond simple character recognition.

```
DOCUMENT UPLOAD (camera capture / file upload)
     │
     ▼
┌────────────────────────────────────┐
│ PRE-PROCESSING                     │
│ - Orientation correction           │
│ - Deskewing & perspective fix      │
│ - Contrast enhancement             │
│ - Language/script detection        │
│ - Document type classification     │
│   (prescription | lab_report |     │
│    discharge_summary | imaging)    │
└────────────┬───────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────────┐
│ CONFIDENCE-GATED CASCADE                                       │
│                                                                │
│ PASS 1: Quick OCR (Tesseract 5 + medical dictionary)           │
│            │                                                    │
│      confidence >= 70%? ── YES ──> accept, proceed to NER      │
│            │                                                    │
│            NO                                                   │
│            │                                                    │
│ PASS 2: VLM Path (Gemini Vision)                               │
│  Processes entire page as a single visual unit                  │
│  Understands layout + handwriting + clinical context            │
│            │                                                    │
│      confidence >= 60%? ── YES ──> accept, proceed to NER      │
│            │                                                    │
│            NO                                                   │
│            │                                                    │
│      FLAG FOR MANUAL REVIEW                                     │
│      (image preserved, partial extraction shown to physician)   │
└────────────────────────────────────────────────────────────────┘
```

### 4.2 Why Vision-Language Models over Traditional OCR

Traditional OCR fails on Indian medical documents because:

1. **Handwritten prescriptions** are the norm in Indian OPDs — Tesseract and standard CRNN models trained on Latin-script datasets (like IAM) have poor generalization to Devanagari and regional scripts.
2. **Mixed-script documents** (Hindi + English, regional language + English) require semantic understanding of layout, not just character-level transcription.
3. **Medical abbreviations** ("tab.", "bid", "OD", "HS") need clinical context to interpret correctly.

VLMs (like Gemini Vision) process the **entire document as a single visual unit**, understanding:
- Visual layout and spatial relationships (which text is a medication name vs. dosage vs. instructions)
- Handwriting style (without needing script-specific training)
- Clinical shorthand and abbreviations in context
- Table structures in lab reports

### 4.3 Clinical Entity Extraction (NER)

After OCR/VLM text extraction, a specialized LLM call performs **clinical Named Entity Recognition** using target-prompting:

```json
{
  "extraction_schema": {
    "medications": [{"name": "str", "dose": "str", "frequency": "str", "route": "str"}],
    "diagnoses": ["str — mapped to SNOMED-CT where possible"],
    "lab_results": [{"test": "str", "result": "str", "unit": "str",
                     "reference_range": "str", "status": "normal|abnormal|critical"}],
    "procedures": ["str"],
    "vitals": [{"type": "str", "value": "str", "date": "str"}],
    "allergies": [{"substance": "str", "reaction": "str"}]
  }
}
```

**Critical Design Decision: Target Prompting over Summarization.** The extraction prompt forces the model to output structured field values, never a prose summary. This eliminates the hallucination risk where the model "fills in" clinical details it didn't actually read.

### 4.4 Chronological Timeline Construction

Extracted documents are automatically dated and ordered into a coherent medical timeline:

```
┌──────────────────────────────────────────────────────────────┐
│ PATIENT MEDICAL TIMELINE (auto-constructed)                   │
│                                                              │
│ 2024-03    Lab Report: HbA1c 8.2% (high)                    │
│            - Diagnosis: Type 2 DM — poorly controlled        │
│            - Started: Metformin 500mg BD                     │
│                                                              │
│ 2024-08    Prescription: Dr. Sharma, General Medicine        │
│            - Metformin 500mg → 1000mg BD (dose increase)     │
│            - Added: Glimepiride 1mg OD                       │
│                                                              │
│ 2025-01    Lab Report: HbA1c 7.1% (improved)                │
│            - Fasting glucose: 132 mg/dL (borderline)         │
│                                                              │
│ 2025-11    Discharge Summary: City Hospital                  │
│            - Admission: Chest pain, r/o MI                   │
│            - Diagnosis: Unstable Angina                      │
│            - Procedure: Coronary Angiography (normal)        │
│            - Discharge meds: Aspirin, Atorvastatin           │
│                                                              │
│ WARNING: HbA1c trending up → discuss with physician          │
│ WARNING: Cardiac history + current chest pain complaint      │
└──────────────────────────────────────────────────────────────┘
```

- **Abnormal value highlighting:** Out-of-range lab values are flagged automatically using standard reference ranges.
- **Drug interaction check:** Cross-references current medications from documents against newly prescribed medications.
- **Trend analysis:** Tracks longitudinal changes in key markers (HbA1c, BP, weight) across multiple documents.

---

## 5. Module C — Data Fusion & Physician Summary Engine

### 5.1 Unified Patient Record Schema

One object, written to by the macro-FSM, the conversation engine, the document pipeline, and read by the summary generator. Every value carries its own **provenance** and **confidence** — this is the backbone that makes extraction, AYUSH extension, and document merge all consistent with each other.

```json
{
  "session_id": "sess_8f2a...",
  "clinic_mode": "allopathic",
  "macro_state": "SUMMARY_CONFIRMATION",
  "language": "hi-IN",

  "patient_name": "Rajesh Kumar",
  "patient_age": 55,
  "patient_sex": "male",
  "abha_id": "91-1234-5678-9012",

  "chief_complaint": {
    "value": "chest pain since yesterday",
    "category": "cardiac",
    "confidence": 0.97,
    "source": "conversation"
  },

  "dynamic_schema": { "fields": [ "..." ] },

  "filled_state": {
    "pain_onset":     {"value": "yesterday morning",  "confidence": 0.94, "source": "conversation"},
    "pain_character":  {"value": "squeezing, tight",   "confidence": 0.89, "source": "conversation"},
    "pain_radiation":  {"value": "left arm",           "confidence": 0.91, "source": "conversation"},
    "diabetes":        {"value": "Type 2 DM",          "confidence": 0.88, "source": "document:doc_1"},
    "current_meds":    {"value": "Metformin 1g BD",    "confidence": 0.92, "source": "document:doc_1"}
  },

  "conversation_history": [
    {"role": "assistant", "content": "...", "turn": 0, "category": "CHIEF_COMPLAINT"},
    {"role": "patient",   "content": "...", "turn": 1, "category": "HPI"}
  ],

  "document_extractions": [
    {
      "doc_id": "doc_1",
      "doc_type": "prescription",
      "ocr_path": "vlm",
      "ocr_confidence": 0.87,
      "entities": {
        "medications": [{"name": "Metformin", "dose": "1000mg", "frequency": "BD"}],
        "diagnoses": ["Type 2 Diabetes Mellitus"]
      },
      "extraction_date": "2025-11-15"
    }
  ],

  "contradictions": [
    {
      "field": "diabetes",
      "conversation_value": "no diabetes",
      "document_value": "Type 2 DM — Metformin prescribed",
      "status": "unresolved_flag_for_physician"
    }
  ],

  "red_flags": [],
  "clinician_notes": [],

  "schema_expansions": [
    {"trigger": "patient mentioned rural travel", "fields_added": ["travel_details", "insect_bite"]}
  ]
}
```

### 5.2 Provenance-Tagged Data Merge

Every data point in the patient record carries a provenance tag indicating its source:

| Source Tag | Meaning | Trust Level |
|-----------|---------|-------------|
| `"conversation"` | Patient directly stated in interview | Medium-high |
| `"opportunistic"` | Extracted from patient speech alongside another answer | Medium |
| `"document:doc_1"` | Extracted from uploaded document #1 | High (printed), Medium (handwritten) |
| `"abha_record"` | Retrieved from existing ABHA health records | High |
| `"schema_default"` | Pre-filled from schema metadata | High |

When both conversation and document data exist for the same clinical field, the system **never silently auto-resolves** the conflict. Both values are preserved, and a contradiction entry is created for physician review.

### 5.3 Contradiction Detection & Resolution

```
CONTRADICTION HANDLING

When the same clinical field has values from different sources with conflicting content:

1. DETECT: String-similarity + semantic comparison
   "no diabetes" (conversation) vs "T2DM" (document)

2. PRESERVE BOTH: Never discard either value
   Never let the LLM decide which source is "true"

3. FLAG: Create a highlighted diff for the physician
   ┌──────────────────────────────────────────────┐
   │ CONFLICTING INFORMATION                       │
   │ Patient said: "No diabetes"                   │
   │ Document shows: Metformin 1g BD prescribed    │
   │                 Diagnosis: Type 2 DM          │
   │                                               │
   │ [Accept Document] [Accept Patient] [Discuss]  │
   └──────────────────────────────────────────────┘

4. RESOLVE: Physician marks final determination
   Resolution logged in audit trail
```

### 5.4 Structured Clinical Summary Generation

After the interview and document scanning are complete, a **summary generator** (heavier LLM model, called once) synthesizes everything into a physician-ready clinical summary in standard format:

```
┌──────────────────────────────────────────────────────────────┐
│ CLINICAL SUMMARY — Rajesh Kumar, 55M                         │
│ Generated: 29 Aug 2026, 14:30 IST | Session: sess_8f2a      │
│                                                              │
│ CHIEF COMPLAINT:                                             │
│ Squeezing chest pain since yesterday morning, radiating to   │
│ left arm, severity 7/10, with mild sweating.                 │
│                                                              │
│ HISTORY OF PRESENT ILLNESS:                                  │
│ 55-year-old male presenting with acute-onset retrosternal    │
│ chest tightness since yesterday morning. Pain is squeezing   │
│ in character, radiates to left arm, severity 7/10. Associated│
│ with mild diaphoresis. No syncope or breathlessness at rest. │
│                                                              │
│ PAST MEDICAL HISTORY:                                        │
│ - Type 2 Diabetes Mellitus (documented [D])                  │
│   WARNING: Patient denied — document confirms. VERIFY.       │
│                                                              │
│ MEDICATIONS & ALLERGIES:                                     │
│ - Metformin 1000mg BD (from prescription scan [D])           │
│ - Glimepiride 1mg OD (from prescription scan [D])           │
│ - NKDA                                                       │
│                                                              │
│ FAMILY HISTORY:                                              │
│ - Father: MI at age 60                                       │
│                                                              │
│ SOCIAL HISTORY:                                              │
│ - Ex-smoker (quit 5 years ago, 20 pack-years)               │
│                                                              │
│ PRIOR INVESTIGATIONS (from document scan):                   │
│ - HbA1c: 7.1% (Jan 2025) — trending down from 8.2%         │
│ - Coronary Angiography: Normal (Nov 2025)                    │
│                                                              │
│ [D] = Extracted from uploaded documents                      │
│ WARNING = Requires physician verification                    │
│                                                              │
│ [Edit] [Confirm & Save] [Add Notes]                          │
└──────────────────────────────────────────────────────────────┘
```

**Key Properties:**
- **Editable & Verifiable:** The physician retains full control — the summary is a draft to accept, amend, or reject, never an autonomous diagnosis.
- **Source-Traced:** Every clinical fact is traceable to either conversation or document extraction.
- **Bilingual Output:** Patient-facing audio confirmation in local language; physician-facing summary in English/Hindi.

---

## 6. Module D — ABDM/ABHA Integration & Consent Framework

### 6.1 ABHA Authentication Flow

```
PATIENT IDENTIFICATION AT KIOSK

STEP 1: Scan ABHA QR / Enter ABHA ID / Enter Aadhaar
         │
    Has ABHA? ── YES ──> Verify via ABDM Gateway (OTP/Bio)
         │                     │
         NO                    │
         │                     │
  Create new ABHA              │
  (M1 API flow)                │
  - Name, DOB                  │
  - Aadhaar/mobile             │
  - OTP verify                 │
         │                     │
         └─────────────────────┘
                  │
                  ▼
        ABHA ID linked to session
        Patient PHR records available
        Prior history pre-filled (if any)
```

### 6.2 FHIR R4 Resource Mapping

The patient record is transformed into FHIR R4 Bundles conforming to NRCeS (National Resource Centre for EHR Standards) implementation guides:

| MediKiosk Data | FHIR R4 Resource | FHIR Profile |
|---------------|-------------------|-------------|
| Patient demographics | `Patient` | NRCeS Patient Profile |
| Chief complaint + HPI | `Condition` | NRCeS Condition Profile |
| Medications | `MedicationRequest` | NRCeS MedicationRequest |
| Allergies | `AllergyIntolerance` | NRCeS AllergyIntolerance |
| Lab results | `DiagnosticReport` + `Observation` | NRCeS DiagnosticReport |
| Procedures/surgeries | `Procedure` | NRCeS Procedure |
| Family history | `FamilyMemberHistory` | HL7 FHIR Core |
| Social history | `Observation` (social history) | HL7 FHIR Core |
| Clinical summary | `Composition` | NRCeS OPRecord Profile |
| Encounter context | `Encounter` | NRCeS Encounter |
| Red flags/alerts | `Flag` | HL7 FHIR Core |
| Scanned documents | `DocumentReference` | NRCeS DocumentReference |

**Terminology Standards Used:**
- **SNOMED CT** — for diagnoses, procedures, clinical findings
- **LOINC** — for lab test identifiers
- **ICD-11** — for diagnostic coding
- **ATC** — for medication classification

### 6.3 Consent Manager (HIE-CM) Integration

```
CONSENT FLOW (ABDM HIE-CM compliant)

1. CONSENT REQUEST
   Patient arrives at kiosk → system requests consent for:
   - Voice recording and processing
   - Document scanning and digitization
   - Data sharing with treating physician
   - Linking to ABHA personal health record

2. GRANULAR CONSENT
   Patient grants/denies each category separately:
   [x] Voice interview (required for intake)
   [x] Document scanning
   [x] Share with my doctor today
   [ ] Store in my ABHA record (optional)
   Audio-guided explanation in patient's language

3. CONSENT ARTIFACT
   Generated per ABDM spec:
   - Purpose: "Clinical intake for OPD consultation"
   - Time-bound: Valid for this encounter only
   - Revocable: Patient can revoke at any point
   - Encrypted: Signed with Fidelius protocol

4. DATA PUSH (after physician confirmation)
   FHIR Bundle → encrypted via Fidelius (ECDH, NIST P-256)
   → pushed to ABDM Gateway → linked to patient's PHR

5. SESSION TERMINATION
   - Temporary voice/image data purged immediately
   - Only structured FHIR data persists (with consent)
   - Audit log retained for compliance
```

### 6.4 DPDP Act 2023 Compliance

| DPDP Requirement | MediKiosk Implementation |
|-----------------|--------------------------|
| Purpose limitation | Consent specifies "clinical intake for OPD consultation" only |
| Data minimization | Only clinically relevant data collected; no extraneous profiling |
| Storage limitation | Temporary session data (voice, images) purged post-submission |
| Consent & notice | Audio-guided consent in patient's language before any data collection |
| Data principal rights | Patient can view, correct, and request deletion via ABHA app |
| Data fiduciary obligations | Hospital acts as data fiduciary; MediKiosk as processor |
| Cross-border restriction | All processing within Indian infrastructure; no foreign API calls for PHI |
| Breach notification | Audit logging enables 72-hour breach notification compliance |

---

## 7. Voice & Language Architecture

### 7.1 Speech-to-Text (ASR)

**Primary Provider: Sarvam AI Saaras v3**

- **Coverage:** 11 Indian languages + English — Hindi, Tamil, Telugu, Kannada, Bengali, Marathi, Gujarati, Malayalam, Punjabi, Odia, English (Indian accents)
- **Code-mixing support:** Handles Hindi-English and regional-English code-switching natively, which is common in Indian clinical settings
- **Streaming capability:** WebSocket-based real-time streaming with partial transcripts — reduces perceived latency
- **Medical domain optimization:** Trained on 1M+ hours of diverse Indian audio data with clinical terminology awareness

**Audio Pipeline:**

```
Patient speaks
     │
     ▼
Browser MediaRecorder (WebM/Opus, 200ms chunks)
     │
     ▼
Audio Level Monitor (visual feedback — mic is active)
     │
     ▼
Minimum duration gate (500ms)
(prevents accidental taps from sending empty audio)
     │
     ▼
POST /api/stt → Sarvam Saaras v3
     │
     ▼
Transcript + detected language
     │
     ▼
Conversation Engine (extraction)
```

### 7.2 Text-to-Speech (TTS)

**Primary Provider: Sarvam AI Bulbul v3**

- **Natural prosody:** Context-aware intonation that sounds warm, not robotic
- **Text chunking:** Automatic sentence-boundary splitting for long responses (Sarvam 500-char limit per request)
- **Playback:** WAV audio streamed to browser for immediate playback

### 7.3 Multilingual & Code-Mixing Support

The entire system is designed for **language-agnostic operation**:

1. **Patient selects language** at welcome screen
2. **ASR** transcribes in the selected language (with code-mixing handling)
3. **LLM extraction** understands the transcript regardless of language (Gemini is multilingual)
4. **Filled state** stores values in English (for structured storage and FHIR compatibility)
5. **LLM question generation** outputs in the patient's selected language with native script
6. **TTS** speaks in the patient's language
7. **Physician summary** is generated in English/Hindi (physician's preference)

---

## 8. Safety & Red-Flag Architecture

### 8.1 Three-Layer Safety Model

```
SAFETY ARCHITECTURE

LAYER 1: DETERMINISTIC RULE ENGINE (Sole interrupt authority)
  - Runs EVERY turn, on the FULL accumulated filled_state
  - Category-indexed rules (cardiac, neuro, respiratory...)
  - Keyword/threshold matching with Hindi/regional variants
  - SOLE gate for EMERGENCY_PROTOCOL interrupt
  - Deterministic and auditable — defensible to safety committee

  Example rules:
   - Chest pain + arm/jaw radiation + sweating → CARDIAC_ACS
   - Focal weakness + speech difficulty → STROKE_FAST
   - Breathlessness at rest → SEVERE_RESPIRATORY_DISTRESS
   - Neck stiffness + fever → MENINGITIS_SUSPECT
   - Suicidal ideation → IMMEDIATE_REFERRAL

LAYER 2: ML SEVERITY SCORER (Refines triage priority)
  - Fine-tuned clinical NLP model for borderline cases
  - Ranks patients in the triage queue by severity
  - CANNOT suppress a Layer 1 flag
  - CANNOT independently trigger an interrupt

LAYER 3: LLM PATTERN REASONING (Candidate rule proposer)
  - Catches complex multi-symptom patterns the rule list didn't anticipate
  - Must emit explanation mapping to a specific rule
  - Any LLM-raised flag = candidate for Layer 1 review
  - Escalated to human reviewer — NEVER auto-fires
```

### 8.2 Authority Hierarchy & Disagreement Policy

| Scenario | Action |
|----------|--------|
| Layer 1 fires, Layers 2 & 3 agree | Standard red-flag interrupt. Patient sees triage alert. |
| Layer 1 fires, Layer 2 disagrees | **Layer 1 wins.** Interrupt proceeds. Layer 2 disagreement logged. |
| Layer 1 silent, Layer 3 detects pattern | **No interrupt.** Pattern logged as candidate rule. Human reviewer evaluates. |
| All layers disagree | **Escalate — take the union of flags.** The acceptable error is a false positive, not a false negative. |

**Design Principle:** The rule layer, not the LLM, stands between a patient having a cardiac event and getting flagged. An LLM call failing or being slow must **never** be a single point of failure for that decision.

### 8.3 Must-Ask Safety Floor (Category-Indexed)

| Category | Must-Ask Red Flags |
|----------|-------------------|
| **Cardiac** | Chest pain radiation (arm/jaw/back), sweating/nausea, breathlessness at rest, syncope |
| **Neurological** | Thunderclap headache, worst headache ever, focal deficit, speech difficulty, seizures, neck stiffness |
| **Respiratory** | Hemoptysis, breathlessness severity, inability to speak in sentences |
| **GI** | Blood in stool (melena), blood in vomit, unintentional weight loss |
| **Pain** | Severity 7+/10, radiation pattern, associated sweating/breathlessness |
| **Fever** | Rigors, rash with fever, neck stiffness (meningeal signs) |
| **Urinary** | Hematuria, urinary retention, fever with urinary symptoms |
| **Musculoskeletal** | Inability to bear weight, point tenderness over bone (fracture signs) |
| **All** | Suicidal ideation — immediate mental health referral |

---

## 9. Technology Stack & Deployment Architecture

### Core Technology Stack

| Layer | Technology | Role |
|-------|-----------|------|
| **Frontend** | React + Vite + TypeScript | Progressive Web App (touch + voice UI) |
| **Backend** | Python 3.11+ + FastAPI | REST + WebSocket API server |
| **Real-time Comm** | WebSocket | Bidirectional conversation loop |
| **LLM (NLP)** | Google Gemini Flash | Schema gen, extraction, question gen, doc NER, summary |
| **LLM (Vision)** | Google Gemini Vision | Multimodal document understanding |
| **ASR** | Sarvam AI Saaras v3 | 11 Indian languages, code-mixing, streaming |
| **TTS** | Sarvam AI Bulbul v3 | Natural voice synthesis, 11 languages |
| **OCR** | Tesseract 5 + medical dict | Fast first-pass for printed documents |
| **Data Validation** | Pydantic v2 | Schema validation, type safety |
| **HTTP Client** | httpx (connection-pooled) | Sarvam API calls with persistent connections |
| **Session Storage** | Redis (production) / In-memory (dev) | Session state management |
| **FHIR** | fhir.resources (Python) | FHIR R4 Bundle generation per NRCeS |
| **Encryption** | Fidelius (ECDH, NIST P-256) | ABDM-mandated health data encryption |
| **Audit Logging** | Structured JSON logs | Every extraction, flag, and state transition |

### Deployment Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    HOSPITAL NETWORK                       │
│                                                          │
│  KIOSK DEVICES (Patient-Facing)                          │
│  - React PWA on touchscreen + mic + camera               │
│  - Audio capture + VAD (Voice Activity Detection)        │
│  - Document camera / scanner                             │
│         │ HTTPS / WSS                                    │
│         ▼                                                │
│  APPLICATION SERVER (Hospital-Local)                     │
│  - FastAPI backend                                       │
│  - Dialogue Manager + FSM + Safety Watchdog              │
│  - Session management (Redis)                            │
│  - FHIR transformer + Audit logger                       │
│         │                                                │
│         ▼                                                │
│  INTEGRATION GATEWAY                                     │
│  - ABDM Gateway adapter (M1/M2/M3)                      │
│  - HIS/EMR connector                                     │
│  - HFR/HPR registry lookups                              │
│  - Fidelius encryption layer                             │
└──────────────────────────┬───────────────────────────────┘
                           │ Encrypted APIs
┌──────────────────────────▼───────────────────────────────┐
│  EXTERNAL SERVICES                                       │
│  - Gemini API (NLP+Vision)                               │
│  - Sarvam AI (ASR+TTS)                                   │
│  - ABDM Gateway (NHA)                                    │
└──────────────────────────────────────────────────────────┘
```

---

## 10. End-to-End Patient Journey

```
STEP 1: IDENTIFY & CONSENT (2–3 minutes)

Patient approaches kiosk → selects language → scans/enters
ABHA ID (or registers new) → grants consent (audio-guided,
granular, in their language) → demographics captured

If prior ABHA records exist:
  → Known conditions pre-filled
  → System will confirm rather than re-ask

────────────────────────────────────────────────────────────

STEP 2: CHIEF COMPLAINT (30 seconds)

"What brings you here today?"
Patient speaks OR taps common complaint options

→ Complaint classified → dynamic schema generated
→ Safety floor merged → interview begins

────────────────────────────────────────────────────────────

STEP 3: ADAPTIVE INTERVIEW (5–8 minutes)

AI conducts structured-yet-natural clinical interview:
- HPI deep-dive (SOCRATES/OLDCARTS adapted to complaint)
- Past medical history (only if relevant to complaint)
- Medications & allergies
- Family history (only if hereditary factors matter)
- Social/lifestyle (only if clinically relevant)
- Review of systems (targeted screening)

Every question: voice + touch options, acknowledge + ask
Safety watchdog: scans for red flags after every answer
Schema expansion: adapts to unexpected but relevant info

If red flag detected → immediate triage alert

────────────────────────────────────────────────────────────

STEP 4: DOCUMENT SCAN (2–3 minutes, optional)

Patient uploads prescriptions, lab reports, discharge summaries
- VLM processes each document as a visual unit
- Extracts medications, diagnoses, lab values, procedures
- Constructs chronological medical timeline
- Flags abnormal values and potential drug interactions
- Merges extracted data into the unified patient record
- Detects contradictions between conversation and documents

────────────────────────────────────────────────────────────

STEP 5: SUMMARY & CONFIRM (1 minute)

AI generates structured clinical summary:
- Chief Complaint → HPI → PMH → Medications/Allergies →
  Family Hx → Social Hx → ROS → Prior Investigations
- Source-traced (conversation vs. document vs. ABHA)
- Contradictions highlighted for physician review
- Audio readback in patient's language for confirmation

────────────────────────────────────────────────────────────

STEP 6: PUSH & CONSULT

Summary → FHIR R4 Bundle → encrypted (Fidelius) →
pushed to Hospital HIS/EMR + linked to ABHA PHR

Physician sees complete, structured history on their screen
the moment the patient enters the consultation room.
Doctor reads in seconds, edits/confirms, and devotes the
full consultation to examination, reasoning, and counselling.

Session temporary data (voice, images) purged.
Only structured FHIR data persists (with consent).
```

---

## 11. Appendix: Workflow Diagrams

### A. Single Conversation Turn — End to End

```
Patient speaks (or taps)
   │
   ├── If voice:
   │     ▼
   │   Browser MediaRecorder (WebM/Opus)
   │     ▼
   │   POST /api/stt → Sarvam Saaras v3 → transcript
   │     │
   ├── If tap:
   │     ▼
   │   Selected option → value string
   │                    │
   │                    ▼
   │            WebSocket: {type: "input", value: "..."}
   │                    │
   │                    ▼
   │        ┌───────────────────────────────┐
   │        │ DIALOGUE MANAGER               │
   │        │                               │
   │        │ 1. Record message              │
   │        │ 2. LLM Extraction call         │
   │        │    → fill matched fields       │
   │        │ 3. Safety Watchdog scan        │
   │        │    → if red flag → INTERRUPT    │
   │        │ 4. Completion check            │
   │        │ 5. Field Selector              │
   │        │    → pick next unfilled field  │
   │        │ 6. LLM Question Generation    │
   │        │    → natural question + options │
   │        └───────────┬───────────────────┘
   │                    │
   │                    ▼
   │        WebSocket: {type: "ui", prompt: "...", options: [...]}
   │                    │
   │        ┌───────────┴───────────────────┐
   │        ▼                               ▼
   │   POST /api/tts → Sarvam         UI renders:
   │   Bulbul v3 → WAV audio          - Question text
   │        ▼                          - Tap options
   │   Browser plays audio             - Progress bar
   │
   └── Loop back to patient response
```

### B. Document Processing Pipeline

```
Patient uploads document image
   │
   ▼
POST /api/ocr (multipart)
   │
   ▼
Pre-processing (orientation, deskew, contrast)
   │
   ▼
Tesseract 5 quick pass → confidence score
   │
   ├── confidence >= 70% → accept OCR text
   │
   └── confidence < 70% → Gemini Vision (VLM)
                              │
                              ├── confidence >= 60% → accept VLM text
                              └── confidence < 60% → flag for review
   │
   ▼
LLM NER extraction (structured JSON output)
   │
   ├── medications: [{name, dose, frequency}]
   ├── diagnoses: [str]
   ├── lab_results: [{test, result, unit, range, status}]
   ├── procedures: [str]
   └── allergies: [{substance, reaction}]
   │
   ▼
Merge into unified patient record
   │
   ├── Provenance: "document:doc_N"
   ├── Cross-reference with conversation data
   └── Flag contradictions for physician review
```

### C. Safety Watchdog Execution

```
After EVERY filled_state update:
   │
   ▼
FOR EACH rule IN safety_rules:

  rule.check(filled_state)

  Rules include:
  - CARDIAC_ACS
  - STROKE_FAST
  - SEVERE_RESPIRATORY_DISTRESS
  - SIGNIFICANT_HEMOPTYSIS
  - GI_HEMORRHAGE
  - MENINGITIS_SUSPECT
  - FRACTURE_SUSPECT
  - SUICIDAL_IDEATION
  - URINARY_RETENTION

  Keywords include Hindi/regional variants
  (e.g., "pasina", "saans", "ek taraf")

   │
   Any rule triggered?
   │
   ├── YES → Create RedFlagEntry
   │         FSM → EMERGENCY_PROTOCOL
   │         UI → Triage Alert
   │         Physician paged
   │
   └── NO  → Continue normal interview flow
```

---

*This document is a design reference to guide implementation planning. It should be reviewed by a clinician, a DPDP/legal counsel, and an ABDM-certification body before production deployment. Performance figures and vendor claims should be validated against pilot data.*
