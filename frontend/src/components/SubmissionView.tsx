import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  UploadCloud, FileArchive, X, Send, ShieldCheck, Clock,
  BookOpen, AlertTriangle, CheckCircle, Search,
  ArrowLeft, Cpu, HardDrive, Code, ChevronRight,
  Award, RefreshCw, Layers, AlertOctagon, Hash, Lock, Bug
} from 'lucide-react';
import { CountdownTimer } from './CountdownTimer';
import type { Task } from '../types';

export interface RubricItem {
  criterion: string;
  maxScore: number;
  description: string;
}

export interface StudentTaskItem extends Task {
  courseId?: string;
  courseCode?: string;
  timeLimitMs?: number;
  memoryLimitMb?: number;
  allowedLanguages?: string[];
  rubrics?: RubricItem[];
  testCasesCount?: number;
  status?: string;
}

export interface StudentSubmissionRecord {
  assignmentId: string;
  submissionId?: string;
  submittedAt: string;
  fileName: string;
  fileSizeMb?: number;
  sha256?: string;
  score?: number;
  status: 'QUEUED' | 'GRADED' | 'SUBMITTED';
}

interface SubmissionViewProps {
  task?: Task;
  studentId?: string;
  studentName?: string;
  onSubmit: (file: File, task?: Task) => void;
}

const defaultAssignmentPool: StudentTaskItem[] = [
  {
    id: 'ASM-SWP-01',
    courseId: 'COURSE-SWP391',
    courseCode: 'SWP391',
    course: 'SWP391 - Đồ Án Phát Triển Phần Mềm (Agile Scrum)',
    title: 'Cài đặt Thuật toán Cây Tìm Kiếm Nhị Phân (BST) & Đồ Thị',
    description: 'Cài đặt Generic Binary Search Tree trong Java hoặc C++. Tối ưu hóa độ phức tạp thời gian O(log N) và tuân thủ các nguyên lý SOLID (SRP, DIP).',
    deadline: new Date(Date.now() + 5 * 24 * 3600 * 1000 + 4 * 3600 * 1000).toISOString(),
    timeLimitMs: 2000,
    memoryLimitMb: 512,
    allowedLanguages: ['java', 'python', 'cpp'],
    allowedExtensions: ['.zip'],
    maxSizeMb: 10,
    testCasesCount: 7,
    status: 'PUBLISHED',
    rubrics: [
      { criterion: 'Tính đúng đắn thuật toán & Vượt qua Testcases', maxScore: 5.0, description: 'Pass 100% testcases chuẩn và biên' },
      { criterion: 'Clean Code & Tối ưu O(N log N)', maxScore: 2.5, description: 'Mã nguồn rõ ràng, đặt tên biến chuẩn, tối ưu thời gian' },
      { criterion: 'Thiết kế Hướng đối tượng & SOLID', maxScore: 2.5, description: 'Tuân thủ Single Responsibility và Dependency Inversion' },
    ],
  },
  {
    id: 'ASM-SWP-02',
    courseId: 'COURSE-SWP391',
    courseCode: 'SWP391',
    course: 'SWP391 - Đồ Án Phát Triển Phần Mềm (Agile Scrum)',
    title: 'Thuật toán Sắp xếp & Tối ưu O(N log N) 3-Way Partitioning',
    description: 'Cài đặt giải thuật QuickSort tối ưu hóa phân hoạch 3 phần (3-Way Partitioning) nhằm triệt tiêu hoàn toàn trường hợp suy biến trên tập dữ liệu trùng lặp.',
    deadline: new Date(Date.now() + 18 * 3600 * 1000 + 30 * 60 * 1000).toISOString(), // Còn ~18 giờ (GẤP)
    timeLimitMs: 1500,
    memoryLimitMb: 256,
    allowedLanguages: ['java', 'python', 'cpp'],
    allowedExtensions: ['.zip'],
    maxSizeMb: 10,
    testCasesCount: 5,
    status: 'PUBLISHED',
    rubrics: [
      { criterion: 'Đúng đắn Testcases & O(N log N)', maxScore: 7.0, description: 'Vượt qua bộ testcases biên và bão hòa' },
      { criterion: 'Clean Code & SOLID SRP', maxScore: 3.0, description: 'Tách biệt thuật toán và hàm tiện ích' },
    ],
  },
  {
    id: 'ASM-CSD-01',
    courseId: 'COURSE-CSD201',
    courseCode: 'CSD201',
    course: 'CSD201 - Cấu Trúc Dữ Liệu & Giải Thuật Nâng Cao',
    title: 'Cài Đặt Cây AVL Tự Cân Bằng (Self-Balancing Tree)',
    description: 'Triển khai cây AVL với các phép xoay đơn (Left/Right) và xoay kép (Left-Right/Right-Left). Kiểm tra tính cân bằng với 1,000 thao tác chèn/xóa.',
    deadline: new Date(Date.now() + 8 * 24 * 3600 * 1000).toISOString(),
    timeLimitMs: 2000,
    memoryLimitMb: 512,
    allowedLanguages: ['java', 'cpp'],
    allowedExtensions: ['.zip'],
    maxSizeMb: 10,
    testCasesCount: 6,
    status: 'PUBLISHED',
    rubrics: [
      { criterion: 'Cân bằng cây AVL & Phép xoay chuẩn', maxScore: 6.0, description: 'Thực hiện chính xác hệ số cân bằng Balance Factor' },
      { criterion: 'Độ phức tạp O(log N)', maxScore: 4.0, description: 'Đảm bảo chiều cao cây không vượt quá 1.44 log2(N)' },
    ],
  },
  {
    id: 'ASM-CSD-02',
    courseId: 'COURSE-CSD201',
    courseCode: 'CSD201',
    course: 'CSD201 - Cấu Trúc Dữ Liệu & Giải Thuật Nâng Cao',
    title: 'Tìm Đường Đi Ngắn Nhất Đồ Thị Dijkstra & Min-Heap',
    description: 'Cài đặt thuật toán Dijkstra tìm đường đi ngắn nhất đồ thị có trọng số dương sử dụng Min-Heap Priority Queue. Tuân thủ nguyên lý Đơn trách nhiệm (SRP).',
    deadline: new Date(Date.now() + 12 * 24 * 3600 * 1000).toISOString(),
    timeLimitMs: 2500,
    memoryLimitMb: 512,
    allowedLanguages: ['java', 'python', 'cpp'],
    allowedExtensions: ['.zip'],
    maxSizeMb: 10,
    testCasesCount: 8,
    status: 'PUBLISHED',
    rubrics: [
      { criterion: 'Đúng đắn Dijkstra O((V+E)log V)', maxScore: 7.0, description: 'Vượt qua 100% testcases đồ thị lớn' },
      { criterion: 'Thiết kế Hướng đối tượng', maxScore: 3.0, description: 'Đóng gói Graph, Vertex, Edge tách bạch' },
    ],
  },
  {
    id: 'ASM-PRO-01',
    courseId: 'COURSE-PRO192',
    courseCode: 'PRO192',
    course: 'PRO192 - Lập Trình Hướng Đối Tượng Cơ Bản (Java OOP)',
    title: 'Hệ Thống Quản Lý Thư Viện Hướng Đối Tượng & SOLID DIP',
    description: 'Thiết kế mô hình hướng đối tượng quản lý tài liệu thư viện, áp dụng Kế thừa, Đa hình và Dependency Inversion Principle (DIP).',
    deadline: new Date(Date.now() + 2 * 24 * 3600 * 1000 + 5 * 3600 * 1000).toISOString(),
    timeLimitMs: 1500,
    memoryLimitMb: 256,
    allowedLanguages: ['java'],
    allowedExtensions: ['.zip'],
    maxSizeMb: 10,
    testCasesCount: 5,
    status: 'PUBLISHED',
    rubrics: [
      { criterion: 'Đúng đắn tính năng nghiệp vụ OOP', maxScore: 6.0, description: 'Quản lý mượn/trả sách, tính phí phạt tự động' },
      { criterion: 'Tuân thủ SOLID & Interface', maxScore: 4.0, description: 'Áp dụng DIP và Loose Coupling' },
    ],
  },
];

