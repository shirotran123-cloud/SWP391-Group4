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
  Key,
  Settings,
  ExternalLink,
  Code2,
  Loader2,
  AlertCircle,
  X,
  FileCode,
} from 'lucide-react';
import { RblBenchmarkView } from './RblBenchmarkView';
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
  const [activeTab, setActiveTab] = useState<'COURSES' | 'CREATE_ASSIGNMENT' | 'EXCEL_IMPORT' | 'SUBMISSIONS' | 'RBL_LAB'>('COURSES');

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

  // Gemini AI Real State
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => {
    return localStorage.getItem('aita_gemini_api_key') || '';
  });
  const [selectedAiModel, setSelectedAiModel] = useState<string>('gemini-3.8-flash');
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [tempApiKey, setTempApiKey] = useState(geminiApiKey);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
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
  const handleTestApiKey = async () => {
    if (!tempApiKey.trim()) {
      setPingStatus({ loading: false, message: 'Vui lòng nhập API Key trước khi kiểm tra.', success: false });
      return;
    }
    setPingStatus({ loading: true, message: 'Đang kết nối tới máy chủ Google Gemini...', success: null });
    const res = await GeminiAIService.pingKey(tempApiKey, selectedAiModel);
    setPingStatus({
      loading: false,
      message: res.message + (res.latencyMs ? ` (Độ trễ: ${res.latencyMs}ms)` : ''),
      success: res.success,
    });
  };

  // Sinh đề tự động bằng Google Gemini AI THẬT (UC-08)
  const handleAiGenerateAssignment = async () => {
    setAiErrorMsg(null);
    setCreateSuccessMsg(null);
    setAiSuccessBadge(null);

    // Nếu chưa có API Key, mở modal cấu hình để người dùng nhập
    if (!geminiApiKey.trim()) {
      setTempApiKey('');
      setIsConfigModalOpen(true);
      setAiErrorMsg('Bạn cần cung cấp Google Gemini API Key để hệ thống kết nối AI thật tạo đề bài.');
      return;
    }

    setIsAiGenerating(true);
    try {
      const courseObj = initialCourses.find((c) => c.courseId === selectedCourse);
      const courseName = courseObj ? courseObj.courseName : 'Dự Án Phát Triển Phần Mềm';
      const courseCode = courseObj ? courseObj.courseCode : 'SWP391';

      const result = await GeminiAIService.generateAssignment(geminiApiKey, {
        courseName,
        courseCode,
        topicPrompt: assignmentTitle || 'Cấu trúc dữ liệu và giải thuật nâng cao',
        difficulty: 'TRUNG BÌNH',
        allowedLanguages,
        model: selectedAiModel,
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

      setAiSuccessBadge(
        `✨ Google Gemini AI (${result.modelUsed}) đã soạn đề & barem thành công trong ${result.latencyMs}ms!`
      );
      setCreateSuccessMsg(
        `Đã tạo đề bài "${result.title}" kèm ${result.testCases.length} testcases và ${result.rubric.length} tiêu chí barem chấm điểm.`
      );
    } catch (err: any) {
      console.error('Lỗi khi gọi Google Gemini AI:', err);
      setAiErrorMsg(err.message || 'Không thể kết nối tới Google Gemini AI. Vui lòng kiểm tra lại API Key hoặc hạn mức quota.');
    } finally {
      setIsAiGenerating(false);
    }
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
          <Cpu size={16} /> 5. Phòng Thí Nghiệm AST (RBL Core)
        </button>
      </div>

      {/* TAB 1: KHÓA HỌC & LỚP */}
      {activeTab === 'COURSES' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            {initialCourses.map((course) => (
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
                  <span>Bài tập: <strong style={{ color: '#ffffff' }}>{course.assignmentCount}</strong> bài</span>
                </div>
                <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCourse(course.courseId);
                      setActiveTab('CREATE_ASSIGNMENT');
                    }}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(99, 102, 241, 0.15)',
                      border: '1px solid rgba(99, 102, 241, 0.3)',
                      color: 'var(--accent-primary)',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Giao Đề Bài Mới
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
                {isAiGenerating ? 'Đang gọi Google Gemini AI...' : '⚡ Dùng AI Thật Sinh Đề & Barem'}
              </button>
            </div>
          </div>

          {/* Gợi ý chủ đề nhanh cho Giảng viên */}
          <div style={{ marginBottom: '20px', padding: '14px 16px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
              💡 Gợi ý chủ đề nhanh (Bấm để chọn và nhấn Tạo bằng AI):
            </span>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[
                'Cây Tìm Kiếm Nhị Phân BST & Cân Bằng Cây AVL',
                'Thuật Toán Dijkstra với Hàng Đợi Ưu Tiên Min-Heap',
                'Sắp Xếp Nhanh Quicksort & Tối Ưu Phân Đoạn O(N log N)',
                'Quy Hoạch Động Bài Toán Balo 0/1 (Knapsack DP)',
                'Thiết Kế Mẫu Factory Method & Nguyên Lý SOLID',
              ].map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => setAssignmentTitle(topic)}
                  style={{
                    fontSize: '12px',
                    padding: '5px 12px',
                    borderRadius: '8px',
                    backgroundColor: assignmentTitle === topic ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${assignmentTitle === topic ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.1)'}`,
                    color: assignmentTitle === topic ? '#ffffff' : 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {topic}
                </button>
              ))}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={16} color="var(--accent-primary)" /> Bộ Test Cases Tự Động (StdIn / StdOut) - Tổng {testCases.length} Test
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '28px' }}>
            <div style={{ padding: '24px', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <CheckCircle2 size={24} color="#10b981" />
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>Kịch Bản 1: Nhập Thành Công 100%</h3>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.5' }}>
                Tất cả 38 dòng trong file Excel đều hợp lệ, MSSV không bị trùng, email chuẩn định dạng @fpt.edu.vn. Giao diện thực hiện COMMIT toàn bộ.
              </p>
              <button
                type="button"
                onClick={() => handleSimulateRollback(false)}
                disabled={excelLoading}
                style={{
                  width: '100%',
                  padding: '10px 16px',
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
                <Upload size={16} /> Thử Nghiệm Nhập Hợp Lệ (Commit)
              </button>
            </div>

            <div style={{ padding: '24px', borderRadius: '12px', backgroundColor: 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <AlertTriangle size={24} color="#f43f5e" />
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>Kịch Bản 2: Minh Chứng Lỗi & Rollback ACID</h3>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.5' }}>
                Mô phỏng file Excel có dòng số 3 chứa MSSV trùng lặp [SE170123]. Hệ thống lập tức tung Exception và thực thi 100% ROLLBACK bảo toàn dữ liệu.
              </p>
              <button
                type="button"
                onClick={() => handleSimulateRollback(true)}
                disabled={excelLoading}
                style={{
                  width: '100%',
                  padding: '10px 16px',
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
                <AlertTriangle size={16} /> Mô Phỏng Lỗi Dòng 3 & Rollback ACID
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

      {/* TAB 4: SỔ ĐIỂM & DANH SÁCH BÀI NỘP */}
      {activeTab === 'SUBMISSIONS' && (
        <div className="glass-panel" style={{ padding: '28px', borderRadius: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff' }}>
                Sổ Theo Dõi Bài Nộp Lập Trình & Giám Sát Liêm Chính Học Thuật
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
                Danh sách bài làm sinh viên với điểm số đa trục và cảnh báo đạo văn AST Winnowing
              </p>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px 16px' }}>Mã Nộp</th>
                  <th style={{ padding: '12px 16px' }}>Sinh Viên</th>
                  <th style={{ padding: '12px 16px' }}>File Nộp</th>
                  <th style={{ padding: '12px 16px' }}>Thời Gian</th>
                  <th style={{ padding: '12px 16px' }}>Testcase</th>
                  <th style={{ padding: '12px 16px' }}>Clean Code</th>
                  <th style={{ padding: '12px 16px' }}>SOLID</th>
                  <th style={{ padding: '12px 16px' }}>Tổng Điểm</th>
                  <th style={{ padding: '12px 16px' }}>Trùng Lặp AST</th>
                  <th style={{ padding: '12px 16px' }}>Trạng Thái</th>
                </tr>
              </thead>
              <tbody>
                {mockSubmissionsList.map((sub) => (
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
                      {sub.fileName}
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
                <option value="gemini-3.8-flash">gemini-3.8-flash (Khuyên dùng - Chuẩn mới nhất, Siêu tốc độ & Thông minh)</option>
                <option value="gemini-3.8-pro">gemini-3.8-pro (Chuyên sâu lý luận thuật toán & Khảo thí nâng cao)</option>
                <option value="gemini-3.8-ultra">gemini-3.8-ultra (Mô hình năng lực tối đa của Google)</option>
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
    </div>
  );
};
