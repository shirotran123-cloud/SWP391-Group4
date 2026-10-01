export interface TestCaseRecord {
  testCaseId: string;
  assignmentId: string;
  inputData: string;
  expectedOutput: string;
  isHidden: boolean;
  weight: number;
  timeLimitMs: number;
  createdAt: Date;
  updatedAt: Date;
}
