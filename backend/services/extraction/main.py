from fastapi import FastAPI, File, UploadFile, Query, HTTPException
from fastapi.responses import JSONResponse
import shutil
import tempfile
import os
from extractor import extract_fields

app = FastAPI(
    title="Land Records Text Extraction API",
    description="Microservice utilizing Gemini Vision and/or PaddleOCR to parse structured details from document scans."
)

@app.get("/health")
def health():
    return {"status": "OK", "service": "extraction"}

@app.post("/extract")
async def extract(
    file: UploadFile = File(...),
    engine: str = Query(None, description="Extraction engine: 'gemini' or 'paddleocr'")
):
    """
    Accepts an uploaded preprocessed image, extracts land record fields,
    and returns a structured JSON object matching the SCHEMA.md schema,
    along with a 'raw_ocr_text' debugging field.
    """
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ['.png', '.jpg', '.jpeg', '.tiff', '.bmp']:
        raise HTTPException(status_code=400, detail="Unsupported image format.")
        
    # Get the default engine from env or fallback to gemini
    default_engine = os.environ.get("EXTRACTION_ENGINE", "gemini").lower()
    selected_engine = engine.lower() if engine else default_engine
    
    if selected_engine not in ["gemini", "paddleocr"]:
        raise HTTPException(status_code=400, detail="Invalid engine. Must be 'gemini' or 'paddleocr'.")
        
    # Save the file temporarily
    fd, temp_path = tempfile.mkstemp(suffix=ext)
    os.close(fd)
    
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Execute the extraction
        structured_data, raw_ocr_text = extract_fields(temp_path, engine=selected_engine)
        
        # Format the response
        response_content = {
            **structured_data,
            "raw_ocr_text": raw_ocr_text
        }
        
        return JSONResponse(status_code=200, content=response_content)
        
    except Exception as e:
        print("[Extraction Service Error]:", str(e))
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
