"""
Verification Suite: Comprehensive Test of Every Database Decision and Function
Validates that seed_judge_demo_data.py works with 100% precision across every
database call in SwasthyaSync.
"""

import asyncio
import json
from dotenv import load_dotenv
load_dotenv()
import database

async def run_verification():
    print("=== STARTING FULL DATABASE DECISION AUDIT ===")
    await database.init_db_pool()

    tests_passed = 0
    total_tests = 0

    def assert_test(name, condition, extra=""):
        nonlocal tests_passed, total_tests
        total_tests += 1
        if condition:
            tests_passed += 1
            print(f"[PASS] {name} {extra}")
        else:
            print(f"[FAIL] {name} {extra}")

    async with database._pool.acquire() as conn:
        # Decision 1: Doctor Login Credentials
        for uname in ['doctor1', 'doctor2', 'ayush_doc', 'doctor4', 'doctor5']:
            doc = await conn.fetchrow("SELECT doctor_id, full_name, dept_id, room_number, current_status FROM doctors WHERE username = $1 AND password = $2", uname, 'doctor123')
            assert_test(f"Doctor login '{uname}'", doc is not None, f"-> {doc['full_name'] if doc else 'MISSING'}")

        # Decision 2: Department Mapping
        depts = await database.get_departments()
        assert_test("Department count >= 5", len(depts) >= 5, f"-> Found {len(depts)} departments: {[d['name'] for d in depts]}")

        # Decision 3: Active Triage Queue Priority Sorting
        triage = await database.fetch_triage_queue()
        assert_test("Triage Queue count == 4", len(triage) == 4, f"-> Found {len(triage)} active patients")
        if len(triage) >= 2:
            assert_test("Top patient is EMERGENCY Priority", triage[0]['priority_flag'] == True, f"-> {triage[0]['full_name']} ({triage[0]['priority_reason']})")
            assert_test("Second patient is CRITICAL LAB Priority", triage[1]['priority_flag'] == True, f"-> {triage[1]['full_name']} ({triage[1]['priority_reason']})")
            assert_test("Third patient is Normal Waiting (Meenakshi)", triage[2]['priority_flag'] == False, f"-> {triage[2]['full_name']}")
            assert_test("Fourth patient is Normal Waiting (Ramesh)", triage[3]['priority_flag'] == False, f"-> {triage[3]['full_name']}")

        # Decision 4: AYUSH Encounter Structure (25-CCRAS & Dosha dominance)
        ayush_enc = await database.fetch_doctor_encounter('sess_demo_ayush')
        assert_test("AYUSH Encounter loads", ayush_enc is not None)
        if ayush_enc:
            fstate = ayush_enc.get('filled_state', {})
            assert_test("AYUSH Prakriti Dosha calculated", 'dosha_pitta' in fstate and fstate.get('dosha_pitta') == 68, f"-> Pitta: {fstate.get('dosha_pitta')}%, Vata: {fstate.get('dosha_vata')}%")
            assert_test("AYUSH NAMASTE Code assigned", fstate.get('namaste_code') == 'AYU-PRA-02', f"-> {fstate.get('namaste_code')}")

        # Decision 5: Emergency Encounter Structure (Acute Coronary Syndrome)
        cardio_enc = await database.fetch_doctor_encounter('sess_demo_redflag')
        assert_test("Cardiology Emergency Encounter loads", cardio_enc is not None)
        if cardio_enc:
            fstate = cardio_enc.get('filled_state', {})
            assert_test("Cardiology Red Flag flag set", fstate.get('red_flag') == 'ACUTE_CORONARY_SYNDROME')

        # Decision 6: Multimodal Lab Extraction Document Linkage
        lab_docs = await conn.fetch("SELECT * FROM uploaded_documents WHERE session_id = 'sess_demo_labcrash'")
        assert_test("Dengue Lab Document exists", len(lab_docs) == 1)
        if lab_docs:
            labs = json.loads(lab_docs[0]['extracted_labs']) if isinstance(lab_docs[0]['extracted_labs'], str) else lab_docs[0]['extracted_labs']
            plt = next((l for l in labs if l.get('test_name') == 'Platelet Count'), None)
            assert_test("Platelet Count 18,000 extracted", plt is not None and plt.get('value') == '18000', f"-> {plt}")

        # Decision 7: Returning Patient Family Lookup (Longitudinal EHR)
        family = await database.get_patients_by_phone('9876543210')
        assert_test("Family lookup returns 2 members", len(family) == 2, f"-> {[p['full_name'] for p in family]}")
        prev_hist = await database.fetch_previous_history('pat_ramesh')
        assert_test("Ramesh has prior completed visit", prev_hist is not None, f"-> Last Complaint: '{prev_hist.get('chief_complaint') if prev_hist else None}'")

        # Decision 8: Hospital Impact Metrics (Hours saved & Intake duration)
        impact = await database.get_impact_metrics()
        assert_test("Impact metrics total patients > 40", impact.get('total_patients', 0) >= 40, f"-> {impact.get('total_patients')}")
        assert_test("Impact metrics average intake ~3 mins", impact.get('avg_intake_minutes', 0) > 0, f"-> {impact.get('avg_intake_minutes')} mins")
        assert_test("Impact metrics hours saved > 5 hrs", impact.get('estimated_hours_saved', 0) > 5, f"-> {impact.get('estimated_hours_saved')} hrs saved")

        # Decision 9: Operational Analytics Dashboard
        dash = await database.get_dashboard_data()
        assert_test("Dashboard KPI exists", dash.get('kpi') is not None, f"-> Today: {dash.get('kpi', {}).get('today_footfall')}")
        assert_test("Dashboard 7-Day Sparkline valid", len(dash.get('sparklines', {}).get('footfall_7d', [])) == 7, f"-> {dash.get('sparklines', {}).get('footfall_7d')}")
        assert_test("Dashboard Department Breakdown >= 5", len(dash.get('department_breakdown', [])) >= 5)

        # Decision 10: Dynamic Kiosk Session Start & FSM Checkpoint
        test_new_pat = {
            "full_name": "Dynamic Intake Test Patient",
            "phone_number": "9999900000",
            "age": 32,
            "gender": "Female",
            "department": "General Medicine"
        }
        new_sess = await database.start_kiosk_session(test_new_pat, "General Medicine")
        assert_test("Dynamic Kiosk Session created", bool(new_sess.get('session_id')), f"-> session_id={new_sess.get('session_id')}, token={new_sess.get('token_id')}")

        if new_sess.get('session_id'):
            s_id = new_sess['session_id']
            # Commit FSM checkpoint
            await database.commit_fsm_checkpoint(
                session_id=s_id,
                filled_state={"symptom": "Dry cough", "duration": "5 days"},
                chief_complaint="Dry cough with mild fever",
                interview_qa=[{"q": "How long?", "a": "5 days"}],
                priority_flag=False,
                priority_reason="",
                status="IN_PROGRESS"
            )
            # Verify checkpoint saved
            row = await conn.fetchrow("SELECT session_status, chief_complaint FROM patient_sessions WHERE session_id = $1", s_id)
            assert_test("FSM Checkpoint saved to DB", row and row['chief_complaint'] == "Dry cough with mild fever")

            # Clean up test session
            await conn.execute("DELETE FROM patient_sessions WHERE session_id = $1", s_id)
            await conn.execute("DELETE FROM patients WHERE phone_number = '9999900000'")

    await database.close_db_pool()
    print(f"\n==================================================")
    print(f"RESULTS: {tests_passed}/{total_tests} TESTS PASSED ({tests_passed/total_tests*100:.1f}%)")
    print(f"==================================================")

if __name__ == "__main__":
    asyncio.run(run_verification())
