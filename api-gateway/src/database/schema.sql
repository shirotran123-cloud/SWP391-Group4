-- ============================================================================
-- AITA Intelligent Autograding Platform - Master Database Schema (SRS Compliant)
-- Standard: IEEE Std 830-1998 SRS & Section 4 Data Dictionary
-- Exactly 13 Relational Tables in 3NF + 2 System Infrastructure Tables
-- Compatible with PostgreSQL 14+, Neon, Supabase, Azure Database for PostgreSQL
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. Table: ROLES (SRS Entity 1 - RBAC Authorization)
-- ============================================================================
CREATE TABLE IF NOT EXISTS roles (
    role_id VARCHAR(32) PRIMARY KEY,
    role_name VARCHAR(64) NOT NULL UNIQUE, -- 'ADMIN', 'LECTURER', 'STUDENT', 'HOD'
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 2. Table: USERS (SRS Entity 2 - Profiles & Google SSO)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    user_id VARCHAR(64) PRIMARY KEY,
    role_id VARCHAR(32) NOT NULL DEFAULT 'STUDENT' REFERENCES roles(role_id) ON DELETE RESTRICT,
    email VARCHAR(128) NOT NULL UNIQUE,
    full_name VARCHAR(128) NOT NULL,
    student_code VARCHAR(32) UNIQUE,
    role VARCHAR(32) NOT NULL DEFAULT 'STUDENT', -- Backward compatibility alias
    password_hash VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_student_code ON users(student_code);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);

