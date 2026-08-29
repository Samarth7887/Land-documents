import os
import json
import base64
from io import BytesIO
import qrcode
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import hashes, serialization

# Global local RSA keys generated at startup
PRIVATE_KEY = rsa.generate_private_key(
    public_exponent=65537,
    key_size=2048
)
PUBLIC_KEY = PRIVATE_KEY.public_key()

def get_public_key_pem() -> str:
    """Serializes the public key to PEM format."""
    pem = PUBLIC_KEY.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    )
    return pem.decode("utf-8")

def canonical_hash(fields: dict) -> bytes:
    """
    Creates a deterministic SHA-256 hash from the values inside the record fields.
    Sorts keys to ensure identical data always produces the same hash.
    """
    # Extract values only
    data_to_hash = {}
    for key in sorted(fields.keys()):
        field = fields[key]
        if isinstance(field, dict) and "value" in field:
            data_to_hash[key] = field["value"]
        else:
            data_to_hash[key] = field
            
    canonical_json = json.dumps(data_to_hash, sort_keys=True)
    
    # Hash calculation
    digest = hashes.Hash(hashes.SHA256())
    digest.update(canonical_json.encode("utf-8"))
    return digest.finalize()

def sign_record_hash(fields: dict) -> str:
    """Signs the record's field values hash and returns the signature in base64 format."""
    hash_bytes = canonical_hash(fields)
    
    # RSA private key sign
    signature = PRIVATE_KEY.sign(
        hash_bytes,
        padding.PSS(
            mgf=padding.MGF1(hashes.SHA256()),
            salt_length=padding.PSS.MAX_LENGTH
        ),
        hashes.SHA256()
    )
    return base64.b64encode(signature).decode("utf-8")

def verify_record_signature(fields: dict, signature_b64: str) -> bool:
    """Verifies that the record values match the signed hash."""
    try:
        hash_bytes = canonical_hash(fields)
        signature = base64.b64decode(signature_b64)
        
        # Verify using public key
        PUBLIC_KEY.verify(
            signature,
            hash_bytes,
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=padding.PSS.MAX_LENGTH
            ),
            hashes.SHA256()
        )
        return True
    except Exception as e:
        print(f"[Verification Error] Signature mismatch: {e}")
        return False

def generate_verification_qr_b64(verify_url: str) -> str:
    """Generates a QR code for the verification URL and returns it as a Base64 PNG image."""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(verify_url)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    
    buffered = BytesIO()
    img.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{img_str}"
