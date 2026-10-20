import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 3. Table: CLASSES (Academic Course Sections & Semesters)
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS classes (
      class_id VARCHAR(64) PRIMARY KEY,
      lecturer_id VARCHAR(64) NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
      class_code VARCHAR(32) NOT NULL UNIQUE,
      class_name VARCHAR(255) NOT NULL,
      semester VARCHAR(32) NOT NULL,
      description TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_classes_code ON classes(class_code);
    CREATE INDEX IF NOT EXISTS idx_classes_lecturer ON classes(lecturer_id);
    CREATE INDEX IF NOT EXISTS idx_classes_semester ON classes(semester);
  `);

  // Backward compatibility VIEW
  await knex.raw(`
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
  `);

  // 4. Table: CLASS_MEMBERS (Roster Enrollment)
  await knex.raw(`
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
  `);

  // 5. Table: ASSIGNMENTS (Programming Tasks & Sandbox Quotas)
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS assignments (
      assignment_id VARCHAR(64) PRIMARY KEY,
      class_id VARCHAR(64) NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
      course_id VARCHAR(64),
      title VARCHAR(255) NOT NULL,
      description TEXT,
      language VARCHAR(32) NOT NULL DEFAULT 'java',
      allowed_languages JSONB NOT NULL DEFAULT '["java", "python", "cpp", "dotnet"]'::jsonb,
      time_limit_sec NUMERIC(4, 2) NOT NULL DEFAULT 2.0,
      time_limit_ms INT NOT NULL DEFAULT 2000,
      memory_limit_mb INT NOT NULL DEFAULT 512,
      due_date TIMESTAMP WITH TIME ZONE NOT NULL,
      deadline TIMESTAMP WITH TIME ZONE,
      max_score NUMERIC(4, 2) NOT NULL DEFAULT 10.00,
      testcases_count INT NOT NULL DEFAULT 2,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_assignments_class ON assignments(class_id);
    CREATE INDEX IF NOT EXISTS idx_assignments_due_date ON assignments(due_date);
  `);

  // 6. Table: TEST_CASES (Public & Hidden Test Suites)
  await knex.raw(`
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
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP TABLE IF EXISTS test_cases CASCADE;`);
  await knex.raw(`DROP TABLE IF EXISTS assignments CASCADE;`);
  await knex.raw(`DROP TABLE IF EXISTS class_members CASCADE;`);
  await knex.raw(`DROP VIEW IF EXISTS courses CASCADE;`);
  await knex.raw(`DROP TABLE IF EXISTS classes CASCADE;`);
}
