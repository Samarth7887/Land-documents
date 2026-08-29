from fastapi import FastAPI, UploadFile, File, BackgroundTasks, Query, HTTPException
from fastapi.responses import JSONResponse
import shutil
import tempfile
import os
from orchestrator import job_manager, run_pipeline_task

app = FastAPI(
    title="Land Records Pipeline Orchestrator API",
    description="Microservice coordinating multi-page scanned PDF document processing."
)

@app.get("/health")
def health():
    return {"status": "OK", "service": "pipeline"}

@app.post("/process")
async def process(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    engine: str = Query("gemini", description="Extraction engine: 'gemini' or 'paddleocr'")
):
    """
    Accepts an uploaded multi-page document (PDF/ZIP/Scan bundle),
    initializes a background processing job, and returns a job ID to track progress.
    """
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ['.pdf', '.zip', '.tiff', '.tif']:
        raise HTTPException(
            status_code=400, 
            detail="Unsupported bundle format. Please upload a multi-page PDF or zip archive."
        )
        
    # Save the file temporarily
    fd, temp_path = tempfile.mkstemp(suffix=ext)
    os.close(fd)
    
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Register background task
    job_id = job_manager.create_job()
    background_tasks.add_task(run_pipeline_task, job_id, temp_path, engine)
    
    return {"success": True, "job_id": job_id, "message": "Pipeline processing started in the background."}

@app.get("/status/{job_id}")
async def status(job_id: str):
    """
    Returns the status, progress, logs, and completed extraction results of a background job.
    """
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job ID not found.")
        
    return JSONResponse(status_code=200, content=job)
