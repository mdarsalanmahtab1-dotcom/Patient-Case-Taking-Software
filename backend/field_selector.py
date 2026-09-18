"""
SwasthyaSync v4 — Field Selector (non-LLM)

A deterministic priority function that selects the next field to ask about.
No LLM calls — pure logic based on the dynamic schema and filled-state.

Selection order:
  1. critical + red_flag fields (patient safety first)
  2. critical non-red-flag fields
  3. high priority fields
  4. medium priority fields
  5. optional fields (only if time permits)

Skips any field whose `conditional_on` condition is not met.
"""

from __future__ import annotations
import logging

logger = logging.getLogger(__name__)

# Priority ordering (lower number = ask first)
PRIORITY_ORDER = {
    "critical": 0,
    "high": 1,
    "medium": 2,
    "optional": 3,
}


def _is_condition_met(field: dict, filled_state: dict) -> bool:
    """
    Check if a field's conditional_on prerequisite is satisfied.
    Format: "field_id:value" or "field_id:!value" (negation).
    If no condition, always True.
    """
    condition = field.get("conditional_on")
    if not condition:
        return True

    # Parse "field_id:expected_value" or "field_id:!excluded_value"
    parts = condition.split(":", 1)
    if len(parts) != 2:
        return True  # Malformed condition — don't block

    cond_field_id, expected = parts[0].strip(), parts[1].strip()

    # Get the actual value
    entry = filled_state.get(cond_field_id, {})
    actual = str(entry.get("value", "")).lower().strip() if isinstance(entry, dict) else ""

    if not actual:
        return False  # Prerequisite field not yet filled — skip for now

    # Negation check
    if expected.startswith("!"):
        return actual != expected[1:].lower().strip()
    
    return actual == expected.lower().strip()


def _sort_key(field: dict) -> tuple:
    """
    Sort key: (priority_order, not_red_flag, category_order)
    This ensures: critical+red_flag first, then critical, then high, etc.
    """
    priority = PRIORITY_ORDER.get(field.get("priority", "medium"), 2)
    is_red_flag = field.get("red_flag", False)
    
    # Within same priority, ask red-flag fields first
    # Within same priority+red_flag, prefer HPI over other categories
    category_order = {
        "HPI": 0,
        "red_flag_check": 1,
        "PMH": 2,
        "DH": 3,
        "FH": 4,
        "SH": 5,
        "ROS": 6,
    }
    cat = category_order.get(field.get("category", "HPI"), 7)
    
    return (priority, not is_red_flag, cat)


def next_field(schema: dict, filled_state: dict) -> dict | None:
    """
    Select the next field to ask about.
    
    Args:
        schema: The dynamic schema with a "fields" list
        filled_state: Current state {field_id: {value, confidence}}
    
    Returns:
        The field dict to ask about, or None if all relevant fields are filled.
    """
    fields = schema.get("fields", [])
    
    # Filter to unfilled fields with met conditions
    candidates = []
    for field in fields:
        field_id = field.get("id", "")
        
        # Skip if already filled
        entry = filled_state.get(field_id, {})
        if isinstance(entry, dict) and entry.get("value"):
            continue
        
        # Skip if condition not met
        if not _is_condition_met(field, filled_state):
            continue
        
        candidates.append(field)
    
    if not candidates:
        return None
    
    # Sort by priority
    candidates.sort(key=_sort_key)
    
    selected = candidates[0]
    logger.debug(
        f"Field selector: chose '{selected['id']}' "
        f"(priority={selected.get('priority')}, red_flag={selected.get('red_flag')}) "
        f"from {len(candidates)} candidates"
    )
    return selected


def is_fork_eligible(field: dict) -> bool:
    """Check if a field is tagged as fork_eligible (zero-cost dict lookup)."""
    return field.get("fork_eligible", False)


def get_unfilled_field_ids(schema: dict, filled_state: dict) -> list[str]:
    """Return IDs of all unfilled fields (for extraction scoping)."""
    fields = schema.get("fields", [])
    unfilled = []
    for field in fields:
        field_id = field.get("id", "")
        entry = filled_state.get(field_id, {})
        if not (isinstance(entry, dict) and entry.get("value")):
            unfilled.append(field_id)
    return unfilled


def get_progress(schema: dict, filled_state: dict) -> dict:
    """
    Calculate progress based on critical + high priority fields.
    Returns {done, total, percent, label}.
    """
    fields = schema.get("fields", [])
    
    # Only count critical + high for progress
    target_fields = [f for f in fields if f.get("priority") in ("critical", "high")]
    total = len(target_fields)
    
    filled = 0
    for f in target_fields:
        entry = filled_state.get(f["id"], {})
        if isinstance(entry, dict) and entry.get("value"):
            filled += 1
    
    percent = int((filled / total * 100)) if total > 0 else 0
    return {
        "done": filled,
        "total": total,
        "percent": percent,
        "label": f"{filled}/{total} key items collected",
    }


def is_interview_complete(schema: dict, filled_state: dict, turn_count: int, max_turns: int = 30) -> bool:
    """
    Check if the interview should end.
    True when all critical + high fields are filled, OR max turns reached.
    """
    if turn_count >= max_turns:
        logger.info(f"Interview ending: max turns ({max_turns}) reached")
        return True
    
    fields = schema.get("fields", [])
    critical_high = [f for f in fields if f.get("priority") in ("critical", "high")]
    
    for f in critical_high:
        entry = filled_state.get(f["id"], {})
        if not (isinstance(entry, dict) and entry.get("value")):
            return False  # Still have unfilled critical/high fields
    
    logger.info(f"Interview ending: all {len(critical_high)} critical/high fields filled at turn {turn_count}")
    return True


def get_current_category_label(schema: dict, filled_state: dict) -> str:
    """
    Get a human-readable label for the current category being explored.
    Based on the next field's category.
    """
    field = next_field(schema, filled_state)
    if not field:
        return "Wrapping Up"
    
    category_labels = {
        "HPI": "Exploring Your Symptoms",
        "red_flag_check": "Important Safety Checks",
        "PMH": "Your Medical Background",
        "DH": "Medications & Allergies",
        "FH": "Family Health History",
        "SH": "Lifestyle & Habits",
        "ROS": "General Health Check",
    }
    return category_labels.get(field.get("category", "HPI"), "Gathering Information")
