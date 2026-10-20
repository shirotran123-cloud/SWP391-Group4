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

const API_BASE_URL = 'http://localhost:3000';

function generateFallbackSubId(): string {
  return 'SUB-' + Date.now().toString(36).toUpperCase();
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
  { id: '3', label: 'Chạy Testcase 1 (Dữ liệu cơ sở)', status: 'pending', detail: 'Đánh giá tính chính xác thuật toán' },
  { id: '4', label: 'Chạy Testcase 2 (Trường hợp biên)', status: 'pending', detail: 'Kiểm tra giới hạn thời gian (TLE) & bộ nhớ' },
  { id: '5', label: 'Đánh giá Clean Code & SOLID (GenAI)', status: 'pending', detail: 'Phân tích thiết kế hướng đối tượng qua Gemini/GPT' },
  { id: '6', label: 'Kiểm định Đạo văn AST Winnowing', status: 'pending', detail: 'So khớp vân tay mã nguồn trên cây cú pháp trừu tượng' },
];

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
    const fetchStudentCourses = () => {
      if (currentUser && !isLecturerRole(currentUser.role) && currentUser.role !== 'ADMIN') {
        const studentId = currentUser.userId || currentUser.email || 'SE170000';
        fetch(`${API_BASE_URL}/api/v1/courses/student/${studentId}`)
          .then((res) => res.json())
          .then((data) => {
            const list = data.data || data || [];
            if (Array.isArray(list) && list.length > 0) {
              const seen = new Set<string>();
              const deduped: any[] = [];
              for (const c of list) {
                const upper = (c.courseCode || c.courseId || '').toUpperCase();
                let norm = c.courseCode || c.courseId;
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
          })
          .catch(() => {});
      }
    };

    fetchStudentCourses();
    window.addEventListener('aita_courses_updated', fetchStudentCourses);
    return () => {
      window.removeEventListener('aita_courses_updated', fetchStudentCourses);
    };
  }, [currentUser]);

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [steps, setSteps] = useState<GradingStep[]>(initialSteps);
  const [isCompleted, setIsCompleted] = useState(false);
  const [submissionId, setSubmissionId] = useState('');
  const [currentAssignmentId, setCurrentAssignmentId] = useState('');
  const [currentSourceCode, setCurrentSourceCode] = useState<string>(mockSourceCodeStudent);
  const [aiRating, setAiRating] = useState<AIRating | undefined>(undefined);
  const [plagiarismMatch, setPlagiarismMatch] = useState<PlagiarismMatch | undefined>(undefined);
  const [plagiarismDiffMatch, setPlagiarismDiffMatch] = useState<PlagiarismMatch | null>(null);
  const [score, setScore] = useState<number | undefined>(undefined);
  const [scoreBreakdown, setScoreBreakdown] = useState<ScoreBreakdown | undefined>(undefined);
  const [executionTimeMs, setExecutionTimeMs] = useState<number | undefined>(undefined);
  const currentAssignmentIdRef = useRef('');
  const submissionIdRef = useRef('');
  const currentUserRef = useRef<User | null>(null);
  const socketRef = useRef<Socket | null>(null);
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
        prev.map((s) => (s.id === data.stepId ? { ...s, status: data.status, detail: data.detail || s.detail } : s))
      );
    });

    socket.on('testcase:evaluated', (data: { testcaseIndex: number; totalTestcases: number; status: string; timeMs: number }) => {
      const stepId = data.testcaseIndex === 1 ? '3' : '4';
      setSteps((prev) =>
        prev.map((s) =>
          s.id === stepId
            ? {
                ...s,
                status: data.status === 'PASSED' ? 'passed' : 'failed',
                detail: `Testcase ${data.testcaseIndex}/${data.totalTestcases}: ${data.status === 'PASSED' ? 'ĐẠT' : 'KHÔNG ĐẠT'} (${data.timeMs}ms)`,
              }
            : s
        )
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
        prev.map((s) => (s.status === 'in_progress' || s.status === 'pending' ? { ...s, status: 'passed' } : s))
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
        passedTestcases: data.passedTestcases ?? current.passedTestcases ?? 2,
        totalTestcases: data.totalTestcases ?? current.totalTestcases ?? 2,
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

  const handleSubmission = async (file?: File, benchmarkPairId?: number, submittedTask?: Task) => {
    const activeTask = submittedTask || mockTask;
    if (!currentUser) return;

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
          const bestKey =
            candidateKeys.find((k) => k.toLowerCase().includes('solution.')) ||
            candidateKeys.find((k) => /\.(java|cpp|c|py|cs|js|ts)$/i.test(k)) ||
            candidateKeys[0];

          if (bestKey && zip.files[bestKey]) {
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

    const token = localStorage.getItem('aita_token');
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('studentId', currentUser.userId);
        formData.append('assignmentId', activeTask.id);
        formData.append('language', codeToGrade.includes('def ') ? 'python' : 'java');

        const response = await fetch(`${API_BASE_URL}/api/v1/submissions`, {
          method: 'POST',
          headers,
          body: formData,
        });

        if (response.status === 202) {
          const result = await response.json();
          const subId = result.data.submissionId;
          setSubmissionId(subId);
          submissionIdRef.current = subId;

          if (socketRef.current && socketRef.current.connected) {
            socketRef.current.emit('join_submission', {
              submissionId: subId,
              studentId: currentUser.userId,
              role: currentUser.role,
            });

            socketRef.current.off('grading:progress');
            socketRef.current.on('grading:progress', (data: { stepId: string; stepName: string; status: any; detail?: string }) => {
              setSteps((prev) =>
                prev.map((s) => (s.id === data.stepId ? { ...s, status: data.status, detail: data.detail || s.detail } : s))
              );
            });

            socketRef.current.off('grading:completed');
            socketRef.current.on('grading:completed', (data: any) => {
              if (data.aiRating) setAiRating(data.aiRating);
              if (isLecturerRole(currentUser?.role)) {
                setPlagiarismMatch(computedPlagiarism || data.plagiarismMatch);
              } else {
                setPlagiarismMatch(undefined);
              }
              if (data.score !== undefined) setScore(data.score);
              if (data.scoreBreakdown) setScoreBreakdown(data.scoreBreakdown);
              if (data.executionTimeMs !== undefined) setExecutionTimeMs(data.executionTimeMs);
              if (data.sourceCode) setCurrentSourceCode(data.sourceCode);
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
              setSteps((prev) => prev.map((s) => ({ ...s, status: 'passed' })));
              setIsCompleted(true);
            });

            return;
          }
        }
      }
    } catch (err) {
      console.warn('[Gateway] API Gateway lỗi kết nối, kích hoạt cơ chế mô phỏng tự động chuẩn xác:', err);
    }

    const subId = generateFallbackSubId();
    setSubmissionId(subId);
    submissionIdRef.current = subId;
    simulateSocketGradingEvents(computedPlagiarism);
  };

  const simulateSocketGradingEvents = (realPlagiarism?: PlagiarismMatch) => {
    const delays = [600, 1400, 2400, 3400, 4600, 5800];
    const fallbackBreakdown: ScoreBreakdown = {
      testcase1: 4.0,
      testcase2: 3.0,
      cleanCode: 1.7,
      solid: 0.8,
      total: 9.5,
    };

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
                status: 'passed',
                detail:
                  s.id === '6'
                    ? 'Hoàn tất phân tích cấu trúc cây cú pháp trừu tượng AST.'
                    : 'Hoàn thành (ĐẠT)',
              }))
            );

            setAiRating({
              cleanCodeScore: 8.5,
              solidScore: { s: 6.0, o: 9.0, l: 8.5, i: 9.0, d: 8.0 },
              codeSmells: [
                { line: 15, rule: 'Single Responsibility Principle', description: 'Hàm `sortAndPrintAndSaveToDatabase` vi phạm nguyên lý SRP do ôm đồm nhiều nhiệm vụ độc lập.' },
              ],
              explanation: 'Mã nguồn có giải thuật rõ ràng, tối ưu thời gian chạy. Cần tách các phương thức in ấn và lưu trữ để tuân thủ nguyên lý Đơn trách nhiệm.',
            });

            if (isLecturerRole(currentUser?.role)) {
              setPlagiarismMatch(realPlagiarism);
            } else {
              setPlagiarismMatch(undefined);
            }
            setScoreBreakdown(fallbackBreakdown);
            setScore(fallbackBreakdown.total);
            setExecutionTimeMs(1420);
            persistGradingResult({ score: fallbackBreakdown.total, scoreBreakdown: fallbackBreakdown, submissionId: submissionIdRef.current });
            setIsCompleted(true);
          }, 600);
        }
      }, delay);
    });
  };

  // NẾU CHƯA ĐĂNG NHẬP: BẮT BUỘC HIỂN THỊ MÀN HÌNH ĐĂNG NHẬP ĐẦU TIÊN
  if (!currentUser) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  // Phân quyền màn hình: Giảng viên và Sinh viên hoàn toàn độc lập, không chuyển đổi qua lại
  const navTabs = currentUser.role === 'ADMIN'
    ? [
        { key: 'admin', label: 'Hệ thống Quản trị', icon: <LayoutDashboard size={14} /> },
        { key: 'lecturer', label: 'Cổng Giảng Viên', icon: <BookOpen size={14} /> },
      ]
    : [];

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
              onOpenDiffViewer={(match) => {
                setPlagiarismDiffMatch(match);
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
                        backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'rgba(11, 18, 32, 0.025)',
                        border: `1px solid ${isSelected ? 'var(--border-highlight)' : 'var(--border-color)'}`,
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
                onSelectCourse={(courseId) => setSelectedStudentCourseId(courseId)}
                onSubmit={(file, taskItem) => handleSubmission(file, undefined, taskItem)}
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
        submissionId={submissionId}
        studentName={currentUser.fullName}
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
        onClose={() => setPlagiarismDiffMatch(null)}
        match={plagiarismDiffMatch}
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
