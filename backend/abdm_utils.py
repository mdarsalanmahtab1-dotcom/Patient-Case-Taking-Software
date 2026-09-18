"""
abdm_utils.py — ABDM Registry Normalizer & Profile Picture Assignment

Reads from MOCK_ABHA_REGISTRY (pateint_registery.py).
Normalizes the two schema variants (yearOfBirth-style vs dob-style) 
into one unified dict for all callers.

Profile Picture Assignment (deterministic — same ABHA ID always same PFP):
  pfp1.jpg → Male, hash-even
  pfp2.jpg → Female, born after 1990 (younger)
  pfp3.jpg → Female, born 1990 or earlier (older)
  pfp4.jpg → Male, hash-odd
"""

import hashlib
from datetime import date
from pateint_registery import MOCK_ABHA_REGISTRY


def get_pfp_index(abha_key: str, gender: str, birth_year: int) -> int:
    """
    Returns 1-4 deterministically based on abha_key + gender + birth_year.
    Same ABHA ID will always return the same number across restarts.
    """
    h = int(hashlib.md5(abha_key.encode()).hexdigest(), 16)
    g = gender.upper()
    if g == "M":
        return 1 if (h % 2 == 0) else 4
    else:
        return 2 if birth_year > 1990 else 3


def _mask_abha_number(abha_num: str) -> str:
    """91-1001-2001-3001 → 91-****-****-3001"""
    parts = abha_num.replace(" ", "").split("-")
    if len(parts) == 4:
        return f"{parts[0]}-****-****-{parts[3]}"
    return "****-****-****-****"


def normalize_profile(abha_key: str, raw: dict) -> dict:
    """
    Converts either registry schema variant into one unified profile dict.

    Schema A: { healthIdNumber, name, gender, yearOfBirth, monthOfBirth, dayOfBirth,
                address, districtName, stateName, pincode, mobile, profilePhoto }
    Schema B: { abha_number, name, gender, dob (YYYY-MM-DD), address, mobile, blood_group }
    """
    # ── Parse DOB ──────────────────────────────────────────────────────
    if "yearOfBirth" in raw:
        year = int(raw["yearOfBirth"])
        month = int(raw.get("monthOfBirth", "1"))
        day = int(raw.get("dayOfBirth", "1"))
        dob_str = f"{year:04d}-{month:02d}-{day:02d}"
    elif "dob" in raw:
        dob_str = raw["dob"]
        parts = dob_str.split("-")
        year = int(parts[0])
        month = int(parts[1]) if len(parts) > 1 else 1
        day = int(parts[2]) if len(parts) > 2 else 1
    else:
        dob_str = "1980-01-01"
        year, month, day = 1980, 1, 1

    # ── Calculate age ──────────────────────────────────────────────────
    today = date.today()
    age = today.year - year - ((today.month, today.day) < (month, day))

    # ── Gender normalization ───────────────────────────────────────────
    gender = raw.get("gender", "M").upper()
    gender_display = "Male" if gender == "M" else "Female"

    # ── Build address string ───────────────────────────────────────────
    parts = []
    if raw.get("address"):
        parts.append(raw["address"])
    if raw.get("districtName"):
        parts.append(raw["districtName"])
    if raw.get("stateName"):
        parts.append(raw["stateName"])
    if raw.get("pincode"):
        parts.append(raw["pincode"])
    full_address = ", ".join(parts) if parts else raw.get("address", "")

    # ── ABHA Number (masked) ───────────────────────────────────────────
    abha_num_raw = raw.get("healthIdNumber") or raw.get("abha_number", "")
    abha_num_masked = _mask_abha_number(abha_num_raw) if abha_num_raw else "—"

    # ── Deterministic profile picture ─────────────────────────────────
    pfp_index = get_pfp_index(abha_key, gender, year)

    return {
        "abha_id": abha_num_raw,
        "abha_number_raw": abha_num_raw,
        "abha_number_masked": abha_num_masked,
        "name": raw.get("name", ""),
        "gender": gender,               # "M" or "F"
        "gender_display": gender_display,
        "dob": dob_str,
        "age": age,
        "mobile": raw.get("mobile", ""),
        "address": full_address,
        "blood_group": raw.get("blood_group", ""),
        "pfp_index": pfp_index,         # 1-4 → frontend maps to pfp{n}.jpg
        "verified": True,
    }


def lookup_by_abha_number(abha_number: str) -> dict | None:
    """
    Looks up a patient in the registry by their 14-digit ABHA Number.
    Strips dashes and checks against healthIdNumber (Schema A) or abha_number (Schema B).
    Returns None if not found.
    """
    clean_query = abha_number.replace("-", "").replace(" ", "").strip()
    
    for key, data in MOCK_ABHA_REGISTRY.items():
        raw_num = data.get("healthIdNumber") or data.get("abha_number", "")
        if raw_num.replace("-", "") == clean_query:
            return normalize_profile(key, data)
            
    return None


def mask_phone(phone: str) -> str:
    """Returns 'XXXXXX1234' style masked phone for display."""
    clean = phone.replace("+91", "").replace(" ", "").strip()
    if len(clean) <= 4:
        return "X" * len(clean)
    return "X" * (len(clean) - 4) + clean[-4:]
