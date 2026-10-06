import { Fingerprint } from '../plagiarism/ast-plagiarism.engine';

/**
 * Lifecycle status of a pairwise plagiarism report.
 * Mirrors the CHECK constraint of `plagiarism_reports.status` in database/init_all_13_tables.sql.
 */
export type PlagiarismReportStatus =
  | 'CLEAN'
  | 'SUSPECTED'
  | 'FLAGGED_HIGH'
  | 'FLAGGED_PLAGIARISM'
  | 'CONFIRMED'
  | 'DISMISSED';

export interface PlagiarismMatchedSegment {
  hashValue: string;
  lineRangeA: { start: number; end: number };
  lineRangeB: { start: number; end: number };
  tokenRangeA: { start: number; end: number };
  tokenRangeB: { start: number; end: number };
  tokenCount: number;
}

export interface PlagiarismMatchedTokensJson {
  submissionAId: string;
  submissionBId: string;
  similarityRate: number;
  jaccardSimilarity: number;
  winnowingContainment: number;
  astStructuralSimilarity: number;
  totalUniqueFingerprintsA: number;
  totalUniqueFingerprintsB: number;
  commonFingerprintsCount: number;
  matchedSegments: PlagiarismMatchedSegment[];
}

/**
 * SRS Entity 11 — PLAGIARISM_REPORTS.
 * Canonical pair ordering: `submissionAId < submissionBId` (lexicographic) so the
 * UNIQUE (submission_a_id, submission_b_id) constraint stays honoured.
 */
export interface PlagiarismReportRecord {
  reportId: string;
  assignmentId?: string;
  submissionAId: string;
  submissionBId: string;
  similarityRate: number;
  flaggedAsFraud: boolean;
  commonFingerprintsCount: number;
  totalUniqueFingerprints: number;
  matchedTokensJson: PlagiarismMatchedTokensJson;
  status: PlagiarismReportStatus;
  evaluatedAt: Date;
  createdAt: Date;
}

export interface PlagiarismReportFilter {
  assignmentId?: string;
  flaggedOnly?: boolean;
  limit?: number;
}

/**
 * SRS Entity 10 — AST_FINGERPRINTS (Winnowing syntax hashes).
 * Adapter around the engine's `Fingerprint` shape plus persistence metadata.
 */
export interface AstFingerprintRecord {
  fingerprintId: string;
  submissionId: string;
  hashValue: string;
  tokenPosition: number;
  astNodeType?: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  tokenStart: number;
  tokenEnd: number;
  createdAt: Date;
}

export type AstFingerprintInput = Fingerprint;
