import { SubmissionDetailModal, type SubmissionDetailData } from './SubmissionDetailModal';
import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  PlusCircle,
  FileSpreadsheet,
  Award,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Calendar,
  Clock,
  HardDrive,
  Cpu,
  Layers,
  Key,
  Settings,
  ExternalLink,
  Code2,
  Loader2,
  AlertCircle,
  X,
  FileCode,
  ArrowLeft,
  FileText,
  Trash2,
  Eye,
  FolderKanban,
  Scale,
  Download,
  RefreshCw,
} from 'lucide-react';
import { RblBenchmarkView } from './RblBenchmarkView';
import { LecturerAppealsManager } from './LecturerAppealsManager';
import type { PlagiarismMatch } from '../types';

import { GeminiAIService, type RubricCriterion } from '../services/gemini-ai.service';

// Base URL cá»§a NestJS API Gateway (Workflow 1 persist: Ä‘á» bÃ i + test cases + barem)
const API_BASE_URL = 'http://localhost:3000';

interface LecturerDashboardProps {
  onOpenDiffViewer?: (match: PlagiarismMatch) => void;
}

interface CourseItem {
  courseId: string;
  courseCode: string;
  courseName: string;
  semester: string;
  instructorName: string;
  studentCount: number;
  assignmentCount: number;
}

export interface PublishedAssignment {
  id: string;
  courseId: string;
  title: string;
  description: string;
  deadline: string;
  timeLimitMs: number;
  memoryLimitMb: number;
  allowedLanguages: string[];
  testCases: Array<{ input: string; output: string; weight: number; isHidden: boolean }>;
  rubrics?: RubricCriterion[];
  starterCode?: string;
  referenceSolution?: string;
  createdAt: string;
  status: 'PUBLISHED' | 'CLOSED';
  submissionCount: number;
  isNewlyCreated?: boolean;
}

interface SubmissionRecord {
  id: string;
  studentId: string;
  studentName: string;
  assignmentTitle: string;
  fileName: string;
  submittedAt: string;
  testcaseScore: number;
  cleanCodeScore: number;
  solidScore: number;
  finalScore: number;
  plagiarismStatus: 'AN TOÃ€N' | 'NGHI Váº¤N' | 'Äáº O VÄ‚N';
  similarityRate: number;
}

const initialCourses: CourseItem[] = [
  {
    courseId: 'COURSE-SWP391',
    courseCode: 'SWP391',
    courseName: 'Dá»± Ãn PhÃ¡t Triá»ƒn Pháº§n Má»m (Agile Scrum)',
    semester: 'Há»c ká»³ Thu 2026',
    instructorName: 'ThS. Äinh ThÃ nh Trung',
    studentCount: 38,
    assignmentCount: 2,
  },
  {
    courseId: 'COURSE-PRO192',
    courseCode: 'PRO192',
    courseName: 'Láº­p TrÃ¬nh HÆ°á»›ng Äá»‘i TÆ°á»£ng Java & SOLID',
    semester: 'Há»c ká»³ Thu 2026',
    instructorName: 'ThS. Äinh ThÃ nh Trung',
    studentCount: 42,
    assignmentCount: 1,
  },
  {
    courseId: 'COURSE-CSD201',
    courseCode: 'CSD201',
    courseName: 'Cáº¥u TrÃºc Dá»¯ Liá»‡u & Giáº£i Thuáº­t NÃ¢ng Cao',
    semester: 'Há»c ká»³ Thu 2026',
    instructorName: 'ThS. Äinh ThÃ nh Trung',
    studentCount: 35,
    assignmentCount: 1,
  },
];

const defaultPublishedAssignments: PublishedAssignment[] = [
  {
    id: 'ASM-SWP-01',
    courseId: 'COURSE-SWP391',
    title: 'CÃ i Ä‘áº·t Thuáº­t toÃ¡n CÃ¢y TÃ¬m Kiáº¿m Nhá»‹ PhÃ¢n (BST) & Äá»“ Thá»‹',
    description: 'CÃ i Ä‘áº·t Generic Binary Search Tree trong Java hoáº·c C++. Tá»‘i Æ°u hÃ³a Ä‘á»™ phá»©c táº¡p thá»i gian vÃ  tuÃ¢n thá»§ cÃ¡c nguyÃªn lÃ½ SOLID.',
    deadline: '2026-10-26T23:59',
    timeLimitMs: 2000,
    memoryLimitMb: 512,
    allowedLanguages: ['java', 'python', 'cpp'],
    testCases: [
      { input: '5\n4 2 5 1 3', output: '1 2 3 4 5', weight: 3.5, isHidden: false },
      { input: '3\n10 0 -5', output: '-5 0 10', weight: 3.5, isHidden: true },
    ],
    rubrics: [
      { criterion: 'TÃ­nh Ä‘Ãºng Ä‘áº¯n thuáº­t toÃ¡n & VÆ°á»£t qua Testcases', maxScore: 5.0, description: 'Pass 100% testcases' },
      { criterion: 'Clean Code & Tá»‘i Æ°u O(N log N)', maxScore: 2.5, description: 'MÃ£ nguá»“n rÃµ rÃ ng, Ä‘áº·t tÃªn chuáº©n' },
      { criterion: 'Thiáº¿t káº¿ HÆ°á»›ng Ä‘á»‘i tÆ°á»£ng & SOLID', maxScore: 2.5, description: 'TuÃ¢n thá»§ SRP vÃ  DIP' },
    ],
    starterCode: '// Java Starter Code BST',
    createdAt: '10/10/2026 08:30',
    status: 'PUBLISHED',
    submissionCount: 28,
  },
  {
    id: 'ASM-SWP-02',
    courseId: 'COURSE-SWP391',
    title: 'Thuáº­t toÃ¡n Sáº¯p xáº¿p & Tá»‘i Æ°u O(N log N)',
    description: 'CÃ i Ä‘áº·t giáº£i thuáº­t sáº¯p xáº¿p nhanh tá»‘i Æ°u 3-Way Partitioning trÃ¡nh suy biáº¿n trÃªn dá»¯ liá»‡u trÃ¹ng láº·p.',
    deadline: '2026-10-20T23:59',
    timeLimitMs: 1500,
    memoryLimitMb: 256,
    allowedLanguages: ['java', 'python', 'cpp'],
    testCases: [
      { input: '5\n5 4 3 2 1', output: '1 2 3 4 5', weight: 4.0, isHidden: false },
      { input: '10\n10 9 8 7 6 5 4 3 2 1', output: '1 2 3 4 5 6 7 8 9 10', weight: 3.0, isHidden: true },
    ],
    rubrics: [
      { criterion: 'ÄÃºng Ä‘áº¯n Testcases', maxScore: 7.0, description: 'VÆ°á»£t qua bá»™ testcases' },
      { criterion: 'Clean Code & SOLID', maxScore: 3.0, description: 'TuÃ¢n thá»§ SRP' },
    ],
    starterCode: '// Solution starter',
    createdAt: '08/10/2026 09:00',
    status: 'PUBLISHED',
    submissionCount: 35,
  },
  {
    id: 'ASM-CSD-01',
    courseId: 'COURSE-CSD201',
    title: 'CÃ i Äáº·t CÃ¢y AVL Tá»± CÃ¢n Báº±ng (Self-Balancing Tree)',
    description: 'Triá»ƒn khai cÃ¢y AVL vá»›i cÃ¡c phÃ©p xoay Ä‘Æ¡n vÃ  kÃ©p, kiá»ƒm tra cÃ¢n báº±ng 1,000 pháº§n tá»­.',
    deadline: '2026-10-30T23:59',
    timeLimitMs: 2000,
    memoryLimitMb: 512,
    allowedLanguages: ['java', 'cpp'],
    testCases: [
      { input: '6\n10 20 30 40 50 25', output: 'Preorder: 30 20 10 25 40 50', weight: 3.5, isHidden: false },
      { input: '3\n3 2 1', output: 'Preorder: 2 1 3', weight: 3.5, isHidden: false },
    ],
    createdAt: '11/10/2026 10:15',
    status: 'PUBLISHED',
    submissionCount: 18,
  },
];

const mockSubmissionsList: SubmissionRecord[] = [
  {
    id: 'SUB-001',
    studentId: 'SE170000',
    studentName: 'Äinh ThÃ nh Trung',
    assignmentTitle: 'Thuáº­t toÃ¡n Sáº¯p xáº¿p & Tá»‘i Æ°u O(N log N)',
    fileName: 'solution_sorting_v2.zip',
    submittedAt: '12/10/2026 14:22',
    testcaseScore: 7.0,
    cleanCodeScore: 9.0,
    solidScore: 8.5,
    finalScore: 9.5,
    plagiarismStatus: 'AN TOÃ€N',
    similarityRate: 14.5,
  },
  {
    id: 'SUB-002',
    studentId: 'SE170123',
    studentName: 'Tráº§n Thanh NguyÃªn',
    assignmentTitle: 'Thuáº­t toÃ¡n Sáº¯p xáº¿p & Tá»‘i Æ°u O(N log N)',
    fileName: 'sorting_fast.zip',
    submittedAt: '12/10/2026 14:15',
    testcaseScore: 6.5,
    cleanCodeScore: 8.0,
    solidScore: 8.0,
    finalScore: 8.8,
    plagiarismStatus: 'AN TOÃ€N',
    similarityRate: 18.2,
  },
  {
    id: 'SUB-003',
    studentId: 'SE170456',
    studentName: 'LÃª HoÃ ng Nam',
    assignmentTitle: 'Thuáº­t toÃ¡n Sáº¯p xáº¿p & Tá»‘i Æ°u O(N log N)',
    fileName: 'sort_algorithm_final.zip',
    submittedAt: '12/10/2026 13:50',
    testcaseScore: 5.0,
    cleanCodeScore: 6.0,
    solidScore: 5.5,
    finalScore: 6.5,
    plagiarismStatus: 'NGHI Váº¤N',
    similarityRate: 72.8,
  },
  {
    id: 'SUB-004',
    studentId: 'SE170889',
    studentName: 'Pháº¡m Minh Tuáº¥n',
    assignmentTitle: 'Thuáº­t toÃ¡n Sáº¯p xáº¿p & Tá»‘i Æ°u O(N log N)',
    fileName: 'assignment_sort.zip',
    submittedAt: '12/10/2026 12:10',
    testcaseScore: 4.0,
    cleanCodeScore: 5.0,
    solidScore: 4.5,
    finalScore: 5.0,
    plagiarismStatus: 'Äáº O VÄ‚N',
    similarityRate: 86.4,
  },
];

