/**
 * Queue names may be overridden so that a second gateway instance (e.g. one booted by a
 * test suite on another port) does not compete for the same Redis jobs. Two consumers on
 * one queue would each grab half the jobs, so a submission enqueued by the test process
 * could be graded by the long-running dev gateway and never observed by the test.
 */
export const SUBMISSION_QUEUE_NAME = process.env.SUBMISSION_QUEUE_NAME || 'submission-grading-queue';
export const DLQ_QUEUE_NAME = process.env.DLQ_QUEUE_NAME || 'submission-grading-dlq';

export const QUEUE_EVENTS = {
  SUBMISSION_QUEUED: 'submission:queued',
  TESTCASE_EVALUATED: 'testcase:evaluated',
  GRADING_PROGRESS: 'grading:progress',
  AI_REVIEWED: 'ai:reviewed',
  PLAGIARISM_EVALUATED: 'plagiarism:evaluated',
  GRADING_COMPLETED: 'grading:completed',
  GRADING_FAILED: 'grading:failed',
} as const;

export const SUBMISSION_STATUS = {
  QUEUED: 'QUEUED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  REJECTED: 'REJECTED',
} as const;

export type SubmissionStatus = typeof SUBMISSION_STATUS[keyof typeof SUBMISSION_STATUS];

export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024; // 10MB limit as required

export const QUEUE_CONFIG = {
  MAX_RETRIES: 3,
  BACKOFF_DELAY_MS: 1500,
  CONGESTION_THRESHOLD: 50,
  CONCURRENCY_LIMIT: 4,
} as const;
