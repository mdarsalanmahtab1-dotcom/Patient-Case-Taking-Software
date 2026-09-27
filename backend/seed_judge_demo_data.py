"""
SwasthyaSync — Hackathon Judges Demo Data Seeder
Populates rich, clinically realistic, high-impact mock data for all SIH PS 26047 features:
1. Allopathy + AYUSH Departments
2. Doctors with active credentials (Dr. Sneha Roy, Dr. Rajesh Sharma, Vaidya Anand Mishra)
3. Staff & Admin accounts
4. Returning Family Members (Longitudinal EHR via phone 9876543210)
5. Emergency Red-Flag Patient (Top of Triage Queue)
6. Critical Lab Alert Patient (Platelets 18,000 / Dengue alert)
7. AYUSH Patient with 25 CCRAS Prakriti & Dosha findings
8. Waiting & In-Progress Patients for today
9. 7-Day Historical Completed Consultations for Admin Analytics & Impact Metrics
"""

import asyncio
import asyncpg
import json
import os
import uuid
import hashlib
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

load_dotenv()

def hash_pw(pwd: str) -> str:
    return hashlib.sha256(pwd.encode()).hexdigest()

import database

async def seed_demo_data(reset: bool = True):
    print("Initializing Database Pool...")
    await database.init_db_pool()
    if not database._pool:
        print("[ERROR] Database pool could not be initialized. Check SUPABASE_DB_URL!")
        return

    conn = await database._pool.acquire()

    if reset:
        print("Cleaning up old demo/test records...")
        await conn.execute("DELETE FROM staff_sessions")
        await conn.execute("DELETE FROM admin_notifications")
        await conn.execute("DELETE FROM system_logs")
        await conn.execute("DELETE FROM clinical_rules")
        await conn.execute("DELETE FROM clinical_summaries")
        await conn.execute("DELETE FROM uploaded_documents")
        await conn.execute("DELETE FROM patient_sessions")
        await conn.execute("DELETE FROM doctors")
        await conn.execute("DELETE FROM departments")
        await conn.execute("DELETE FROM patients")
        await conn.execute("DELETE FROM staff")
        print("Tables cleaned.")

    print("Seeding Departments...")
    depts = [
        (1, "General Medicine", True),
        (2, "Cardiology", False),
        (3, "AYUSH (Ayurveda)", False),
        (4, "Pediatrics", False),
        (5, "Orthopedics", False),
        (6, "Emergency & Casualty", False),
    ]
    for d_id, name, is_def in depts:
        await conn.execute(
            "INSERT INTO departments (dept_id, name, is_default) VALUES ($1, $2, $3) ON CONFLICT (dept_id) DO UPDATE SET name = EXCLUDED.name, is_default = EXCLUDED.is_default",
            d_id, name, is_def
        )

    print("Seeding Doctors & Staff...")
    docs = [
        ("doc_1", "doctor1", "doctor123", "Dr. Sneha Roy (MD, Gen Med)", 1, "MCI-2018-9821", 40, "Active", "Available", "Room 101 (General OPD)", "Day"),
        ("doc_2", "doctor2", "doctor123", "Dr. Rajesh Sharma (DM Cardio)", 2, "MCI-2014-4512", 30, "Active", "Available", "Room 102 (Cardio OPD)", "Day"),
        ("doc_3", "ayush_doc", "doctor123", "Vaidya Anand Mishra (BAMS, MD Ayu)", 3, "AYU-CCRAS-7741", 35, "Active", "Available", "Room 104 (AYUSH Center)", "Day"),
        ("doc_4", "doctor4", "doctor123", "Dr. Priya Nair (DCH Pediatrics)", 4, "MCI-2020-1123", 45, "Active", "Available", "Room 105 (Pediatrics)", "Day"),
        ("doc_5", "doctor5", "doctor123", "Dr. Amit Patel (MS Ortho)", 5, "MCI-2016-8834", 35, "Active", "On Break", "Room 106 (Ortho OPD)", "Day"),
    ]
    for doc_id, uname, pwd, name, d_id, lic, max_p, st, c_st, room, shift in docs:
        await conn.execute("""
            INSERT INTO doctors (doctor_id, username, password, full_name, dept_id, license_number, max_daily_patients, status, current_status, room_number, shift)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (doctor_id) DO UPDATE SET
                username = EXCLUDED.username,
                password = EXCLUDED.password,
                full_name = EXCLUDED.full_name,
                dept_id = EXCLUDED.dept_id,
                room_number = EXCLUDED.room_number,
                current_status = EXCLUDED.current_status
        """, doc_id, uname, pwd, name, d_id, lic, max_p, st, c_st, room, shift)

    # Seed Admin and Nurse in staff
    staff_members = [
        ("staff_admin", "Hospital Medical Superintendent", "ADMIN", hash_pw("admin123")),
        ("staff_nurse", "Nurse Sunita Rao (Triage Incharge)", "NURSE", hash_pw("nurse123")),
        ("staff_reception", "Aarav Gupta (OPD Helpdesk)", "RECEPTIONIST", hash_pw("reception123")),
    ]
    for s_id, s_name, s_role, s_hash in staff_members:
        await conn.execute("""
            INSERT INTO staff (id, name, role, password_hash)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, password_hash = EXCLUDED.password_hash
        """, s_id, s_name, s_role, s_hash)

    print("Seeding Patients...")
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%y%m%d")

    # 1. Family with phone 9876543210 (Returning Patient Demonstration)
    patients = [
        ("pat_ramesh", "91-2345-6789-0123", "ramesh.kumar@abdm", "aadhaar_h_1", "Ramesh Kumar", "9876543210", 58, "Male", "1966-04-12", 74.5, "172 cm", "Sector 4, Rohini, New Delhi", "138/88 mmHg, HR 78, SpO2 98%"),
        ("pat_sunita", "91-2345-6789-0124", "sunita.kumar@abdm", "aadhaar_h_2", "Sunita Kumar", "9876543210", 54, "Female", "1970-08-23", 62.0, "158 cm", "Sector 4, Rohini, New Delhi", "124/82 mmHg, HR 82, SpO2 99%"),
        ("pat_devendra", "91-9988-7766-5544", "devendra.rathore@abdm", "aadhaar_h_3", "Devendra Rathore", "9811223344", 52, "Male", "1972-11-05", 81.0, "175 cm", "C-Block, Saket, New Delhi", "155/95 mmHg, HR 104, SpO2 94%"),
        ("pat_rahul", "91-4455-6677-8899", "rahul.verma@abdm", "aadhaar_h_4", "Rahul Verma", "9988776655", 29, "Male", "1995-02-18", 68.0, "170 cm", "Mayur Vihar Ph-1, Delhi", "110/70 mmHg, HR 112, SpO2 97%, Temp 102.4F"),
        ("pat_meenakshi", "91-8899-0011-2233", "meenakshi.s@abdm", "aadhaar_h_5", "Meenakshi Sundaram", "9711554433", 44, "Female", "1980-07-14", 59.0, "162 cm", "Kailash Colony, New Delhi", "118/76 mmHg, HR 72, SpO2 99%"),
        ("pat_anita", "91-3344-5566-7788", "anita.sharma@abdm", "aadhaar_h_6", "Anita Sharma", "9871122334", 36, "Female", "1988-09-30", 56.5, "160 cm", "Janakpuri, New Delhi", "120/80 mmHg, HR 76, SpO2 98%"),
    ]

    for p_id, abha_id, abha_addr, a_hash, name, phone, age, gender, dob, wt, ht, addr, vitals in patients:
        await conn.execute("""
            INSERT INTO patients (patient_id, abha_id, abha_address, aadhaar_hash, full_name, phone_number, age, gender, date_of_birth, weight, height, address, vitals)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (patient_id) DO UPDATE SET
                full_name = EXCLUDED.full_name,
                phone_number = EXCLUDED.phone_number,
                vitals = EXCLUDED.vitals
        """, p_id, abha_id, abha_addr, a_hash, name, phone, age, gender, dob, wt, ht, addr, vitals)

    print("Seeding Today's Live Active Queue...")
    # Session 1: Emergency Red Flag (Devendra - Severe Angina / MI Alert)
    sess_redflag = "sess_demo_redflag"
    token_rf = f"TOKEN-{today_str}-1"
    qa_rf = [
        {"question": "Where is the pain located?", "answer": "Center of my chest, squeezing feeling"},
        {"question": "Does it spread anywhere?", "answer": "Yes, radiating down to my left arm and neck"},
        {"question": "Are you sweating or feeling dizzy?", "answer": "Yes, heavy cold sweating and shortness of breath"}
    ]
    state_rf = {
        "chief_complaint": "Crushing chest pain radiating to left arm with cold sweats",
        "site": "Substernal chest",
        "radiation": "Left shoulder and jaw",
        "severity": "9/10",
        "onset": "Acute (45 minutes ago)",
        "red_flag": "ACUTE_CORONARY_SYNDROME"
    }
    await conn.execute("""
        INSERT INTO patient_sessions (
            session_id, patient_id, token_id, department, chief_complaint, 
            interview_qa_json, filled_state_json, priority_flag, priority_reason, 
            session_status, doctor_id, token_number, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (session_id) DO NOTHING
    """, sess_redflag, "pat_devendra", token_rf, "Cardiology",
        "Severe crushing chest pain radiating to left arm with diaphoresis",
        json.dumps(qa_rf), json.dumps(state_rf), True,
        "EMERGENCY PROTOCOL: Acute Coronary Syndrome (Severe Angina with Radiation & Diaphoresis)",
        "WAITING", "doc_2", 1, now - timedelta(minutes=25)
    )

    # Session 2: Critical Lab Alert (Rahul Verma - Dengue Platelet Crash < 20,000)
    sess_lab = "sess_demo_labcrash"
    token_lab = f"TOKEN-{today_str}-2"
    qa_lab = [
        {"question": "How long have you had the fever?", "answer": "4 days of continuous high fever with severe eye pain"},
        {"question": "Have you noticed any red spots or bleeding?", "answer": "Small red petechial rashes on my arms"}
    ]
    state_lab = {
        "chief_complaint": "High fever with retro-orbital pain and petechial rash",
        "duration": "4 days",
        "temperature": "102.4 F",
        "rash": "Petechiae present"
    }
    await conn.execute("""
        INSERT INTO patient_sessions (
            session_id, patient_id, token_id, department, chief_complaint, 
            interview_qa_json, filled_state_json, priority_flag, priority_reason, 
            session_status, doctor_id, token_number, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (session_id) DO NOTHING
    """, sess_lab, "pat_rahul", token_lab, "General Medicine",
        "High fever for 4 days with severe joint pain and petechial rash",
        json.dumps(qa_lab), json.dumps(state_lab), True,
        "CRITICAL LAB WATCHDOG: Platelet Count 18,000 /µL (Thrombocytopenia Alert)",
        "WAITING", "doc_1", 2, now - timedelta(minutes=18)
    )

    # Insert OCR Lab document for Rahul
    doc_lab_id = "doc_dengue_cbc"
    labs_extracted = [
        {"test_name": "Platelet Count", "value": "18000", "unit": "/µL", "is_abnormal": True, "reference_range": "150000 - 450000"},
        {"test_name": "Hemoglobin", "value": "12.4", "unit": "g/dL", "is_abnormal": False, "reference_range": "13.0 - 17.0"},
        {"test_name": "Total Leucocyte Count (TLC)", "value": "2800", "unit": "/µL", "is_abnormal": True, "reference_range": "4000 - 11000"},
        {"test_name": "Hematocrit (PCV)", "value": "46.2", "unit": "%", "is_abnormal": True, "reference_range": "38.0 - 48.0"}
    ]
    meds_extracted = [
        {"drug_name": "Tab Dolo (Paracetamol)", "dosage": "650 mg", "frequency": "TDS (Thrice Daily)"}
    ]
    await conn.execute("""
        INSERT INTO uploaded_documents (
            document_id, session_id, file_path, document_type, ocr_raw_json, extracted_medications, extracted_labs
        ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb)
        ON CONFLICT (document_id) DO NOTHING
    """, doc_lab_id, sess_lab, "uploads/dengue_cbc_report.pdf", "LAB_REPORT",
        json.dumps({"document_type": "CBC_HAEMATOLOGY", "lab_name": "Dr. Lal PathLabs", "date": "2026-09-21"}),
        json.dumps(meds_extracted), json.dumps(labs_extracted)
    )

    # Session 3: AYUSH Ayurvedic Patient (Meenakshi - Amlapitta & CCRAS Prakriti)
    sess_ayush = "sess_demo_ayush"
    token_ayush = f"TOKEN-{today_str}-3"
    ayush_state = {
        "chief_complaint": "Amlapitta (Chronic Acid Peptic Disorder with Burning sensation in chest)",
        "prakriti_body_frame": "Medium build, warm skin (Pitta)",
        "prakriti_appetite_agni": "Tikshnagni (Intense sharp hunger, gets irritable if food is delayed)",
        "prakriti_bowel_koshtha": "Mridu Koshtha (Loose frequent stools with milk)",
        "prakriti_sleep_nidra": "Moderate sleep, waking with night sweats",
        "dosha_pitta": 68,
        "dosha_vata": 22,
        "dosha_kapha": 10,
        "dominant_prakriti": "Pittaja Prakriti (Pitta Dominant)",
        "namaste_code": "AYU-PRA-02"
    }
    await conn.execute("""
        INSERT INTO patient_sessions (
            session_id, patient_id, token_id, department, chief_complaint, 
            interview_qa_json, filled_state_json, priority_flag, priority_reason, 
            session_status, doctor_id, token_number, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (session_id) DO NOTHING
    """, sess_ayush, "pat_meenakshi", token_ayush, "AYUSH (Ayurveda)",
        "Chronic retrosternal burning, sour belching (Amlapitta) for 3 weeks",
        json.dumps([{"q": "Ahar-Vihar", "a": "High intake of spicy and sour food, late night meals"}]),
        json.dumps(ayush_state), False, None,
        "WAITING", "doc_3", 3, now - timedelta(minutes=12)
    )

    # Session 4: Returning Patient Follow-up (Ramesh Kumar - General Medicine)
    sess_ramesh = "sess_demo_ramesh"
    token_ramesh = f"TOKEN-{today_str}-4"
    await conn.execute("""
        INSERT INTO patient_sessions (
            session_id, patient_id, token_id, department, chief_complaint, 
            interview_qa_json, filled_state_json, priority_flag, priority_reason, 
            session_status, doctor_id, token_number, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (session_id) DO NOTHING
    """, sess_ramesh, "pat_ramesh", token_ramesh, "General Medicine",
        "Routine Hypertension review & mild morning headache",
        json.dumps([]), json.dumps({"bp": "138/88", "medication_adherence": "Regular"}), False, None,
        "WAITING", "doc_1", 4, now - timedelta(minutes=6)
    )

    # Session 5: Past Completed Session for Ramesh (Shows Previous Visit in Follow-up!)
    sess_ramesh_past = "sess_ramesh_past_visit"
    await conn.execute("""
        INSERT INTO patient_sessions (
            session_id, patient_id, token_id, department, chief_complaint, 
            interview_qa_json, filled_state_json, priority_flag, priority_reason, 
            session_status, doctor_prescription, doctor_id, token_number, created_at, completed_at
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (session_id) DO NOTHING
    """, sess_ramesh_past, "pat_ramesh", "TOKEN-260918-12", "General Medicine",
        "Essential Hypertension baseline evaluation",
        json.dumps([]), json.dumps({"bp": "144/92"}), False, None,
        "COMPLETED", "[DISCHARGE] Tab Telmisartan 40mg OD mornings. Low sodium diet. Follow up in 3 days.",
        "doc_1", 12, now - timedelta(days=3), now - timedelta(days=3, minutes=-14)
    )
    await conn.execute("""
        INSERT INTO clinical_summaries (
            summary_id, session_id, small_summary, full_detailed_summary, critical_highlights, doctor_consultation_notes, doctor_id, generated_at, doctor_signed_at
        ) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9)
        ON CONFLICT (session_id) DO NOTHING
    """, "sum_ramesh_past", sess_ramesh_past,
        "58-year-old male evaluated for stage 1 hypertension. Started on Telmisartan.",
        json.dumps({
            "clinical_narrative": "Patient presented with mild occipital headache. Vitals showed elevated BP 144/92 mmHg. Baseline renal panel normal. Initiated on ARB monotherapy.",
            "critical_highlights": ["Blood Pressure: 144/92 mmHg"],
            "assessment": "Stage 1 Essential Hypertension"
        }),
        json.dumps(["BP 144/92"]),
        "Tab Telmisartan 40mg once daily after breakfast. Restrict dietary sodium.",
        "doc_1", now - timedelta(days=3), now - timedelta(days=3)
    )

    print("Seeding 7-Day Historical Analytics Footfall & Red Flags...")
    # Seed 35 realistic historical sessions across the past 7 days
    complaints_pool = [
        ("Acute Viral Bronchitis with productive cough", "General Medicine", "doc_1", False, None),
        ("Chronic Lower Back Pain (Lumbago) radiating to thigh", "Orthopedics", "doc_5", False, None),
        ("Pediatric Acute Gastroenteritis with mild dehydration", "Pediatrics", "doc_4", False, None),
        ("Amlapitta with sour regurgitation and nausea", "AYUSH (Ayurveda)", "doc_3", False, None),
        ("Acute Myocardial Infarction (Chest heaviness)", "Cardiology", "doc_2", True, "Acute Coronary Syndrome"),
        ("Type 2 Diabetes Mellitus glycemic follow-up", "General Medicine", "doc_1", False, None),
        ("Dengue with severe thrombocytopenia (Platelets 15,000)", "General Medicine", "doc_1", True, "Severe Thrombocytopenia"),
        ("Allergic Rhinitis and nocturnal dry cough", "General Medicine", "doc_1", False, None),
        ("Osteoarthritis of Bilateral Knees (Grade 2)", "Orthopedics", "doc_5", False, None),
        ("Pediatric Bronchial Asthma exacerbation", "Pediatrics", "doc_4", True, "Severe Bronchospasm"),
        ("Sandhigata Vata (Osteoarthritic joint stiffness)", "AYUSH (Ayurveda)", "doc_3", False, None),
        ("Palpitations and ventricular premature complexes", "Cardiology", "doc_2", False, None),
    ]

    for day_offset in range(1, 8):
        day_date = now - timedelta(days=day_offset)
        # 4 to 6 sessions per day
        daily_count = 5 if day_offset % 2 == 0 else 6
        for idx in range(daily_count):
            c_complaint, c_dept, c_doc, is_prio, prio_reas = complaints_pool[(day_offset * 3 + idx) % len(complaints_pool)]
            h_sess_id = f"hist_sess_d{day_offset}_{idx}"
            h_token = f"TOKEN-{day_date.strftime('%y%m%d')}-{idx+1}"
            h_pat_id = f"pat_hist_{day_offset}_{idx}"

            # Create transient patient
            await conn.execute("""
                INSERT INTO patients (patient_id, full_name, phone_number, age, gender)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (patient_id) DO NOTHING
            """, h_pat_id, f"OPD Patient {day_offset}-{idx+1}", f"9800{day_offset:02d}{idx:04d}", 20 + (idx * 9) % 50, "Male" if idx % 2 == 0 else "Female")

            duration_min = 2.0 + (idx * 0.4)
            s_created = day_date.replace(hour=9 + idx, minute=10 + idx * 5)
            s_completed = s_created + timedelta(minutes=duration_min)

            await conn.execute("""
                INSERT INTO patient_sessions (
                    session_id, patient_id, token_id, department, chief_complaint,
                    priority_flag, priority_reason, session_status, doctor_prescription,
                    doctor_id, token_number, created_at, completed_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'COMPLETED', $8, $9, $10, $11, $12)
                ON CONFLICT (session_id) DO NOTHING
            """, h_sess_id, h_pat_id, h_token, c_dept, c_complaint, is_prio, prio_reas,
                f"Standard prescription advised for {c_complaint}. Follow-up in 1 week.",
                c_doc, idx + 1, s_created, s_completed)

            await conn.execute("""
                INSERT INTO clinical_summaries (
                    summary_id, session_id, small_summary, full_detailed_summary, doctor_consultation_notes, doctor_id, generated_at, doctor_signed_at
                ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)
                ON CONFLICT (session_id) DO NOTHING
            """, f"sum_hist_{day_offset}_{idx}", h_sess_id,
                f"Clinical encounter completed for {c_complaint}.",
                json.dumps({"clinical_narrative": f"Patient presented with {c_complaint}. Evaluated and advised treatment."}),
                "Advice given. Diet counseling performed.", c_doc, s_completed, s_completed)

    # Seed Admin Notifications
    print("Seeding Admin Notifications & System Logs...")
    await conn.execute("""
        INSERT INTO admin_notifications (notif_id, doctor_id, message, is_read, timestamp)
        VALUES 
            ($1, 'doc_2', '🚨 Emergency Priority Patient Devendra Rathore assigned to Cardiology (Room 102)', FALSE, $2),
            ($3, 'doc_1', '⚠️ Critical Lab Value detected: Rahul Verma Platelets < 20,000 /µL', FALSE, $4)
        ON CONFLICT (notif_id) DO NOTHING
    """, str(uuid.uuid4()), now - timedelta(minutes=24), str(uuid.uuid4()), now - timedelta(minutes=17))

    # Seed System Logs
    await conn.execute("""
        INSERT INTO system_logs (admin_email, action_type, target_id, timestamp)
        VALUES 
            ('admin@swasthyasync.com', 'SYSTEM_AUDIT_VERIFIED', 'RBAC_SECURITY_AUDIT', $1),
            ('admin@swasthyasync.com', 'DOCTOR_ROSTER_UPDATED', 'OPD_DAY_SHIFT', $2)
    """, now - timedelta(hours=2), now - timedelta(hours=1))

    # Seed Clinical Rules
    await conn.execute("""
        INSERT INTO clinical_rules (trigger_keyword, action_type, action_value)
        VALUES 
            ('chest pain', 'ELEVATE_PRIORITY', 'Cardiology Alert'),
            ('shortness of breath', 'ELEVATE_PRIORITY', 'Respiratory Distress'),
            ('platelets < 20000', 'CRITICAL_LAB_ALERT', 'Dengue Protocol'),
            ('creatinine > 3.0', 'CRITICAL_LAB_ALERT', 'Nephrology Consult')
    """)

    await database._pool.release(conn)
    await database.close_db_pool()
    print("==========================================================")
    print("[SUCCESS] SWASTHYASYNC HACKATHON DEMO DATA SEEDING COMPLETE!")
    print("==========================================================")
    print("Active Today's Patients in Queue:")
    print("  1. Devendra Rathore     -> [EMERGENCY PRIORITY] Chest Pain / Angina (Cardiology)")
    print("  2. Rahul Verma         -> [CRITICAL LAB ALERT] Platelets 18,000 /µL (General Medicine)")
    print("  3. Meenakshi Sundaram  -> [AYUSH 25-CCRAS] Amlapitta / Pitta Prakriti (AYUSH OPD)")
    print("  4. Ramesh Kumar        -> [RETURNING PATIENT] Hypertension Review (General Medicine)")
    print("Historical Footfall:")
    print("  40+ completed consults over last 7 days for Admin Analytics & Impact Metrics")
    print("Doctor Logins (password for all is 'doctor123'):")
    print("  - Dr. Sneha Roy (General Med) : username='doctor1'")
    print("  - Dr. Rajesh Sharma (Cardio)  : username='doctor2'")
    print("  - Vaidya Anand Mishra (AYUSH) : username='ayush_doc'")
    print("==========================================================")

if __name__ == "__main__":
    asyncio.run(seed_demo_data(reset=True))
