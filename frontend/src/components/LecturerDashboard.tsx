import React, { useState } from 'react';
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
  ArrowRight,
} from 'lucide-react';
import { RblBenchmarkView } from './RblBenchmarkView';
import type { PlagiarismMatch } from '../types';

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
    assignmentCount: 3,
  },
  {
    courseId: 'COURSE-PRO192',
    courseCode: 'PRO192',
    courseName: 'Lập Trình Hướng Đối Tượng Java & SOLID',
    semester: 'Học kỳ Thu 2026',
    instructorName: 'ThS. Đinh Thành Trung',
    studentCount: 42,
    assignmentCount: 4,
  },
  {
    courseId: 'COURSE-CSD201',
    courseCode: 'CSD201',
    courseName: 'Cấu Trúc Dữ Liệu & Giải Thuật Nâng Cao',
    semester: 'Học kỳ Thu 2026',
    instructorName: 'ThS. Đinh Thành Trung',
    studentCount: 35,
    assignmentCount: 2,
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
    fileName: 'nguyentt_se170123_assignment.zip',
    submittedAt: '12/10/2026 15:05',
    testcaseScore: 7.0,
    cleanCodeScore: 8.0,
    solidScore: 7.5,
    finalScore: 8.8,
    plagiarismStatus: 'AN TOÀN',
    similarityRate: 18.2,
  },
  {
    id: 'SUB-003',
    studentId: 'SE170456',
    studentName: 'Nguyễn Hoàng Vinh',
    assignmentTitle: 'Thuật toán Sắp xếp & Tối ưu O(N log N)',
    fileName: 'vinhnh_sort_algorithm.zip',
    submittedAt: '12/10/2026 16:30',
    testcaseScore: 5.5,
    cleanCodeScore: 8.5,
    solidScore: 8.0,
    finalScore: 7.9,
    plagiarismStatus: 'AN TOÀN',
    similarityRate: 22.0,
  },
  {
    id: 'SUB-004',
    studentId: 'SE170999',
    studentName: 'Vũ Minh Quân (Cảnh báo)',
    assignmentTitle: 'Thuật toán Sắp xếp & Tối ưu O(N log N)',
    fileName: 'copied_solution.zip',
    submittedAt: '12/10/2026 17:15',
    testcaseScore: 7.0,
    cleanCodeScore: 4.0,
    solidScore: 3.5,
    finalScore: 0.0,
    plagiarismStatus: 'ĐẠO VĂN',
    similarityRate: 86.4,
  },
];

