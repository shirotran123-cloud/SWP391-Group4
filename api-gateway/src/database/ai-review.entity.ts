export interface AiReviewRecord {
  reviewId: string;
  submissionId: string;
  cleanCodeScore: number;
  solidScore: number;
  codeSmellsCount: number;
  feedbackJson: any;
  compilerExplanation?: string | null;
  modelUsed: string;
  tokenUsage?: any;
  evaluatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