-- ============================================================================
-- 3. Table: CLASSES (SRS Entity 3 - Academic Course Sections & Semesters)
-- ============================================================================
CREATE TABLE IF NOT EXISTS classes (
    class_id VARCHAR(64) PRIMARY KEY,
    lecturer_id VARCHAR(64) NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    class_code VARCHAR(32) NOT NULL UNIQUE, -- e.g. 'SE1701-SWP391'
    class_name VARCHAR(255) NOT NULL,
    semester VARCHAR(32) NOT NULL, -- e.g. 'Fall 2026'
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_classes_code ON classes(class_code);
CREATE INDEX IF NOT EXISTS idx_classes_lecturer ON classes(lecturer_id);
CREATE INDEX IF NOT EXISTS idx_classes_semester ON classes(semester);

-- View/Alias COURSES for backward compatibility
CREATE OR REPLACE VIEW courses AS 
SELECT 
    class_id AS course_id, 
    class_code AS course_code, 
    class_name AS course_name, 
    description, 
    semester, 
    lecturer_id AS instructor_id, 
    is_active, 
    created_at, 
    updated_at 
FROM classes;

-- ============================================================================
-- 4. Table: CLASS_MEMBERS (SRS Entity 4 - Class Roster & Enrollment)
-- ============================================================================
CREATE TABLE IF NOT EXISTS class_members (
    member_id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    class_id VARCHAR(64) NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT unique_class_user UNIQUE (class_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_class_members_class ON class_members(class_id);
CREATE INDEX IF NOT EXISTS idx_class_members_user ON class_members(user_id);

-- ============================================================================
-- 5. Table: ASSIGNMENTS (SRS Entity 5 - Programming Tasks & Sandbox Quotas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS assignments (
    assignment_id VARCHAR(64) PRIMARY KEY,
    class_id VARCHAR(64) NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
    course_id VARCHAR(64), -- Backward compatibility alias
    title VARCHAR(255) NOT NULL,
    description TEXT,
    language VARCHAR(32) NOT NULL DEFAULT 'java',
    allowed_languages JSONB NOT NULL DEFAULT '["java", "python", "cpp", "dotnet"]'::jsonb,
    time_limit_sec NUMERIC(4, 2) NOT NULL DEFAULT 2.0,
    time_limit_ms INT NOT NULL DEFAULT 2000,
    memory_limit_mb INT NOT NULL DEFAULT 512,
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    deadline TIMESTAMP WITH TIME ZONE, -- Backward compatibility alias
    max_score NUMERIC(4, 2) NOT NULL DEFAULT 10.00,
    testcases_count INT NOT NULL DEFAULT 2,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assignments_class ON assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_assignments_due_date ON assignments(due_date);

-- ============================================================================
-- 6. Table: TEST_CASES (SRS Entity 6 - Public & Hidden Test Suites)
-- ============================================================================
CREATE TABLE IF NOT EXISTS test_cases (
    test_case_id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    assignment_id VARCHAR(64) NOT NULL REFERENCES assignments(assignment_id) ON DELETE CASCADE,
    input_data TEXT NOT NULL,
    expected_output TEXT NOT NULL,
    is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
    weight NUMERIC(4, 2) NOT NULL DEFAULT 1.0,
    time_limit_ms INT DEFAULT 2000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_test_cases_assignment ON test_cases(assignment_id);
CREATE INDEX IF NOT EXISTS idx_test_cases_is_hidden ON test_cases(is_hidden);

-- ============================================================================
-- 7. Table: SUBMISSIONS (SRS Entity 7 - Student Code Packages & Score)
-- ============================================================================
CREATE TABLE IF NOT EXISTS submissions (
    submission_id VARCHAR(64) PRIMARY KEY,
    assignment_id VARCHAR(64) NOT NULL REFERENCES assignments(assignment_id) ON DELETE CASCADE,
    student_id VARCHAR(64) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    file_hash VARCHAR(64) NOT NULL, -- SHA-256 Checksum
    sha256_hash VARCHAR(64),        -- Alias
    file_path TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL DEFAULT 'submission.zip',
    file_size_bytes INT NOT NULL DEFAULT 0,
    language VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'QUEUED', -- 'QUEUED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'REJECTED'
    queue_job_id VARCHAR(128),
    testcase_score NUMERIC(4, 2),
    final_score NUMERIC(4, 2),
    score NUMERIC(4, 2), -- Backward compatibility alias
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_file_hash ON submissions(file_hash);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions(created_at DESC);

-- ============================================================================
-- 8. Table: SUBMISSION_DETAILS (SRS Entity 8 - Per-Test Sandbox Run Logs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS submission_details (
    detail_id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    submission_id VARCHAR(64) NOT NULL REFERENCES submissions(submission_id) ON DELETE CASCADE,
    test_case_id VARCHAR(64) REFERENCES test_cases(test_case_id) ON DELETE SET NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PASS', -- 'PASS' | 'FAIL' | 'TLE' | 'MLE' | 'CRASH'
    actual_output TEXT,
    time_ms INT NOT NULL DEFAULT 0,
    memory_kb INT NOT NULL DEFAULT 0,
    error_log TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_submission_details_submission ON submission_details(submission_id);
CREATE INDEX IF NOT EXISTS idx_submission_details_test_case ON submission_details(test_case_id);

-- ============================================================================
-- 9. Table: AI_REVIEW_RESULTS (SRS Entity 9 - Clean Code & SOLID LLM Audits)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_review_results (
    review_id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    submission_id VARCHAR(64) NOT NULL REFERENCES submissions(submission_id) ON DELETE CASCADE,
    clean_code_score NUMERIC(3, 1) NOT NULL CHECK (clean_code_score >= 0.0 AND clean_code_score <= 10.0),
    solid_score NUMERIC(3, 1) NOT NULL CHECK (solid_score >= 0.0 AND solid_score <= 10.0),
    code_smells_count INT NOT NULL DEFAULT 0,
    feedback_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    compiler_explanation TEXT,
    model_used VARCHAR(50) NOT NULL DEFAULT 'gemini-1.5-pro',
    token_usage JSONB,
    evaluated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_review_results_submission ON ai_review_results(submission_id);
CREATE INDEX IF NOT EXISTS idx_ai_review_results_evaluated ON ai_review_results(evaluated_at DESC);

-- ============================================================================
-- 10. Table: AST_FINGERPRINTS (SRS Entity 10 - Winnowing Syntax Hashes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ast_fingerprints (
    fingerprint_id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    submission_id VARCHAR(64) NOT NULL REFERENCES submissions(submission_id) ON DELETE CASCADE,
    hash_value VARCHAR(64) NOT NULL,
    token_position INT NOT NULL DEFAULT 0,
    ast_node_type VARCHAR(64),
    file_path VARCHAR(255) NOT NULL DEFAULT 'main',
    line_start INT NOT NULL DEFAULT 1,
    line_end INT NOT NULL DEFAULT 1,
    token_start INT NOT NULL DEFAULT 0,
    token_end INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ast_fingerprints_submission ON ast_fingerprints(submission_id);
CREATE INDEX IF NOT EXISTS idx_ast_fingerprints_hash ON ast_fingerprints(hash_value);
CREATE INDEX IF NOT EXISTS idx_ast_fingerprints_sub_hash ON ast_fingerprints(submission_id, hash_value);

-- ============================================================================
-- 11. Table: PLAGIARISM_REPORTS (SRS Entity 11 - Pairwise Fraud Detection)
-- ============================================================================
CREATE TABLE IF NOT EXISTS plagiarism_reports (
    report_id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    assignment_id VARCHAR(64) REFERENCES assignments(assignment_id) ON DELETE CASCADE,
    submission_a_id VARCHAR(64) NOT NULL REFERENCES submissions(submission_id) ON DELETE CASCADE,
    submission_b_id VARCHAR(64) NOT NULL REFERENCES submissions(submission_id) ON DELETE CASCADE,
    similarity_rate NUMERIC(5, 2) NOT NULL CHECK (similarity_rate >= 0.0 AND similarity_rate <= 100.0),
    flagged_as_fraud BOOLEAN NOT NULL DEFAULT FALSE,
    common_fingerprints_count INT NOT NULL DEFAULT 0,
    total_unique_fingerprints INT NOT NULL DEFAULT 0,
    matched_tokens_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(30) NOT NULL DEFAULT 'SUSPECTED' CHECK (status IN ('CLEAN', 'SUSPECTED', 'FLAGGED_HIGH', 'FLAGGED_PLAGIARISM', 'CONFIRMED', 'DISMISSED')),
    evaluated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_pairwise_submission UNIQUE (submission_a_id, submission_b_id)
);

CREATE INDEX IF NOT EXISTS idx_plagiarism_reports_assignment ON plagiarism_reports(assignment_id);
CREATE INDEX IF NOT EXISTS idx_plagiarism_reports_similarity ON plagiarism_reports(similarity_rate DESC);
CREATE INDEX IF NOT EXISTS idx_plagiarism_reports_sub_a ON plagiarism_reports(submission_a_id);
CREATE INDEX IF NOT EXISTS idx_plagiarism_reports_sub_b ON plagiarism_reports(submission_b_id);

-- ============================================================================
-- 12. Table: APPEALS (SRS Entity 12 - Grade Dispute & Re-evaluation)
-- ============================================================================
CREATE TABLE IF NOT EXISTS appeals (
    appeal_id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    submission_id VARCHAR(64) NOT NULL REFERENCES submissions(submission_id) ON DELETE CASCADE,
    student_id VARCHAR(64) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'IN_REVIEW')),
    reviewer_id VARCHAR(64) REFERENCES users(user_id) ON DELETE SET NULL,
    resolution_note TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_appeals_submission ON appeals(submission_id);
CREATE INDEX IF NOT EXISTS idx_appeals_student ON appeals(student_id);
CREATE INDEX IF NOT EXISTS idx_appeals_status ON appeals(status);

-- ============================================================================
-- 13. Table: TEAMWORK_METRICS (SRS Entity 13 - Git Analytics & Free-Rider Audit)
-- ============================================================================
CREATE TABLE IF NOT EXISTS teamwork_metrics (
    metric_id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    class_id VARCHAR(64) NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
    student_id VARCHAR(64) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    commit_count INT NOT NULL DEFAULT 0,
    lines_added INT NOT NULL DEFAULT 0,
    lines_deleted INT NOT NULL DEFAULT 0,
    contribution_pct NUMERIC(5, 2) NOT NULL DEFAULT 0.0 CHECK (contribution_pct >= 0.0 AND contribution_pct <= 100.0),
    is_free_rider BOOLEAN NOT NULL DEFAULT FALSE,
    analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_class_student_metric UNIQUE (class_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_teamwork_metrics_class ON teamwork_metrics(class_id);
CREATE INDEX IF NOT EXISTS idx_teamwork_metrics_student ON teamwork_metrics(student_id);
CREATE INDEX IF NOT EXISTS idx_teamwork_metrics_free_rider ON teamwork_metrics(is_free_rider);

-- ============================================================================
-- AUXILIARY INFRASTRUCTURE TABLES (Subsystems 1, 2, 3 Runtime Support)
-- ============================================================================

-- Table 14: DEAD_LETTER_JOBS (BullMQ Fault Tolerance & Replay)
CREATE TABLE IF NOT EXISTS dead_letter_jobs (
    dlq_id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    queue_name VARCHAR(64) NOT NULL DEFAULT 'submission-grading-queue',
    original_job_id VARCHAR(128) NOT NULL,
    submission_id VARCHAR(64) NOT NULL REFERENCES submissions(submission_id) ON DELETE CASCADE,
    payload JSONB NOT NULL,
    failed_reason TEXT NOT NULL,
    attempts_made INT NOT NULL DEFAULT 3,
    stacktrace TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'FAILED',
    failed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    retried_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_dlq_submission_id ON dead_letter_jobs(submission_id);
CREATE INDEX IF NOT EXISTS idx_dlq_status ON dead_letter_jobs(status);

-- Table 15: AI_PROMPT_TEMPLATES (Prompt Versioning & Schema Config)
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

-- ============================================================================
-- SEED DATA (Ready-to-use for Testing & SRS Demonstration)
-- ============================================================================

-- 1. Seed Roles
INSERT INTO roles (role_id, role_name, description)
VALUES 
    ('ADMIN', 'System Administrator', 'Toàn quyền cấu hình hệ thống và tài khoản'),
    ('HOD', 'Head of Department', 'Trưởng bộ môn giám sát đạo văn và tiến độ'),
    ('LECTURER', 'Course Lecturer', 'Giảng viên tạo lớp, đề thi, chấm phúc khảo'),
    ('STUDENT', 'Enrolled Student', 'Sinh viên nộp bài, xem live score, gửi appeal')
ON CONFLICT (role_id) DO NOTHING;

-- 2. Seed Users
INSERT INTO users (user_id, role_id, email, full_name, student_code, role, password_hash, is_active)
VALUES 
    ('ADMIN001', 'ADMIN', 'admin@aita.fpt.edu.vn', 'Hệ Thống Quản Trị AITA', NULL, 'ADMIN', '$2a$10$e7mK8Z2oW2b2tqG9yT6kcuo2g1l6a7p8r9s0t1u2v3w4x5y6z7', TRUE),
    ('GV001', 'LECTURER', 'trungdt.teacher@aita.fpt.edu.vn', 'ThS. Đinh Thành Trung (Giảng viên)', NULL, 'LECTURER', '$2a$10$e7mK8Z2oW2b2tqG9yT6kcuo2g1l6a7p8r9s0t1u2v3w4x5y6z7', TRUE),
    ('SE170000', 'STUDENT', 'trungdt.student@aita.fpt.edu.vn', 'Đinh Thành Trung (Sinh viên)', 'SE170000', 'STUDENT', '$2a$10$e7mK8Z2oW2b2tqG9yT6kcuo2g1l6a7p8r9s0t1u2v3w4x5y6z7', TRUE),
    ('SE170123', 'STUDENT', 'nguyentt@aita.fpt.edu.vn', 'Trần Thanh Nguyên', 'SE170123', 'STUDENT', '$2a$10$e7mK8Z2oW2b2tqG9yT6kcuo2g1l6a7p8r9s0t1u2v3w4x5y6z7', TRUE),
    ('SE170456', 'STUDENT', 'vinhtt@aita.fpt.edu.vn', 'Nguyễn Hoàng Vinh', 'SE170456', 'STUDENT', '$2a$10$e7mK8Z2oW2b2tqG9yT6kcuo2g1l6a7p8r9s0t1u2v3w4x5y6z7', TRUE)
ON CONFLICT (user_id) DO NOTHING;

-- 3. Seed Classes
INSERT INTO classes (class_id, lecturer_id, class_code, class_name, semester, description, is_active)
VALUES 
    ('CRS-SWP391', 'GV001', 'SE1701-SWP391', 'Application Development Project (SWP391)', 'Fall 2026', 'Dự án Phát triển phần mềm theo chuẩn Agile Scrum', TRUE),
    ('CRS-PRO192', 'GV001', 'SE1702-PRO192', 'Object-Oriented Programming (PRO192)', 'Fall 2026', 'Lập trình hướng đối tượng với Java và Design Patterns', TRUE),
    ('CRS-CSD201', 'GV001', 'SE1703-CSD201', 'Data Structures and Algorithms (CSD201)', 'Fall 2026', 'Cấu trúc dữ liệu và giải thuật nâng cao', TRUE)
ON CONFLICT (class_id) DO NOTHING;

-- 4. Seed Class Members
INSERT INTO class_members (member_id, class_id, user_id, status)
VALUES
    ('MB-001', 'CRS-SWP391', 'SE170000', 'ACTIVE'),
    ('MB-002', 'CRS-SWP391', 'SE170123', 'ACTIVE'),
    ('MB-003', 'CRS-SWP391', 'SE170456', 'ACTIVE'),
    ('MB-004', 'CRS-CSD201', 'SE170000', 'ACTIVE'),
    ('MB-005', 'CRS-CSD201', 'SE170123', 'ACTIVE'),
    ('MB-006', 'CRS-CSD201', 'SE170456', 'ACTIVE')
ON CONFLICT (class_id, user_id) DO NOTHING;

-- 5. Seed Assignments
INSERT INTO assignments (assignment_id, class_id, course_id, title, description, language, allowed_languages, time_limit_sec, time_limit_ms, memory_limit_mb, due_date, deadline, max_score, testcases_count, is_active)
VALUES 
    (
        'TASK-SWP391-SPRINT2',
        'CRS-SWP391',
        'CRS-SWP391',
        'Thuật toán Sắp xếp & Tối ưu hóa Bộ nhớ (Milestone 2)',
        'Xây dựng thuật toán sắp xếp mảng 100,000 phần tử, tối ưu O(N log N) và tuân thủ các nguyên lý SOLID.',
        'java',
        '["java", "python", "cpp", "dotnet"]'::jsonb,
        2.0,
        2000,
        512,
        CURRENT_TIMESTAMP + INTERVAL '14 days',
        CURRENT_TIMESTAMP + INTERVAL '14 days',
        10.00,
        2,
        TRUE
    )
ON CONFLICT (assignment_id) DO NOTHING;

-- 6. Seed Test Cases
INSERT INTO test_cases (test_case_id, assignment_id, input_data, expected_output, is_hidden, weight, time_limit_ms)
VALUES
    ('TC-SWP-01', 'TASK-SWP391-SPRINT2', '5\n4 2 5 1 3\n', '1 2 3 4 5', FALSE, 1.0, 2000),
    ('TC-SWP-02', 'TASK-SWP391-SPRINT2', '3\n10 0 -5\n', '-5 0 10', TRUE, 1.0, 2000)
ON CONFLICT (test_case_id) DO NOTHING;

-- 7. Seed Prompt Templates
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
