"""
SwasthyaSync Full Prototype Feature Verification Suite
Exhaustive end-to-end audit of all features before redeployment.
"""

import asyncio
import json
import os
import requests
import websockets
import time

BASE_URL = "http://127.0.0.1:8000"
WS_URL = "ws://127.0.0.1:8000/ws/session"

results = []

def record_result(name: str, passed: bool, details: str = ""):
    status = "PASS" if passed else "FAIL"
    results.append((name, status, details))
    print(f"[{status}] {name}: {details}")

async def run_verification():
    print("=" * 75)
    print("SWASTHYASYNC PROTOTYPE: BRUTAL END-TO-END FEATURE VERIFICATION AUDIT")
    print("=" * 75)

    # 1. Base & Health Endpoints
    print("\n--- 1. Base Connectivity & Health Probes ---")
    try:
        r = requests.get(f"{BASE_URL}/health", timeout=5)
        record_result("GET /health", r.status_code == 200 and r.json().get("status") == "healthy", f"HTTP {r.status_code}")
    except Exception as e:
        record_result("GET /health", False, str(e))

    try:
        r = requests.get(f"{BASE_URL}/", timeout=5)
        record_result("GET / (Root probe)", r.status_code == 200, f"HTTP {r.status_code}")
    except Exception as e:
        record_result("GET / (Root probe)", False, str(e))

    # 2. Master Data Endpoints
    print("\n--- 2. Clinical Master Data Endpoints ---")
    try:
        r = requests.get(f"{BASE_URL}/api/doctors", timeout=5)
        docs = r.json().get("doctors", [])
        record_result("GET /api/doctors", r.status_code == 200 and len(docs) >= 5, f"Found {len(docs)} doctors")
    except Exception as e:
        record_result("GET /api/doctors", False, str(e))

    try:
        r = requests.get(f"{BASE_URL}/api/departments", timeout=5)
        depts = r.json().get("departments", [])
        record_result("GET /api/departments", r.status_code == 200 and len(depts) >= 5, f"Found {len(depts)} departments")
    except Exception as e:
        record_result("GET /api/departments", False, str(e))

    # 3. Authentication & RBAC
    print("\n--- 3. Staff & Doctor Authentication ---")
    doc_token = None
    admin_token = None
    try:
        r = requests.post(f"{BASE_URL}/api/doctor/login", json={"username": "doctor1", "password": "doctor123"}, timeout=5)
        data = r.json()
        record_result("Doctor Direct Login", r.status_code == 200 and "doctor_id" in data, f"Doctor ID: {data.get('doctor_id')}")
    except Exception as e:
        record_result("Doctor Direct Login", False, str(e))

    try:
        r = requests.post(f"{BASE_URL}/api/auth/staff/login", json={"username": "doctor1", "password": "doctor123"}, timeout=5)
        data = r.json()
        doc_token = data.get("token")
        record_result("Staff Auth Doctor Token", r.status_code == 200 and doc_token is not None, f"Role: {data.get('role')}")
    except Exception as e:
        record_result("Staff Auth Doctor Token", False, str(e))

    try:
        r = requests.post(f"{BASE_URL}/api/auth/staff/login", json={"username": "staff_admin", "password": "admin123"}, timeout=5)
        data = r.json()
        admin_token = data.get("token")
        record_result("Staff Auth Admin Token", r.status_code == 200 and admin_token is not None, f"Role: {data.get('role')}")
    except Exception as e:
        record_result("Staff Auth Admin Token", False, str(e))

    # 4. Protected Doctor & Admin Routes
    print("\n--- 4. Protected Doctor & Admin Routes ---")
    if doc_token:
        try:
            r = requests.get(f"{BASE_URL}/api/doctor/doc_1/queue", headers={"Authorization": f"Bearer {doc_token}"}, timeout=5)
            record_result("GET /api/doctor/{id}/queue (Auth)", r.status_code == 200, f"HTTP {r.status_code} ({len(r.json())} queued)")
        except Exception as e:
            record_result("GET /api/doctor/{id}/queue (Auth)", False, str(e))

    if admin_token:
        try:
            r = requests.get(f"{BASE_URL}/api/admin/dashboard", headers={"Authorization": f"Bearer {admin_token}"}, timeout=5)
            d = r.json()
            record_result("GET /api/admin/dashboard (Auth)", r.status_code == 200 and "total_patients" in d, f"Total Patients: {d.get('total_patients')}")
        except Exception as e:
            record_result("GET /api/admin/dashboard (Auth)", False, str(e))

    try:
        r = requests.get(f"{BASE_URL}/api/triage/queue", timeout=5)
        triage_list = r.json().get("queue", [])
        record_result("GET /api/triage/queue", r.status_code == 200 and isinstance(triage_list, list), f"{len(triage_list)} active triage cases")
    except Exception as e:
        record_result("GET /api/triage/queue", False, str(e))

    try:
        r = requests.get(f"{BASE_URL}/api/admin/impact-metrics", timeout=5)
        im = r.json()
        record_result("GET /api/admin/impact-metrics", r.status_code == 200 and "total_patients" in im, f"Avg Intake: {im.get('avg_intake_minutes')} min | Saved: {im.get('estimated_hours_saved')} hrs")
    except Exception as e:
        record_result("GET /api/admin/impact-metrics", False, str(e))

    # 5. Speech Audio Services (STT & TTS)
    print("\n--- 5. Speech & Audio Services ---")
    try:
        r = requests.post(f"{BASE_URL}/api/tts", data={"text": "Namaste, SwasthyaSync me aapka swagat hai", "language": "hi-IN"}, timeout=15)
        record_result("POST /api/tts (Audio Synthesis)", r.status_code == 200 and r.headers.get("content-type") == "audio/wav", f"{len(r.content):,} bytes WAV")
    except Exception as e:
        record_result("POST /api/tts (Audio Synthesis)", False, str(e))

    if os.path.exists("test.ogg"):
        try:
            with open("test.ogg", "rb") as f:
                r = requests.post(f"{BASE_URL}/api/stt", files={"audio": ("test.ogg", f, "audio/ogg")}, data={"language": "hi-IN"}, timeout=15)
            record_result("POST /api/stt (Speech-to-Text)", r.status_code == 200, f"HTTP {r.status_code}")
        except Exception as e:
            record_result("POST /api/stt (Speech-to-Text)", False, str(e))

    # 6. Document Upload & Multimodal OCR
    print("\n--- 6. Multimodal OCR & Document Pipeline ---")
    if os.path.exists("logo.png"):
        try:
            with open("logo.png", "rb") as f:
                r = requests.post(f"{BASE_URL}/api/ocr", files={"file": ("doc.png", f, "image/png")}, timeout=30)
            ocr_res = r.json()
            record_result("POST /api/ocr (Resilient Cloud/Local Upload)", r.status_code == 200 and "is_valid_medical_document" in ocr_res, f"doc_id: {ocr_res.get('doc_id')}")
        except Exception as e:
            record_result("POST /api/ocr (Resilient Cloud/Local Upload)", False, str(e))

    # 7. PDF OPD Casesheet Generation
    print("\n--- 7. Medical Casesheet PDF Engine ---")
    try:
        # Fetch an existing session ID from database
        import database
        await database.setup_database()
        async with database._pool.acquire() as conn:
            sample_session = await conn.fetchval("SELECT session_id FROM patient_sessions ORDER BY created_at DESC LIMIT 1")
        if sample_session:
            r = requests.get(f"{BASE_URL}/api/summary/{sample_session}/pdf", timeout=30)
            record_result("GET /api/summary/{id}/pdf", r.status_code == 200 and len(r.content) > 10000, f"Generated {len(r.content):,} bytes PDF for {sample_session}")
        else:
            record_result("GET /api/summary/{id}/pdf", False, "No session found in DB")
    except Exception as e:
        record_result("GET /api/summary/{id}/pdf", False, str(e))

    # 8. Real-Time WebSocket Intake Flow: Vague Complaint -> Qualifier -> Schema -> Interview
    print("\n--- 8. Real-Time WebSocket Conversational AI Flow ---")
    try:
        async with websockets.connect(WS_URL, close_timeout=5) as ws:
            # Step A: Start Session
            await ws.send(json.dumps({
                "type": "start",
                "language": "en-IN",
                "patient_name": "Pooja Sharma",
                "patient_age": 34,
                "patient_sex": "female"
            }))
            init_msg = json.loads(await ws.recv())
            sess_id = init_msg.get("session_id")
            step_a_ok = init_msg.get("macro_state") == "CHIEF_COMPLAINT" and init_msg.get("screen") == "conversation"
            record_result("WS 1: Start Intake Session", step_a_ok, f"Session: {sess_id} | State: {init_msg.get('macro_state')}")

            # Step B: Vague Complaint ("pain")
            await ws.send(json.dumps({
                "type": "input",
                "input_type": "voice",
                "value": "pain"
            }))
            orb_b = json.loads(await ws.recv()) # orb_state: processing
            ui_b = json.loads(await ws.recv()) # UI instruction
            
            # Verify Complaint Qualifier intercepted "pain"
            qualifier_ok = (
                ui_b.get("macro_state") == "CHIEF_COMPLAINT" and
                len(ui_b.get("options", [])) > 0 and
                "where" in ui_b.get("prompt", "").lower()
            )
            record_result("WS 2: Complaint Qualifier Interception", qualifier_ok, f"Remained in CHIEF_COMPLAINT with {len(ui_b.get('options', []))} anatomical options")

            # Step C: Answer Qualifier ("Chest")
            await ws.send(json.dumps({
                "type": "input",
                "input_type": "tap",
                "value": "Chest"
            }))
            orb_c = json.loads(await ws.recv())
            ui_c = json.loads(await ws.recv())

            # Verify transition to DYNAMIC_INTERVIEW with Anchor field
            adv_ok = (
                ui_c.get("macro_state") == "DYNAMIC_INTERVIEW" and
                len(ui_c.get("prompt", "")) > 10
            )
            record_result("WS 3: Enriched Schema Gen & Anchor Question", adv_ok, f"Advanced to DYNAMIC_INTERVIEW. Prompt: \"{ui_c.get('prompt')[:65]}...\"")

            # Step D: Dynamic Interview Progression
            await ws.send(json.dumps({
                "type": "input",
                "input_type": "voice",
                "value": "It is in the center of my chest, started 1 hour ago"
            }))
            orb_d = json.loads(await ws.recv())
            ui_d = json.loads(await ws.recv())
            interview_ok = ui_d.get("macro_state") == "DYNAMIC_INTERVIEW"
            record_result("WS 4: Interview Progression & Slot Filling", interview_ok, f"Prompt: \"{ui_d.get('prompt')[:65]}...\"")

            # Step E: Emergency Safety Watchdog Trigger
            await ws.send(json.dumps({"type": "redflag"}))
            ui_e = json.loads(await ws.recv())
            emergency_ok = ui_e.get("macro_state") == "EMERGENCY_PROTOCOL" and ui_e.get("screen") == "triage_alert"
            record_result("WS 5: Emergency Protocol & Triage Alert", emergency_ok, f"State: {ui_e.get('macro_state')} | Screen: {ui_e.get('screen')}")

    except Exception as e:
        record_result("WebSocket Conversational AI Flow", False, str(e))

    # 9. AYUSH 14-Predictor CCRAS Invariant
    print("\n--- 9. AYUSH Clinical Parity & CCRAS Invariant ---")
    try:
        from schema_generator import generate_schema
        schema = generate_schema(
            chief_complaint="Severe acidity and burning sensation in stomach",
            patient_age=32,
            patient_sex="female",
            category="GI",
            clinic_mode="ayush"
        )
        fields = schema.get("fields", [])
        prakriti = [f for f in fields if f.get("category") == "PRAKRITI"]
        ayush_ok = len(prakriti) == 14 and len(fields) >= 17
        record_result("AYUSH CCRAS 14-Predictor Determinism", ayush_ok, f"{len(prakriti)} Prakriti fields + {len(fields) - len(prakriti)} HPI/Safety fields")
    except Exception as e:
        record_result("AYUSH CCRAS 14-Predictor Determinism", False, str(e))

    # 10. Summary & Scorecard
    print("\n" + "=" * 75)
    passed_count = sum(1 for _, st, _ in results if st == "PASS")
    total_count = len(results)
    pct = (passed_count / total_count) * 100 if total_count else 0
    print(f"VERIFICATION SUMMARY: {passed_count}/{total_count} FEATURES PASSED ({pct:.1f}%)")
    print("=" * 75)
    
    if passed_count == total_count:
        print(">>> ALL PROTOTYPE FEATURES VERIFIED FUNCTIONAL AND READY FOR REDEPLOYMENT <<<")
    else:
        print(">>> SOME FEATURES FAILED - DO NOT REDEPLOY UNTIL INVESTIGATED <<<")

if __name__ == "__main__":
    asyncio.run(run_verification())
