import os
import cv2
import numpy as np
from scanner import process_image

# Directories
TEST_DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "test-data"))
OUTPUT_DIR = os.path.join(TEST_DATA_DIR, "output")

def create_synthetic_images():
    """
    Creates synthetic test images to simulate clean, skewed, and faded scans
    in case they do not yet exist in the test-data folder.
    """
    os.makedirs(TEST_DATA_DIR, exist_ok=True)
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    clean_path = os.path.join(TEST_DATA_DIR, "clean_scan.png")
    skewed_path = os.path.join(TEST_DATA_DIR, "skewed_photo.png")
    faded_path = os.path.join(TEST_DATA_DIR, "faded_scan.png")
    
    # 1. Clean Scan Simulation
    if not os.path.exists(clean_path):
        print("[Setup] Generating synthetic clean scan...")
        img = np.ones((600, 450, 3), dtype=np.uint8) * 255
        # Add page border
        cv2.rectangle(img, (20, 20), (430, 580), (220, 220, 220), 2)
        # Add mock text rows
        for i in range(5):
            y = 100 + i * 50
            cv2.putText(img, f"Land Registry Document Row {i+1}", (50, y), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (50, 50, 50), 2)
            cv2.putText(img, "Survey Number: 101/A   Area: 1.25 Acres", (50, y + 20), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (100, 100, 100), 1)
        cv2.imwrite(clean_path, img)
        
    # 2. Skewed Photo Simulation
    if not os.path.exists(skewed_path):
        print("[Setup] Generating synthetic skewed photo...")
        img = np.ones((800, 800, 3), dtype=np.uint8) * 180  # grey table background
        
        # Create a document page (clean white rect)
        page = np.ones((500, 350, 3), dtype=np.uint8) * 255
        cv2.rectangle(page, (10, 10), (340, 490), (0, 0, 0), 2)
        for i in range(4):
            y = 100 + i * 50
            cv2.putText(page, f"Skewed Document Row {i+1}", (30, y), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (50, 50, 50), 1)
            
        # Rotate the page to create skew (12 degrees)
        angle = 12
        h, w = page.shape[:2]
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        rotated_page = cv2.warpAffine(page, M, (w, h), borderValue=(180, 180, 180))
        
        # Place it inside the grey background
        img[150:150+h, 200:200+w] = rotated_page
        cv2.imwrite(skewed_path, img)
        
    # 3. Faded Scan Simulation
    if not os.path.exists(faded_path):
        print("[Setup] Generating synthetic faded scan...")
        # Very light grey background to simulate aged paper
        img = np.ones((600, 450, 3), dtype=np.uint8) * 240
        # Add very low contrast/faint text
        for i in range(4):
            y = 120 + i * 60
            cv2.putText(img, f"Faded Historical Record Row {i+1}", (50, y), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (190, 190, 190), 1)
        # Add some salt & pepper noise
        noise = np.random.normal(0, 15, img.shape).astype(np.int16)
        img = np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)
        cv2.imwrite(faded_path, img)

    return clean_path, skewed_path, faded_path

def test_pipeline():
    print("=== Running Image Preprocessing Tests ===")
    
    # Ensure test inputs exist
    clean, skewed, faded = create_synthetic_images()
    
    test_cases = [
        ("Clean Scan", clean, "cleaned_clean_scan.png"),
        ("Skewed Photo", skewed, "cleaned_skewed_photo.png"),
        ("Faded Scan", faded, "cleaned_faded_scan.png")
    ]
    
    for name, input_path, output_filename in test_cases:
        output_path = os.path.join(OUTPUT_DIR, output_filename)
        print(f"\n[Test Case] Processing: {name} ({os.path.basename(input_path)})")
        try:
            res_path = process_image(input_path, output_path)
            print(f" -> Output saved: {os.path.relpath(res_path)}")
            # Assert file exists and is not empty
            assert os.path.exists(res_path), "Output file does not exist"
            assert os.path.getsize(res_path) > 0, "Output file is empty"
            print(f" -> Result: PASS")
        except Exception as e:
            print(f" -> Result: FAIL (Error: {e})")

if __name__ == "__main__":
    test_pipeline()
