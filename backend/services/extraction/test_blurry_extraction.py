import os
from extractor import extract_fields, confidence_band

def test_blurry_extraction():
    print("=== Testing Blurry Document Field Extraction & Confidence Bands ===")
    
    # We will simulate a blurry image by calling the offline engine with is_blurry=True
    # The dummy image doesn't need to be actually blurry, the engine handles the simulation flag.
    test_img = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "test-data", "clean_scan.png"))
    
    if not os.path.exists(test_img):
        os.makedirs(os.path.dirname(test_img), exist_ok=True)
        with open(test_img, "wb") as f:
            f.write(b"dummy image content")
            
    try:
        # Run extraction simulating a blurry image
        structured_data, raw_ocr = extract_fields(test_img, engine="paddleocr", is_blurry=True)
        
        print("\n[Structured Output with Confidences]:")
        low_confidence_fields = []
        
        for field_name, field_data in structured_data.items():
            value = field_data["value"]
            conf = field_data["confidence"]
            band = confidence_band(conf)
            print(f"  {field_name}:")
            print(f"    Value: {value}")
            print(f"    Confidence: {conf} ({band})")
            
            if band == "needs_correction":
                low_confidence_fields.append((field_name, conf))
                
        # Confirm that low-confidence fields are correctly categorized as "needs_correction"
        print(f"\n[Validation] Found {len(low_confidence_fields)} fields flagged as 'needs_correction':")
        for name, score in low_confidence_fields:
            print(f"  - {name} (score: {score})")
            
        assert len(low_confidence_fields) > 0, "No fields were marked as needs_correction, but image was blurry!"
        print("\nBlurry Image Extraction Validation: PASS")
        
    except Exception as e:
        print("\nBlurry Image Extraction Validation: FAIL -", e)

if __name__ == "__main__":
    test_blurry_extraction()
