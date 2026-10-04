-- ============================================================================
-- AITA Intelligent Autograding Platform - Subsystem 4 Database Migrations
-- AST_FINGERPRINTS & PLAGIARISM_REPORTS
-- Compatible with PostgreSQL 14+ / Supabase
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. Table: AST_FINGERPRINTS
-- Stores Winnowing digital fingerprints extracted from AST-normalized code
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ast_fingerprints (
    fingerprint_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL,
    file_path VARCHAR(255) NOT NULL DEFAULT 'main',
    hash_value VARCHAR(64) NOT NULL,
    line_start INT NOT NULL,
    line_end INT NOT NULL,
    token_start INT NOT NULL,
    token_end INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ast_fingerprints_submission ON ast_fingerprints(submission_id);
CREATE INDEX IF NOT EXISTS idx_ast_fingerprints_hash ON ast_fingerprints(hash_value);
CREATE INDEX IF NOT EXISTS idx_ast_fingerprints_sub_hash ON ast_fingerprints(submission_id, hash_value);

-- ----------------------------------------------------------------------------
-- 2. Table: PLAGIARISM_REPORTS
-- Stores pairwise plagiarism comparison results, similarity matrices,
-- and matched token coordinates for Monaco Diff Viewer rendering.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plagiarism_reports (
    report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID,
    submission_a_id UUID NOT NULL,
    submission_b_id UUID NOT NULL,
    similarity_rate NUMERIC(5, 2) NOT NULL CHECK (similarity_rate >= 0.0 AND similarity_rate <= 100.0),
    common_fingerprints_count INT NOT NULL DEFAULT 0,
    total_unique_fingerprints INT NOT NULL DEFAULT 0,
    matched_tokens_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(30) NOT NULL DEFAULT 'FLAGGED_HIGH' CHECK (status IN ('CLEAN', 'SUSPECTED', 'FLAGGED_HIGH', 'CONFIRMED', 'DISMISSED')),
    evaluated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_pairwise_submission UNIQUE (submission_a_id, submission_b_id)
);

CREATE INDEX IF NOT EXISTS idx_plagiarism_reports_assignment ON plagiarism_reports(assignment_id);
CREATE INDEX IF NOT EXISTS idx_plagiarism_reports_similarity ON plagiarism_reports(similarity_rate DESC);
CREATE INDEX IF NOT EXISTS idx_plagiarism_reports_sub_a ON plagiarism_reports(submission_a_id);
CREATE INDEX IF NOT EXISTS idx_plagiarism_reports_sub_b ON plagiarism_reports(submission_b_id);
