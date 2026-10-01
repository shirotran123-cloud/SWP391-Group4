-- ============================================================================
-- AITA Intelligent Autograding Platform - Master Database Migration
-- Consolidated 10 Tables Schema (Matches Section 3.3 Architecture ERD)
-- Compatible with PostgreSQL 14+, Neon, Supabase & Azure Database for PostgreSQL
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. Table: USERS (Workflow 0 - Identity & Role Management)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    user_id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(128) NOT NULL UNIQUE,
    full_name VARCHAR(128) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'STUDENT', -- 'STUDENT' | 'INSTRUCTOR' | 'ADMIN'
    password_hash VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ----------------------------------------------------------------------------
-- 2. Table: COURSES (Workflow 0 - Academic Course Management)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS courses (
    course_id VARCHAR(64) PRIMARY KEY,
    course_code VARCHAR(32) NOT NULL UNIQUE,
    course_name VARCHAR(255) NOT NULL,
    description TEXT,
    semester VARCHAR(32) NOT NULL,
    instructor_id VARCHAR(64) NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_courses_code ON courses(course_code);
CREATE INDEX IF NOT EXISTS idx_courses_instructor ON courses(instructor_id);

-- ----------------------------------------------------------------------------
-- 3. Table: ASSIGNMENTS (Workflow 0 - Coding Exercise & Grading Criteria)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assignments (
    assignment_id VARCHAR(64) PRIMARY KEY,
    course_id VARCHAR(64) NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    allowed_languages JSONB NOT NULL DEFAULT '["java", "python", "cpp", "dotnet"]'::jsonb,
    max_score NUMERIC(4, 2) NOT NULL DEFAULT 10.00,
    deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    time_limit_ms INT NOT NULL DEFAULT 2000,
    memory_limit_mb INT NOT NULL DEFAULT 512,
    testcases_count INT NOT NULL DEFAULT 2,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assignments_course_id ON assignments(course_id);
CREATE INDEX IF NOT EXISTS idx_assignments_deadline ON assignments(deadline);

-- ----------------------------------------------------------------------------
-- 4. Table: SUBMISSIONS (Workflow 2 - Submission Pipeline & Evaluation)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS submissions (
    submission_id VARCHAR(64) PRIMARY KEY,
    student_id VARCHAR(64) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    assignment_id VARCHAR(64) NOT NULL REFERENCES assignments(assignment_id) ON DELETE CASCADE,
    language VARCHAR(32) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes INT NOT NULL,
    sha256_hash VARCHAR(64) NOT NULL,
    file_path TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'QUEUED', -- 'QUEUED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'REJECTED'
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

-- ----------------------------------------------------------------------------
-- 5. Table: DEAD_LETTER_QUEUE (Exception Path Coordinator & DLQ Monitoring)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dead_letter_jobs (
    dlq_id VARCHAR(64) PRIMARY KEY,
    queue_name VARCHAR(64) NOT NULL DEFAULT 'submission-grading-queue',
    original_job_id VARCHAR(128) NOT NULL,
    submission_id VARCHAR(64) NOT NULL REFERENCES submissions(submission_id) ON DELETE CASCADE,
    payload JSONB NOT NULL,
    failed_reason TEXT NOT NULL,
    attempts_made INT NOT NULL DEFAULT 3,
    stacktrace TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'FAILED', -- 'FAILED' | 'RETRIED' | 'DISCARDED'
    failed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    retried_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_dlq_submission_id ON dead_letter_jobs(submission_id);
CREATE INDEX IF NOT EXISTS idx_dlq_status ON dead_letter_jobs(status);
CREATE INDEX IF NOT EXISTS idx_dlq_failed_at ON dead_letter_jobs(failed_at DESC);

-- ----------------------------------------------------------------------------
-- 6. Table: AI_REVIEW_RESULTS (Subsystem 3 - GenAI Code Quality & SOLID Evaluation)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_review_results (
    review_id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    submission_id VARCHAR(64) NOT NULL REFERENCES submissions(submission_id) ON DELETE CASCADE,
    clean_code_score NUMERIC(3, 1) NOT NULL CHECK (clean_code_score >= 0.0 AND clean_code_score <= 10.0),
    solid_score NUMERIC(3, 1) NOT NULL CHECK (solid_score >= 0.0 AND solid_score <= 10.0),
    feedback_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    compiler_explanation TEXT,
    evaluated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    model_used VARCHAR(50) NOT NULL,
    token_usage JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_review_results_submission_id ON ai_review_results(submission_id);
CREATE INDEX IF NOT EXISTS idx_ai_review_results_evaluated_at ON ai_review_results(evaluated_at DESC);

-- ----------------------------------------------------------------------------
-- 7. Table: AI_PROMPT_TEMPLATES (Subsystem 3 - System Prompts & Rubrics Configuration)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_prompt_templates (
    template_id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    template_code VARCHAR(50) NOT NULL UNIQUE,
    version INT NOT NULL DEFAULT 1,
    description VARCHAR(255),
    system_prompt TEXT NOT NULL,
    user_prompt_template TEXT NOT NULL,
    temperature NUMERIC(2, 1) NOT NULL DEFAULT 0.2,
    json_schema JSONB NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_prompt_templates_code ON ai_prompt_templates(template_code, is_active);

-- ----------------------------------------------------------------------------
-- 8. Table: AST_FINGERPRINTS (Subsystem 4 - Winnowing Digital Fingerprints)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ast_fingerprints (
    fingerprint_id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    submission_id VARCHAR(64) NOT NULL REFERENCES submissions(submission_id) ON DELETE CASCADE,
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
-- 9. Table: PLAGIARISM_REPORTS (Subsystem 4 - Pairwise Similarity Matrices)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plagiarism_reports (
    report_id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    assignment_id VARCHAR(64) REFERENCES assignments(assignment_id) ON DELETE SET NULL,
    submission_a_id VARCHAR(64) NOT NULL REFERENCES submissions(submission_id) ON DELETE CASCADE,
    submission_b_id VARCHAR(64) NOT NULL REFERENCES submissions(submission_id) ON DELETE CASCADE,
    similarity_rate NUMERIC(5, 2) NOT NULL CHECK (similarity_rate >= 0.0 AND similarity_rate <= 100.0),
    common_fingerprints_count INT NOT NULL DEFAULT 0,
    total_unique_fingerprints INT NOT NULL DEFAULT 0,
    matched_tokens_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(30) NOT NULL DEFAULT 'FLAGGED_PLAGIARISM' CHECK (status IN ('CLEAN', 'SUSPECTED', 'FLAGGED_HIGH', 'FLAGGED_PLAGIARISM', 'CONFIRMED', 'DISMISSED')),
    evaluated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_pairwise_submission UNIQUE (submission_a_id, submission_b_id)
);

CREATE INDEX IF NOT EXISTS idx_plagiarism_reports_assignment ON plagiarism_reports(assignment_id);
CREATE INDEX IF NOT EXISTS idx_plagiarism_reports_similarity ON plagiarism_reports(similarity_rate DESC);
CREATE INDEX IF NOT EXISTS idx_plagiarism_reports_sub_a ON plagiarism_reports(submission_a_id);
CREATE INDEX IF NOT EXISTS idx_plagiarism_reports_sub_b ON plagiarism_reports(submission_b_id);

-- ----------------------------------------------------------------------------
-- 10. Table: PLAGIARISM_MATCHES (Subsystem 4 - Relational Segment Mapping)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plagiarism_matches (
    match_id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    report_id VARCHAR(64) NOT NULL REFERENCES plagiarism_reports(report_id) ON DELETE CASCADE,
    hash_value VARCHAR(64) NOT NULL,
    line_start_a INT NOT NULL,
    line_end_a INT NOT NULL,
    line_start_b INT NOT NULL,
    line_end_b INT NOT NULL,
    token_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_plagiarism_matches_report ON plagiarism_matches(report_id);
CREATE INDEX IF NOT EXISTS idx_plagiarism_matches_hash ON plagiarism_matches(hash_value);

-- ============================================================================
-- SEED DATA - DỮ LIỆU KHỞI TẠO BAN ĐẦU CHO HỆ THỐNG
-- ============================================================================

-- 1. Users
INSERT INTO users (user_id, email, full_name, role, password_hash, is_active)
VALUES
('ADMIN001', 'admin@aita.fpt.edu.vn', 'Hệ Thống Quản Trị AITA', 'ADMIN', 'hashed_admin_pass', TRUE),
('GV001', 'trungdt.teacher@aita.fpt.edu.vn', 'ThS. Đinh Thành Trung (Giảng viên)', 'INSTRUCTOR', 'hashed_gv_pass', TRUE),
('SE170000', 'trungdt.student@aita.fpt.edu.vn', 'Đinh Thành Trung (Sinh viên)', 'STUDENT', 'hashed_sv_pass', TRUE),
('SE170123', 'nguyentt@aita.fpt.edu.vn', 'Trần Thanh Nguyên', 'STUDENT', 'hashed_sv_pass', TRUE),
('SE170456', 'vinhtt@aita.fpt.edu.vn', 'Nguyễn Hoàng Vinh', 'STUDENT', 'hashed_sv_pass', TRUE)
ON CONFLICT (user_id) DO NOTHING;

-- 2. Courses
INSERT INTO courses (course_id, course_code, course_name, description, semester, instructor_id, is_active)
VALUES
('CRS-PRF192', 'PRF192', 'Lập Trình Cơ Bản Với C/C++', 'Nền tảng cú pháp, mảng, con trỏ và giải thuật cơ bản', 'Fall 2026', 'GV001', TRUE),
('CRS-PRO192', 'PRO192', 'Lập Trình Hướng Đối Tượng Java', '4 tính chất OOP, Collections Framework và SOLID principles', 'Fall 2026', 'GV001', TRUE),
('CRS-CSD201', 'CSD201', 'Cấu Trúc Dữ Liệu & Giải Thuật', 'Cây nhị phân, Đồ thị, Bảng băm và Tối ưu độ phức tạp', 'Fall 2026', 'GV001', TRUE)
ON CONFLICT (course_id) DO NOTHING;

-- 3. Prompt Templates
INSERT INTO ai_prompt_templates (template_code, version, description, system_prompt, user_prompt_template, temperature, json_schema, is_active)
VALUES 
(
    'CLEAN_CODE_SOLID_V1',
    1,
    'Deterministic Clean Code & SOLID principles reviewer with strict JSON schema',
    'You are the Lead Code Reviewer and Architectural Evaluator for the AITA Autograding System. Evaluate student code for Clean Code quality and SOLID principles deterministically.',
    'Evaluate the submission for {{language}}. Context: {{topic}}. Learning Outcomes: {{learningOutcomes}}. Student Code:\n{{code}}',
    0.2,
    '{"type": "object", "properties": {"clean_code_score": {"type": "number"}, "solid_score": {"type": "number"}, "code_smells": {"type": "array"}}, "required": ["clean_code_score", "solid_score", "code_smells"]}'::jsonb,
    TRUE
),
(
    'EXAM_RUBRIC_V1',
    1,
    'Automated exam question, test cases, and multi-level rubric generator for lecturers (UC-08)',
    'You are an expert Computer Science Professor and Curriculum Designer for the AITA Autograding System. Generate rigorous programming assignments with test cases and rubrics.',
    'Generate an assignment for course {{courseCode}}, topic {{topic}}, difficulty {{difficulty}}, language {{language}}.',
    0.3,
    '{"type": "object", "properties": {"title": {"type": "string"}, "sampleTestCases": {"type": "array"}, "rubric": {"type": "array"}}, "required": ["title", "sampleTestCases", "rubric"]}'::jsonb,
    TRUE
),
(
    'COMPILER_EXPLAIN_V1',
    1,
    'Pedagogical Socratic compiler & runtime crash explanation engine',
    'You are a supportive, pedagogical programming teaching assistant. Explain compiler and runtime crashes clearly without revealing full solutions.',
    'Language: {{language}}. Error log:\n{{compilerOutput}}',
    0.2,
    '{"type": "object", "properties": {"errorType": {"type": "string"}, "simpleExplanation": {"type": "string"}, "actionableHints": {"type": "array"}}, "required": ["errorType", "simpleExplanation", "actionableHints"]}'::jsonb,
    TRUE
)
ON CONFLICT (template_code) DO NOTHING;
