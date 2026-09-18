"""
SwasthyaSync — Document-Sourced Red Flag Checker

Runs at the Screen 6 confirmation step alongside the contradiction checker.
Scans OCR-extracted elab values for clinically critical abnormalities and
produces the SAME RedFlagEntry shape that safety_watchdog.py / red_flag_library.py
already produce.  Additive — the union of these flags and conversational flags
is what gets stored on PatientRecord.red_flags.

When a document red flag fires, th same escalate_queue_priority() function
is called — the patient is still in the queue at that point even though the
interview is done.
"""

from __future__ import annotations
import logging
from lab_unit_reference import normalize_lab_value
from patient_record import PatientRecord, RedFlagEntry

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────────
# Critical lab thresholds (hackathon scope — common emergency labs)
# Each entry: test_name_pattern → (low_crit, high_crit)
# If value parses as a number and falls outside the range, it's critical.
# If the reference range is missing, Gemini's `is_abnormal` flag alone
# is not sufficient for a critical-level escalation — we require the
# value to actually breach a hard-coded danger threshold.
# ──────────────────────────────────────────────────────────────────────

CRITICAL_THRESHOLDS: dict[str, tuple[float | None, float | None]] = {
    # Hematology
    "hemoglobin":       (7.0,  None),   # g/dL — severe anemia below 7
    "haemoglobin":      (7.0,  None),
    "hb":               (7.0,  None),
    "platelet":         (50.0, None),   # ×10³/µL — severe thrombocytopenia below 50k
    "platelets":        (50.0, None),
    # Metabolic
    "blood glucose":    (50.0, 400.0),  # mg/dL — hypo- or severe hyperglycemia
    "glucose":          (50.0, 400.0),
    "fasting glucose":  (50.0, 400.0),
    "random glucose":   (50.0, 400.0),
    "hba1c":            (None, 10.0),   # % — very poorly controlled diabetes
    "glycated hemoglobin": (None, 10.0),
    # Renal
    "creatinine":       (None, 4.0),    # mg/dL — severe renal impairment
    "serum creatinine": (None, 4.0),
    "blood urea":       (None, 100.0),  # mg/dL
    "bun":              (None, 50.0),   # mg/dL
    "potassium":        (2.5,  6.5),    # mEq/L — life-threatening dyskalemia
    "sodium":           (120.0, 160.0), # mEq/L — severe dysnatremia
    # Liver
    "bilirubin":        (None, 10.0),   # mg/dL — severe jaundice
    "total bilirubin":  (None, 10.0),
    "sgpt":             (None, 500.0),  # U/L — acute hepatitis territory
    "alt":              (None, 500.0),
    "sgot":             (None, 500.0),
    "ast":              (None, 500.0),
    # Cardiac markers
    "troponin":         (None, 0.04),   # ng/mL — elevated = myocardial injury
    "troponin i":       (None, 0.04),
    "troponin t":       (None, 0.04),
    "ck-mb":            (None, 25.0),   # U/L
    "bnp":              (None, 400.0),  # pg/mL — heart failure territory
    # Coagulation
    "inr":              (None, 4.0),    # dimensionless — bleeding risk
    "pt":               (None, 25.0),   # seconds
}


def _try_parse_number(val: str) -> float | None:
    """Extract the first parseable number from a string like '6.2' or '3.5 mg/dL'."""
    import re
    match = re.search(r"[\d]+\.?[\d]*", str(val))
    if match:
        try:
            return float(match.group())
        except ValueError:
            return None
    return None


def _check_critical(test_name: str, value_str: str, unit: str, record: PatientRecord | None = None) -> bool:
    """Return True if a lab value breaches a critical threshold. Returns False if unparseable or unrecognized unit."""
    key = test_name.lower().strip()
    thresholds = CRITICAL_THRESHOLDS.get(key)
    if not thresholds:
        # Try partial match
        for pattern, bounds in CRITICAL_THRESHOLDS.items():
            if pattern in key:
                thresholds = bounds
                break
    if not thresholds:
        return False

    num = _try_parse_number(value_str)
    if num is None:
        return False
        
    low_crit, high_crit = thresholds
    
    normalized_num = normalize_lab_value(test_name, num, unit)
    
    if normalized_num is None:
        if record is not None:
            record.unverifiable_values.append(f"{test_name}: {value_str} {unit} [unit not recognized] — please verify manually")
        return False

    if low_crit is not None and normalized_num < low_crit:
        return True
    if high_crit is not None and normalized_num > high_crit:
        return True
    return False


# ──────────────────────────────────────────────────────────────────────
# Core API
# ──────────────────────────────────────────────────────────────────────

def check_document_flags(document_extractions: list[dict], record: PatientRecord | None = None) -> list[RedFlagEntry]:
    """
    Scan all OCR-extracted lab values for critical abnormalities.

    Parameters
    ----------
    document_extractions : list[dict]
        Each dict is a DocumentExtraction.model_dump().
        Actual lab values live in  extraction["entities"][i]["lab_values"].
    record : PatientRecord | None
        The patient record to store unverifiable values on.

    Returns
    -------
    list[RedFlagEntry]
        Same shape as safety_watchdog.py produces.  Caller takes the union
        with conversational red flags.
    """
    flags: list[RedFlagEntry] = []

    for ext in document_extractions:
        for ent in ext.get("entities", []):
            for lab in ent.get("lab_values", []):
                test_name = lab.get("test_name", "Unknown")
                value = str(lab.get("value", ""))
                unit = lab.get("unit", "")
                is_abnormal = lab.get("is_abnormal", False)
                flag_reason = lab.get("flag_reason", "")

                # Only escalate if BOTH the Gemini model flagged it abnormal
                # AND the value breaches our hard-coded critical thresholds.
                # This prevents escalation on mildly out-of-range values.
                if is_abnormal and _check_critical(test_name, value, unit, record):
                    flags.append(RedFlagEntry(
                        rule_id=f"DOC_LAB_CRITICAL_{test_name.upper().replace(' ', '_')}",
                        description=(
                            f"Critical lab value from uploaded document: "
                            f"{test_name} = {value} {unit}. {flag_reason}"
                        ),
                        slot_values={
                            "source": "document_extraction",
                            "test_name": test_name,
                            "value": value,
                            "unit": unit,
                            "flag_reason": flag_reason,
                        },
                    ))

    if flags:
        logger.warning(f"🚨 Document red-flag checker found {len(flags)} critical lab values")
    else:
        logger.info("✅ Document red-flag checker: no critical lab values in uploaded documents")

    return flags

