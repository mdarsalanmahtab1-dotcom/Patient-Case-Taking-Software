import asyncio
import os
import sys

# Ensure backend directory is in path
sys.path.insert(0, os.path.dirname(__file__))

from services.chat_router import classify_intent_and_safety, get_direct_small_talk_reply
from services.hospital_knowledge import search_hospital_knowledge, HOSPITAL_PROFILE
from services.swasthya_prompt import build_chat_system_prompt

def test_intent_classification():
    print("=" * 60)
    print("TESTING SWASTHYASYNC AI INTENT & SAFETY ROUTER")
    print("=" * 60)

    # 1. Emergency Detection
    intent, emergency = classify_intent_and_safety("I have severe crushing chest pain and difficulty breathing")
    assert emergency is True, "Emergency not flagged for chest pain!"
    assert intent == "EMERGENCY", f"Expected EMERGENCY intent, got {intent}"
    print("  [PASS] Emergency Trigger Detection verified.")

    # 2. Small Talk Isolation
    greetings = ["hey", "Hello!", "Namaste", "how are you?", "thank you"]
    for g in greetings:
        intent, emergency = classify_intent_and_safety(g)
        assert intent == "SMALL_TALK", f"Failed to identify small talk for '{g}' (got {intent})"
        assert emergency is False
    print("  [PASS] Small Talk Isolation verified for all greetings.")

    # 3. Kiosk & Hospital Inquiries
    intent, _ = classify_intent_and_safety("What does this kiosk do?")
    assert intent == "KIOSK_INFO", f"Expected KIOSK_INFO, got {intent}"
    
    intent, _ = classify_intent_and_safety("Where is the cardiology department?")
    assert intent == "HOSPITAL_INFO", f"Expected HOSPITAL_INFO, got {intent}"
    print("  [PASS] Kiosk & Hospital Intent verified.")

    # 4. Patient Record Queries
    intent, _ = classify_intent_and_safety("What was my latest BP and medications?")
    assert intent == "PATIENT_RECORD", f"Expected PATIENT_RECORD, got {intent}"
    print("  [PASS] Patient Record Intent verified.")

    # 5. Food & Diet Queries
    intent, _ = classify_intent_and_safety("Can I eat bananas with my kidney condition?")
    assert intent == "FOOD_AND_DIET", f"Expected FOOD_AND_DIET, got {intent}"
    print("  [PASS] Food and Diet Intent verified.")

def test_small_talk_responses():
    print("\nTESTING DIRECT SMALL TALK RESPONSES (NO DB OVERHEAD):")
    res = get_direct_small_talk_reply("Hello")
    assert "response" in res
    assert "I'm SwasthyaSync AI" in res["response"]
    assert res["intent"] == "SMALL_TALK"
    assert res["emergency"] is False
    print("  [PASS] Small talk returned friendly greeting without DB errors.")

def test_hospital_knowledge_retrieval():
    print("\nTESTING HOSPITAL KNOWLEDGE SEARCH:")
    res = search_hospital_knowledge("kiosk")
    assert "hospital" in res
    assert len(res["results"]) > 0
    assert any("Kiosk" in r.get("topic", "") for r in res["results"])
    print("  [PASS] Hospital knowledge search returned kiosk specifications.")

def test_prompt_assembly():
    print("\nTESTING MASTER SYSTEM PROMPT ASSEMBLY:")
    p = build_chat_system_prompt('{"test": 1}', '{"hosp": 2}', 'Patient: Hi\nAssistant: Hello')
    assert "You are \"SwasthyaSync AI\"" in p
    assert "AUTHORIZED PATIENT CONTEXT:" in p
    assert "HOSPITAL & KIOSK KNOWLEDGE SNIPPETS:" in p
    print("  [PASS] Master System Prompt successfully constructed.")

if __name__ == "__main__":
    test_intent_classification()
    test_small_talk_responses()
    test_hospital_knowledge_retrieval()
    test_prompt_assembly()
    print("\n" + "=" * 60)
    print("ALL SWASTHYASYNC AI BACKEND UNIT TESTS PASSED!")
    print("=" * 60)
