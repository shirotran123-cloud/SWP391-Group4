export type SubmissionDetailStatus = 'PASS' | 'FAIL' | 'TLE' | 'MLE' | 'CRASH';

export interface SubmissionDetailRecord {
  detailId: string;
  submissionId: string;
  testCaseId?: string | null;
  status: SubmissionDetailStatus;
  actualOutput?: string;
  timeMs: number;
  memoryKb: number;
  errorLog?: string | null;
  createdAt: Date;
}
