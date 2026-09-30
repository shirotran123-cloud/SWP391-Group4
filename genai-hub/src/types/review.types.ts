/**
 * Types mapping to Database Entity: AI_REVIEW_RESULTS (Section 3.3 ERD)
 */

export type SeverityLevel = "INFO" | "WARNING" | "CRITICAL";

export interface CodeSmellFeedback {
  file: string;
  line_start: number;
  line_end: number;
  severity: SeverityLevel;
  rule: string;
  smell_type: string;
  suggestion: string;
}

export interface AIReviewResult {
  review_id?: string;
  submission_id: string;
  clean_code_score: number; // 0.0 to 10.0
  solid_score: number;      // 0.0 to 10.0
  feedback_json: CodeSmellFeedback[];
  compiler_explanation?: string;
  evaluated_at: string;
  model_used: string;
  token_usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface SourceFile {
  filename: string;
  content: string;
}

export interface ReviewRequest {
  submissionId: string;
  language: "cpp" | "c" | "java" | "python" | string;
  sourceFiles: SourceFile[];
  compilerOutput?: string;
  assignmentTopic?: string;
  learningOutcomes?: string[];
}
