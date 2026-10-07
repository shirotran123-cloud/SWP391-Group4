import { CodeSmellFeedback, SeverityLevel, SolidBreakdown } from "../types/review.types";

/**
 * Validated, normalized shape of an LLM code-review response.
 */
export interface ValidatedReview {
  clean_code_score: number;
  solid_score: number;
  solid_breakdown: SolidBreakdown;
  overall_summary: string;
  code_smells: CodeSmellFeedback[];
  compiler_explanation: string;
}

export interface ValidationOutcome {
  valid: boolean;
  errors: string[];
  value?: ValidatedReview;
}

const SEVERITIES: SeverityLevel[] = ["INFO", "WARNING", "CRITICAL"];
const SOLID_KEYS: Array<keyof SolidBreakdown> = ["srp", "ocp", "lsp", "isp", "dip"];

/**
 * Validates LLM output against the AI_REVIEW_RESULTS contract.
 *
 * Hard errors (-> invalid, caller should retry): unparseable JSON, missing or
 * non-numeric scores, scores outside [0, 10], code_smells not an array.
 * Soft issues are repaired: malformed smell items are dropped, unknown severity
 * becomes INFO, missing breakdown axes inherit the aggregate SOLID score.
 */
export class ReviewResponseValidator {
  public static validate(raw: unknown): ValidationOutcome {
    const errors: string[] = [];
    const obj = ReviewResponseValidator.coerceObject(raw, errors);
    if (!obj) return { valid: false, errors };

    const clean = ReviewResponseValidator.score(obj.clean_code_score, "clean_code_score", errors);
    const solid = ReviewResponseValidator.score(obj.solid_score, "solid_score", errors);

    if (!Array.isArray(obj.code_smells)) {
      errors.push("code_smells must be an array");
    }

    if (errors.length > 0 || clean === null || solid === null) {
      return { valid: false, errors };
    }

    const breakdownSrc = obj.solid_breakdown && typeof obj.solid_breakdown === "object" ? obj.solid_breakdown : {};
    const solid_breakdown = {} as SolidBreakdown;
    for (const key of SOLID_KEYS) {
      const n = Number(breakdownSrc[key]);
      solid_breakdown[key] = Number.isFinite(n) && n >= 0 && n <= 10 ? round1(n) : solid;
    }

    const code_smells: CodeSmellFeedback[] = (obj.code_smells as unknown[])
      .filter((s): s is Record<string, any> => !!s && typeof s === "object")
      .filter((s) => typeof s.suggestion === "string" && s.suggestion.trim().length > 0)
      .map((s) => {
        const lineStart = Math.max(1, Math.floor(Number(s.line_start) || 1));
        const lineEnd = Math.max(lineStart, Math.floor(Number(s.line_end) || lineStart));
        return {
          file: String(s.file || "source"),
          line_start: lineStart,
          line_end: lineEnd,
          severity: SEVERITIES.includes(s.severity) ? s.severity : "INFO",
          rule: String(s.rule || "Code Quality"),
          smell_type: String(s.smell_type || "Generic"),
          suggestion: String(s.suggestion),
        };
      });

    return {
      valid: true,
      errors: [],
      value: {
        clean_code_score: clean,
        solid_score: solid,
        solid_breakdown,
        overall_summary: typeof obj.overall_summary === "string" ? obj.overall_summary : "",
        code_smells,
        compiler_explanation: typeof obj.compiler_explanation === "string" ? obj.compiler_explanation : "",
      },
    };
  }

  private static coerceObject(raw: unknown, errors: string[]): Record<string, any> | null {
    if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, any>;
    if (typeof raw !== "string") {
      errors.push("response is empty or not a JSON object");
      return null;
    }
    // LLMs frequently wrap JSON in markdown fences even in JSON mode.
    const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
      errors.push("response JSON is not an object");
    } catch (e: any) {
      errors.push(`response is not valid JSON (${e.message})`);
    }
    return null;
  }

  private static score(value: unknown, field: string, errors: string[]): number | null {
    if (value === undefined || value === null || value === "") {
      errors.push(`${field} is missing`);
      return null;
    }
    const n = Number(value);
    if (!Number.isFinite(n)) {
      errors.push(`${field} is not a number`);
      return null;
    }
    if (n < 0 || n > 10) {
      errors.push(`${field}=${n} is outside [0, 10]`);
      return null;
    }
    return round1(n);
  }
}

function round1(n: number): number {
  return Number(n.toFixed(1));
}
