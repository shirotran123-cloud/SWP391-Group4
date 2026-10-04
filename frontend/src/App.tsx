import { useState } from 'react';
import { SubmissionView } from './components/SubmissionView';
import { LiveGradingModal } from './components/LiveGradingModal';
import type { Task, GradingStep, AIRating, PlagiarismMatch } from './types';
import { Terminal, Shield, Users } from 'lucide-react';

const mockTask: Task = {
  id: 'TASK-SWP391-SPRINT2',
  title: 'Xây dựng Module Chấm Bài Tự Động & AST Analytics',
  course: 'SWP391 - Phân tích & Thiết kế Phần mềm',
  deadline: new Date(Date.now() + 2 * 3600 * 1000 + 45 * 60 * 1000).toISOString(),
  maxSizeMb: 10,
  allowedExtensions: ['.zip'],
  description: 'Nộp file nén .zip chứa mã nguồn giải thuật Winnowing AST và Docker Sandbox Worker để chấm điểm tự động real-time.',
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
        
        // Single Responsibility Principle Violation
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

const mockSourceCodePlagiarized = `package com.aita.autograder;

import java.util.*;

public class Solution {
    public static void main(String[] args) {
        Scanner inputScanner = new Scanner(System.in);
        int count = inputScanner.nextInt();
        int[] numbers = new int[count];
        for (int idx = 0; idx < count; idx++) {
            numbers[idx] = inputScanner.nextInt();
        }
        
        // AI Rewritten method name
        processSortingAndDisplay(numbers);
    }
    
    private static void processSortingAndDisplay(int[] numbers) {
        Arrays.sort(numbers);
        for (int num : numbers) {
            System.out.print(num + " ");
        }
        System.out.println();
    }
}`;

const initialSteps: GradingStep[] = [
  { id: '1', label: 'Hàng đợi Redis BullMQ', status: 'pending', detail: 'Đang xếp hàng chờ Worker' },
  { id: '2', label: 'Khởi tạo Docker Sandbox', status: 'pending', detail: 'Cấp phát 512MB RAM & seccomp.json' },
  { id: '3', label: 'Chạy Testcase 1 (StdIn/StdOut)', status: 'pending', detail: 'Đánh giá tính chính xác' },
  { id: '4', label: 'Chạy Testcase 2 (Edge cases)', status: 'pending', detail: 'Kiểm tra giới hạn thời gian (TLE)' },
  { id: '5', label: 'Phân tích AST & Winnowing', status: 'pending', detail: 'So khớp vân tay mã nguồn' },
  { id: '6', label: 'GenAI Review (GPT-4o/Gemini)', status: 'pending', detail: 'Đánh giá Clean Code & SOLID' },
];

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const API_BASE_URL = 'http://localhost:3000';

export function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [steps, setSteps] = useState<GradingStep[]>(initialSteps);
  const [isCompleted, setIsCompleted] = useState(false);
  const [submissionId, setSubmissionId] = useState('');
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  
  const [aiRating, setAiRating] = useState<AIRating | undefined>(undefined);
  const [plagiarismMatch, setPlagiarismMatch] = useState<PlagiarismMatch | undefined>(undefined);
  const socketRef = useRef<Socket | null>(null);

  // Initialize Socket.IO connection
  useEffect(() => {
    const socket = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      console.log('[Socket.IO] Connected to NestJS Gateway:', socket.id);
      setIsSocketConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('[Socket.IO] Disconnected from NestJS Gateway');
      setIsSocketConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket.IO] Gateway not reachable, fallback mode ready:', err.message);
      setIsSocketConnected(false);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleSubmission = async (file: File) => {
    // Reset modal state
    setSteps(initialSteps.map((s) => ({ ...s, status: 'pending' })));
    setIsCompleted(false);
    setAiRating(undefined);
    setPlagiarismMatch(undefined);
    setIsModalOpen(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('studentId', 'SE170000');
    formData.append('assignmentId', 'TASK-SWP391-SPRINT2');
    formData.append('language', 'java');

    try {
      // 1. Call API Gateway: POST /api/v1/submissions
      const response = await fetch(`${API_BASE_URL}/api/v1/submissions`, {
        method: 'POST',
        body: formData,
      });

      if (response.status === 202) {
        const result = await response.json();
        const subId = result.data.submissionId;
        setSubmissionId(subId);
        console.log(`[Gateway] Submission 202 Accepted! ID: ${subId}, Latency: ${result.data.processingTimeMs}ms`);

        // 2. Join Socket.IO Room for real-time streaming
        if (socketRef.current && socketRef.current.connected) {
          socketRef.current.emit('join_submission', { submissionId: subId });

          // Listen for step progress
          socketRef.current.off('grading:progress');
          socketRef.current.on('grading:progress', (data: { stepId: string; stepName: string; status: any; detail?: string }) => {
            setSteps((prev) =>
              prev.map((s) =>
                s.id === data.stepId ? { ...s, status: data.status, detail: data.detail || s.detail } : s
              )
            );
          });

          // Listen for testcase evaluated
          socketRef.current.off('testcase:evaluated');
          socketRef.current.on('testcase:evaluated', (data: { testcaseIndex: number; totalTestcases: number; status: string; timeMs: number }) => {
            const stepId = data.testcaseIndex === 1 ? '3' : '4';
            setSteps((prev) =>
              prev.map((s) =>
                s.id === stepId
                  ? {
                      ...s,
                      status: data.status === 'PASSED' ? 'passed' : 'failed',
                      detail: `TC ${data.testcaseIndex}/${data.totalTestcases}: ${data.status} (${data.timeMs}ms)`,
                    }
                  : s
              )
            );
          });

          // Listen for grading completed
          socketRef.current.off('grading:completed');
          socketRef.current.on('grading:completed', (data: any) => {
            if (data.aiRating) setAiRating(data.aiRating);
            if (data.plagiarismMatch) setPlagiarismMatch(data.plagiarismMatch);
            setSteps((prev) => prev.map((s) => ({ ...s, status: 'passed' })));
            setIsCompleted(true);
          });

          return;
        }
      }
    } catch (err) {
      console.warn('[Gateway] API Gateway connection error, falling back to simulation:', err);
    }

    // Graceful fallback simulation if server is offline
    const subId = `SUB-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    setSubmissionId(subId);
    simulateSocketGradingEvents();
  };

  const simulateSocketGradingEvents = () => {
    const delays = [800, 1800, 3000, 4200, 5500, 7000];

    delays.forEach((delay, index) => {
      setTimeout(() => {
        setSteps((prevSteps) =>
          prevSteps.map((step, idx) => {
            if (idx === index) {
              return { ...step, status: 'in_progress', detail: 'Đang thực thi...' };
            }
            if (idx < index) {
              return { ...step, status: 'passed', detail: 'Hoàn thành (PASS)' };
            }
            return step;
          })
        );

        if (index === delays.length - 1) {
          setTimeout(() => {
            setSteps((prevSteps) =>
              prevSteps.map((s) => ({ ...s, status: 'passed', detail: 'Hoàn thành (PASS)' }))
            );

            setAiRating({
              cleanCodeScore: 8.5,
              solidScore: { s: 6.0, o: 9.0, l: 8.5, i: 9.0, d: 8.0 },
              codeSmells: [
                { line: 15, rule: 'Single Responsibility', description: 'Hàm `sortAndPrintAndSaveToDatabase` vi phạm SRP do vừa sắp xếp vừa in ra màn hình.' },
              ],
              explanation: 'Mã nguồn viết sạch sẽ, thuật toán sắp xếp tối ưu O(N log N). Cần tách biệt phần I/O hiển thị với logic xử lý dữ liệu.',
            });

            setPlagiarismMatch({
              matchedStudentName: 'Trần Thanh Nguyên',
              matchedStudentId: 'SE170123',
              similarityRate: 84.5,
              sourceCodeA: mockSourceCodeStudent,
              sourceCodeB: mockSourceCodePlagiarized,
              matchedTokens: [{ lineA: [15, 22], lineB: [15, 22] }],
            });

            setIsCompleted(true);
          }, 1000);
        }
      }, delay);
    });
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <nav className="glass-panel" style={{ borderRadius: '0', borderLeft: 'none', borderRight: 'none', borderTop: 'none', padding: '16px 32px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)' }}>
              <Terminal size={24} />
            </div>
            <div>
              <span className="gradient-text" style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.5px' }}>AITA-INTELLIGENT</span>
              <span style={{ fontSize: '11px', display: 'block', color: 'var(--text-muted)' }}>Autograding & AST Code Analytics Platform</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
              <Users size={16} color="var(--accent-cyan)" />
              <span>Sinh viên: <strong>Vạn Thái Trung (SE170000)</strong></span>
            </div>
            <span style={{ width: '1px', height: '20px', backgroundColor: 'var(--border-color)' }} />
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              padding: '4px 10px',
              borderRadius: '20px',
              backgroundColor: isSocketConnected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(234, 179, 8, 0.15)',
              color: isSocketConnected ? 'var(--accent-emerald)' : '#eab308',
              border: `1px solid ${isSocketConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(234, 179, 8, 0.3)'}`,
            }}>
              <Shield size={14} /> {isSocketConnected ? 'Gateway WebSocket Connected' : 'Gateway Connecting / Fallback'}
            </div>
          </div>
        </div>
      </nav>

      <main style={{ flexGrow: 1, padding: '40px 20px' }}>
        <SubmissionView task={mockTask} onSubmit={handleSubmission} />
      </main>

      <LiveGradingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        submissionId={submissionId}
        studentName="Vạn Thái Trung"
        steps={steps}
        isCompleted={isCompleted}
        aiRating={aiRating}
        plagiarismMatch={plagiarismMatch}
        sourceCode={mockSourceCodeStudent}
      />

      <footer style={{ borderTop: '1px solid var(--border-color)', padding: '20px', textAlign: 'center', fontSize: '13px', color: 'var(--text-dim)' }}>
        SWP391 Group 4 — RBL 10-Week Intensive Project © 2026. Built with React + Vite + Socket.IO + Monaco Editor.
      </footer>
    </div>
  );
}

export default App;
