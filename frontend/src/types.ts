export interface Task {
  id: string;
  title: string;
  course: string;
  deadline: string;
  maxSizeMb: number;
  allowedExtensions: string[];
  description: string;
}

export type GradingStepStatus = 'pending' | 'in_progress' | 'passed' | 'failed';

export interface GradingStep {
  id: string;
  label: string;
  status: GradingStepStatus;
  detail?: string;
}

export interface AIRating {
  cleanCodeScore: number;
  solidScore: {
    s: number;
    o: number;
    l: number;
    i: number;
    d: number;
  };
  codeSmells: Array<{ line: number; rule: string; description: string }>;
  explanation: string;
}

export interface PlagiarismMatch {
  matchedStudentName: string;
  matchedStudentId: string;
  similarityRate: number;
  sourceCodeA: string;
  sourceCodeB: string;
  matchedTokens: Array<{ lineA: [number, number]; lineB: [number, number] }>;
}
