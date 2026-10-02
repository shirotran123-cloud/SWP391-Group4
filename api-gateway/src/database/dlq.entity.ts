export type DLQJobStatus = 'FAILED' | 'RETRIED' | 'DISCARDED';

export interface DeadLetterJobRecord {
  dlqId: string;
  queueName: string;
  originalJobId: string;
  submissionId: string;
  payload: Record<string, any>;
  failedReason: string;
  attemptsMade: number;
  stacktrace?: string;
  status: DLQJobStatus;
  failedAt: Date;
  retriedAt?: Date;
}
