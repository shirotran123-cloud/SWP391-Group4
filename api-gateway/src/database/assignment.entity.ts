export interface AssignmentRecord {
  assignmentId: string;
  courseId: string;
  title: string;
  description?: string;
  allowedLanguages: string[];
  maxScore: number;
  deadline: Date;
  timeLimitMs: number;
  memoryLimitMb: number;
  testcasesCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
