import { useState, useEffect, useRef } from 'react';
import { SubmissionView } from './components/SubmissionView';
import { LiveGradingModal } from './components/LiveGradingModal';
import { LoginView } from './components/LoginView';
import { LoginModal } from './components/LoginModal';
import { AdminDashboard } from './components/AdminDashboard';
import { LecturerDashboard } from './components/LecturerDashboard';
import { RblBenchmarkView } from './components/RblBenchmarkView';
import { StudentAppealsView } from './components/StudentAppealsView';
import { StudentHistoryView } from './components/StudentHistoryView';
import { PlagiarismDiffModal } from './components/PlagiarismDiffModal';
import type { Task, GradingStep, AIRating, PlagiarismMatch, User, ScoreBreakdown } from './types';
import { isLecturerRole } from './types';
import { Terminal, Shield, LogOut, FileCode, Upload, BookOpen, LayoutDashboard, Scale, ArrowLeftRight, Clock, GraduationCap, Check } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

import { PlagiarismService } from './services/plagiarism.service';
import JSZip from 'jszip';
import { API_BASE_URL } from './config/api';

function generateFallbackSubId(): string {
  return 'SUB-' + Date.now().toString(36).toUpperCase();
}

/**
 * Tự động nhận diện ngôn ngữ lập trình của bài nộp (Java, Python, C++, C# / .NET, C).
 * Ưu tiên: phần mở rộng file trong zip -> signature mã nguồn -> danh sách allowedLanguages.
 */
