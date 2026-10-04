-- ============================================================================
-- AITA Intelligent Autograding Platform - Subsystem 1 & 5 Database Migration
-- Table: SUBMISSIONS
-- Matches Section 3.3 ERD: SUBMISSIONS (Core Gateway Entity)
-- Compatible with PostgreSQL 14+ / Supabase
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS submissions (
    submission_id VARCHAR(64) PRIMARY KEY,
    student_id VARCHAR(64) NOT NULL,
    assignment_id VARCHAR(64) NOT NULL,
    language VARCHAR(32) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes INT NOT NULL,
    sha256_hash VARCHAR(64) NOT NULL,
    file_path TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'QUEUED',
    queue_job_id VARCHAR(128),
    score NUMERIC(4, 2),
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment_id ON submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_sha256_hash ON submissions(sha256_hash);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions(created_at DESC);
