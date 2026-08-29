import cv2
import numpy as np
import os

def order_points(pts):
    """
    Orders coordinates of a quadrilateral in the order:
    top-left, top-right, bottom-right, bottom-left.
    """
    rect = np.zeros((4, 2), dtype="float32")
    
    # top-left point will have the smallest sum,
    # bottom-right point will have the largest sum
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]
    
    # top-right point will have the smallest difference,
    # bottom-left will have the largest difference
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]
    
    return rect

def perspective_transform(image, pts):
    """
    Applies perspective transformation to obtain a top-down birds-eye view of the document.
    """
    rect = order_points(pts)
    (tl, tr, br, bl) = rect
    
    # Compute the width of the new image
    widthA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
    widthB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
    maxWidth = max(int(widthA), int(widthB))
    
    # Compute the height of the new image
    heightA = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
    heightB = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
    maxHeight = max(int(heightA), int(heightB))
    
    # Destination points for top-down view
    dst = np.array([
        [0, 0],
        [maxWidth - 1, 0],
        [maxWidth - 1, maxHeight - 1],
        [0, maxHeight - 1]
    ], dtype="float32")
    
    # Compute the perspective transform matrix and warp the image
    M = cv2.getPerspectiveTransform(rect, dst)
    warped = cv2.warpPerspective(image, M, (maxWidth, maxHeight))
    
    return warped

def detect_document_boundary(image):
    """
    Detects the boundaries of a document page inside the image.
    Returns the 4 corner points if found, otherwise None.
    """
    # Resize the image for faster and more reliable contour detection
    ratio = image.shape[0] / 500.0
    orig = image.copy()
    resized = cv2.resize(image, (int(image.shape[1] / ratio), 500))
    
    # Convert to grayscale, blur to remove high-frequency noise
    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)
    
    # Edge detection
    edged = cv2.Canny(gray, 75, 200)
    
    # Find contours in the edged image
    contours, _ = cv2.findContours(edged.copy(), cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:5]
    
    doc_contour = None
    for c in contours:
        # Approximate the contour
        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.02 * peri, True)
        
        # If our approximated contour has four points, we can assume we found the document
        if len(approx) == 4:
            doc_contour = approx
            break
            
    if doc_contour is not None:
        # Scale back the points to original image coordinates
        pts = doc_contour.reshape(4, 2) * ratio
        return pts
    return None

def correct_skew(image):
    """
    Detects the skew angle of the text lines and rotates the image to make them horizontal.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Apply thresholding or Canny to highlight text regions
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    
    # Dilate text lines to merge words/lines together
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (30, 5))
    dilated = cv2.dilate(thresh, kernel, iterations=2)
    
    # Find contours of dilated text lines
    contours, _ = cv2.findContours(dilated, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    
    angles = []
    for c in contours:
        # Discard small contours (noise)
        if cv2.contourArea(c) < 100:
            continue
            
        # Get minimum area bounding box
        rect = cv2.minAreaRect(c)
        angle = rect[-1]
        
        # OpenCV minAreaRect angle rules:
        # Depending on the version, angle is between [-90, 0] or [0, 90]
        # We normalize angle to range [-45, 45]
        if angle < -45:
            angle = 90 + angle
        elif angle > 45:
            angle = angle - 90
            
        angles.append(angle)
        
    if not angles:
        return image  # No deskew needed if no text detected
        
    # Find the median angle to reduce outlier influence
    median_angle = np.median(angles)
    
    # Avoid tiny rotations (less than 0.5 degrees)
    if abs(median_angle) < 0.5:
        return image
        
    # Rotate the image around its center
    (h, w) = image.shape[:2]
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, median_angle, 1.0)
    rotated = cv2.warpAffine(image, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    
    print(f"[Deskew] Rotated image by {median_angle:.2f} degrees")
    return rotated

def enhance_and_denoise(image):
    """
    Enhances contrast, applies adaptive thresholding, and denoises the document.
    """
    # Convert to grayscale
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # 1. Contrast Stretching (stretch 2nd to 98th percentile to [0, 255])
    xp = [0, 64, 128, 192, 255]
    fp = [0, 16, 128, 240, 255] # Custom contrast curve mapping
    
    # Stretch histogram dynamically
    p2, p98 = np.percentile(gray, (2, 98))
    gray_stretched = np.clip((gray - p2) * 255.0 / (p98 - p2), 0, 255).astype(np.uint8)
    
    # 2. Denoise with a light Gaussian blur to smooth background
    blurred = cv2.GaussianBlur(gray_stretched, (3, 3), 0)
    
    # 3. Adaptive Thresholding to separate text from background cleanly
    # Block size is 15, constant C is 9 to ensure faint text is preserved
    thresh = cv2.adaptiveThreshold(
        blurred, 
        255, 
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
        cv2.THRESH_BINARY, 
        15, 
        9
    )
    
    # 4. Morphological Cleanup (Opening to remove standalone dark pixels)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    cleaned = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)
    
    return cleaned

def process_image(input_path, output_path=None):
    """
    Full pipeline to preprocess a scanned document:
    1. Skew correction
    2. Document boundary perspective correction
    3. Contrast stretching, adaptive thresholding, and denoising
    """
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input file not found at {input_path}")
        
    # Read the image
    img = cv2.imread(input_path)
    if img is None:
        raise ValueError(f"Could not load image: {input_path}")
        
    # Step 1: Skew Correction
    deskewed = correct_skew(img)
    
    # Step 2: Boundary / Perspective Correction
    pts = detect_document_boundary(deskewed)
    if pts is not None:
        print("[Perspective] Found 4-point document boundaries. Applying warp.")
        warped = perspective_transform(deskewed, pts)
    else:
        print("[Perspective] No clear 4-point boundary found. Skipping warp.")
        warped = deskewed
        
    # Step 3: Enhance Contrast & Adaptive Thresholding
    final_output = enhance_and_denoise(warped)
    
    # Determine output path if not provided
    if output_path is None:
        base, ext = os.path.splitext(input_path)
        output_path = f"{base}_cleaned{ext}"
        
    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # Save the output file
    cv2.imwrite(output_path, final_output)
    return output_path