function detectSubmissionLanguage(
  file?: File,
  extractedFilename?: string,
  sourceCode?: string,
  allowedLanguages?: string[],
  explicitLanguage?: string
): string {
  // 1. Ưu tiên cao nhất: Lựa chọn ngôn ngữ rõ ràng của sinh viên từ dropdown
  if (explicitLanguage && explicitLanguage !== 'auto') {
    const norm = explicitLanguage.toLowerCase().trim();
    if (norm === 'csharp' || norm === 'cs') return 'dotnet';
    return norm;
  }

  const candidateName = (extractedFilename || file?.name || '').toLowerCase();
  let detected = '';

  if (/\.(py|python)$/i.test(candidateName)) {
    detected = 'python';
  } else if (/\.(java)$/i.test(candidateName)) {
    detected = 'java';
  } else if (/\.(cpp|cc|cxx|hpp|h)$/i.test(candidateName)) {
    detected = 'cpp';
  } else if (/\.(cs)$/i.test(candidateName)) {
    detected = 'dotnet'; // Backend docker-runner dùng 'dotnet' cho mã nguồn C#
  } else if (/\.(c)$/i.test(candidateName)) {
    detected = 'c';
  }

  // 2. Phân tích signature nội dung mã nguồn nếu tên file chưa rõ ràng
  if (!detected && sourceCode && sourceCode.trim().length > 0) {
    const code = sourceCode;
    if (code.includes('def ') || /import\s+sys|import\s+os|from\s+\w+\s+import|if\s+__name__\s*==|print\s*\(/.test(code)) {
      detected = 'python';
    } else if (/#include\s*<iostream>|std::cout|std::cin|cout\s*<<|cin\s*>>|using\s+namespace\s+std|#include\s*<vector>|#include\s*<algorithm>/.test(code)) {
      detected = 'cpp';
    } else if (/using\s+System|namespace\s+\w+|Console\.Write|public\s+class\s+Program/.test(code)) {
      detected = 'dotnet';
    } else if (/public\s+class|System\.out\.print|import\s+java\./.test(code)) {
      detected = 'java';
    } else if (/#include\s*<stdio\.h>|printf\s*\(|scanf\s*\(/.test(code)) {
      detected = 'c';
    }
  }

  // 3. Đối soát với allowedLanguages của Assignment
  if (allowedLanguages && allowedLanguages.length > 0) {
    const normalizedAllowed = allowedLanguages.map((l) => l.toLowerCase());
    if (detected && normalizedAllowed.includes(detected)) {
      return detected;
    }
    if (detected === 'dotnet' && (normalizedAllowed.includes('csharp') || normalizedAllowed.includes('cs'))) {
      return 'dotnet';
    }
    if (!detected && normalizedAllowed.length === 1) {
      return normalizedAllowed[0] === 'csharp' ? 'dotnet' : normalizedAllowed[0];
    }
  }

  return detected || 'java';
}

const mockTask: Task = {
  id: 'ASM-SWP-01',
  title: 'Cài đặt Thuật toán Cây Tìm Kiếm Nhị Phân (BST) & Đồ Thị',
  course: 'SWP391 - Đồ Án Phát Triển Phần Mềm (Agile Scrum)',
  deadline: new Date(Date.now() + 5 * 24 * 3600 * 1000 + 4 * 3600 * 1000).toISOString(),
  maxSizeMb: 10,
  allowedExtensions: ['.zip'],
  description: 'Cài đặt Generic Binary Search Tree trong Java hoặc C++. Tối ưu hóa độ phức tạp thời gian O(log N) và tuân thủ các nguyên lý SOLID (SRP, DIP).',
};

const mockSourceCodeStudent = `package com.aita.autograder;

import java.util.*;

public class Solution {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        int[] arr = new int[n];
        for (int i = 0; i < n; i++) {
            arr[i] = sc.nextInt();
        }
        
        sortAndPrintAndSaveToDatabase(arr);
    }
    
    private static void sortAndPrintAndSaveToDatabase(int[] arr) {
        Arrays.sort(arr);
        for (int val : arr) {
            System.out.print(val + " ");
        }
        System.out.println();
    }
}`;

const initialSteps: GradingStep[] = [
  { id: '1', label: 'Hàng đợi Redis BullMQ', status: 'pending', detail: 'Đang xếp hàng chờ Worker xử lý' },
  { id: '2', label: 'Khởi tạo Docker Sandbox', status: 'pending', detail: 'Cấp phát 512MB RAM & cách ly seccomp.json' },
  // Các bước 'tc-1'..'tc-N' được chèn động theo số testcase thật của đề (xem upsertStep).
  { id: '5', label: 'Đánh giá Clean Code & SOLID (GenAI)', status: 'pending', detail: 'Phân tích thiết kế hướng đối tượng qua Gemini/GPT' },
  { id: '6', label: 'Kiểm định Đạo văn AST Winnowing', status: 'pending', detail: 'So khớp vân tay mã nguồn trên cây cú pháp trừu tượng' },
];

/**
 * Cập nhật (hoặc chèn mới) một bước. Bước testcase 'tc-N' chưa có sẽ được chèn trước
 * bước '5' và giữ đúng thứ tự tc-1, tc-2, ..., tc-N.
 */
function upsertStep(prev: GradingStep[], id: string, patch: Partial<GradingStep>, label?: string): GradingStep[] {
  if (prev.some((s) => s.id === id)) {
    return prev.map((s) => (s.id === id ? { ...s, ...patch } : s));
  }
  if (!id.startsWith('tc-')) return prev;
  const n = Number(id.slice(3));
  const newStep: GradingStep = {
    id,
    label: label || `tc-${n}`,
    status: 'pending',
    detail: '',
    ...patch,
  } as GradingStep;
  const next = [...prev];
  let insertAt = next.findIndex(
    (s) => s.id === '5' || s.id === '6' || (s.id.startsWith('tc-') && Number(s.id.slice(3)) > n),
  );
  if (insertAt === -1) insertAt = next.length;
  next.splice(insertAt, 0, newStep);
  return next;
}

function syncTestcaseSteps(
  steps: GradingStep[],
  results?: Array<{ testcaseIndex: number; status: 'PASSED' | 'FAILED'; timeMs: number }>,
): GradingStep[] {
  if (!results) return steps;
  return results.reduce((next, result) => {
    const id = `tc-${result.testcaseIndex}`;
    return upsertStep(
      next,
      id,
      {
        status: result.status === 'PASSED' ? 'passed' : 'failed',
        detail: `Testcase ${result.testcaseIndex}/${results.length}: ${result.status === 'PASSED' ? 'ĐẠT' : 'KHÔNG ĐẠT'} (${result.timeMs}ms)`,
      },
      id,
    );
  }, steps);
}

export function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem('aita_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Active view: 'student' | 'admin' | 'lecturer' (tự động phân định theo vai trò)
  const [activeView, setActiveView] = useState<'student' | 'admin' | 'lecturer'>(() => {
    try {
      const stored = localStorage.getItem('aita_user');
      if (stored) {
        const u = JSON.parse(stored);
        if (isLecturerRole(u.role)) return 'lecturer';
        if (u.role === 'ADMIN') return 'admin';
      }
    } catch {
      // ignore
    }
    return 'student';
  });

  // Tab cho Sinh viên: 'submission' (Khu vực nộp bài) | 'history' (Lịch sử nộp & điểm số) | 'appeals' (Khiếu nại điểm)
  // Quy chế BR-04: Đạo văn không được công khai cho sinh viên, chỉ dành cho Giảng viên/HOD
  const [studentActiveTab, setStudentActiveTab] = useState<'submission' | 'history' | 'appeals'>('submission');

  // Danh sách môn học sinh viên đang tham gia (nạp từ PostgreSQL qua API)
  const [enrolledCourses, setEnrolledCourses] = useState<Array<{ courseId: string; courseCode: string; courseName: string; semester: string; description?: string }>>([
    {
      courseId: 'COURSE-SWP391',
      courseCode: 'SWP391',
      courseName: 'Application Development Project',
      semester: 'Fall 2026',
      description: 'Dự Án Phát triển phần mềm theo chuẩn Agile Scrum',
    },
    {
      courseId: 'COURSE-PRN211',
      courseCode: 'PRN211',
      courseName: 'Basic Cross-Platform .NET Application',
      semester: 'Fall 2026',
      description: 'Lập trình ứng dụng đa nền tảng với .NET C#',
    },
    {
      courseId: 'CRS-CSD201',
      courseCode: 'CSD201',
      courseName: 'Data Structures and Algorithms (CSD201)',
      semester: 'Fall 2026',
      description: 'Cấu trúc dữ liệu và giải thuật nâng cao (Cây AVL, Dijkstra, Winnowing)',
    },
  ]);
  const [selectedStudentCourseId, setSelectedStudentCourseId] = useState<string>('ALL');

  useEffect(() => {
    const fetchStudentCourses = async () => {
      const studentId = currentUser?.userId || currentUser?.email || 'SE170000';
      try {
        let list: any[] = [];
        try {
          const res = await fetch(`${API_BASE_URL}/api/v1/courses/student/${studentId}`);
          if (res.ok) {
            const data = await res.json();
            list = data.data || data || [];
          }
        } catch {}

        // Nạp bổ sung từ tất cả khóa học trên server để sinh viên thấy lớp học phần mới tạo
        try {
          const allRes = await fetch(`${API_BASE_URL}/api/v1/courses`);
          if (allRes.ok) {
            const allJson = await allRes.json();
            const allCourses = allJson.data || allJson || [];
            if (Array.isArray(allCourses)) {
              const existingCodes = new Set(list.map((c: any) => (c.courseCode || c.courseId || '').toUpperCase()));
              for (const ac of allCourses) {
                const codeUpper = (ac.courseCode || ac.courseId || '').toUpperCase();
                if (!existingCodes.has(codeUpper)) {
                  list.push(ac);
                  existingCodes.add(codeUpper);
                }
              }
            }
          }
        } catch {}

        // Nạp thêm từ cache local nếu có
        try {
          const cached = localStorage.getItem('aita_cached_courses');
          if (cached) {
            const cachedList = JSON.parse(cached);
            if (Array.isArray(cachedList)) {
              const existingCodes = new Set(list.map((c: any) => (c.courseCode || c.courseId || '').toUpperCase()));
              for (const cc of cachedList) {
                const codeUpper = (cc.courseCode || cc.courseId || '').toUpperCase();
                if (!existingCodes.has(codeUpper)) {
                  list.push(cc);
                  existingCodes.add(codeUpper);
                }
              }
            }
          }
        } catch {}

        if (Array.isArray(list) && list.length > 0) {
          const seen = new Set<string>();
          const deduped: any[] = [];
          for (const c of list) {
            const rawCode = (c.courseCode || c.courseId || '').replace(/^CRS-/, '').replace(/^COURSE-/, '').trim();
            const upper = rawCode.toUpperCase();
            let norm = rawCode;
            if (upper.includes('SWP391')) norm = 'SWP391';
            else if (upper.includes('PRN211')) norm = 'PRN211';
            else if (upper.includes('CSD201') || upper.includes('CSD')) norm = 'CSD201';

            if (!seen.has(norm)) {
              seen.add(norm);
              deduped.push({
                ...c,
                courseCode: norm,
              });
            }
          }
          if (deduped.length > 0) {
            setEnrolledCourses(deduped);
          }
        }
      } catch (err) {
        console.warn('[App] Không thể tải danh sách khóa học của sinh viên:', err);
      }
    };

    void fetchStudentCourses();
    window.addEventListener('aita_courses_updated', fetchStudentCourses);
    window.addEventListener('storage', fetchStudentCourses);
    return () => {
      window.removeEventListener('aita_courses_updated', fetchStudentCourses);
      window.removeEventListener('storage', fetchStudentCourses);
    };
  }, [currentUser, activeView]);

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [steps, setSteps] = useState<GradingStep[]>(initialSteps);
  const [isCompleted, setIsCompleted] = useState(false);
  const [submissionId, setSubmissionId] = useState('');
  const [submissionLanguage, setSubmissionLanguage] = useState<string>('java');
  const [currentAssignmentId, setCurrentAssignmentId] = useState('');
  const [currentSourceCode, setCurrentSourceCode] = useState<string>(mockSourceCodeStudent);
  const [aiRating, setAiRating] = useState<AIRating | undefined>(undefined);
  const [plagiarismMatch, setPlagiarismMatch] = useState<PlagiarismMatch | undefined>(undefined);
  const [plagiarismDiffMatch, setPlagiarismDiffMatch] = useState<PlagiarismMatch | null>(null);
  const [plagiarismCandidateMatches, setPlagiarismCandidateMatches] = useState<PlagiarismMatch[]>([]);
  const [score, setScore] = useState<number | undefined>(undefined);
  const [scoreBreakdown, setScoreBreakdown] = useState<ScoreBreakdown | undefined>(undefined);
  const [executionTimeMs, setExecutionTimeMs] = useState<number | undefined>(undefined);
  const currentAssignmentIdRef = useRef('');
  const submissionIdRef = useRef('');
  const currentUserRef = useRef<User | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const lastSubmissionRef = useRef<{ file?: File; task?: Task; lang?: string } | null>(null);
  currentUserRef.current = currentUser;

  // Khởi tạo kết nối Socket.IO
  useEffect(() => {
    const socket = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      console.log('[Socket.IO] Đã kết nối thành công tới API Gateway:', socket.id);
      setIsSocketConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('[Socket.IO] Ngắt kết nối khỏi API Gateway');
      setIsSocketConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket.IO] Trạng thái Gateway chưa kết nối, chuẩn bị cơ chế Fallback:', err.message);
      setIsSocketConnected(false);
    });

    socket.on('grading:progress', (data: { stepId: string; stepName: string; status: any; detail?: string }) => {
      setSteps((prev) =>
        upsertStep(
          prev,
          data.stepId,
          { status: data.status, ...(data.detail ? { detail: data.detail } : {}) },
          data.stepName,
        )
      );
    });

    socket.on('testcase:evaluated', (data: { testcaseIndex: number; totalTestcases: number; status: string; timeMs: number; memoryKb?: number }) => {
      const stepId = `tc-${data.testcaseIndex}`;
      const mem = data.memoryKb ? `, ${(data.memoryKb / 1024).toFixed(1)}MB` : '';
      setSteps((prev) =>
        upsertStep(prev, stepId, {
          status: data.status === 'PASSED' ? 'passed' : 'failed',
          detail: `Testcase ${data.testcaseIndex}/${data.totalTestcases}: ${data.status === 'PASSED' ? 'ĐẠT' : 'KHÔNG ĐẠT'} (${data.timeMs}ms${mem})`,
        })
      );
    });

    socket.on('ai:reviewed', (data: any) => {
      if (data) {
        setAiRating({
          cleanCodeScore: data.cleanCodeScore,
          solidScore: data.solidScore,
          codeSmells: data.codeSmells || [],
          explanation: data.explanation || '',
        });
      }
    });

    socket.on('grading:completed', (data: any) => {
      if (data.aiRating) setAiRating(data.aiRating);
      if (data.sourceCode) setCurrentSourceCode(data.sourceCode);
      if (data.plagiarismMatch) setPlagiarismMatch(data.plagiarismMatch);
      if (data.score !== undefined) setScore(data.score);
      if (data.scoreBreakdown) setScoreBreakdown(data.scoreBreakdown);
      if (data.executionTimeMs !== undefined) setExecutionTimeMs(data.executionTimeMs);
      persistGradingResult({
        score: data.score,
        scoreBreakdown: data.scoreBreakdown,
        submissionId: data.submissionId,
        sourceCode: data.sourceCode,
        aiRating: data.aiRating,
        passedTestcases: data.passedTestcases,
        totalTestcases: data.totalTestcases,
        executionTimeMs: data.executionTimeMs,
      });
      setSteps((prev) =>
        syncTestcaseSteps(prev, data.testcaseResults).map((s) =>
          s.id.startsWith('tc-') || (s.status !== 'in_progress' && s.status !== 'pending')
            ? s
            : { ...s, status: 'passed' }
        )
      );
      setIsCompleted(true);
    });

    socket.on('grading:failed', (data: any) => {
      setSteps((prev) =>
        prev.map((s) => (s.status === 'in_progress' ? { ...s, status: 'failed', detail: data.error || 'Thất bại' } : s))
      );
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleLoginSuccess = (user: User) => {
    localStorage.setItem('aita_user', JSON.stringify(user));
    setCurrentUser(user);
    if (isLecturerRole(user.role)) {
      setActiveView('lecturer');
    } else if (user.role === 'ADMIN') {
      setActiveView('admin');
    } else {
      setActiveView('student');
      setStudentActiveTab('submission');
      setSelectedStudentCourseId('ALL');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('aita_token');
    localStorage.removeItem('aita_user');
    setCurrentUser(null);
    setActiveView('student');
  };

  const persistGradingResult = (data: {
    score?: number;
    scoreBreakdown?: ScoreBreakdown;
    submissionId?: string;
    sourceCode?: string;
    aiRating?: AIRating;
    passedTestcases?: number;
    totalTestcases?: number;
    executionTimeMs?: number;
    fileName?: string;
    sha256?: string;
  }) => {
    const user = currentUserRef.current;
    const assignmentId = currentAssignmentIdRef.current;
    if (!user || !assignmentId) return;

    const storageKey = `aita_student_submissions_${user.userId}`;
    try {
      const saved = localStorage.getItem(storageKey);
      const history = saved ? JSON.parse(saved) : {};
      const current = history[assignmentId] || {};
      history[assignmentId] = {
        ...current,
        assignmentId,
        submissionId: data.submissionId || current.submissionId,
        score: data.score !== undefined ? data.score : current.score,
        scoreBreakdown: data.scoreBreakdown || current.scoreBreakdown,
        status: 'GRADED',
        sourceCode: data.sourceCode || current.sourceCode,
        aiRating: data.aiRating || current.aiRating,
        passedTestcases: data.passedTestcases ?? current.passedTestcases ?? 0,
        totalTestcases: data.totalTestcases ?? current.totalTestcases ?? 0,
        executionTimeMs: data.executionTimeMs ?? current.executionTimeMs ?? 185,
        submittedAt: current.submittedAt || new Date().toISOString(),
        fileName: data.fileName || current.fileName || 'Solution.zip',
        sha256: data.sha256 || current.sha256,
      };
      localStorage.setItem(storageKey, JSON.stringify(history));
      window.dispatchEvent(new Event('aita_student_submissions_updated'));
    } catch (err) {
      console.warn('Không thể cập nhật lịch sử điểm:', err);
    }
  };

  const handleSubmission = async (
    file?: File,
    benchmarkPairId?: number,
    submittedTask?: Task,
    explicitLanguage?: string
  ) => {
    const activeTask = submittedTask || mockTask;
    if (!currentUser) return;

    if (file) {
      lastSubmissionRef.current = { file, task: activeTask, lang: explicitLanguage };
    }

    setSteps(initialSteps.map((s) => ({ ...s, status: 'pending' })));
    setIsCompleted(false);
    setAiRating(undefined);
    setPlagiarismMatch(undefined);
    setScore(undefined);
    setScoreBreakdown(undefined);
    setExecutionTimeMs(undefined);
    setCurrentAssignmentId(activeTask.id);
    currentAssignmentIdRef.current = activeTask.id;
    setIsModalOpen(true);

    let codeToGrade = mockSourceCodeStudent;
    let computedPlagiarism: PlagiarismMatch | undefined = undefined;
    let extractedInnerFileName = '';

    if (benchmarkPairId !== undefined) {
      const pair = PlagiarismService.getBenchmarkPairs().find((p) => p.pairId === benchmarkPairId);
      if (pair) {
        codeToGrade = pair.codeA;
        setCurrentSourceCode(pair.codeA);
        computedPlagiarism = await PlagiarismService.evaluateBenchmarkPair(benchmarkPairId);
      }
    } else if (file) {
      if (file.name.toLowerCase().endsWith('.zip')) {
        try {
          const zip = await JSZip.loadAsync(file);
          const candidateKeys = Object.keys(zip.files).filter(
            (k) => !zip.files[k].dir && !k.startsWith('__MACOSX') && !k.endsWith('.DS_Store')
          );

          // Ưu tiên tìm file theo ngôn ngữ chỉ định rõ ràng
          let bestKey: string | undefined;
          if (explicitLanguage && explicitLanguage !== 'auto') {
            const lang = explicitLanguage.toLowerCase().trim();
            if (lang === 'cpp') {
              bestKey = candidateKeys.find((k) => /\.(cpp|cc|cxx)$/i.test(k));
            } else if (lang === 'dotnet' || lang === 'cs' || lang === 'csharp') {
              bestKey = candidateKeys.find((k) => /\.(cs)$/i.test(k));
            } else if (lang === 'python') {
              bestKey = candidateKeys.find((k) => /\.(py)$/i.test(k));
            } else if (lang === 'java') {
              bestKey = candidateKeys.find((k) => /\.(java)$/i.test(k));
            } else if (lang === 'c') {
              bestKey = candidateKeys.find((k) => /\.(c)$/i.test(k));
            }
          }

          if (!bestKey) {
            bestKey =
              candidateKeys.find((k) => k.toLowerCase().includes('solution.')) ||
              candidateKeys.find((k) => /\.(java|cpp|cc|cxx|c|py|cs|js|ts)$/i.test(k)) ||
              candidateKeys[0];
          }

          if (bestKey && zip.files[bestKey]) {
            extractedInnerFileName = bestKey;
            const unzippedText = await zip.files[bestKey].async('text');
            if (unzippedText && unzippedText.trim().length > 0) {
              codeToGrade = unzippedText;
              setCurrentSourceCode(unzippedText);
            }
          }
        } catch (zipErr) {
          console.warn('Lỗi khi giải nén file zip trong trình duyệt:', zipErr);
        }
      } else {
        try {
          const text = await file.text();
          if (text && text.trim().length > 0) {
            codeToGrade = text;
            setCurrentSourceCode(text);
          }
        } catch (err) {
          console.warn('Không thể đọc file dạng văn bản thuần:', err);
        }
      }
      computedPlagiarism = undefined;
    }

    const detectedLanguage = detectSubmissionLanguage(
      file,
      extractedInnerFileName,
      codeToGrade,
      activeTask.allowedLanguages,
      explicitLanguage
    );
    setSubmissionLanguage(detectedLanguage);

    const token = localStorage.getItem('aita_token');
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (file) {
      // ── Đảm bảo đề bài và testcases đã có trên Backend CSDL trước khi gửi bài ──
      try {
        const rawSaved = localStorage.getItem('aita_published_assignments');
        if (rawSaved) {
          const list: any[] = JSON.parse(rawSaved);
          const found = list.find((a) => a.id === activeTask.id);
          if (found) {
            let validDeadline = found.deadline;
            const parsed = new Date(found.deadline);
            if (isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
              validDeadline = new Date(Date.now() + 7 * 86400000).toISOString();
            } else {
              validDeadline = parsed.toISOString();
            }

            // Sync assignment
            await fetch(`${API_BASE_URL}/api/v1/assignments`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...headers },
              body: JSON.stringify({
                assignmentId: found.id,
                courseId: found.courseId || 'COURSE-SWP391',
                title: found.title || activeTask.title,
                description: found.description || activeTask.description,
                allowedLanguages: found.allowedLanguages || ['java', 'python', 'cpp', 'dotnet'],
                deadline: validDeadline,
                timeLimitMs: found.timeLimitMs || 2000,
                memoryLimitMb: found.memoryLimitMb || 512,
                testcasesCount: found.testCases?.length || 2,
              }),
            });

            // Sync test cases
            if (Array.isArray(found.testCases)) {
              for (const tc of found.testCases) {
                await fetch(`${API_BASE_URL}/api/v1/test-cases`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...headers },
                  body: JSON.stringify({
                    assignmentId: found.id,
                    inputData: tc.input || ' ',
                    expectedOutput: tc.output || ' ',
                    isHidden: !!tc.isHidden,
                    weight: Number(tc.weight) || 1.0,
                    timeLimitMs: found.timeLimitMs || 2000,
                  }),
                });
              }
            }
          }
        }
      } catch (syncErr) {
        console.warn('[Submission] Không thể tự động đồng bộ đề bài sang backend:', syncErr);
      }

      let response: Response | null = null;
      let networkErrorDetail = '';

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('studentId', currentUser.userId);
        formData.append('assignmentId', activeTask.id);
        formData.append('language', detectedLanguage);

        response = await fetch(`${API_BASE_URL}/api/v1/submissions`, {
          method: 'POST',
          headers,
          body: formData,
        });
      } catch (err: any) {
        networkErrorDetail = err?.message || 'Không thể kết nối đến máy chủ API Gateway';
        console.warn('[Gateway] API Gateway lỗi kết nối:', err);
      }

      if (response && response.status === 202) {
        const result = await response.json();
        const subId = result.data?.submissionId || result.submissionId;
        setSubmissionId(subId);
        submissionIdRef.current = subId;

        // Ưu tiên 1: Lắng nghe realtime từ WebSocket nếu đang kết nối
        if (socketRef.current && socketRef.current.connected) {
          socketRef.current.emit('join_submission', {
            submissionId: subId,
            studentId: currentUser.userId,
            role: currentUser.role,
          });

          socketRef.current.off('grading:progress');
          socketRef.current.on('grading:progress', (data: { stepId: string; stepName: string; status: any; detail?: string }) => {
            setSteps((prev) =>
                  upsertStep(
                    prev,
                    data.stepId,
                    { status: data.status, ...(data.detail ? { detail: data.detail } : {}) },
                    data.stepName,
                  )
                );
              });

          socketRef.current.off('grading:completed');
          socketRef.current.on('grading:completed', (data: any) => {
            if (data.aiRating) setAiRating(data.aiRating);
            const actualPlag = computedPlagiarism || data.plagiarismMatch;
            if (isLecturerRole(currentUser?.role)) {
              setPlagiarismMatch(actualPlag);
            } else {
              setPlagiarismMatch(undefined);
            }

            // BR-03: Đạo văn AST từ 80% trở lên (>= 80.0%) -> LẬP TỨC CHẤM 0 ĐIỂM HOÀN TOÀN
            const sim = data.similarityRate ?? actualPlag?.similarityRate ?? 0;
            const isSeverePlag = data.confirmedPlagiarism || sim >= 80.0;
            const finalScore = isSeverePlag ? 0.0 : (data.score !== undefined ? data.score : 0.0);
            const finalBreakdown: ScoreBreakdown = isSeverePlag
              ? { testcase1: 0, testcase2: 0, cleanCode: 0, solid: 0, total: 0 }
              : (data.scoreBreakdown || { testcase1: 0, testcase2: 0, cleanCode: 0, solid: 0, total: finalScore });

            setScore(finalScore);
            setScoreBreakdown(finalBreakdown);
            if (data.executionTimeMs !== undefined) setExecutionTimeMs(data.executionTimeMs);
            if (data.sourceCode) setCurrentSourceCode(data.sourceCode);
            persistGradingResult({
              score: finalScore,
              scoreBreakdown: finalBreakdown,
              submissionId: data.submissionId,
              sourceCode: data.sourceCode,
              aiRating: data.aiRating,
              passedTestcases: isSeverePlag ? 0 : data.passedTestcases,
              totalTestcases: data.totalTestcases,
              executionTimeMs: data.executionTimeMs,
              fileName: file.name,
            });
            setSteps((prev) =>
              syncTestcaseSteps(prev, data.testcaseResults).map((s) => {
                if (isSeverePlag && s.id === '6') {
                  return { ...s, status: 'failed', detail: `Vi phạm liêm chính: Đạo văn ${sim.toFixed(1)}% (≥ 80.0%). Bài làm bị 0.0 điểm theo quy tắc BR-03.` };
                }
                return s.id.startsWith('tc-') ? s : { ...s, status: 'passed' };
              })
            );
            setIsCompleted(true);
          });

          return;
        }

        // Ưu tiên 2: Fallback qua Polling GET /api/v1/submissions/:id khi Socket mất kết nối
        // Đảm bảo lấy điểm số & kết quả Docker Sandbox thật, KHÔNG mock điểm giả!
        let attempts = 0;
        const maxAttempts = 35;
        const pollTimer = setInterval(async () => {
          attempts++;
          try {
            const pollRes = await fetch(`${API_BASE_URL}/api/v1/submissions/${subId}`, { headers });
            if (pollRes.ok) {
              const pollData = await pollRes.json();
              const sub = pollData.data || pollData;
              if (sub.status === 'GRADED' || sub.status === 'FAILED') {
                clearInterval(pollTimer);
                if (sub.aiRating) setAiRating(sub.aiRating);

                // BR-03: Đạo văn AST từ 80% trở lên (>= 80.0%) -> LẬP TỨC CHẤM 0 ĐIỂM
                const sim = sub.similarityRate ?? sub.result?.similarityRate ?? 0;
                const isSeverePlag = sub.confirmedPlagiarism || sim >= 80.0;
                const finalScore = isSeverePlag ? 0.0 : (sub.score !== undefined ? sub.score : 0.0);
                const finalBreakdown: ScoreBreakdown = isSeverePlag
                  ? { testcase1: 0, testcase2: 0, cleanCode: 0, solid: 0, total: 0 }
                  : (sub.scoreBreakdown || { testcase1: 0, testcase2: 0, cleanCode: 0, solid: 0, total: finalScore });

                setScore(finalScore);
                setScoreBreakdown(finalBreakdown);
                if (sub.executionTimeMs !== undefined) setExecutionTimeMs(sub.executionTimeMs);
                if (sub.sourceCode) setCurrentSourceCode(sub.sourceCode);
                persistGradingResult({
                  score: finalScore,
                  scoreBreakdown: finalBreakdown,
                  submissionId: subId,
                  sourceCode: sub.sourceCode || codeToGrade,
                  aiRating: sub.aiRating,
                  passedTestcases: isSeverePlag ? 0 : sub.passedTestcases,
                  totalTestcases: sub.totalTestcases,
                  executionTimeMs: sub.executionTimeMs,
                  fileName: file.name,
                });
                setSteps((prev) =>
                  prev.map((s) => ({
                    ...s,
                    status: isSeverePlag && s.id === '6' ? 'failed' : (sub.status === 'GRADED' ? 'passed' : 'failed'),
                    detail: isSeverePlag && s.id === '6'
                      ? `Vi phạm liêm chính: Đạo văn ${sim.toFixed(1)}% (≥ 80.0%). Bài làm bị 0.0 điểm theo quy tắc BR-03.`
                      : (sub.status === 'GRADED' ? 'Hoàn thành (Đạt)' : (sub.errorMessage || 'Thất bại')),
                  }))
                );
                setIsCompleted(true);
                return;
              } else {
                setSteps((prev) =>
                  prev.map((s, idx) => {
                    if (idx === 0) return { ...s, status: 'passed', detail: 'Hàng đợi Redis BullMQ đã tiếp nhận' };
                    if (idx === 1) return { ...s, status: 'passed', detail: 'Container Sandbox đang thực thi cô lập' };
                    if (idx === 2) return { ...s, status: 'in_progress', detail: 'Đang chạy bộ testcases kiểm định...' };
                    return s;
                  })
                );
              }
            }
          } catch (pollErr) {
            console.warn('Lỗi Polling trạng thái bài nộp:', pollErr);
          }

          if (attempts >= maxAttempts) {
            clearInterval(pollTimer);
            setSteps((prev) =>
              prev.map((s) =>
                s.status === 'in_progress' ? { ...s, status: 'failed', detail: 'Timeout: Quá thời gian chờ Worker phản hồi' } : s
              )
            );
            setIsCompleted(true);
          }
        }, 1500);

        return;
      }

      // Nếu không gửi được bài (status !== 202 hoặc lỗi mạng): Hiển thị thông báo minh bạch, KHÔNG mock điểm giả
      let errorDetail = networkErrorDetail || `Máy chủ từ chối yêu cầu (HTTP ${response?.status || 500})`;
      if (response) {
        try {
          const errBody = await response.json();
          if (errBody.message) errorDetail = errBody.message;
        } catch {}
      }

      setSteps([
        {
          id: '1',
          label: 'Hàng đợi Redis BullMQ & Gateway',
          status: 'failed',
          detail: `[Lỗi nộp bài] ${errorDetail}. Vui lòng kiểm tra Docker Desktop / API Gateway (cổng 3000) và bấm 'Đóng' rồi thử nộp lại.`,
        },
        { id: '2', label: 'Khởi tạo Docker Sandbox', status: 'pending', detail: 'Chưa thể thực thi' },
        { id: '5', label: 'Đánh giá Clean Code & SOLID (GenAI)', status: 'pending', detail: 'Chưa thể thực thi' },
        { id: '6', label: 'Kiểm định Đạo văn AST Winnowing', status: 'pending', detail: 'Chưa thể thực thi' },
      ]);
      setIsCompleted(true);
      return;
    }

    // Chỉ dùng fallback mô phỏng thuật toán trên cặp mã nguồn Benchmark mẫu tĩnh
    if (benchmarkPairId !== undefined) {
      const subId = generateFallbackSubId();
      setSubmissionId(subId);
      submissionIdRef.current = subId;
      simulateSocketGradingEvents(computedPlagiarism);
    }
  };

  const simulateSocketGradingEvents = (realPlagiarism?: PlagiarismMatch) => {
    const delays = [600, 1400, 2400, 3400, 4600, 5800];
    const simRate = realPlagiarism?.similarityRate ?? 0;
    const isSeverePlag = simRate >= 80.0;
    const effectiveBreakdown: ScoreBreakdown = isSeverePlag
      ? {
          testcase1: 0,
          testcase2: 0,
          cleanCode: 0,
          solid: 0,
          total: 0,
        }
      : {
          testcase1: 3.5,
          testcase2: 3.5,
          cleanCode: 1.7,
          solid: 0.8,
          total: 9.5,
        };
    const effectiveScore = isSeverePlag ? 0.0 : effectiveBreakdown.total;

    delays.forEach((delay, index) => {
      setTimeout(() => {
        setSteps((prevSteps) =>
          prevSteps.map((step, idx) => {
            if (idx === index) {
              const currentDetail =
                step.id === '6'
                  ? 'Chuẩn hóa AST token và tính toán đặc trưng Winnowing...'
                  : 'Đang thực thi...';
              return { ...step, status: 'in_progress', detail: currentDetail };
            }
            if (idx < index) {
              const passDetail =
                step.id === '6'
                  ? 'Hoàn tất phân tích cấu trúc cây cú pháp trừu tượng AST.'
                  : 'Hoàn thành (ĐẠT)';
              return { ...step, status: 'passed', detail: passDetail };
            }
            return step;
          })
        );

        if (index === delays.length - 1) {
          setTimeout(() => {
            setSteps((prevSteps) =>
              prevSteps.map((s) => ({
                ...s,
                status: isSeverePlag && s.id === '6' ? 'failed' : 'passed',
                detail:
                  s.id === '6'
                    ? isSeverePlag
                      ? `Vi phạm liêm chính: Đạo văn AST ${simRate.toFixed(1)}% (≥ 80.0%). Bài làm bị hủy toàn bộ điểm số (0.0/10) theo quy tắc BR-03.`
                      : 'Hoàn tất phân tích cấu trúc cây cú pháp trừu tượng AST.'
                    : 'Hoàn thành (ĐẠT)',
              }))
            );

            setAiRating({
              cleanCodeScore: isSeverePlag ? 0 : 8.5,
              solidScore: isSeverePlag
                ? { s: 0, o: 0, l: 0, i: 0, d: 0 }
                : { s: 6.0, o: 9.0, l: 8.5, i: 9.0, d: 8.0 },
              codeSmells: [
                { line: 15, rule: 'Single Responsibility Principle', description: 'Hàm `sortAndPrintAndSaveToDatabase` vi phạm nguyên lý SRP do ôm đồm nhiều nhiệm vụ độc lập.' },
              ],
              explanation: isSeverePlag
                ? `Mã nguồn có độ tương đồng AST ${simRate.toFixed(1)}% vượt ngưỡng nghiêm trọng ≥ 80.0% theo quy chế liêm chính học thuật BR-03. Bài làm bị chấm 0.0 điểm.`
                : 'Mã nguồn có giải thuật rõ ràng, tối ưu thời gian chạy. Cần tách các phương thức in ấn và lưu trữ để tuân thủ nguyên lý Đơn trách nhiệm.',
            });

            if (isLecturerRole(currentUser?.role)) {
              setPlagiarismMatch(realPlagiarism);
            } else {
              setPlagiarismMatch(undefined);
            }
            setScoreBreakdown(effectiveBreakdown);
            setScore(effectiveScore);
            setExecutionTimeMs(1420);
            persistGradingResult({
              score: effectiveScore,
              scoreBreakdown: effectiveBreakdown,
              submissionId: submissionIdRef.current,
              passedTestcases: isSeverePlag ? 0 : 2,
              totalTestcases: 2,
            });
            setIsCompleted(true);
          }, 600);
        }
      }, delay);
    });
  };

  const switchDemoRole = (role: 'STUDENT' | 'INSTRUCTOR' | 'ADMIN') => {
    let targetUser: User;
    if (role === 'INSTRUCTOR') {
      targetUser = {
        userId: 'GV001',
        email: 'giangvien.edu@gmail.com',
        fullName: 'ThS. Giảng Viên AITA',
        role: 'INSTRUCTOR',
        token: 'dev_mock_jwt_GV001',
      };
      setActiveView('lecturer');
    } else if (role === 'ADMIN') {
      targetUser = {
        userId: 'ADMIN002',
        email: 'admin.aita@gmail.com',
        fullName: 'Quản Trị Viên AITA',
        role: 'ADMIN',
        token: 'dev_mock_jwt_ADMIN002',
      };
      setActiveView('admin');
    } else {
      targetUser = {
        userId: 'SE170002',
        email: 'linhcampochia@gmail.com',
        fullName: 'Linh Campochia',
        role: 'STUDENT',
        token: 'dev_mock_jwt_SE170002',
      };
      setActiveView('student');
    }
    setCurrentUser(targetUser);
    try {
      localStorage.setItem('aita_user', JSON.stringify(targetUser));
      localStorage.setItem('aita_token', targetUser.token || '');
    } catch (e) {
      console.warn('Cannot store switched user:', e);
    }
  };

  // NẾU CHƯA ĐĂNG NHẬP: BẮT BUỘC HIỂN THỊ MÀN HÌNH ĐĂNG NHẬP ĐẦU TIÊN
  if (!currentUser) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  // Phân quyền màn hình: Giảng viên và Sinh viên hoàn toàn độc lập, Admin có thể xem toàn bộ
  const navTabs = currentUser.role === 'ADMIN'
    ? [
        { key: 'admin', label: 'Hệ thống Quản trị', icon: <LayoutDashboard size={14} /> },
        { key: 'lecturer', label: 'Cổng Giảng Viên', icon: <BookOpen size={14} /> },
        { key: 'student', label: 'Giao diện Sinh viên', icon: <GraduationCap size={14} /> },
      ]
    : [];

  const handleRetrySubmission = () => {
    if (lastSubmissionRef.current?.file) {
      void handleSubmission(
        lastSubmissionRef.current.file,
        undefined,
        lastSubmissionRef.current.task,
        lastSubmissionRef.current.lang
      );
    }
  };

  const roleBadge =
    currentUser.role === 'ADMIN'
      ? { text: 'Quản trị viên', icon: <Shield size={11} /> }
      : isLecturerRole(currentUser.role)
        ? { text: 'Giảng viên', icon: <BookOpen size={11} /> }
        : { text: 'Sinh viên', icon: <GraduationCap size={11} /> };

  const socketStatus = {
    color: isSocketConnected ? 'var(--blue-300)' : 'var(--text-dim)',
    label: isSocketConnected ? 'Trực tuyến' : 'Đang kết nối',
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* THANH ĐIỀU HƯỚNG TRÊN CÙNG (NAVBAR) */}
      <nav
        style={{
          padding: '0 24px',
          height: '60px',
          backgroundColor: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderBottom: '1px solid var(--border-color)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <div className="nav-inner" style={{ maxWidth: '1320px', width: '100%', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
          {/* Logo & Tên hệ thống */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '11px', minWidth: 0 }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '9px',
                background: 'var(--blue-600)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--on-blue)',
                flexShrink: 0,
              }}
            >
              <Terminal size={17} strokeWidth={2.2} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14.5px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-main)' }}>
                  AITA
                </span>
                <span
                  className="nav-version"
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-strong)',
                    color: 'var(--text-muted)',
                  }}
                >
                  v2.0
                </span>
              </div>
              <span
                className="nav-subtitle"
                style={{
                  fontSize: '11px',
                  display: 'block',
                  color: 'var(--text-dim)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                Đánh giá mã nguồn &amp; liêm chính học thuật
              </span>
            </div>
          </div>

          {/* Center nav tabs (role-based) */}
          {navTabs.length > 1 && (
            <div style={{ display: 'flex', gap: 2, background: 'rgba(11, 18, 32, 0.03)', borderRadius: 9, padding: 3, border: '1px solid var(--border-color)' }}>
              {navTabs.map(tab => (
                <button key={tab.key}
                  onClick={() => setActiveView(tab.key as any)}
                  style={{
                    padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
                    background: activeView === tab.key ? 'rgba(11, 18, 32, 0.05)' : 'transparent',
                    color: activeView === tab.key ? 'var(--text-main)' : 'var(--text-muted)',
                    fontWeight: activeView === tab.key ? 600 : 500,
                    fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6,
                    transition: 'background-color .15s ease, color .15s ease',
                  }}>
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* Vùng Thông tin Người dùng, Phân quyền & Hành động */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Trạng thái WebSocket */}
            <div
              title={isSocketConnected ? 'Kết nối tới API Gateway đang hoạt động' : 'Đang thiết lập kết nối realtime'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                fontSize: '11px',
                fontWeight: 500,
                color: socketStatus.color,
                flexShrink: 0,
              }}
            >
              <span className="dot-live" style={{ opacity: isSocketConnected ? 1 : 0.4 }} />
              <span className="nav-status-label" style={{ whiteSpace: 'nowrap' }}>{socketStatus.label}</span>
            </div>

            <span className="nav-divider" style={{ width: 1, height: 22, background: 'var(--border-color)', flexShrink: 0 }} />

            {/* Quick Demo Role Switcher cho buổi bảo vệ Hội đồng */}
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Chuyển đổi vai trò nhanh để thuyết trình trước Hội đồng (không cần đăng xuất)"
            >
              <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '3px' }}>
                <ArrowLeftRight size={12} />
                <span className="nav-status-label">Vai trò:</span>
              </span>
              <select
                aria-label="Chuyển đổi vai trò demo"
                value={currentUser.role === 'ADMIN' ? 'ADMIN' : isLecturerRole(currentUser.role) ? 'INSTRUCTOR' : 'STUDENT'}
                onChange={(e) => switchDemoRole(e.target.value as any)}
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-strong)',
                  background: 'rgba(11, 18, 32, 0.04)',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <option value="STUDENT">🎓 Sinh viên</option>
                <option value="INSTRUCTOR">👨‍🏫 Giảng viên</option>
                <option value="ADMIN">🛡️ Quản trị viên</option>
              </select>
            </div>

            <span className="nav-divider" style={{ width: 1, height: 22, background: 'var(--border-color)', flexShrink: 0 }} />

            {/* Huy hiệu vai trò + thông tin người dùng */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
              <span
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: 'rgba(11, 18, 32, 0.05)',
                  border: '1px solid var(--border-strong)',
                  color: 'var(--text-main)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {currentUser.fullName.charAt(0).toUpperCase()}
              </span>
              <div className="nav-user-name" style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25, minWidth: 0 }}>
                <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>{currentUser.fullName}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {roleBadge.icon}
                  {roleBadge.text}
                </span>
              </div>
            </div>

            {/* Nút Đăng Xuất */}
            <button
              type="button"
              onClick={handleLogout}
              title="Đăng xuất khỏi tài khoản hiện tại"
              className="btn btn-secondary btn-sm"
              style={{ color: 'var(--text-soft)', flexShrink: 0 }}
            >
              <LogOut size={13} />
              <span className="nav-logout-text">Đăng xuất</span>
            </button>
          </div>
        </div>
      </nav>

      {/* NỘI DUNG CHÍNH (THEO PHÂN QUYỀN & ACTIVE VIEW) */}
      <main style={{ flexGrow: 1, padding: '24px 20px' }}>
        {/* ADMIN VIEW */}
        {activeView === 'admin' && currentUser.role === 'ADMIN' && (
          <AdminDashboard token={localStorage.getItem('aita_token') || ''} />
        )}

        {/* LECTURER VIEW: Dành riêng cho Giảng viên (INSTRUCTOR) */}
        {(isLecturerRole(currentUser.role) || (activeView === 'lecturer' && currentUser.role === 'ADMIN')) && (
          <div style={{ maxWidth: '1300px', margin: '0 auto' }}>
            <LecturerDashboard
              onOpenDiffViewer={(match, candidates) => {
                setPlagiarismDiffMatch(match);
                setPlagiarismCandidateMatches(candidates || [match]);
              }}
            />
          </div>
        )}

        {/* STUDENT VIEW: Dành riêng cho Sinh viên (STUDENT) */}
        {!isLecturerRole(currentUser.role) && currentUser.role !== 'ADMIN' && (
          <div style={{ maxWidth: '1160px', margin: '0 auto' }}>
            {/* KHỐI HIỂN THỊ CÁC MÔN HỌC ĐANG THEO HỌC (ENROLLED COURSES) */}
            <section style={{ marginBottom: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <p className="eyebrow" style={{ marginBottom: '2px' }}>Học phần của tôi</p>
                  <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)' }}>
                    {enrolledCourses.length} lớp học phần đang ghi danh
                  </h2>
                </div>
                <span style={{ fontSize: '11.5px', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="dot-live" />
                  Đồng bộ từ class_members
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '10px' }}>
                {enrolledCourses.map((c) => {
                  const isSelected = selectedStudentCourseId === c.courseId || selectedStudentCourseId === c.courseCode;
                  return (
                    <button
                      key={c.courseId}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => {
                        const targetId = c.courseCode || c.courseId;
                        if (selectedStudentCourseId === targetId || selectedStudentCourseId === c.courseId) {
                          setSelectedStudentCourseId('ALL');
                        } else {
                          setSelectedStudentCourseId(targetId);
                        }
                      }}
                      style={{
                        textAlign: 'left',
                        padding: '13px 15px',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        transition: 'background-color .15s ease, border-color .15s ease',
                        backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.09)' : '#ffffff',
                        border: `1px solid ${isSelected ? 'var(--border-highlight)' : 'var(--border-color)'}`,
                        boxShadow: isSelected ? '0 6px 18px -10px rgba(37, 99, 235, 0.45)' : 'var(--shadow-sm)',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.borderColor = 'var(--border-strong)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.borderColor = 'var(--border-color)';
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '7px' }}>
                        <span
                          style={{
                            fontSize: '10.5px',
                            fontWeight: 700,
                            letterSpacing: '0.05em',
                            fontFamily: 'var(--font-mono)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: isSelected ? 'var(--blue-600)' : 'rgba(11, 18, 32, 0.05)',
                            color: isSelected ? 'var(--on-blue)' : 'var(--text-soft)',
                          }}
                        >
                          {c.courseCode}
                        </span>
                        {isSelected ? (
                          <span style={{ fontSize: '10.5px', color: 'var(--blue-300)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Check size={11} strokeWidth={3} /> Đang chọn
                          </span>
                        ) : (
                          <span style={{ fontSize: '10.5px', color: 'var(--text-dim)' }}>Đang học</span>
                        )}
                      </div>
                      <h4 style={{ fontSize: '13px', fontWeight: 600, color: isSelected ? 'var(--text-main)' : 'var(--text-soft)', marginBottom: '3px', lineHeight: 1.4 }}>
                        {c.courseName}
                      </h4>
                      <p style={{ fontSize: '11.5px', color: 'var(--text-dim)' }}>{c.semester}</p>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Thanh Tab chuyển đổi giữa các khu vực chức năng */}
            <div
              role="tablist"
              style={{
                display: 'flex',
                gap: '2px',
                marginBottom: '20px',
                borderBottom: '1px solid var(--border-color)',
                overflowX: 'auto',
              }}
            >
              {([
                { key: 'submission', label: 'Nộp bài', icon: <FileCode size={14} /> },
                { key: 'history', label: 'Lịch sử & điểm', icon: <Clock size={14} /> },
                { key: 'appeals', label: 'Phúc khảo', icon: <Scale size={14} /> },
              ] as const).map((tab) => {
                const active = studentActiveTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setStudentActiveTab(tab.key)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '7px',
                      padding: '9px 14px',
                      border: 'none',
                      borderBottom: `2px solid ${active ? 'var(--blue-500)' : 'transparent'}`,
                      marginBottom: '-1px',
                      background: 'transparent',
                      color: active ? 'var(--blue-300)' : 'var(--text-muted)',
                      fontSize: '13px',
                      fontWeight: active ? 600 : 500,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'color .15s ease, border-color .15s ease',
                    }}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {studentActiveTab === 'submission' ? (
              <SubmissionView
                studentId={currentUser.userId}
                studentName={currentUser.fullName}
                enrolledCourses={enrolledCourses}
                selectedCourseId={selectedStudentCourseId}
                apiBaseUrl={API_BASE_URL}
                onSelectCourse={(courseId) => setSelectedStudentCourseId(courseId)}
                onSubmit={(file, taskItem, lang) => handleSubmission(file, undefined, taskItem, lang)}
              />
            ) : studentActiveTab === 'history' ? (
              <StudentHistoryView
                studentId={currentUser?.userId || 'SE170000'}
                studentName={currentUser?.fullName || 'Sinh viên'}
                apiBaseUrl={API_BASE_URL}
                onNavigateToSubmit={() => setStudentActiveTab('submission')}
              />
            ) : (
              <StudentAppealsView
                studentId={currentUser?.userId || 'SE170000'}
                studentName={currentUser?.fullName || 'Sinh viên'}
                apiBaseUrl={API_BASE_URL}
              />
            )}
          </div>
        )}

      </main>

      {/* MODAL TRỰC TUYẾN CHẤM BÀI & BÁO CÁO KẾT QUẢ */}
      <LiveGradingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onRetry={handleRetrySubmission}
        submissionId={submissionId}
        studentName={currentUser.fullName}
        language={submissionLanguage}
        steps={steps}
        isCompleted={isCompleted}
        aiRating={aiRating}
        plagiarismMatch={isLecturerRole(currentUser?.role) ? plagiarismMatch : undefined}
        sourceCode={currentSourceCode}
        score={score}
        scoreBreakdown={scoreBreakdown}
        executionTimeMs={executionTimeMs}
      />

      {/* MODAL ĐỐI SÁNH ĐẠO VĂN DÀNH CHO GIẢNG VIÊN (BR-04) */}
      <PlagiarismDiffModal
        isOpen={!!plagiarismDiffMatch}
        onClose={() => {
          setPlagiarismDiffMatch(null);
          setPlagiarismCandidateMatches([]);
        }}
        match={plagiarismDiffMatch}
        similarMatches={plagiarismCandidateMatches}
        studentAName={currentUser?.fullName || 'Bài nộp A'}
      />

      {/* Login Modal (backup/fallback) */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* CHÂN TRANG (FOOTER) THUẦN TIẾNG VIỆT */}
      <footer
        style={{
          borderTop: '1px solid var(--border-color)',
          padding: '18px 24px',
          backgroundColor: 'var(--ink-900)',
        }}
      >
        <div
          style={{
            maxWidth: '1320px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
            fontSize: '11.5px',
            color: 'var(--text-dim)',
          }}
        >
          <span>AITA — Hệ thống đánh giá mã nguồn &amp; giám sát liêm chính học thuật</span>
          <span>Bộ môn Kỹ thuật Phần mềm · Đại học FPT · 2026</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
