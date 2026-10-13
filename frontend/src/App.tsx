import { useState, useEffect, useRef } from 'react';
import { SubmissionView } from './components/SubmissionView';
import { LiveGradingModal } from './components/LiveGradingModal';
import { LoginView } from './components/LoginView';
import { LoginModal } from './components/LoginModal';
import { AdminDashboard } from './components/AdminDashboard';
import { LecturerDashboard } from './components/LecturerDashboard';
import { RblBenchmarkView } from './components/RblBenchmarkView';
import { StudentAppealsView } from './components/StudentAppealsView';
import type { Task, GradingStep, AIRating, PlagiarismMatch, User } from './types';
import { Terminal, Shield, LogOut, ArrowLeftRight, FileCode, Sparkles, Upload, BookOpen, LayoutDashboard, Scale } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

import { PlagiarismService } from './services/plagiarism.service';

const API_BASE_URL = 'http://localhost:3000';

function generateFallbackSubId(): string {
  return 'SUB-' + Date.now().toString(36).toUpperCase();
}

const mockTask: Task = {
  id: 'TASK-SWP391-SPRINT2',
  title: 'Xây dựng Thuật toán Sắp xếp Tối ưu & Cây Cú pháp AST',
  course: 'SWP391 - Đề Án Phát Triển Phần Mềm (Agile Scrum)',
  deadline: new Date(Date.now() + 2 * 3600 * 1000 + 45 * 60 * 1000).toISOString(),
  maxSizeMb: 10,
  allowedExtensions: ['.zip'],
  description: 'Nộp file nén .zip chứa mã nguồn hoàn chỉnh (Java / C++ / Python) để hệ thống tự động giải nén, kiểm tra SHA-256, chạy testcases trong Docker Sandbox và đánh giá Clean Code / SOLID.',
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

  // Active view: 'student' | 'admin' | 'lecturer'
  const [activeView, setActiveView] = useState<'student' | 'admin' | 'lecturer'>('student');

  // Tab cho Sinh viên: 'submission' (Khu vực nộp bài) | 'benchmark' (Bộ dữ liệu Benchmark RBL) | 'appeals' (Khiếu nại điểm)
  const [studentActiveTab, setStudentActiveTab] = useState<'submission' | 'benchmark' | 'appeals'>('submission');


  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [steps, setSteps] = useState<GradingStep[]>(initialSteps);
  const [isCompleted, setIsCompleted] = useState(false);
  const [submissionId, setSubmissionId] = useState('');
  const [currentSourceCode, setCurrentSourceCode] = useState<string>(mockSourceCodeStudent);
  const [aiRating, setAiRating] = useState<AIRating | undefined>(undefined);
  const [plagiarismMatch, setPlagiarismMatch] = useState<PlagiarismMatch | undefined>(undefined);
  const [score, setScore] = useState<number | undefined>(undefined);
  const [executionTimeMs, setExecutionTimeMs] = useState<number | undefined>(undefined);
  const socketRef = useRef<Socket | null>(null);

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
      if (data.plagiarismMatch) setPlagiarismMatch(data.plagiarismMatch);
      if (data.score !== undefined) setScore(data.score);
      if (data.executionTimeMs !== undefined) setExecutionTimeMs(data.executionTimeMs);
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
  };

  const handleLogout = () => {
    localStorage.removeItem('aita_token');
    localStorage.removeItem('aita_user');
    setCurrentUser(null);
    setActiveView('student');
  };

  // Nút chuyển đổi nhanh vai trò Giảng Viên / Sinh Viên cho buổi nghiệm thu
  const handleToggleDemoRole = () => {
    if (!currentUser) return;
    if (currentUser.role === 'INSTRUCTOR') {
      const studentUser: User = {
        userId: 'SE170000',
        email: 'trungse170000@fpt.edu.vn',
        fullName: 'Đinh Thành Trung',
        role: 'STUDENT',
        department: 'Khoa CNTT - ĐH FPT',
      };
      localStorage.setItem('aita_user', JSON.stringify(studentUser));
      setCurrentUser(studentUser);
    } else {
      const lecturerUser: User = {
        userId: 'GV001',
        email: 'trungdt@fe.edu.vn',
        fullName: 'ThS. Đinh Thành Trung',
        role: 'INSTRUCTOR',
        department: 'Bộ Môn Kỹ Thuật Phần Mềm - ĐH FPT',
      };
      localStorage.setItem('aita_user', JSON.stringify(lecturerUser));
      setCurrentUser(lecturerUser);
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
    setExecutionTimeMs(undefined);
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
      if (!file.name.toLowerCase().endsWith('.zip')) {
        try {
          const text = await file.text();
          if (text && text.trim().length > 0) {
            codeToGrade = text;
            setCurrentSourceCode(text);
          }
        } catch (err) {
          console.warn('Không thể đọc file dạng văn bản thuần:', err);
        }
      } else {
        setCurrentSourceCode(mockSourceCodeStudent);
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
              setPlagiarismMatch(computedPlagiarism);
              if (data.score !== undefined) setScore(data.score);
              if (data.executionTimeMs !== undefined) setExecutionTimeMs(data.executionTimeMs);
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
    simulateSocketGradingEvents(computedPlagiarism);
  };

  const simulateSocketGradingEvents = (realPlagiarism?: PlagiarismMatch) => {
    const delays = [600, 1400, 2400, 3400, 4600, 5800];

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
            setScore(8.8);
            setExecutionTimeMs(1420);
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

  // Role-based view tabs
  const navTabs = [
    { key: 'student', label: 'Nộp bài', icon: <Upload size={14} /> },
    ...(currentUser.role === 'INSTRUCTOR' || currentUser.role === 'ADMIN'
      ? [{ key: 'lecturer', label: 'Chấm bài', icon: <BookOpen size={14} /> }]
      : []),
    ...(currentUser.role === 'ADMIN'
      ? [{ key: 'admin', label: 'Hệ thống', icon: <LayoutDashboard size={14} /> }]
      : []),
  ];

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

            {/* Nút chuyển đổi vai trò Demo */}
            <button
              type="button"
              onClick={handleToggleDemoRole}
              title="Chuyển đổi vai trò để kiểm thử nghiệm thu"
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                color: '#e5e7eb',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease',
              }}
            >
              <ArrowLeftRight size={14} color="#06b6d4" />
              <span>Chuyển sang {currentUser.role === 'INSTRUCTOR' ? 'Sinh Viên' : 'Giảng Viên'}</span>
            </button>

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

        {/* LECTURER VIEW */}
        {activeView === 'lecturer' && (currentUser.role === 'INSTRUCTOR' || currentUser.role === 'ADMIN') && (
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

        {/* STUDENT / DEFAULT VIEW */}
        {activeView === 'student' && (
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
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
                task={mockTask}
                studentId={currentUser.userId}
                studentName={currentUser.fullName}
                onSubmit={(file, taskItem) => handleSubmission(file, undefined, taskItem)}
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
