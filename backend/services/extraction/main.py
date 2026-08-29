"""
main.py — Extraction Service FastAPI entry point.

Startup order:
  1. Load backend/.env via python-dotenv (so GEMINI_API_KEY is available to extractor.py)
  2. Report GEMINI_API_KEY status to console (configured / missing — never prints the value)
  3. Start FastAPI app
"""

import os
import sys
from pathlib import Path

# --------------------------------------------------------------------------
# Load environment variables from backend/.env before anything else imports.
# The .env file lives two levels up: extraction/ -> services/ -> backend/
# --------------------------------------------------------------------------
from dotenv import load_dotenv

_ENV_PATH = Path(__file__).resolve().parent.parent.parent / ".env"
_loaded = load_dotenv(dotenv_path=_ENV_PATH, override=False)  # override=False: system env wins

# --------------------------------------------------------------------------
# Startup key check — prints configured/missing, NEVER the actual value
# --------------------------------------------------------------------------
_api_key_present = bool(os.environ.get("GEMINI_API_KEY", "").strip())

print("=" * 56)
print("  Terravision Extraction Service -- Startup Check")
print("=" * 56)
print(f"  .env loaded from : {_ENV_PATH} ({'found' if _loaded else 'NOT FOUND'})")
print(f"  GEMINI_API_KEY   : {'configured [OK]' if _api_key_present else 'MISSING [!!] -- Gemini extraction will fail'}")
print(f"  Extraction engine: {os.environ.get('EXTRACTION_ENGINE', 'gemini (default)')}")
print("=" * 56)

if not _api_key_present:
    print(
        "\n[WARNING] GEMINI_API_KEY is not set.\n"
        "  Gemini engine calls will return an error (no silent fallback).\n"
        "  Set GEMINI_API_KEY in backend/.env or as a system environment variable.\n"
    )

# --------------------------------------------------------------------------
# FastAPI app
# --------------------------------------------------------------------------
from fastapi import FastAPI, File, UploadFile, Query, HTTPException
from fastapi.responses import JSONResponse
import shutil
import tempfile
from extractor import extract_fields

app = FastAPI(
    title="Land Records Text Extraction API",
    description=(
        "Microservice utilizing Gemini Vision (google-genai SDK) and/or PaddleOCR "
        "to parse structured details from document scans."
    ),
)

@app.get("/health")
def health():
    """Returns service status and whether Gemini key is configured."""
    return {
        "status": "OK",
        "service": "extraction",
        "gemini_api_key": "configured" if _api_key_present else "missing",
        "extraction_engine": os.environ.get("EXTRACTION_ENGINE", "gemini"),
    }

@app.post("/extract")
async def extract(
    file: UploadFile = File(...),
    engine: str = Query(None, description="Extraction engine: 'gemini' or 'paddleocr'"),
    is_blurry: bool = Query(False, description="Simulate a blurry input image for fallback testing"),
    language: str = Query("hi", description="Expected script/language of the document (e.g. 'hi', 'en')"),
    document_type: str = Query("printed", description="Type of document content layout: 'printed' or 'handwritten'"),
):
    """
    Accepts an uploaded preprocessed image, extracts land record fields,
    and returns a structured JSON object matching the SCHEMA.md schema.

    Gemini engine: raises a 500 error if key is missing or Gemini returns bad output.
                   No silent fallback to mock data.
    PaddleOCR engine: runs local OCR (or synthetic lines if PaddleOCR not installed).
    """
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ['.png', '.jpg', '.jpeg', '.tiff', '.bmp']:
        raise HTTPException(status_code=400, detail="Unsupported image format.")

    default_engine = os.environ.get("EXTRACTION_ENGINE", "gemini").lower()
    selected_engine = engine.lower() if engine else default_engine

    if selected_engine not in ["gemini", "paddleocr"]:
        raise HTTPException(status_code=400, detail="Invalid engine. Must be 'gemini' or 'paddleocr'.")

    if document_type.lower() not in ["printed", "handwritten"]:
        raise HTTPException(status_code=400, detail="Invalid document_type. Must be 'printed' or 'handwritten'.")

    # Reject Gemini requests early if key is not configured
    if selected_engine == "gemini" and not _api_key_present:
        return JSONResponse(
            status_code=503,
            content={
                "success": False,
                "error": "GEMINI_API_KEY is not configured. Set it in backend/.env and restart the extraction service.",
                "engine": "gemini",
            },
        )

    fd, temp_path = tempfile.mkstemp(suffix=ext)
    os.close(fd)

    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        structured_data, raw_ocr_text = extract_fields(
            temp_path,
            engine=selected_engine,
            is_blurry=is_blurry,
            language=language,
            document_type=document_type,
        )

        return JSONResponse(
            status_code=200,
            content={**structured_data, "raw_ocr_text": raw_ocr_text},
        )

    except ValueError as e:
        # Extraction logic raised a clear error (bad key, bad Gemini response, etc.)
        print(f"[Extraction Service] Extraction error: {e}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e), "engine": selected_engine},
        )
    except Exception as e:
        print(f"[Extraction Service] Unexpected error: {e}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)},
        )
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
