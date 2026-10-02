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

/**
 * Per-principle SOLID scores (0.0 - 10.0).
 * Consumed by the frontend SolidRadarChart (5 axes: S, O, L, I, D).
 */
export interface SolidBreakdown {
  srp: number; // Single Responsibility
  ocp: number; // Open/Closed
  lsp: number; // Liskov Substitution
  isp: number; // Interface Segregation
  dip: number; // Dependency Inversion
}

export interface AIReviewResult {
  review_id?: string;
  submission_id: string;
  clean_code_score: number; // 0.0 to 10.0
  solid_score: number;      // 0.0 to 10.0 (aggregate)
  solid_breakdown: SolidBreakdown;
  overall_summary?: string;
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

/**
 * Direct payload contract for the frontend SolidRadarChart and NestJS Gateway.
 */
export interface AIRatingPayload {
  cleanCodeScore: number;
  solidScore: {
    s: number;
    o: number;
    l: number;
    i: number;
    d: number;
  };
  codeSmells: Array<{ line: number; rule: string; description: string }>;
  explanation: string;
}

export function toAIRatingPayload(review: AIReviewResult): AIRatingPayload {
  return {
    cleanCodeScore: review.clean_code_score,
    solidScore: {
      s: review.solid_breakdown.srp,
      o: review.solid_breakdown.ocp,
      l: review.solid_breakdown.lsp,
      i: review.solid_breakdown.isp,
      d: review.solid_breakdown.dip,
    },
    codeSmells: review.feedback_json.map((s) => ({
      line: s.line_start,
      rule: s.rule,
      description: s.suggestion,
    })),
    explanation: review.overall_summary || review.compiler_explanation || "Code evaluated successfully.",
  };
}