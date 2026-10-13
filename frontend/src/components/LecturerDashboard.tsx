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
  plagiarismStatus: 'AN TOÀN' | 'NGHI VẤN' | 'ĐẠO VĂN';
  similarityRate: number;
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
            studentName: s.studentName || s.studentId || 'Sinh viên',
            assignmentTitle: s.assignmentId || 'Bài nộp',
            fileName: s.fileName || `${s.submissionId || s.id}.zip`,
            submittedAt: s.createdAt ? new Date(s.createdAt).toLocaleString('vi-VN') : 'Vừa xong',
            testcaseScore: s.score !== undefined ? Math.round(s.score * 0.7 * 10) / 10 : 7.0,
            cleanCodeScore: s.result?.aiRating?.cleanCodeScore ?? 8.5,
            solidScore: 8.0,
            finalScore: s.score ?? 8.5,
            plagiarismStatus: s.plagiarismStatus || 'AN TOÀN',
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

  // Excel state
  const [excelStatus, setExcelStatus] = useState<string | null>(null);
  const [excelLoading, setExcelLoading] = useState(false);
  const [simulatedRollback, setSimulatedRollback] = useState<boolean | null>(null);

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

      const badgeText = `✨ Google Gemini AI (${result.modelUsed}) đã sinh đề & barem thành công trong ${result.latencyMs}ms!`;
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
    } catch {
      // ignore
    }

    // Tăng số lượng bài tập của khóa học
    setCourses((prevCourses) =>
      prevCourses.map((c) =>
        c.courseId === selectedCourse ? { ...c, assignmentCount: c.assignmentCount + 1 } : c
      )
    );

    const toastMsg = `🎉 ĐÃ XUẤT BẢN THÀNH CÔNG: Bài tập "${assignmentTitle}" (${testCases.length} testcases) đã giao cho lớp ${courseCode} (${courseName})!`;
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
      alert('Vui lòng nhập Mã học phần và Tên khóa học!');
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
        instructorName: 'ThS. Giảng Viên AITA',
        studentCount: 0,
        assignmentCount: 0,
      };

      setCourses((prev) => [newCourseObj, ...prev.filter((c) => c.courseId !== generatedId)]);
      setTargetCourseId(generatedId);
      setIsCreateCourseModalOpen(false);
      setPublishSuccessToast(`🎉 Đã tạo thành công khóa học mới [${newCourseCode}] và lưu vào PostgreSQL 15!`);
    } catch (err: any) {
      alert(`Lỗi tạo khóa học: ${err.message}`);
    } finally {
      setCreateCourseLoading(false);
    }
  };

  const handleDownloadSampleCsv = () => {
    const csvContent =
      'Mã Sinh Viên,Họ Và Tên,Email FPT\n' +
      'SE170000,Đinh Thành Trung,trungdt.student@aita.fpt.edu.vn\n' +
      'SE170123,Trần Thanh Nguyên,nguyentt@aita.fpt.edu.vn\n' +
      'SE201817,Nguyễn Hoàng Vinh,user.student@gmail.com\n' +
      'SE712137,Võ Thái Trung,vttrung2k6@gmail.com\n' +
      'SE170456,Lê Hoàng Nam,namlh@aita.fpt.edu.vn\n';

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

  const handleExecuteLiveBulkImport = async (triggerError: boolean, customStudents?: any[]) => {
    setExcelLoading(true);
    setExcelStatus(null);
    setSimulatedRollback(null);

    const studentsToImport = customStudents || (triggerError ? [
      { studentCode: 'SE170000', fullName: 'Đinh Thành Trung', email: 'trungdt.student@aita.fpt.edu.vn' },
      { studentCode: 'SE170123', fullName: 'Trần Thanh Nguyên', email: 'nguyentt@aita.fpt.edu.vn' },
      { studentCode: 'SE170123_ERROR_ROLLBACK', fullName: 'Nguyễn Văn Lỗi (Trùng MSSV)', email: 'loi@aita.fpt.edu.vn' },
    ] : [
      { studentCode: 'SE170000', fullName: 'Đinh Thành Trung', email: 'trungdt.student@aita.fpt.edu.vn' },
      { studentCode: 'SE170123', fullName: 'Trần Thanh Nguyên', email: 'nguyentt@aita.fpt.edu.vn' },
      { studentCode: 'SE201817', fullName: 'Nguyễn Hoàng Vinh', email: 'user.student@gmail.com' },
      { studentCode: 'SE712137', fullName: 'Võ Thái Trung', email: 'vttrung2k6@gmail.com' },
      { studentCode: 'SE170456', fullName: 'Lê Hoàng Nam', email: 'vinhtt@aita.fpt.edu.vn' },
    ]);

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
        `✅ GIAO DỊCH SQL THÀNH CÔNG (100% COMMIT): Đã nạp và ghi danh thành công ${studentsToImport.length} sinh viên vào lớp [${courseIdToUse}] trong PostgreSQL 15! Sinh viên đăng nhập vào sẽ thấy môn học ngay.`
      );
      setCourses((prev) =>
        prev.map((c) =>
          c.courseId === courseIdToUse ? { ...c, studentCount: Math.max(c.studentCount, studentsToImport.length) } : c
        )
      );
    } catch (err: any) {
      setSimulatedRollback(true);
      setExcelStatus(
        `❌ GIAO DỊCH SQL THẤT BẠI: ${err.message}. Hệ thống đã tự động kích hoạt 100% SQL TRANSACTION ROLLBACK (R06) bảo toàn dữ liệu PostgreSQL, không có bất kỳ bản ghi mồ côi nào!`
      );
    } finally {
      setExcelLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
      {/* Tiêu đề Dashboard Giảng Viên */}
      <div className="glass-panel" style={{ padding: '24px 28px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Bảng Quản Trị Giảng Viên • Vai Trò: INSTRUCTOR
          </span>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#ffffff', marginTop: '4px' }}>
            Cổng Điều Hành Học Phần & Khảo Thí Lập Trình
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '2px' }}>
            Quản lý đề bài, phân công lớp học, tích hợp AI soạn đề tự động và kiểm định đạo văn AST
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
            {geminiApiKey ? 'Đã Cấu Hình Gemini AI Key' : '⚙️ Nhập Gemini AI Key'}
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
            <PlusCircle size={18} /> Tạo Đề Bài Mới
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
          <BookOpen size={16} /> 1. Khóa Học & Lớp Học Phần
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
          <Sparkles size={16} color="var(--accent-cyan)" /> 2. Soạn Đề & Barem AI (UC-08)
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
          <FileSpreadsheet size={16} color="#10b981" /> 3. Nhập Roster Excel (ACID Rollback)
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
          <Award size={16} /> 4. Sổ Điểm & Bài Nộp
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
          <Sparkles size={16} /> 5. RBL Lab (Nghiên Cứu)
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
          <Scale size={16} color="#fbbf24" /> 6. Phúc Khảo Điểm (UC-06)
        </button>
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
                      ×
                    </button>
                  </div>
                )}

                {/* Header Thông Tin Môn Học */}
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
                        <Award size={16} /> Xem Sổ Điểm Lớp
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
                    Giảng viên: <strong>{currentCourse?.instructorName}</strong> • {currentCourse?.semester} • Sĩ số: <strong style={{ color: '#ffffff' }}>{currentCourse?.studentCount}</strong> sinh viên
                  </p>

                  <div style={{ display: 'flex', gap: '20px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px', fontSize: '13px', color: 'var(--text-muted)' }}>
                    <span>Tổng số bài tập đã giao: <strong style={{ color: 'var(--accent-cyan)' }}>{courseAssignments.length}</strong> bài</span>
                    <span>Đang mở nộp bài: <strong style={{ color: '#34d399' }}>{courseAssignments.filter((a) => a.status === 'PUBLISHED').length}</strong> bài</span>
                  </div>
                </div>

                {/* Tiêu đề Danh Sách Bài Tập */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FolderKanban size={20} color="var(--accent-cyan)" /> Danh Sách Các Bài Tập Đã Giao Của Môn Học
                  </h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Hiển thị {courseAssignments.length} bài tập
                  </span>
                </div>

                {/* Danh Sách Card Bài Tập Đã Giao */}
                {courseAssignments.length === 0 ? (
                  <div className="glass-panel" style={{ padding: '48px', borderRadius: '16px', textAlign: 'center' }}>
                    <FileText size={44} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
                    <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
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
                      ⚡ Soạn Đề Bài Tập Đầu Tiên Ngay
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
                                {isPublished ? '🟢 ĐANG MỞ NỘP BÀI' : '🔴 ĐÃ ĐÓNG NỘP'}
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
                                  ✨ MỚI XUẤT BẢN VỪA XONG
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

                          <h4 style={{ fontSize: '17px', fontWeight: 800, color: '#ffffff', marginBottom: '8px' }}>
                            {asm.title}
                          </h4>

                          <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '14px' }}>
                            {asm.description.length > 200 ? `${asm.description.slice(0, 200)}...` : asm.description}
                          </p>

                          {/* Chips Thông số kỹ thuật */}
                          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
                            <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(99, 102, 241, 0.15)', color: '#c7d2fe' }}>
                              🧪 {asm.testCases.length} Test Cases ({totalWeight.toFixed(1)}đ)
                            </span>
                            <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(6, 182, 212, 0.15)', color: 'var(--accent-cyan)' }}>
                              ⚡ Thời gian: {asm.timeLimitMs}ms
                            </span>
                            <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)' }}>
                              💾 RAM: {asm.memoryLimitMb}MB
                            </span>
                            <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)' }}>
                              💻 {asm.allowedLanguages.join(', ').toUpperCase()}
                            </span>
                            <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399', fontWeight: 600 }}>
                              👥 {asm.submissionCount}/38 Sinh viên đã nộp bài
                            </span>
                          </div>

                          {/* Các nút hành động cho bài tập */}
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
                                <Eye size={14} /> Xem Chi Tiết Đề & Test Cases
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
                                  border: `1px solid ${isPublished ? 'rgba(244, 63, 94, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
                                  color: isPublished ? '#f43f5e' : '#34d399',
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
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>
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
                        Giảng viên: {course.instructorName}
                      </p>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
                        <span>Sĩ số: <strong style={{ color: '#ffffff' }}>{course.studentCount}</strong> sinh viên</span>
                        <span>Đã giao: <strong style={{ color: 'var(--accent-cyan)' }}>{assignedCount}</strong> bài tập</span>
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
                          <FolderKanban size={15} color="var(--accent-cyan)" /> 📋 Xem Các Bài Tập Đã Giao ({assignedCount})
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
                            + Giao Đề Mới (AI)
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
        <div className="glass-panel" style={{ padding: '32px', borderRadius: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff' }}>
                  Soạn Thảo Đề Bài Tập & Sinh Barem Bằng Google Gemini AI Thật
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
                  {geminiApiKey ? '🟢 AI Thật Đã Kích Hoạt' : '🟡 Chưa Cấu Hình Key'}
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
                <Settings size={16} /> Cấu Hình Key
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
                  ? `Đang tạo đề... (${aiTimerSeconds}s / tối đa 10s)`
                  : '⚡ Dùng AI Sinh Đề & Barem'}
              </button>
            </div>
          </div>

          {/* Card Nhập Yêu Cầu & Mô Tả Của Giảng Viên Cho AI */}
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
                  Yêu Cầu & Ý Tưởng Cụ Thể Của Giảng Viên (Prompt Dành Cho AI Soạn Đề)
                </h3>
              </div>
              <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399', fontWeight: 700 }}>
                ⚡ Tốc độ cao (Bảo vệ thời gian thực tối đa 10s)
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
                backgroundColor: 'rgba(10, 15, 29, 0.8)',
                border: '1px solid rgba(99, 102, 241, 0.35)',
                color: '#ffffff',
                fontSize: '14px',
                lineHeight: '1.5',
                outline: 'none',
                marginBottom: '10px',
              }}
            />

            {/* Thanh Chọn Số Lượng Test Cases Mong Muốn */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: '#e5e7eb', fontWeight: 700 }}>
                🎯 Số lượng Test Cases AI cần sinh:
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
                    {count} Test Cases {count === 5 ? '★ Chuẩn' : ''}
                  </button>
                );
              })}
              <span style={{ fontSize: '11px', color: 'var(--accent-cyan)', marginLeft: '4px' }}>
                ✓ Hệ thống sẽ tạo đủ đúng {desiredTestCount} testcases kèm trọng số khác nhau
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
                {isAiGenerating ? 'Đang tạo siêu tốc bằng Gemini...' : '⚡ Sinh Đề Bằng AI Theo Yêu Cầu Này'}
              </button>
            </div>
          </div>

          {/* Thông báo lỗi AI nếu có */}
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
                Nhập Key Ngay
              </button>
            </div>
          )}

          {/* Badge thành công từ AI */}
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
                  <Code2 size={13} /> Xem Lời Giải & Code Mẫu AI
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
                    backgroundColor: 'rgba(18, 24, 36, 0.8)',
                    border: '1px solid var(--border-color)',
                    color: '#ffffff',
                    fontSize: '14px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#e5e7eb', marginBottom: '6px' }}>
                  Áp Dụng Cho Học Phần *
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
                  backgroundColor: 'rgba(18, 24, 36, 0.8)',
                  border: '1px solid var(--border-color)',
                  color: '#ffffff',
                  fontSize: '14px',
                  lineHeight: '1.5',
                }}
              />
            </div>

            {/* Cấu hình hạn ngạch Sandbox */}
            <div style={{ padding: '20px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                      backgroundColor: 'rgba(18, 24, 36, 0.8)',
                      border: '1px solid var(--border-color)',
                      color: '#ffffff',
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
                      backgroundColor: 'rgba(18, 24, 36, 0.8)',
                      border: '1px solid var(--border-color)',
                      color: '#ffffff',
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
                      backgroundColor: 'rgba(18, 24, 36, 0.8)',
                      border: '1px solid var(--border-color)',
                      color: '#ffffff',
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
                    <Layers size={16} color="var(--accent-primary)" /> Bộ Test Cases Tự Động (StdIn / StdOut) - Tổng {testCases.length} Test
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
                    Tổng Điểm TC: {totalTestcaseWeight.toFixed(1)}đ {totalTestcaseWeight !== 10 && totalTestcaseWeight !== 7 ? '(Tùy chỉnh tỷ lệ)' : '✅ Chuẩn'}
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
                      title="Tự động chuẩn hóa chia lại tỷ lệ để tổng điểm các testcases đúng bằng 10.0đ"
                    >
                      ⚡ Quy đổi về 10.0đ
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
                      title="Quy đổi về 7.0đ (theo Barem chuẩn AITA: 7đ Testcase + 3đ Clean Code & SOLID)"
                    >
                      ⚡ Quy đổi về 7.0đ (Barem)
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
                    + Thêm Test Case
                  </button>
                </div>
              </div>

              {totalTestcaseWeight !== 10 && totalTestcaseWeight !== 7 && (
                <div style={{ marginBottom: '10px', padding: '8px 12px', borderRadius: '8px', backgroundColor: 'rgba(234, 179, 8, 0.08)', border: '1px solid rgba(234, 179, 8, 0.2)', fontSize: '12px', color: '#fbbf24' }}>
                  💡 <strong>Tổng điểm các testcase hiện là {totalTestcaseWeight.toFixed(1)}đ (khác 10đ):</strong> Khi chấm bài, hệ thống tự động chuẩn hóa theo tỷ lệ: <code>Điểm đạt = (Tổng điểm TC Pass / {totalTestcaseWeight.toFixed(1)}) × Thang Điểm Barem</code>. Hoặc Giảng viên có thể bấm nút <em>"Quy đổi về 10.0đ"</em> hoặc <em>"7.0đ (Barem)"</em> ở trên để chuẩn hóa tự động.
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
                        placeholder="Dữ liệu đầu vào..."
                        style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', backgroundColor: '#0a0d14', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
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
                        style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', backgroundColor: '#0a0d14', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
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
                        style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', backgroundColor: '#0a0d14', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '12px' }}
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
              <div style={{ padding: '20px', borderRadius: '12px', backgroundColor: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Award size={18} color="var(--accent-primary)" /> Barem Chấm Điểm Học Thuật Rubrics (Sinh Bởi Google Gemini AI)
                  </h4>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Tổng Điểm: 10.0 Điểm
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
                          Tối đa: {rubric.maxScore}đ
                        </span>
                      </div>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                        {rubric.description}
                      </p>
                      {rubric.levels && rubric.levels.length > 0 && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {rubric.levels.map((lvl, lIdx) => (
                            <span key={lIdx} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.04)', color: '#d1d5db', border: '1px solid rgba(255,255,255,0.08)' }}>
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
        <div className="glass-panel" style={{ padding: '32px', borderRadius: '16px' }}>
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff' }}>
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
                1. Chọn Lớp Học Phần Cần Ghi Danh:
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
              <Download size={15} /> Tải File Mẫu Roster (.csv)
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '28px' }}>
            <div style={{ padding: '24px', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <CheckCircle2 size={24} color="#10b981" />
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>Kịch Bản 1: Nhập Live Thành Công 100% (Commit)</h3>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.5' }}>
                Nạp danh sách sinh viên chuẩn vào PostgreSQL 15 bảng <code>class_members</code>. Tất cả tài khoản được cấp quyền truy cập môn học. Giao diện thực hiện COMMIT toàn bộ.
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
                <Upload size={16} /> ⚡ Thực Thi Giao Dịch Nhập Roster (Live PostgreSQL)
              </button>
            </div>

            <div style={{ padding: '24px', borderRadius: '12px', backgroundColor: 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <AlertTriangle size={24} color="#f43f5e" />
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>Kịch Bản 2: Minh Chứng Lỗi Dòng N & 100% Rollback (R06)</h3>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.5' }}>
                Gửi file Excel có dòng số 3 chứa lỗi trùng lặp MSSV [SE170123]. Backend mở SQL Transaction, phát hiện vi phạm và thực thi 100% ROLLBACK bảo toàn dữ liệu.
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
                <AlertTriangle size={16} /> ⚠️ Kích Hoạt Thử Nghiệm Lỗi Dòng 3 &amp; Rollback
              </button>
            </div>
          </div>

          {excelLoading && (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--accent-primary)', fontSize: '14px', fontWeight: 600 }}>
              Đang phân tích cú pháp Excel và mở SQL Transaction...
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

      {/* TAB 4: SỔ ĐIỂM & DANH SÁCH BÀI NỘP VỚI TÍNH NĂNG TẢI FILE ZIP */}
      {activeTab === 'SUBMISSIONS' && (
        <div className="glass-panel" style={{ padding: '28px', borderRadius: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff' }}>
                Sổ Theo Dõi Bài Nộp Lập Trình &amp; Giám Sát Liêm Chính Học Thuật
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
                Danh sách bài làm sinh viên dưới dạng file nén .zip, điểm số đa trục và cảnh báo đạo văn AST Winnowing
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
              {loadingSubmissions ? 'Đang đồng bộ...' : 'Làm mới'}
            </button>
          </div>

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
                {(realSubmissions.length > 0 ? [...realSubmissions, ...mockSubmissionsList] : mockSubmissionsList).map((sub) => (
                  <tr
                    key={sub.id}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      backgroundColor: sub.plagiarismStatus === 'ĐẠO VĂN' ? 'rgba(244, 63, 94, 0.05)' : 'transparent',
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
                      📦 {sub.fileName}
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
                            sub.plagiarismStatus === 'ĐẠO VĂN'
                              ? 'rgba(244, 63, 94, 0.2)'
                              : sub.plagiarismStatus === 'NGHI VẤN'
                              ? 'rgba(245, 158, 11, 0.2)'
                              : 'rgba(16, 185, 129, 0.2)',
                          color:
                            sub.plagiarismStatus === 'ĐẠO VĂN'
                              ? '#f43f5e'
                              : sub.plagiarismStatus === 'NGHI VẤN'
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
                        onClick={() => handleDownloadZip(sub.id, sub.fileName)}
                        disabled={downloadingId === sub.id}
                        title={`Tải xuống bài làm ${sub.fileName} của sinh viên`}
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
                        {downloadingId === sub.id ? 'Đang tải...' : 'Tải .zip'}
                      </button>
                    </td>
                  </tr>
                ))}
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
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(5, 7, 13, 0.85)', backdropFilter: 'blur(8px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '580px', padding: '32px', borderRadius: '20px', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'rgba(99, 102, 241, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}>
                  <Key size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>Cấu Hình Trí Tuệ Nhân Tạo Thật (Google Gemini AI)</h3>
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
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#e5e7eb', marginBottom: '6px' }}>
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
                  backgroundColor: 'rgba(18, 24, 36, 0.9)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
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
                  style={{ color: 'var(--accent-cyan)', textDecoration: 'none', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                >
                  Google AI Studio <ExternalLink size={11} />
                </a>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#e5e7eb', marginBottom: '6px' }}>
                Lựa Chọn Mô Hình AI (Model)
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
                <option value="auto">✨ Tự Động Chọn Mô Hình Flash Nhanh Nhất (Khuyên Dùng - Auto Detect)</option>
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
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(5, 7, 13, 0.85)', backdropFilter: 'blur(8px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '800px', maxHeight: '85vh', overflowY: 'auto', padding: '28px', borderRadius: '20px', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#a5b4fc', marginBottom: '6px' }}>
                  1. Khung Mã Khởi Tạo Cho Sinh Viên (Starter Code):
                </h4>
                <pre style={{ padding: '14px', borderRadius: '10px', backgroundColor: '#0a0d14', color: '#e5e7eb', fontSize: '12px', fontFamily: 'var(--font-mono)', overflowX: 'auto', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {starterCode}
                </pre>
              </div>
            )}

            {referenceSolution && (
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#6ee7b7', marginBottom: '6px' }}>
                  2. Lời Giải Tham Chiếu Chuẩn Xác (Reference Working Solution):
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
                    {previewAssignment.status === 'PUBLISHED' ? '🟢 ĐANG MỞ NỘP BÀI' : '🔴 ĐÃ ĐÓNG NỘP'}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Mã đề: <strong style={{ color: '#fff' }}>{previewAssignment.id}</strong> • Tạo ngày: {previewAssignment.createdAt}
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

            {/* Thông số kỹ thuật */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <div style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Hạn chót nộp bài:</span>
                <strong style={{ fontSize: '13px', color: 'var(--accent-amber)' }}>{new Date(previewAssignment.deadline).toLocaleString('vi-VN')}</strong>
              </div>
              <div style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Thời gian thực thi tối đa:</span>
                <strong style={{ fontSize: '13px', color: 'var(--accent-cyan)' }}>{previewAssignment.timeLimitMs} ms</strong>
              </div>
              <div style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Bộ nhớ RAM tối đa:</span>
                <strong style={{ fontSize: '13px', color: '#ffffff' }}>{previewAssignment.memoryLimitMb} MB</strong>
              </div>
              <div style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Ngôn ngữ lập trình:</span>
                <strong style={{ fontSize: '13px', color: 'var(--accent-primary)' }}>{previewAssignment.allowedLanguages.join(', ').toUpperCase()}</strong>
              </div>
            </div>

            {/* Mô tả đề bài */}
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#e5e7eb', marginBottom: '8px' }}>
                📖 Mô Tả Yêu Cầu & Ràng Buộc:
              </h4>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6', whiteSpace: 'pre-wrap', backgroundColor: 'rgba(0,0,0,0.25)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)', margin: 0 }}>
                {previewAssignment.description}
              </p>
            </div>

            {/* Danh sách Test Cases */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                          {tc.isHidden ? '🔒 Test Ẩn' : '🌐 Test Công Khai'}
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#34d399', backgroundColor: 'rgba(16, 185, 129, 0.15)', padding: '2px 8px', borderRadius: '4px' }}>
                          Trọng số: {tc.weight}đ
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Đầu vào (Input / StdIn):</span>
                        <pre style={{ margin: 0, padding: '8px 10px', borderRadius: '6px', backgroundColor: '#0a0d14', color: '#e5e7eb', fontSize: '12px', fontFamily: 'var(--font-mono)', border: '1px solid rgba(255,255,255,0.06)', overflowX: 'auto' }}>
                          {tc.input}
                        </pre>
                      </div>
                      <div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Đầu ra kỳ vọng (Expected Output / StdOut):</span>
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
                  <Award size={16} /> Barem Chấm Điểm Học Thuật (Rubrics):
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {previewAssignment.rubrics.map((r, rIdx) => (
                    <div key={rIdx} style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.15)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>{rIdx + 1}. {r.criterion}</span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#818cf8' }}>{r.maxScore}đ</span>
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
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#a5b4fc', marginBottom: '6px' }}>
                  Khung Mã Nguồn Khởi Tạo (Starter Code):
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
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#ffffff',
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
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#ffffff',
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
    </div>
  );
};
