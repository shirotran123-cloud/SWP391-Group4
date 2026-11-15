export type AppealStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'IN_REVIEW';

export interface AppealEventRecord {
  id: string;
  action: 'CREATED' | 'ASSIGNED' | 'RESOLVED';
  actorId: string;
  meta?: Record<string, any>;
  createdAt: Date;
}

export interface AppealRecord {
  appealId: string;
  submissionId: string;
  studentId: string;
  reason: string;
  status: AppealStatus;
  submissionSha256?: string;
  originalScore?: number;
  assignedById?: string;
  assignedAt?: Date;
  events?: AppealEventRecord[];
  reviewerId?: string;
  resolutionNote?: string;
  adjustedScore?: number;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
