from patient_record import PatientRecord
from document_red_flags import check_document_flags

def run_test():
    record = PatientRecord()
    
    # Helper to construct payload
    def make_doc(tests):
        return [{"entities": [{"lab_values": tests}]}]

    # 1. Hemoglobin tests
    hb_us = make_doc([{"test_name": "Hemoglobin", "value": "12", "unit": "g/dL", "is_abnormal": True}])
    hb_si = make_doc([{"test_name": "Hemoglobin", "value": "7.4", "unit": "mmol/L", "is_abnormal": True}])
    
    flags_hb_us = check_document_flags(hb_us, record)
    flags_hb_si = check_document_flags(hb_si, record)
    print("Hemoglobin 12 g/dL flags:", len(flags_hb_us))
    print("Hemoglobin 7.4 mmol/L flags:", len(flags_hb_si))
    
    # 2. Creatinine tests (4 mg/dL is critical territory threshold)
    cr_us = make_doc([{"test_name": "Creatinine", "value": "4.5", "unit": "mg/dL", "is_abnormal": True}])
    cr_si = make_doc([{"test_name": "Creatinine", "value": "360", "unit": "umol/L", "is_abnormal": True}])
    
    flags_cr_us = check_document_flags(cr_us, record)
    flags_cr_si = check_document_flags(cr_si, record)
    print("Creatinine 4.5 mg/dL flags:", len(flags_cr_us))
    print("Creatinine 360 umol/L flags:", len(flags_cr_si))
    
    # 3. Troponin tests
    trop_us = make_doc([{"test_name": "Troponin", "value": "0.05", "unit": "ng/mL", "is_abnormal": True}])
    trop_si = make_doc([{"test_name": "Troponin", "value": "50", "unit": "ng/L", "is_abnormal": True}])
    trop_pg = make_doc([{"test_name": "Troponin", "value": "50", "unit": "pg/mL", "is_abnormal": True}])
    
    print("Troponin US flags:", len(check_document_flags(trop_us, record)))
    print("Troponin SI flags:", len(check_document_flags(trop_si, record)))
    print("Troponin pg/mL flags:", len(check_document_flags(trop_pg, record)))
    
    # 4. Unrecognized unit tests
    bad_unit = make_doc([{"test_name": "Hemoglobin", "value": "7", "unit": "mg/mmol", "is_abnormal": True}])
    flags_bad = check_document_flags(bad_unit, record)
    print("Unrecognized unit flags:", len(flags_bad))
    print("Unverifiable values list:", record.unverifiable_values)

if __name__ == "__main__":
    run_test()
