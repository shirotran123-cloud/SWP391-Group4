export type AppealStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'IN_REVIEW';

export interface AppealRecord {
  appealId: string;
  submissionId: string;
  studentId: string;
  reason: string;
  status: AppealStatus;
  reviewerId?: string;
  resolutionNote?: string;
  adjustedScore?: number;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
