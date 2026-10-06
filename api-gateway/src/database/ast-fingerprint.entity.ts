/**
 * SRS Entity 10 — AST_FINGERPRINTS (Winnowing syntax hashes).
 *
 * The persisted contract lives in `plagiarism-report.entity.ts` (single file for both
 * entities of the plagiarism subsystem, mirroring how `appeal.entity.ts` holds the
 * appeal record + status union). This module re-exports it so imports can be explicit.
 */

export type { AstFingerprintRecord, AstFingerprintInput } from './plagiarism-report.entity';

/** SQL table name backing this entity. */
export const AST_FINGERPRINTS_TABLE = 'ast_fingerprints';
