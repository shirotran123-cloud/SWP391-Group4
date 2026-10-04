export const SUBMISSION_QUEUE_NAME = 'submission-grading-queue';

export const QUEUE_EVENTS = {
  SUBMISSION_QUEUED: 'submission:queued',
  TESTCASE_EVALUATED: 'testcase:evaluated',
  GRADING_PROGRESS: 'grading:progress',
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
