import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

  // 1. Table: ROLES (RBAC Authorization)
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS roles (
      role_id VARCHAR(32) PRIMARY KEY,
      role_name VARCHAR(64) NOT NULL UNIQUE,
      description TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Table: USERS (Profiles & Google SSO Whitelist)
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS users (
      user_id VARCHAR(64) PRIMARY KEY,
      role_id VARCHAR(32) NOT NULL DEFAULT 'STUDENT' REFERENCES roles(role_id) ON DELETE RESTRICT,
      email VARCHAR(128) NOT NULL UNIQUE,
      full_name VARCHAR(128) NOT NULL,
      student_code VARCHAR(32) UNIQUE,
      role VARCHAR(32) NOT NULL DEFAULT 'STUDENT',
      password_hash VARCHAR(255) NOT NULL,
      avatar_url TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_student_code ON users(student_code);
    CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
  `);

  // Seed default roles if not exists
  await knex.raw(`
    INSERT INTO roles (role_id, role_name, description)
    VALUES 
      ('ADMIN', 'System Administrator', 'Toàn quyền cấu hình hệ thống và tài khoản'),
      ('HOD', 'Head of Department', 'Trưởng bộ môn giám sát đạo văn và tiến độ'),
      ('LECTURER', 'Course Lecturer', 'Giảng viên tạo lớp, đề thi, chấm phúc khảo'),
      ('STUDENT', 'Enrolled Student', 'Sinh viên nộp bài, xem live score, gửi appeal')
    ON CONFLICT (role_id) DO NOTHING;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP TABLE IF EXISTS users CASCADE;`);
  await knex.raw(`DROP TABLE IF EXISTS roles CASCADE;`);
}
