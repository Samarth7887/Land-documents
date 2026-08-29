from signer import sign_record_hash, verify_record_signature

def test_signing_and_verification():
    print("=== Testing Digital Signing & Tamper Verification ===")
    
    # Mock land record fields
    record_fields = {
        "owner_name": {"value": "Johnathan Smith", "confidence": 0.95},
        "survey_number": {"value": "404-B / Part 2", "confidence": 0.90},
        "area": {"value": 5.75, "confidence": 0.95},
        "village": {"value": "Green Valley", "confidence": 0.90}
    }
    
    # 1. Sign Record
    signature = sign_record_hash(record_fields)
    print(" -> Signature generated successfully.")
    
    # 2. Verify Original (Should Pass)
    is_valid = verify_record_signature(record_fields, signature)
    print(f" -> Verify original record status: {is_valid}")
    assert is_valid, "Signature should be valid for original unaltered data"
    
    # 3. Modify field / Tamper (Should Fail)
    tampered_fields = {
        "owner_name": {"value": "Jane Doe", "confidence": 0.95}, # Tampered value!
        "survey_number": {"value": "404-B / Part 2", "confidence": 0.90},
        "area": {"value": 5.75, "confidence": 0.95},
        "village": {"value": "Green Valley", "confidence": 0.90}
    }
    is_tampered_valid = verify_record_signature(tampered_fields, signature)
    print(f" -> Verify tampered record status: {is_tampered_valid}")
    assert not is_tampered_valid, "Signature verification should fail on tampered data!"
    
    print("\nDigital Signature & Verification Check: PASS")

if __name__ == "__main__":
    test_signing_and_verification()
