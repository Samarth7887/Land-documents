from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import FileResponse, JSONResponse
import shutil
import tempfile
import os
from scanner import process_image

app = FastAPI(
    title="Land Records Image Preprocessing API",
    description="Microservice to clean up, deskew, and enhance scanned land document images."
)

@app.get("/health")
def health():
    return {"status": "OK", "service": "preprocessing"}

@app.post("/preprocess")
async def preprocess(file: UploadFile = File(...)):
    """
    Accepts an uploaded image file (JPEG/PNG/PDF), runs the preprocessing pipeline,
    and returns the cleaned/binarized black-and-white output image.
    """
    # Verify file extension
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ['.png', '.jpg', '.jpeg', '.tiff', '.bmp']:
        raise HTTPException(status_code=400, detail="Only standard image files (PNG, JPG, JPEG, TIFF, BMP) are supported.")

    # Create temporary files for processing
    fd_in, temp_in_path = tempfile.mkstemp(suffix=ext)
    fd_out, temp_out_path = tempfile.mkstemp(suffix=ext)
    
    # Close descriptors immediately as we will write using standard file open/shutil
    os.close(fd_in)
    os.close(fd_out)

    try:
        # Write uploaded file content to disk
        with open(temp_in_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Run preprocessing pipeline
        process_image(temp_in_path, temp_out_path)
        
        # Return the processed file
        return FileResponse(
            temp_out_path, 
            media_type="image/png", 
            filename=f"cleaned_{file.filename}"
        )

    except Exception as e:
        # Clean up in case of error
        if os.path.exists(temp_in_path):
            os.remove(temp_in_path)
        if os.path.exists(temp_out_path):
            os.remove(temp_out_path)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )
