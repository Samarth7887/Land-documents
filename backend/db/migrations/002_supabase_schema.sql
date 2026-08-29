-- Supabase / PostgreSQL Schema Migration for Land Records Digitization Suite

-- Drop tables if they exist (for clean migration runs)
DROP TRIGGER IF EXISTS audit_log_append_only ON audit_log;
DROP FUNCTION IF EXISTS enforce_append_only();
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS corrections;
DROP TABLE IF EXISTS records;
DROP TABLE IF EXISTS users;

-- 1. Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) CHECK (role IN ('clerk', 'supervisor', 'admin')) NOT NULL,
    district VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Records Table (matching SCHEMA.md nested format in extracted_fields JSONB column)
CREATE TABLE records (
    id VARCHAR(100) PRIMARY KEY,
    status VARCHAR(50) CHECK (status IN ('extracted', 'reviewed', 'corrected', 'approved')) NOT NULL,
    district VARCHAR(100) NOT NULL,
    extracted_fields JSONB NOT NULL, -- Holds confidence-annotated fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Corrections Table
CREATE TABLE corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id VARCHAR(100) REFERENCES records(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    field_name VARCHAR(100) NOT NULL,
    original_value TEXT,
    corrected_value TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Audit Log Table (Immutable / Append-only)
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id VARCHAR(100) REFERENCES records(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    previous_state VARCHAR(50),
    new_state VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ========================================================
-- RLS (Row-Level Security) Policies
-- ========================================================

-- Enable Row-Level Security on records
ALTER TABLE records ENABLE ROW LEVEL SECURITY;

-- Helper RLS policies for different roles
-- Admin policy: Full access
CREATE POLICY admin_records_policy ON records 
    FOR ALL 
    TO authenticated 
    USING (
        (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
    );

-- Supervisor policy: Select & Update all records
CREATE POLICY supervisor_records_policy ON records 
    FOR ALL 
    TO authenticated 
    USING (
        (SELECT role FROM users WHERE id = auth.uid()) = 'supervisor'
    );

-- Clerk policy: Select & Update records only assigned to their district
CREATE POLICY clerk_records_policy ON records 
    FOR ALL 
    TO authenticated 
    USING (
        (SELECT role FROM users WHERE id = auth.uid()) = 'clerk' 
        AND district = (SELECT district FROM users WHERE id = auth.uid())
    );

-- ========================================================
-- Enforce Append-Only Trigger on Audit Log
-- ========================================================

CREATE OR REPLACE FUNCTION enforce_append_only()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Updates and deletions are prohibited on the audit_log table.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_append_only
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW 
EXECUTE FUNCTION enforce_append_only();
