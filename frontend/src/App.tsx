import { useState, useEffect, useRef } from 'react';
import { SubmissionView } from './components/SubmissionView';
import { LiveGradingModal } from './components/LiveGradingModal';
import { LoginView } from './components/LoginView';
import { AdminDashboard } from './components/AdminDashboard';
import { LecturerDashboard } from './components/LecturerDashboard';
import { StudentAppealsView } from './components/StudentAppealsView';
import { StudentHistoryView } from './components/StudentHistoryView';
import { PlagiarismDiffModal } from './components/PlagiarismDiffModal';
import type { Task, GradingStep, AIRating, PlagiarismMatch, User, ScoreBreakdown, PlagiarismCluster, PlagiarismPairItem, CrossClusterIndependence } from './types';
import { isLecturerRole } from './types';
import { Terminal, Shield, LogOut, FileCode, Upload, BookOpen, LayoutDashboard, Scale, Clock, GraduationCap, Check, ChevronDown, Users, Sparkles } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

import { PlagiarismService } from './services/plagiarism.service';
import JSZip from 'jszip';
import { API_BASE_URL } from './config/api';
import Footer from './components/Footer';
import { Click } from './components/effects/Click';

function generateFallbackSubId(): string {
  return 'SUB-' + Date.now().toString(36).toUpperCase();
}