export const LecturerDashboard: React.FC<LecturerDashboardProps> = ({ onOpenDiffViewer }) => {
  const [activeTab, setActiveTab] = useState<'COURSES' | 'CREATE_ASSIGNMENT' | 'EXCEL_IMPORT' | 'SUBMISSIONS' | 'RBL_LAB'>('COURSES');

  // Form state cho tạo đề bài
  const [assignmentTitle, setAssignmentTitle] = useState('Xây dựng Thuật toán Cây Tìm Kiếm Nhị Phân (BST) & Đồ Thị');
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
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  // Excel state
  const [excelStatus, setExcelStatus] = useState<string | null>(null);
  const [excelLoading, setExcelLoading] = useState(false);
  const [simulatedRollback, setSimulatedRollback] = useState<boolean | null>(null);

  // Sinh đề tự động bằng AI (UC-08)
  const handleAiGenerateAssignment = () => {
    setIsAiGenerating(true);
    setCreateSuccessMsg(null);
    setTimeout(() => {
      setAssignmentTitle('Cài đặt Thuật toán Đường Đi Ngắn Nhất Dijkstra với Priority Queue');
      setAssignmentDesc('Xây dựng đồ thị có hướng có trọng số. Sử dụng Min-Heap (Priority Queue) để tìm đường đi ngắn nhất từ đỉnh nguồn với độ phức tạp O((V + E) log V). Áp dụng Dependency Inversion Principle (DIP).');
      setAllowedLanguages(['java', 'python', 'cpp', 'dotnet']);
      setTestCases([
        { input: '5 6\n1 2 4\n1 3 2\n2 3 1\n2 4 5\n3 5 8\n4 5 2\n1', output: '0 4 2 9 10', weight: 3.5, isHidden: false },
        { input: '4 4\n1 2 1\n2 3 2\n3 4 3\n1 4 10\n1', output: '0 1 3 6', weight: 3.5, isHidden: true },
      ]);
      setIsAiGenerating(false);
      setCreateSuccessMsg('✨ Trợ lý AI đã tự động sinh đề bài, gợi ý cấu hình và bộ test cases thành công!');
    }, 1200);
  };

  const handleSaveAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateSuccessMsg('✅ Đã lưu và xuất bản bài tập thành công lên hệ thống AITA! Sinh viên trong lớp đã có thể nộp bài.');
  };

  const handleSimulateRollback = (triggerError: boolean) => {
    setExcelLoading(true);
    setExcelStatus(null);
    setSimulatedRollback(null);

    setTimeout(() => {
      setExcelLoading(false);
      if (triggerError) {
        setSimulatedRollback(true);
        setExcelStatus(
          '❌ PHÁT HIỆN LỖI: Dòng số 3 chứa Mã Sinh Viên trùng lặp [SE170123] với một bản ghi đã tồn tại! Hệ thống đã kích hoạt 100% SQL TRANSACTION ROLLBACK. Không có bản ghi mồ côi nào bị ghi vào cơ sở dữ liệu.'
        );
      } else {
        setSimulatedRollback(false);
        setExcelStatus(
          '✅ GIAO DỊCH SQL THÀNH CÔNG: Đã nhập thành công 38 sinh viên vào lớp SE1701-SWP391! Tất cả tài khoản đã được cấp quyền Google SSO.'
        );
      }
    }, 900);
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
            Quản lý đề bài, phân công lớp học, thiết lập bộ kiểm thử Sandbox và đối soát đạo văn AST
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
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
          <PlusCircle size={16} /> 2. Tạo Đề Bài (Kèm AI Rubric)
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
          <FileSpreadsheet size={16} /> 3. Nhập Excel Sinh Viên (SQL ACID)
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
          <Award size={16} /> 4. Giám Sát Bảng Điểm Lớp
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('RBL_LAB')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            background: activeTab === 'RBL_LAB' ? 'rgba(6, 182, 212, 0.2)' : 'transparent',
            border: `1px solid ${activeTab === 'RBL_LAB' ? 'var(--accent-cyan)' : 'transparent'}`,
            color: activeTab === 'RBL_LAB' ? '#ffffff' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Cpu size={16} color="var(--accent-cyan)" /> 5. Phòng Thí Nghiệm AST RBL (10 Cặp Bài)
        </button>
      </div>

      {/* TAB 1: DANH SÁCH KHÓA HỌC & LỚP */}
      {activeTab === 'COURSES' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
            {initialCourses.map((c) => (
              <div key={c.courseId} className="glass-panel" style={{ padding: '24px', borderRadius: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 800, padding: '4px 10px', borderRadius: '6px', backgroundColor: 'rgba(99, 102, 241, 0.2)', color: 'var(--accent-primary)' }}>
                    {c.courseCode}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{c.semester}</span>
                </div>

                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', marginBottom: '8px' }}>
                  {c.courseName}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '18px' }}>
                  Giảng viên phụ trách: <strong>{c.instructorName}</strong>
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '14px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.03)', marginBottom: '18px' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Sĩ Số Lớp</span>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-cyan)' }}>{c.studentCount} Sinh viên</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Đề Bài Tập</span>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-emerald)' }}>{c.assignmentCount} Bài tập</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setActiveTab('CREATE_ASSIGNMENT')}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(99, 102, 241, 0.15)',
                      border: '1px solid var(--accent-primary)',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    Giao Đề Mới <ArrowRight size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('SUBMISSIONS')}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: 'var(--text-muted)',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Xem Bảng Điểm
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: TẠO ĐỀ BÀI TẬP & AI RUBRIC GENERATOR (UC-03, UC-08) */}
      {activeTab === 'CREATE_ASSIGNMENT' && (
        <div className="glass-panel" style={{ padding: '32px', borderRadius: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff' }}>
                Soạn Thảo Đề Bài Tập & Thiết Lập Barem Chấm Điểm
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
                Cấu hình giới hạn phần cứng Sandbox (512MB RAM, 2.0s), bộ test cases ẩn/công khai và barem điểm Clean Code
              </p>
            </div>

            <button
              type="button"
              onClick={handleAiGenerateAssignment}
              disabled={isAiGenerating}
              style={{
                padding: '10px 18px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                border: 'none',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: isAiGenerating ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 15px rgba(168, 85, 247, 0.3)',
              }}
            >
              <Sparkles size={16} />
              {isAiGenerating ? 'Đang gọi GenAI Hub...' : 'Dùng AI Tự Động Soạn Đề & Barem (UC-08)'}
            </button>
          </div>

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
                  Khóa Học / Lớp Học Phần *
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
                  <option value="COURSE-SWP391">SWP391 - Dự Án Phát Triển Phần Mềm</option>
                  <option value="COURSE-PRO192">PRO192 - Lập Trình Java OOP</option>
                  <option value="COURSE-CSD201">CSD201 - Cấu Trúc Dữ Liệu & Giải Thuật</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#e5e7eb', marginBottom: '6px' }}>
                Mô Tả Yêu Cầu & Ràng Buộc Thuật Toán *
              </label>
              <textarea
                rows={3}
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

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={16} color="var(--accent-primary)" /> Bộ Test Cases Tự Động (StdIn / StdOut)
                </h4>
                <button
                  type="button"
                  onClick={() => setTestCases([...testCases, { input: '', output: '', weight: 3.0, isHidden: false }])}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-primary)',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  + Thêm Test Case Mới
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {testCases.map((tc, idx) => (
                  <div key={idx} style={{ padding: '14px', borderRadius: '10px', backgroundColor: 'rgba(18, 24, 36, 0.6)', border: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: '1fr 1fr 120px 100px auto', gap: '12px', alignItems: 'center' }}>
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
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Trọng Số Điểm:</span>
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
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Loại Test:</span>
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
                      style={{ background: 'none', border: 'none', color: 'var(--accent-rose)', cursor: 'pointer', fontSize: '16px', fontWeight: 700 }}
                      title="Xóa test case"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

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

      {/* TAB 3: BULK IMPORT EXCEL VỚI SQL TRANSACTION (UC-02) */}
      {activeTab === 'EXCEL_IMPORT' && (
        <div className="glass-panel" style={{ padding: '32px', borderRadius: '16px' }}>
          <div style={{ marginBottom: '24px' }}>
            <span style={{ fontSize: '12px', color: 'var(--accent-emerald)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Nghiệp Vụ UC-02 • Giao Dịch ACID Chuẩn Enterprise
            </span>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', marginTop: '4px' }}>
              Nhập Danh Sách Sinh Viên Qua File Excel (.xlsx)
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
              Thực thi cơ chế kiểm tra tính nguyên tử (Atomicity): Nếu bất kỳ dòng nào bị lỗi hoặc trùng lặp mã sinh viên, hệ thống sẽ <strong>tự động ROLLBACK 100%</strong>, đảm bảo không lưu lại bản ghi rác.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', alignItems: 'flex-start' }}>
            <div style={{ padding: '24px', borderRadius: '14px', backgroundColor: 'rgba(18, 24, 36, 0.7)', border: '2px dashed var(--border-color)', textAlign: 'center' }}>
              <FileSpreadsheet size={48} color="var(--accent-emerald)" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>Kéo thả file danh sách sinh viên (.xlsx)</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', marginBottom: '16px' }}>
                Dung lượng tối đa 5MB. Định dạng các cột bắt buộc: <code>student_code</code>, <code>full_name</code>, <code>email</code>
              </p>

              <button
                type="button"
                className="btn-primary"
                style={{ padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Upload size={14} /> Chọn File Từ Máy Tính
              </button>
            </div>

            <div style={{ padding: '20px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', marginBottom: '12px' }}>
                Thực Nghiệm Bảo Vệ Tính Toàn Vẹn CSDL:
              </h4>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.5' }}>
                Bấm nút thử nghiệm bên dưới để kiểm chứng khả năng tự bảo vệ dữ liệu của API Gateway:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => handleSimulateRollback(true)}
                  disabled={excelLoading}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(244, 63, 94, 0.15)',
                    border: '1px solid rgba(244, 63, 94, 0.3)',
                    color: '#f43f5e',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <AlertTriangle size={16} /> Thử Nghiệm Batch Lỗi Trùng Mã $\rightarrow$ Kích Hoạt 100% Rollback
                </button>

                <button
                  type="button"
                  onClick={() => handleSimulateRollback(false)}
                  disabled={excelLoading}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    color: '#10b981',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <CheckCircle2 size={16} /> Thử Nghiệm Batch Hợp Lệ $\rightarrow$ Cam Kết Giao Dịch (Commit)
                </button>
              </div>

              {excelStatus && (
                <div
                  style={{
                    marginTop: '16px',
                    padding: '14px',
                    borderRadius: '8px',
                    backgroundColor: simulatedRollback ? 'rgba(244, 63, 94, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    border: `1px solid ${simulatedRollback ? 'rgba(244, 63, 94, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
                    color: simulatedRollback ? '#fda4af' : '#6ee7b7',
                    fontSize: '13px',
                    lineHeight: '1.5',
                  }}
                >
                  {excelStatus}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: BẢNG ĐIỂM & GIÁM SÁT BÀI NỘP CỦA LỚP */}
      {activeTab === 'SUBMISSIONS' && (
        <div className="glass-panel" style={{ padding: '28px', borderRadius: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff' }}>
                Bảng Điểm & Giám Sát Bài Nộp Lớp SE1701-SWP391
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
                Điểm tổng hợp: 70% Điểm Kiểm Thử (Docker Sandbox) + 30% Điểm Chất Lượng Mã Nguồn (GenAI Hub)
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <span style={{ padding: '6px 12px', borderRadius: '8px', backgroundColor: 'rgba(99, 102, 241, 0.15)', color: 'var(--accent-primary)', fontSize: '13px', fontWeight: 600 }}>
                Tổng số bài nộp: {mockSubmissionsList.length}
              </span>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px 14px' }}>Mã SV</th>
                  <th style={{ padding: '12px 14px' }}>Họ Tên Sinh Viên</th>
                  <th style={{ padding: '12px 14px' }}>File Nộp</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>Test Cases (70%)</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>Clean Code (AI)</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>SOLID (AI)</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>Điểm Tổng</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>Đạo Văn (AST)</th>
                  <th style={{ padding: '12px 14px' }}>Thời Gian</th>
                </tr>
              </thead>
              <tbody>
                {mockSubmissionsList.map((s) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background-color 0.2s' }}>
                    <td style={{ padding: '14px', fontWeight: 700, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                      {s.studentId}
                    </td>
                    <td style={{ padding: '14px', fontWeight: 600, color: '#ffffff' }}>
                      {s.studentName}
                    </td>
                    <td style={{ padding: '14px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                      {s.fileName}
                    </td>
                    <td style={{ padding: '14px', textAlign: 'center', fontWeight: 700, color: s.testcaseScore >= 7.0 ? 'var(--accent-emerald)' : 'var(--accent-amber)' }}>
                      {s.testcaseScore.toFixed(1)}/10
                    </td>
                    <td style={{ padding: '14px', textAlign: 'center', fontWeight: 700, color: s.cleanCodeScore >= 8.0 ? 'var(--accent-emerald)' : 'var(--accent-amber)' }}>
                      {s.cleanCodeScore.toFixed(1)}/10
                    </td>
                    <td style={{ padding: '14px', textAlign: 'center', fontWeight: 700, color: s.solidScore >= 8.0 ? 'var(--accent-emerald)' : 'var(--accent-amber)' }}>
                      {s.solidScore.toFixed(1)}/10
                    </td>
                    <td style={{ padding: '14px', textAlign: 'center', fontWeight: 800, fontSize: '15px', color: s.finalScore >= 8.0 ? 'var(--accent-emerald)' : s.finalScore > 0 ? 'var(--accent-cyan)' : 'var(--accent-rose)' }}>
                      {s.finalScore.toFixed(1)}
                    </td>
                    <td style={{ padding: '14px', textAlign: 'center' }}>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor:
                            s.plagiarismStatus === 'ĐẠO VĂN'
                              ? 'rgba(244, 63, 94, 0.2)'
                              : s.plagiarismStatus === 'NGHI VẤN'
                              ? 'rgba(245, 158, 11, 0.2)'
                              : 'rgba(16, 185, 129, 0.2)',
                          color:
                            s.plagiarismStatus === 'ĐẠO VĂN'
                              ? '#f43f5e'
                              : s.plagiarismStatus === 'NGHI VẤN'
                              ? '#f59e0b'
                              : '#10b981',
                        }}
                      >
                        {s.similarityRate > 0 ? `${s.similarityRate.toFixed(1)}% (${s.plagiarismStatus})` : 'AN TOÀN'}
                      </span>
                    </td>
                    <td style={{ padding: '14px', color: 'var(--text-dim)', fontSize: '12px' }}>
                      {s.submittedAt}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: PHÒNG THÍ NGHIỆM RBL AST (10 CẶP BÀI) */}
      {activeTab === 'RBL_LAB' && (
        <RblBenchmarkView onOpenDiffViewer={onOpenDiffViewer} />
      )}
    </div>
  );
};
