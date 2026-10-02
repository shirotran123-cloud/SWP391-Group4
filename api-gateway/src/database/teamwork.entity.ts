export interface TeamworkMetricRecord {
  metricId: string;
  classId: string;
  studentId: string;
  studentName?: string;
  commitCount: number;
  linesAdded: number;
  linesDeleted: number;
  contributionPct: number;
  isFreeRider: boolean; // BR-12: < 10% flag
  analyzedAt: Date;
}
