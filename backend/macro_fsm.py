"""
SwasthyaSync v4 — Simplified Macro-FSM

Simplified for the dynamic schema-driven architecture.
The old per-section states (HPI, PMH, PSH, etc.) are collapsed into
a single DYNAMIC_INTERVIEW state. The schema's field categories handle
the clinical grouping internally.

States:
  INIT → DEMOGRAPHICS → CHIEF_COMPLAINT → SCHEMA_GENERATION → DYNAMIC_INTERVIEW
       → DOCUMENT_SCAN → SUMMARY_CONFIRMATION → COMPLETE

Global interrupts (from any state):
  [red flag detected]  → EMERGENCY_PROTOCOL
  [patient taps Help]  → STAFF_ASSIST (pause; resume on return)
"""

from __future__ import annotations

MACRO_STATES = [
    "INIT",
    "DEMOGRAPHICS",
    "CHIEF_COMPLAINT",
    "SCHEMA_GENERATION",
    "DYNAMIC_INTERVIEW",
    # AYUSH_ASSESSMENT conditionally inserted after DYNAMIC_INTERVIEW
    "DOCUMENT_SCAN",
    "SUMMARY_CONFIRMATION",
    "COMPLETE",
]

# The single conversational state (replaces old per-section states)
CONVERSATIONAL_STATES = {"CHIEF_COMPLAINT", "DYNAMIC_INTERVIEW", "AYUSH_ASSESSMENT"}

INTERRUPT_STATES = {"EMERGENCY_PROTOCOL", "STAFF_ASSIST"}


class MacroFSM:
    """
    Server-side finite state machine governing the patient journey.
    The client never decides state transitions — the server does.
    """

    def __init__(self, clinic_mode: str = "allopathic"):
        self.clinic_mode = clinic_mode
        self.state: str = "INIT"
        self._paused_state: str | None = None
        self._state_sequence = self._build_sequence()

    def _build_sequence(self) -> list[str]:
        """Build the ordered state list, inserting AYUSH_ASSESSMENT if needed."""
        seq = list(MACRO_STATES)
        if self.clinic_mode in ("ayush", "integrative"):
            interview_idx = seq.index("DOCUMENT_SCAN")
            seq.insert(interview_idx, "AYUSH_ASSESSMENT")
        return seq

    @property
    def is_conversational(self) -> bool:
        return self.state in CONVERSATIONAL_STATES

    @property
    def is_interrupt(self) -> bool:
        return self.state in INTERRUPT_STATES

    @property
    def is_complete(self) -> bool:
        return self.state == "COMPLETE"

    def advance(self) -> str:
        """Move to the next state in the sequence."""
        if self.state in INTERRUPT_STATES:
            return self.state
        try:
            idx = self._state_sequence.index(self.state)
            if idx + 1 < len(self._state_sequence):
                self.state = self._state_sequence[idx + 1]
        except ValueError:
            pass
        return self.state

    def go_back(self) -> str:
        """Move to the previous state."""
        if self.state in INTERRUPT_STATES:
            return self.state
        try:
            idx = self._state_sequence.index(self.state)
            if idx > 0:
                self.state = self._state_sequence[idx - 1]
        except ValueError:
            pass
        return self.state

    def trigger_redflag(self) -> str:
        """Global interrupt: bypass queue, page triage."""
        self._paused_state = self.state
        self.state = "EMERGENCY_PROTOCOL"
        return self.state

    def trigger_staff_assist(self) -> str:
        """Global interrupt: pause; resume same state on return."""
        self._paused_state = self.state
        self.state = "STAFF_ASSIST"
        return self.state

    def resolve_interrupt(self) -> str:
        """Resume from where we paused (or go to INIT if no saved state)."""
        self.state = self._paused_state or "INIT"
        self._paused_state = None
        return self.state

    def set_state(self, state: str) -> str:
        """Force set state (used during session restoration)."""
        self.state = state
        return self.state
