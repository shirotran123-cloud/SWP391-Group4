/**
 * Gateway-local mirror of the GenAI Hub exam contract (UC-08).
 *
 * The shapes below intentionally duplicate `genai-hub/src/types/exam.types.ts`.
 * Duplication is deliberate: the gateway must not import across package
 * boundaries, so the HTTP payload contract is re-declared here.
 */
export type ExamDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export type ExamGenerationSource = 'GENAI_HUB' | 'LOCAL_DETERMINISTIC';

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

export interface GeneratedExamShape {
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

export interface ExamGenerationResult {
  exam: GeneratedExamShape;
  source: ExamGenerationSource;
  latencyMs: number;
}
