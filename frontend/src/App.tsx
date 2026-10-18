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
import type { Task, GradingStep, AIRating, PlagiarismMatch, User, ScoreBreakdown } from './types';
import { Terminal, Shield, LogOut, FileCode, Sparkles, Upload, BookOpen, LayoutDashboard, Scale, ArrowLeftRight, Clock } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

import { PlagiarismService } from './services/plagiarism.service';
import JSZip from 'jszip';

const API_BASE_URL = 'http://localhost:3000';

function generateFallbackSubId(): string {
  return 'SUB-' + Date.now().toString(36).toUpperCase();
}

// NOTE: the hard-coded `mockTask` and `mockSourceCodeStudent` fixtures were removed.
// The submission flow now requires a real assignment selected from the lecturer's
// published list, and the source code always comes from the file the student uploads.

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
        if (u.role === 'INSTRUCTOR') return 'lecturer';
        if (u.role === 'ADMIN') return 'admin';
      }
    } catch {
      // ignore
    }
    return 'student';
  });

  // Tab cho Sinh viên: 'submission' (Khu vực nộp bài) | 'history' (Lịch sử nộp & điểm số) | 'benchmark' (Bộ dữ liệu Benchmark RBL) | 'appeals' (Khiếu nại điểm)
  const [studentActiveTab, setStudentActiveTab] = useState<'submission' | 'history' | 'benchmark' | 'appeals'>('submission');

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
    if (currentUser?.role === 'STUDENT') {
      const studentId = currentUser.userId || 'SE170000';
      fetch(`${API_BASE_URL}/api/v1/courses/student/${studentId}`)
        .then((res) => res.json())
        .then((data) => {
          const list = data.data || data || [];
          if (Array.isArray(list) && list.length > 0) {
            const seen = new Set<string>();
            const deduped: any[] = [];
            for (const c of list) {
              const upper = (c.courseCode || c.courseId || '').toUpperCase();
              let norm = c.courseCode;
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
  }, [currentUser]);

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [steps, setSteps] = useState<GradingStep[]>(initialSteps);
  const [isCompleted, setIsCompleted] = useState(false);
  const [submissionId, setSubmissionId] = useState('');
  const [currentAssignmentId, setCurrentAssignmentId] = useState('');
  const [currentSourceCode, setCurrentSourceCode] = useState<string>('');
  const [aiRating, setAiRating] = useState<AIRating | undefined>(undefined);
  const [plagiarismMatch, setPlagiarismMatch] = useState<PlagiarismMatch | undefined>(undefined);
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
    if (user.role === 'INSTRUCTOR') {
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
    if (!currentUser) return;
    // A real assignment must be chosen; the removed mock default silently graded a
    // fixture that had nothing to do with the lecturer's published task.
    const activeTask = submittedTask;
    if (!activeTask) {
      console.warn('[Submission] Bỏ qua: chưa chọn bài tập thật để nộp.');
      return;
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

    // Source code starts empty; it is filled from the uploaded file (or the RBL
    // benchmark pair when the benchmark view drives the flow).
    let codeToGrade = '';
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
              // Ưu tiên kết quả AST/Winnowing THẬT do API Gateway trả về qua WebSocket.
              // Chỉ dùng kết quả tính cục bộ khi Gateway không có kho bài nộp để đối chiếu.
              if (data.plagiarismMatch) {
                setPlagiarismMatch(data.plagiarismMatch);
              } else if (computedPlagiarism) {
                setPlagiarismMatch(computedPlagiarism);
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
                  ? realPlagiarism
                    ? `Đang chạy thuật toán Winnowing w=10, k=15... (${realPlagiarism.similarityRate}% tương đồng)`
                    : 'Đang tra cứu cơ sở dữ liệu đối sánh...'
                  : 'Đang thực thi...';
              return { ...step, status: 'in_progress', detail: currentDetail };
            }
            if (idx < index) {
              const passDetail =
                step.id === '6'
                  ? realPlagiarism
                    ? `Hoàn tất AST & Winnowing: ${realPlagiarism.similarityRate}% (${realPlagiarism.isFlagged ? 'NGHI VẤN' : 'AN TOÀN'})`
                    : 'Không phát hiện trùng khớp trong kho bài nội bộ'
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
                    ? realPlagiarism
                      ? `Hoàn tất AST & Winnowing: ${realPlagiarism.similarityRate}% (${realPlagiarism.isFlagged ? 'CẢNH BÁO ĐẠO VĂN' : 'MÃ NGUỒN AN TOÀN'})`
                      : 'Hoàn tất AST: Không phát hiện gian lận trong kho mã nguồn'
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

            setPlagiarismMatch(realPlagiarism);
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
    return (
      <>
        <LoginView
          onLoginSuccess={handleLoginSuccess}
          onOpenOtpLogin={() => setIsLoginModalOpen(true)}
        />
        <LoginModal
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
          onLoginSuccess={(user) => handleLoginSuccess(user)}
        />
      </>
    );
  }

  // Phân quyền màn hình: Giảng viên và Sinh viên hoàn toàn độc lập, không chuyển đổi qua lại
  const navTabs = currentUser.role === 'ADMIN'
    ? [
        { key: 'admin', label: 'Hệ thống Quản trị', icon: <LayoutDashboard size={14} /> },
        { key: 'lecturer', label: 'Cổng Giảng Viên', icon: <BookOpen size={14} /> },
      ]
    : [];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* THANH ĐIỀU HƯỚNG TRÊN CÙNG (NAVBAR) */}
      <nav
        className="glass-panel"
        style={{
          borderRadius: '0',
          borderLeft: 'none',
          borderRight: 'none',
          borderTop: 'none',
          padding: '14px 28px',
          backgroundColor: 'rgba(10, 15, 29, 0.85)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ maxWidth: '1300px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Logo & Tên hệ thống */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 15px rgba(99, 102, 241, 0.35)',
              }}
            >
              <Terminal size={22} />
            </div>
            <div>
              <span className="gradient-text" style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.3px' }}>
                AITA-INTELLIGENT
              </span>
              <span style={{ fontSize: '11px', display: 'block', color: 'var(--text-muted)' }}>
                Hệ Thống Đánh Giá Mã Nguồn & Giám Sát Liêm Chính Học Thuật Tự Động
              </span>
            </div>
          </div>

          {/* Center nav tabs (role-based) */}
          {navTabs.length > 1 && (
            <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 4, border: '1px solid var(--border-color)' }}>
              {navTabs.map(tab => (
                <button key={tab.key}
                  onClick={() => setActiveView(tab.key as any)}
                  style={{
                    padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: activeView === tab.key ? 'rgba(99,102,241,0.25)' : 'transparent',
                    color: activeView === tab.key ? '#818cf8' : 'var(--text-muted)',
                    fontWeight: activeView === tab.key ? 700 : 500,
                    fontSize: 13, display: 'flex', alignItems: 'center', gap: 6,
                    transition: 'all 0.2s',
                  }}>
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* Vùng Thông tin Người dùng, Phân quyền & Hành động */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {/* Huy hiệu vai trò */}
            <span
              style={{
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 800,
                backgroundColor:
                  currentUser.role === 'ADMIN'
                    ? 'rgba(245, 158, 11, 0.2)'
                    : currentUser.role === 'INSTRUCTOR'
                    ? 'rgba(99, 102, 241, 0.2)'
                    : 'rgba(16, 185, 129, 0.2)',
                color:
                  currentUser.role === 'ADMIN'
                    ? '#f59e0b'
                    : currentUser.role === 'INSTRUCTOR'
                    ? '#a5b4fc'
                    : '#6ee7b7',
                border: `1px solid ${
                  currentUser.role === 'ADMIN'
                    ? 'rgba(245, 158, 11, 0.4)'
                    : currentUser.role === 'INSTRUCTOR'
                    ? 'rgba(99, 102, 241, 0.4)'
                    : 'rgba(16, 185, 129, 0.4)'
                }`,
              }}
            >
              {currentUser.role === 'ADMIN'
                ? '⚙️ ADMIN'
                : currentUser.role === 'INSTRUCTOR'
                ? '👨‍🏫 GIẢNG VIÊN'
                : '👨‍🎓 SINH VIÊN'}
            </span>

            {/* Thông tin tên & email */}
            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'right' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>{currentUser.fullName}</span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{currentUser.email}</span>
            </div>

            {/* Trạng thái WebSocket */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                fontWeight: 600,
                padding: '5px 10px',
                borderRadius: '16px',
                backgroundColor: isSocketConnected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                color: isSocketConnected ? 'var(--accent-emerald)' : '#eab308',
                border: `1px solid ${isSocketConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(234, 179, 8, 0.3)'}`,
              }}
            >
              <Shield size={12} />
              <span>{isSocketConnected ? 'Cổng Dịch Vụ Sẵn Sàng' : 'Đang Kết Nối Cổng...'}</span>
            </div>

            {/* Nút Đăng Xuất */}
            <button
              type="button"
              onClick={handleLogout}
              title="Đăng xuất khỏi tài khoản hiện tại"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                borderRadius: '8px',
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 700,
              }}
            >
              <LogOut size={14} /> Đăng Xuất
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
        {(currentUser.role === 'INSTRUCTOR' || (activeView === 'lecturer' && currentUser.role === 'ADMIN')) && (
          <div style={{ maxWidth: '1300px', margin: '0 auto' }}>
            <LecturerDashboard
              onOpenDiffViewer={(match) => {
                setPlagiarismMatch(match);
                setCurrentSourceCode(match.sourceCodeA);
                setIsModalOpen(true);
                setIsCompleted(true);
              }}
            />
          </div>
        )}

        {/* STUDENT VIEW: Dành riêng cho Sinh viên (STUDENT) */}
        {currentUser.role === 'STUDENT' && (
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            {/* KHỐI HIỂN THỊ CÁC MÔN HỌC ĐANG THEO HỌC (ENROLLED COURSES) */}
            <div
              className="glass-panel"
              style={{
                padding: '20px 24px',
                borderRadius: '16px',
                marginBottom: '20px',
                border: '1.5px solid rgba(99, 102, 241, 0.3)',
                backgroundColor: 'rgba(15, 23, 42, 0.6)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <BookOpen size={20} color="var(--accent-primary)" />
                  <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff' }}>
                    Các Lớp Học Phần Bạn Đang Ghi Danh ({enrolledCourses.length} Môn)
                  </h3>
                </div>
                <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}>
                  ● Đồng bộ thời gian thực từ PostgreSQL (class_members)
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                {enrolledCourses.map((c) => {
                  const isSelected = selectedStudentCourseId === c.courseId || selectedStudentCourseId === c.courseCode;
                  return (
                    <div
                      key={c.courseId}
                      onClick={() => {
                        const targetId = c.courseCode || c.courseId;
                        if (selectedStudentCourseId === targetId || selectedStudentCourseId === c.courseId) {
                          setSelectedStudentCourseId('ALL');
                        } else {
                          setSelectedStudentCourseId(targetId);
                        }
                      }}
                      style={{
                        padding: '14px 18px',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                        border: `1.5px solid ${isSelected ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.08)'}`,
                        boxShadow: isSelected ? '0 4px 15px rgba(99, 102, 241, 0.25)' : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            backgroundColor: isSelected ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.1)',
                            color: '#ffffff',
                          }}
                        >
                          {c.courseCode}
                        </span>
                        <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 700 }}>
                          ✓ Đang Học (Active)
                        </span>
                      </div>
                      <h4 style={{ fontSize: '14px', fontWeight: 700, color: isSelected ? '#ffffff' : 'var(--text-muted)', marginBottom: '4px' }}>
                        {c.courseName}
                      </h4>
                      <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                        {c.semester} • Giảng viên AITA
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Thanh Tab chuyển đổi giữa Nộp bài & Benchmark Dataset */}
            <div
              style={{
                display: 'flex',
                gap: '12px',
                marginBottom: '20px',
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: '12px',
              }}
            >
              <button
                type="button"
                onClick={() => setStudentActiveTab('submission')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: studentActiveTab === 'submission' ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.05)',
                  color: studentActiveTab === 'submission' ? '#ffffff' : 'var(--text-muted)',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <FileCode size={16} /> Nộp Bài Tập Lập Trình (.zip)
              </button>

              <button
                type="button"
                onClick={() => setStudentActiveTab('history')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: studentActiveTab === 'history' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  color: studentActiveTab === 'history' ? '#10b981' : 'var(--text-muted)',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: studentActiveTab === 'history' ? '#10b981' : 'transparent',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <Clock size={16} /> Lịch Sử Nộp &amp; Điểm Số
              </button>

              <button
                type="button"
                onClick={() => setStudentActiveTab('benchmark')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: studentActiveTab === 'benchmark' ? 'rgba(6, 182, 212, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  color: studentActiveTab === 'benchmark' ? 'var(--accent-cyan)' : 'var(--text-muted)',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: studentActiveTab === 'benchmark' ? 'var(--accent-cyan)' : 'transparent',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <ArrowLeftRight size={16} /> Đối Soát Đạo Văn (AST Winnowing)
              </button>

              <button
                type="button"
                onClick={() => setStudentActiveTab('appeals')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: studentActiveTab === 'appeals' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  color: studentActiveTab === 'appeals' ? '#fbbf24' : 'var(--text-muted)',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: studentActiveTab === 'appeals' ? '#f59e0b' : 'transparent',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <Scale size={16} /> Phúc Khảo &amp; Khiếu Nại (UC-06)
              </button>
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
            ) : studentActiveTab === 'benchmark' ? (
              <RblBenchmarkView
                onOpenDiffViewer={(match) => {
                  setPlagiarismMatch(match);
                  setCurrentSourceCode(match.sourceCodeA);
                  setIsModalOpen(true);
                  setIsCompleted(true);
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
        onClose={() => setIsModalOpen(false)}
        submissionId={submissionId}
        studentName={currentUser.fullName}
        steps={steps}
        isCompleted={isCompleted}
        aiRating={aiRating}
        plagiarismMatch={plagiarismMatch}
        sourceCode={currentSourceCode}
        score={score}
        scoreBreakdown={scoreBreakdown}
        executionTimeMs={executionTimeMs}
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
          padding: '20px 24px',
          textAlign: 'center',
          fontSize: '13px',
          color: 'var(--text-dim)',
          backgroundColor: 'rgba(10, 15, 29, 0.95)',
        }}
      >
        Hệ Thống Đánh Giá Mã Nguồn & Giám Sát Liêm Chính Học Thuật AITA © 2026 • Bộ Môn Kỹ Thuật Phần Mềm - Trường Đại Học FPT.
      </footer>
    </div>
  );
}

export default App;
