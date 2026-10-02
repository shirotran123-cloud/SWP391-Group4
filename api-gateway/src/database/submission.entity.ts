import { SubmissionStatus, SUBMISSION_STATUS } from '../common/constants/queue.constants';

export interface SubmissionRecord {
  submissionId: string;
  studentId: string;
  assignmentId: string;
  language: string;
  fileName: string;
  fileSizeBytes: number;
  sha256Hash: string;
  filePath: string;
  status: SubmissionStatus;
  queueJobId?: string;
  score?: number;
  details?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
