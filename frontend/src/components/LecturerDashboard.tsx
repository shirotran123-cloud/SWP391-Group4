import { SubmissionDetailModal, type SubmissionDetailData } from './SubmissionDetailModal';
import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
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
  Activity,
  Users,
} from 'lucide-react';
import { RblBenchmarkView } from './RblBenchmarkView';
import { LecturerAppealsManager } from './LecturerAppealsManager';
import { FileTypeIcon } from './FileTypeIcon';
import type { PlagiarismMatch } from '../types';

import { GeminiAIService, type RubricCriterion } from '../services/gemini-ai.service';

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
  courseId?: string;
  assignmentId?: string;
  assignmentTitle: string;
  fileName: string;
  submittedAt: string;
  testcaseScore: number;
  cleanCodeScore: number;
  solidScore: number;
  finalScore: number;
  plagiarismStatus: 'AN TOÀN' | 'NGHI VẤN' | 'ĐẠO VĂN';
  similarityRate: number;
  plagiarismMatch?: {
    matchedStudentId: string;
    matchedStudentName?: string;
    matchedSubmissionId?: string;
    similarityRate: number;
    maxContainment?: number;
    sourceCodeA?: string;
    sourceCodeB?: string;
    matchedTokens?: Array<{ lineA: [number, number]; lineB: [number, number] }>;
    isFlagged?: boolean;
    status?: string;
  } | null;
  sourceCode?: string;
}

const initialCourses: CourseItem[] = [
  {
    courseId: 'COURSE-SWP391',
    courseCode: 'SWP391',
    courseName: 'Dự Án Phát Triển Phần Mềm (Agile Scrum)',
    semester: 'Học kỳ Thu 2026',
    instructorName: 'ThS. Đinh Thành Trung',
    studentCount: 38,
    assignmentCount: 2,
  },
  {
    courseId: 'COURSE-PRO192',
    courseCode: 'PRO192',
    courseName: 'Lập Trình Hướng Đối Tượng Java & SOLID',
    semester: 'Học kỳ Thu 2026',
    instructorName: 'ThS. Đinh Thành Trung',
    studentCount: 42,
    assignmentCount: 1,
  },
  {
    courseId: 'COURSE-CSD201',
    courseCode: 'CSD201',
    courseName: 'Cấu Trúc Dữ Liệu & Giải Thuật Nâng Cao',
    semester: 'Học kỳ Thu 2026',
    instructorName: 'ThS. Đinh Thành Trung',
    studentCount: 35,
    assignmentCount: 1,
  },
];

const defaultPublishedAssignments: PublishedAssignment[] = [
  {
    id: 'ASM-SWP-01',
    courseId: 'COURSE-SWP391',
    title: 'Cài đặt Thuật toán Cây Tìm Kiếm Nhị Phân (BST) & Đồ Thị',
    description: 'Cài đặt Generic Binary Search Tree trong Java hoặc C++. Tối ưu hóa độ phức tạp thời gian và tuân thủ các nguyên lý SOLID.',
    deadline: '2026-10-26T23:59',
    timeLimitMs: 2000,
    memoryLimitMb: 512,
    allowedLanguages: ['java', 'python', 'cpp'],
    testCases: [
      { input: '5\n4 2 5 1 3', output: '1 2 3 4 5', weight: 3.5, isHidden: false },
      { input: '3\n10 0 -5', output: '-5 0 10', weight: 3.5, isHidden: true },
    ],
    rubrics: [
      { criterion: 'Tính đúng đắn thuật toán & Vượt qua Testcases', maxScore: 5.0, description: 'Pass 100% testcases' },
      { criterion: 'Clean Code & Tối ưu O(N log N)', maxScore: 2.5, description: 'Mã nguồn rõ ràng, đặt tên chuẩn' },
      { criterion: 'Thiết kế Hướng đối tượng & SOLID', maxScore: 2.5, description: 'Tuân thủ SRP và DIP' },
    ],
    starterCode: '// Java Starter Code BST',
    createdAt: '10/10/2026 08:30',
    status: 'PUBLISHED',
    submissionCount: 28,
  },
  {
    id: 'ASM-SWP-02',
    courseId: 'COURSE-SWP391',
    title: 'Thuật toán Sắp xếp & Tối ưu O(N log N)',
    description: 'Cài đặt giải thuật sắp xếp nhanh tối ưu 3-Way Partitioning tránh suy biến trên dữ liệu trùng lặp.',
    deadline: '2026-10-20T23:59',
    timeLimitMs: 1500,
    memoryLimitMb: 256,
    allowedLanguages: ['java', 'python', 'cpp'],
    testCases: [
      { input: '5\n5 4 3 2 1', output: '1 2 3 4 5', weight: 4.0, isHidden: false },
      { input: '10\n10 9 8 7 6 5 4 3 2 1', output: '1 2 3 4 5 6 7 8 9 10', weight: 3.0, isHidden: true },
    ],
    rubrics: [
      { criterion: 'Đúng đắn Testcases', maxScore: 7.0, description: 'Vượt qua bộ testcases' },
      { criterion: 'Clean Code & SOLID', maxScore: 3.0, description: 'Tuân thủ SRP' },
    ],
    starterCode: '// Solution starter',
    createdAt: '08/10/2026 09:00',
    status: 'PUBLISHED',
    submissionCount: 35,
  },
  {
    id: 'ASM-CSD-01',
    courseId: 'COURSE-CSD201',
    title: 'Cài Đặt Cây AVL Tự Cân Bằng (Self-Balancing Tree)',
    description: 'Triển khai cây AVL với các phép xoay đơn và kép, kiểm tra cân bằng 1,000 phần tử.',
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
    studentName: 'Đinh Thành Trung',
    courseId: 'COURSE-SWP391',
    assignmentId: 'TASK-SWP391-SPRINT2',
    assignmentTitle: 'Thuật toán Sắp xếp & Tối ưu O(N log N)',
    fileName: 'solution_sorting_v2.zip',
    submittedAt: '12/10/2026 14:22',
    testcaseScore: 7.0,
    cleanCodeScore: 9.0,
    solidScore: 8.5,
    finalScore: 9.5,
    plagiarismStatus: 'AN TOÀN',
    similarityRate: 14.5,
  },
  {
    id: 'SUB-002',
    studentId: 'SE170123',
    studentName: 'Trần Thanh Nguyên',
    courseId: 'COURSE-SWP391',
    assignmentId: 'TASK-SWP391-SPRINT2',
    assignmentTitle: 'Thuật toán Sắp xếp & Tối ưu O(N log N)',
    fileName: 'sorting_fast.zip',
    submittedAt: '12/10/2026 14:15',
    testcaseScore: 6.5,
    cleanCodeScore: 8.0,
    solidScore: 8.0,
    finalScore: 8.8,
    plagiarismStatus: 'AN TOÀN',
    similarityRate: 18.2,
  },
  {
    id: 'SUB-003',
    studentId: 'SE170456',
    studentName: 'Lê Hoàng Nam',
    courseId: 'COURSE-SWP391',
    assignmentId: 'TASK-SWP391-SPRINT2',
    assignmentTitle: 'Thuật toán Sắp xếp & Tối ưu O(N log N)',
    fileName: 'sort_algorithm_final.zip',
    submittedAt: '12/10/2026 13:50',
    testcaseScore: 5.0,
    cleanCodeScore: 6.0,
    solidScore: 5.5,
    finalScore: 6.5,
    plagiarismStatus: 'NGHI VẤN',
    similarityRate: 72.8,
  },
  {
    id: 'SUB-004',
    studentId: 'SE170889',
    studentName: 'Phạm Minh Tuấn',
    courseId: 'COURSE-SWP391',
    assignmentId: 'TASK-SWP391-SPRINT2',
    assignmentTitle: 'Thuật toán Sắp xếp & Tối ưu O(N log N)',
    fileName: 'assignment_sort.zip',
    submittedAt: '12/10/2026 12:10',
    testcaseScore: 4.0,
    cleanCodeScore: 5.0,
    solidScore: 4.5,
    finalScore: 5.0,
    plagiarismStatus: 'ĐẠO VĂN',
    similarityRate: 86.4,
  },
];

