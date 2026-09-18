from fastapi import APIRouter, HTTPException, Body
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import database

admin_router = APIRouter(prefix="/api/admin", tags=["admin"])

class DepartmentReq(BaseModel):
    name: str

class DoctorReq(BaseModel):
    full_name: str
    dept_id: int
    license_number: str
    max_daily_patients: int = 40
    profile_image_url: Optional[str] = None
    room_number: str = "TBD"
    username: str
    password: str
    admin_email: str = "admin@swasthyasync.com"

class DoctorUpdateReq(BaseModel):
    full_name: str
    dept_id: int
    license_number: str
    max_daily_patients: int
    status: str
    room_number: str
    profile_image_url: Optional[str] = None
    username: str
    password: str
    admin_email: str = "admin@swasthyasync.com"

class RuleReq(BaseModel):
    trigger_keyword: str
    action_type: str
    action_value: Optional[str] = None

class PatientUpdateReq(BaseModel):
    admin_email: str
    updates: Dict[str, Any]

class AdminActionReq(BaseModel):
    admin_email: str

@admin_router.get("/analytics")
async def get_analytics():
    return await database.get_analytics_metrics()

@admin_router.get("/queues")
async def get_queues():
    # Reuse the existing fetch_triage_queue but filter for IN_PROGRESS
    all_queues = await database.fetch_triage_queue()
    in_progress = [q for q in all_queues if q.get("session_status") == "IN_PROGRESS"]
    return in_progress

@admin_router.put("/queue/{session_id}/downgrade")
async def downgrade_queue(session_id: str, req: AdminActionReq):
    await database.downgrade_priority(session_id, req.admin_email)
    return {"status": "success", "message": f"Session {session_id} downgraded to normal priority."}

@admin_router.get("/doctors")
async def get_doctors():
    try:
        return await database.get_doctors()
    except Exception as e:
        return []

@admin_router.post("/doctors")
async def add_doctor(req: DoctorReq):
    try:
        await database.add_doctor(
            req.full_name, req.dept_id, req.license_number, 
            req.max_daily_patients, req.profile_image_url, req.room_number,
            req.username, req.password
        )
        await database.log_system_action(req.admin_email, "ADD_DOCTOR", req.full_name)
        return {"status": "success"}
    except Exception as e:
        if "UNIQUE constraint failed" in str(e) and "username" in str(e):
            raise HTTPException(status_code=400, detail="Username is already taken. Please choose another one.")
        raise HTTPException(status_code=400, detail=str(e))

@admin_router.put("/doctors/{doctor_id}")
async def update_doctor(doctor_id: str, req: DoctorUpdateReq):
    try:
        # Since we might not want to overwrite current_status if it's not in req, we can leave it as default or fetch it first.
        # But for now, we'll fetch the existing doctor to keep their current_status.
        existing_doctors = await database.get_doctors()
        existing = next((d for d in existing_doctors if d["doctor_id"] == doctor_id), None)
        curr_status = existing["current_status"] if existing and "current_status" in existing else "Available"
        
        await database.update_doctor(
            doctor_id, req.full_name, req.dept_id, req.license_number, 
            req.max_daily_patients, req.status, req.room_number, req.profile_image_url,
            req.username, req.password, curr_status
        )
        await database.log_system_action(req.admin_email, "EDIT_DOCTOR", str(doctor_id))
        return {"status": "success"}
    except Exception as e:
        if "UNIQUE constraint failed" in str(e) and "username" in str(e):
            raise HTTPException(status_code=400, detail="Username is already taken. Please choose another one.")
        raise HTTPException(status_code=400, detail=str(e))

@admin_router.get("/departments")
async def get_departments():
    return await database.get_departments()

@admin_router.post("/departments")
async def add_department(req: DepartmentReq):
    try:
        await database.add_department(req.name)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@admin_router.put("/departments/{dept_id}/default")
async def set_default_department(dept_id: int):
    try:
        import database
        if database._pool:
            async with database._pool.acquire() as conn:
                await conn.execute("UPDATE departments SET is_default = FALSE")
                await conn.execute("UPDATE departments SET is_default = TRUE WHERE dept_id = $1", dept_id)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@admin_router.get("/rules")
async def get_rules():
    return await database.get_rules()

@admin_router.post("/rules")
async def add_rule(req: RuleReq):
    await database.add_rule(req.trigger_keyword, req.action_type, req.action_value)
    return {"status": "success"}

@admin_router.get("/patients")
async def get_patients():
    return await database.get_all_patients()

@admin_router.put("/patients/{patient_id}")
async def update_patient(patient_id: str, req: PatientUpdateReq):
    await database.update_patient_details(patient_id, req.updates, req.admin_email)
    return {"status": "success"}

@admin_router.post("/reset-clinic")
async def reset_clinic(req: AdminActionReq):
    await database.archive_active_queues(req.admin_email)
    return {"status": "success", "message": "All active queues archived."}

@admin_router.get("/logs")
async def get_logs():
    return await database.get_system_logs()

@admin_router.get("/export-db")
async def export_db():
    data = await database.get_health_officer_export_data()
    return JSONResponse(
        content=data,
        headers={"Content-Disposition": 'attachment; filename="health_officer_export.json"'}
    )

@admin_router.get("/dashboard-data")
async def get_dashboard_data(
    start: str = None, end: str = None,
    departments: str = None, complaints: str = None
):
    dept_list = departments.split(",") if departments else None
    comp_list = complaints.split(",") if complaints else None
    return await database.get_dashboard_data(start, end, dept_list, comp_list)

@admin_router.get("/red-flags-live")
async def get_red_flags_live():
    return await database.get_active_red_flags()

@admin_router.get("/impact-metrics")
async def get_impact_metrics():
    return await database.get_impact_metrics()

