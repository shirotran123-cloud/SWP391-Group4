export interface AstFingerprintRecord {
  fingerprintId: string;
  submissionId: string;
  hashValue: string;
  tokenPosition: number;
  astNodeType?: string | null;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  tokenStart: number;
  tokenEnd: number;
  createdAt: Date;
}
