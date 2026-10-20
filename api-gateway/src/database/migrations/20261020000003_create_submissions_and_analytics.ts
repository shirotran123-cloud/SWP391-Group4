import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 7. Table: SUBMISSIONS (Student Code Packages & Scores)
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS submissions (
      submission_id VARCHAR(64) PRIMARY KEY,
      assignment_id VARCHAR(64) NOT NULL REFERENCES assignments(assignment_id) ON DELETE CASCADE,
      student_id VARCHAR(64) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      file_hash VARCHAR(64) NOT NULL,
      sha256_hash VARCHAR(64),
      file_path TEXT NOT NULL,
      file_name VARCHAR(255) NOT NULL DEFAULT 'submission.zip',
      file_size_bytes INT NOT NULL DEFAULT 0,
      language VARCHAR(32) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'QUEUED',
      queue_job_id VARCHAR(128),
      testcase_score NUMERIC(4, 2),
      final_score NUMERIC(4, 2),
      score NUMERIC(4, 2),
      details JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON submissions(assignment_id);
    CREATE INDEX IF NOT EXISTS idx_submissions_student ON submissions(student_id);
    CREATE INDEX IF NOT EXISTS idx_submissions_file_hash ON submissions(file_hash);
    CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
    CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions(created_at DESC);
  `);

  // 8. Table: SUBMISSION_DETAILS (Per-Test Sandbox Run Logs)
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS submission_details (
      detail_id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
      submission_id VARCHAR(64) NOT NULL REFERENCES submissions(submission_id) ON DELETE CASCADE,
      test_case_id VARCHAR(64) REFERENCES test_cases(test_case_id) ON DELETE SET NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'PASS',
      actual_output TEXT,
      time_ms INT NOT NULL DEFAULT 0,
      memory_kb INT NOT NULL DEFAULT 0,
      error_log TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_submission_details_submission ON submission_details(submission_id);
    CREATE INDEX IF NOT EXISTS idx_submission_details_test_case ON submission_details(test_case_id);
  `);

  // 9. Table: AI_REVIEW_RESULTS (Clean Code & SOLID LLM Audits)
  await knex.raw(`
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
  `);

  // 10. Table: AST_FINGERPRINTS (Winnowing Syntax Hashes)
  await knex.raw(`
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
  `);

  // 11. Table: PLAGIARISM_REPORTS (Pairwise Fraud Detection)
  await knex.raw(`
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
      status VARCHAR(30) NOT NULL DEFAULT 'SUSPECTED',
      evaluated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT unique_pairwise_submission UNIQUE (submission_a_id, submission_b_id)
    );
    CREATE INDEX IF NOT EXISTS idx_plagiarism_reports_assignment ON plagiarism_reports(assignment_id);
    CREATE INDEX IF NOT EXISTS idx_plagiarism_reports_similarity ON plagiarism_reports(similarity_rate DESC);
    CREATE INDEX IF NOT EXISTS idx_plagiarism_reports_sub_a ON plagiarism_reports(submission_a_id);
    CREATE INDEX IF NOT EXISTS idx_plagiarism_reports_sub_b ON plagiarism_reports(submission_b_id);
  `);

  // 12. Table: APPEALS (Grade Dispute & Re-evaluation)
  await knex.raw(`
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
  `);

  // 13. Table: TEAMWORK_METRICS (Git Analytics & Free-Rider Audit)
  await knex.raw(`
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
  `);

  // Table 14: DEAD_LETTER_JOBS (BullMQ Fault Tolerance)
  await knex.raw(`
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
  `);

  // Table 15: AI_PROMPT_TEMPLATES (Prompt Versioning & Schema Config)
  await knex.raw(`
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
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP TABLE IF EXISTS ai_prompt_templates CASCADE;`);
  await knex.raw(`DROP TABLE IF EXISTS dead_letter_jobs CASCADE;`);
  await knex.raw(`DROP TABLE IF EXISTS teamwork_metrics CASCADE;`);
  await knex.raw(`DROP TABLE IF EXISTS appeals CASCADE;`);
  await knex.raw(`DROP TABLE IF EXISTS plagiarism_reports CASCADE;`);
  await knex.raw(`DROP TABLE IF EXISTS ast_fingerprints CASCADE;`);
  await knex.raw(`DROP TABLE IF EXISTS ai_review_results CASCADE;`);
  await knex.raw(`DROP TABLE IF EXISTS submission_details CASCADE;`);
  await knex.raw(`DROP TABLE IF EXISTS submissions CASCADE;`);
}