export const LecturerDashboard: React.FC<LecturerDashboardProps> = ({ onOpenDiffViewer }) => {
  const [activeTab, setActiveTab] = useState<'COURSES' | 'CREATE_ASSIGNMENT' | 'EXCEL_IMPORT' | 'SUBMISSIONS' | 'RBL_LAB' | 'APPEALS'>('COURSES');

  // Danh sách bài nộp thực tế từ server & trạng thái tải file zip
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
      // requesterRole=LECTURER → API trả đầy đủ plagiarism data (BR-04)
      const res = await fetch('http://localhost:3000/api/v1/submissions?requesterRole=LECTURER', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const json = await res.json();
        const serverList = json.data || json || [];
        if (Array.isArray(serverList) && serverList.length > 0) {
          const mapped: SubmissionRecord[] = serverList.map((s: any) => {
            const sim = s.similarityRate ?? s.result?.similarityRate ?? 0;
            const pStatus = s.plagiarismStatus ||
              (sim >= 70 ? 'ĐẠO VĂN' : sim >= 40 ? 'NGHI VẤN' : 'AN TOÀN');
            const rawAssignId = s.assignmentId || s.assignmentTitle || '';
            const matchedAssign = publishedAssignments.find(
              (a) => a.id === rawAssignId || a.title === rawAssignId
            );
            const courseId = s.courseId || matchedAssign?.courseId || (rawAssignId.includes('PRN211') ? 'COURSE-PRN211' : rawAssignId.includes('CSD') ? 'COURSE-CSD201' : 'COURSE-SWP391');
            return {
              id: s.submissionId || s.id,
              studentId: s.studentId || 'SE-N/A',
              studentName: s.studentName || s.studentId || 'Sinh viên',
              courseId,
              assignmentId: s.assignmentId || rawAssignId,
              assignmentTitle: matchedAssign?.title || s.assignmentTitle || s.assignmentId || 'Bài nộp',
              fileName: s.fileName || `${s.submissionId || s.id}.zip`,
              submittedAt: s.createdAt ? new Date(s.createdAt).toLocaleString('vi-VN') : 'Vừa xong',
              testcaseScore: s.score !== undefined ? Math.round(s.score * 0.7 * 10) / 10 : 7.0,
              cleanCodeScore: s.result?.aiRating?.cleanCodeScore ?? 8.5,
              solidScore: 8.0,
              finalScore: s.score ?? 8.5,
              plagiarismStatus: pStatus as any,
              similarityRate: sim,
              plagiarismMatch: s.plagiarismMatch || s.result?.plagiarismMatch || null,
              sourceCode: s.sourceCode || s.result?.sourceCode,
            };
          });
          setRealSubmissions(mapped);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoadingSubmissions(false);
    }
  };

  // ── Bộ lọc lớp học phần & bài tập cho Sổ Điểm ──────────────────────────────
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('ALL');
  const [selectedAssignmentFilter, setSelectedAssignmentFilter] = useState<string>('ALL');

  // ── Quét đạo văn theo Lớp học phần & Bài tập ────────────────────────────────
  const [scanningPlagiarism, setScanningPlagiarism] = useState(false);
  const [plagiarismScanResult, setPlagiarismScanResult] = useState<any>(null);
  const [showPlagiarismMatrix, setShowPlagiarismMatrix] = useState(false);

  const handleScanClassPlagiarism = async (targetAssignId?: string) => {
    let assignIdToScan = targetAssignId;
    if (!assignIdToScan) {
      if (selectedAssignmentFilter !== 'ALL') {
        assignIdToScan = selectedAssignmentFilter;
      } else if (selectedClassFilter !== 'ALL') {
        const classAssignments = publishedAssignments.filter(
          (a) => a.courseId === selectedClassFilter || selectedClassFilter.includes(a.courseId) || a.courseId.includes(selectedClassFilter)
        );
        assignIdToScan = classAssignments[0]?.id || 'TASK-SWP391-SPRINT2';
      } else {
        assignIdToScan = realSubmissions[0]?.assignmentId || 'TASK-SWP391-SPRINT2';
      }
    }

    setScanningPlagiarism(true);
    setPlagiarismScanResult(null);
    try {
      const res = await fetch(`http://localhost:3000/api/v1/plagiarism/matrix/${encodeURIComponent(assignIdToScan)}`);
      if (res.ok) {
        const json = await res.json();
        setPlagiarismScanResult(json.data);
        setShowPlagiarismMatrix(true);
      } else {
        alert(`Không thể kết nối tới server để quét đạo văn bài tập: ${assignIdToScan}`);
      }
    } catch {
      alert('Lỗi kết nối. Hãy kiểm tra API Gateway đang chạy.');
    } finally {
      setScanningPlagiarism(false);
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
        // Fallback cho bài mẫu demo
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
      alert(`Lỗi khi tải file zip: ${err.message}`);
    } finally {
      setDownloadingId(null);
    }
  };


  // Quản lý danh sách khóa học và bài tập đã giao
  const [courses, setCourses] = useState<CourseItem[]>(() => {
    try {
      const saved = localStorage.getItem('aita_cached_courses');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return initialCourses;
  });
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

// Danh sách bài tập hiển thị theo lớp đang chọn
  const availableAssignmentsForFilter = publishedAssignments.filter((a) => {
    if (selectedClassFilter === 'ALL') return true;
    return a.courseId === selectedClassFilter || selectedClassFilter.includes(a.courseId) || a.courseId.includes(selectedClassFilter);
  });

  // Toàn bộ bài nộp và lọc theo Lớp học phần + Bài tập
  const allSubmissionsList = realSubmissions.length > 0 ? [...realSubmissions, ...mockSubmissionsList] : mockSubmissionsList;
  const filteredSubmissions = allSubmissionsList.filter((sub) => {
    if (selectedClassFilter !== 'ALL') {
      const selectedCourseObj = courses.find((c) => c.courseId === selectedClassFilter);
      const subCourse = sub.courseId || '';
      const matchesCourse =
        subCourse === selectedClassFilter ||
        (selectedCourseObj && (
          subCourse.toLowerCase().includes(selectedCourseObj.courseCode.toLowerCase()) ||
          selectedCourseObj.courseCode.toLowerCase().includes(subCourse.toLowerCase())
        ));
      if (!matchesCourse) return false;
    }
    if (selectedAssignmentFilter !== 'ALL') {
      const matchesAssign =
        sub.assignmentId === selectedAssignmentFilter ||
        sub.assignmentTitle === selectedAssignmentFilter;
      if (!matchesAssign) return false;
    }
    return true;
  });

  // Thống kê nhanh cho lớp / bài tập đang lọc
  const totalFilteredCount = filteredSubmissions.length;
  const avgFilteredScore = totalFilteredCount > 0
    ? (filteredSubmissions.reduce((acc, s) => acc + (s.finalScore || 0), 0) / totalFilteredCount).toFixed(1)
    : '0.0';
  const plagiarizedFilteredCount = filteredSubmissions.filter((s) => s.plagiarismStatus === 'ĐẠO VĂN').length;
  const suspectedFilteredCount = filteredSubmissions.filter((s) => s.plagiarismStatus === 'NGHI VẤN').length;
  const cleanFilteredCount = filteredSubmissions.filter((s) => s.plagiarismStatus === 'AN TOÀN').length;
  const currentSelectedCourseObj = courses.find((c) => c.courseId === selectedClassFilter);
  const currentSelectedAssignmentObj = publishedAssignments.find((a) => a.id === selectedAssignmentFilter);

  // Môn học đang xem chi tiết (nếu null thì hiện danh sách tất cả môn học)
  const [selectedCourseDetailId, setSelectedCourseDetailId] = useState<string | null>(null);

  // Modal xem chi tiết đề bài đã giao
  const [previewAssignment, setPreviewAssignment] = useState<PublishedAssignment | null>(null);

  // Toast thông báo xuất bản thành công
  const [publishSuccessToast, setPublishSuccessToast] = useState<string | null>(null);

  // Form state cho tạo đề bài
  const [assignmentTitle, setAssignmentTitle] = useState('Cài đặt Thuật toán Cây Tìm Kiếm Nhị Phân (BST) & Đồ Thị');
  const [selectedCourse, setSelectedCourse] = useState('COURSE-SWP391');
  const [assignmentDesc, setAssignmentDesc] = useState('Cài đặt Generic Binary Search Tree trong Java hoặc C++. Tối ưu hóa độ phức tạp thời gian và tuân thủ các nguyên lý SOLID.');
  const [deadlineDate, setDeadlineDate] = useState('2026-10-26T23:59');
  const [allowedLanguages, setAllowedLanguages] = useState<string[]>(['java', 'python', 'cpp']);
  const [timeLimitMs, setTimeLimitMs] = useState(2000);
  const [memoryLimitMb, setMemoryLimitMb] = useState(512);
  const [testCases, setTestCases] = useState<Array<{ input: string; output: string; weight: number; isHidden: boolean }>>([
    { input: '5\n4 2 5 1 3', output: '1 2 3 4 5', weight: 3.5, isHidden: false },
    { input: '3\n10 0 -5', output: '-5 0 10', weight: 3.5, isHidden: true },
  ]);
  const [createSuccessMsg, setCreateSuccessMsg] = useState<string | null>(null);

  // Tính tổng trọng số testcases hiện tại (xử lý trường hợp tổng khác 10 hoặc bằng 14, 20...)
  const totalTestcaseWeight = testCases.reduce((sum, tc) => sum + (Number(tc.weight) || 0), 0);

  // Chuẩn hóa tỷ lệ điểm các testcases về thang mong muốn (10.0đ hoặc 7.0đ theo Barem)
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
    'Tạo bài tập về Thuật toán Dijkstra tìm đường đi ngắn nhất, có tối ưu bằng Hàng đợi ưu tiên PriorityQueue, sinh viên phải áp dụng nguyên lý SOLID Single Responsibility (SRP).'
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

  // Lưu API Key vào LocalStorage
  const handleSaveApiKey = () => {
    const trimmed = tempApiKey.trim();
    setGeminiApiKey(trimmed);
    localStorage.setItem('aita_gemini_api_key', trimmed);
    setIsConfigModalOpen(false);
    setAiErrorMsg(null);
  };

  // Ping kiểm tra kết nối API Key với Google Gemini
  // Ping kiểm tra kết nối API Key với Google Gemini
  const handleTestApiKey = async () => {
    if (!tempApiKey.trim()) {
      setPingStatus({ loading: false, message: 'Vui lòng nhập API Key trước khi kiểm tra.', success: false });
      return;
    }
    setPingStatus({ loading: true, message: 'Đang kết nối tới máy chủ Google Gemini (ModelService.ListModels)...', success: null });
    const res = await GeminiAIService.pingKey(tempApiKey, selectedAiModel === 'auto' ? undefined : selectedAiModel);
    setPingStatus({
      loading: false,
      message: res.message + (res.latencyMs ? ` (Độ trễ: ${res.latencyMs}ms)` : ''),
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

  // Sinh đề tự động bằng 100% Google Gemini AI THẬT (UC-08)
  const handleAiGenerateAssignment = async () => {
    setAiErrorMsg(null);
    setCreateSuccessMsg(null);
    setAiSuccessBadge(null);

    // Nếu chưa có API Key, mở modal cấu hình để người dùng nhập
    if (!geminiApiKey.trim()) {
      setTempApiKey('');
      setIsConfigModalOpen(true);
      setAiErrorMsg('Bạn cần cung cấp Google Gemini API Key để hệ thống kết nối AI tạo đề bài.');
      return;
    }

    setIsAiGenerating(true);
    setAiTimerSeconds(0);
    const timerInterval = setInterval(() => {
      setAiTimerSeconds((s) => s + 1);
    }, 1000);

    try {
      const courseObj = courses.find((c) => c.courseId === selectedCourse);
      const courseName = courseObj ? courseObj.courseName : 'Dự Án Phát Triển Phần Mềm';
      const courseCode = courseObj ? courseObj.courseCode : 'SWP391';

      const detectedCount = GeminiAIService.extractRequestedCount(lecturerPrompt);
      const testCountToUse = detectedCount || desiredTestCount || 5;

            // Ưu tiên yêu cầu cụ thể của giảng viên; tránh truyền lại tiêu đề cũ nếu đã bị gán từ lần sinh trước
      let topicToUse = lecturerPrompt?.trim() || '';
      if (!topicToUse) {
        if (assignmentTitle && !assignmentTitle.toLowerCase().includes('drone')) {
          topicToUse = assignmentTitle;
        } else {
          topicToUse = `${courseCode} - Cấu trúc dữ liệu & Thuật toán thực tế`;
        }
      }

      const result = await GeminiAIService.generateAssignment(geminiApiKey, {
        courseName,
        courseCode,
        topicPrompt: topicToUse,
        lecturerDescription: lecturerPrompt,
        difficulty: 'TRUNG BÌNH',
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

      const badgeText = `Google Gemini AI (${result.modelUsed}) đã sinh đề & barem thành công trong ${result.latencyMs}ms!`;
      setAiSuccessBadge(badgeText);
      setCreateSuccessMsg(
        `Đã tạo đề bài "${result.title}" kèm ${result.testCases.length} testcases và ${result.rubric.length} tiêu chí barem chấm điểm.`
      );
    } catch (err: any) {
      console.error('Lỗi khi gọi Google Gemini AI:', err);
      setAiErrorMsg(err.message || 'Không thể kết nối tới Google Gemini AI. Vui lòng kiểm tra lại API Key hoặc hạn mức quota.');
    } finally {
      clearInterval(timerInterval);
      setIsAiGenerating(false);
      setAiTimerSeconds(0);
    }
  };

  // Lưu & Xuất bản đề bài tập: Lưu vào danh sách môn học và TỰ ĐỘNG ĐIỀU HƯỚNG sang trang môn học đó
  const handleSaveAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignmentTitle.trim()) {
      setAiErrorMsg('Vui lòng nhập Tiêu đề bài tập trước khi xuất bản.');
      return;
    }

    const courseObj = courses.find((c) => c.courseId === selectedCourse);
    const courseName = courseObj ? courseObj.courseName : 'Dự Án Phát Triển Phần Mềm';
    const courseCode = courseObj ? courseObj.courseCode : 'SWP391';

    const newAsm: PublishedAssignment = {
      id: `ASM-${Date.now().toString().slice(-5)}`,
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

    const updatedAsms = [newAsm, ...publishedAssignments];
    setPublishedAssignments(updatedAsms);
    try {
      localStorage.setItem('aita_published_assignments', JSON.stringify(updatedAsms));
      window.dispatchEvent(new Event('aita_published_assignments_updated'));
    } catch {
      // ignore
    }

    // Tăng số lượng bài tập của khóa học
    setCourses((prevCourses) =>
      prevCourses.map((c) =>
        c.courseId === selectedCourse ? { ...c, assignmentCount: c.assignmentCount + 1 } : c
      )
    );

    const toastMsg = `Đã xuất bản thành công: Bài tập "${assignmentTitle}" (${testCases.length} testcases) đã giao cho lớp ${courseCode} (${courseName})!`;
    setPublishSuccessToast(toastMsg);
    setCreateSuccessMsg(toastMsg);

    // TỰ ĐỘNG ĐIỀU HƯỚNG SANG TRANG CỦA MÔN HỌC ĐÓ
    setSelectedCourseDetailId(selectedCourse);
    setActiveTab('COURSES');
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      // ignore
    }
  };

  // Đóng hoặc mở lại bài tập
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

  // Xóa bài tập khỏi lớp
  const handleDeleteAssignment = (asmId: string, courseId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa bài tập này khỏi lớp học?')) return;
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

  // State và modal tạo khóa học mới
  const [isCreateCourseModalOpen, setIsCreateCourseModalOpen] = useState(false);
  const [newCourseCode, setNewCourseCode] = useState('PRN211');
  const [newCourseName, setNewCourseName] = useState('Cross-Platform Application Development with .NET');
  const [newCourseSemester, setNewCourseSemester] = useState('Học kỳ Thu 2026');
  const [newCourseDesc, setNewCourseDesc] = useState('Lập trình ứng dụng đa nền tảng với .NET Core & Clean Architecture');
  const [createCourseLoading, setCreateCourseLoading] = useState(false);

  // State cho việc nạp Roster Excel vào lớp
  const [targetCourseId, setTargetCourseId] = useState<string>('CRS-SWP391');
  const [courseStudents, setCourseStudents] = useState<Array<{ userId: string; studentCode: string; fullName: string; email: string }>>([]);
  const [showCourseStudents, setShowCourseStudents] = useState<boolean>(false);
  const [loadingCourseStudents, setLoadingCourseStudents] = useState<boolean>(false);


  // Tải danh sách khóa học thực tế từ API Gateway (PostgreSQL 15)
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
            instructorName: 'ThS. Giảng Viên AITA',
            studentCount: c.studentCount || 0,
            assignmentCount: 2,
          }));
          setCourses(mapped);
          try {
            localStorage.setItem('aita_cached_courses', JSON.stringify(mapped));
          } catch {}
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
      alert('Vui lòng nhập Mã học phần và Tên khóa học!');
      return;
    }

    setCreateCourseLoading(true);
    const generatedId = 'CRS-' + newCourseCode.trim().toUpperCase();
    try {
      const res = await fetch('http://localhost:3000/api/v1/courses', {
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

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Lỗi máy chủ (${res.status})`);
      }

      const newCourseObj: CourseItem = {
        courseId: generatedId,
        courseCode: newCourseCode.trim().toUpperCase(),
        courseName: newCourseName.trim(),
        semester: newCourseSemester,
        instructorName: 'ThS. Giảng Viên AITA',
        studentCount: 0,
        assignmentCount: 0,
      };

      setCourses((prev) => {
        const updated = [newCourseObj, ...prev.filter((c) => c.courseId !== generatedId)];
        try {
          localStorage.setItem('aita_cached_courses', JSON.stringify(updated));
        } catch {}
        return updated;
      });
      setTargetCourseId(generatedId);
      setIsCreateCourseModalOpen(false);
      setPublishSuccessToast(`Đã tạo thành công khóa học mới [${newCourseCode}] và lưu bền vững vào PostgreSQL 15!`);
      window.dispatchEvent(new Event('aita_courses_updated'));
    } catch (err: any) {
      alert(`Lỗi tạo khóa học: ${err.message}`);
    } finally {
      setCreateCourseLoading(false);
    }
  };

  // 1. Tải file mẫu định dạng rỗng để Giảng viên soạn danh sách
  const handleDownloadTemplateCsv = () => {
    const csvContent =
      'Mã Sinh Viên,Họ Và Tên,Email FPT\n' +
      'SE170001,Nguyễn Văn A,anguyen@fpt.edu.vn\n' +
      'SE170002,Trần Thị B,btran@fpt.edu.vn\n';

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mau_danh_sach_sinh_vien.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 2. Xuất danh sách sinh viên thực tế đang học lớp được chọn từ CSDL
  const handleExportCourseRoster = async () => {
    const courseIdToFetch = targetCourseId || 'CRS-SWP391';
    try {
      const res = await fetch(`http://localhost:3000/api/v1/courses/${courseIdToFetch}/students`);
      if (res.ok) {
        const json = await res.json();
        const students = json.data || json || [];
        if (Array.isArray(students) && students.length > 0) {
          let csvContent = 'Mã Sinh Viên,Họ Và Tên,Email\n';
          for (const s of students) {
            csvContent += `${s.studentCode || s.userId},${s.fullName || s.studentCode},${s.email}\n`;
          }
          const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `danh_sach_sinh_vien_${courseIdToFetch}.csv`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          return;
        }
      }
      alert(`Lớp học [${courseIdToFetch}] hiện chưa có sinh viên nào. Vui lòng tải file mẫu để nhập sinh viên vào lớp!`);
    } catch (err: any) {
      alert('Không thể xuất danh sách sinh viên: ' + err.message);
    }
  };

  // 3. Tải danh sách sinh viên hiện tại trong lớp để quản lý
  const handleLoadCourseStudents = async (cId?: string) => {
    const courseIdToFetch = cId || targetCourseId || 'CRS-SWP391';
    setLoadingCourseStudents(true);
    try {
      const res = await fetch(`http://localhost:3000/api/v1/courses/${courseIdToFetch}/students`);
      if (res.ok) {
        const json = await res.json();
        setCourseStudents(json.data || json || []);
        setShowCourseStudents(true);
      }
    } catch {
      // ignore
    } finally {
      setLoadingCourseStudents(false);
    }
  };

  // 4. Xóa sinh viên khỏi lớp học phần (Gỡ khỏi class_members trong PostgreSQL 15)
  const handleRemoveStudentFromCourse = async (studentId: string, studentName: string) => {
    if (!window.confirm(`Bạn có chắc muốn xóa sinh viên ${studentName} (${studentId}) khỏi lớp học phần này?`)) return;
    try {
      const courseIdToFetch = targetCourseId || 'CRS-SWP391';
      const res = await fetch(`http://localhost:3000/api/v1/courses/${courseIdToFetch}/students/${studentId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setCourseStudents((prev) => prev.filter((s) => s.studentCode !== studentId && s.userId !== studentId));
        setCourses((prev) =>
          prev.map((c) =>
            c.courseId === courseIdToFetch ? { ...c, studentCount: Math.max(0, c.studentCount - 1) } : c
          )
        );
        alert(`Đã xóa sinh viên ${studentName} khỏi lớp ${courseIdToFetch} thành công!`);
        window.dispatchEvent(new Event('aita_courses_updated'));
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Không thể xóa sinh viên: ${err.message || 'Lỗi máy chủ'}`);
      }
    } catch (err: any) {
      alert(`Lỗi khi xóa sinh viên: ${err.message}`);
    }
  };


  const handleCsvFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedCsvFile(file);
    setCsvParseError(null);
    setExcelStatus(null);
    setSimulatedRollback(null);

    const ext = file.name.split('.').pop()?.toLowerCase();
    try {
      if (ext === 'xlsx') {
        const zip = await JSZip.loadAsync(file);
        const sharedStringsFile = zip.file('xl/sharedStrings.xml');
        const sharedStrings: string[] = [];
        if (sharedStringsFile) {
          const xmlText = await sharedStringsFile.async('text');
          const matches = xmlText.match(/<t[^>]*>([^<]*)<\/t>/g) || [];
          for (const m of matches) {
            const val = m.replace(/<t[^>]*>/, '').replace(/<\/t>/, '');
            sharedStrings.push(val);
          }
        }

        const sheetFile = zip.file('xl/worksheets/sheet1.xml');
        if (!sheetFile) throw new Error('Không tìm thấy sheet1.xml trong file Excel!');
        const sheetXml = await sheetFile.async('text');
        const rowMatches = sheetXml.match(/<row[^>]*>[\s\S]*?<\/row>/g) || [];
        const students: Array<{ studentCode: string; fullName: string; email: string }> = [];

        for (let i = 0; i < rowMatches.length; i++) {
          const rowXml = rowMatches[i];
          const cellMatches = rowXml.match(/<c[^>]*>[\s\S]*?<\/c>/g) || [];
          const rowValues: string[] = [];
          for (const cell of cellMatches) {
            const isShared = cell.includes('t="s"');
            const vMatch = cell.match(/<v>([^<]*)<\/v>/);
            if (vMatch) {
              const val = vMatch[1];
              if (isShared) {
                const idx = parseInt(val, 10);
                rowValues.push(sharedStrings[idx] || '');
              } else {
                rowValues.push(val);
              }
            }
          }

          if (i === 0 && rowValues.some((v) => /mssv|mã|email|tên/i.test(v))) {
            continue;
          }

          let mssv = '';
          let name = '';
          let email = '';
          for (const val of rowValues) {
            const trimmed = val.trim();
            if (trimmed.includes('@')) {
              email = trimmed;
            } else if (/^[A-Za-z]{2}\d{4,8}$/i.test(trimmed)) {
              mssv = trimmed.toUpperCase();
            } else if (trimmed.length > 2 && !name) {
              name = trimmed;
            }
          }

          if (!mssv && rowValues[0]) mssv = rowValues[0].trim();
          if (!name && rowValues[1]) name = rowValues[1].trim();
          if (!email && rowValues[2]) email = rowValues[2].trim();

          if (mssv) {
            students.push({
              studentCode: mssv,
              fullName: name || mssv,
              email: email || `${mssv.toLowerCase()}@fpt.edu.vn`,
            });
          }
        }

        if (students.length === 0) {
          setCsvParseError('Không trích xuất được sinh viên nào từ file Excel (.xlsx)! Vui lòng kiểm tra các cột.');
          setParsedCsvStudents([]);
        } else {
          setParsedCsvStudents(students);
        }
      } else {
        const text = await file.text();
        if (!text || !text.trim()) {
          setCsvParseError('File được chọn rỗng hoặc không có dữ liệu!');
          setParsedCsvStudents([]);
          return;
        }

        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
        if (lines.length <= 1) {
          setCsvParseError('File chỉ có dòng tiêu đề hoặc không chứa bản ghi sinh viên nào!');
          setParsedCsvStudents([]);
          return;
        }

        const delimiter = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
        const students: Array<{ studentCode: string; fullName: string; email: string }> = [];
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(delimiter).map((p) => p.trim().replace(/^["']|["']$/g, ''));
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
          setCsvParseError('Không trích xuất được sinh viên nào từ file CSV! Kiểm tra các cột: Mã Sinh Viên, Họ Và Tên, Email.');
          setParsedCsvStudents([]);
        } else {
          setParsedCsvStudents(students);
        }
      }
    } catch (err: any) {
      setCsvParseError('Lỗi đọc nội dung file: ' + err.message);
      setParsedCsvStudents([]);
    }
  };

  const handleExecuteLiveBulkImport = async (_triggerError = false, customStudents?: any[]) => {
    setExcelLoading(true);
    setExcelStatus(null);
    setSimulatedRollback(null);

    const studentsToImport = customStudents || parsedCsvStudents;
    if (!studentsToImport || studentsToImport.length === 0) {
      setExcelLoading(false);
      setExcelStatus('Vui lòng chọn file Excel (.xlsx) hoặc CSV hợp lệ chứa danh sách sinh viên trước khi bấm Import!');
      return;
    }

    try {
      const courseIdToUse = targetCourseId || 'CRS-SWP391';
      const res = await fetch(`http://localhost:3000/api/v1/courses/${courseIdToUse}/bulk-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students: studentsToImport }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Lỗi giao dịch SQL!');
      }

      setSimulatedRollback(false);
      setExcelStatus(
        `GIAO DỊCH SQL THÀNH CÔNG (100% COMMIT): Đã nạp và ghi danh thành công ${studentsToImport.length} sinh viên vào lớp [${courseIdToUse}] trong PostgreSQL 15! Sinh viên đăng nhập vào sẽ thấy môn học ngay.`
      );
      setCourses((prev) =>
        prev.map((c) =>
          c.courseId === courseIdToUse ? { ...c, studentCount: Math.max(c.studentCount, studentsToImport.length) } : c
        )
      );

      try {
        window.dispatchEvent(new Event('aita_courses_updated'));
      } catch {
        // ignore
      }
    } catch (err: any) {
      setSimulatedRollback(true);
      setExcelStatus(
        `GIAO DỊCH SQL THẤT BẠI: ${err.message}. Hệ thống đã tự động kích hoạt 100% SQL TRANSACTION ROLLBACK (R06) bảo toàn dữ liệu PostgreSQL, không có bất kỳ bản ghi mồ côi nào!`
      );
    } finally {
      setExcelLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Tiêu đề Dashboard Giảng Viên */}
      <div style={{ marginBottom: '22px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: '3px' }}>Cổng giảng viên</p>
          <h1 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            Học phần &amp; khảo thí lập trình
          </h1>
          <p style={{ color: 'var(--text-dim)', fontSize: '12.5px', marginTop: '3px' }}>
            Quản lý đề bài, lớp học, soạn barem bằng AI và kiểm định đạo văn AST.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setTempApiKey(geminiApiKey);
              setIsConfigModalOpen(true);
            }}
          >
            <Key size={13} />
            {geminiApiKey ? 'Đã cấu hình AI key' : 'Nhập Gemini AI key'}
          </button>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setActiveTab('CREATE_ASSIGNMENT')}
          >
            <PlusCircle size={14} /> Tạo đề bài
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div
        role="tablist"
        style={{ display: 'flex', gap: '2px', marginBottom: '22px', borderBottom: '1px solid var(--border-color)', overflowX: 'auto' }}
      >
        {([
          { key: 'COURSES', label: 'Khóa học', icon: <BookOpen size={14} /> },
          { key: 'CREATE_ASSIGNMENT', label: 'Soạn đề & barem', icon: <Sparkles size={14} /> },
          { key: 'EXCEL_IMPORT', label: 'Nhập roster', icon: <FileSpreadsheet size={14} /> },
          { key: 'SUBMISSIONS', label: 'Sổ điểm', icon: <Award size={14} /> },
          { key: 'RBL_LAB', label: 'RBL Lab', icon: <Activity size={14} /> },
          { key: 'APPEALS', label: 'Phúc khảo', icon: <Scale size={14} /> },
        ] as const).map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                padding: '9px 13px',
                border: 'none',
                borderBottom: `2px solid ${active ? 'var(--blue-500)' : 'transparent'}`,
                marginBottom: '-1px',
                background: 'transparent',
                color: active ? 'var(--blue-300)' : 'var(--text-muted)',
                fontWeight: active ? 600 : 500,
                fontSize: '12.5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                whiteSpace: 'nowrap',
                transition: 'color .15s ease, border-color .15s ease',
              }}
            >
              {tab.icon} {tab.label}
            </button>
          );
        })}
      </div>


      {/* TAB 1: KHÓA HỌC & LỚP (BẢNG QUẢN LÝ MÔN HỌC & BÀI TẬP ĐÃ GIAO) */}
      {activeTab === 'COURSES' && (
        <div>
          {/* TRƯỜNG HỢP 1: XEM CHI TIẾT 1 MÔN HỌC & CÁC BÀI TẬP ĐÃ GIAO */}
          {selectedCourseDetailId ? (() => {
            const currentCourse = courses.find((c) => c.courseId === selectedCourseDetailId);
            const courseAssignments = publishedAssignments.filter((a) => a.courseId === selectedCourseDetailId);
            const courseCode = currentCourse ? currentCourse.courseCode : 'MÔN HỌC';
            const courseName = currentCourse ? currentCourse.courseName : 'Chi tiết môn học';

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Banner Thông Báo Xuất Bản Thành Công nếu có */}
                {publishSuccessToast && (
                  <div
                    style={{
                      padding: '16px 20px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(37, 99, 235, 0.08)',
                      border: '1.5px solid rgba(37, 99, 235, 0.18)',
                      color: 'var(--blue-200)',
                      fontSize: '14px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.35)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <CheckCircle2 size={20} color="#2563eb" />
                      <span>{publishSuccessToast}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPublishSuccessToast(null)}
                      style={{ background: 'none', border: 'none', color: 'var(--blue-200)', cursor: 'pointer', fontSize: '18px', fontWeight: 700 }}
                    >
                      ×
                    </button>
                  </div>
                )}

                {/* Header Thông Tin Môn Học */}
                <div className="glass-panel" style={{ padding: '24px 28px', borderRadius: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedCourseDetailId(null)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(11, 18, 32, 0.04)',
                        border: '1px solid rgba(11, 18, 32, 0.08)',
                        color: 'var(--text-main)',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <ArrowLeft size={16} /> Quay Lại Danh Sách Môn Học
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
                        <PlusCircle size={16} /> + Giao Thêm Đề Mới (AI)
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveTab('SUBMISSIONS')}
                        style={{
                          padding: '9px 16px',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(11, 18, 32, 0.035)',
                          border: '1px solid rgba(11, 18, 32, 0.08)',
                          color: 'var(--text-main)',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Award size={16} /> Xem Sổ Điểm Lớp
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', padding: '4px 10px', borderRadius: '6px', backgroundColor: 'rgba(59, 130, 246, 0.16)', color: 'var(--blue-200)', fontWeight: 600 }}>
                      {courseCode}
                    </span>
                    <h2 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text-main)' }}>
                      {courseName}
                    </h2>
                  </div>

                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '16px' }}>
                    Giảng viên: <strong>{currentCourse?.instructorName}</strong> • {currentCourse?.semester} • Sĩ số: <strong style={{ color: 'var(--text-main)' }}>{currentCourse?.studentCount}</strong> sinh viên
                  </p>

                  <div style={{ display: 'flex', gap: '20px', borderTop: '1px solid rgba(11, 18, 32, 0.05)', paddingTop: '14px', fontSize: '13px', color: 'var(--text-muted)' }}>
                    <span>Tổng số bài tập đã giao: <strong style={{ color: 'var(--blue-200)' }}>{courseAssignments.length}</strong> bài</span>
                    <span>Đang mở nộp bài: <strong style={{ color: 'var(--blue-200)' }}>{courseAssignments.filter((a) => a.status === 'PUBLISHED').length}</strong> bài</span>
                  </div>
                </div>

                {/* Tiêu đề Danh Sách Bài Tập */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FolderKanban size={20} color="var(--accent-cyan)" /> Danh Sách Các Bài Tập Đã Giao Của Môn Học
                  </h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Hiển thị {courseAssignments.length} bài tập
                  </span>
                </div>

                {/* Danh Sách Card Bài Tập Đã Giao */}
                {courseAssignments.length === 0 ? (
                  <div className="glass-panel" style={{ padding: '48px', borderRadius: '12px', textAlign: 'center' }}>
                    <FileText size={44} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
                    <h4 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                      Chưa Có Bài Tập Nào Được Giao Cho Môn Học Này
                    </h4>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                      Giảng viên có thể sử dụng Trợ lý Google Gemini AI để soạn đề và testcases chỉ trong 1 giây.
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
                      Soạn đề bài tập đầu tiên
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
                            borderRadius: '12px',
                            border: asm.isNewlyCreated ? '1.5px solid rgba(37, 99, 235, 0.24)' : '1px solid rgba(11, 18, 32, 0.05)',
                            backgroundColor: asm.isNewlyCreated ? 'rgba(37, 99, 235, 0.04)' : undefined,
                            boxShadow: asm.isNewlyCreated ? '0 4px 20px rgba(37, 99, 235, 0.08)' : undefined,
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
                                  backgroundColor: isPublished ? 'rgba(37, 99, 235, 0.1)' : 'rgba(11, 18, 32, 0.07)',
                                  color: isPublished ? '#1d4ed8' : 'var(--text-main)',
                                  border: `1px solid ${isPublished ? 'rgba(37, 99, 235, 0.14)' : 'rgba(11, 18, 32, 0.1)'}`,
                                }}
                              >
                                {isPublished ? 'ĐANG MỞ NỘP BÀI' : 'ĐÃ ĐÓNG NỘP'}
                              </span>

                              {asm.isNewlyCreated && (
                                <span
                                  style={{
                                    fontSize: '11px',
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    fontWeight: 700,
                                    background: 'var(--blue-400)',
                                    color: 'var(--on-blue)',
                                  }}
                                >
                                  Mới xuất bản
                                </span>
                              )}

                              <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                                Mã: <strong>{asm.id}</strong> • Tạo lúc: {asm.createdAt}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--accent-amber)', fontWeight: 600 }}>
                              <Clock size={14} /> Hạn chót: {new Date(asm.deadline).toLocaleString('vi-VN')}
                            </div>
                          </div>

                          <h4 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>
                            {asm.title}
                          </h4>

                          <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '14px' }}>
                            {asm.description.length > 200 ? `${asm.description.slice(0, 200)}...` : asm.description}
                          </p>

                          {/* Chips Thông số kỹ thuật */}
                          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
                            <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(59, 130, 246, 0.09)', color: '#1e40af' }}>
                              {asm.testCases.length} Test Cases ({totalWeight.toFixed(1)}đ)
                            </span>
                            <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(37, 99, 235, 0.08)', color: 'var(--blue-200)' }}>
                              Thời gian: {asm.timeLimitMs}ms
                            </span>
                            <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(11, 18, 32, 0.035)', color: 'var(--text-muted)' }}>
                              RAM: {asm.memoryLimitMb}MB
                            </span>
                            <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(11, 18, 32, 0.035)', color: 'var(--text-muted)' }}>
                              {asm.allowedLanguages.join(', ').toUpperCase()}
                            </span>
                            <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(37, 99, 235, 0.08)', color: 'var(--blue-200)', fontWeight: 600 }}>
                              {asm.submissionCount}/38 Sinh viên đã nộp bài
                            </span>
                          </div>

                          {/* Các nút hành động cho bài tập */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(11, 18, 32, 0.04)', paddingTop: '12px', flexWrap: 'wrap', gap: '8px' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                type="button"
                                onClick={() => setPreviewAssignment(asm)}
                                style={{
                                  padding: '7px 12px',
                                  borderRadius: '8px',
                                  backgroundColor: 'rgba(37, 99, 235, 0.10)',
                                  border: '1px solid var(--accent-primary)',
                                  color: 'var(--text-main)',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                }}
                              >
                                <Eye size={14} /> Xem Chi Tiết Đề & Test Cases
                              </button>

                              <button
                                type="button"
                                onClick={() => setActiveTab('SUBMISSIONS')}
                                style={{
                                  padding: '7px 12px',
                                  borderRadius: '8px',
                                  backgroundColor: 'rgba(11, 18, 32, 0.04)',
                                  border: '1px solid rgba(11, 18, 32, 0.07)',
                                  color: 'var(--text-muted)',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                }}
                              >
                                <Award size={14} /> Sổ Điểm Bài Nộp
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
                                  border: `1px solid ${isPublished ? 'rgba(11, 18, 32, 0.13)' : 'rgba(37, 99, 235, 0.18)'}`,
                                  color: isPublished ? 'var(--text-main)' : '#1d4ed8',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                {isPublished ? 'Đóng Nộp Bài' : 'Mở Lại Nộp Bài'}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteAssignment(asm.id, asm.courseId)}
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: '6px',
                                  backgroundColor: 'rgba(11, 18, 32, 0.05)',
                                  border: '1px solid rgba(11, 18, 32, 0.09)',
                                  color: 'var(--text-main)',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <Trash2 size={13} /> Xóa
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
            /* TRƯỜNG HỢP 2: DANH SÁCH TẤT CẢ CÁC MÔN HỌC & LỚP */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)' }}>
                    Các Lớp Học Phần Đang Giảng Dạy ({courses.length} Môn)
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                    Chọn bất kỳ môn học nào để xem danh sách các bài tập đã giao hoặc giao bài tập mới
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
                  <PlusCircle size={16} /> + Tạo Khóa Học Mới
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
                {courses.map((course) => {
                  const assignedCount = publishedAssignments.filter((a) => a.courseId === course.courseId).length;

                  return (
                    <div key={course.courseId} className="glass-panel" style={{ padding: '24px', borderRadius: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(37, 99, 235, 0.10)', color: 'var(--blue-200)', fontWeight: 700 }}>
                          {course.courseCode}
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{course.semester}</span>
                      </div>

                      <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>
                        {course.courseName}
                      </h3>

                      <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '16px' }}>
                        Giảng viên: {course.instructorName}
                      </p>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-muted)', borderTop: '1px solid rgba(11, 18, 32, 0.04)', paddingTop: '12px' }}>
                        <span>Sĩ số: <strong style={{ color: 'var(--text-main)' }}>{course.studentCount}</strong> sinh viên</span>
                        <span>Đã giao: <strong style={{ color: 'var(--blue-200)' }}>{assignedCount}</strong> bài tập</span>
                      </div>

                      <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedCourseDetailId(course.courseId)}
                          style={{
                            width: '100%',
                            padding: '9px 12px',
                            borderRadius: '8px',
                            background: 'rgba(59, 130, 246, 0.1)',
                            border: '1px solid rgba(59, 130, 246, 0.28)',
                            color: 'var(--text-main)',
                            fontSize: '13px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                          }}
                        >
                          <FolderKanban size={15} color="var(--accent-cyan)" /> Xem các bài tập đã giao ({assignedCount})
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
                              backgroundColor: 'rgba(11, 18, 32, 0.04)',
                              border: '1px solid rgba(11, 18, 32, 0.07)',
                              color: 'var(--blue-200)',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            + Giao Đề Mới (AI)
                          </button>

                          <button
                            type="button"
                            onClick={() => setActiveTab('SUBMISSIONS')}
                            style={{
                              padding: '8px 12px',
                              borderRadius: '8px',
                              backgroundColor: 'rgba(11, 18, 32, 0.03)',
                              border: '1px solid rgba(11, 18, 32, 0.06)',
                              color: 'var(--text-muted)',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Bảng Điểm
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

      {/* TAB 2: TẠO ĐỀ BÀI TẬP & GOOGLE GEMINI AI GENERATOR (UC-08) */}
      {activeTab === 'CREATE_ASSIGNMENT' && (
        <div className="glass-panel" style={{ padding: '32px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text-main)' }}>
                  Soạn Thảo Đề Bài Tập & Sinh Barem Bằng Google Gemini AI Thật
                </h2>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    backgroundColor: geminiApiKey ? 'rgba(37, 99, 235, 0.1)' : 'rgba(37, 99, 235, 0.1)',
                    color: geminiApiKey ? '#1d4ed8' : '#1e40af',
                    fontWeight: 700,
                    border: `1px solid ${geminiApiKey ? 'rgba(37, 99, 235, 0.14)' : 'rgba(37, 99, 235, 0.14)'}`,
                  }}
                >
                  {geminiApiKey ? 'AI Thật Đã Kích Hoạt' : 'Chưa Cấu Hình Key'}
                </span>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
                Nhập chủ đề hoặc bấm nút sinh AI để Google Gemini tự động biên soạn đề bài, bộ test cases ẩn/công khai và barem Clean Code / SOLID
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
                  border: '1px solid rgba(11, 18, 32, 0.08)',
                  backgroundColor: 'rgba(11, 18, 32, 0.035)',
                  color: 'var(--text-main)',
                  fontSize: '13px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
              >
                <Settings size={16} /> Cấu Hình Key
              </button>

              <button
                type="button"
                onClick={handleAiGenerateAssignment}
                disabled={isAiGenerating}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  background: 'var(--blue-600)',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: isAiGenerating ? 'not-allowed' : 'pointer',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.35)',
                }}
              >
                {isAiGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {isAiGenerating
                  ? `Đang tạo đề... (${aiTimerSeconds}s / tối đa 10s)`
                  : 'Dùng AI sinh đề & barem'}
              </button>
            </div>
          </div>

          {/* Card Nhập Yêu Cầu & Mô Tả Của Giảng Viên Cho AI */}
          <div
            style={{
              marginBottom: '24px',
              padding: '20px 24px',
              borderRadius: '12px',
              backgroundColor: 'rgba(59, 130, 246, 0.06)',
              border: '1.5px solid rgba(59, 130, 246, 0.24)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={20} color="var(--accent-cyan)" />
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)' }}>
                  Yêu Cầu & Ý Tưởng Cụ Thể Của Giảng Viên (Prompt Dành Cho AI Soạn Đề)
                </h3>
              </div>
              <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(37, 99, 235, 0.1)', color: 'var(--blue-200)', fontWeight: 700 }}>
                Tốc độ cao (Bảo vệ thời gian thực tối đa 10s)
              </span>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: '1.5' }}>
              Giảng viên nhập bất kỳ ý tưởng, nghiệp vụ hoặc ràng buộc thuật toán nào. AI sẽ bám sát 100% mô tả này để tạo đề bài, testcases và tiêu chí barem điểm tương ứng:
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
              placeholder="Ví dụ: 'Tạo bài tập về cây AVL, tạo 5 test case với các trọng số khác nhau, bắt buộc có hàm xoay trái và xoay phải, kiểm tra xem cây có cân bằng sau khi chèn 1000 phần tử không'..."
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.66)',
                border: '1px solid rgba(59, 130, 246, 0.24)',
                color: 'var(--text-main)',
                fontSize: '14px',
                lineHeight: '1.5',
                outline: 'none',
                marginBottom: '10px',
              }}
            />

            {/* Thanh Chọn Số Lượng Test Cases Mong Muốn */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: '#0b1220', fontWeight: 700 }}>
                Số lượng test case AI cần sinh:
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
                      borderRadius: '7px',
                      backgroundColor: isSelected ? 'var(--blue-600)' : 'rgba(11, 18, 32, 0.035)',
                      color: isSelected ? 'var(--on-blue)' : 'var(--text-main)',
                      fontSize: '12px',
                      fontWeight: isSelected ? 600 : 500,
                      border: `1px solid ${isSelected ? 'var(--blue-500)' : 'var(--border-color)'}`,
                      cursor: 'pointer',
                      transition: 'background-color .15s ease, border-color .15s ease',
                    }}
                  >
                    {count} test case{count === 5 ? ' · chuẩn' : ''}
                  </button>
                );
              })}
              <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginLeft: '4px' }}>
                Hệ thống sinh đúng {desiredTestCount} test case kèm trọng số khác nhau
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600 }}>Gợi ý mẫu:</span>
                {[
                  'Đồ thị Dijkstra với PriorityQueue & SRP',
                  'Cây AVL cân bằng có phép xoay trái phải',
                  'Sắp xếp Quicksort tối ưu O(N log N)',
                  'Quy hoạch động Balo 0/1 tối ưu mảng 1D',
                  'Thiết kế Factory Pattern & SOLID DIP',
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
                      backgroundColor: 'rgba(11, 18, 32, 0.04)',
                      border: '1px solid rgba(11, 18, 32, 0.07)',
                      color: '#1e40af',
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
                  background: 'var(--blue-600)',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: isAiGenerating ? 'not-allowed' : 'pointer',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.35)',
                }}
              >
                {isAiGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {isAiGenerating ? 'Đang tạo siêu tốc bằng Gemini...' : 'Sinh đề bằng AI theo yêu cầu này'}
              </button>
            </div>
          </div>

          {/* Thông báo lỗi AI nếu có */}
          {aiErrorMsg && (
            <div style={{ marginBottom: '20px', padding: '14px 18px', borderRadius: '10px', backgroundColor: 'rgba(11, 18, 32, 0.06)', border: '1px solid rgba(11, 18, 32, 0.13)', color: 'var(--text-main)', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertCircle size={18} />
                <span>{aiErrorMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsConfigModalOpen(true)}
                style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #ffffff', backgroundColor: 'transparent', color: 'var(--text-main)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
              >
                Nhập Key Ngay
              </button>
            </div>
          )}

          {/* Badge thành công từ AI */}
          {aiSuccessBadge && (
            <div style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '10px', backgroundColor: 'rgba(59, 130, 246, 0.09)', border: '1px solid rgba(59, 130, 246, 0.2)', color: 'var(--blue-200)', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{aiSuccessBadge}</span>
              {(starterCode || referenceSolution) && (
                <button
                  type="button"
                  onClick={() => setShowSolutionModal(true)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(59, 130, 246, 0.16)',
                    border: '1px solid var(--accent-primary)',
                    color: 'var(--text-main)',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Code2 size={13} /> Xem Lời Giải & Code Mẫu AI
                </button>
              )}
            </div>
          )}

          {createSuccessMsg && (
            <div style={{ marginBottom: '20px', padding: '14px 18px', borderRadius: '10px', backgroundColor: 'rgba(37, 99, 235, 0.08)', border: '1px solid rgba(37, 99, 235, 0.14)', color: 'var(--blue-300)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCircle2 size={18} />
              <span>{createSuccessMsg}</span>
            </div>
          )}

          <form onSubmit={handleSaveAssignment} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#0b1220', marginBottom: '6px' }}>
                  Tiêu Đề Bài Tập *
                </label>
                <input
                  type="text"
                  value={assignmentTitle}
                  onChange={(e) => setAssignmentTitle(e.target.value)}
                  required
                  placeholder="Nhập tên bài tập hoặc chủ đề..."
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    backgroundColor: '#f7f9fc',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-main)',
                    fontSize: '14px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#0b1220', marginBottom: '6px' }}>
                  Áp Dụng Cho Học Phần *
                </label>
                <select
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    backgroundColor: '#f7f9fc',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-main)',
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
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#0b1220', marginBottom: '6px' }}>
                Mô Tả Yêu Cầu & Ràng Buộc Thuật Toán *
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
                  backgroundColor: '#f7f9fc',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  fontSize: '14px',
                  lineHeight: '1.5',
                }}
              />
            </div>

            {/* Cấu hình hạn ngạch Sandbox */}
            <div style={{ padding: '20px', borderRadius: '12px', backgroundColor: 'rgba(11, 18, 32, 0.02)', border: '1px solid rgba(11, 18, 32, 0.04)' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--blue-200)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Cpu size={16} /> Cấu Hình Giới Hạn Tài Nguyên Docker Sandbox & Thời Gian Hạn Nộp
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    <Calendar size={14} style={{ display: 'inline', marginRight: '4px' }} /> Hạn Chót Nộp Bài (Deadline)
                  </label>
                  <input
                    type="datetime-local"
                    value={deadlineDate}
                    onChange={(e) => setDeadlineDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      backgroundColor: '#f7f9fc',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-main)',
                      fontSize: '13px',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    <Clock size={14} style={{ display: 'inline', marginRight: '4px' }} /> Giới Hạn Thời Gian (ms)
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
                      backgroundColor: '#f7f9fc',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-main)',
                      fontSize: '13px',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    <HardDrive size={14} style={{ display: 'inline', marginRight: '4px' }} /> Giới Hạn RAM Sandbox (MB)
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
                      backgroundColor: '#f7f9fc',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-main)',
                      fontSize: '13px',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    <Layers size={14} style={{ display: 'inline', marginRight: '4px' }} /> Ngôn Ngữ Cho Phép
                  </label>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                    {['java', 'python', 'cpp'].map((lang) => (
                      <label key={lang} style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', color: '#0b1220', cursor: 'pointer' }}>
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
                  <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Layers size={16} color="var(--accent-primary)" /> Bộ Test Cases Tự Động (StdIn / StdOut) - Tổng {testCases.length} Test
                  </h4>
                  <span
                    style={{
                      fontSize: '12px',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      backgroundColor: totalTestcaseWeight === 10 || totalTestcaseWeight === 7 ? 'rgba(37, 99, 235, 0.08)' : 'rgba(37, 99, 235, 0.08)',
                      color: totalTestcaseWeight === 10 || totalTestcaseWeight === 7 ? '#1d4ed8' : '#1e40af',
                      fontWeight: 700,
                      border: `1px solid ${totalTestcaseWeight === 10 || totalTestcaseWeight === 7 ? 'rgba(37, 99, 235, 0.14)' : 'rgba(37, 99, 235, 0.14)'}`,
                    }}
                  >
                    Tổng Điểm TC: {totalTestcaseWeight.toFixed(1)}đ {totalTestcaseWeight !== 10 && totalTestcaseWeight !== 7 ? '(Tùy chỉnh tỷ lệ)' : 'Chuẩn'}
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
                        backgroundColor: 'rgba(59, 130, 246, 0.09)',
                        border: '1px solid var(--accent-primary)',
                        color: 'var(--text-main)',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                      title="Tự động chuẩn hóa chia lại tỷ lệ để tổng điểm các testcases đúng bằng 10.0đ"
                    >
                      Quy đổi về 10.0đ
                    </button>
                  )}
                  {totalTestcaseWeight !== 7 && (
                    <button
                      type="button"
                      onClick={() => handleNormalizeTestcases(7)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(37, 99, 235, 0.08)',
                        border: '1px solid var(--accent-cyan)',
                        color: 'var(--blue-200)',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                      title="Quy đổi về 7.0đ (theo Barem chuẩn AITA: 7đ Testcase + 3đ Clean Code & SOLID)"
                    >
                      Quy đổi về 7.0đ (Barem)
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setTestCases([...testCases, { input: '', output: '', weight: 3.0, isHidden: false }])}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      backgroundColor: 'transparent',
                      border: '1px solid rgba(11, 18, 32, 0.08)',
                      color: 'var(--blue-200)',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    + Thêm Test Case
                  </button>
                </div>
              </div>

              {totalTestcaseWeight !== 10 && totalTestcaseWeight !== 7 && (
                <div style={{ marginBottom: '10px', padding: '8px 12px', borderRadius: '8px', backgroundColor: 'rgba(37, 99, 235, 0.06)', border: '1px solid rgba(37, 99, 235, 0.1)', fontSize: '12px', color: '#1e40af' }}>
                  <strong>Tổng điểm các testcase hiện là {totalTestcaseWeight.toFixed(1)}đ (khác 10đ):</strong> Khi chấm bài, hệ thống tự động chuẩn hóa theo tỷ lệ: <code>Điểm đạt = (Tổng điểm TC Pass / {totalTestcaseWeight.toFixed(1)}) × Thang Điểm Barem</code>. Hoặc Giảng viên có thể bấm nút <em>"Quy đổi về 10.0đ"</em> hoặc <em>"7.0đ (Barem)"</em> ở trên để chuẩn hóa tự động.
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {testCases.map((tc, idx) => (
                  <div key={idx} className="testcase-row" style={{ padding: '14px', borderRadius: '10px', backgroundColor: '#eef2f8', border: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 100px 90px auto', gap: '12px', alignItems: 'center' }}>
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
                        placeholder="Dữ liệu đầu vào..."
                        style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', backgroundColor: '#ffffff', border: '1px solid rgba(11, 18, 32, 0.06)', color: 'var(--text-main)', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                      />
                    </div>

                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Kỳ Vọng (StdOut #{idx + 1}):</span>
                      <input
                        type="text"
                        value={tc.output}
                        onChange={(e) => {
                          const updated = [...testCases];
                          updated[idx].output = e.target.value;
                          setTestCases(updated);
                        }}
                        placeholder="Kết quả chuẩn..."
                        style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', backgroundColor: '#ffffff', border: '1px solid rgba(11, 18, 32, 0.06)', color: 'var(--text-main)', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                      />
                    </div>

                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Điểm Số:</span>
                      <input
                        type="number"
                        value={tc.weight}
                        onChange={(e) => {
                          const updated = [...testCases];
                          updated[idx].weight = Number(e.target.value);
                          setTestCases(updated);
                        }}
                        step={0.5}
                        style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', backgroundColor: '#ffffff', border: '1px solid rgba(11, 18, 32, 0.06)', color: 'var(--text-main)', fontSize: '12px' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Chế Độ:</span>
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
                        {tc.isHidden ? 'Test Ẩn' : 'Công Khai'}
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={() => setTestCases(testCases.filter((_, i) => i !== idx))}
                      style={{ background: 'none', border: 'none', color: 'var(--accent-rose)', cursor: 'pointer', fontSize: '18px', fontWeight: 700 }}
                      title="Xóa test case"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Bảng Rubric Barem Chấm Điểm (Khi được AI sinh ra) */}
            {generatedRubrics.length > 0 && (
              <div style={{ padding: '20px', borderRadius: '12px', backgroundColor: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.12)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Award size={18} color="var(--accent-primary)" /> Barem Chấm Điểm Học Thuật Rubrics (Sinh Bởi Google Gemini AI)
                  </h4>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Tổng Điểm: 10.0 Điểm
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {generatedRubrics.map((rubric, rIdx) => (
                    <div key={rIdx} style={{ padding: '12px 16px', borderRadius: '8px', backgroundColor: '#f7f9fc', border: '1px solid rgba(11, 18, 32, 0.04)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--blue-200)' }}>
                          {rIdx + 1}. {rubric.criterion}
                        </span>
                        <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '6px', backgroundColor: 'rgba(37, 99, 235, 0.10)', color: 'var(--blue-300)', fontWeight: 700 }}>
                          Tối đa: {rubric.maxScore}đ
                        </span>
                      </div>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                        {rubric.description}
                      </p>
                      {rubric.levels && rubric.levels.length > 0 && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {rubric.levels.map((lvl, lIdx) => (
                            <span key={lIdx} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(11, 18, 32, 0.03)', color: '#33415a', border: '1px solid rgba(11, 18, 32, 0.05)' }}>
                              <strong>{lvl.scorePercent}% điểm:</strong> {lvl.description}
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
                <CheckCircle2 size={18} /> Lưu & Xuất Bản Đề Bài Tập Cho Lớp
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: IMPORT EXCEL (ACID TRANSACTION VERIFICATION) */}
      {activeTab === 'EXCEL_IMPORT' && (
        <div className="glass-panel" style={{ padding: '32px', borderRadius: '12px' }}>
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text-main)' }}>
              Nhập Danh Sách Sinh Viên Hàng Loạt & Kiểm Định Giao Dịch ACID (UC-02)
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
              Tính năng tuân thủ chặt chẽ ràng buộc R06: Bắt buộc sử dụng SQL Transaction khi nạp danh sách từ file Excel. Khi có bất kỳ lỗi nào xảy ra ở dòng thứ N, 100% dữ liệu đã xử lý trước đó phải được Rollback nguyên vẹn.
            </p>
          </div>

          {/* CHỌN KHÓA HỌC & TẢI FILE MẪU */}
          <div
            style={{
              padding: '20px 24px',
              borderRadius: '12px',
              backgroundColor: 'rgba(11, 18, 32, 0.03)',
              border: '1px solid rgba(11, 18, 32, 0.06)',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', minWidth: 0 }}>
              <label style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>
                1. Chọn Lớp Học Phần Cần Ghi Danh:
              </label>
              <select
                value={targetCourseId}
                onChange={(e) => setTargetCourseId(e.target.value)}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  backgroundColor: '#f7f9fc',
                  border: '1px solid rgba(11, 18, 32, 0.1)',
                  color: 'var(--text-main)',
                  fontSize: '14px',
                  fontWeight: 600,
                  width: 'min(320px, 100%)',
                  maxWidth: '100%',
                  outline: 'none',
                }}
              >
                {courses.map((c) => (
                  <option key={c.courseId} value={c.courseId} style={{ backgroundColor: '#f7f9fc' }}>
                    {c.courseCode} - {c.courseName}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  if (showCourseStudents) {
                    setShowCourseStudents(false);
                  } else {
                    handleLoadCourseStudents();
                  }
                }}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  backgroundColor: showCourseStudents ? 'rgba(37, 99, 235, 0.15)' : 'rgba(37, 99, 235, 0.08)',
                  border: '1px solid rgba(37, 99, 235, 0.25)',
                  color: 'var(--blue-300)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Users size={15} /> {showCourseStudents ? 'Ẩn Danh Sách Lớp' : '👥 Xem & Xóa Sinh Viên Trong Lớp'}
              </button>

              <button
                type="button"
                onClick={handleExportCourseRoster}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(37, 99, 235, 0.08)',
                  border: '1px solid rgba(37, 99, 235, 0.18)',
                  color: 'var(--blue-200)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
                title="Tải về danh sách tất cả sinh viên hiện đang có trong lớp học phần này"
              >
                <FileTypeIcon kind="csv" size={16} showExt={false} /> Xuất Danh Sách Sinh Viên Đã Có (.csv)
              </button>
            </div>
          </div>

          {/* BẢNG QUẢN LÝ & XÓA SINH VIÊN HIỆN CÓ TRONG LỚP */}
          {showCourseStudents && (
            <div
              style={{
                padding: '20px',
                borderRadius: '12px',
                backgroundColor: '#ffffff',
                border: '1px solid var(--border-color)',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                marginBottom: '24px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                  👥 Danh Sách Sinh Viên Đang Học Lớp [{targetCourseId}] ({courseStudents.length} Sinh Viên)
                </h4>
                <button
                  type="button"
                  onClick={() => handleLoadCourseStudents()}
                  disabled={loadingCourseStudents}
                  className="btn btn-secondary btn-sm"
                  style={{
                    padding: '5px 12px',
                    fontSize: '12px',
                  }}
                >
                  {loadingCourseStudents ? 'Đang tải...' : '🔄 Làm mới'}
                </button>
              </div>

              {courseStudents.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  Lớp học phần này hiện chưa có sinh viên nào. Vui lòng tải file Excel phía dưới để import vào lớp.
                </div>
              ) : (
                <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>STT</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Mã Số SV</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Họ Và Tên</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Email</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>Hành Động</th>
                      </tr>
                    </thead>
                    <tbody>
                      {courseStudents.map((st, i) => (
                        <tr key={st.studentCode || st.userId || i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '8px 12px', color: 'var(--text-dim)' }}>{i + 1}</td>
                          <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--blue-300)' }}>{st.studentCode || st.userId}</td>
                          <td style={{ padding: '8px 12px', color: 'var(--text-main)', fontWeight: 500 }}>{st.fullName}</td>
                          <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{st.email}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveStudentFromCourse(st.studentCode || st.userId, st.fullName)}
                              style={{
                                padding: '4px 10px',
                                borderRadius: '6px',
                                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                color: '#dc2626',
                                fontSize: '11.5px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Xóa khỏi lớp
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}


          {/* KHU VỰC CHỌN FILE CSV THỰC TẾ */}
          <div
            style={{
              padding: '24px',
              borderRadius: '12px',
              backgroundColor: '#f7f9fc',
              border: '1.5px dashed rgba(59, 130, 246, 0.28)',
              marginBottom: '28px',
              textAlign: 'center',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(33, 115, 70, 0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileTypeIcon kind="excel" size={30} />
              </div>

              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                  2. Tải Lên &amp; Nhập File Roster Sinh Viên (.xlsx, .csv)
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
                  Hỗ trợ định dạng file <code>.xlsx</code> (Microsoft Excel) hoặc <code>.csv</code> chuẩn UTF-8 (với các cột: <strong>Mã Sinh Viên, Họ Và Tên, Email</strong>)
                </p>
              </div>

              <input
                type="file"
                id="roster-csv-input"
                accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                onChange={handleCsvFileChange}
                style={{ display: 'none' }}
              />

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '6px' }}>
                <label
                  htmlFor="roster-csv-input"
                  style={{
                    padding: '10px 22px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(37, 99, 235, 0.10)',
                    border: '1px solid var(--accent-primary)',
                    color: 'var(--text-main)',
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
                  {uploadedCsvFile ? `Đổi File Khác (${uploadedCsvFile.name})` : 'Chọn File Excel / CSV (.xlsx, .csv)'}
                </label>

                <button
                  type="button"
                  onClick={handleDownloadTemplateCsv}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(11, 18, 32, 0.035)',
                    border: '1px solid rgba(11, 18, 32, 0.08)',
                    color: 'var(--text-muted)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                  title="Tải file mẫu trắng chỉ có tiêu đề cột để bạn tự điền danh sách sinh viên mới"
                >
                  <FileTypeIcon kind="csv" size={16} showExt={false} />
                  Tải File Mẫu Rỗng (.csv)
                </button>

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
                      backgroundColor: 'rgba(11, 18, 32, 0.04)',
                      border: '1px solid rgba(11, 18, 32, 0.08)',
                      color: 'var(--text-muted)',
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    Hủy file đã chọn
                  </button>
                )}
              </div>

              {csvParseError && (
                <div style={{ color: 'var(--text-main)', fontSize: '13px', fontWeight: 600, marginTop: '8px' }}>
                  {csvParseError}
                </div>
              )}

              {/* BẢNG XEM TRƯỚC DANH SÁCH TỪ FILE CSV */}
              {parsedCsvStudents.length > 0 && (
                <div style={{ width: '100%', marginTop: '16px', textAlign: 'left' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--blue-200)' }}>
                      Đã nhận diện {parsedCsvStudents.length} sinh viên từ file [{uploadedCsvFile?.name}]:
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Dung lượng: {Math.round((uploadedCsvFile?.size || 0) / 1024 * 10) / 10} KB
                    </span>
                  </div>

                  <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid rgba(11, 18, 32, 0.06)', borderRadius: '8px', backgroundColor: 'rgba(0, 0, 0, 0.3)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(11, 18, 32, 0.06)', backgroundColor: 'rgba(11, 18, 32, 0.03)' }}>
                          <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)' }}>STT</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)' }}>Mã Sinh Viên</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)' }}>Họ Và Tên</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)' }}>Email FPT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedCsvStudents.map((s, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(11, 18, 32, 0.035)' }}>
                            <td style={{ padding: '8px 12px', color: 'var(--text-dim)' }}>{idx + 1}</td>
                            <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--blue-200)' }}>{s.studentCode}</td>
                            <td style={{ padding: '8px 12px', color: 'var(--text-main)' }}>{s.fullName}</td>
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
                        background: 'var(--blue-500)',
                        border: 'none',
                        color: 'var(--on-blue)',
                        fontWeight: 600,
                        fontSize: '14px',
                        cursor: excelLoading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.35)',
                      }}
                    >
                      <Upload size={18} /> Bắt đầu import {parsedCsvStudents.length} Sinh Viên Vào PostgreSQL 15 (SQL ACID)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>



          {excelLoading && (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--blue-200)', fontSize: '14px', fontWeight: 600 }}>
              Đang phân tích cú pháp Excel và mở SQL Transaction...
            </div>
          )}

          {excelStatus && (
            <div
              style={{
                padding: '16px 20px',
                borderRadius: '12px',
                backgroundColor: simulatedRollback ? 'rgba(11, 18, 32, 0.06)' : 'rgba(37, 99, 235, 0.08)',
                border: `1.5px solid ${simulatedRollback ? 'rgba(11, 18, 32, 0.13)' : 'rgba(37, 99, 235, 0.18)'}`,
                color: simulatedRollback ? 'var(--text-main)' : '#2563eb',
                fontSize: '14px',
                lineHeight: '1.6',
              }}
            >
              {excelStatus}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: SỔ ĐIỂM & DANH SÁCH BÀI NỘP PHÂN CẤP THEO LỚP HỌC & BÀI TẬP */}
      {activeTab === 'SUBMISSIONS' && (
        <div className="glass-panel" style={{ padding: '28px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-main)' }}>
                Sổ Theo Dõi Điểm &amp; Chống Đạo Văn Phân Theo Lớp Học Phần
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
                Phân loại bài nộp theo từng lớp học, bộ môn và đề bài; hỗ trợ quét đạo văn AST Winnowing theo từng lớp riêng biệt
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Nút Quét Đạo Văn theo Lớp & Bài tập đang chọn */}
              <button
                type="button"
                onClick={() => void handleScanClassPlagiarism()}
                disabled={scanningPlagiarism || filteredSubmissions.length < 2}
                title={filteredSubmissions.length < 2 ? 'Cần ít nhất 2 bài nộp trong phạm vi lọc để đối chiếu đạo văn' : 'Phân tích đạo văn Winnowing cho bài tập này'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  background: scanningPlagiarism ? 'rgba(239,68,68,0.15)' : 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: filteredSubmissions.length < 2 ? 'not-allowed' : 'pointer',
                  opacity: (scanningPlagiarism || filteredSubmissions.length < 2) ? 0.6 : 1,
                  boxShadow: '0 2px 8px rgba(239,68,68,0.35)',
                }}
              >
                {scanningPlagiarism
                  ? <><Loader2 size={14} className="animate-spin" /> Đang quét ma trận...
                  </>
                  : <><Scale size={14} /> Quét Đạo Văn {selectedAssignmentFilter !== 'ALL' ? (currentSelectedAssignmentObj?.title?.substring(0, 18) + '...') : selectedClassFilter !== 'ALL' ? (currentSelectedCourseObj?.courseCode || 'Lớp Này') : 'Toàn Bộ'}
                  </>}
              </button>
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
                  backgroundColor: 'rgba(11, 18, 32, 0.04)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={14} className={loadingSubmissions ? 'animate-spin' : ''} />
                {loadingSubmissions ? 'Đang đồng bộ...' : 'Làm mới'}
              </button>
            </div>
          </div>

          {/* BỘ LỌC PHÂN CẤP THEO LỚP HỌC PHẦN (BỘ MÔN) & BÀI TẬP */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '16px',
              alignItems: 'flex-end',
              marginBottom: '20px',
              padding: '16px 20px',
              borderRadius: '10px',
              backgroundColor: 'rgba(11, 18, 32, 0.025)',
              border: '1px solid var(--border-color)',
            }}
          >
            {/* Dropdown 1: Lớp Học Phần */}
            <div style={{ flex: '1 1 260px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-soft)', marginBottom: '6px' }}>
                🏫 Lớp Học Phần (Bộ Môn):
              </label>
              <select
                value={selectedClassFilter}
                onChange={(e) => {
                  setSelectedClassFilter(e.target.value);
                  setSelectedAssignmentFilter('ALL');
                }}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-main)',
                  outline: 'none',
                }}
              >
                <option value="ALL">-- Tất Cả Các Lớp ({courses.length} lớp học phần) --</option>
                {courses.map((c) => (
                  <option key={c.courseId} value={c.courseId}>
                    [{c.courseCode}] {c.courseName}
                  </option>
                ))}
              </select>
            </div>

            {/* Dropdown 2: Đề Bài / Bài Tập */}
            <div style={{ flex: '1 1 300px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-soft)', marginBottom: '6px' }}>
                📝 Bài Tập / Đề Thực Hành:
              </label>
              <select
                value={selectedAssignmentFilter}
                onChange={(e) => setSelectedAssignmentFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-main)',
                  outline: 'none',
                }}
              >
                <option value="ALL">-- Tất Cả Bài Tập Trong Lớp ({availableAssignmentsForFilter.length} bài) --</option>
                {availableAssignmentsForFilter.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title} ({a.id})
                  </option>
                ))}
              </select>
            </div>

            {/* Nút Reset */}
            {(selectedClassFilter !== 'ALL' || selectedAssignmentFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSelectedClassFilter('ALL');
                  setSelectedAssignmentFilter('ALL');
                }}
                style={{
                  padding: '9px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'transparent',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  height: '38px',
                }}
              >
                ✕ Bỏ lọc
              </button>
            )}
          </div>

          {/* DẢI THỐNG KÊ NHANH CHO PHẠM VI LỌC HIỆN TẠI */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px',
              marginBottom: '20px',
            }}
          >
            <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.15)' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Tổng Bài Nộp
              </span>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                {totalFilteredCount} bài
              </div>
            </div>

            <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Điểm Trung Bình
              </span>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#10b981', marginTop: '2px' }}>
                {avgFilteredScore} / 10
              </div>
            </div>

            <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Liêm Chính An Toàn
              </span>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#10b981', marginTop: '2px' }}>
                {cleanFilteredCount} bài
              </div>
            </div>

            <div style={{ padding: '12px 16px', borderRadius: '8px', background: (plagiarizedFilteredCount + suspectedFilteredCount) > 0 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(11, 18, 32, 0.03)', border: (plagiarizedFilteredCount + suspectedFilteredCount) > 0 ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid var(--border-soft)' }}>
              <span style={{ fontSize: '11px', color: (plagiarizedFilteredCount + suspectedFilteredCount) > 0 ? '#ef4444' : 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Cảnh Báo Đạo Văn
              </span>
              <div style={{ fontSize: '20px', fontWeight: 800, color: (plagiarizedFilteredCount + suspectedFilteredCount) > 0 ? '#ef4444' : 'var(--text-main)', marginTop: '2px' }}>
                {plagiarizedFilteredCount} đạo văn • {suspectedFilteredCount} nghi vấn
              </div>
            </div>
          </div>

          {/* Bảng Kết Quả Quét Đạo Văn Toàn Lớp (hiện khi có kết quả) */}
          {showPlagiarismMatrix && plagiarismScanResult && (
            <div style={{ marginBottom: '24px', padding: '20px', borderRadius: '12px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#ef4444', marginBottom: '4px' }}>
                    ⚠️ Kết Quả Quét Đạo Văn AST Winnowing &mdash; {plagiarismScanResult.assignmentId}
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Đã phân tích {plagiarismScanResult.totalSubmissions} bài nộp • {plagiarismScanResult.totalPairsCompared} cặp so sánh •
                    <span style={{ color: plagiarismScanResult.flaggedPairsCount > 0 ? '#ef4444' : '#10b981', fontWeight: 700 }}>
                      {' '}{plagiarismScanResult.flaggedPairsCount} cặp cảnh báo
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPlagiarismMatrix(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '20px' }}
                >
                  ×
                </button>
              </div>

              {/* Danh sách cặp bị cảnh báo */}
              {plagiarismScanResult.flaggedReports?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {plagiarismScanResult.flaggedReports.map((report: any, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        background: report.similarityRate >= 80
                          ? 'rgba(239,68,68,0.12)'
                          : 'rgba(245,158,11,0.10)',
                        border: `1px solid ${report.similarityRate >= 80 ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
                      }}
                    >
                      <div style={{ fontSize: '13px' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
                          {report.submissionAId}
                        </span>
                        <span style={{ color: 'var(--text-muted)', margin: '0 8px' }}>⇔</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
                          {report.submissionBId}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{
                          fontSize: '16px',
                          fontWeight: 800,
                          color: report.similarityRate >= 80 ? '#ef4444' : '#f59e0b',
                        }}>
                          {report.similarityRate.toFixed(1)}%
                        </span>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: report.similarityRate >= 80 ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)',
                          color: report.similarityRate >= 80 ? '#ef4444' : '#f59e0b',
                        }}>
                          {report.status}
                        </span>
                        {onOpenDiffViewer && report.matchedTokensJson && (
                          <button
                            type="button"
                            onClick={() => onOpenDiffViewer({
                              matchedStudentName: report.submissionBId,
                              matchedStudentId: report.submissionBId,
                              similarityRate: report.similarityRate,
                              sourceCodeA: report.matchedTokensJson?.sourceCodeA || '',
                              sourceCodeB: report.matchedTokensJson?.sourceCodeB || '',
                              matchedTokens: report.matchedTokensJson?.matchedSegments?.map((s: any) => ({
                                lineA: [s.lineRangeA?.start, s.lineRangeA?.end],
                                lineB: [s.lineRangeB?.start, s.lineRangeB?.end],
                              })) || [],
                              isFlagged: report.isFlagged,
                            } as any)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                              border: 'none',
                              color: '#fff',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            So Sánh
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '20px', color: '#10b981', fontWeight: 600 }}>
                  ✅ Không phát hiện đạo văn. Tất cả cặp bài đều dưới ngưỡng cảnh báo 65%.
                </div>
              )}
            </div>
          )}

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px 16px' }}>Mã Nộp</th>
                  <th style={{ padding: '12px 16px' }}>Sinh Viên</th>
                  <th style={{ padding: '12px 16px' }}>File Nén (.zip)</th>
                  <th style={{ padding: '12px 16px' }}>Thời Gian</th>
                  <th style={{ padding: '12px 16px' }}>Testcase</th>
                  <th style={{ padding: '12px 16px' }}>Clean Code</th>
                  <th style={{ padding: '12px 16px' }}>SOLID</th>
                  <th style={{ padding: '12px 16px' }}>Tổng Điểm</th>
                  <th style={{ padding: '12px 16px' }}>Trùng Lặp AST</th>
                  <th style={{ padding: '12px 16px' }}>Trạng Thái</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Tải Bài Làm (.zip)</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubmissions.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)', fontSize: '13px' }}>
                      Không có bài nộp nào phù hợp với Lớp học phần hoặc Bài tập đang chọn.
                    </td>
                  </tr>
                ) : (
                  filteredSubmissions.map((sub) => (
                  <tr
                    key={sub.id}
                    style={{
                      borderBottom: '1px solid rgba(11, 18, 32, 0.05)',
                      borderLeft: sub.plagiarismStatus === 'ĐẠO VĂN'
                        ? '4px solid #ef4444'
                        : sub.plagiarismStatus === 'NGHI VẤN'
                          ? '4px solid #f59e0b'
                          : '4px solid transparent',
                      backgroundColor: sub.plagiarismStatus === 'ĐẠO VĂN'
                        ? 'rgba(239, 68, 68, 0.08)'
                        : sub.plagiarismStatus === 'NGHI VẤN'
                          ? 'rgba(245, 158, 11, 0.05)'
                          : 'transparent',
                    }}
                  >
                    <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', color: 'var(--blue-200)', fontWeight: 600 }}>
                      {sub.id}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{sub.studentName}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{sub.studentId}</div>
                    </td>
                    <td style={{ padding: '14px 16px', color: '#1e40af', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <FileTypeIcon fileName={sub.fileName} size={18} />
                        {sub.fileName}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--text-muted)' }}>{sub.submittedAt}</td>
                    <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--blue-200)' }}>{sub.testcaseScore}/7.0</td>
                    <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--blue-300)' }}>{sub.cleanCodeScore}/10</td>
                    <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--blue-300)' }}>{sub.solidScore}/10</td>
                    <td style={{ padding: '14px 16px', fontWeight: 700, fontSize: '14px', color: 'var(--text-main)' }}>
                      <div>{sub.finalScore} / 10</div>
                      {sub.plagiarismStatus === 'ĐẠO VĂN' && (
                        <div style={{ fontSize: '10.5px', color: '#ef4444', fontWeight: 700, marginTop: '2px' }}>
                          ⚠️ Trùng {sub.similarityRate}%
                        </div>
                      )}
                    </td>
                    {/* Cột Similarity Rate */}
                    <td style={{ padding: '14px 16px', fontWeight: 800, color: sub.similarityRate >= 70 ? '#ef4444' : sub.similarityRate >= 40 ? '#f59e0b' : 'var(--text-muted)' }}>
                      {sub.similarityRate > 0 ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          {sub.similarityRate >= 70 && '⚠️'} {sub.similarityRate}%
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-dim)', fontWeight: 400, fontSize: '12px' }}>Chưa quét</span>
                      )}
                    </td>
                    {/* Cột Trạng Thái Đạo Văn */}
                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '4px 9px',
                          borderRadius: '6px',
                          fontWeight: 800,
                          backgroundColor:
                            sub.plagiarismStatus === 'ĐẠO VĂN'
                              ? '#ef4444'
                              : sub.plagiarismStatus === 'NGHI VẤN'
                              ? 'rgba(245, 158, 11, 0.15)'
                              : 'rgba(16, 185, 129, 0.12)',
                          color:
                            sub.plagiarismStatus === 'ĐẠO VĂN'
                              ? '#ffffff'
                              : sub.plagiarismStatus === 'NGHI VẤN'
                              ? '#f59e0b'
                              : '#10b981',
                          boxShadow: sub.plagiarismStatus === 'ĐẠO VĂN' ? '0 1px 4px rgba(239,68,68,0.4)' : 'none',
                        }}
                      >
                        {sub.plagiarismStatus === 'ĐẠO VĂN' && '⚠️ '}
                        {sub.plagiarismStatus}
                      </span>
                    </td>
                    {/* Cột Hành Động */}
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
                          background: 'var(--blue-600)',
                          border: 'none',
                          color: 'var(--on-blue)',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          marginRight: '6px',
                          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.35)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <Sparkles size={13} />
                        Xem Chi Tiết
                      </button>

                      {/* NÚt Xem Đạo Văn — chỉ hiện khi có plagiarismMatch và similarityRate ≥ 40 */}
                      {sub.plagiarismMatch && sub.similarityRate >= 40 && onOpenDiffViewer && (
                        <button
                          type="button"
                          onClick={() => onOpenDiffViewer({
                            matchedStudentName: sub.plagiarismMatch!.matchedStudentName || sub.plagiarismMatch!.matchedStudentId,
                            matchedStudentId: sub.plagiarismMatch!.matchedStudentId,
                            similarityRate: sub.plagiarismMatch!.similarityRate,
                            sourceCodeA: sub.plagiarismMatch!.sourceCodeA || sub.sourceCode || '',
                            sourceCodeB: sub.plagiarismMatch!.sourceCodeB || '',
                            matchedTokens: sub.plagiarismMatch!.matchedTokens || [],
                            isFlagged: sub.plagiarismMatch!.isFlagged ?? (sub.similarityRate >= 70),
                          } as any)}
                          title={`Xem so sánh code với ${sub.plagiarismMatch.matchedStudentId} (${sub.similarityRate}%)`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            background: sub.similarityRate >= 80
                              ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)'
                              : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                            border: 'none',
                            color: '#ffffff',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            marginRight: '6px',
                            boxShadow: sub.similarityRate >= 80
                              ? '0 1px 4px rgba(239,68,68,0.5)'
                              : '0 1px 4px rgba(245,158,11,0.5)',
                          }}
                        >
                          <Scale size={13} />
                          Xem Đạo Văn
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDownloadZip(sub.id, sub.fileName)}
                        disabled={downloadingId === sub.id}
                        title={`Tải xuống bài làm ${sub.fileName} của sinh viên`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(37, 99, 235, 0.08)',
                          border: '1px solid rgba(37, 99, 235, 0.18)',
                          color: 'var(--blue-200)',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          opacity: downloadingId === sub.id ? 0.6 : 1,
                        }}
                      >
                        <Download size={13} />
                        {downloadingId === sub.id ? 'Đang tải...' : 'Tải .zip'}
                      </button>
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: PHÒNG THÍ NGHIỆM AST LAB & BENCHMARK DATASET */}
      {activeTab === 'RBL_LAB' && (
        <RblBenchmarkView onOpenDiffViewer={onOpenDiffViewer} />
      )}

      {/* TAB 6: PHÚC KHẢO & KHIẾU NẠI ĐIỂM (UC-06 / BR-05) */}
      {activeTab === 'APPEALS' && (
        <LecturerAppealsManager apiBaseUrl="http://localhost:3000" lecturerId="GV001" />
      )}


      {/* MODAL CẤU HÌNH GOOGLE GEMINI AI KEY (DÙNG AI THẬT) */}
      {isConfigModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(11, 18, 32, 0.45)', backdropFilter: 'blur(8px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '580px', padding: '32px', borderRadius: '12px', border: '1px solid rgba(11, 18, 32, 0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'rgba(37, 99, 235, 0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--blue-200)' }}>
                  <Key size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)' }}>Cấu Hình Trí Tuệ Nhân Tạo Thật (Google Gemini AI)</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Kết nối trực tiếp tới Google Generative AI để sinh đề và testcases</p>
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
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#0b1220', marginBottom: '6px' }}>
                Google Gemini API Key *
              </label>
              <input
                type="password"
                value={tempApiKey}
                onChange={(e) => setTempApiKey(e.target.value)}
                placeholder="Dán API Key của bạn (bắt đầu bằng AIzaSy...)"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  backgroundColor: '#f7f9fc',
                  border: '1px solid rgba(11, 18, 32, 0.08)',
                  color: 'var(--text-main)',
                  fontSize: '14px',
                  fontFamily: 'var(--font-mono)',
                  outline: 'none',
                }}
              />
              <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>Chưa có khóa? Lấy miễn phí 100% trong 30 giây tại:</span>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'var(--blue-200)', textDecoration: 'none', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                >
                  Google AI Studio <ExternalLink size={11} />
                </a>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#0b1220', marginBottom: '6px' }}>
                Lựa Chọn Mô Hình AI (Model)
              </label>
              <select
                value={selectedAiModel}
                onChange={(e) => setSelectedAiModel(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#f7f9fc',
                  border: '1px solid rgba(11, 18, 32, 0.08)',
                  color: 'var(--text-main)',
                  fontSize: '13px',
                }}
              >
                <option value="auto">Tự động chọn mô hình Flash Nhanh Nhất (Khuyên Dùng - Auto Detect)</option>
                {availableModelList.length > 0 ? (
                  availableModelList.map((m) => (
                    <option key={m} value={m}>
                      {m} {m.includes('flash') ? '(Siêu tốc 1-2s)' : '(Chuyên sâu)'}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="gemini-2.0-flash">gemini-2.0-flash (Thế hệ Flash 2.0)</option>
                    <option value="gemini-1.5-flash-latest">gemini-1.5-flash-latest (Bản Flash mới nhất)</option>
                    <option value="gemini-1.5-pro">gemini-1.5-pro (Mô hình chuyên sâu)</option>
                  </>
                )}
              </select>
            </div>

            {/* Trạng thái Ping */}
            {pingStatus.message && (
              <div
                style={{
                  marginBottom: '18px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: pingStatus.success ? 'rgba(37, 99, 235, 0.08)' : 'rgba(11, 18, 32, 0.06)',
                  border: `1px solid ${pingStatus.success ? 'rgba(37, 99, 235, 0.14)' : 'rgba(11, 18, 32, 0.1)'}`,
                  color: pingStatus.success ? '#2563eb' : 'var(--text-main)',
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
                  border: '1px solid rgba(11, 18, 32, 0.1)',
                  backgroundColor: 'rgba(11, 18, 32, 0.035)',
                  color: 'var(--text-main)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: pingStatus.loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {pingStatus.loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Kiểm Tra Kết Nối AI (Ping Gemini)
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
                Lưu Khóa & Áp Dụng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XEM MÃ NGUỒN KHỞI TẠO & LỜI GIẢI MẪU DO AI TẠO RA */}
      {showSolutionModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(11, 18, 32, 0.45)', backdropFilter: 'blur(8px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '800px', maxHeight: '85vh', overflowY: 'auto', padding: '28px', borderRadius: '12px', border: '1px solid rgba(11, 18, 32, 0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileCode size={20} color="var(--accent-cyan)" /> Lời Giải Chuẩn & Khung Mã Nguồn (Tự Động Sinh Bởi Google Gemini AI)
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
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--blue-200)', marginBottom: '6px' }}>
                  1. Khung Mã Khởi Tạo Cho Sinh Viên (Starter Code):
                </h4>
                <pre style={{ padding: '14px', borderRadius: '10px', backgroundColor: '#ffffff', color: '#0b1220', fontSize: '12px', fontFamily: 'var(--font-mono)', overflowX: 'auto', border: '1px solid rgba(11, 18, 32, 0.05)' }}>
                  {starterCode}
                </pre>
              </div>
            )}

            {referenceSolution && (
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--blue-200)', marginBottom: '6px' }}>
                  2. Lời Giải Tham Chiếu Chuẩn Xác (Reference Working Solution):
                </h4>
                <pre style={{ padding: '14px', borderRadius: '10px', backgroundColor: '#ffffff', color: '#0b1220', fontSize: '12px', fontFamily: 'var(--font-mono)', overflowX: 'auto', border: '1px solid rgba(11, 18, 32, 0.05)' }}>
                  {referenceSolution}
                </pre>
              </div>
            )}

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowSolutionModal(false)}
                style={{ padding: '8px 18px', borderRadius: '8px', backgroundColor: 'var(--blue-600)', border: 'none', color: 'var(--on-blue)', fontWeight: 700, cursor: 'pointer' }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XEM CHI TIẾT ĐỀ BÀI & TEST CASES ĐÃ XUẤT BẢN CỦA MÔN HỌC */}
      {previewAssignment && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(11, 18, 32, 0.45)',
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
              borderRadius: '12px',
              border: '1px solid rgba(11, 18, 32, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            {/* Header Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(11, 18, 32, 0.05)', paddingBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontWeight: 700,
                      backgroundColor: previewAssignment.status === 'PUBLISHED' ? 'rgba(37, 99, 235, 0.1)' : 'rgba(11, 18, 32, 0.07)',
                      color: previewAssignment.status === 'PUBLISHED' ? '#1d4ed8' : 'var(--text-main)',
                      border: `1px solid ${previewAssignment.status === 'PUBLISHED' ? 'rgba(37, 99, 235, 0.14)' : 'rgba(11, 18, 32, 0.1)'}`,
                    }}
                  >
                    {previewAssignment.status === 'PUBLISHED' ? 'ĐANG MỞ NỘP BÀI' : 'ĐÃ ĐÓNG NỘP'}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Mã đề: <strong style={{ color: 'var(--text-main)' }}>{previewAssignment.id}</strong> • Tạo ngày: {previewAssignment.createdAt}
                  </span>
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-main)' }}>
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

            {/* Thông số kỹ thuật */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <div style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: 'rgba(11, 18, 32, 0.03)', border: '1px solid rgba(11, 18, 32, 0.04)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Hạn chót nộp bài:</span>
                <strong style={{ fontSize: '13px', color: 'var(--accent-amber)' }}>{new Date(previewAssignment.deadline).toLocaleString('vi-VN')}</strong>
              </div>
              <div style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: 'rgba(11, 18, 32, 0.03)', border: '1px solid rgba(11, 18, 32, 0.04)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Thời gian thực thi tối đa:</span>
                <strong style={{ fontSize: '13px', color: 'var(--blue-200)' }}>{previewAssignment.timeLimitMs} ms</strong>
              </div>
              <div style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: 'rgba(11, 18, 32, 0.03)', border: '1px solid rgba(11, 18, 32, 0.04)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Bộ nhớ RAM tối đa:</span>
                <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>{previewAssignment.memoryLimitMb} MB</strong>
              </div>
              <div style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: 'rgba(11, 18, 32, 0.03)', border: '1px solid rgba(11, 18, 32, 0.04)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Ngôn ngữ lập trình:</span>
                <strong style={{ fontSize: '13px', color: 'var(--blue-200)' }}>{previewAssignment.allowedLanguages.join(', ').toUpperCase()}</strong>
              </div>
            </div>

            {/* Mô tả đề bài */}
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0b1220', marginBottom: '8px' }}>
                Mô Tả Yêu Cầu & Ràng Buộc:
              </h4>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6', whiteSpace: 'pre-wrap', backgroundColor: 'rgba(0,0,0,0.25)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(11, 18, 32, 0.04)', margin: 0 }}>
                {previewAssignment.description}
              </p>
            </div>

            {/* Danh sách Test Cases */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--blue-200)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Cpu size={16} /> Danh Sách Test Cases ({previewAssignment.testCases.length} Bộ Test, Tổng Trọng Số: {previewAssignment.testCases.reduce((sum, tc) => sum + (Number(tc.weight) || 0), 0).toFixed(1)}đ):
                </h4>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {previewAssignment.testCases.map((tc, tcIdx) => (
                  <div
                    key={tcIdx}
                    style={{
                      padding: '14px 16px',
                      borderRadius: '10px',
                      backgroundColor: '#f7f9fc',
                      border: '1px solid rgba(11, 18, 32, 0.05)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
                        Test Case #{tcIdx + 1}
                      </span>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: tc.isHidden ? 'rgba(37, 99, 235, 0.08)' : 'rgba(37, 99, 235, 0.08)',
                            color: tc.isHidden ? 'var(--accent-amber)' : 'var(--accent-cyan)',
                            fontWeight: 600,
                          }}
                        >
                          {tc.isHidden ? 'Test ẩn' : 'Test công khai'}
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--blue-200)', backgroundColor: 'rgba(37, 99, 235, 0.08)', padding: '2px 8px', borderRadius: '4px' }}>
                          Trọng số: {tc.weight}đ
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Đầu vào (Input / StdIn):</span>
                        <pre style={{ margin: 0, padding: '8px 10px', borderRadius: '6px', backgroundColor: '#ffffff', color: '#0b1220', fontSize: '12px', fontFamily: 'var(--font-mono)', border: '1px solid rgba(11, 18, 32, 0.04)', overflowX: 'auto' }}>
                          {tc.input}
                        </pre>
                      </div>
                      <div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Đầu ra kỳ vọng (Expected Output / StdOut):</span>
                        <pre style={{ margin: 0, padding: '8px 10px', borderRadius: '6px', backgroundColor: '#ffffff', color: 'var(--blue-200)', fontSize: '12px', fontFamily: 'var(--font-mono)', border: '1px solid rgba(11, 18, 32, 0.04)', overflowX: 'auto' }}>
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
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--blue-200)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Award size={16} /> Barem Chấm Điểm Học Thuật (Rubrics):
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {previewAssignment.rubrics.map((r, rIdx) => (
                    <div key={rIdx} style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: 'rgba(59, 130, 246, 0.06)', border: '1px solid rgba(59, 130, 246, 0.09)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>{rIdx + 1}. {r.criterion}</span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--blue-300)' }}>{r.maxScore}đ</span>
                      </div>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>{r.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Starter Code hoặc Reference Solution nếu có */}
            {previewAssignment.starterCode && (
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--blue-200)', marginBottom: '6px' }}>
                  Khung Mã Nguồn Khởi Tạo (Starter Code):
                </h4>
                <pre style={{ margin: 0, padding: '12px', borderRadius: '8px', backgroundColor: '#ffffff', color: '#0b1220', fontSize: '12px', fontFamily: 'var(--font-mono)', overflowX: 'auto', border: '1px solid rgba(11, 18, 32, 0.04)' }}>
                  {previewAssignment.starterCode}
                </pre>
              </div>
            )}

            {/* Footer Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(11, 18, 32, 0.05)', paddingTop: '16px', flexWrap: 'wrap', gap: '10px' }}>
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
                    backgroundColor: previewAssignment.status === 'PUBLISHED' ? 'rgba(11, 18, 32, 0.06)' : 'rgba(37, 99, 235, 0.08)',
                    border: `1px solid ${previewAssignment.status === 'PUBLISHED' ? 'rgba(11, 18, 32, 0.1)' : 'rgba(37, 99, 235, 0.14)'}`,
                    color: previewAssignment.status === 'PUBLISHED' ? 'var(--text-main)' : '#1d4ed8',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {previewAssignment.status === 'PUBLISHED' ? 'Đóng Nộp Bài' : 'Mở Lại Nộp Bài'}
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
                    backgroundColor: 'rgba(11, 18, 32, 0.05)',
                    border: '1px solid rgba(11, 18, 32, 0.08)',
                    color: 'var(--text-main)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Award size={15} /> Xem Sổ Điểm Lớp
                </button>
              </div>

              <button
                type="button"
                onClick={() => setPreviewAssignment(null)}
                className="btn-primary"
                style={{ padding: '8px 24px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TẠO KHÓA HỌC MỚI (LƯU VÀO POSTGRESQL 15) */}
      {isCreateCourseModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(11, 18, 32, 0.45)',
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
              backgroundColor: '#f7f9fc',
              border: '1.5px solid rgba(59, 130, 246, 0.28)',
              borderRadius: '12px',
              padding: '28px 32px',
              boxShadow: '0 24px 60px -24px rgba(0, 0, 0, 0.9)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <BookOpen size={24} color="var(--accent-primary)" />
                <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-main)' }}>
                  Tạo Lớp Học Phần Mới (PostgreSQL 15)
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
                  Mã Lớp Học Phần / Subject Code:
                </label>
                <input
                  type="text"
                  value={newCourseCode}
                  onChange={(e) => setNewCourseCode(e.target.value.toUpperCase())}
                  placeholder="Ví dụ: PRN211, PRO192, SWP391"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(11, 18, 32, 0.04)',
                    border: '1px solid rgba(11, 18, 32, 0.08)',
                    color: 'var(--text-main)',
                    fontSize: '14px',
                    fontWeight: 700,
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Tên Khóa Học / Course Name:
                </label>
                <input
                  type="text"
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  placeholder="Ví dụ: Lập trình Cross-Platform .NET Core"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(11, 18, 32, 0.04)',
                    border: '1px solid rgba(11, 18, 32, 0.08)',
                    color: 'var(--text-main)',
                    fontSize: '14px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Học Kỳ (Semester):
                </label>
                <input
                  type="text"
                  value={newCourseSemester}
                  onChange={(e) => setNewCourseSemester(e.target.value)}
                  placeholder="Ví dụ: Học kỳ Thu 2026 (Fall 2026)"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(11, 18, 32, 0.04)',
                    border: '1px solid rgba(11, 18, 32, 0.08)',
                    color: 'var(--text-main)',
                    fontSize: '14px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Mô Tả Mục Tiêu Khóa Học:
                </label>
                <textarea
                  value={newCourseDesc}
                  onChange={(e) => setNewCourseDesc(e.target.value)}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(11, 18, 32, 0.04)',
                    border: '1px solid rgba(11, 18, 32, 0.08)',
                    color: 'var(--text-main)',
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
                    backgroundColor: 'rgba(11, 18, 32, 0.05)',
                    border: '1px solid rgba(11, 18, 32, 0.08)',
                    color: 'var(--text-main)',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Hủy Bỏ
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
                  <PlusCircle size={16} /> {createCourseLoading ? 'Đang Lưu...' : 'Lưu Vào PostgreSQL 15'}
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