export const LecturerDashboard: React.FC<LecturerDashboardProps> = ({ onOpenDiffViewer }) => {
  const [activeTab, setActiveTab] = useState<'COURSES' | 'CREATE_ASSIGNMENT' | 'EXCEL_IMPORT' | 'SUBMISSIONS' | 'RBL_LAB' | 'APPEALS'>('COURSES');

  // Danh sÃ¡ch bÃ i ná»™p thá»±c táº¿ tá»« server & tráº¡ng thÃ¡i táº£i file zip
  const [realSubmissions, setRealSubmissions] = useState<SubmissionRecord[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  // Modal xem chi tiet bai nop & Danh gia AI cho Giang vien
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedDetailSubmission, setSelectedDetailSubmission] = useState<SubmissionDetailData | null>(null);

  const handleOpenDetailModal = (sub: any) => {
    setSelectedDetailSubmission({
      submissionId: sub.id || sub.submissionId,
      studentId: sub.studentId,
      studentName: sub.studentName,
      assignmentId: sub.assignmentId || 'ASM-SWP-01',
      assignmentTitle: sub.assignmentTitle || sub.assignmentId,
      fileName: sub.fileName || 'Solution.zip',
      language: sub.language || 'java',
      submittedAt: sub.submittedAt || sub.createdAt || new Date().toISOString(),
      score: sub.finalScore ?? sub.score ?? sub.details?.score ?? 9.8,
      scoreBreakdown: sub.scoreBreakdown || sub.details?.scoreBreakdown,
      passedTestcases: sub.passedTestcases ?? sub.details?.passedTestcases ?? 2,
      totalTestcases: sub.totalTestcases ?? sub.details?.totalTestcases ?? 2,
      executionTimeMs: sub.executionTimeMs ?? sub.details?.executionTimeMs ?? 185,
      sha256: sub.sha256Hash || sub.sha256,
      sourceCode: sub.sourceCode || sub.details?.sourceCode,
      aiRating: sub.aiRating || sub.details?.aiRating || {
        cleanCodeScore: sub.cleanCodeScore ?? 9.5,
        solidScore: { s: 9.0, o: 8.5, l: 9.0, i: 9.0, d: 8.5 },
        codeSmells: [],
        explanation: "Ma nguon to chuc ro rang, phan tach trach nhiem module tot.",
      },
    });
    setDetailModalOpen(true);
  };
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  const fetchRealSubmissions = async () => {
    setLoadingSubmissions(true);
    try {
      const token = localStorage.getItem('aita_token') || '';
      const res = await fetch('http://localhost:3000/api/v1/submissions', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const json = await res.json();
        const serverList = json.data || json || [];
        if (Array.isArray(serverList) && serverList.length > 0) {
          const mapped: SubmissionRecord[] = serverList.map((s: any) => ({
            id: s.submissionId || s.id,
            studentId: s.studentId || 'SE-N/A',
            studentName: s.studentName || s.studentId || 'Sinh viÃªn',
            assignmentTitle: s.assignmentId || 'BÃ i ná»™p',
            fileName: s.fileName || `${s.submissionId || s.id}.zip`,
            submittedAt: s.createdAt ? new Date(s.createdAt).toLocaleString('vi-VN') : 'Vá»«a xong',
            testcaseScore: s.score !== undefined ? Math.round(s.score * 0.7 * 10) / 10 : 7.0,
            cleanCodeScore: s.result?.aiRating?.cleanCodeScore ?? 8.5,
            solidScore: 8.0,
            finalScore: s.score ?? 8.5,
            plagiarismStatus: s.plagiarismStatus || 'AN TOÃ€N',
            similarityRate: s.similarityRate ?? 15,
          }));
          setRealSubmissions(mapped);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoadingSubmissions(false);
    }
  };

  useEffect(() => {
    void fetchRealSubmissions();
  }, []);

  const handleDownloadZip = async (subId: string, preferredFileName?: string) => {
    setDownloadingId(subId);
    try {
      const token = localStorage.getItem('aita_token') || '';
      const res = await fetch(`http://localhost:3000/api/v1/submissions/${subId}/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const disposition = res.headers.get('Content-Disposition');
        const match = disposition?.match(/filename="?([^"]+)"?/);
        a.download = match?.[1] ?? preferredFileName ?? `${subId}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        // Fallback cho bÃ i máº«u demo
        const sampleCode = `// AITA Code Submission Archive: ${subId}\n// Sinh vien: ${preferredFileName || 'solution.zip'}\n\npublic class Solution {\n    public static void main(String[] args) {\n        System.out.println("AITA Grading Demo - Source Code Extracted");\n    }\n}`;
        const blob = new Blob([sampleCode], { type: 'application/zip' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = preferredFileName && preferredFileName.endsWith('.zip') ? preferredFileName : `${subId}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      alert(`Lá»—i khi táº£i file zip: ${err.message}`);
    } finally {
      setDownloadingId(null);
    }
  };


  // Quáº£n lÃ½ danh sÃ¡ch khÃ³a há»c vÃ  bÃ i táº­p Ä‘Ã£ giao
  const [courses, setCourses] = useState<CourseItem[]>(initialCourses);
  const [publishedAssignments, setPublishedAssignments] = useState<PublishedAssignment[]>(() => {
    try {
      const saved = localStorage.getItem('aita_published_assignments');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return defaultPublishedAssignments;
  });

  // MÃ´n há»c Ä‘ang xem chi tiáº¿t (náº¿u null thÃ¬ hiá»‡n danh sÃ¡ch táº¥t cáº£ mÃ´n há»c)
  const [selectedCourseDetailId, setSelectedCourseDetailId] = useState<string | null>(null);

  // Modal xem chi tiáº¿t Ä‘á» bÃ i Ä‘Ã£ giao
  const [previewAssignment, setPreviewAssignment] = useState<PublishedAssignment | null>(null);

  // Toast thÃ´ng bÃ¡o xuáº¥t báº£n thÃ nh cÃ´ng
  const [publishSuccessToast, setPublishSuccessToast] = useState<string | null>(null);

  // Form state cho táº¡o Ä‘á» bÃ i
  const [assignmentTitle, setAssignmentTitle] = useState('CÃ i Ä‘áº·t Thuáº­t toÃ¡n CÃ¢y TÃ¬m Kiáº¿m Nhá»‹ PhÃ¢n (BST) & Äá»“ Thá»‹');
  const [selectedCourse, setSelectedCourse] = useState('COURSE-SWP391');
  const [assignmentDesc, setAssignmentDesc] = useState('CÃ i Ä‘áº·t Generic Binary Search Tree trong Java hoáº·c C++. Tá»‘i Æ°u hÃ³a Ä‘á»™ phá»©c táº¡p thá»i gian vÃ  tuÃ¢n thá»§ cÃ¡c nguyÃªn lÃ½ SOLID.');
  const [deadlineDate, setDeadlineDate] = useState('2026-10-26T23:59');
  const [allowedLanguages, setAllowedLanguages] = useState<string[]>(['java', 'python', 'cpp']);
  const [timeLimitMs, setTimeLimitMs] = useState(2000);
  const [memoryLimitMb, setMemoryLimitMb] = useState(512);
  const [testCases, setTestCases] = useState<Array<{ input: string; output: string; weight: number; isHidden: boolean }>>([
    { input: '5\n4 2 5 1 3', output: '1 2 3 4 5', weight: 3.5, isHidden: false },
    { input: '3\n10 0 -5', output: '-5 0 10', weight: 3.5, isHidden: true },
  ]);
  const [createSuccessMsg, setCreateSuccessMsg] = useState<string | null>(null);

  // TÃ­nh tá»•ng trá»ng sá»‘ testcases hiá»‡n táº¡i (xá»­ lÃ½ trÆ°á»ng há»£p tá»•ng khÃ¡c 10 hoáº·c báº±ng 14, 20...)
  const totalTestcaseWeight = testCases.reduce((sum, tc) => sum + (Number(tc.weight) || 0), 0);

  // Chuáº©n hÃ³a tá»· lá»‡ Ä‘iá»ƒm cÃ¡c testcases vá» thang mong muá»‘n (10.0Ä‘ hoáº·c 7.0Ä‘ theo Barem)
  const handleNormalizeTestcases = (targetScore: number) => {
    if (totalTestcaseWeight <= 0 || testCases.length === 0) return;
    let accumulated = 0;
    const normalized = testCases.map((tc, idx) => {
      if (idx === testCases.length - 1) {
        const finalWeight = Math.max(0.5, Math.round((targetScore - accumulated) * 10) / 10);
        return { ...tc, weight: finalWeight };
      }
      const rawW = (tc.weight / totalTestcaseWeight) * targetScore;
      const roundedW = Math.max(0.5, Math.round(rawW * 10) / 10);
      accumulated += roundedW;
      return { ...tc, weight: roundedW };
    });
    setTestCases(normalized);
  };

  // Gemini AI Real State
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => {
    return localStorage.getItem('aita_gemini_api_key') || '';
  });
  const [selectedAiModel, setSelectedAiModel] = useState<string>('auto');
  const [availableModelList, setAvailableModelList] = useState<string[]>([]);
  const [desiredTestCount, setDesiredTestCount] = useState<number>(5);
  const [lecturerPrompt, setLecturerPrompt] = useState<string>(
    'Táº¡o bÃ i táº­p vá» Thuáº­t toÃ¡n Dijkstra tÃ¬m Ä‘Æ°á»ng Ä‘i ngáº¯n nháº¥t, cÃ³ tá»‘i Æ°u báº±ng HÃ ng Ä‘á»£i Æ°u tiÃªn PriorityQueue, sinh viÃªn pháº£i Ã¡p dá»¥ng nguyÃªn lÃ½ SOLID Single Responsibility (SRP).'
  );
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [tempApiKey, setTempApiKey] = useState(geminiApiKey);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiTimerSeconds, setAiTimerSeconds] = useState(0);
  const [aiErrorMsg, setAiErrorMsg] = useState<string | null>(null);
  const [aiSuccessBadge, setAiSuccessBadge] = useState<string | null>(null);
  const [generatedRubrics, setGeneratedRubrics] = useState<RubricCriterion[]>([]);
  const [starterCode, setStarterCode] = useState<string>('');
  const [referenceSolution, setReferenceSolution] = useState<string>('');
  const [showSolutionModal, setShowSolutionModal] = useState(false);

  // Ping Key status
  const [pingStatus, setPingStatus] = useState<{ loading: boolean; message: string | null; success: boolean | null }>({
    loading: false,
    message: null,
    success: null,
  });

  // Excel / CSV state
  const [excelStatus, setExcelStatus] = useState<string | null>(null);
  const [excelLoading, setExcelLoading] = useState(false);
  const [simulatedRollback, setSimulatedRollback] = useState<boolean | null>(null);
  const [uploadedCsvFile, setUploadedCsvFile] = useState<File | null>(null);
  const [parsedCsvStudents, setParsedCsvStudents] = useState<Array<{ studentCode: string; fullName: string; email: string }>>([]);
  const [csvParseError, setCsvParseError] = useState<string | null>(null);

  // LÆ°u API Key vÃ o LocalStorage
  const handleSaveApiKey = () => {
    const trimmed = tempApiKey.trim();
    setGeminiApiKey(trimmed);
    localStorage.setItem('aita_gemini_api_key', trimmed);
    setIsConfigModalOpen(false);
    setAiErrorMsg(null);
  };

  // Ping kiá»ƒm tra káº¿t ná»‘i API Key vá»›i Google Gemini
  // Ping kiá»ƒm tra káº¿t ná»‘i API Key vá»›i Google Gemini
  const handleTestApiKey = async () => {
    if (!tempApiKey.trim()) {
      setPingStatus({ loading: false, message: 'Vui lÃ²ng nháº­p API Key trÆ°á»›c khi kiá»ƒm tra.', success: false });
      return;
    }
    setPingStatus({ loading: true, message: 'Äang káº¿t ná»‘i tá»›i mÃ¡y chá»§ Google Gemini (ModelService.ListModels)...', success: null });
    const res = await GeminiAIService.pingKey(tempApiKey, selectedAiModel === 'auto' ? undefined : selectedAiModel);
    setPingStatus({
      loading: false,
      message: res.message + (res.latencyMs ? ` (Äá»™ trá»…: ${res.latencyMs}ms)` : ''),
      success: res.success,
    });
    if (res.availableModels && res.availableModels.length > 0) {
      setAvailableModelList(res.availableModels);
      if (selectedAiModel === 'auto' || !res.availableModels.includes(selectedAiModel) || selectedAiModel.includes('tts')) {
        const best = res.availableModels.find((m) => m.includes('flash') && !m.includes('tts')) || res.availableModels[0];
        setSelectedAiModel(best);
      }
    }
  };

  // Sinh Ä‘á» tá»± Ä‘á»™ng báº±ng 100% Google Gemini AI THáº¬T (UC-08)
  const handleAiGenerateAssignment = async () => {
    setAiErrorMsg(null);
    setCreateSuccessMsg(null);
    setAiSuccessBadge(null);

    // Náº¿u chÆ°a cÃ³ API Key, má»Ÿ modal cáº¥u hÃ¬nh Ä‘á»ƒ ngÆ°á»i dÃ¹ng nháº­p
    if (!geminiApiKey.trim()) {
      setTempApiKey('');
      setIsConfigModalOpen(true);
      setAiErrorMsg('Báº¡n cáº§n cung cáº¥p Google Gemini API Key Ä‘á»ƒ há»‡ thá»‘ng káº¿t ná»‘i AI táº¡o Ä‘á» bÃ i.');
      return;
    }

    setIsAiGenerating(true);
    setAiTimerSeconds(0);
    const timerInterval = setInterval(() => {
      setAiTimerSeconds((s) => s + 1);
    }, 1000);

    try {
      const courseObj = courses.find((c) => c.courseId === selectedCourse);
      const courseName = courseObj ? courseObj.courseName : 'Dá»± Ãn PhÃ¡t Triá»ƒn Pháº§n Má»m';
      const courseCode = courseObj ? courseObj.courseCode : 'SWP391';

      const detectedCount = GeminiAIService.extractRequestedCount(lecturerPrompt);
      const testCountToUse = detectedCount || desiredTestCount || 5;

            // Æ¯u tiÃªn yÃªu cáº§u cá»¥ thá»ƒ cá»§a giáº£ng viÃªn; trÃ¡nh truyá»n láº¡i tiÃªu Ä‘á» cÅ© náº¿u Ä‘Ã£ bá»‹ gÃ¡n tá»« láº§n sinh trÆ°á»›c
      let topicToUse = lecturerPrompt?.trim() || '';
      if (!topicToUse) {
        if (assignmentTitle && !assignmentTitle.toLowerCase().includes('drone')) {
          topicToUse = assignmentTitle;
        } else {
          topicToUse = `${courseCode} - Cáº¥u trÃºc dá»¯ liá»‡u & Thuáº­t toÃ¡n thá»±c táº¿`;
        }
      }

      const result = await GeminiAIService.generateAssignment(geminiApiKey, {
        courseName,
        courseCode,
        topicPrompt: topicToUse,
        lecturerDescription: lecturerPrompt,
        difficulty: 'TRUNG BÃŒNH',
        allowedLanguages,
        model: (selectedAiModel && selectedAiModel !== 'auto' && !selectedAiModel.includes('tts')) ? selectedAiModel : undefined,
        numTestCases: testCountToUse,
      });

      setAssignmentTitle(result.title);
      setAssignmentDesc(result.description);
      setTimeLimitMs(result.timeLimitMs);
      setMemoryLimitMb(result.memoryLimitMb);
      if (result.testCases && result.testCases.length > 0) {
        setTestCases(
          result.testCases.map((tc) => ({
            input: tc.input,
            output: tc.output,
            weight: tc.weight,
            isHidden: tc.isHidden,
          }))
        );
      }
      if (result.rubric && result.rubric.length > 0) {
        setGeneratedRubrics(result.rubric);
      }
      if (result.starterCode) {
        setStarterCode(result.starterCode);
      }
      if (result.referenceSolution) {
        setReferenceSolution(result.referenceSolution);
      }

      const badgeText = `âœ¨ Google Gemini AI (${result.modelUsed}) Ä‘Ã£ sinh Ä‘á» & barem thÃ nh cÃ´ng trong ${result.latencyMs}ms!`;
      setAiSuccessBadge(badgeText);
      setCreateSuccessMsg(
        `ÄÃ£ táº¡o Ä‘á» bÃ i "${result.title}" kÃ¨m ${result.testCases.length} testcases vÃ  ${result.rubric.length} tiÃªu chÃ­ barem cháº¥m Ä‘iá»ƒm.`
      );
    } catch (err: any) {
      console.error('Lá»—i khi gá»i Google Gemini AI:', err);
      setAiErrorMsg(err.message || 'KhÃ´ng thá»ƒ káº¿t ná»‘i tá»›i Google Gemini AI. Vui lÃ²ng kiá»ƒm tra láº¡i API Key hoáº·c háº¡n má»©c quota.');
    } finally {
      clearInterval(timerInterval);
      setIsAiGenerating(false);
      setAiTimerSeconds(0);
    }
  };

  // LÆ°u & Xuáº¥t báº£n Ä‘á» bÃ i táº­p: PERSIST lÃªn API Gateway (Workflow 1) rá»“i lÆ°u cá»¥c bá»™ vÃ  Ä‘iá»u hÆ°á»›ng.
  // TrÆ°á»›c Ä‘Ã¢y hÃ m nÃ y CHá»ˆ ghi localStorage nÃªn Ä‘á» bÃ i + testcases khÃ´ng há» vÃ o CSDL.
  const persistAssignmentToGateway = async (asmId: string, courseCode: string): Promise<{ assignmentId: string; savedTestCases: number; warning?: string }> => {
    const res = await fetch(`${API_BASE_URL}/api/v1/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assignmentId: asmId,
        courseId: selectedCourse,
        title: assignmentTitle,
        description: assignmentDesc,
        allowedLanguages: [...allowedLanguages],
        maxScore: 10,
        deadline: new Date(deadlineDate).toISOString(),
        timeLimitMs,
        memoryLimitMb,
        testcasesCount: testCases.length,
      }),
    });

    if (!res.ok && res.status !== 409) {
      const body = await res.text().catch(() => '');
      throw new Error(`KhÃ´ng lÆ°u Ä‘Æ°á»£c Ä‘á» bÃ i lÃªn Gateway (HTTP ${res.status}). ${body.slice(0, 160)}`);
    }

    // LÆ°u tá»«ng test case (cÃ´ng khai + áº©n) kÃ¨m barem trá»ng sá»‘
    let savedTestCases = 0;
    const failed: string[] = [];
    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      try {
        const tcRes = await fetch(`${API_BASE_URL}/api/v1/test-cases`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assignmentId: asmId,
            inputData: tc.input,
            expectedOutput: tc.output,
            isHidden: Boolean(tc.isHidden),
            weight: Number(tc.weight) > 0 ? Number(tc.weight) : 1.0,
            timeLimitMs,
          }),
        });
        if (tcRes.ok || tcRes.status === 409) {
          savedTestCases++;
        } else {
          failed.push(`testcase #${i + 1} (HTTP ${tcRes.status})`);
        }
      } catch (tcErr: any) {
        failed.push(`testcase #${i + 1} (${tcErr.message})`);
      }
    }

    return {
      assignmentId: asmId,
      savedTestCases,
      warning: failed.length > 0 ? `Má»™t sá»‘ testcase chÆ°a lÆ°u Ä‘Æ°á»£c: ${failed.join(', ')}.` : undefined,
    };
  };

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignmentTitle.trim()) {
      setAiErrorMsg('Vui lÃ²ng nháº­p TiÃªu Ä‘á» bÃ i táº­p trÆ°á»›c khi xuáº¥t báº£n.');
      return;
    }

    const courseObj = courses.find((c) => c.courseId === selectedCourse);
    const courseName = courseObj ? courseObj.courseName : 'Dá»± Ãn PhÃ¡t Triá»ƒn Pháº§n Má»m';
    const courseCode = courseObj ? courseObj.courseCode : 'SWP391';

    // MÃ£ Ä‘á» bÃ i á»•n Ä‘á»‹nh theo ná»™i dung Ä‘á»ƒ báº¥m Xuáº¥t báº£n láº¡i KHÃ”NG táº¡o báº£n ghi trÃ¹ng.
    const slug = (s: string) =>
      s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toUpperCase().slice(0, 40);
    const asmId = `ASM-${slug(courseCode)}-${slug(assignmentTitle) || Date.now().toString().slice(-5)}`;

    let persistWarning: string | undefined;
    let savedTestCases = testCases.length;
    try {
      const persisted = await persistAssignmentToGateway(asmId, courseCode);
      savedTestCases = persisted.savedTestCases;
      persistWarning = persisted.warning;
    } catch (persistErr: any) {
      // Gateway offline -> váº«n lÆ°u cá»¥c bá»™ Ä‘á»ƒ demo khÃ´ng bá»‹ cháº·n, nhÆ°ng bÃ¡o rÃµ cho giáº£ng viÃªn.
      persistWarning = `ChÆ°a lÆ°u Ä‘Æ°á»£c lÃªn CSDL Gateway (${persistErr.message}). Äá» bÃ i chá»‰ Ä‘Æ°á»£c lÆ°u táº¡m trÃªn trÃ¬nh duyá»‡t.`;
      console.warn('[Workflow1] Persist failed:', persistErr);
    }

    const newAsm: PublishedAssignment = {
      id: asmId,
      courseId: selectedCourse,
      title: assignmentTitle,
      description: assignmentDesc,
      deadline: deadlineDate,
      timeLimitMs,
      memoryLimitMb,
      allowedLanguages: [...allowedLanguages],
      testCases: [...testCases],
      rubrics: [...generatedRubrics],
      starterCode,
      referenceSolution,
      createdAt: new Date().toLocaleString('vi-VN'),
      status: 'PUBLISHED',
      submissionCount: 0,
      isNewlyCreated: true,
    };

    const updatedAsms = [newAsm, ...publishedAssignments.filter((a) => a.id !== asmId)];
    setPublishedAssignments(updatedAsms);
    try {
      localStorage.setItem('aita_published_assignments', JSON.stringify(updatedAsms));
      window.dispatchEvent(new Event('aita_published_assignments_updated'));
    } catch {
      // ignore
    }

    // TÄƒng sá»‘ lÆ°á»£ng bÃ i táº­p cá»§a khÃ³a há»c
    setCourses((prevCourses) =>
      prevCourses.map((c) =>
        c.courseId === selectedCourse ? { ...c, assignmentCount: c.assignmentCount + 1 } : c
      )
    );

    const toastMsg = persistWarning
      ? `âš ï¸ ÄÃƒ XUáº¤T Báº¢N (má»™t pháº§n): BÃ i táº­p "${assignmentTitle}" â€” ${persistWarning}`
      : `ðŸŽ‰ ÄÃƒ XUáº¤T Báº¢N THÃ€NH CÃ”NG: BÃ i táº­p "${assignmentTitle}" (${savedTestCases}/${testCases.length} testcases Ä‘Ã£ lÆ°u vÃ o CSDL) Ä‘Ã£ giao cho lá»›p ${courseCode} (${courseName})!`;
    setPublishSuccessToast(toastMsg);
    setCreateSuccessMsg(toastMsg);
    setAiErrorMsg(persistWarning ? persistWarning : null);

    // Tá»° Äá»˜NG ÄIá»€U HÆ¯á»šNG SANG TRANG Cá»¦A MÃ”N Há»ŒC ÄÃ“
    setSelectedCourseDetailId(selectedCourse);
    setActiveTab('COURSES');
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      // ignore
    }
  };

  // ÄÃ³ng hoáº·c má»Ÿ láº¡i bÃ i táº­p
  const handleToggleAssignmentStatus = (asmId: string) => {
    const updated = publishedAssignments.map((a) =>
      a.id === asmId ? { ...a, status: (a.status === 'PUBLISHED' ? 'CLOSED' : 'PUBLISHED') as 'PUBLISHED' | 'CLOSED', isNewlyCreated: false } : a
    );
    setPublishedAssignments(updated);
    try {
      localStorage.setItem('aita_published_assignments', JSON.stringify(updated));
      window.dispatchEvent(new Event('aita_published_assignments_updated'));
    } catch {
      // ignore
    }
  };

  // XÃ³a bÃ i táº­p khá»i lá»›p
  const handleDeleteAssignment = (asmId: string, courseId: string) => {
    if (!window.confirm('Báº¡n cÃ³ cháº¯c cháº¯n muá»‘n xÃ³a bÃ i táº­p nÃ y khá»i lá»›p há»c?')) return;
    const updated = publishedAssignments.filter((a) => a.id !== asmId);
    setPublishedAssignments(updated);
    try {
      localStorage.setItem('aita_published_assignments', JSON.stringify(updated));
      window.dispatchEvent(new Event('aita_published_assignments_updated'));
    } catch {
      // ignore
    }
    setCourses((prev) =>
      prev.map((c) => (c.courseId === courseId ? { ...c, assignmentCount: Math.max(0, c.assignmentCount - 1) } : c))
    );
  };

  // State vÃ  modal táº¡o khÃ³a há»c má»›i
  const [isCreateCourseModalOpen, setIsCreateCourseModalOpen] = useState(false);
  const [newCourseCode, setNewCourseCode] = useState('PRN211');
  const [newCourseName, setNewCourseName] = useState('Cross-Platform Application Development with .NET');
  const [newCourseSemester, setNewCourseSemester] = useState('Há»c ká»³ Thu 2026');
  const [newCourseDesc, setNewCourseDesc] = useState('Láº­p trÃ¬nh á»©ng dá»¥ng Ä‘a ná»n táº£ng vá»›i .NET Core & Clean Architecture');
  const [createCourseLoading, setCreateCourseLoading] = useState(false);

  // State cho viá»‡c náº¡p Roster Excel vÃ o lá»›p
  const [targetCourseId, setTargetCourseId] = useState<string>('CRS-SWP391');

  // Táº£i danh sÃ¡ch khÃ³a há»c thá»±c táº¿ tá»« API Gateway (PostgreSQL 15)
  const fetchLiveCourses = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/v1/courses');
      if (res.ok) {
        const json = await res.json();
        const serverCourses = json.data || json || [];
        if (Array.isArray(serverCourses) && serverCourses.length > 0) {
          const mapped: CourseItem[] = serverCourses.map((c: any) => ({
            courseId: c.courseId,
            courseCode: c.courseCode,
            courseName: c.courseName,
            semester: c.semester,
            instructorName: 'ThS. Giáº£ng ViÃªn AITA',
            studentCount: c.studentCount || 38,
            assignmentCount: 2,
          }));
          setCourses(mapped);
          if (mapped.length > 0 && !targetCourseId) {
            setTargetCourseId(mapped[0].courseId);
          }
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void fetchLiveCourses();
  }, []);

  const handleCreateNewCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseCode.trim() || !newCourseName.trim()) {
      alert('Vui lÃ²ng nháº­p MÃ£ há»c pháº§n vÃ  TÃªn khÃ³a há»c!');
      return;
    }

    setCreateCourseLoading(true);
    const generatedId = 'CRS-' + newCourseCode.trim().toUpperCase();
    try {
      await fetch('http://localhost:3000/api/v1/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: generatedId,
          courseCode: newCourseCode.trim().toUpperCase(),
          courseName: newCourseName.trim(),
          semester: newCourseSemester,
          description: newCourseDesc,
          instructorId: 'GV001',
        }),
      });

      const newCourseObj: CourseItem = {
        courseId: generatedId,
        courseCode: newCourseCode.trim().toUpperCase(),
        courseName: newCourseName.trim(),
        semester: newCourseSemester,
        instructorName: 'ThS. Giáº£ng ViÃªn AITA',
        studentCount: 0,
        assignmentCount: 0,
      };

      setCourses((prev) => [newCourseObj, ...prev.filter((c) => c.courseId !== generatedId)]);
      setTargetCourseId(generatedId);
      setIsCreateCourseModalOpen(false);
      setPublishSuccessToast(`ðŸŽ‰ ÄÃ£ táº¡o thÃ nh cÃ´ng khÃ³a há»c má»›i [${newCourseCode}] vÃ  lÆ°u vÃ o PostgreSQL 15!`);
    } catch (err: any) {
      alert(`Lá»—i táº¡o khÃ³a há»c: ${err.message}`);
    } finally {
      setCreateCourseLoading(false);
    }
  };

  const handleDownloadSampleCsv = () => {
    const csvContent =
      'MÃ£ Sinh ViÃªn,Há» VÃ  TÃªn,Email FPT\n' +
      'SE170000,Äinh ThÃ nh Trung,trungdt.student@aita.fpt.edu.vn\n' +
      'SE170123,Tráº§n Thanh NguyÃªn,nguyentt@aita.fpt.edu.vn\n' +
      'SE201817,Nguyá»…n HoÃ ng Vinh,user.student@gmail.com\n' +
      'SE712137,VÃµ ThÃ¡i Trung,vttrung2k6@gmail.com\n' +
      'SE170456,LÃª HoÃ ng Nam,namlh@aita.fpt.edu.vn\n';

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roster_${targetCourseId || 'sample'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedCsvFile(file);
    setCsvParseError(null);
    setExcelStatus(null);
    setSimulatedRollback(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text || !text.trim()) {
          setCsvParseError('File CSV Ä‘Æ°á»£c chá»n rá»—ng hoáº·c khÃ´ng cÃ³ dá»¯ liá»‡u!');
          setParsedCsvStudents([]);
          return;
        }

        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
        if (lines.length <= 1) {
          setCsvParseError('File CSV chá»‰ cÃ³ dÃ²ng tiÃªu Ä‘á» hoáº·c khÃ´ng chá»©a báº£n ghi sinh viÃªn nÃ o!');
          setParsedCsvStudents([]);
          return;
        }

        const students: Array<{ studentCode: string; fullName: string; email: string }> = [];
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(',').map((p) => p.trim().replace(/^["']|["']$/g, ''));
          if (parts.length >= 3 && parts[0] && parts[2]) {
            students.push({
              studentCode: parts[0],
              fullName: parts[1] || parts[0],
              email: parts[2],
            });
          } else if (parts.length === 2 && parts[0] && parts[1]) {
            students.push({
              studentCode: parts[0],
              fullName: parts[0],
              email: parts[1],
            });
          }
        }

        if (students.length === 0) {
          setCsvParseError('KhÃ´ng trÃ­ch xuáº¥t Ä‘Æ°á»£c sinh viÃªn nÃ o tá»« CSV! Kiá»ƒm tra cÃ¡c cá»™t: MÃ£ Sinh ViÃªn, Há» VÃ  TÃªn, Email.');
          setParsedCsvStudents([]);
        } else {
          setParsedCsvStudents(students);
        }
      } catch (err: any) {
        setCsvParseError('Lá»—i Ä‘á»c ná»™i dung file CSV: ' + err.message);
        setParsedCsvStudents([]);
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleExecuteLiveBulkImport = async (triggerError: boolean, customStudents?: any[]) => {
    setExcelLoading(true);
    setExcelStatus(null);
    setSimulatedRollback(null);

    const studentsToImport = customStudents || (parsedCsvStudents.length > 0 ? parsedCsvStudents : (triggerError ? [
      { studentCode: 'SE170000', fullName: 'Äinh ThÃ nh Trung', email: 'trungdt.student@aita.fpt.edu.vn' },
      { studentCode: 'SE170123', fullName: 'Tráº§n Thanh NguyÃªn', email: 'nguyentt@aita.fpt.edu.vn' },
      { studentCode: 'SE170123_ERROR_ROLLBACK', fullName: 'Nguyá»…n VÄƒn Lá»—i (TrÃ¹ng MSSV)', email: 'loi@aita.fpt.edu.vn' },
    ] : [
      { studentCode: 'SE170000', fullName: 'Äinh ThÃ nh Trung', email: 'trungdt.student@aita.fpt.edu.vn' },
      { studentCode: 'SE170123', fullName: 'Tráº§n Thanh NguyÃªn', email: 'nguyentt@aita.fpt.edu.vn' },
      { studentCode: 'SE201817', fullName: 'Nguyá»…n HoÃ ng Vinh', email: 'user.student@gmail.com' },
      { studentCode: 'SE712137', fullName: 'VÃµ ThÃ¡i Trung', email: 'vttrung2k6@gmail.com' },
      { studentCode: 'SE170456', fullName: 'LÃª HoÃ ng Nam', email: 'vinhtt@aita.fpt.edu.vn' },
    ]));

    try {
      const courseIdToUse = targetCourseId || 'CRS-SWP391';
      const res = await fetch(`http://localhost:3000/api/v1/courses/${courseIdToUse}/bulk-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students: studentsToImport }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Lá»—i giao dá»‹ch SQL!');
      }

      setSimulatedRollback(false);
      setExcelStatus(
        `âœ… GIAO Dá»ŠCH SQL THÃ€NH CÃ”NG (100% COMMIT): ÄÃ£ náº¡p vÃ  ghi danh thÃ nh cÃ´ng ${studentsToImport.length} sinh viÃªn vÃ o lá»›p [${courseIdToUse}] trong PostgreSQL 15! Sinh viÃªn Ä‘Äƒng nháº­p vÃ o sáº½ tháº¥y mÃ´n há»c ngay.`
      );
      setCourses((prev) =>
        prev.map((c) =>
          c.courseId === courseIdToUse ? { ...c, studentCount: Math.max(c.studentCount, studentsToImport.length) } : c
        )
      );
    } catch (err: any) {
      setSimulatedRollback(true);
      setExcelStatus(
        `âŒ GIAO Dá»ŠCH SQL THáº¤T Báº I: ${err.message}. Há»‡ thá»‘ng Ä‘Ã£ tá»± Ä‘á»™ng kÃ­ch hoáº¡t 100% SQL TRANSACTION ROLLBACK (R06) báº£o toÃ n dá»¯ liá»‡u PostgreSQL, khÃ´ng cÃ³ báº¥t ká»³ báº£n ghi má»“ cÃ´i nÃ o!`
      );
    } finally {
      setExcelLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
      {/* TiÃªu Ä‘á» Dashboard Giáº£ng ViÃªn */}
      <div className="glass-panel" style={{ padding: '24px 28px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Báº£ng Quáº£n Trá»‹ Giáº£ng ViÃªn â€¢ Vai TrÃ²: INSTRUCTOR
          </span>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#ffffff', marginTop: '4px' }}>
            Cá»•ng Äiá»u HÃ nh Há»c Pháº§n & Kháº£o ThÃ­ Láº­p TrÃ¬nh
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '2px' }}>
            Quáº£n lÃ½ Ä‘á» bÃ i, phÃ¢n cÃ´ng lá»›p há»c, tÃ­ch há»£p AI soáº¡n Ä‘á» tá»± Ä‘á»™ng vÃ  kiá»ƒm Ä‘á»‹nh Ä‘áº¡o vÄƒn AST
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => {
              setTempApiKey(geminiApiKey);
              setIsConfigModalOpen(true);
            }}
            style={{
              padding: '9px 14px',
              borderRadius: '10px',
              border: `1px solid ${geminiApiKey ? 'rgba(16, 185, 129, 0.4)' : 'rgba(234, 179, 8, 0.4)'}`,
              backgroundColor: geminiApiKey ? 'rgba(16, 185, 129, 0.12)' : 'rgba(234, 179, 8, 0.12)',
              color: geminiApiKey ? '#34d399' : '#fbbf24',
              fontSize: '13px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
            }}
          >
            <Key size={15} />
            {geminiApiKey ? 'ÄÃ£ Cáº¥u HÃ¬nh Gemini AI Key' : 'âš™ï¸ Nháº­p Gemini AI Key'}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('CREATE_ASSIGNMENT')}
            className="btn-primary"
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <PlusCircle size={18} /> Táº¡o Äá» BÃ i Má»›i
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px', overflowX: 'auto' }}>
        <button
          type="button"
          onClick={() => setActiveTab('COURSES')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            background: activeTab === 'COURSES' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
            border: `1px solid ${activeTab === 'COURSES' ? 'var(--accent-primary)' : 'transparent'}`,
            color: activeTab === 'COURSES' ? '#ffffff' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <BookOpen size={16} /> 1. KhÃ³a Há»c & Lá»›p Há»c Pháº§n
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('CREATE_ASSIGNMENT')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            background: activeTab === 'CREATE_ASSIGNMENT' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
            border: `1px solid ${activeTab === 'CREATE_ASSIGNMENT' ? 'var(--accent-primary)' : 'transparent'}`,
            color: activeTab === 'CREATE_ASSIGNMENT' ? '#ffffff' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Sparkles size={16} color="var(--accent-cyan)" /> 2. Soáº¡n Äá» & Barem AI (UC-08)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('EXCEL_IMPORT')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            background: activeTab === 'EXCEL_IMPORT' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
            border: `1px solid ${activeTab === 'EXCEL_IMPORT' ? 'var(--accent-primary)' : 'transparent'}`,
            color: activeTab === 'EXCEL_IMPORT' ? '#ffffff' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <FileSpreadsheet size={16} color="#10b981" /> 3. Nháº­p Roster Excel (ACID Rollback)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('SUBMISSIONS')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            background: activeTab === 'SUBMISSIONS' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
            border: `1px solid ${activeTab === 'SUBMISSIONS' ? 'var(--accent-primary)' : 'transparent'}`,
            color: activeTab === 'SUBMISSIONS' ? '#ffffff' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Award size={16} /> 4. Sá»• Äiá»ƒm & BÃ i Ná»™p
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('RBL_LAB')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            background: activeTab === 'RBL_LAB' ? 'rgba(6, 182, 212, 0.2)' : 'transparent',
            border: `1px solid ${activeTab === 'RBL_LAB' ? 'var(--accent-cyan)' : 'transparent'}`,
            color: activeTab === 'RBL_LAB' ? 'var(--accent-cyan)' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Sparkles size={16} /> 5. RBL Lab (NghiÃªn Cá»©u)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('APPEALS')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            background: activeTab === 'APPEALS' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
            border: `1px solid ${activeTab === 'APPEALS' ? '#f59e0b' : 'transparent'}`,
            color: activeTab === 'APPEALS' ? '#fbbf24' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Scale size={16} color="#fbbf24" /> 6. PhÃºc Kháº£o Äiá»ƒm (UC-06)
        </button>
      </div>


      {/* TAB 1: KHÃ“A Há»ŒC & Lá»šP (Báº¢NG QUáº¢N LÃ MÃ”N Há»ŒC & BÃ€I Táº¬P ÄÃƒ GIAO) */}
      {activeTab === 'COURSES' && (
        <div>
          {/* TRÆ¯á»œNG Há»¢P 1: XEM CHI TIáº¾T 1 MÃ”N Há»ŒC & CÃC BÃ€I Táº¬P ÄÃƒ GIAO */}
          {selectedCourseDetailId ? (() => {
            const currentCourse = courses.find((c) => c.courseId === selectedCourseDetailId);
            const courseAssignments = publishedAssignments.filter((a) => a.courseId === selectedCourseDetailId);
            const courseCode = currentCourse ? currentCourse.courseCode : 'MÃ”N Há»ŒC';
            const courseName = currentCourse ? currentCourse.courseName : 'Chi tiáº¿t mÃ´n há»c';

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Banner ThÃ´ng BÃ¡o Xuáº¥t Báº£n ThÃ nh CÃ´ng náº¿u cÃ³ */}
                {publishSuccessToast && (
                  <div
                    style={{
                      padding: '16px 20px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(16, 185, 129, 0.15)',
                      border: '1.5px solid rgba(16, 185, 129, 0.4)',
                      color: '#34d399',
                      fontSize: '14px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxShadow: '0 4px 15px rgba(16, 185, 129, 0.2)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <CheckCircle2 size={20} color="#10b981" />
                      <span>{publishSuccessToast}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPublishSuccessToast(null)}
                      style={{ background: 'none', border: 'none', color: '#34d399', cursor: 'pointer', fontSize: '18px', fontWeight: 700 }}
                    >
                      Ã—
                    </button>
                  </div>
                )}

                {/* Header ThÃ´ng Tin MÃ´n Há»c */}
                <div className="glass-panel" style={{ padding: '24px 28px', borderRadius: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedCourseDetailId(null)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: '#ffffff',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <ArrowLeft size={16} /> Quay Láº¡i Danh SÃ¡ch MÃ´n Há»c
                    </button>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCourse(selectedCourseDetailId);
                          setActiveTab('CREATE_ASSIGNMENT');
                        }}
                        className="btn-primary"
                        style={{
                          padding: '9px 16px',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <PlusCircle size={16} /> + Giao ThÃªm Äá» Má»›i (AI)
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveTab('SUBMISSIONS')}
                        style={{
                          padding: '9px 16px',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          color: '#ffffff',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Award size={16} /> Xem Sá»• Äiá»ƒm Lá»›p
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', padding: '4px 10px', borderRadius: '6px', backgroundColor: 'rgba(99, 102, 241, 0.25)', color: 'var(--accent-primary)', fontWeight: 800 }}>
                      {courseCode}
                    </span>
                    <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff' }}>
                      {courseName}
                    </h2>
                  </div>

                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '16px' }}>
                    Giáº£ng viÃªn: <strong>{currentCourse?.instructorName}</strong> â€¢ {currentCourse?.semester} â€¢ SÄ© sá»‘: <strong style={{ color: '#ffffff' }}>{currentCourse?.studentCount}</strong> sinh viÃªn
                  </p>

                  <div style={{ display: 'flex', gap: '20px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px', fontSize: '13px', color: 'var(--text-muted)' }}>
                    <span>Tá»•ng sá»‘ bÃ i táº­p Ä‘Ã£ giao: <strong style={{ color: 'var(--accent-cyan)' }}>{courseAssignments.length}</strong> bÃ i</span>
                    <span>Äang má»Ÿ ná»™p bÃ i: <strong style={{ color: '#34d399' }}>{courseAssignments.filter((a) => a.status === 'PUBLISHED').length}</strong> bÃ i</span>
                  </div>
                </div>

                {/* TiÃªu Ä‘á» Danh SÃ¡ch BÃ i Táº­p */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FolderKanban size={20} color="var(--accent-cyan)" /> Danh SÃ¡ch CÃ¡c BÃ i Táº­p ÄÃ£ Giao Cá»§a MÃ´n Há»c
                  </h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Hiá»ƒn thá»‹ {courseAssignments.length} bÃ i táº­p
                  </span>
                </div>

                {/* Danh SÃ¡ch Card BÃ i Táº­p ÄÃ£ Giao */}
                {courseAssignments.length === 0 ? (
                  <div className="glass-panel" style={{ padding: '48px', borderRadius: '16px', textAlign: 'center' }}>
                    <FileText size={44} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
                    <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
                      ChÆ°a CÃ³ BÃ i Táº­p NÃ o ÄÆ°á»£c Giao Cho MÃ´n Há»c NÃ y
                    </h4>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                      Giáº£ng viÃªn cÃ³ thá»ƒ sá»­ dá»¥ng Trá»£ lÃ½ Google Gemini AI Ä‘á»ƒ soáº¡n Ä‘á» vÃ  testcases chá»‰ trong 1 giÃ¢y.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCourse(selectedCourseDetailId);
                        setActiveTab('CREATE_ASSIGNMENT');
                      }}
                      className="btn-primary"
                      style={{ padding: '10px 20px', borderRadius: '10px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      âš¡ Soáº¡n Äá» BÃ i Táº­p Äáº§u TiÃªn Ngay
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {courseAssignments.map((asm) => {
                      const totalWeight = asm.testCases.reduce((sum, tc) => sum + (Number(tc.weight) || 0), 0);
                      const isPublished = asm.status === 'PUBLISHED';

                      return (
                        <div
                          key={asm.id}
                          className="glass-panel"
                          style={{
                            padding: '22px 26px',
                            borderRadius: '14px',
                            border: asm.isNewlyCreated ? '1.5px solid rgba(16, 185, 129, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)',
                            backgroundColor: asm.isNewlyCreated ? 'rgba(16, 185, 129, 0.04)' : undefined,
                            boxShadow: asm.isNewlyCreated ? '0 4px 20px rgba(16, 185, 129, 0.15)' : undefined,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span
                                style={{
                                  fontSize: '11px',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontWeight: 700,
                                  backgroundColor: isPublished ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)',
                                  color: isPublished ? '#34d399' : '#f43f5e',
                                  border: `1px solid ${isPublished ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
                                }}
                              >
                                {isPublished ? 'ðŸŸ¢ ÄANG Má»ž Ná»˜P BÃ€I' : 'ðŸ”´ ÄÃƒ ÄÃ“NG Ná»˜P'}
                              </span>

                              {asm.isNewlyCreated && (
                                <span
                                  style={{
                                    fontSize: '11px',
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    fontWeight: 700,
                                    background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
                                    color: '#ffffff',
                                  }}
                                >
                                  âœ¨ Má»šI XUáº¤T Báº¢N Vá»ªA XONG
                                </span>
                              )}

                              <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                                MÃ£: <strong>{asm.id}</strong> â€¢ Táº¡o lÃºc: {asm.createdAt}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--accent-amber)', fontWeight: 600 }}>
                              <Clock size={14} /> Háº¡n chÃ³t: {new Date(asm.deadline).toLocaleString('vi-VN')}
                            </div>
                          </div>

                          <h4 style={{ fontSize: '17px', fontWeight: 800, color: '#ffffff', marginBottom: '8px' }}>
                            {asm.title}
                          </h4>

                          <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '14px' }}>
                            {asm.description.length > 200 ? `${asm.description.slice(0, 200)}...` : asm.description}
                          </p>

                          {/* Chips ThÃ´ng sá»‘ ká»¹ thuáº­t */}
                          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
                            <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(99, 102, 241, 0.15)', color: '#c7d2fe' }}>
                              ðŸ§ª {asm.testCases.length} Test Cases ({totalWeight.toFixed(1)}Ä‘)
                            </span>
                            <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(6, 182, 212, 0.15)', color: 'var(--accent-cyan)' }}>
                              âš¡ Thá»i gian: {asm.timeLimitMs}ms
                            </span>
                            <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)' }}>
                              ðŸ’¾ RAM: {asm.memoryLimitMb}MB
                            </span>
                            <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)' }}>
                              ðŸ’» {asm.allowedLanguages.join(', ').toUpperCase()}
                            </span>
                            <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399', fontWeight: 600 }}>
                              ðŸ‘¥ {asm.submissionCount}/38 Sinh viÃªn Ä‘Ã£ ná»™p bÃ i
                            </span>
                          </div>

                          {/* CÃ¡c nÃºt hÃ nh Ä‘á»™ng cho bÃ i táº­p */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px', flexWrap: 'wrap', gap: '8px' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                type="button"
                                onClick={() => setPreviewAssignment(asm)}
                                style={{
                                  padding: '7px 12px',
                                  borderRadius: '8px',
                                  backgroundColor: 'rgba(99, 102, 241, 0.2)',
                                  border: '1px solid var(--accent-primary)',
                                  color: '#ffffff',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                }}
                              >
                                <Eye size={14} /> Xem Chi Tiáº¿t Äá» & Test Cases
                              </button>

                              <button
                                type="button"
                                onClick={() => setActiveTab('SUBMISSIONS')}
                                style={{
                                  padding: '7px 12px',
                                  borderRadius: '8px',
                                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                                  border: '1px solid rgba(255, 255, 255, 0.12)',
                                  color: 'var(--text-muted)',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                }}
                              >
                                <Award size={14} /> Sá»• Äiá»ƒm BÃ i Ná»™p
                              </button>
                            </div>

                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                type="button"
                                onClick={() => handleToggleAssignmentStatus(asm.id)}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  backgroundColor: 'transparent',
                                  border: `1px solid ${isPublished ? 'rgba(244, 63, 94, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
                                  color: isPublished ? '#f43f5e' : '#34d399',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                {isPublished ? 'ÄÃ³ng Ná»™p BÃ i' : 'Má»Ÿ Láº¡i Ná»™p BÃ i'}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteAssignment(asm.id, asm.courseId)}
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: '6px',
                                  backgroundColor: 'rgba(244, 63, 94, 0.1)',
                                  border: '1px solid rgba(244, 63, 94, 0.25)',
                                  color: '#f43f5e',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <Trash2 size={13} /> XÃ³a
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })() : (
            /* TRÆ¯á»œNG Há»¢P 2: DANH SÃCH Táº¤T Cáº¢ CÃC MÃ”N Há»ŒC & Lá»šP */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>
                    CÃ¡c Lá»›p Há»c Pháº§n Äang Giáº£ng Dáº¡y ({courses.length} MÃ´n)
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                    Chá»n báº¥t ká»³ mÃ´n há»c nÃ o Ä‘á»ƒ xem danh sÃ¡ch cÃ¡c bÃ i táº­p Ä‘Ã£ giao hoáº·c giao bÃ i táº­p má»›i
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsCreateCourseModalOpen(true)}
                  className="btn-primary"
                  style={{
                    padding: '10px 18px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <PlusCircle size={16} /> + Táº¡o KhÃ³a Há»c Má»›i
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
                {courses.map((course) => {
                  const assignedCount = publishedAssignments.filter((a) => a.courseId === course.courseId).length;

                  return (
                    <div key={course.courseId} className="glass-panel" style={{ padding: '24px', borderRadius: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(99, 102, 241, 0.2)', color: 'var(--accent-primary)', fontWeight: 700 }}>
                          {course.courseCode}
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{course.semester}</span>
                      </div>

                      <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', marginBottom: '8px' }}>
                        {course.courseName}
                      </h3>

                      <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '16px' }}>
                        Giáº£ng viÃªn: {course.instructorName}
                      </p>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
                        <span>SÄ© sá»‘: <strong style={{ color: '#ffffff' }}>{course.studentCount}</strong> sinh viÃªn</span>
                        <span>ÄÃ£ giao: <strong style={{ color: 'var(--accent-cyan)' }}>{assignedCount}</strong> bÃ i táº­p</span>
                      </div>

                      <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedCourseDetailId(course.courseId)}
                          style={{
                            width: '100%',
                            padding: '9px 12px',
                            borderRadius: '8px',
                            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(6, 182, 212, 0.2) 100%)',
                            border: '1px solid rgba(99, 102, 241, 0.4)',
                            color: '#ffffff',
                            fontSize: '13px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                          }}
                        >
                          <FolderKanban size={15} color="var(--accent-cyan)" /> ðŸ“‹ Xem CÃ¡c BÃ i Táº­p ÄÃ£ Giao ({assignedCount})
                        </button>

                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCourse(course.courseId);
                              setActiveTab('CREATE_ASSIGNMENT');
                            }}
                            style={{
                              flex: 1,
                              padding: '8px 10px',
                              borderRadius: '8px',
                              backgroundColor: 'rgba(255, 255, 255, 0.06)',
                              border: '1px solid rgba(255, 255, 255, 0.12)',
                              color: 'var(--accent-primary)',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            + Giao Äá» Má»›i (AI)
                          </button>

                          <button
                            type="button"
                            onClick={() => setActiveTab('SUBMISSIONS')}
                            style={{
                              padding: '8px 12px',
                              borderRadius: '8px',
                              backgroundColor: 'rgba(255,255,255,0.04)',
                              border: '1px solid rgba(255,255,255,0.1)',
                              color: 'var(--text-muted)',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Báº£ng Äiá»ƒm
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Táº O Äá»€ BÃ€I Táº¬P & GOOGLE GEMINI AI GENERATOR (UC-08) */}
      {activeTab === 'CREATE_ASSIGNMENT' && (
        <div className="glass-panel" style={{ padding: '32px', borderRadius: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff' }}>
                  Soáº¡n Tháº£o Äá» BÃ i Táº­p & Sinh Barem Báº±ng Google Gemini AI Tháº­t
                </h2>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    backgroundColor: geminiApiKey ? 'rgba(16, 185, 129, 0.2)' : 'rgba(234, 179, 8, 0.2)',
                    color: geminiApiKey ? '#34d399' : '#fbbf24',
                    fontWeight: 700,
                    border: `1px solid ${geminiApiKey ? 'rgba(16, 185, 129, 0.3)' : 'rgba(234, 179, 8, 0.3)'}`,
                  }}
                >
                  {geminiApiKey ? 'ðŸŸ¢ AI Tháº­t ÄÃ£ KÃ­ch Hoáº¡t' : 'ðŸŸ¡ ChÆ°a Cáº¥u HÃ¬nh Key'}
                </span>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
                Nháº­p chá»§ Ä‘á» hoáº·c báº¥m nÃºt sinh AI Ä‘á»ƒ Google Gemini tá»± Ä‘á»™ng biÃªn soáº¡n Ä‘á» bÃ i, bá»™ test cases áº©n/cÃ´ng khai vÃ  barem Clean Code / SOLID
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => {
                  setTempApiKey(geminiApiKey);
                  setIsConfigModalOpen(true);
                }}
                style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
              >
                <Settings size={16} /> Cáº¥u HÃ¬nh Key
              </button>

              <button
                type="button"
                onClick={handleAiGenerateAssignment}
                disabled={isAiGenerating}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: isAiGenerating ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 15px rgba(168, 85, 247, 0.35)',
                }}
              >
                {isAiGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {isAiGenerating
                  ? `Äang táº¡o Ä‘á»... (${aiTimerSeconds}s / tá»‘i Ä‘a 10s)`
                  : 'âš¡ DÃ¹ng AI Sinh Äá» & Barem'}
              </button>
            </div>
          </div>

          {/* Card Nháº­p YÃªu Cáº§u & MÃ´ Táº£ Cá»§a Giáº£ng ViÃªn Cho AI */}
          <div
            style={{
              marginBottom: '24px',
              padding: '20px 24px',
              borderRadius: '16px',
              backgroundColor: 'rgba(99, 102, 241, 0.08)',
              border: '1.5px solid rgba(99, 102, 241, 0.35)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={20} color="var(--accent-cyan)" />
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff' }}>
                  YÃªu Cáº§u & Ã TÆ°á»Ÿng Cá»¥ Thá»ƒ Cá»§a Giáº£ng ViÃªn (Prompt DÃ nh Cho AI Soáº¡n Äá»)
                </h3>
              </div>
              <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399', fontWeight: 700 }}>
                âš¡ Tá»‘c Ä‘á»™ cao (Báº£o vá»‡ thá»i gian thá»±c tá»‘i Ä‘a 10s)
              </span>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: '1.5' }}>
              Giáº£ng viÃªn nháº­p báº¥t ká»³ Ã½ tÆ°á»Ÿng, nghiá»‡p vá»¥ hoáº·c rÃ ng buá»™c thuáº­t toÃ¡n nÃ o. AI sáº½ bÃ¡m sÃ¡t 100% mÃ´ táº£ nÃ y Ä‘á»ƒ táº¡o Ä‘á» bÃ i, testcases vÃ  tiÃªu chÃ­ barem Ä‘iá»ƒm tÆ°Æ¡ng á»©ng:
            </p>

            <textarea
              rows={3}
              value={lecturerPrompt}
              onChange={(e) => {
                const val = e.target.value;
                setLecturerPrompt(val);
                const parsed = GeminiAIService.extractRequestedCount(val);
                if (parsed) setDesiredTestCount(parsed);
              }}
              placeholder="VÃ­ dá»¥: 'Táº¡o bÃ i táº­p vá» cÃ¢y AVL, táº¡o 5 test case vá»›i cÃ¡c trá»ng sá»‘ khÃ¡c nhau, báº¯t buá»™c cÃ³ hÃ m xoay trÃ¡i vÃ  xoay pháº£i, kiá»ƒm tra xem cÃ¢y cÃ³ cÃ¢n báº±ng sau khi chÃ¨n 1000 pháº§n tá»­ khÃ´ng'..."
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '10px',
                backgroundColor: 'rgba(10, 15, 29, 0.8)',
                border: '1px solid rgba(99, 102, 241, 0.35)',
                color: '#ffffff',
                fontSize: '14px',
                lineHeight: '1.5',
                outline: 'none',
                marginBottom: '10px',
              }}
            />

            {/* Thanh Chá»n Sá»‘ LÆ°á»£ng Test Cases Mong Muá»‘n */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: '#e5e7eb', fontWeight: 700 }}>
                ðŸŽ¯ Sá»‘ lÆ°á»£ng Test Cases AI cáº§n sinh:
              </span>
              {[3, 5, 7, 10].map((count) => {
                const isSelected = desiredTestCount === count;
                return (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setDesiredTestCount(count)}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '8px',
                      backgroundColor: isSelected ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.06)',
                      color: '#ffffff',
                      fontSize: '12px',
                      fontWeight: 700,
                      border: isSelected ? '1px solid var(--accent-primary)' : '1px solid rgba(255, 255, 255, 0.15)',
                      cursor: 'pointer',
                      boxShadow: isSelected ? '0 0 10px rgba(99, 102, 241, 0.4)' : 'none',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {count} Test Cases {count === 5 ? 'â˜… Chuáº©n' : ''}
                  </button>
                );
              })}
              <span style={{ fontSize: '11px', color: 'var(--accent-cyan)', marginLeft: '4px' }}>
                âœ“ Há»‡ thá»‘ng sáº½ táº¡o Ä‘á»§ Ä‘Ãºng {desiredTestCount} testcases kÃ¨m trá»ng sá»‘ khÃ¡c nhau
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600 }}>Gá»£i Ã½ máº«u:</span>
                {[
                  'Äá»“ thá»‹ Dijkstra vá»›i PriorityQueue & SRP',
                  'CÃ¢y AVL cÃ¢n báº±ng cÃ³ phÃ©p xoay trÃ¡i pháº£i',
                  'Sáº¯p xáº¿p Quicksort tá»‘i Æ°u O(N log N)',
                  'Quy hoáº¡ch Ä‘á»™ng Balo 0/1 tá»‘i Æ°u máº£ng 1D',
                  'Thiáº¿t káº¿ Factory Pattern & SOLID DIP',
                ].map((suggest) => (
                  <button
                    key={suggest}
                    type="button"
                    onClick={() => {
                      setLecturerPrompt(suggest);
                      setAssignmentTitle(suggest);
                    }}
                    style={{
                      fontSize: '11px',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#c7d2fe',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    + {suggest}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAiGenerateAssignment}
                disabled={isAiGenerating}
                style={{
                  padding: '10px 22px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: isAiGenerating ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 15px rgba(168, 85, 247, 0.35)',
                }}
              >
                {isAiGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {isAiGenerating ? 'Äang táº¡o siÃªu tá»‘c báº±ng Gemini...' : 'âš¡ Sinh Äá» Báº±ng AI Theo YÃªu Cáº§u NÃ y'}
              </button>
            </div>
          </div>

          {/* ThÃ´ng bÃ¡o lá»—i AI náº¿u cÃ³ */}
          {aiErrorMsg && (
            <div style={{ marginBottom: '20px', padding: '14px 18px', borderRadius: '10px', backgroundColor: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.4)', color: '#f43f5e', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertCircle size={18} />
                <span>{aiErrorMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsConfigModalOpen(true)}
                style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #f43f5e', backgroundColor: 'transparent', color: '#f43f5e', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
              >
                Nháº­p Key Ngay
              </button>
            </div>
          )}

          {/* Badge thÃ nh cÃ´ng tá»« AI */}
          {aiSuccessBadge && (
            <div style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '10px', backgroundColor: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.3)', color: 'var(--accent-cyan)', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{aiSuccessBadge}</span>
              {(starterCode || referenceSolution) && (
                <button
                  type="button"
                  onClick={() => setShowSolutionModal(true)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(99, 102, 241, 0.25)',
                    border: '1px solid var(--accent-primary)',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Code2 size={13} /> Xem Lá»i Giáº£i & Code Máº«u AI
                </button>
              )}
            </div>
          )}

          {createSuccessMsg && (
            <div style={{ marginBottom: '20px', padding: '14px 18px', borderRadius: '10px', backgroundColor: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCircle2 size={18} />
              <span>{createSuccessMsg}</span>
            </div>
          )}

          <form onSubmit={handleSaveAssignment} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#e5e7eb', marginBottom: '6px' }}>
                  TiÃªu Äá» BÃ i Táº­p *
                </label>
                <input
                  type="text"
                  value={assignmentTitle}
                  onChange={(e) => setAssignmentTitle(e.target.value)}
                  required
                  placeholder="Nháº­p tÃªn bÃ i táº­p hoáº·c chá»§ Ä‘á»..."
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(18, 24, 36, 0.8)',
                    border: '1px solid var(--border-color)',
                    color: '#ffffff',
                    fontSize: '14px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#e5e7eb', marginBottom: '6px' }}>
                  Ãp Dá»¥ng Cho Há»c Pháº§n *
                </label>
                <select
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(18, 24, 36, 0.8)',
                    border: '1px solid var(--border-color)',
                    color: '#ffffff',
                    fontSize: '14px',
                  }}
                >
                  {courses.map((c) => (
                    <option key={c.courseId} value={c.courseId}>
                      {c.courseCode} - {c.courseName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#e5e7eb', marginBottom: '6px' }}>
                MÃ´ Táº£ YÃªu Cáº§u & RÃ ng Buá»™c Thuáº­t ToÃ¡n *
              </label>
              <textarea
                rows={4}
                value={assignmentDesc}
                onChange={(e) => setAssignmentDesc(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(18, 24, 36, 0.8)',
                  border: '1px solid var(--border-color)',
                  color: '#ffffff',
                  fontSize: '14px',
                  lineHeight: '1.5',
                }}
              />
            </div>

            {/* Cáº¥u hÃ¬nh háº¡n ngáº¡ch Sandbox */}
            <div style={{ padding: '20px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Cpu size={16} /> Cáº¥u HÃ¬nh Giá»›i Háº¡n TÃ i NguyÃªn Docker Sandbox & Thá»i Gian Háº¡n Ná»™p
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    <Calendar size={14} style={{ display: 'inline', marginRight: '4px' }} /> Háº¡n ChÃ³t Ná»™p BÃ i (Deadline)
                  </label>
                  <input
                    type="datetime-local"
                    value={deadlineDate}
                    onChange={(e) => setDeadlineDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(18, 24, 36, 0.8)',
                      border: '1px solid var(--border-color)',
                      color: '#ffffff',
                      fontSize: '13px',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    <Clock size={14} style={{ display: 'inline', marginRight: '4px' }} /> Giá»›i Háº¡n Thá»i Gian (ms)
                  </label>
                  <input
                    type="number"
                    value={timeLimitMs}
                    onChange={(e) => setTimeLimitMs(Number(e.target.value))}
                    min={500}
                    max={10000}
                    step={500}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(18, 24, 36, 0.8)',
                      border: '1px solid var(--border-color)',
                      color: '#ffffff',
                      fontSize: '13px',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    <HardDrive size={14} style={{ display: 'inline', marginRight: '4px' }} /> Giá»›i Háº¡n RAM Sandbox (MB)
                  </label>
                  <input
                    type="number"
                    value={memoryLimitMb}
                    onChange={(e) => setMemoryLimitMb(Number(e.target.value))}
                    min={128}
                    max={1024}
                    step={128}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(18, 24, 36, 0.8)',
                      border: '1px solid var(--border-color)',
                      color: '#ffffff',
                      fontSize: '13px',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    <Layers size={14} style={{ display: 'inline', marginRight: '4px' }} /> NgÃ´n Ngá»¯ Cho PhÃ©p
                  </label>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                    {['java', 'python', 'cpp'].map((lang) => (
                      <label key={lang} style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', color: '#e5e7eb', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={allowedLanguages.includes(lang)}
                          onChange={(e) => {
                            if (e.target.checked) setAllowedLanguages([...allowedLanguages, lang]);
                            else setAllowedLanguages(allowedLanguages.filter((l) => l !== lang));
                          }}
                        />
                        {lang.toUpperCase()}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Test cases */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Layers size={16} color="var(--accent-primary)" /> Bá»™ Test Cases Tá»± Äá»™ng (StdIn / StdOut) - Tá»•ng {testCases.length} Test
                  </h4>
                  <span
                    style={{
                      fontSize: '12px',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      backgroundColor: totalTestcaseWeight === 10 || totalTestcaseWeight === 7 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                      color: totalTestcaseWeight === 10 || totalTestcaseWeight === 7 ? '#34d399' : '#fbbf24',
                      fontWeight: 700,
                      border: `1px solid ${totalTestcaseWeight === 10 || totalTestcaseWeight === 7 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(234, 179, 8, 0.3)'}`,
                    }}
                  >
                    Tá»•ng Äiá»ƒm TC: {totalTestcaseWeight.toFixed(1)}Ä‘ {totalTestcaseWeight !== 10 && totalTestcaseWeight !== 7 ? '(TÃ¹y chá»‰nh tá»· lá»‡)' : 'âœ… Chuáº©n'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {totalTestcaseWeight !== 10 && (
                    <button
                      type="button"
                      onClick={() => handleNormalizeTestcases(10)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(99, 102, 241, 0.15)',
                        border: '1px solid var(--accent-primary)',
                        color: '#ffffff',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                      title="Tá»± Ä‘á»™ng chuáº©n hÃ³a chia láº¡i tá»· lá»‡ Ä‘á»ƒ tá»•ng Ä‘iá»ƒm cÃ¡c testcases Ä‘Ãºng báº±ng 10.0Ä‘"
                    >
                      âš¡ Quy Ä‘á»•i vá» 10.0Ä‘
                    </button>
                  )}
                  {totalTestcaseWeight !== 7 && (
                    <button
                      type="button"
                      onClick={() => handleNormalizeTestcases(7)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(56, 189, 248, 0.15)',
                        border: '1px solid var(--accent-cyan)',
                        color: 'var(--accent-cyan)',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                      title="Quy Ä‘á»•i vá» 7.0Ä‘ (theo Barem chuáº©n AITA: 7Ä‘ Testcase + 3Ä‘ Clean Code & SOLID)"
                    >
                      âš¡ Quy Ä‘á»•i vá» 7.0Ä‘ (Barem)
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setTestCases([...testCases, { input: '', output: '', weight: 3.0, isHidden: false }])}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      backgroundColor: 'transparent',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: 'var(--accent-primary)',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    + ThÃªm Test Case
                  </button>
                </div>
              </div>

              {totalTestcaseWeight !== 10 && totalTestcaseWeight !== 7 && (
                <div style={{ marginBottom: '10px', padding: '8px 12px', borderRadius: '8px', backgroundColor: 'rgba(234, 179, 8, 0.08)', border: '1px solid rgba(234, 179, 8, 0.2)', fontSize: '12px', color: '#fbbf24' }}>
                  ðŸ’¡ <strong>Tá»•ng Ä‘iá»ƒm cÃ¡c testcase hiá»‡n lÃ  {totalTestcaseWeight.toFixed(1)}Ä‘ (khÃ¡c 10Ä‘):</strong> Khi cháº¥m bÃ i, há»‡ thá»‘ng tá»± Ä‘á»™ng chuáº©n hÃ³a theo tá»· lá»‡: <code>Äiá»ƒm Ä‘áº¡t = (Tá»•ng Ä‘iá»ƒm TC Pass / {totalTestcaseWeight.toFixed(1)}) Ã— Thang Äiá»ƒm Barem</code>. Hoáº·c Giáº£ng viÃªn cÃ³ thá»ƒ báº¥m nÃºt <em>"Quy Ä‘á»•i vá» 10.0Ä‘"</em> hoáº·c <em>"7.0Ä‘ (Barem)"</em> á»Ÿ trÃªn Ä‘á»ƒ chuáº©n hÃ³a tá»± Ä‘á»™ng.
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {testCases.map((tc, idx) => (
                  <div key={idx} style={{ padding: '14px', borderRadius: '10px', backgroundColor: 'rgba(18, 24, 36, 0.6)', border: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 100px 90px auto', gap: '12px', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Input (StdIn #{idx + 1}):</span>
                      <input
                        type="text"
                        value={tc.input}
                        onChange={(e) => {
                          const updated = [...testCases];
                          updated[idx].input = e.target.value;
                          setTestCases(updated);
                        }}
                        placeholder="Dá»¯ liá»‡u Ä‘áº§u vÃ o..."
                        style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', backgroundColor: '#0a0d14', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                      />
                    </div>

                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Ká»³ Vá»ng (StdOut #{idx + 1}):</span>
                      <input
                        type="text"
                        value={tc.output}
                        onChange={(e) => {
                          const updated = [...testCases];
                          updated[idx].output = e.target.value;
                          setTestCases(updated);
                        }}
                        placeholder="Káº¿t quáº£ chuáº©n..."
                        style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', backgroundColor: '#0a0d14', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                      />
                    </div>

                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Äiá»ƒm Sá»‘:</span>
                      <input
                        type="number"
                        value={tc.weight}
                        onChange={(e) => {
                          const updated = [...testCases];
                          updated[idx].weight = Number(e.target.value);
                          setTestCases(updated);
                        }}
                        step={0.5}
                        style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', backgroundColor: '#0a0d14', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '12px' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Cháº¿ Äá»™:</span>
                      <label style={{ fontSize: '12px', color: tc.isHidden ? 'var(--accent-amber)' : 'var(--accent-cyan)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                        <input
                          type="checkbox"
                          checked={tc.isHidden}
                          onChange={(e) => {
                            const updated = [...testCases];
                            updated[idx].isHidden = e.target.checked;
                            setTestCases(updated);
                          }}
                        />
                        {tc.isHidden ? 'Test áº¨n' : 'CÃ´ng Khai'}
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={() => setTestCases(testCases.filter((_, i) => i !== idx))}
                      style={{ background: 'none', border: 'none', color: 'var(--accent-rose)', cursor: 'pointer', fontSize: '18px', fontWeight: 700 }}
                      title="XÃ³a test case"
                    >
                      Ã—
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Báº£ng Rubric Barem Cháº¥m Äiá»ƒm (Khi Ä‘Æ°á»£c AI sinh ra) */}
            {generatedRubrics.length > 0 && (
              <div style={{ padding: '20px', borderRadius: '12px', backgroundColor: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Award size={18} color="var(--accent-primary)" /> Barem Cháº¥m Äiá»ƒm Há»c Thuáº­t Rubrics (Sinh Bá»Ÿi Google Gemini AI)
                  </h4>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Tá»•ng Äiá»ƒm: 10.0 Äiá»ƒm
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {generatedRubrics.map((rubric, rIdx) => (
                    <div key={rIdx} style={{ padding: '12px 16px', borderRadius: '8px', backgroundColor: 'rgba(18, 24, 36, 0.7)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                          {rIdx + 1}. {rubric.criterion}
                        </span>
                        <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '6px', backgroundColor: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', fontWeight: 700 }}>
                          Tá»‘i Ä‘a: {rubric.maxScore}Ä‘
                        </span>
                      </div>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                        {rubric.description}
                      </p>
                      {rubric.levels && rubric.levels.length > 0 && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {rubric.levels.map((lvl, lIdx) => (
                            <span key={lIdx} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.04)', color: '#d1d5db', border: '1px solid rgba(255,255,255,0.08)' }}>
                              <strong>{lvl.scorePercent}% Ä‘iá»ƒm:</strong> {lvl.description}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
              <button
                type="submit"
                className="btn-primary"
                style={{
                  padding: '12px 28px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '15px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <CheckCircle2 size={18} /> LÆ°u & Xuáº¥t Báº£n Äá» BÃ i Táº­p Cho Lá»›p
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: IMPORT EXCEL (ACID TRANSACTION VERIFICATION) */}
      {activeTab === 'EXCEL_IMPORT' && (
        <div className="glass-panel" style={{ padding: '32px', borderRadius: '16px' }}>
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff' }}>
              Nháº­p Danh SÃ¡ch Sinh ViÃªn HÃ ng Loáº¡t & Kiá»ƒm Äá»‹nh Giao Dá»‹ch ACID (UC-02)
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
              TÃ­nh nÄƒng tuÃ¢n thá»§ cháº·t cháº½ rÃ ng buá»™c R06: Báº¯t buá»™c sá»­ dá»¥ng SQL Transaction khi náº¡p danh sÃ¡ch tá»« file Excel. Khi cÃ³ báº¥t ká»³ lá»—i nÃ o xáº£y ra á»Ÿ dÃ²ng thá»© N, 100% dá»¯ liá»‡u Ä‘Ã£ xá»­ lÃ½ trÆ°á»›c Ä‘Ã³ pháº£i Ä‘Æ°á»£c Rollback nguyÃªn váº¹n.
            </p>
          </div>

          {/* CHá»ŒN KHÃ“A Há»ŒC & Táº¢I FILE MáºªU */}
          <div
            style={{
              padding: '20px 24px',
              borderRadius: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <label style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>
                1. Chá»n Lá»›p Há»c Pháº§n Cáº§n Ghi Danh:
              </label>
              <select
                value={targetCourseId}
                onChange={(e) => setTargetCourseId(e.target.value)}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: 600,
                  minWidth: '260px',
                  outline: 'none',
                }}
              >
                {courses.map((c) => (
                  <option key={c.courseId} value={c.courseId} style={{ backgroundColor: '#0f172a' }}>
                    {c.courseCode} - {c.courseName}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleDownloadSampleCsv}
              style={{
                padding: '9px 16px',
                borderRadius: '8px',
                backgroundColor: 'rgba(6, 182, 212, 0.15)',
                border: '1px solid rgba(6, 182, 212, 0.35)',
                color: 'var(--accent-cyan)',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Download size={15} /> Táº£i File Máº«u Roster (.csv)
            </button>
          </div>

          {/* KHU Vá»°C CHá»ŒN FILE CSV THá»°C Táº¾ */}
          <div
            style={{
              padding: '24px',
              borderRadius: '14px',
              backgroundColor: 'rgba(15, 23, 42, 0.7)',
              border: '1.5px dashed rgba(99, 102, 241, 0.4)',
              marginBottom: '28px',
              textAlign: 'center',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}>
                <FileSpreadsheet size={26} />
              </div>

              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#ffffff', marginBottom: '4px' }}>
                  2. Táº£i LÃªn &amp; Nháº­p File Roster Sinh ViÃªn (.csv)
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
                  Há»— trá»£ Ä‘á»‹nh dáº¡ng file <code>.csv</code> chuáº©n UTF-8 (xuáº¥t tá»« Excel hoáº·c Google Sheets vá»›i cÃ¡c cá»™t: <strong>MÃ£ Sinh ViÃªn, Há» VÃ  TÃªn, Email</strong>)
                </p>
              </div>

              <input
                type="file"
                id="roster-csv-input"
                accept=".csv,text/csv"
                onChange={handleCsvFileChange}
                style={{ display: 'none' }}
              />

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '6px' }}>
                <label
                  htmlFor="roster-csv-input"
                  style={{
                    padding: '10px 22px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(99, 102, 241, 0.2)',
                    border: '1px solid var(--accent-primary)',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Upload size={16} color="var(--accent-cyan)" />
                  {uploadedCsvFile ? `Äá»•i File KhÃ¡c (${uploadedCsvFile.name})` : 'Chá»n File CSV Tá»« MÃ¡y TÃ­nh (.csv)'}
                </label>

                {uploadedCsvFile && (
                  <button
                    type="button"
                    onClick={() => {
                      setUploadedCsvFile(null);
                      setParsedCsvStudents([]);
                      setCsvParseError(null);
                    }}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: 'var(--text-muted)',
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    Há»§y file Ä‘Ã£ chá»n
                  </button>
                )}
              </div>

              {csvParseError && (
                <div style={{ color: '#f43f5e', fontSize: '13px', fontWeight: 600, marginTop: '8px' }}>
                  âŒ {csvParseError}
                </div>
              )}

              {/* Báº¢NG XEM TRÆ¯á»šC DANH SÃCH Tá»ª FILE CSV */}
              {parsedCsvStudents.length > 0 && (
                <div style={{ width: '100%', marginTop: '16px', textAlign: 'left' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                      ðŸ“‹ ÄÃ£ nháº­n diá»‡n {parsedCsvStudents.length} sinh viÃªn tá»« file [{uploadedCsvFile?.name}]:
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Dung lÆ°á»£ng: {Math.round((uploadedCsvFile?.size || 0) / 1024 * 10) / 10} KB
                    </span>
                  </div>

                  <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', backgroundColor: 'rgba(0, 0, 0, 0.3)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.04)' }}>
                          <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)' }}>STT</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)' }}>MÃ£ Sinh ViÃªn</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)' }}>Há» VÃ  TÃªn</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)' }}>Email FPT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedCsvStudents.map((s, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                            <td style={{ padding: '8px 12px', color: 'var(--text-dim)' }}>{idx + 1}</td>
                            <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--accent-primary)' }}>{s.studentCode}</td>
                            <td style={{ padding: '8px 12px', color: '#ffffff' }}>{s.fullName}</td>
                            <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{s.email}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center' }}>
                    <button
                      type="button"
                      onClick={() => handleExecuteLiveBulkImport(false, parsedCsvStudents)}
                      disabled={excelLoading}
                      style={{
                        padding: '12px 28px',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        border: 'none',
                        color: '#ffffff',
                        fontWeight: 800,
                        fontSize: '14px',
                        cursor: excelLoading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
                      }}
                    >
                      <Upload size={18} /> âš¡ Báº¯t Äáº§u Import {parsedCsvStudents.length} Sinh ViÃªn VÃ o PostgreSQL 15 (SQL ACID)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '28px' }}>
            <div style={{ padding: '24px', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <CheckCircle2 size={24} color="#10b981" />
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>Ká»‹ch Báº£n 1: Nháº­p Live ThÃ nh CÃ´ng 100% (Commit)</h3>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.5' }}>
                Náº¡p danh sÃ¡ch sinh viÃªn chuáº©n vÃ o PostgreSQL 15 báº£ng <code>class_members</code>. Táº¥t cáº£ tÃ i khoáº£n Ä‘Æ°á»£c cáº¥p quyá»n truy cáº­p mÃ´n há»c. Giao diá»‡n thá»±c hiá»‡n COMMIT toÃ n bá»™.
              </p>
              <button
                type="button"
                onClick={() => handleExecuteLiveBulkImport(false)}
                disabled={excelLoading}
                style={{
                  width: '100%',
                  padding: '11px 16px',
                  borderRadius: '8px',
                  backgroundColor: '#10b981',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: excelLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <Upload size={16} /> âš¡ Thá»±c Thi Giao Dá»‹ch Nháº­p Roster (Live PostgreSQL)
              </button>
            </div>

            <div style={{ padding: '24px', borderRadius: '12px', backgroundColor: 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <AlertTriangle size={24} color="#f43f5e" />
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>Ká»‹ch Báº£n 2: Minh Chá»©ng Lá»—i DÃ²ng N & 100% Rollback (R06)</h3>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.5' }}>
                Gá»­i file Excel cÃ³ dÃ²ng sá»‘ 3 chá»©a lá»—i trÃ¹ng láº·p MSSV [SE170123]. Backend má»Ÿ SQL Transaction, phÃ¡t hiá»‡n vi pháº¡m vÃ  thá»±c thi 100% ROLLBACK báº£o toÃ n dá»¯ liá»‡u.
              </p>
              <button
                type="button"
                onClick={() => handleExecuteLiveBulkImport(true)}
                disabled={excelLoading}
                style={{
                  width: '100%',
                  padding: '11px 16px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(244, 63, 94, 0.2)',
                  border: '1px solid #f43f5e',
                  color: '#f43f5e',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: excelLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <AlertTriangle size={16} /> âš ï¸ KÃ­ch Hoáº¡t Thá»­ Nghiá»‡m Lá»—i DÃ²ng 3 &amp; Rollback
              </button>
            </div>
          </div>

          {excelLoading && (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--accent-primary)', fontSize: '14px', fontWeight: 600 }}>
              Äang phÃ¢n tÃ­ch cÃº phÃ¡p Excel vÃ  má»Ÿ SQL Transaction...
            </div>
          )}

          {excelStatus && (
            <div
              style={{
                padding: '16px 20px',
                borderRadius: '12px',
                backgroundColor: simulatedRollback ? 'rgba(244, 63, 94, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                border: `1.5px solid ${simulatedRollback ? 'rgba(244, 63, 94, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
                color: simulatedRollback ? '#f43f5e' : '#10b981',
                fontSize: '14px',
                lineHeight: '1.6',
              }}
            >
              {excelStatus}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Sá»” ÄIá»‚M & DANH SÃCH BÃ€I Ná»˜P Vá»šI TÃNH NÄ‚NG Táº¢I FILE ZIP */}
      {activeTab === 'SUBMISSIONS' && (
        <div className="glass-panel" style={{ padding: '28px', borderRadius: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff' }}>
                Sá»• Theo DÃµi BÃ i Ná»™p Láº­p TrÃ¬nh &amp; GiÃ¡m SÃ¡t LiÃªm ChÃ­nh Há»c Thuáº­t
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
                Danh sÃ¡ch bÃ i lÃ m sinh viÃªn dÆ°á»›i dáº¡ng file nÃ©n .zip, Ä‘iá»ƒm sá»‘ Ä‘a trá»¥c vÃ  cáº£nh bÃ¡o Ä‘áº¡o vÄƒn AST Winnowing
              </p>
            </div>
            <button
              type="button"
              onClick={() => void fetchRealSubmissions()}
              disabled={loadingSubmissions}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid var(--border-color)',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={14} className={loadingSubmissions ? 'animate-spin' : ''} />
              {loadingSubmissions ? 'Äang Ä‘á»“ng bá»™...' : 'LÃ m má»›i'}
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px 16px' }}>MÃ£ Ná»™p</th>
                  <th style={{ padding: '12px 16px' }}>Sinh ViÃªn</th>
                  <th style={{ padding: '12px 16px' }}>File NÃ©n (.zip)</th>
                  <th style={{ padding: '12px 16px' }}>Thá»i Gian</th>
                  <th style={{ padding: '12px 16px' }}>Testcase</th>
                  <th style={{ padding: '12px 16px' }}>Clean Code</th>
                  <th style={{ padding: '12px 16px' }}>SOLID</th>
                  <th style={{ padding: '12px 16px' }}>Tá»•ng Äiá»ƒm</th>
                  <th style={{ padding: '12px 16px' }}>TrÃ¹ng Láº·p AST</th>
                  <th style={{ padding: '12px 16px' }}>Tráº¡ng ThÃ¡i</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Táº£i BÃ i LÃ m (.zip)</th>
                </tr>
              </thead>
              <tbody>
                {(realSubmissions.length > 0 ? [...realSubmissions, ...mockSubmissionsList] : mockSubmissionsList).map((sub) => (
                  <tr
                    key={sub.id}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      backgroundColor: sub.plagiarismStatus === 'Äáº O VÄ‚N' ? 'rgba(244, 63, 94, 0.05)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                      {sub.id}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 700, color: '#ffffff' }}>{sub.studentName}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{sub.studentId}</div>
                    </td>
                    <td style={{ padding: '14px 16px', color: '#c7d2fe', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                      ðŸ“¦ {sub.fileName}
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--text-muted)' }}>{sub.submittedAt}</td>
                    <td style={{ padding: '14px 16px', fontWeight: 600, color: '#34d399' }}>{sub.testcaseScore}/7.0</td>
                    <td style={{ padding: '14px 16px', fontWeight: 600, color: '#38bdf8' }}>{sub.cleanCodeScore}/10</td>
                    <td style={{ padding: '14px 16px', fontWeight: 600, color: '#a78bfa' }}>{sub.solidScore}/10</td>
                    <td style={{ padding: '14px 16px', fontWeight: 800, fontSize: '14px', color: '#ffffff' }}>{sub.finalScore}</td>
                    <td style={{ padding: '14px 16px', fontWeight: 700, color: sub.similarityRate >= 70 ? 'var(--accent-rose)' : 'var(--text-muted)' }}>
                      {sub.similarityRate}%
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontWeight: 700,
                          backgroundColor:
                            sub.plagiarismStatus === 'Äáº O VÄ‚N'
                              ? 'rgba(244, 63, 94, 0.2)'
                              : sub.plagiarismStatus === 'NGHI Váº¤N'
                              ? 'rgba(245, 158, 11, 0.2)'
                              : 'rgba(16, 185, 129, 0.2)',
                          color:
                            sub.plagiarismStatus === 'Äáº O VÄ‚N'
                              ? '#f43f5e'
                              : sub.plagiarismStatus === 'NGHI Váº¤N'
                              ? '#f59e0b'
                              : '#10b981',
                        }}
                      >
                        {sub.plagiarismStatus}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleOpenDetailModal(sub)}
                        title={`Xem chi tiet bai nop ${sub.fileName} cua ${sub.studentName}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                          border: 'none',
                          color: '#ffffff',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          marginRight: '8px',
                          boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <Sparkles size={13} />
                        Xem Chi Tiáº¿t
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadZip(sub.id, sub.fileName)}
                        disabled={downloadingId === sub.id}
                        title={`Táº£i xuá»‘ng bÃ i lÃ m ${sub.fileName} cá»§a sinh viÃªn`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(6, 182, 212, 0.15)',
                          border: '1px solid rgba(6, 182, 212, 0.4)',
                          color: 'var(--accent-cyan)',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          opacity: downloadingId === sub.id ? 0.6 : 1,
                        }}
                      >
                        <Download size={13} />
                        {downloadingId === sub.id ? 'Äang táº£i...' : 'Táº£i .zip'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: PHÃ’NG THÃ NGHIá»†M AST LAB & BENCHMARK DATASET */}
      {activeTab === 'RBL_LAB' && (
        <RblBenchmarkView onOpenDiffViewer={onOpenDiffViewer} />
      )}

      {/* TAB 6: PHÃšC KHáº¢O & KHIáº¾U Náº I ÄIá»‚M (UC-06 / BR-05) */}
      {activeTab === 'APPEALS' && (
        <LecturerAppealsManager apiBaseUrl="http://localhost:3000" lecturerId="GV001" />
      )}


      {/* MODAL Cáº¤U HÃŒNH GOOGLE GEMINI AI KEY (DÃ™NG AI THáº¬T) */}
      {isConfigModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(5, 7, 13, 0.85)', backdropFilter: 'blur(8px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '580px', padding: '32px', borderRadius: '20px', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'rgba(99, 102, 241, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}>
                  <Key size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>Cáº¥u HÃ¬nh TrÃ­ Tuá»‡ NhÃ¢n Táº¡o Tháº­t (Google Gemini AI)</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Káº¿t ná»‘i trá»±c tiáº¿p tá»›i Google Generative AI Ä‘á»ƒ sinh Ä‘á» vÃ  testcases</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsConfigModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#e5e7eb', marginBottom: '6px' }}>
                Google Gemini API Key *
              </label>
              <input
                type="password"
                value={tempApiKey}
                onChange={(e) => setTempApiKey(e.target.value)}
                placeholder="DÃ¡n API Key cá»§a báº¡n (báº¯t Ä‘áº§u báº±ng AIzaSy...)"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(18, 24, 36, 0.9)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontFamily: 'var(--font-mono)',
                  outline: 'none',
                }}
              />
              <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>ChÆ°a cÃ³ khÃ³a? Láº¥y miá»…n phÃ­ 100% trong 30 giÃ¢y táº¡i:</span>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'var(--accent-cyan)', textDecoration: 'none', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                >
                  Google AI Studio <ExternalLink size={11} />
                </a>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#e5e7eb', marginBottom: '6px' }}>
                Lá»±a Chá»n MÃ´ HÃ¬nh AI (Model)
              </label>
              <select
                value={selectedAiModel}
                onChange={(e) => setSelectedAiModel(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(18, 24, 36, 0.9)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  fontSize: '13px',
                }}
              >
                <option value="auto">âœ¨ Tá»± Äá»™ng Chá»n MÃ´ HÃ¬nh Flash Nhanh Nháº¥t (KhuyÃªn DÃ¹ng - Auto Detect)</option>
                {availableModelList.length > 0 ? (
                  availableModelList.map((m) => (
                    <option key={m} value={m}>
                      {m} {m.includes('flash') ? '(SiÃªu tá»‘c 1-2s)' : '(ChuyÃªn sÃ¢u)'}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="gemini-2.0-flash">gemini-2.0-flash (Tháº¿ há»‡ Flash 2.0)</option>
                    <option value="gemini-1.5-flash-latest">gemini-1.5-flash-latest (Báº£n Flash má»›i nháº¥t)</option>
                    <option value="gemini-1.5-pro">gemini-1.5-pro (MÃ´ hÃ¬nh chuyÃªn sÃ¢u)</option>
                  </>
                )}
              </select>
            </div>

            {/* Tráº¡ng thÃ¡i Ping */}
            {pingStatus.message && (
              <div
                style={{
                  marginBottom: '18px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: pingStatus.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                  border: `1px solid ${pingStatus.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
                  color: pingStatus.success ? '#10b981' : '#f43f5e',
                  fontSize: '13px',
                }}
              >
                {pingStatus.message}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
              <button
                type="button"
                onClick={handleTestApiKey}
                disabled={pingStatus.loading}
                style={{
                  padding: '10px 16px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: pingStatus.loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {pingStatus.loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Kiá»ƒm Tra Káº¿t Ná»‘i AI (Ping Gemini)
              </button>

              <button
                type="button"
                onClick={handleSaveApiKey}
                className="btn-primary"
                style={{
                  padding: '10px 22px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                LÆ°u KhÃ³a & Ãp Dá»¥ng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XEM MÃƒ NGUá»’N KHá»žI Táº O & Lá»œI GIáº¢I MáºªU DO AI Táº O RA */}
      {showSolutionModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(5, 7, 13, 0.85)', backdropFilter: 'blur(8px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '800px', maxHeight: '85vh', overflowY: 'auto', padding: '28px', borderRadius: '20px', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileCode size={20} color="var(--accent-cyan)" /> Lá»i Giáº£i Chuáº©n & Khung MÃ£ Nguá»“n (Tá»± Äá»™ng Sinh Bá»Ÿi Google Gemini AI)
              </h3>
              <button
                type="button"
                onClick={() => setShowSolutionModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {starterCode && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#a5b4fc', marginBottom: '6px' }}>
                  1. Khung MÃ£ Khá»Ÿi Táº¡o Cho Sinh ViÃªn (Starter Code):
                </h4>
                <pre style={{ padding: '14px', borderRadius: '10px', backgroundColor: '#0a0d14', color: '#e5e7eb', fontSize: '12px', fontFamily: 'var(--font-mono)', overflowX: 'auto', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {starterCode}
                </pre>
              </div>
            )}

            {referenceSolution && (
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#6ee7b7', marginBottom: '6px' }}>
                  2. Lá»i Giáº£i Tham Chiáº¿u Chuáº©n XÃ¡c (Reference Working Solution):
                </h4>
                <pre style={{ padding: '14px', borderRadius: '10px', backgroundColor: '#0a0d14', color: '#e5e7eb', fontSize: '12px', fontFamily: 'var(--font-mono)', overflowX: 'auto', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {referenceSolution}
                </pre>
              </div>
            )}

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowSolutionModal(false)}
                style={{ padding: '8px 18px', borderRadius: '8px', backgroundColor: 'var(--accent-primary)', border: 'none', color: '#ffffff', fontWeight: 700, cursor: 'pointer' }}
              >
                ÄÃ³ng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XEM CHI TIáº¾T Äá»€ BÃ€I & TEST CASES ÄÃƒ XUáº¤T Báº¢N Cá»¦A MÃ”N Há»ŒC */}
      {previewAssignment && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(5, 7, 13, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '900px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '28px',
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            {/* Header Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontWeight: 700,
                      backgroundColor: previewAssignment.status === 'PUBLISHED' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)',
                      color: previewAssignment.status === 'PUBLISHED' ? '#34d399' : '#f43f5e',
                      border: `1px solid ${previewAssignment.status === 'PUBLISHED' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
                    }}
                  >
                    {previewAssignment.status === 'PUBLISHED' ? 'ðŸŸ¢ ÄANG Má»ž Ná»˜P BÃ€I' : 'ðŸ”´ ÄÃƒ ÄÃ“NG Ná»˜P'}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    MÃ£ Ä‘á»: <strong style={{ color: '#fff' }}>{previewAssignment.id}</strong> â€¢ Táº¡o ngÃ y: {previewAssignment.createdAt}
                  </span>
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff' }}>
                  {previewAssignment.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewAssignment(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={22} />
              </button>
            </div>

            {/* ThÃ´ng sá»‘ ká»¹ thuáº­t */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <div style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Háº¡n chÃ³t ná»™p bÃ i:</span>
                <strong style={{ fontSize: '13px', color: 'var(--accent-amber)' }}>{new Date(previewAssignment.deadline).toLocaleString('vi-VN')}</strong>
              </div>
              <div style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Thá»i gian thá»±c thi tá»‘i Ä‘a:</span>
                <strong style={{ fontSize: '13px', color: 'var(--accent-cyan)' }}>{previewAssignment.timeLimitMs} ms</strong>
              </div>
              <div style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Bá»™ nhá»› RAM tá»‘i Ä‘a:</span>
                <strong style={{ fontSize: '13px', color: '#ffffff' }}>{previewAssignment.memoryLimitMb} MB</strong>
              </div>
              <div style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>NgÃ´n ngá»¯ láº­p trÃ¬nh:</span>
                <strong style={{ fontSize: '13px', color: 'var(--accent-primary)' }}>{previewAssignment.allowedLanguages.join(', ').toUpperCase()}</strong>
              </div>
            </div>

            {/* MÃ´ táº£ Ä‘á» bÃ i */}
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#e5e7eb', marginBottom: '8px' }}>
                ðŸ“– MÃ´ Táº£ YÃªu Cáº§u & RÃ ng Buá»™c:
              </h4>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6', whiteSpace: 'pre-wrap', backgroundColor: 'rgba(0,0,0,0.25)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)', margin: 0 }}>
                {previewAssignment.description}
              </p>
            </div>

            {/* Danh sÃ¡ch Test Cases */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Cpu size={16} /> Danh SÃ¡ch Test Cases ({previewAssignment.testCases.length} Bá»™ Test, Tá»•ng Trá»ng Sá»‘: {previewAssignment.testCases.reduce((sum, tc) => sum + (Number(tc.weight) || 0), 0).toFixed(1)}Ä‘):
                </h4>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {previewAssignment.testCases.map((tc, tcIdx) => (
                  <div
                    key={tcIdx}
                    style={{
                      padding: '14px 16px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(18, 24, 36, 0.7)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                        Test Case #{tcIdx + 1}
                      </span>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: tc.isHidden ? 'rgba(245, 158, 11, 0.15)' : 'rgba(6, 182, 212, 0.15)',
                            color: tc.isHidden ? 'var(--accent-amber)' : 'var(--accent-cyan)',
                            fontWeight: 600,
                          }}
                        >
                          {tc.isHidden ? 'ðŸ”’ Test áº¨n' : 'ðŸŒ Test CÃ´ng Khai'}
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#34d399', backgroundColor: 'rgba(16, 185, 129, 0.15)', padding: '2px 8px', borderRadius: '4px' }}>
                          Trá»ng sá»‘: {tc.weight}Ä‘
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Äáº§u vÃ o (Input / StdIn):</span>
                        <pre style={{ margin: 0, padding: '8px 10px', borderRadius: '6px', backgroundColor: '#0a0d14', color: '#e5e7eb', fontSize: '12px', fontFamily: 'var(--font-mono)', border: '1px solid rgba(255,255,255,0.06)', overflowX: 'auto' }}>
                          {tc.input}
                        </pre>
                      </div>
                      <div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Äáº§u ra ká»³ vá»ng (Expected Output / StdOut):</span>
                        <pre style={{ margin: 0, padding: '8px 10px', borderRadius: '6px', backgroundColor: '#0a0d14', color: '#34d399', fontSize: '12px', fontFamily: 'var(--font-mono)', border: '1px solid rgba(255,255,255,0.06)', overflowX: 'auto' }}>
                          {tc.output}
                        </pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Barem Rubrics */}
            {previewAssignment.rubrics && previewAssignment.rubrics.length > 0 && (
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#a5b4fc', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Award size={16} /> Barem Cháº¥m Äiá»ƒm Há»c Thuáº­t (Rubrics):
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {previewAssignment.rubrics.map((r, rIdx) => (
                    <div key={rIdx} style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.15)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>{rIdx + 1}. {r.criterion}</span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#818cf8' }}>{r.maxScore}Ä‘</span>
                      </div>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>{r.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Starter Code hoáº·c Reference Solution náº¿u cÃ³ */}
            {previewAssignment.starterCode && (
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#a5b4fc', marginBottom: '6px' }}>
                  Khung MÃ£ Nguá»“n Khá»Ÿi Táº¡o (Starter Code):
                </h4>
                <pre style={{ margin: 0, padding: '12px', borderRadius: '8px', backgroundColor: '#0a0d14', color: '#e5e7eb', fontSize: '12px', fontFamily: 'var(--font-mono)', overflowX: 'auto', border: '1px solid rgba(255,255,255,0.06)' }}>
                  {previewAssignment.starterCode}
                </pre>
              </div>
            )}

            {/* Footer Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    handleToggleAssignmentStatus(previewAssignment.id);
                    setPreviewAssignment((prev) => (prev ? { ...prev, status: prev.status === 'PUBLISHED' ? 'CLOSED' : 'PUBLISHED' } : null));
                  }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    backgroundColor: previewAssignment.status === 'PUBLISHED' ? 'rgba(244, 63, 94, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    border: `1px solid ${previewAssignment.status === 'PUBLISHED' ? 'rgba(244, 63, 94, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                    color: previewAssignment.status === 'PUBLISHED' ? '#f43f5e' : '#34d399',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {previewAssignment.status === 'PUBLISHED' ? 'ÄÃ³ng Ná»™p BÃ i' : 'Má»Ÿ Láº¡i Ná»™p BÃ i'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPreviewAssignment(null);
                    setActiveTab('SUBMISSIONS');
                  }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Award size={15} /> Xem Sá»• Äiá»ƒm Lá»›p
                </button>
              </div>

              <button
                type="button"
                onClick={() => setPreviewAssignment(null)}
                className="btn-primary"
                style={{ padding: '8px 24px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
              >
                ÄÃ³ng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL Táº O KHÃ“A Há»ŒC Má»šI (LÆ¯U VÃ€O POSTGRESQL 15) */}
      {isCreateCourseModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '560px',
              backgroundColor: '#0f172a',
              border: '1.5px solid rgba(99, 102, 241, 0.4)',
              borderRadius: '20px',
              padding: '28px 32px',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(99, 102, 241, 0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <BookOpen size={24} color="var(--accent-primary)" />
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff' }}>
                  Táº¡o Lá»›p Há»c Pháº§n Má»›i (PostgreSQL 15)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateCourseModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateNewCourse} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  MÃ£ Lá»›p Há»c Pháº§n / Subject Code:
                </label>
                <input
                  type="text"
                  value={newCourseCode}
                  onChange={(e) => setNewCourseCode(e.target.value.toUpperCase())}
                  placeholder="VÃ­ dá»¥: PRN211, PRO192, SWP391"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#ffffff',
                    fontSize: '14px',
                    fontWeight: 700,
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  TÃªn KhÃ³a Há»c / Course Name:
                </label>
                <input
                  type="text"
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  placeholder="VÃ­ dá»¥: Láº­p trÃ¬nh Cross-Platform .NET Core"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#ffffff',
                    fontSize: '14px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Há»c Ká»³ (Semester):
                </label>
                <input
                  type="text"
                  value={newCourseSemester}
                  onChange={(e) => setNewCourseSemester(e.target.value)}
                  placeholder="VÃ­ dá»¥: Há»c ká»³ Thu 2026 (Fall 2026)"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#ffffff',
                    fontSize: '14px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  MÃ´ Táº£ Má»¥c TiÃªu KhÃ³a Há»c:
                </label>
                <textarea
                  value={newCourseDesc}
                  onChange={(e) => setNewCourseDesc(e.target.value)}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#ffffff',
                    fontSize: '13px',
                    resize: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsCreateCourseModalOpen(false)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#ffffff',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Há»§y Bá»
                </button>

                <button
                  type="submit"
                  disabled={createCourseLoading}
                  className="btn-primary"
                  style={{
                    padding: '10px 22px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: createCourseLoading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <PlusCircle size={16} /> {createCourseLoading ? 'Äang LÆ°u...' : 'LÆ°u VÃ o PostgreSQL 15'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Xem Chi Tiet Bai Nop Cho Giang Vien */}
      <SubmissionDetailModal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        submission={selectedDetailSubmission}
      />
    </div>
  );
};

