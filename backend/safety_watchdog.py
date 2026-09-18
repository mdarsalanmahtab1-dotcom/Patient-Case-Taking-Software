"""
SwasthyaSync — Safety Watchdog (Architecture v2, §9)

Three-layer red-flag architecture with strict authority order:
  1. Rule-based (SOLE gate for REDFLAG_INTERRUPT — deterministic, auditable)
  2. ML severity scorer (refines triage priority — cannot suppress rule-layer flags)
  3. LLM pattern reasoning (candidate rules for human review — never auto-fires)

For the hackathon we implement Layer 1 only.
Runs every turn on the FULL accumulated slot set.
"""

from __future__ import annotations
from patient_record import PatientRecord, RedFlagEntry


# ──────────────────────────────────────────────────────────────────────
# RULE DEFINITIONS
# Each rule is a function that takes the patient record and returns
# a RedFlagEntry if triggered, or None if not.
# ──────────────────────────────────────────────────────────────────────

def _get_slot_value(record: PatientRecord, section: str, slot_id: str):
    """Safely extract a slot value from the patient record."""
    section_data = record.get_section(section)
    slot = section_data.extracted.get(slot_id)
    return slot.value if slot else None


def rule_cardiac_emergency(record: PatientRecord) -> RedFlagEntry | None:
    """Chest pain + radiation to arm/jaw + breathlessness/sweating."""
    cc = str(record.chief_complaint.value or "").lower()
    site = str(_get_slot_value(record, "HPI", "site") or "").lower()
    radiation = str(_get_slot_value(record, "HPI", "radiation") or "").lower()
    associations = str(_get_slot_value(record, "HPI", "associations") or "").lower()
    severity = str(_get_slot_value(record, "HPI", "severity") or "").lower()

    chest_pain = "chest" in cc or "chest" in site
    dangerous_radiation = any(x in radiation for x in ["left_arm", "left arm", "jaw"])
    dangerous_associations = any(x in associations for x in ["breathlessness", "sweating", "nausea"])
    high_severity = any(x in severity for x in ["7", "8", "9", "10", "severe", "unbearable"])

    if chest_pain and (dangerous_radiation or dangerous_associations or high_severity):
        return RedFlagEntry(
            rule_id="CARDIAC_EMERGENCY",
            description="Possible acute coronary syndrome — chest pain with concerning features",
            slot_values={"site": site, "radiation": radiation, "associations": associations, "severity": severity},
        )
    return None


def rule_stroke_fast(record: PatientRecord) -> RedFlagEntry | None:
    """FAST stroke symptoms: Face drooping, Arm weakness, Speech difficulty."""
    cc = str(record.chief_complaint.value or "").lower()
    associations = str(_get_slot_value(record, "HPI", "associations") or "").lower()

    stroke_keywords = ["face droop", "arm weakness", "speech", "sudden numbness",
                       "sudden confusion", "sudden headache", "paralysis", "one side"]
    if any(kw in cc or kw in associations for kw in stroke_keywords):
        return RedFlagEntry(
            rule_id="STROKE_FAST",
            description="Possible stroke — FAST symptoms detected",
            slot_values={"chief_complaint": cc, "associations": associations},
        )
    return None


def rule_severe_breathing(record: PatientRecord) -> RedFlagEntry | None:
    """Severe breathlessness at rest or inability to lie flat."""
    breathlessness = str(_get_slot_value(record, "HPI", "breathlessness") or "").lower()
    if any(x in breathlessness for x in ["at rest", "cannot lie flat", "cannot lie"]):
        return RedFlagEntry(
            rule_id="SEVERE_RESPIRATORY_DISTRESS",
            description="Severe respiratory distress — breathlessness at rest",
            slot_values={"breathlessness": breathlessness},
        )
    return None


def rule_hemoptysis(record: PatientRecord) -> RedFlagEntry | None:
    """Significant hemoptysis (coughing up blood)."""
    sputum = str(_get_slot_value(record, "HPI", "sputum") or "").lower()
    hemoptysis = str(_get_slot_value(record, "HPI", "hemoptysis") or "").lower()
    if "blood" in sputum or "significant" in hemoptysis:
        return RedFlagEntry(
            rule_id="HEMOPTYSIS",
            description="Significant hemoptysis — urgent evaluation needed",
            slot_values={"sputum": sputum, "hemoptysis": hemoptysis},
        )
    return None


def rule_gi_bleeding(record: PatientRecord) -> RedFlagEntry | None:
    """Blood in stool or vomit."""
    blood = str(_get_slot_value(record, "HPI", "blood_stool_vomit") or "").lower()
    if any(x in blood for x in ["blood in stool", "blood in vomit", "both"]):
        return RedFlagEntry(
            rule_id="GI_BLEEDING",
            description="Gastrointestinal bleeding detected",
            slot_values={"blood_stool_vomit": blood},
        )
    return None


# Master list of all rules
ALL_RULES = [
    rule_cardiac_emergency,
    rule_stroke_fast,
    rule_severe_breathing,
    rule_hemoptysis,
    rule_gi_bleeding,
]


def run_safety_watchdog(record: PatientRecord) -> list[RedFlagEntry]:
    """
    Run ALL rules on the full accumulated slot set.
    Returns a list of triggered red-flag entries (empty if none).
    This runs every single turn, without exception.
    """
    flags = []
    for rule_fn in ALL_RULES:
        result = rule_fn(record)
        if result is not None:
            flags.append(result)
    return flags
