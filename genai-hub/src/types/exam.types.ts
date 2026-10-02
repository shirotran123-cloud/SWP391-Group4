export type ExamDifficulty = "EASY" | "MEDIUM" | "HARD";

export interface TestCaseSpec {
  id: number;
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  weight: number;
  explanation: string;
}

export interface RubricLevel {
  scorePercent: number;
  description: string;
}

export interface GradingRubricItem {
  criterion: string;
  maxScore: number;
  description: string;
  levels: RubricLevel[];
}

export interface ExamGenerateRequest {
  topic: string;
  courseCode: string;
  difficulty: ExamDifficulty;
  language: string;
  learningOutcomes: string[];
  numTestCases?: number;
}

export interface GeneratedExam {
  title: string;
  courseCode: string;
  difficulty: ExamDifficulty;
  language: string;
  description: string;
  problemStatement: string;
  constraints: string[];
  inputFormat: string;
  outputFormat: string;
  sampleTestCases: TestCaseSpec[];
  hiddenTestCases: TestCaseSpec[];
  rubric: GradingRubricItem[];
  starterCode: string;
  referenceSolution: string;
}
