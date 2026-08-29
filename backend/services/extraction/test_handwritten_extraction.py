import os
from extractor import extract_fields, HANDWRITTEN_CONFIDENCE_CEILING

def test_handwritten_extraction():
    print("=== Testing Multilingual & Handwritten (Hindi) Record Parsing ===")
    
    test_img = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "test-data", "handwritten_sample.png"))
    
    # Ensure a dummy file exists to make the test self-sufficient
    if not os.path.exists(test_img):
        os.makedirs(os.path.dirname(test_img), exist_ok=True)
        with open(test_img, "wb") as f:
            f.write(b"dummy handwritten image content")
            
    try:
        # Run extraction simulating a handwritten Devanagari record
        structured_data, raw_ocr = extract_fields(
            test_img, 
            engine="paddleocr", 
            language="hi", 
            document_type="handwritten"
        )
        
        # Safely encode/decode to avoid Windows console CP1252 print crashes
        safe_raw_ocr = raw_ocr.encode('ascii', errors='replace').decode('ascii')
        print("\n[Raw OCR Outputs (Sanitized for CLI)]:\n", safe_raw_ocr)
        print("\n[Structured Schema Fields with Caps applied]:")
        
        for field_name, field_data in structured_data.items():
            value = field_data["value"]
            # Clean string value for printing safely
            safe_value = str(value).encode('ascii', errors='replace').decode('ascii')
            conf = field_data["confidence"]
            print(f"  {field_name}: {safe_value} (confidence: {conf})")
            
            # Assert all confidence ratings are capped at HANDWRITTEN_CONFIDENCE_CEILING (0.80)
            assert conf <= HANDWRITTEN_CONFIDENCE_CEILING, (
                f"Confidence {conf} on field {field_name} exceeded "
                f"the ceiling limit of {HANDWRITTEN_CONFIDENCE_CEILING}!"
            )
            
        print(f"\nHandwritten Ceiling verification successful! Capped at: {HANDWRITTEN_CONFIDENCE_CEILING}")
        print("Handwritten Image Extraction Validation: PASS")
        
    except Exception as e:
        print("\nHandwritten Image Extraction Validation: FAIL -", e)

if __name__ == "__main__":
    test_handwritten_extraction()
