-- Add document_id reference to processing_jobs table
ALTER TABLE processing_jobs ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES documents(id) ON DELETE CASCADE;
