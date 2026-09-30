-- ============================================================================
-- AITA Intelligent Autograding Platform - Subsystem 3 Database Migrations
-- Matches Section 3.3 ERD: AI_REVIEW_RESULTS & AI_PROMPT_TEMPLATES
-- Compatible with PostgreSQL 14+ / Supabase
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. Table: AI_REVIEW_RESULTS
-- Stores fine-grained GenAI evaluation results, clean code/SOLID ratings,
-- and code smell locations per student submission.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_review_results (
    review_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL,
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

-- Index for fast lookup by submission
CREATE INDEX IF NOT EXISTS idx_ai_review_results_submission_id ON ai_review_results(submission_id);
CREATE INDEX IF NOT EXISTS idx_ai_review_results_evaluated_at ON ai_review_results(evaluated_at DESC);

-- ----------------------------------------------------------------------------
-- 2. Table: AI_PROMPT_TEMPLATES
-- Allows administrative customization and versioning of system prompts,
-- schemas, and parameters without requiring redeployments.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_prompt_templates (
    template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
-- 3. Pre-seed Default Prompt Templates (Clean Code & SOLID, Exam, Compiler)
-- ----------------------------------------------------------------------------
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