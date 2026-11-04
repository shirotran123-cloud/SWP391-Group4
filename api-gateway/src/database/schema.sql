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
    -- password_hash dropped for pure Google OAuth 2.0 SSO
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
-- SEED DATA (Synchronized & Canonical for Pure Google OAuth 2.0 & Coding Courses)
-- ============================================================================

-- 1. Seed Roles
INSERT INTO roles (role_id, role_name, description)
VALUES 
    ('ADMIN', 'System Administrator', 'Toàn quyền cấu hình hệ thống và tài khoản'),
    ('HOD', 'Head of Department', 'Trưởng bộ môn giám sát đạo văn và tiến độ'),
    ('LECTURER', 'Course Lecturer', 'Giảng viên tạo lớp, đề thi, chấm phúc khảo'),
    ('STUDENT', 'Enrolled Student', 'Sinh viên nộp bài, xem live score, gửi appeal')
ON CONFLICT (role_id) DO NOTHING;

-- 2. Seed Users (Pure Google OAuth 2.0 SSO - No password_hash column)
INSERT INTO users (user_id, role_id, email, full_name, student_code, role, is_active)
VALUES 
    ('ADMIN001', 'ADMIN', 'admin@aita.fpt.edu.vn', 'Hệ Thống Quản Trị AITA', NULL, 'ADMIN', TRUE),
    ('HOD001', 'HOD', 'truongbm@fe.edu.vn', 'TS. Nguyễn Văn Hùng (Trưởng Bộ Môn)', NULL, 'HOD', TRUE),
    ('GV001', 'LECTURER', 'trungdt@fe.edu.vn', 'ThS. Đinh Thành Trung (Giảng viên)', NULL, 'LECTURER', TRUE),
    ('GV002', 'LECTURER', 'namlh@fe.edu.vn', 'TS. Lê Hoàng Nam (Giảng viên)', NULL, 'LECTURER', TRUE),
    ('SE170000', 'STUDENT', 'linhcampochia@gmail.com', 'Nguyễn Văn An', 'SE170000', 'STUDENT', TRUE),
    ('SE170001', 'STUDENT', 'huy.se170001@fpt.edu.vn', 'Trần Thành Huy', 'SE170001', 'STUDENT', TRUE)
ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active;

-- 3. Seed Classes (Exactly 2 Coding Courses per Lecturer)
INSERT INTO classes (class_id, lecturer_id, class_code, class_name, semester, description, is_active)
VALUES 
    ('CRS-PRO192', 'GV001', 'SE1701-PRO192', 'Object-Oriented Programming with Java (PRO192)', 'Fall 2026', 'Lập trình hướng đối tượng với Java, kế thừa, đa hình và Collection Framework.', TRUE),
    ('CRS-CSD201', 'GV001', 'SE1702-CSD201', 'Data Structures and Algorithms (CSD201)', 'Fall 2026', 'Cấu trúc dữ liệu và giải thuật nâng cao (Stack, Queue, Tree, Graph, Sorting).', TRUE),
    ('CRS-PRJ301', 'GV002', 'SE1703-PRJ301', 'Java Web Application Development (PRJ301)', 'Fall 2026', 'Xây dựng ứng dụng web với Java Servlet, JSP, MVC pattern và JDBC.', TRUE),
    ('CRS-PRF192', 'GV002', 'SE1704-PRF192', 'Programming Fundamentals with C (PRF192)', 'Fall 2026', 'Kỹ thuật lập trình cơ bản với ngôn ngữ C: con trỏ, mảng, chuỗi và cấp phát động.', TRUE)
ON CONFLICT (class_id) DO UPDATE SET
    lecturer_id = EXCLUDED.lecturer_id,
    class_code = EXCLUDED.class_code,
    class_name = EXCLUDED.class_name,
    is_active = EXCLUDED.is_active;

-- 4. Seed Class Members (All Students Enrolled in all 4 Coding Courses)
INSERT INTO class_members (member_id, class_id, user_id, status)
VALUES
    ('MB-001', 'CRS-PRO192', 'SE170000', 'ACTIVE'),
    ('MB-002', 'CRS-PRO192', 'SE170001', 'ACTIVE'),
    ('MB-003', 'CRS-CSD201', 'SE170000', 'ACTIVE'),
    ('MB-004', 'CRS-CSD201', 'SE170001', 'ACTIVE'),
    ('MB-005', 'CRS-PRJ301', 'SE170000', 'ACTIVE'),
    ('MB-006', 'CRS-PRJ301', 'SE170001', 'ACTIVE'),
    ('MB-007', 'CRS-PRF192', 'SE170000', 'ACTIVE'),
    ('MB-008', 'CRS-PRF192', 'SE170001', 'ACTIVE')
ON CONFLICT (class_id, user_id) DO NOTHING;

