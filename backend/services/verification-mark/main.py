from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Dict, Any
from signer import sign_record_hash, verify_record_signature, generate_verification_qr_b64, get_public_key_pem

app = FastAPI(
    title="Land Records Digital Verification Mark API",
    description="Microservice to hash, sign, verify, and generate secure verification marks for approved land records."
)

class SignRequest(BaseModel):
    fields: Dict[str, Any] = Field(..., description="Annotated land record fields dictionary.")
    verify_url: str = Field(..., description="Verification URL to embed in the QR code.")

class VerifyRequest(BaseModel):
    fields: Dict[str, Any] = Field(..., description="Annotated land record fields dictionary.")
    signature: str = Field(..., description="Base64 encoded digital signature to verify.")

@app.get("/health")
def health():
    return {"status": "OK", "service": "verification-mark"}

@app.post("/sign")
async def sign(payload: SignRequest):
    """
    Computes a SHA-256 hash of the final record values, signs it using an RSA private key,
    and generates a Base64-encoded verification QR code.
    """
    try:
        signature = sign_record_hash(payload.fields)
        public_key = get_public_key_pem()
        qr_code = generate_verification_qr_b64(payload.verify_url)
        
        return {
            "success": True,
            "signature": signature,
            "public_key": public_key,
            "qr_code": qr_code
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Signing failed: {str(e)}")

@app.post("/verify")
async def verify(payload: VerifyRequest):
    """
    Recomputes the record's current value hash and verifies it against the signature.
    """
    try:
        is_valid = verify_record_signature(payload.fields, payload.signature)
        return {
            "success": True,
            "verified": is_valid
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Verification verification failed: {str(e)}")
