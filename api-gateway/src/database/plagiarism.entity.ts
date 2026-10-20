export type PlagiarismStatus = 'CLEAN' | 'SUSPECTED' | 'FLAGGED_HIGH' | 'FLAGGED_PLAGIARISM' | 'CONFIRMED' | 'DISMISSED';

export interface PlagiarismReportRecord {
  reportId: string;
  assignmentId?: string | null;
  submissionAId: string;
  submissionBId: string;
  similarityRate: number;
  flaggedAsFraud: boolean;
  commonFingerprintsCount: number;
  totalUniqueFingerprints: number;
  matchedTokensJson: any;
  status: PlagiarismStatus;
  evaluatedAt: Date;
  createdAt: Date;
}