-- 5. Seed Assignments (1 Assignment per Course: 2 Expired, 2 Active)
INSERT INTO assignments (
    assignment_id, class_id, course_id, title, description, language,
    allowed_languages, time_limit_sec, time_limit_ms, memory_limit_mb,
    due_date, deadline, max_score, testcases_count, is_active
) VALUES 
    (
        'TASK-PRO192-A1',
        'CRS-PRO192',
        'CRS-PRO192',
        'Quản lý Đội xe Vận tải hướng đối tượng OOP (PRO192)',
        'Áp dụng các nguyên lý lập trình hướng đối tượng (Kế thừa, Đóng gói, Đa hình, Trừu tượng) để thiết kế hệ thống quản lý phương tiện giao thông và đội xe logistics.',
        'java',
        '["java"]'::jsonb,
        2.0,
        2000,
        512,
        '2026-10-18 23:59:59+07',
        '2026-10-18 23:59:59+07',
        10.00,
        3,
        FALSE
    ),
    (
        'TASK-CSD201-A1',
        'CRS-CSD201',
        'CRS-CSD201',
        'Thuật toán Cấu trúc Dữ liệu & Đồ thị Dijkstra (CSD201)',
        'Cài đặt giải thuật Dijkstra với PriorityQueue tìm đường đi ngắn nhất trên đồ thị có trọng số và phân tích độ phức tạp O(E log V).',
        'java',
        '["java", "cpp", "python"]'::jsonb,
        2.0,
        2000,
        512,
        '2026-10-20 23:59:59+07',
        '2026-10-20 23:59:59+07',
        10.00,
        3,
        FALSE
    ),
    (
        'TASK-PRJ301-A1',
        'CRS-PRJ301',
        'CRS-PRJ301',
        'Xây dựng Servlet & Filter Quản lý Sinh viên MVC (PRJ301)',
        'Thiết kế và triển khai web application Java theo mô hình MVC 2, sử dụng Servlet xử lý request và Filter xác thực session người dùng.',
        'java',
        '["java", "cpp", "python"]'::jsonb,
        2.0,
        2000,
        512,
        '2026-11-15 23:59:59+07',
        '2026-11-15 23:59:59+07',
        10.00,
        3,
        TRUE
    ),
    (
        'TASK-PRF192-A1',
        'CRS-PRF192',
        'CRS-PRF192',
        'Thuật toán Xử lý Mảng và Quản lý Con trỏ Bộ nhớ Động (PRF192)',
        'Lập trình C giải quyết bài toán chuẩn hóa chuỗi ký tự, sắp xếp mảng động và sử dụng con trỏ quản lý bộ nhớ malloc/free.',
        'cpp',
        '["cpp", "c", "java"]'::jsonb,
        2.0,
        2000,
        512,
        '2026-11-20 23:59:59+07',
        '2026-11-20 23:59:59+07',
        10.00,
        3,
        TRUE
    )
ON CONFLICT (assignment_id) DO UPDATE SET
    class_id = EXCLUDED.class_id,
    course_id = EXCLUDED.course_id,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    due_date = EXCLUDED.due_date,
    deadline = EXCLUDED.deadline,
    is_active = EXCLUDED.is_active;

-- 6. Seed Test Cases (3 Test Cases per Assignment)
INSERT INTO test_cases (test_case_id, assignment_id, input_data, expected_output, is_hidden, weight, time_limit_ms)
VALUES
    ('TC-TASK-PRO192-A1-01', 'TASK-PRO192-A1', '5\n4 2 5 1 3', '1 2 3 4 5', FALSE, 1.0, 2000),
    ('TC-TASK-PRO192-A1-02', 'TASK-PRO192-A1', '10\n10 9 8 7 6 5 4 3 2 1', '1 2 3 4 5 6 7 8 9 10', TRUE, 1.0, 2000),
    ('TC-TASK-PRO192-A1-03', 'TASK-PRO192-A1', '3\n-5 0 10', '-5 0 10', TRUE, 1.0, 2000),

    ('TC-TASK-CSD201-A1-01', 'TASK-CSD201-A1', '5\n4 2 5 1 3', '1 2 3 4 5', FALSE, 1.0, 2000),
    ('TC-TASK-CSD201-A1-02', 'TASK-CSD201-A1', '10\n10 9 8 7 6 5 4 3 2 1', '1 2 3 4 5 6 7 8 9 10', TRUE, 1.0, 2000),
    ('TC-TASK-CSD201-A1-03', 'TASK-CSD201-A1', '3\n-5 0 10', '-5 0 10', TRUE, 1.0, 2000),

    ('TC-TASK-PRJ301-A1-01', 'TASK-PRJ301-A1', 'GET /api/v1/students HTTP/1.1\nHost: localhost', 'HTTP/1.1 200 OK\nContent-Type: application/json', FALSE, 1.0, 2000),
    ('TC-TASK-PRJ301-A1-02', 'TASK-PRJ301-A1', 'POST /api/v1/students HTTP/1.1\n{"studentId":"SE170001"}', 'HTTP/1.1 201 Created', TRUE, 1.0, 2000),
    ('TC-TASK-PRJ301-A1-03', 'TASK-PRJ301-A1', 'GET /api/v1/admin/grades HTTP/1.1\nHost: localhost', 'HTTP/1.1 401 Unauthorized', TRUE, 1.0, 2000),

    ('TC-TASK-PRF192-A1-01', 'TASK-PRF192-A1', '5\n12 45 7 23 89', '7 12 23 45 89', FALSE, 1.0, 2000),
    ('TC-TASK-PRF192-A1-02', 'TASK-PRF192-A1', '6\n  hello   world  fpt  university  ', 'Hello World Fpt University', TRUE, 1.0, 2000),
    ('TC-TASK-PRF192-A1-03', 'TASK-PRF192-A1', '4\n-10 -20 0 15', '-20 -10 0 15', TRUE, 1.0, 2000)
ON CONFLICT (test_case_id) DO NOTHING;
