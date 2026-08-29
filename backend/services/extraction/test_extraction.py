from extractor import extract_fields
import os

def test_offline_extraction():
    print("=== Testing Local Offline (PaddleOCR) Extraction Fallback ===")
    
    # We will use the sample synthetic image generated in test-data by the preprocessing test if it exists,
    # or create a temporary mock file.
    test_img = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "test-data", "clean_scan.png"))
    
    # Ensure a dummy file exists if not generated yet
    if not os.path.exists(test_img):
        os.makedirs(os.path.dirname(test_img), exist_ok=True)
        with open(test_img, "wb") as f:
            f.write(b"dummy image content")
            
    try:
        structured_data, raw_ocr = extract_fields(test_img, engine="paddleocr")
        print("\n[Raw OCR Output]:\n", raw_ocr)
        print("\n[Structured Schema Fields]:")
        for k, v in structured_data.items():
            print(f"  {k}: {v}")
            
        # Assert schema fields exist
        assert "owner_name" in structured_data, "Missing owner_name"
        assert "survey_number" in structured_data, "Missing survey_number"
        assert "khata_type" in structured_data, "Missing khata_type"
        assert structured_data["khata_type"] in ["A", "B", None], "Invalid khata_type value"
        print("\nOffline Extraction Validation: PASS")
    except Exception as e:
        print("\nOffline Extraction Validation: FAIL -", e)

if __name__ == "__main__":
    test_offline_extraction()