/**
 * Tự động nhận diện ngôn ngữ lập trình của bài nộp (Java, Python, C++).
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
    return explicitLanguage.toLowerCase().trim();
  }

  const candidateName = (extractedFilename || file?.name || '').toLowerCase();
  let detected = '';

  if (/\.(py|python)$/i.test(candidateName)) {
    detected = 'python';
  } else if (/\.(java)$/i.test(candidateName)) {
    detected = 'java';
  } else if (/\.(cpp|cc|cxx|hpp|h)$/i.test(candidateName)) {
    detected = 'cpp';
  }

  // 2. Phân tích signature nội dung mã nguồn nếu tên file chưa rõ ràng
  if (!detected && sourceCode && sourceCode.trim().length > 0) {
    const code = sourceCode;
    if (code.includes('def ') || /import\s+sys|import\s+os|from\s+\w+\s+import|if\s+__name__\s*==|print\s*\(/.test(code)) {
      detected = 'python';
    } else if (/#include\s*<iostream>|std::cout|std::cin|cout\s*<<|cin\s*>>|using\s+namespace\s+std|#include\s*<vector>|#include\s*<algorithm>/.test(code)) {
      detected = 'cpp';
    } else if (/public\s+class|System\.out\.print|import\s+java\./.test(code)) {
      detected = 'java';
    }
  }

  // 3. Đối soát với allowedLanguages của Assignment
  if (allowedLanguages && allowedLanguages.length > 0) {
    const normalizedAllowed = allowedLanguages.map((l) => l.toLowerCase());
    if (detected && normalizedAllowed.includes(detected)) {
      return detected;
    }
    if (!detected && normalizedAllowed.length === 1) {
      return normalizedAllowed[0];
    }
  }

  return detected || 'java';
}

const mockTask: Task = {
  id: 'TASK-PRJ301-A1',
  title: 'Xây dựng Servlet & Filter Quản lý Sinh viên MVC (PRJ301)',
  course: 'PRJ301 - Java Web Application Development',
  deadline: '2026-11-15T23:59:59.000Z',
  maxSizeMb: 10,
  allowedExtensions: ['.zip'],
  description: 'Thiết kế và triển khai web application Java theo mô hình MVC 2, sử dụng Servlet xử lý request và Filter xác thực session người dùng.',
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
  { id: '6', label: 'Kiểm định AST Winnowing', status: 'pending', detail: 'So khớp vân tay mã nguồn trên cây cú pháp trừu tượng' },
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

export interface AppRouteState {
  view: 'student' | 'admin' | 'lecturer';
  studentTab?: 'submission' | 'history' | 'appeals';
  taskId?: string | null;
  lecturerTab?: string | null;
  courseId?: string | null;
  adminTab?: string | null;
  modal?: string | null;
}

export function parseUrlToRoute(pathname: string, hash: string): AppRouteState {
  let cleanPath = pathname || '/';
  if (hash && hash.startsWith('#')) {
    const hashWithoutHash = hash.slice(1).replace(/^\/+/, '');
    if (hashWithoutHash && !hashWithoutHash.startsWith('modal-')) {
      cleanPath = '/' + hashWithoutHash;
    }
  }

  if (cleanPath.length > 1 && cleanPath.endsWith('/')) {
    cleanPath = cleanPath.slice(0, -1);
  }

  const parts = cleanPath.split('/').filter(Boolean);
  if (parts.length === 0) {
    return { view: 'student', studentTab: 'submission', taskId: null };
  }

  const first = parts[0].toLowerCase();

  // Admin routes: /admin, /admin/:tab
  if (first === 'admin') {
    return {
      view: 'admin',
      adminTab: parts[1] || 'overview',
    };
  }

  // Lecturer routes: /lecturer, /lecturer/:tab, /lecturer/course/:courseId
  if (first === 'lecturer' || first === 'instructor') {
    if (parts[1]?.toLowerCase() === 'course' && parts[2]) {
      return {
        view: 'lecturer',
        lecturerTab: 'COURSES',
        courseId: decodeURIComponent(parts[2]),
      };
    }
    return {
      view: 'lecturer',
      lecturerTab: parts[1]?.toUpperCase() || 'COURSES',
    };
  }

  // Direct submission link aliases: /submit/:taskId, /task/:taskId, /assignment/:taskId, /submission/:taskId
  if (first === 'submit' || first === 'task' || first === 'assignment' || first === 'submission') {
    return {
      view: 'student',
      studentTab: 'submission',
      taskId: parts[1] ? decodeURIComponent(parts[1]) : null,
    };
  }

  // Student routes: /student, /student/submit, /student/submit/:taskId, /student/history, /student/appeals
  if (first === 'student') {
    const second = parts[1]?.toLowerCase();
    if (second === 'history') {
      return { view: 'student', studentTab: 'history', taskId: null };
    }
    if (second === 'appeals' || second === 'appeal') {
      return { view: 'student', studentTab: 'appeals', taskId: null };
    }
    if (second === 'submit' || second === 'task' || second === 'assignment' || second === 'submission') {
      return {
        view: 'student',
        studentTab: 'submission',
        taskId: parts[2] ? decodeURIComponent(parts[2]) : null,
      };
    }
    return { view: 'student', studentTab: 'submission', taskId: null };
  }

  return { view: 'student', studentTab: 'submission', taskId: null };
}

export function buildRoutePath(route: AppRouteState): string {
  if (route.view === 'admin') {
    return route.adminTab && route.adminTab !== 'overview' ? `/admin/${route.adminTab}` : '/admin';
  }
  if (route.view === 'lecturer') {
    if (route.courseId) {
      return `/lecturer/course/${encodeURIComponent(route.courseId)}`;
    }
    if (route.lecturerTab && route.lecturerTab !== 'COURSES') {
      return `/lecturer/${route.lecturerTab.toLowerCase()}`;
    }
    return '/lecturer';
  }
  if (route.studentTab === 'history') {
    return '/student/history';
  }
  if (route.studentTab === 'appeals') {
    return '/student/appeals';
  }
  if (route.taskId) {
    return `/student/submit/${encodeURIComponent(route.taskId)}`;
  }
  return '/student';
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

  // Khởi tạo trạng thái điều hướng URL (Single-Page App URL Router)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(() => {
    try {
      const parsed = parseUrlToRoute(window.location.pathname, window.location.hash);
      return parsed.taskId || null;
    } catch {
      return null;
    }
  });

  // Active view: 'student' | 'admin' | 'lecturer' (tự động phân định theo URL hoặc vai trò)
  const [activeView, setActiveView] = useState<'student' | 'admin' | 'lecturer'>(() => {
    try {
      const parsed = parseUrlToRoute(window.location.pathname, window.location.hash);
      if (parsed.view) return parsed.view;
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
  const [studentActiveTab, setStudentActiveTab] = useState<'submission' | 'history' | 'appeals'>(() => {
    try {
      const parsed = parseUrlToRoute(window.location.pathname, window.location.hash);
      if (parsed.studentTab) return parsed.studentTab;
    } catch {
      // ignore
    }
    return 'submission';
  });

  // Danh sách môn học sinh viên đang tham gia (nạp từ PostgreSQL qua API)
  const [enrolledCourses, setEnrolledCourses] = useState<Array<{ courseId: string; courseCode: string; courseName: string; semester: string; description?: string }>>([
    {
      courseId: 'CRS-PRO192',
      courseCode: 'PRO192',
      courseName: 'Object-Oriented Programming with Java (PRO192)',
      semester: 'Fall 2026',
      description: 'Lập trình hướng đối tượng với Java, kế thừa, đa hình và Collection Framework.',
    },
    {
      courseId: 'CRS-CSD201',
      courseCode: 'CSD201',
      courseName: 'Data Structures and Algorithms (CSD201)',
      semester: 'Fall 2026',
      description: 'Cấu trúc dữ liệu và giải thuật nâng cao (Stack, Queue, Tree, Graph, Sorting).',
    },
    {
      courseId: 'CRS-PRJ301',
      courseCode: 'PRJ301',
      courseName: 'Java Web Application Development (PRJ301)',
      semester: 'Fall 2026',
      description: 'Xây dựng ứng dụng web với Java Servlet, JSP, MVC pattern và JDBC.',
    },
    {
      courseId: 'CRS-PRF192',
      courseCode: 'PRF192',
      courseName: 'Programming Fundamentals with C (PRF192)',
      semester: 'Fall 2026',
      description: 'Kỹ thuật lập trình cơ bản với ngôn ngữ C: con trỏ, mảng, chuỗi và cấp phát động.',
    },
    {
      courseId: 'COURSE-SWP391',
      courseCode: 'SWP391',
      courseName: 'Software Development Project (SWP391)',
      semester: 'Fall 2026',
      description: 'Dự án Phát triển Phần mềm Thực chiến, Kiến trúc Clean Code & SOLID.',
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
  const [plagiarismClusters, setPlagiarismClusters] = useState<PlagiarismCluster[]>([]);
  const [plagiarismAllSubmissions, setPlagiarismAllSubmissions] = useState<any[]>([]);
  const [plagiarismInitialClusterId, setPlagiarismInitialClusterId] = useState<number | undefined>(undefined);
  const [plagiarismInitialPair, setPlagiarismInitialPair] = useState<PlagiarismPairItem | null>(null);
  const [plagiarismCrossClusterIndependence, setPlagiarismCrossClusterIndependence] = useState<CrossClusterIndependence[]>([]);
  const [score, setScore] = useState<number | undefined>(undefined);
  const [scoreBreakdown, setScoreBreakdown] = useState<ScoreBreakdown | undefined>(undefined);
  const [executionTimeMs, setExecutionTimeMs] = useState<number | undefined>(undefined);
  const currentAssignmentIdRef = useRef('');
  const submissionIdRef = useRef('');
  const currentUserRef = useRef<User | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const lastSubmissionRef = useRef<{ file?: File; task?: Task; lang?: string } | null>(null);
  const isModalOpenRef = useRef(isModalOpen);
  isModalOpenRef.current = isModalOpen;
  const plagiarismDiffMatchRef = useRef(plagiarismDiffMatch);
  plagiarismDiffMatchRef.current = plagiarismDiffMatch;

  const navigate = (newRoute: AppRouteState, replace = false) => {
    const newPath = buildRoutePath(newRoute);
    if (replace) {
      window.history.replaceState(newRoute, '', newPath);
    } else {
      if (window.location.pathname !== newPath) {
        window.history.pushState(newRoute, '', newPath);
      }
    }
    setActiveView(newRoute.view);
    if (newRoute.studentTab) setStudentActiveTab(newRoute.studentTab);
    if (newRoute.taskId !== undefined) setSelectedTaskId(newRoute.taskId);
  };

  // Đồng bộ lịch sử trình duyệt (Browser History & Popstate Navigation)
  useEffect(() => {
    const currentParsed = parseUrlToRoute(window.location.pathname, window.location.hash);

    if (window.location.pathname === '/' || window.location.pathname === '') {
      const targetView = currentUser
        ? isLecturerRole(currentUser.role)
          ? 'lecturer'
          : currentUser.role === 'ADMIN'
          ? 'admin'
          : 'student'
        : 'student';
      const homeRoute: AppRouteState = { view: targetView, studentTab: 'submission', taskId: null };
      navigate(homeRoute, true);
    } else if (currentParsed.taskId) {
      // Khi truy cập trực tiếp bài nộp: tạo điểm neo Home trước trong browser history
      // để khi nhấn nút Back trình duyệt sẽ quay về Home / danh sách deadline thay vì thoát trang!
      const parentRoute: AppRouteState = { view: 'student', studentTab: 'submission', taskId: null };
      window.history.replaceState(parentRoute, '', '/student');
      window.history.pushState(currentParsed, '', buildRoutePath(currentParsed));
      setActiveView('student');
      setStudentActiveTab('submission');
      setSelectedTaskId(currentParsed.taskId);
    } else {
      window.history.replaceState(currentParsed, '', buildRoutePath(currentParsed));
      setActiveView(currentParsed.view);
      if (currentParsed.studentTab) setStudentActiveTab(currentParsed.studentTab);
      if (currentParsed.taskId !== undefined) setSelectedTaskId(currentParsed.taskId);
    }

    const handlePopState = (e: PopStateEvent) => {
      // 1. Đóng modal trực tuyến chấm điểm nếu đang mở
      if (isModalOpenRef.current) {
        setIsModalOpen(false);
        return;
      }
      // 2. Đóng modal đối sánh đạo văn nếu đang mở
      if (plagiarismDiffMatchRef.current) {
        setPlagiarismDiffMatch(null);
        return;
      }

      // 3. Khôi phục trạng thái giao diện theo URL
      const stateRoute: AppRouteState =
        e.state || parseUrlToRoute(window.location.pathname, window.location.hash);
      setActiveView(stateRoute.view || 'student');
      if (stateRoute.studentTab) setStudentActiveTab(stateRoute.studentTab);
      setSelectedTaskId(stateRoute.taskId || null);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Khởi tạo kết nối Socket.IO
  useEffect(() => {
    const socket = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      // Bỏ qua trang cảnh báo ngrok khi Socket.IO fallback sang HTTP long-polling
      extraHeaders: { 'ngrok-skip-browser-warning': 'true' },
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

    socket.on('grading:progress', (data: { submissionId?: string; stepId: string; stepName: string; status: any; detail?: string }) => {
      if (data?.submissionId && submissionIdRef.current && data.submissionId !== submissionIdRef.current) return;
      setSteps((prev) =>
        upsertStep(
          prev,
          data.stepId,
          { status: data.status, ...(data.detail ? { detail: data.detail } : {}) },
          data.stepName,
        )
      );
    });

    socket.on('testcase:evaluated', (data: { submissionId?: string; testcaseIndex: number; totalTestcases: number; status: string; timeMs: number; memoryKb?: number }) => {
      if (data?.submissionId && submissionIdRef.current && data.submissionId !== submissionIdRef.current) return;
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
      if (data?.submissionId && submissionIdRef.current && data.submissionId !== submissionIdRef.current) return;
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
      if (data?.submissionId && submissionIdRef.current && data.submissionId !== submissionIdRef.current) return;
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
        syncTestcaseSteps(prev, data.testcaseResults).map((s) => {
          if (data.compileError && s.id === '2') {
            return { ...s, status: 'failed', detail: s.detail || 'Biên dịch mã nguồn thất bại trong Sandbox.' };
          }
          if (s.id.startsWith('tc-') || s.status === 'failed') return s;
          return s.status === 'in_progress' || s.status === 'pending' ? { ...s, status: 'passed' } : s;
        })
      );
      setIsCompleted(true);
    });

    socket.on('grading:failed', (data: any) => {
      if (data?.submissionId && submissionIdRef.current && data.submissionId !== submissionIdRef.current) return;
      setSteps((prev) => {
        let marked = false;
        const next = prev.map((s) => {
          if (s.status === 'in_progress') {
            marked = true;
            return { ...s, status: 'failed' as const, detail: data?.error || s.detail || 'Thất bại' };
          }
          return s;
        });
        if (!marked) {
          const fallbackIdx = next.findIndex((s) => s.status === 'pending' || s.id === '2');
          if (fallbackIdx !== -1) {
            next[fallbackIdx] = {
              ...next[fallbackIdx],
              status: 'failed',
              detail: data?.error || next[fallbackIdx].detail || 'Chấm bài thất bại',
            };
          }
        }
        return next;
      });
      setIsCompleted(true);
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
      navigate({ view: 'lecturer', studentTab: 'submission', taskId: null }, true);
    } else if (user.role === 'ADMIN') {
      navigate({ view: 'admin', studentTab: 'submission', taskId: null }, true);
    } else {
      setSelectedStudentCourseId('ALL');
      navigate({ view: 'student', studentTab: 'submission', taskId: null }, true);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('aita_token');
    localStorage.removeItem('aita_user');
    setCurrentUser(null);
    navigate({ view: 'student', studentTab: 'submission', taskId: null }, true);
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

    window.dispatchEvent(new Event('aita_submission_completed'));
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
    window.history.pushState(
      { view: 'student', studentTab: 'submission', taskId: activeTask.id, modal: 'grading' },
      '',
      window.location.pathname + '#modal-grading'
    );

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
            } else if (lang === 'python') {
              bestKey = candidateKeys.find((k) => /\.(py)$/i.test(k));
            } else if (lang === 'java') {
              bestKey = candidateKeys.find((k) => /\.(java)$/i.test(k));
            }
          }

          if (!bestKey) {
            bestKey =
              candidateKeys.find((k) => k.toLowerCase().includes('solution.')) ||
              candidateKeys.find((k) => /\.(java|cpp|cc|cxx|py|js|ts)$/i.test(k)) ||
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
          socketRef.current.on('grading:progress', (data: { submissionId?: string; stepId: string; stepName: string; status: any; detail?: string }) => {
            if (data?.submissionId && data.submissionId !== subId) return;
            setSteps((prev) =>
                  upsertStep(
                    prev,
                    data.stepId,
                    { status: data.status, ...(data.detail ? { detail: data.detail } : {}) },
                    data.stepName,
                  )
                );
              });

          socketRef.current.off('grading:failed');
          socketRef.current.on('grading:failed', (data: { submissionId?: string; error?: string }) => {
            if (data?.submissionId && data.submissionId !== subId) return;
            setSteps((prev) => {
              let marked = false;
              const next = prev.map((s) => {
                if (s.status === 'in_progress') {
                  marked = true;
                  return { ...s, status: 'failed' as const, detail: data?.error || s.detail || 'Chấm bài thất bại' };
                }
                return s;
              });
              if (!marked) {
                const fallbackIdx = next.findIndex((s) => s.status === 'pending' || s.id === '2');
                if (fallbackIdx !== -1) {
                  next[fallbackIdx] = {
                    ...next[fallbackIdx],
                    status: 'failed',
                    detail: data?.error || next[fallbackIdx].detail || 'Chấm bài thất bại',
                  };
                }
              }
              return next;
            });
            setIsCompleted(true);
          });

          socketRef.current.off('grading:completed');
          socketRef.current.on('grading:completed', (data: any) => {
            if (data?.submissionId && data.submissionId !== subId) return;
            if (data.aiRating) setAiRating(data.aiRating);
            const actualPlag = computedPlagiarism || data.plagiarismMatch;
            if (isLecturerRole(currentUser?.role)) {
              setPlagiarismMatch(actualPlag);
            } else {
              setPlagiarismMatch(undefined);
            }

            // BR-03: Đạo văn AST từ 80% trở lên (>= 80.0%)
            // Nếu bài quá ngắn (<= 20 dòng, status === 'SUSPECTED'): tạm giữ điểm chờ Giảng viên kiểm tra trực tiếp.
            const sim = data.similarityRate ?? actualPlag?.similarityRate ?? 0;
            const isPendingShortReview =
              !data.confirmedPlagiarism &&
              (actualPlag?.status === 'SUSPECTED' || (data.plagiarismStatus === 'NGHI VẤN' && sim >= 70.0));
            const isSeverePlag =
              data.confirmedPlagiarism === true ||
              (!isPendingShortReview && actualPlag?.status === 'FLAGGED_PLAGIARISM') ||
              (!isPendingShortReview && data.confirmedPlagiarism !== false && sim >= 80.0);
            const finalScore = isSeverePlag ? 0.0 : (data.score ?? data.computedScoreBeforePenalty ?? 0);
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
                if (data.compileError && s.id === '2') {
                  return {
                    ...s,
                    status: 'failed',
                    detail: s.detail || 'Biên dịch mã nguồn thất bại trong Docker Sandbox.',
                  };
                }
                if (s.id === '6') {
                  const isLecturerViewer = isLecturerRole(currentUser?.role);
                  if (isSeverePlag) {
                    const msg = data.confirmedPlagiarism
                      ? (isLecturerViewer
                          ? `Đã xác nhận đạo văn (${sim.toFixed(1)}%) — Áp dụng điểm 0 theo quy chế.`
                          : 'Bài nộp được áp dụng quy chế liêm chính học thuật.')
                      : (isLecturerViewer
                          ? `Nghi vấn sao chép cao (${sim.toFixed(1)}%) — Áp dụng điểm 0 theo quy chế, chờ giảng viên xác nhận.`
                          : 'Bài nộp đang được chuyển giảng viên xem xét theo quy chế liêm chính học thuật.');
                    return { ...s, status: 'failed', detail: msg };
                  } else if (isPendingShortReview && sim >= 50.0) {
                    const msg = isLecturerViewer
                      ? `Không đủ cơ sở kết luận (bài ngắn ≤ 20 dòng, đo AST ${sim.toFixed(1)}%) — Điểm được giữ nguyên (${finalScore}/10).`
                      : 'Hoàn thành kiểm định AST Winnowing.';
                    return { ...s, status: 'passed', detail: msg };
                  }
                }
                if (s.id.startsWith('tc-') || s.status === 'failed') return s;
                return { ...s, status: 'passed' };
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
              const resPayload = sub.result || sub.details || {};
              const isDoneSuccess = sub.status === 'COMPLETED' || sub.status === 'GRADED';
              const isDoneFailed = sub.status === 'FAILED';
              if (isDoneFailed) {
                clearInterval(pollTimer);
                const errDetail = sub.errorMessage || resPayload.error || 'Chấm bài thất bại';
                setSteps((prev) => {
                  let marked = false;
                  const next = prev.map((s) => {
                    if (s.status === 'in_progress') {
                      marked = true;
                      return { ...s, status: 'failed' as const, detail: errDetail };
                    }
                    return s;
                  });
                  if (!marked) {
                    const fallbackIdx = next.findIndex((s) => s.status === 'pending' || s.id === '2');
                    if (fallbackIdx !== -1) {
                      next[fallbackIdx] = { ...next[fallbackIdx], status: 'failed', detail: errDetail };
                    }
                  }
                  return next;
                });
                setIsCompleted(true);
                return;
              }
              if (isDoneSuccess) {
                clearInterval(pollTimer);
                const resolvedAiRating = sub.aiRating || resPayload.aiRating;
                if (resolvedAiRating) setAiRating(resolvedAiRating);

                // BR-03: Đạo văn AST từ 80% trở lên (>= 80.0%)
                const resolvedPlag = sub.plagiarismMatch || resPayload.plagiarismMatch;
                const resolvedPlagStatus = sub.plagiarismStatus || resPayload.plagiarismStatus;
                const sim = sub.similarityRate ?? resPayload.similarityRate ?? resolvedPlag?.similarityRate ?? 0;
                const confirmedFlag = sub.confirmedPlagiarism ?? resPayload.confirmedPlagiarism;
                const isPendingShortReview =
                  !confirmedFlag &&
                  (resolvedPlag?.status === 'SUSPECTED' || (resolvedPlagStatus === 'NGHI VẤN' && sim >= 70.0));
                const isSeverePlag =
                  confirmedFlag === true ||
                  (!isPendingShortReview && resolvedPlag?.status === 'FLAGGED_PLAGIARISM') ||
                  (!isPendingShortReview && confirmedFlag !== false && sim >= 80.0);
                const finalScore = isSeverePlag
                  ? 0.0
                  : (sub.score ?? resPayload.score ?? sub.computedScoreBeforePenalty ?? resPayload.computedScoreBeforePenalty ?? 0);
                const rawBreakdown = sub.scoreBreakdown || resPayload.scoreBreakdown;
                const finalBreakdown: ScoreBreakdown = isSeverePlag
                  ? { testcase1: 0, testcase2: 0, cleanCode: 0, solid: 0, total: 0 }
                  : (rawBreakdown || { testcase1: 0, testcase2: 0, cleanCode: 0, solid: 0, total: finalScore });

                const resolvedExecMs = sub.executionTimeMs ?? resPayload.executionTimeMs;
                const resolvedSource = sub.sourceCode || resPayload.sourceCode;
                const resolvedPassed = isSeverePlag ? 0 : (sub.passedTestcases ?? resPayload.passedTestcases);
                const resolvedTotal = sub.totalTestcases ?? resPayload.totalTestcases;
                const resolvedTcResults = sub.testcaseResults || resPayload.testcaseResults;
                const isCompileErr = Boolean(sub.compileError ?? resPayload.compileError);

                setScore(finalScore);
                setScoreBreakdown(finalBreakdown);
                if (resolvedExecMs !== undefined) setExecutionTimeMs(resolvedExecMs);
                if (resolvedSource) setCurrentSourceCode(resolvedSource);
                persistGradingResult({
                  score: finalScore,
                  scoreBreakdown: finalBreakdown,
                  submissionId: subId,
                  sourceCode: resolvedSource || codeToGrade,
                  aiRating: resolvedAiRating,
                  passedTestcases: resolvedPassed,
                  totalTestcases: resolvedTotal,
                  executionTimeMs: resolvedExecMs,
                  fileName: file.name,
                });
                setSteps((prev) =>
                  syncTestcaseSteps(prev, resolvedTcResults).map((s) => {
                    if (isCompileErr && s.id === '2') {
                      return {
                        ...s,
                        status: 'failed',
                        detail: 'Biên dịch mã nguồn thất bại trong Docker Sandbox.',
                      };
                    }
                    if (s.id === '6') {
                      const isLecturerViewer = isLecturerRole(currentUser?.role);
                      const detailMsg = isSeverePlag
                        ? (confirmedFlag === true
                            ? (isLecturerViewer
                                ? `Đã xác nhận đạo văn (${sim.toFixed(1)}%) — Áp dụng điểm 0 theo quy chế.`
                                : 'Bài nộp được áp dụng quy chế liêm chính học thuật.')
                            : (isLecturerViewer
                                ? `Nghi vấn sao chép cao (${sim.toFixed(1)}%) — Áp dụng điểm 0 theo quy chế, chờ giảng viên xác nhận.`
                                : 'Bài nộp đang được chuyển giảng viên xem xét theo quy chế liêm chính học thuật.'))
                        : isPendingShortReview && sim >= 50.0
                          ? (isLecturerViewer
                              ? `Không đủ cơ sở kết luận (bài ngắn ≤ 20 dòng, đo AST ${sim.toFixed(1)}%) — Điểm được giữ nguyên (${finalScore}/10).`
                              : 'Hoàn thành kiểm định AST Winnowing.')
                          : 'Hoàn thành phân tích AST & Winnowing';
                      return {
                        ...s,
                        status: isSeverePlag ? 'failed' : 'passed',
                        detail: detailMsg,
                      };
                    }
                    if (s.id.startsWith('tc-') || s.status === 'failed') return s;
                    return {
                      ...s,
                      status: 'passed',
                      detail: 'Hoàn thành (Đạt)',
                    };
                  }),
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
        { id: '6', label: 'Kiểm định AST Winnowing', status: 'pending', detail: 'Chưa thể thực thi' },
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
    const isShortSuspected = realPlagiarism?.status === 'SUSPECTED' && simRate >= 70.0;
    const isSeverePlag = realPlagiarism?.status === 'FLAGGED_PLAGIARISM' || (!isShortSuspected && simRate >= 80.0);
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
                      ? (isLecturerRole(currentUser?.role)
                          ? `Nghi vấn sao chép cao (${simRate.toFixed(1)}%) — Áp dụng điểm 0 theo quy chế, chờ giảng viên xác nhận.`
                          : 'Bài nộp đang được chuyển giảng viên xem xét theo quy chế liêm chính học thuật.')
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
                ? `Mã nguồn có độ tương đồng AST đo được ${simRate.toFixed(1)}% vượt ngưỡng quy chế liêm chính — đang áp dụng điểm 0 theo quy chế (chờ giảng viên xác nhận).`
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
      navigate({ view: 'lecturer', studentTab: 'submission', taskId: null });
    } else if (role === 'ADMIN') {
      targetUser = {
        userId: 'ADMIN002',
        email: 'admin.aita@gmail.com',
        fullName: 'Quản Trị Viên AITA',
        role: 'ADMIN',
        token: 'dev_mock_jwt_ADMIN002',
      };
      setActiveView('admin');
      navigate({ view: 'admin', studentTab: 'submission', taskId: null });
    } else {
      targetUser = {
        userId: 'SE170002',
        email: 'linhcampochia@gmail.com',
        fullName: 'Linh Campochia',
        role: 'STUDENT',
        token: 'dev_mock_jwt_SE170002',
      };
      setActiveView('student');
      navigate({ view: 'student', studentTab: 'submission', taskId: null });
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
    return (
      <Click variant="ring" color="#0E4274" size={100} duration={400}>
        <LoginView onLoginSuccess={handleLoginSuccess} />
      </Click>
    );
  }

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
    <Click variant="ring" color="#0E4274" size={100} duration={400}>
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#ffffff' }}>
      {/* THANH ĐIỀU HƯỚNG TRÊN CÙNG (NAVBAR) */}
      <nav
        style={{
          padding: '0 24px',
          height: '62px',
          backgroundColor: 'rgba(255, 255, 255, 0.88)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderBottom: '1px solid rgba(14, 66, 116, 0.13)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <div className="nav-inner" style={{ maxWidth: '1360px', width: '100%', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px' }}>
          {/* Logo & Tên hệ thống (Click về Home) */}
          <div
            onClick={() => navigate({ view: activeView, studentTab: 'submission', taskId: null })}
            style={{ display: 'flex', alignItems: 'center', gap: '11px', minWidth: 0, flexShrink: 0, cursor: 'pointer' }}
            title="Về Trang Chủ (Home)"
          >
            <img
              src="/aita-logo.png"
              alt="AITA Logo"
              style={{
                width: '36px',
                height: '36px',
                objectFit: 'contain',
                flexShrink: 0,
              }}
            />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14.5px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-main)' }}>
                  AITA
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

          {/* Vùng Thông tin Người dùng, Phân quyền & Hành động */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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

            {/* Huy hiệu vai trò */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 11px',
                borderRadius: '8px',
                border: '1px solid rgba(14, 66, 116, 0.22)',
                backgroundColor: 'rgba(14, 66, 116, 0.06)',
                color: '#0E4274',
                fontSize: '12px',
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {roleBadge.icon}
              <span>{roleBadge.text}</span>
            </span>

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
                <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>{currentUser.fullName}</span>
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
        {activeView === 'admin' && (
          <AdminDashboard token={localStorage.getItem('aita_token') || ''} />
        )}

        {/* LECTURER VIEW: Dành riêng cho Giảng viên (INSTRUCTOR) */}
        {activeView === 'lecturer' && (
          <div style={{ maxWidth: '1300px', margin: '0 auto' }}>
            <LecturerDashboard
              onOpenDiffViewer={(match, candidates, extraData) => {
                setPlagiarismDiffMatch(match);
                setPlagiarismCandidateMatches(candidates || [match]);
                setPlagiarismClusters(extraData?.clusters || []);
                setPlagiarismAllSubmissions(extraData?.allSubmissions || []);
                setPlagiarismInitialClusterId(extraData?.initialClusterId);
                setPlagiarismInitialPair(extraData?.initialPair || null);
                setPlagiarismCrossClusterIndependence(extraData?.crossClusterIndependence || []);
              }}
            />
          </div>
        )}

        {/* STUDENT VIEW: Dành riêng cho Sinh viên (STUDENT) */}
        {activeView === 'student' && (
          <div style={{ maxWidth: '1160px', margin: '0 auto' }}>
            {/* KHỐI HIỂN THỊ CÁC MÔN HỌC ĐANG THEO HỌC (ENROLLED COURSES) */}
            <section style={{ marginBottom: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <p className="eyebrow" style={{ marginBottom: '4px' }}>Học phần của tôi</p>
                  <h2 className="aita-page-title">
                    {enrolledCourses.length} lớp học phần đang ghi danh
                  </h2>
                </div>
                <span style={{ fontSize: '11.5px', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="dot-live" />
                  Đồng bộ từ class_members
                </span>
              </div>

              <div className="aita-grid-3">
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
                      className={`aita-card aita-card-interactive ${isSelected ? 'selected' : ''}`}
                      style={{
                        textAlign: 'left',
                        padding: '16px 18px',
                        cursor: 'pointer',
                        gap: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            letterSpacing: '0.05em',
                            fontFamily: 'var(--font-mono)',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            backgroundColor: isSelected ? '#0E4274' : '#ffffff',
                            color: isSelected ? '#ffffff' : '#0E4274',
                            border: `1px solid ${isSelected ? '#0E4274' : 'rgba(14, 66, 116, 0.16)'}`,
                          }}
                        >
                          {c.courseCode}
                        </span>
                        {isSelected ? (
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#0E4274', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Check size={12} strokeWidth={3} /> Đang chọn
                          </span>
                        ) : (
                          <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-dim)' }}>Đang học</span>
                        )}
                      </div>
                      <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.4, margin: 0 }}>
                        {c.courseName}
                      </h4>
                      <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: 0, paddingTop: '4px', borderTop: '1px solid rgba(14, 66, 116, 0.08)' }}>{c.semester}</p>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Thanh Tab chuyển đổi giữa các khu vực chức năng */}
            <div
              role="tablist"
              aria-label="Khu vực sinh viên"
              className="aita-tablist"
            >
              {([
                { key: 'submission', label: 'Nộp bài', icon: <FileCode size={15} /> },
                { key: 'history', label: 'Lịch sử & điểm', icon: <Clock size={15} /> },
                { key: 'appeals', label: 'Phúc khảo', icon: <Scale size={15} /> },
              ] as const).map((tab) => {
                const active = studentActiveTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => {
                      setStudentActiveTab(tab.key);
                      setSelectedTaskId(null);
                      navigate({ view: 'student', studentTab: tab.key, taskId: null });
                    }}
                    className={`aita-tab-btn ${active ? 'active' : ''}`}
                  >
                    <span className="tab-icon">{tab.icon}</span>
                    <span>{tab.label}</span>
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
                selectedTaskId={selectedTaskId}
                onSelectTask={(taskItem) => {
                  if (taskItem) {
                    navigate({ view: 'student', studentTab: 'submission', taskId: taskItem.id });
                  } else {
                    if (window.history.state?.taskId) {
                      window.history.back();
                    } else {
                      navigate({ view: 'student', studentTab: 'submission', taskId: null });
                    }
                  }
                }}
                apiBaseUrl={API_BASE_URL}
                onSelectCourse={(courseId) => setSelectedStudentCourseId(courseId)}
                onSubmit={(file, taskItem, lang) => handleSubmission(file, undefined, taskItem, lang)}
              />
            ) : studentActiveTab === 'history' ? (
              <StudentHistoryView
                studentId={currentUser?.userId || 'SE170000'}
                studentName={currentUser?.fullName || 'Sinh viên'}
                apiBaseUrl={API_BASE_URL}
                onNavigateToSubmit={() => {
                  setStudentActiveTab('submission');
                  setSelectedTaskId(null);
                  navigate({ view: 'student', studentTab: 'submission', taskId: null });
                }}
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
        onClose={() => {
          setIsModalOpen(false);
          if (window.location.hash.includes('modal-grading')) {
            window.history.back();
          }
        }}
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
          setPlagiarismClusters([]);
          setPlagiarismInitialPair(null);
          setPlagiarismInitialClusterId(undefined);
          setPlagiarismCrossClusterIndependence([]);
        }}
        match={plagiarismDiffMatch}
        similarMatches={plagiarismCandidateMatches}
        studentAName={currentUser?.fullName || 'Bài nộp A'}
        clusters={plagiarismClusters}
        allSubmissions={plagiarismAllSubmissions}
        initialClusterId={plagiarismInitialClusterId}
        initialPair={plagiarismInitialPair}
        crossClusterIndependence={plagiarismCrossClusterIndependence}
      />

      {/* CHÂN TRANG (FOOTER) THUẦN TIẾNG VIỆT */}
      <Footer />

    </div>
    </Click>
  );
}

export default App;
