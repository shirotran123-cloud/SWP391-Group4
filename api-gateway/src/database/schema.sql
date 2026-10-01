-- ============================================================================
-- AITA Intelligent Autograding Platform - Core Database Migration
-- Subsystem 1 & 5: Central Gateway, Core Entities & Queue Coordinator
-- Matches Architecture Section 3.3 ERD: USERS, COURSES, ASSIGNMENTS, SUBMISSIONS
-- Compatible with PostgreSQL 14+ / Supabase
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

-- ============================================================================
-- SEED DATA (Ready-to-use for Sprint 2 / Milestone 2 Demonstrations)
-- ============================================================================

-- Seed Users
INSERT INTO users (user_id, email, full_name, role, password_hash, is_active)
VALUES 
    ('ADMIN001', 'admin@aita.fpt.edu.vn', 'Hệ Thống Quản Trị AITA', 'ADMIN', crypt('Admin@123', gen_salt('bf')), TRUE),
    ('GV001', 'trungdt.teacher@aita.fpt.edu.vn', 'ThS. Đinh Thành Trung (Giảng viên)', 'INSTRUCTOR', crypt('Teacher@123', gen_salt('bf')), TRUE),
    ('SE170000', 'trungdt.student@aita.fpt.edu.vn', 'Đinh Thành Trung (Sinh viên)', 'STUDENT', crypt('Student@123', gen_salt('bf')), TRUE),
    ('SE170123', 'nguyentt@aita.fpt.edu.vn', 'Trần Thanh Nguyên', 'STUDENT', crypt('Student@123', gen_salt('bf')), TRUE)
ON CONFLICT (user_id) DO NOTHING;

-- Seed Courses
INSERT INTO courses (course_id, course_code, course_name, description, semester, instructor_id, is_active)
VALUES 
    ('COURSE-SWP391', 'SWP391', 'Application Development Project', 'Dự án Phát triển Ứng dụng - Kỹ thuật phần mềm', 'Fall 2026', 'GV001', TRUE),
    ('COURSE-PRN211', 'PRN211', 'Basic Cross-Platform .NET Application', 'Lập trình ứng dụng đa nền tảng với .NET Core', 'Fall 2026', 'GV001', TRUE)
ON CONFLICT (course_id) DO NOTHING;

-- Seed Assignments
INSERT INTO assignments (assignment_id, course_id, title, description, allowed_languages, max_score, deadline, time_limit_ms, memory_limit_mb, testcases_count, is_active)
VALUES 
    (
        'TASK-SWP391-SPRINT2',
        'COURSE-SWP391',
        'Thuật toán Sắp xếp & Tối ưu hóa Bộ nhớ (Milestone 2)',
        'Xây dựng thuật toán sắp xếp mảng 100,000 phần tử, tối ưu O(N log N) và tuân thủ các nguyên lý SOLID.',
        '["java", "python", "cpp", "dotnet"]'::jsonb,
        10.00,
        CURRENT_TIMESTAMP + INTERVAL '14 days',
        2000,
        512,
        2,
        TRUE
    ),
    (
        'TASK-PRN211-M1',
        'COURSE-PRN211',
        'Lập trình Cấu trúc dữ liệu & Thuật toán C# .NET',
        'Cài đặt Generic Binary Search Tree và xử lý ngoại lệ trong .NET 8.',
        '["dotnet", "java"]'::jsonb,
        10.00,
        CURRENT_TIMESTAMP + INTERVAL '7 days',
        2000,
        512,
        3,
        TRUE
    )
ON CONFLICT (assignment_id) DO NOTHING;