export const SubmissionView: React.FC<SubmissionViewProps> = ({
  task,
  studentId = 'SE170000',
  studentName = 'Sinh Viên',
  onSubmit,
}) => {
  // Danh sách các bài tập đang mở
  const [assignmentList, setAssignmentList] = useState<StudentTaskItem[]>([]);
  // Bài tập đang được chọn để nộp (null = xem danh sách deadline)
  const [selectedTask, setSelectedTask] = useState<StudentTaskItem | null>(task ? { ...task } : null);

  // Bộ lọc
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'URGENT' | 'SUBMITTED'>('ALL');

  // Lịch sử nộp bài của sinh viên
  const [submissionHistory, setSubmissionHistory] = useState<Record<string, StudentSubmissionRecord>>({});

  // Trạng thái nộp file
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sha256Checksum, setSha256Checksum] = useState<string | null>(null);
  const [isHashing, setIsHashing] = useState(false);
  const [exceptionType, setExceptionType] = useState<"OVERSIZE" | "EXPIRED" | null>(null);
  const [isDeadlineSimulatedExpired, setIsDeadlineSimulatedExpired] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Tải danh sách bài tập đã xuất bản (Đồng bộ với LecturerDashboard) và lịch sử nộp bài
  useEffect(() => {
    loadAssignmentsAndSubmissions();
  }, [studentId]);

  const loadAssignmentsAndSubmissions = () => {
    let combinedPool: StudentTaskItem[] = [...defaultAssignmentPool];

    // Đọc từ localStorage do Giảng viên vừa tạo và xuất bản
    try {
      const savedPublished = localStorage.getItem('aita_published_assignments');
      if (savedPublished) {
        const parsed: any[] = JSON.parse(savedPublished);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const formattedFromLecturer: StudentTaskItem[] = parsed.map((item) => ({
            id: item.id || `ASM-${Date.now()}`,
            courseId: item.courseId || 'COURSE-SWP391',
            courseCode: item.courseId ? item.courseId.replace('COURSE-', '') : 'SWP391',
            course: `${item.courseId ? item.courseId.replace('COURSE-', '') : 'SWP391'} - Bài Tập Giảng Viên Đã Giao`,
            title: item.title,
            description: item.description,
            deadline: item.deadline ? (item.deadline.includes('T') ? item.deadline : `${item.deadline}T23:59:00`) : new Date(Date.now() + 7 * 86400000).toISOString(),
            timeLimitMs: item.timeLimitMs || 2000,
            memoryLimitMb: item.memoryLimitMb || 512,
            allowedLanguages: item.allowedLanguages || ['java', 'python', 'cpp'],
            allowedExtensions: ['.zip'],
            maxSizeMb: 10,
            testCasesCount: item.testCases ? item.testCases.length : 5,
            rubrics: item.rubrics || [],
            status: item.status || 'PUBLISHED',
          }));

          // Gộp các bài tập từ Giảng viên lên trước, không bị trùng lặp ID
          const map = new Map<string, StudentTaskItem>();
          formattedFromLecturer.forEach((item) => map.set(item.id, item));
          combinedPool.forEach((item) => {
            if (!map.has(item.id)) map.set(item.id, item);
          });
          combinedPool = Array.from(map.values());
        }
      }
    } catch (e) {
      console.warn('Không thể đọc aita_published_assignments:', e);
    }

    setAssignmentList(combinedPool);

    // Đọc lịch sử nộp bài của sinh viên
    try {
      const savedSubmissions = localStorage.getItem(`aita_student_submissions_${studentId}`);
      if (savedSubmissions) {
        setSubmissionHistory(JSON.parse(savedSubmissions));
      }
    } catch (e) {
      console.warn('Không thể đọc lịch sử nộp bài:', e);
    }

    // Nếu props task được truyền vào cụ thể ban đầu, mở nó
    if (task) {
      const matched = combinedPool.find((t) => t.id === task.id);
      setSelectedTask(matched || { ...task, allowedExtensions: ['.zip'], maxSizeMb: 10 });
    }
  };

  // Tính toán thời gian còn lại và độ khẩn cấp của Deadline
  const getDeadlineMetadata = (deadlineStr: string) => {
    const diff = +new Date(deadlineStr) - +new Date();
    if (diff <= 0) {
      return {
        status: 'EXPIRED',
        color: '#f43f5e',
        bgColor: 'rgba(244, 63, 94, 0.15)',
        borderColor: 'rgba(244, 63, 94, 0.4)',
        label: 'Đã hết hạn nộp',
        isUrgent: false,
        diffHours: 0,
      };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / 1000 / 60) % 60);

    if (diff < 24 * 60 * 60 * 1000) {
      // Dưới 24h: Rất gấp (Đỏ nhấp nháy)
      return {
        status: 'URGENT',
        color: '#fb7185',
        bgColor: 'rgba(244, 63, 94, 0.22)',
        borderColor: 'rgba(244, 63, 94, 0.55)',
        label: `Gấp: Còn ${hours}h ${minutes}m`,
        isUrgent: true,
        diffHours: hours,
      };
    }

    if (diff < 3 * 24 * 60 * 60 * 1000) {
      // Dưới 3 ngày: Sắp hết hạn (Vàng cam)
      return {
        status: 'ENDING_SOON',
        color: '#f59e0b',
        bgColor: 'rgba(245, 158, 11, 0.18)',
        borderColor: 'rgba(245, 158, 11, 0.45)',
        label: `Sắp đến hạn: Còn ${days}d ${hours}h`,
        isUrgent: true,
        diffHours: days * 24 + hours,
      };
    }

    // Trên 3 ngày: Bình thường (Xanh ngọc)
    return {
      status: 'ACTIVE',
      color: '#38bdf8',
      bgColor: 'rgba(56, 189, 248, 0.14)',
      borderColor: 'rgba(56, 189, 248, 0.35)',
      label: `Còn ${days} ngày ${hours}h`,
      isUrgent: false,
      diffHours: days * 24 + hours,
    };
  };

  // Lấy danh sách các môn học để đưa vào bộ lọc
  const courseOptions = useMemo(() => {
    const set = new Set<string>();
    assignmentList.forEach((a) => {
      if (a.courseCode) set.add(a.courseCode);
      else if (a.course) {
        const code = a.course.split('-')[0].trim();
        set.add(code);
      }
    });
    return Array.from(set);
  }, [assignmentList]);

  // Lọc bài tập theo tìm kiếm, môn học và trạng thái
  const filteredAssignments = useMemo(() => {
    return assignmentList.filter((item) => {
      // Tìm kiếm
      const matchSearch =
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.course.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.id.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchSearch) return false;

      // Môn học
      if (selectedCourseFilter !== 'ALL') {
        const itemCode = item.courseCode || item.course.split('-')[0].trim();
        if (itemCode !== selectedCourseFilter) return false;
      }

      // Trạng thái deadline
      const meta = getDeadlineMetadata(item.deadline);
      const isSubmitted = !!submissionHistory[item.id];

      if (statusFilter === 'SUBMITTED' && !isSubmitted) return false;
      if (statusFilter === 'PENDING' && isSubmitted) return false;
      if (statusFilter === 'URGENT' && (!meta.isUrgent || isSubmitted)) return false;

      return true;
    });
  }, [assignmentList, searchQuery, selectedCourseFilter, statusFilter, submissionHistory]);

  // Thống kê nhanh
  const stats = useMemo(() => {
    let total = assignmentList.length;
    let submitted = 0;
    let urgent = 0;

    assignmentList.forEach((a) => {
      if (submissionHistory[a.id]) {
        submitted++;
      } else {
        const meta = getDeadlineMetadata(a.deadline);
        if (meta.isUrgent) urgent++;
      }
    });

    return {
      total,
      pending: total - submitted,
      urgent,
      submitted,
    };
  }, [assignmentList, submissionHistory]);

  // Xử lý tính toán mã băm SHA-256
  const calculateSha256 = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  const activeDeadline = selectedTask?.deadline || task?.deadline;
  const isActuallyExpired = activeDeadline ? new Date() > new Date(activeDeadline) : false;
  const isExpired = isActuallyExpired || isDeadlineSimulatedExpired;

  const processFile = async (file: File) => {
    setErrorMessage(null);
    setExceptionType(null);
    const currentTask = selectedTask || task;
    if (!currentTask) return;

    if (isExpired) {
      setErrorMessage(`[BR-02 Ngoại Lệ] Đã quá hạn chót nộp bài (${new Date(currentTask.deadline).toLocaleString('vi-VN')})! Cổng nộp đã tự động đóng.`);
      setExceptionType('EXPIRED');
      return;
    }

    const maxBytes = (currentTask.maxSizeMb || 10) * 1024 * 1024;
    if (file.size > maxBytes) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
      setErrorMessage(`[413 Payload Too Large - Ngoại Lệ 1] Dung lượng file (${sizeMb} MB) vượt quá giới hạn tối đa ${currentTask.maxSizeMb || 10} MB! Đã đánh chặn ngay tại Client-side trước khi truyền tải qua mạng.`);
      setExceptionType('OVERSIZE');
      return;
    }

    const isZip = file.name.endsWith('.zip') || file.type.includes('zip') || file.type.includes('compressed');
    if (!isZip) {
      setErrorMessage('Chỉ chấp nhận file định dạng nén (.zip) chứa mã nguồn.');
      return;
    }

    setSelectedFile(file);
    setIsHashing(true);
    try {
      const hash = await calculateSha256(file);
      setSha256Checksum(hash);
    } catch {
      setSha256Checksum(null);
    } finally {
      setIsHashing(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      void processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      void processFile(e.target.files[0]);
    }
  };

  const triggerDemoOversize = () => {
    setSelectedFile(null);
    setSha256Checksum(null);
    const currentTask = selectedTask || task;
    setErrorMessage(
      `[413 Payload Too Large - Ngoại Lệ 1] Dung lượng file (12.45 MB) vượt quá giới hạn tối đa ${currentTask?.maxSizeMb || 10} MB! Đã đánh chặn ngay tại Client-side trước khi truyền tải qua mạng.`,
    );
    setExceptionType('OVERSIZE');
  };

  const toggleDemoExpired = () => {
    const nextState = !isDeadlineSimulatedExpired;
    setIsDeadlineSimulatedExpired(nextState);
    setSelectedFile(null);
    setSha256Checksum(null);
    if (nextState) {
      setErrorMessage(
        '[BR-02 Ngoại Lệ 2] Cổng nộp bài đã đóng do quá hạn chót Deadline. Không cho phép nộp bổ sung nhằm bảo toàn tính toàn vẹn học thuật.',
      );
      setExceptionType('EXPIRED');
    } else {
      setErrorMessage(null);
      setExceptionType(null);
    }
  };

  const handleSubmit = () => {
    if (isExpired) {
      setErrorMessage('[BR-02 Ngoại Lệ] Không thể nộp bài do đã quá hạn chót!');
      return;
    }
    const currentTask = selectedTask || task;
    if (selectedFile && currentTask) {
      // Lưu lại thông tin nộp bài tạm thời
      const newRecord: StudentSubmissionRecord = {
        assignmentId: currentTask.id,
        submittedAt: new Date().toISOString(),
        fileName: selectedFile.name,
        fileSizeMb: Number((selectedFile.size / (1024 * 1024)).toFixed(2)),
        sha256: sha256Checksum || undefined,
        status: 'QUEUED',
      };

      const updated = { ...submissionHistory, [currentTask.id]: newRecord };
      setSubmissionHistory(updated);
      try {
        localStorage.setItem(`aita_student_submissions_${studentId}`, JSON.stringify(updated));
      } catch (e) {
        console.warn('Không thể lưu kết quả nộp bài:', e);
      }

      onSubmit(selectedFile, currentTask);
    }
  };

  // ==========================================
  // VIEW 1: CHI TIẾT NỘP BÀI (DETAIL SUBMISSION VIEW)
  // ==========================================
  if (selectedTask) {
    const prevSubmission = submissionHistory[selectedTask.id];
    // deadlineMeta removed

    return (
      <div style={{ maxWidth: '980px', margin: '0 auto', padding: '10px 0' }}>
        {/* Nút quay lại danh sách bài tập */}
        <div style={{ marginBottom: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <button
            type="button"
            onClick={() => {
              setSelectedTask(null);
              setSelectedFile(null);
              setSha256Checksum(null);
              setErrorMessage(null);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              color: '#e5e7eb',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <ArrowLeft size={16} /> Quay Lại Danh Sách Deadline
          </button>
        </div>

        {/* Thanh Demo Ngoại Lệ cho Hội đồng đánh giá */}
        <div
          style={{
            padding: '12px 18px',
            borderRadius: '12px',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fbbf24', fontSize: '13px', fontWeight: 700 }}>
            <Bug size={16} />
            <span>Kịch bản Demo Đường Ngoại Lệ (Milestone 2 Defense):</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={triggerDemoOversize}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                backgroundColor: exceptionType === 'OVERSIZE' ? 'rgba(244, 63, 94, 0.3)' : 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(244, 63, 94, 0.4)',
                color: '#f43f5e',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              🔴 Demo File &gt; 10MB
            </button>
            <button
              type="button"
              onClick={toggleDemoExpired}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                backgroundColor: isDeadlineSimulatedExpired ? 'rgba(244, 63, 94, 0.3)' : 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(244, 63, 94, 0.4)',
                color: '#f43f5e',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              {isDeadlineSimulatedExpired ? <RefreshCw size={12} /> : <Lock size={12} />}
              {isDeadlineSimulatedExpired ? 'Khôi phục Deadline' : '🔴 Demo Quá Deadline (BR-02)'}
            </button>
          </div>
        </div>

        {/* Khung Thông Tin Bài Tập & Đếm Ngược Deadline */}
        <div className="glass-panel" style={{ padding: '28px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
            <div style={{ flex: 1, minWidth: '300px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '3px 10px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(99, 102, 241, 0.2)',
                    color: 'var(--accent-cyan)',
                    border: '1px solid rgba(99, 102, 241, 0.35)',
                    textTransform: 'uppercase',
                  }}
                >
                  {selectedTask.courseCode || 'SWP391'}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Mã bài tập: {selectedTask.id}
                </span>
              </div>

              <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#ffffff', lineHeight: '1.3', marginBottom: '10px' }}>
                {selectedTask.title}
              </h1>

              <p style={{ color: '#d1d5db', fontSize: '14px', lineHeight: '1.6' }}>
                {selectedTask.description}
              </p>
            </div>

            {/* Đồng hồ đếm ngược thời gian thực */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
              <CountdownTimer deadline={isDeadlineSimulatedExpired ? new Date(Date.now() - 3600000).toISOString() : selectedTask.deadline} />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Hạn chót: {new Date(selectedTask.deadline).toLocaleString('vi-VN')}
              </span>
            </div>
          </div>

          {/* Thông số kỹ thuật Docker Sandbox */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
              padding: '16px',
              borderRadius: '12px',
              backgroundColor: 'rgba(10, 15, 29, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              marginTop: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Cpu size={18} color="var(--accent-cyan)" />
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>CPU Time Limit</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                  {selectedTask.timeLimitMs || 2000} ms
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <HardDrive size={18} color="var(--accent-emerald)" />
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>RAM Sandbox Limit</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                  {selectedTask.memoryLimitMb || 512} MB
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Code size={18} color="var(--accent-primary)" />
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Ngôn ngữ hợp lệ</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', textTransform: 'uppercase' }}>
                  {(selectedTask.allowedLanguages || ['java', 'python', 'cpp']).join(', ')}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Layers size={18} color="var(--accent-amber)" />
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Bộ Testcases</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                  {selectedTask.testCasesCount || 5} testcases
                </div>
              </div>
            </div>
          </div>

          {/* Barem tiêu chí chấm điểm nếu có */}
          {selectedTask.rubrics && selectedTask.rubrics.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#e5e7eb', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Award size={15} color="var(--accent-amber)" /> Barem Đánh Giá Học Thuật & Chấm Điểm
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
                {selectedTask.rubrics.map((r, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff' }}>{r.criterion}</span>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--accent-emerald)' }}>+{r.maxScore}đ</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Thông báo nếu đã có bài nộp trước đó */}
        {prevSubmission && (
          <div
            style={{
              padding: '16px 20px',
              borderRadius: '12px',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <CheckCircle size={22} color="var(--accent-emerald)" />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                  Bạn đã nộp bài thành công cho bài tập này!
                </div>
                <div style={{ fontSize: '12px', color: '#a7f3d0' }}>
                  File: <strong>{prevSubmission.fileName}</strong> | Nộp lúc: {new Date(prevSubmission.submittedAt).toLocaleString('vi-VN')} | Trạng thái: <span style={{ fontWeight: 800, color: prevSubmission.status === 'GRADED' ? '#34d399' : '#fbbf24' }}>{prevSubmission.status === 'GRADED' ? `Đã chấm ${prevSubmission.score}/10` : 'Đang chờ chấm'}</span>
                </div>
              </div>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              (Bạn vẫn có thể nộp lại file mới để cập nhật điểm trước deadline)
            </span>
          </div>
        )}

        {/* VÙNG KÉO THẢ NỘP FILE .ZIP */}
        <div className="glass-panel" style={{ padding: '32px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UploadCloud size={20} color="var(--accent-cyan)" /> Tải Lên Mã Nguồn Bài Làm (.zip)
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
            Nén toàn bộ mã nguồn bài làm của bạn vào định dạng <code>.zip</code> (tối đa {selectedTask.maxSizeMb || 10}MB). Hệ thống sẽ tự động tính mã SHA-256 để chống chỉnh sửa và đối sánh đạo văn.
          </p>

          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragActive ? 'var(--accent-primary)' : selectedFile ? 'var(--accent-emerald)' : 'rgba(99, 102, 241, 0.35)'}`,
              borderRadius: '16px',
              padding: '40px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              backgroundColor: dragActive ? 'rgba(99, 102, 241, 0.12)' : 'rgba(18, 24, 36, 0.6)',
              transition: 'all 0.2s ease-in-out',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              onChange={handleChange}
              style={{ display: 'none' }}
            />

            {selectedFile ? (
              <>
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent-emerald)',
                  }}
                >
                  <FileArchive size={36} />
                </div>
                <div>
                  <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>{selectedFile.name}</h4>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Kích thước: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                  {isHashing && (
                    <p style={{ fontSize: '12px', color: 'var(--accent-primary)', marginTop: '4px' }}>
                      Đang tính toán mã băm SHA-256 xác thực...
                    </p>
                  )}
                  {sha256Checksum && (
                    <div
                      style={{
                        marginTop: '10px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 14px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(99, 102, 241, 0.15)',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        fontSize: '12px',
                        color: 'var(--accent-cyan)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      <ShieldCheck size={14} color="#10b981" />
                      <span>SHA-256: {sha256Checksum.substring(0, 16)}...{sha256Checksum.substring(sha256Checksum.length - 8)}</span>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                    setSha256Checksum(null);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-rose)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    marginTop: '8px',
                  }}
                >
                  <X size={16} /> Chọn lại file khác
                </button>
              </>
            ) : (
              <>
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent-primary)',
                  }}
                >
                  <UploadCloud size={32} />
                </div>
                <div>
                  <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>
                    Kéo và thả file bài làm .zip vào đây
                  </h4>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    hoặc <span style={{ color: 'var(--accent-cyan)', textDecoration: 'underline', fontWeight: 600 }}>bấm để chọn file từ máy tính</span>
                  </p>
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-dim)',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  }}
                >
                  Chấp nhận: .zip (Tối đa {selectedTask.maxSizeMb || 10}MB)
                </span>
              </>
            )}
          </div>

          {errorMessage && (
            <div
              style={{
                marginTop: '16px',
                padding: '14px 18px',
                borderRadius: '12px',
                backgroundColor: 'rgba(244, 63, 94, 0.12)',
                border: '1px solid rgba(244, 63, 94, 0.35)',
                color: '#f43f5e',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                lineHeight: 1.5,
              }}
            >
              <AlertOctagon size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontWeight: 700, marginBottom: '2px' }}>
                  {exceptionType === 'OVERSIZE'
                    ? 'ĐÁNH CHẶN NGOẠI LỆ: DUNG LƯỢNG VƯỢT QUÁ 10MB'
                    : exceptionType === 'EXPIRED'
                    ? 'ĐÁNH CHẶN NGOẠI LỆ: QUÁ HẠN NỘP BÀI (BR-02)'
                    : 'LỖI BÀI NỘP'}
                </div>
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          {/* NÚT XÁC NHẬN NỘP BÀI */}
          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              onClick={() => setSelectedTask(null)}
              style={{
                padding: '12px 20px',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                backgroundColor: 'transparent',
                color: '#e5e7eb',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Hủy Bỏ
            </button>

            <button
              type="button"
              disabled={!selectedFile || isHashing || isExpired}
              onClick={handleSubmit}
              style={{
                padding: '12px 28px',
                borderRadius: '10px',
                border: 'none',
                background: isExpired
                  ? 'rgba(255, 255, 255, 0.05)'
                  : selectedFile && !isHashing
                  ? 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)'
                  : 'rgba(255, 255, 255, 0.1)',
                color: isExpired ? '#f43f5e' : '#ffffff',
                fontSize: '14px',
                fontWeight: 700,
                cursor: selectedFile && !isHashing && !isExpired ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: selectedFile && !isHashing && !isExpired ? '0 4px 15px rgba(99, 102, 241, 0.4)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              {isExpired ? (
                <>
                  <Lock size={16} /> Cổng Nộp Đã Đóng (Quá Hạn Chót BR-02)
                </>
              ) : (
                <>
                  <Send size={16} />
                  {prevSubmission ? 'Nộp Lại Bài & Chấm AI Sandbox' : 'Nộp Bài & Kích Hoạt Chấm Điểm AI'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: DANH SÁCH TẤT CẢ DEADLINE CẦN NỘP (HUB VIEW)
  // ==========================================
  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '10px 0' }}>
      {/* Tiêu đề & Thông tin sinh viên */}
      <div
        className="glass-panel"
        style={{
          padding: '24px 28px',
          marginBottom: '24px',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(6, 182, 212, 0.08) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '3px 10px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(16, 185, 129, 0.2)',
                  color: '#6ee7b7',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                }}
              >
                CỔNG SINH VIÊN
              </span>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Sinh viên: <strong>{studentName}</strong> ({studentId})
              </span>
            </div>

            <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.3px' }}>
              Danh Sách Bài Tập & Giám Sát Deadline Nộp Bài
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Xem toàn bộ các bài tập được giao, thời gian đếm ngược còn lại và bấm vào bài tập để tải lên mã nguồn nộp bài.
            </p>
          </div>

          <button
            type="button"
            onClick={loadAssignmentsAndSubmissions}
            title="Làm mới danh sách từ giảng viên"
            style={{
              padding: '8px 14px',
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
            }}
          >
            <RefreshCw size={14} /> Làm Mới
          </button>
        </div>

        {/* 4 Thẻ Chỉ Số Tổng Quan (Stats Overview) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '14px',
            marginTop: '20px',
          }}
        >
          <div
            style={{
              padding: '14px 18px',
              borderRadius: '12px',
              backgroundColor: 'rgba(10, 15, 29, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600 }}>TỔNG BÀI ĐƯỢC GIAO</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#ffffff', marginTop: '4px' }}>{stats.total}</div>
          </div>

          <div
            style={{
              padding: '14px 18px',
              borderRadius: '12px',
              backgroundColor: 'rgba(10, 15, 29, 0.6)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
            }}
          >
            <div style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 600 }}>CẦN NỘP (CHƯA NỘP)</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#fbbf24', marginTop: '4px' }}>{stats.pending}</div>
          </div>

          <div
            style={{
              padding: '14px 18px',
              borderRadius: '12px',
              backgroundColor: 'rgba(10, 15, 29, 0.6)',
              border: '1px solid rgba(244, 63, 94, 0.35)',
            }}
          >
            <div style={{ fontSize: '11px', color: '#fb7185', fontWeight: 600 }}>SẮP HẾT HẠN (&lt; 48H)</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#f43f5e', marginTop: '4px' }}>{stats.urgent}</div>
          </div>

          <div
            style={{
              padding: '14px 18px',
              borderRadius: '12px',
              backgroundColor: 'rgba(10, 15, 29, 0.6)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
            }}
          >
            <div style={{ fontSize: '11px', color: '#34d399', fontWeight: 600 }}>ĐÃ HOÀN THÀNH NỘP</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>{stats.submitted}</div>
          </div>
        </div>
      </div>

      {/* THANH CÔNG CỤ TÌM KIẾM & BỘ LỌC */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        {/* Ô Tìm Kiếm */}
        <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên bài tập, mã bài hoặc môn học..."
            style={{
              width: '100%',
              padding: '10px 16px 10px 40px',
              borderRadius: '10px',
              backgroundColor: 'rgba(18, 24, 36, 0.8)',
              border: '1px solid var(--border-color)',
              color: '#ffffff',
              fontSize: '13px',
              outline: 'none',
            }}
          />
        </div>

        {/* Lọc theo Học Phần */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-dim)', fontWeight: 600 }}>Môn:</span>
          <select
            value={selectedCourseFilter}
            onChange={(e) => setSelectedCourseFilter(e.target.value)}
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              backgroundColor: 'rgba(18, 24, 36, 0.8)',
              border: '1px solid var(--border-color)',
              color: '#ffffff',
              fontSize: '13px',
              outline: 'none',
            }}
          >
            <option value="ALL">Tất Cả Môn Học</option>
            {courseOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Lọc theo Trạng thái Deadline */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {[
            { key: 'ALL', label: 'Tất cả' },
            { key: 'PENDING', label: 'Chưa nộp' },
            { key: 'URGENT', label: 'Sắp hết hạn' },
            { key: 'SUBMITTED', label: 'Đã nộp' },
          ].map((tab) => {
            const active = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key as any)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: active ? '1px solid var(--accent-primary)' : '1px solid rgba(255, 255, 255, 0.1)',
                  backgroundColor: active ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                  color: active ? '#818cf8' : 'var(--text-muted)',
                  fontSize: '12px',
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* DANH SÁCH THẺ BÀI TẬP (DEADLINE CARDS) */}
      {filteredAssignments.length === 0 ? (
        <div
          className="glass-panel"
          style={{
            padding: '50px 20px',
            textAlign: 'center',
            color: 'var(--text-muted)',
          }}
        >
          <BookOpen size={40} color="var(--text-dim)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
            Không tìm thấy bài tập nào phù hợp
          </h3>
          <p style={{ fontSize: '13px' }}>
            Hãy thử thay đổi từ khóa tìm kiếm hoặc đặt lại bộ lọc môn học.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filteredAssignments.map((assignment) => {
            const meta = getDeadlineMetadata(assignment.deadline);
            const isSubmitted = !!submissionHistory[assignment.id];
            const submissionRecord = submissionHistory[assignment.id];

            return (
              <div
                key={assignment.id}
                onClick={() => setSelectedTask(assignment)}
                className="glass-panel"
                style={{
                  padding: '20px 24px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  border: meta.isUrgent && !isSubmitted ? '1px solid rgba(244, 63, 94, 0.45)' : '1px solid var(--border-color)',
                  backgroundColor: 'rgba(18, 24, 36, 0.75)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '20px',
                  flexWrap: 'wrap',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.borderColor = 'var(--accent-primary)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(99, 102, 241, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = meta.isUrgent && !isSubmitted ? 'rgba(244, 63, 94, 0.45)' : 'var(--border-color)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* Cột Trái: Thông tin bài tập */}
                <div style={{ flex: 1, minWidth: '320px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <span
                      style={{
                        padding: '3px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 800,
                        backgroundColor: 'rgba(99, 102, 241, 0.2)',
                        color: 'var(--accent-cyan)',
                        border: '1px solid rgba(99, 102, 241, 0.35)',
                      }}
                    >
                      {assignment.courseCode || 'SWP391'}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Mã: {assignment.id}
                    </span>

                    {/* Huy hiệu nộp bài */}
                    {isSubmitted ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: 'rgba(16, 185, 129, 0.2)',
                          color: '#34d399',
                          border: '1px solid rgba(16, 185, 129, 0.4)',
                        }}
                      >
                        <CheckCircle size={12} /> Đã nộp ({submissionRecord?.score}/10)
                      </span>
                    ) : (
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: 'rgba(245, 158, 11, 0.18)',
                          color: '#f59e0b',
                          border: '1px solid rgba(245, 158, 11, 0.35)',
                        }}
                      >
                        Chưa nộp
                      </span>
                    )}
                  </div>

                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', marginBottom: '6px', lineHeight: '1.3' }}>
                    {assignment.title}
                  </h3>

                  <p
                    style={{
                      fontSize: '13px',
                      color: 'var(--text-muted)',
                      lineHeight: '1.5',
                      marginBottom: '12px',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {assignment.description}
                  </p>

                  {/* Thông tin phụ: RAM, CPU, Ngôn ngữ */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '11px', color: 'var(--text-dim)', flexWrap: 'wrap' }}>
                    <span>⏱ {assignment.timeLimitMs || 2000}ms</span>
                    <span>💾 {assignment.memoryLimitMb || 512}MB</span>
                    <span>🧩 {assignment.testCasesCount || 5} testcases</span>
                    <span>💻 {(assignment.allowedLanguages || ['java', 'python', 'cpp']).join(', ').toUpperCase()}</span>
                  </div>
                </div>

                {/* Cột Phải: Deadline đếm ngược & Nút nộp */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px', minWidth: '220px' }}>
                  {/* Badge Deadline */}
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 14px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: 700,
                      backgroundColor: meta.bgColor,
                      color: meta.color,
                      border: `1px solid ${meta.borderColor}`,
                    }}
                  >
                    <Clock size={14} className={meta.isUrgent ? 'pulse-animation' : ''} />
                    <span>{meta.label}</span>
                  </div>

                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Hạn: {new Date(assignment.deadline).toLocaleString('vi-VN')}
                  </span>

                  {/* Nút hành động */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTask(assignment);
                    }}
                    style={{
                      padding: '9px 20px',
                      borderRadius: '8px',
                      border: 'none',
                      background: isSubmitted
                        ? 'rgba(255, 255, 255, 0.08)'
                        : 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
                      color: isSubmitted ? '#e5e7eb' : '#ffffff',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: isSubmitted ? 'none' : '0 4px 12px rgba(99, 102, 241, 0.3)',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {isSubmitted ? 'Nộp Lại Bài' : 'Nộp Bài Ngay'} <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
