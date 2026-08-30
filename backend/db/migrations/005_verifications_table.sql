-- Migration 005: Create verifications table for storing post-approval
-- signing metadata separately from the records table.
-- The records table already carries signature/public_key/qr_code columns
-- (added in 003_completions.sql). This table keeps a cleaner audit trail
-- with one row per verification event and a stable UUID for public URLs.

CREATE TABLE IF NOT EXISTS verifications (
    id                  SERIAL PRIMARY KEY,
    record_id           VARCHAR(100) NOT NULL REFERENCES records(id) ON DELETE CASCADE,
    verification_id     UUID         NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    signature           TEXT         NOT NULL,
    public_key          TEXT         NOT NULL,
    qr_code             TEXT         NOT NULL,  -- data:image/png;base64,... from signing service
    verified_at         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT verifications_record_id_unique UNIQUE (record_id)   -- one verification per record
);

-- Index for fast lookup by the public UUID
CREATE INDEX IF NOT EXISTS idx_verifications_verification_id ON verifications(verification_id);
