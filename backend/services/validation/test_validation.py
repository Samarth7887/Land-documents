from validator import validate_record

def get_clean_record():
    return {
        "owner_name": {"value": "Johnathan Smith", "confidence": 0.95},
        "survey_number": {"value": "404-B / Part 2", "confidence": 0.90},
        "khasra_or_khata_number": {"value": "KH-88902", "confidence": 0.85},
        "area": {"value": 5.75, "confidence": 0.95},
        "area_unit": {"value": "Acres", "confidence": 0.98},
        "village": {"value": "Green Valley", "confidence": 0.90},
        "taluk": {"value": "East Taluk", "confidence": 0.85},
        "district": {"value": "River District", "confidence": 0.95},
        "land_classification": {"value": "Agricultural", "confidence": 0.92},
        "khata_type": {"value": "A", "confidence": 0.88},
        "tenancy_status": {"value": "Owner-cultivated", "confidence": 0.90},
        "liabilities": {"value": ["Bank Mortgage of 500,000 INR"], "confidence": 0.80},
        "tax_status": {"value": "Paid", "confidence": 0.95}
    }

def test_pass_case():
    print("=== Case 1: Valid Record (Should Pass) ===")
    record = get_clean_record()
    
    # Run validator with no existing duplicate records
    annotated_record, issues = validate_record(record, [])
    
    print(f" -> Issues found: {issues}")
    assert len(issues) == 0, "Expected 0 issues for clean record"
    print(" -> Result: PASS")

def test_duplicate_case():
    print("\n=== Case 2: Duplicate Record (Should Fail) ===")
    record = get_clean_record()
    
    # Simulate a database of existing records containing a duplicate entry
    # (Same survey_number + village, but a different owner name)
    existing_records = [
        {
            "owner_name": {"value": "Marry Jane", "confidence": 0.98},
            "survey_number": {"value": "404-B / Part 2", "confidence": 0.90},
            "village": {"value": "Green Valley", "confidence": 0.90}
        }
    ]
    
    # Run validator with existing records
    annotated_record, issues = validate_record(record, existing_records)
    
    print(f" -> Issues found: {issues}")
    
    # Verify duplicates check triggered
    assert len(issues) > 0, "Expected validation issue for duplicate check"
    assert any(i["field"] == "survey_number" for i in issues), "Expected survey_number to flag duplicate issue"
    
    # Check that confidence was downgraded below the 0.6 threshold
    original_conf = record["survey_number"]["confidence"]
    downgraded_conf = annotated_record["survey_number"]["confidence"]
    print(f" -> Original Confidence: {original_conf}")
    print(f" -> Downgraded Confidence: {downgraded_conf}")
    
    assert downgraded_conf < 0.6, "Confidence score should be downgraded below 0.6 needs_correction threshold"
    print(" -> Result: PASS")

if __name__ == "__main__":
    test_pass_case()
    test_duplicate_case()
