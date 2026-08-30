-- Align existing schema for approvals, processing jobs, and verification signatures

DROP TABLE IF EXISTS approvals CASCADE;
DROP TABLE IF EXISTS processing_jobs CASCADE;

-- Align Records Table Columns
ALTER TABLE records ADD COLUMN IF NOT EXISTS document_uuid UUID;
ALTER TABLE records ADD COLUMN IF NOT EXISTS signature TEXT;
ALTER TABLE records ADD COLUMN IF NOT EXISTS public_key TEXT;
ALTER TABLE records ADD COLUMN IF NOT EXISTS qr_code TEXT;
ALTER TABLE records ADD COLUMN IF NOT EXISTS document_id_code VARCHAR(100);

-- 5. Approvals Table
CREATE TABLE IF NOT EXISTS approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id VARCHAR(100) REFERENCES records(id) ON DELETE CASCADE,
    supervisor_id VARCHAR(100) REFERENCES users(id) ON DELETE SET NULL,
    signature TEXT NOT NULL,
    approved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Processing Jobs Table
CREATE TABLE IF NOT EXISTS processing_jobs (
    id VARCHAR(100) PRIMARY KEY,
    status VARCHAR(50) NOT NULL,
    progress INT DEFAULT 0,
    message TEXT,
    results JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
