export interface Task {
  id: string;
  title: string;
  course: string;
  deadline: string;
  maxSizeMb: number;
  allowedExtensions: string[];
  description: string;
  allowedLanguages?: string[];
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

export interface ScoreBreakdown {
  testcase1: number;
  testcase2: number;
  cleanCode: number;
  solid: number;
  total: number;
}

export interface GradingResult {
  score?: number;
  passedTestcases?: number;
  totalTestcases?: number;
  scoreBreakdown?: ScoreBreakdown;
  aiRating?: AIRating;
}

export interface PlagiarismMatch {
  matchedStudentName: string;
  matchedStudentId: string;
  similarityRate: number;
  sourceCodeA: string;
  sourceCodeB: string;
  matchedTokens: Array<{ lineA: [number, number]; lineB: [number, number] }>;
  executionTimeMs?: number;
  isFlagged?: boolean;
  jaccardSimilarity?: number;
  winnowingContainment?: number;
  astStructuralSimilarity?: number;
  status?: string;
  studentAName?: string;
  studentAId?: string;
}

export interface PlagiarismPairItem {
  pairId: string;
  submissionAId: string;
  submissionBId: string;
  studentNameA: string;
  studentNameB: string;
  studentIdA: string;
  studentIdB: string;
  similarityRate: number;
  status: string;
  isFlagged: boolean;
  sourceCodeA: string;
  sourceCodeB: string;
  matchedTokens?: Array<{ lineA: [number, number]; lineB: [number, number] }>;
  jaccardSimilarity?: number;
  containment?: number;
  language?: string;
}

export interface PlagiarismCluster {
  clusterId: number;
  clusterName: string;
  studentCount: number;
  students: Array<{ submissionId: string; studentId: string; studentName: string; sourceCode?: string }>;
  pairs: PlagiarismPairItem[];
  maxSimilarity: number;
  riskLevel: 'CONFIRMED_ZERO' | 'FLAGGED' | 'WARNING';
}

export interface CrossClusterIndependence {
  clusterAId: number;
  clusterBId: number;
  clusterAName: string;
  clusterBName: string;
  maxCrossSimilarity: number;
  samplePair?: {
    submissionAId: string;
    submissionBId: string;
    studentNameA: string;
    studentNameB: string;
    similarityRate: number;
    sourceCodeA?: string;
    sourceCodeB?: string;
  };
  isIndependent: boolean;
}

export interface PlagiarismScanResultData {
  assignmentId?: string;
  totalSubmissions: number;
  totalPairsCompared: number;
  flaggedPairsCount: number;
  submissionsList: Array<{ id: string; name?: string; studentId?: string; sourceCode?: string; language?: string }>;
  similarityMatrix?: number[][];
  flaggedReports?: any[];
  clusters: PlagiarismCluster[];
  independentSubmissions: Array<{ id: string; name?: string; studentId?: string }>;
  crossClusterIndependence: CrossClusterIndependence[];
  totalExecutionTimeMs?: number;
}

export type UserRole = 'STUDENT' | 'INSTRUCTOR' | 'LECTURER' | 'HOD' | 'ADMIN';

export interface User {
  userId: string;
  email: string;
  fullName: string;
  role: UserRole;
  token?: string;
  avatarUrl?: string;
  department?: string;
}

export const isLecturerRole = (role?: string): boolean => {
  const r = (role || '').toUpperCase();
  return r === 'LECTURER' || r === 'INSTRUCTOR' || r === 'HOD';
};

export type UserProfile = User;


export interface Appeal {
  appealId: string;
  submissionId: string;
  studentId: string;
  reason: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'IN_REVIEW';
  reviewerId?: string;
  resolutionNote?: string;
  adjustedScore?: number;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamworkMetric {
  metricId: string;
  classId: string;
  studentId: string;
  studentName?: string;
  commitCount: number;
  linesAdded: number;
  linesDeleted: number;
  contributionPct: number;
  isFreeRider: boolean;
  analyzedAt: string;
}
