export type AIReviewErrorCode =
  | "INVALID_LLM_OUTPUT" // model answered but output failed validation after retry
  | "PROVIDER_UNAVAILABLE"; // every provider / key failed (429, 5xx, timeout, network)

export class AIReviewError extends Error {
  public readonly code: AIReviewErrorCode;
  public readonly details: string[];

  constructor(code: AIReviewErrorCode, message: string, details: string[] = []) {
    super(message);
    this.name = "AIReviewError";
    this.code = code;
    this.details = details;
  }
}
