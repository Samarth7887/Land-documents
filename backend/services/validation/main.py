from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from validator import validate_record

app = FastAPI(
    title="Land Records Validation API",
    description="Microservice to run business rule validation on extracted land record structures."
)

class ValidationRequest(BaseModel):
    record: Dict[str, Any] = Field(..., description="The confidence-annotated extracted land record JSON.")
    existing_records: Optional[List[Dict[str, Any]]] = Field(
        default_factory=list, 
        description="A list of existing land records to check against for duplicates."
    )

@app.get("/health")
def health():
    return {"status": "OK", "service": "validation"}

@app.post("/validate")
async def validate(payload: ValidationRequest):
    """
    Validates a land record against standard and village-specific business rules.
    Failing fields will have their confidence score downgraded, and validation
    issues will be attached to the response.
    """
    try:
        annotated_record, issues = validate_record(payload.record, payload.existing_records)
        
        response_data = {
            "record": annotated_record,
            "issues": issues,
            "isValid": len(issues) == 0
        }
        
        return JSONResponse(status_code=200, content=response_data)
        
    except Exception as e:
        print("[Validation Service Error]:", str(e))
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )
