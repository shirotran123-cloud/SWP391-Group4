import { SubmissionDetailModal, type SubmissionDetailData } from './SubmissionDetailModal';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  UploadCloud, FileArchive, X, Send, ShieldCheck, Clock,
  BookOpen, AlertTriangle, CheckCircle, Search,
  ArrowLeft, Cpu, HardDrive, Code, ChevronRight,
  Award, RefreshCw, Layers, AlertOctagon, Hash, Lock, Bug,
  FileText, Copy, Check, Terminal, Info, CheckSquare, Sparkles
} from 'lucide-react';
import { CountdownTimer } from './CountdownTimer';
import { AssignmentDescriptionView } from './AssignmentDescriptionView';
import { parseAssignmentDescription } from '../utils/assignmentParser';
import { verifyAssignmentTestCases } from '../services/assignment-testcases.service';
import type { Task } from '../types';
import { API_BASE_URL } from '../config/api';

export interface RubricItem {
  criterion: string;
  maxScore: number;
  description: string;
}

export interface SampleTestCase {
  name: string;
  input: string;
  expectedOutput: string;
  explanation: string;
}

export interface TechnicalRequirement {
  problemContext: string;
  inputFormat: string[];
  outputFormat: string[];
  constraints: string[];
  complexityRequirements: string[];
  solidGuidelines: string[];
  packagingGuide?: {
    entryPoint: string;
    directoryStructure: string;
    rules: string[];
  };
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
  technicalRequirements?: TechnicalRequirement;
  sampleTestCases?: SampleTestCase[];
  configuredTestCases?: Array<{ input: string; output: string; weight: number; isHidden: boolean }>;
  testCases?: Array<{ input: string; output: string; weight: number; isHidden: boolean }>;
}

export interface StudentSubmissionRecord {
  assignmentId: string;
  submissionId?: string;
  submittedAt: string;
  fileName: string;
  fileSizeMb?: number;
  sha256?: string;
  score?: number;
  scoreBreakdown?: any;
  passedTestcases?: number;
  totalTestcases?: number;
  testcaseResults?: Array<{ testcaseIndex: number; status: 'PASSED' | 'FAILED'; timeMs: number }>;
  executionTimeMs?: number;
  sourceCode?: string;
  aiRating?: any;
  language?: string;
  status: 'QUEUED' | 'GRADED' | 'SUBMITTED';
}

export interface EnrolledCourseItem {
  courseId: string;
  courseCode: string;
  courseName: string;
  semester?: string;
  description?: string;
}

interface SubmissionViewProps {
  task?: Task;
  studentId?: string;
  studentName?: string;
  enrolledCourses?: EnrolledCourseItem[];
  selectedCourseId?: string;
  apiBaseUrl?: string;
  onSelectCourse?: (courseId: string) => void;
  onOpenAppeal?: (submissionId: string, currentScore?: number) => void;
  onSubmit: (file: File, task?: Task, selectedLanguage?: string) => void;
}

const defaultAssignmentPool: StudentTaskItem[] = [
  {
    id: 'TASK-PRO192-A1',
    courseId: 'CRS-PRO192',
    courseCode: 'PRO192',
    course: 'PRO192 - Object-Oriented Programming with Java',
    title: 'Quản lý Đội xe Vận tải hướng đối tượng OOP (PRO192)',
    description: 'Áp dụng các nguyên lý lập trình hướng đối tượng (Kế thừa, Đóng gói, Đa hình, Trừu tượng) để thiết kế hệ thống quản lý phương tiện giao thông và đội xe logistics.',
    deadline: '2026-10-18T23:59:59.000Z',
    timeLimitMs: 2000,
    memoryLimitMb: 512,
    allowedLanguages: ['java'],
    allowedExtensions: ['.zip'],
    maxSizeMb: 10,
    testCasesCount: 3,
    status: 'PUBLISHED',
    rubrics: [
      { criterion: 'Tính đúng đắn thuật toán & Vượt qua Testcases', maxScore: 5.0, description: 'Pass 100% testcases chuẩn và biên' },
      { criterion: 'Clean Code & Tối ưu O(N log N)', maxScore: 2.5, description: 'Mã nguồn rõ ràng, đặt tên biến chuẩn, tối ưu thời gian' },
      { criterion: 'Thiết kế Hướng đối tượng & SOLID', maxScore: 2.5, description: 'Tuân thủ Single Responsibility và Dependency Inversion' },
    ],
    technicalRequirements: {
      problemContext: 'Xây dựng hệ thống quản lý phương tiện vận tải áp dụng tính kế thừa và đa hình trong Java.',
      inputFormat: ['Dòng 1: Số lượng phương tiện N.', 'N dòng tiếp theo: Thông tin xe tải, xe hơi hoặc xe buýt.'],
      outputFormat: ['In danh sách phương tiện sắp xếp theo tải trọng giảm dần.'],
      constraints: ['1 ≤ N ≤ 10,000.', 'Bộ nhớ tối đa 512MB RAM.'],
      complexityRequirements: ['Thời gian thực thi tối đa 2.0s.'],
      solidGuidelines: ['Tách biệt class Controller và Service.', 'Áp dụng Interface Segregation.'],
    },
  },
  {
    id: 'TASK-CSD201-A1',
    courseId: 'CRS-CSD201',
    courseCode: 'CSD201',
    course: 'CSD201 - Data Structures and Algorithms',
    title: 'Thuật toán Cấu trúc Dữ liệu & Đồ thị Dijkstra (CSD201)',
    description: 'Cài đặt giải thuật Dijkstra với PriorityQueue tìm đường đi ngắn nhất trên đồ thị có trọng số và phân tích độ phức tạp O(E log V).',
    deadline: '2026-10-20T23:59:59.000Z',
    timeLimitMs: 2000,
    memoryLimitMb: 512,
    allowedLanguages: ['java', 'cpp', 'python'],
    allowedExtensions: ['.zip'],
    maxSizeMb: 10,
    testCasesCount: 3,
    status: 'PUBLISHED',
    rubrics: [
      { criterion: 'Tính đúng đắn thuật toán & Vượt qua Testcases', maxScore: 5.0, description: 'Pass 100% testcases Dijkstra' },
      { criterion: 'Độ phức tạp O(E log V) và Tối ưu Heap', maxScore: 2.5, description: 'Sử dụng Min-Heap PriorityQueue' },
      { criterion: 'Clean Code & Xử lý ngoại lệ', maxScore: 2.5, description: 'Đóng gói class Graph và Vertex chuẩn mực' },
    ],
    technicalRequirements: {
      problemContext: 'Tìm đường đi ngắn nhất từ đỉnh nguồn S đến mọi đỉnh trên đồ thị có hướng trọng số không âm.',
      inputFormat: ['Dòng 1: V và E (số đỉnh và số cạnh).', 'E dòng tiếp theo: u, v, w (cạnh từ u đến v với trọng số w).'],
      outputFormat: ['Khoảng cách ngắn nhất từ nguồn S đến tất cả các đỉnh.'],
      constraints: ['1 ≤ V ≤ 10,000, 1 ≤ E ≤ 100,000.'],
      complexityRequirements: ['Thời gian thực thi O((V + E) log V).'],
      solidGuidelines: ['Tách biệt biểu diễn đồ thị (Adjacency List) và thuật toán Dijkstra.'],
    },
  },
  {
    id: 'TASK-PRJ301-A1',
    courseId: 'CRS-PRJ301',
    courseCode: 'PRJ301',
    course: 'PRJ301 - Java Web Application Development',
    title: 'Xây dựng Servlet & Filter Quản lý Sinh viên MVC (PRJ301)',
    description: 'Thiết kế và triển khai web application Java theo mô hình MVC 2, sử dụng Servlet xử lý request và Filter xác thực session người dùng.',
    deadline: '2026-11-15T23:59:59.000Z',
    timeLimitMs: 2000,
    memoryLimitMb: 512,
    allowedLanguages: ['java', 'cpp', 'python'],
    allowedExtensions: ['.zip'],
    maxSizeMb: 10,
    testCasesCount: 3,
    status: 'PUBLISHED',
    rubrics: [
      { criterion: 'Kiến trúc MVC 2 & Triển khai Servlet', maxScore: 4.0, description: 'Điều hướng Controller và View rõ ràng' },
      { criterion: 'Authentication Filter & Bảo mật', maxScore: 3.0, description: 'Chặn truy cập trái phép bằng HttpFilter' },
      { criterion: 'Database Connection Pool & DAO', maxScore: 3.0, description: 'Sử dụng HikariCP kết nối CSDL PostgreSQL/SQL Server' },
    ],
    technicalRequirements: {
      problemContext: 'Xây dựng phân hệ quản lý sinh viên với đầy đủ chức năng CRUD, áp dụng Filter phân quyền Role-Based Access Control.',
      inputFormat: ['Request HTTP method GET/POST và tham số session/form data.'],
      outputFormat: ['Response HTTP 200/201 kèm payload JSON hoặc View forward.'],
      constraints: ['Tuân thủ chuẩn Jakarta Servlet / Java EE.'],
      complexityRequirements: ['Thời gian phản hồi API < 500ms.'],
      solidGuidelines: ['Áp dụng Data Access Object (DAO) Pattern và Service Layer.'],
    },
  },
  {
    id: 'TASK-PRF192-A1',
    courseId: 'CRS-PRF192',
    courseCode: 'PRF192',
    course: 'PRF192 - Programming Fundamentals with C',
    title: 'Thuật toán Xử lý Mảng và Quản lý Con trỏ Bộ nhớ Động (PRF192)',
    description: 'Lập trình C giải quyết bài toán chuẩn hóa chuỗi ký tự, sắp xếp mảng động và sử dụng con trỏ quản lý bộ nhớ malloc/free.',
    deadline: '2026-11-20T23:59:59.000Z',
    timeLimitMs: 2000,
    memoryLimitMb: 512,
    allowedLanguages: ['cpp', 'c', 'java'],
    allowedExtensions: ['.zip'],
    maxSizeMb: 10,
    testCasesCount: 3,
    status: 'PUBLISHED',
    rubrics: [
      { criterion: 'Tính đúng đắn thuật toán mảng & chuỗi', maxScore: 5.0, description: 'Vượt qua 100% test cases chuẩn và chuỗi rỗng/đặc biệt' },
      { criterion: 'Quản lý bộ nhớ con trỏ & malloc/free', maxScore: 3.0, description: 'Không phát sinh rò rỉ bộ nhớ (memory leak)' },
      { criterion: 'Phong cách lập trình C & Modular', maxScore: 2.0, description: 'Chia hàm rõ ràng, không dùng biến toàn cục bừa bãi' },
    ],
    technicalRequirements: {
      problemContext: 'Chuẩn hóa chuỗi văn bản (xóa khoảng trắng thừa, viết hoa chữ cái đầu từ) và sắp xếp mảng động bằng con trỏ.',
      inputFormat: ['Dòng 1: Chuỗi văn bản đầu vào dài tối đa 10,000 ký tự.'],
      outputFormat: ['Chuỗi văn bản sau khi chuẩn hóa theo đúng quy tắc.'],
      constraints: ['Độ dài chuỗi 1 ≤ L ≤ 10,000 ký tự.'],
      complexityRequirements: ['Xử lý trong thời gian O(N).'],
      solidGuidelines: ['Giải phóng toàn bộ con trỏ đã cấp phát trước khi kết thúc hàm main.'],
    },
  },
];

// Helper nạp yêu cầu kỹ thuật đầy đủ cho bất kỳ bài tập nào
const getEffectiveRequirements = (task: StudentTaskItem): TechnicalRequirement => {
  if (task.technicalRequirements) return task.technicalRequirements;

  // Tự động phân tích description nếu bài tập có đặc tả
  const parsed = parseAssignmentDescription(task.description || '');
  if (parsed.technicalRequirements.length > 0 || parsed.inputFormat.length > 0) {
    return {
      problemContext: parsed.overview || task.description,
      inputFormat: parsed.inputFormat.length > 0 ? parsed.inputFormat : ['Dữ liệu vào từ luồng chuẩn STDIN.'],
      outputFormat: parsed.outputFormat.length > 0 ? parsed.outputFormat : ['In kết quả xử lý ra luồng chuẩn STDOUT.'],
      constraints: parsed.constraints.length > 0 ? parsed.constraints : [
        `Giới hạn thời gian (Time Limit): ${task.timeLimitMs || 2000} ms.`,
        `Giới hạn bộ nhớ (RAM Limit): ${task.memoryLimitMb || 512} MB.`,
      ],
      complexityRequirements: parsed.technicalRequirements.filter(r => r.toLowerCase().includes('o(')),
      solidGuidelines: parsed.technicalRequirements.filter(r => r.toLowerCase().includes('srp') || r.toLowerCase().includes('solid')),
    };
  }

  const code = (task.courseCode || task.course || '').toUpperCase();
  if (code.includes('CSD')) {
    return {
      problemContext: `Bài tập thuộc môn Cấu Trúc Dữ Liệu & Giải Thuật (${task.courseCode || 'CSD201'}). Yêu cầu sinh viên cài đặt cấu trúc dữ liệu nâng cao (Cây tự cân bằng AVL, Hàng đợi ưu tiên Min-Heap, Đồ thị), giải quyết bài toán với độ phức tạp thời gian tối ưu, hạn chế tối đa rò rỉ bộ nhớ trong môi trường Docker Sandbox.`,
      inputFormat: [
        'Dòng 1: Số nguyên dương N biểu diễn số lượng phần tử hoặc số lượng thao tác truy vấn (1 ≤ N ≤ 100,000).',
        'N dòng tiếp theo: Mỗi dòng chứa câu lệnh thao tác (INSERT value, DELETE value, FIND value hoặc QUERY từ đỉnh u đến v).',
      ],
      outputFormat: [
        'In ra kết quả của các truy vấn theo đúng thứ tự trên từng dòng tới STDOUT.',
        'Đối với cây AVL: In thứ tự duyệt In-Order hoặc Pre-Order khi kết thúc thao tác.',
        'Đối với thuật toán đồ thị: In khoảng cách ngắn nhất hoặc chuỗi các đỉnh trên đường đi.',
      ],
      constraints: [
        `Giới hạn thời gian (Time Limit): ${task.timeLimitMs || 2000} ms cho toàn bộ testcases.`,
        `Giới hạn bộ nhớ (Memory Limit): ${task.memoryLimitMb || 512} MB trong Docker Sandbox.`,
        'Độ phức tạp thời gian bắt buộc: O(log N) cho các thao tác cây AVL, O((V + E) log V) cho Dijkstra.',
        'Không được sử dụng các cấu trúc dữ liệu có sẵn của ngôn ngữ nếu đề bài yêu cầu tự cài đặt con trỏ Node.',
      ],
      complexityRequirements: [
        'Thời gian (Time Complexity): O(log N) cho tìm kiếm/chèn/xóa.',
        'Không gian (Space Complexity): O(N) cho bộ nhớ lưu trữ cây/đồ thị.',
      ],
      solidGuidelines: [
        'Single Responsibility Principle (SRP): Tách bạch Node, Tree/Graph và lớp Runner/I-O.',
        'Clean Code: Đặt tên biến tường minh (height, balanceFactor, leftChild, rightChild).',
      ],
    };
  }

  return {
    problemContext: `Đề bài yêu cầu sinh viên xây dựng giải thuật xử lý dữ liệu chuẩn hóa trong dự án phần mềm (${task.courseCode || 'PRO192'}). Mã nguồn phải được đóng gói theo chuẩn Clean Code, áp dụng các nguyên lý SOLID và đảm bảo vượt qua các trường hợp kiểm thử biên trong môi trường Docker Sandbox.`,
    inputFormat: [
      'Dòng 1: Số nguyên dương N biểu diễn số lượng phần tử trong tập dữ liệu (1 ≤ N ≤ 100,000).',
      'Dòng 2: Gồm N số nguyên A[1], A[2], ..., A[N] cách nhau bởi khoảng trắng (-10^9 ≤ A[i] ≤ 10^9).',
    ],
    outputFormat: [
      'In ra trên một dòng duy nhất chuỗi kết quả đã được xử lý/sắp xếp, các phần tử cách nhau đúng một khoảng trắng.',
      'Kết thúc bằng ký tự xuống dòng (\\n).',
    ],
    constraints: [
      `Giới hạn thời gian (Time Limit): ${task.timeLimitMs || 2000} ms. Các giải thuật O(N^2) sẽ bị lỗi Time Limit Exceeded (TLE).`,
      `Giới hạn bộ nhớ (RAM Limit): ${task.memoryLimitMb || 512} MB.`,
      'Không được in ra các thông báo phụ (như "Nhap N:") làm sai lệch kết quả đối chiếu testcases.',
    ],
    complexityRequirements: [
      'Độ phức tạp thời gian: O(N log N) trong mọi trường hợp.',
      'Độ phức tạp không gian: Tối đa O(N).',
    ],
    solidGuidelines: [
      'Single Responsibility (SRP): Tách riêng logic thuật toán và logic in ấn màn hình.',
      'Dependency Inversion (DIP): Sử dụng Interface trừu tượng để decoupling mã nguồn.',
    ],
  };
};

// Helper nạp testcase mẫu cho bất kỳ bài tập nào
const getEffectiveSampleTestCases = (task: StudentTaskItem): SampleTestCase[] => {
  if (task.configuredTestCases) {
    return task.configuredTestCases
      .filter((testCase) => !testCase.isHidden)
      .map((testCase, index) => ({
        name: `Testcase công khai ${index + 1}`,
        input: testCase.input,
        expectedOutput: testCase.output,
        explanation: 'Testcase công khai của đề bài.',
      }));
  }
  if (task.sampleTestCases && task.sampleTestCases.length > 0) {
    return task.sampleTestCases;
  }
  const code = (task.courseCode || task.course || '').toUpperCase();
  if (code.includes('CSD')) {
    return [
      {
        name: 'Testcase Mẫu 1 (Thao Tác Cây Cân Bằng)',
        input: '5\\nINSERT 50\\nINSERT 30\\nINSERT 70\\nINSERT 20\\nINSERT 40',
        expectedOutput: '20 30 40 50 70',
        explanation: 'Chèn 5 phần tử vào cây AVL. Cây duy trì hệ số cân bằng và in ra thứ tự tăng dần.',
      },
      {
        name: 'Testcase Mẫu 2 (Trường Hợp Cân Bằng Biên)',
        input: '3\\nINSERT 10\\nINSERT 20\\nINSERT 30',
        expectedOutput: '10 20 30\\nRoot: 20',
        explanation: 'Chèn 10 -> 20 -> 30 kích hoạt phép xoay đơn RR, đưa 20 lên làm gốc.',
      },
    ];
  }
  return [
    {
      name: 'Testcase Mẫu 1 (Dữ Liệu Cơ Sở)',
      input: '5\\n4 2 5 1 3',
      expectedOutput: '1 2 3 4 5',
      explanation: 'Dãy 5 số nguyên [4, 2, 5, 1, 3] được sắp xếp theo thứ tự tăng dần thành [1, 2, 3, 4, 5].',
    },
    {
      name: 'Testcase Mẫu 2 (Số Âm & Trùng Lặp)',
      input: '6\\n10 0 -5 10 -2 0',
      expectedOutput: '-5 -2 0 0 10 10',
      explanation: 'Dãy chứa các số âm và các giá trị trùng lặp. Thuật toán duy trì tính ổn định và sắp xếp chính xác trong O(N log N).',
    },
  ];
};

export interface CompilerOption {
  id: string;
  name: string;
  compiler: string;
  badge: string;
  ext: string;
  icon: string;
  cmd: string;
}

export const COMPILER_OPTIONS: CompilerOption[] = [
  {
    id: 'auto',
    name: 'Tự động nhận diện',
    compiler: 'Auto-detect theo file (.zip)',
    badge: 'Khuyên dùng',
    ext: '.zip',
    icon: '⚡',
    cmd: 'Tự động quét cấu trúc và phần mở rộng mã nguồn',
  },
  {
    id: 'java',
    name: 'Java (OpenJDK 17)',
    compiler: 'Eclipse Temurin JDK 17',
    badge: 'javac 17',
    ext: '.java',
    icon: '☕',
    cmd: 'javac -J-Xmx256m → java -Xmx256m',
  },
  {
    id: 'cpp',
    name: 'C++17 (GCC 13)',
    compiler: 'GNU C++17 Compiler (g++)',
    badge: 'g++ 13',
    ext: '.cpp, .cc',
    icon: '⚡',
    cmd: 'g++ -O2 -std=c++17 -Wall',
  },
  {
    id: 'python',
    name: 'Python (CPython 3.11)',
    compiler: 'Python 3.11-slim runtime',
    badge: 'python 3.11',
    ext: '.py',
    icon: '🐍',
    cmd: 'python3 -u solution.py',
  },
  {
    id: 'dotnet',
    name: 'C# / .NET (.NET 8.0 SDK)',
    compiler: 'Microsoft .NET 8.0 SDK',
    badge: 'dotnet 8',
    ext: '.cs',
    icon: '🔷',
    cmd: 'dotnet build / run (C# 12)',
  },
  {
    id: 'c',
    name: 'C11 (GCC 13)',
    compiler: 'GNU C Compiler (gcc)',
    badge: 'gcc 13',
    ext: '.c',
    icon: '🔧',
    cmd: 'gcc -O2 -std=c11 -Wall',
  },
];

export const SubmissionView: React.FC<SubmissionViewProps> = ({
  task,
  studentId = 'SE170000',
  studentName = 'Sinh Viên',
  enrolledCourses = [],
  selectedCourseId = 'ALL',
  onSelectCourse,
  apiBaseUrl = API_BASE_URL,
  onOpenAppeal,
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
  // Tab chi tiết thông tin bài tập (Đề bài, Testcase mẫu, Barem điểm, Hướng dẫn nộp)
  const [activeDetailTab, setActiveDetailTab] = useState<'SPEC' | 'SAMPLES' | 'RUBRICS' | 'GUIDE'>('SPEC');
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  const handleCopyCode = (text: string, label: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedSnippet(label);
      setTimeout(() => setCopiedSnippet(null), 2000);
    } catch (e) {
      console.warn('Copy failed', e);
    }
  };
  // Đồng bộ môn học đang chọn từ thanh điều hướng môn học bên ngoài
  useEffect(() => {
    if (!selectedCourseId || selectedCourseId === 'ALL') {
      setSelectedCourseFilter('ALL');
    } else {
      const normalized = selectedCourseId.replace(/^(CRS|COURSE)-/i, '').trim().toUpperCase();
      setSelectedCourseFilter(normalized);
    }
  }, [selectedCourseId]);


  // Lịch sử nộp bài của sinh viên
  const [submissionHistory, setSubmissionHistory] = useState<Record<string, StudentSubmissionRecord>>({});
  // Modal xem chi tiet bai nop & Danh gia AI
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedDetailSubmission, setSelectedDetailSubmission] = useState<SubmissionDetailData | null>(null);
  const [taskSubmissions, setTaskSubmissions] = useState<any[]>([]);

  const handleOpenDetailModal = (record: StudentSubmissionRecord | any) => {
    setSelectedDetailSubmission({
      submissionId: record.submissionId || 'SUB-LATEST',
      studentId: record.studentId || studentId,
      studentName: studentName,
      assignmentId: selectedTask?.id,
      assignmentTitle: selectedTask?.title,
      fileName: record.fileName || 'Solution.zip',
      language: record.language || 'java',
      submittedAt: record.submittedAt || record.createdAt || new Date().toISOString(),
      score: record.score ?? record.details?.score,
      scoreBreakdown: record.scoreBreakdown || record.details?.scoreBreakdown,
      passedTestcases: record.passedTestcases ?? record.details?.passedTestcases ?? 0,
      totalTestcases: Math.max(
        record.totalTestcases ?? record.details?.totalTestcases ?? 0,
        selectedTask?.testCasesCount ?? 0,
      ),
      testCaseResults: record.testcaseResults ?? record.details?.testcaseResults,
      executionTimeMs: record.executionTimeMs ?? record.details?.executionTimeMs ?? 185,
      sha256: record.sha256 || record.sha256Hash,
      sourceCode: record.sourceCode || record.details?.sourceCode,
      aiRating: record.aiRating || record.details?.aiRating,
    });
    setDetailModalOpen(true);
  };

  // Nạp testcase mẫu từ PostgreSQL cho bài tập nếu có
  useEffect(() => {
    if (!selectedTask || (selectedTask.sampleTestCases && selectedTask.sampleTestCases.length > 0)) return;
    const fetchSampleCases = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/api/v1/test-cases/assignment/${encodeURIComponent(selectedTask.id)}`);
        if (res.ok) {
          const json = await res.json();
          const list = json.data || json || [];
          if (Array.isArray(list) && list.length > 0) {
            const publicCases = list.filter((tc: any) => !tc.isHidden && tc.expectedOutput !== null);
            if (publicCases.length > 0) {
              const samples: SampleTestCase[] = publicCases.map((tc: any, idx: number) => ({
                name: `Testcase Mẫu ${idx + 1} (Công Khai)`,
                input: tc.inputData,
                expectedOutput: tc.expectedOutput,
                explanation: `Trọng số: ${tc.weight || 1.0}đ. Giới hạn thời gian: ${tc.timeLimitMs || 2000}ms.`,
              }));
              setSelectedTask((prev) => (prev && prev.id === selectedTask.id ? { ...prev, sampleTestCases: samples } : prev));
            }
          }
        }
      } catch {
        // ignore
      }
    };
    void fetchSampleCases();
  }, [selectedTask?.id, apiBaseUrl]);

  useEffect(() => {
    if (!selectedTask) return;
    const fetchTaskSubmissions = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/api/v1/submissions?assignmentId=${encodeURIComponent(selectedTask.id)}&studentId=${encodeURIComponent(studentId)}`);
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.data) && json.data.length > 0) {
            setTaskSubmissions(json.data);
          }
        }
      } catch (err) {
        // ignore
      }
    };
    void fetchTaskSubmissions();
  }, [selectedTask, studentId, apiBaseUrl]);

  // Trạng thái nộp file
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sha256Checksum, setSha256Checksum] = useState<string | null>(null);
  const [isHashing, setIsHashing] = useState(false);
  const [exceptionType, setExceptionType] = useState<"OVERSIZE" | "EXPIRED" | null>(null);
  const [isDeadlineSimulatedExpired, setIsDeadlineSimulatedExpired] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('auto');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Tải danh sách bài tập trực tiếp từ PostgreSQL 15 (Single Source of Truth - 100% Database)
  const fetchBackendAssignments = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/assignments`);
      if (res.ok) {
        const json = await res.json();
        const serverAsms = json.data || json || [];
        if (Array.isArray(serverAsms) && serverAsms.length > 0) {
          const mapped: StudentTaskItem[] = serverAsms.map((sa: any) => {
            const matchedTemplate = defaultAssignmentPool.find(
              (t) => t.id === sa.assignmentId || t.title.toLowerCase().trim() === (sa.title || '').toLowerCase().trim()
            );
            const courseCode = (sa.courseId || '').replace('CRS-', '').replace('COURSE-', '') || 'PRF192';

            return {
              id: sa.assignmentId,
              courseId: sa.courseId,
              courseCode: courseCode,
              course: `${courseCode} - Bài Tập Chuẩn Hóa`,
              title: sa.title,
              description: sa.description || '',
              deadline: typeof sa.deadline === 'string'
                ? (sa.deadline.includes('T') ? sa.deadline : `${sa.deadline}T23:59:00`)
                : new Date(Date.now() + 7 * 86400000).toISOString(),
              timeLimitMs: sa.timeLimitMs || matchedTemplate?.timeLimitMs || 2000,
              memoryLimitMb: sa.memoryLimitMb || matchedTemplate?.memoryLimitMb || 512,
              allowedLanguages: sa.allowedLanguages || matchedTemplate?.allowedLanguages || ['java', 'python', 'cpp'],
              allowedExtensions: ['.zip'],
              maxSizeMb: 10,
              testCasesCount: sa.testcasesCount || (matchedTemplate?.testCasesCount || 5),
              rubrics: matchedTemplate?.rubrics,
              technicalRequirements: matchedTemplate?.technicalRequirements,
              sampleTestCases: matchedTemplate?.sampleTestCases,
              status: sa.isActive ? 'PUBLISHED' : 'CLOSED',
            };
          });

          setAssignmentList(mapped);

          if (task) {
            const matched = mapped.find((t: StudentTaskItem) => t.id === task.id);
            setSelectedTask(matched || { ...task, allowedExtensions: ['.zip'], maxSizeMb: 10 });
          }
          return;
        }
      }
    } catch (e) {
      console.warn('[SubmissionView] Lỗi đọc bài tập từ PostgreSQL, dùng template dự phòng:', e);
    }

    setAssignmentList([...defaultAssignmentPool]);
    if (task) {
      const matched = defaultAssignmentPool.find((t: StudentTaskItem) => t.id === task.id);
      setSelectedTask(matched || { ...task, allowedExtensions: ['.zip'], maxSizeMb: 10 });
    }
  };

  // 2. Tải lịch sử nộp bài của sinh viên trực tiếp từ PostgreSQL 15 (Single Source of Truth)
  const fetchStudentSubmissions = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/submissions?studentId=${encodeURIComponent(studentId)}`);
      if (res.ok) {
        const json = await res.json();
        const list = json.data || json || [];
        if (Array.isArray(list)) {
          const historyMap: Record<string, StudentSubmissionRecord> = {};
          list.forEach((sub: any) => {
            const existing = historyMap[sub.assignmentId];
            if (!existing || new Date(sub.createdAt) > new Date(existing.submittedAt)) {
              historyMap[sub.assignmentId] = {
                assignmentId: sub.assignmentId,
                submissionId: sub.submissionId,
                submittedAt: sub.createdAt,
                fileName: sub.fileName || 'Solution.zip',
                fileSizeMb: sub.fileSizeBytes ? Number((sub.fileSizeBytes / (1024 * 1024)).toFixed(2)) : 0.05,
                sha256: sub.sha256Hash,
                status: sub.status,
                score: sub.score,
              };
            }
          });
          setSubmissionHistory(historyMap);
        }
      }
    } catch (e) {
      console.warn('[SubmissionView] Lỗi đọc lịch sử nộp bài từ PostgreSQL:', e);
    }
  };

  const handleRefreshAll = () => {
    void fetchBackendAssignments();
    void fetchStudentSubmissions();
  };

  useEffect(() => {
    void fetchBackendAssignments();
    void fetchStudentSubmissions();

    const handleSync = () => {
      void fetchBackendAssignments();
      void fetchStudentSubmissions();
    };

    window.addEventListener('aita_assignment_changed', handleSync);
    window.addEventListener('aita_submission_completed', handleSync);

    return () => {
      window.removeEventListener('aita_assignment_changed', handleSync);
      window.removeEventListener('aita_submission_completed', handleSync);
    };
  }, [studentId, apiBaseUrl]);

  // Tính toán thời gian còn lại và độ khẩn cấp của Deadline
  const getDeadlineMetadata = (deadlineStr: string) => {
    const diff = +new Date(deadlineStr) - +new Date();
    if (diff <= 0) {
      return {
        status: 'EXPIRED',
        color: 'var(--text-main)',
        bgColor: 'rgba(11, 18, 32, 0.06)',
        borderColor: 'rgba(11, 18, 32, 0.13)',
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
        color: 'var(--text-main)',
        bgColor: 'rgba(11, 18, 32, 0.08)',
        borderColor: 'rgba(11, 18, 32, 0.189)',
        label: `Gấp: Còn ${hours}h ${minutes}m`,
        isUrgent: true,
        diffHours: hours,
      };
    }

    if (diff < 3 * 24 * 60 * 60 * 1000) {
      // Dưới 3 ngày: Sắp hết hạn (Vàng cam)
      return {
        status: 'ENDING_SOON',
        color: 'var(--blue-200)',
        bgColor: 'rgba(37, 99, 235, 0.1)',
        borderColor: 'rgba(37, 99, 235, 0.2)',
        label: `Sắp đến hạn: Còn ${days}d ${hours}h`,
        isUrgent: true,
        diffHours: days * 24 + hours,
      };
    }

    // Trên 3 ngày: Bình thường (Xanh ngọc)
    return {
      status: 'ACTIVE',
      color: 'var(--blue-300)',
      bgColor: 'rgba(37, 99, 235, 0.09)',
      borderColor: 'rgba(37, 99, 235, 0.16)',
      label: `Còn ${days} ngày ${hours}h`,
      isUrgent: false,
      diffHours: days * 24 + hours,
    };
  };

  const normalizeCourseCode = (val?: string) => {
    if (!val) return '';
    return val.replace(/^(CRS|COURSE)-/i, '').trim().toUpperCase();
  };

  // Lấy danh sách các môn học để đưa vào bộ lọc (kết hợp cả lớp đã ghi danh và lớp có bài tập)
  const courseOptions = useMemo(() => {
    const set = new Set<string>();
    if (enrolledCourses && enrolledCourses.length > 0) {
      enrolledCourses.forEach((c) => {
        const code = normalizeCourseCode(c.courseCode || c.courseId);
        if (code) set.add(code);
      });
    }
    assignmentList.forEach((a) => {
      const rawCode = a.courseCode || (a.course ? a.course.split(' - ')[0] : '') || a.courseId;
      const code = normalizeCourseCode(rawCode);
      if (code) set.add(code);
    });
    return Array.from(set).sort();
  }, [enrolledCourses, assignmentList]);

  // Lọc bài tập theo tìm kiếm, môn học và trạng thái
  const filteredAssignments = useMemo(() => {
    return assignmentList.filter((item) => {
      const itemCode = normalizeCourseCode(item.courseCode || item.courseId || (item.course ? item.course.split(' - ')[0] : ''));

      // 1. Lọc theo môn học đang chọn (SO SÁNH CHÍNH XÁC 100%)
      if (selectedCourseFilter !== 'ALL') {
        const filterCode = normalizeCourseCode(selectedCourseFilter);
        if (itemCode !== filterCode) {
          return false;
        }
      }

      // 2. Tìm kiếm từ khóa
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchSearch =
          (item.title || '').toLowerCase().includes(query) ||
          (item.course || '').toLowerCase().includes(query) ||
          itemCode.toLowerCase().includes(query) ||
          (item.id || '').toLowerCase().includes(query);
        if (!matchSearch) return false;
      }

      // 3. Trạng thái deadline
      const meta = getDeadlineMetadata(item.deadline);
      const isSubmitted = !!submissionHistory[item.id];

      if (statusFilter === 'SUBMITTED' && !isSubmitted) return false;
      if (statusFilter === 'PENDING' && isSubmitted) return false;
      if (statusFilter === 'URGENT' && (!meta.isUrgent || isSubmitted)) return false;

      return true;
    });
  }, [assignmentList, selectedCourseFilter, searchQuery, statusFilter, submissionHistory]);

  // Thống kê nhanh
  const stats = useMemo(() => {
    let relevant = assignmentList;
    if (selectedCourseFilter !== 'ALL') {
      const filterCode = normalizeCourseCode(selectedCourseFilter);
      relevant = assignmentList.filter((a) => {
        const itemCode = normalizeCourseCode(a.courseCode || a.courseId || (a.course ? a.course.split(' - ')[0] : ''));
        return itemCode === filterCode;
      });
    }


    let total = relevant.length;
    let submitted = 0;
    let urgent = 0;

    relevant.forEach((a) => {
      if (submissionHistory[a.id]) {
        submitted++;
      } else {
        const meta = getDeadlineMetadata(a.deadline);
        if (meta.isUrgent) urgent++;
      }
    });

    return {
      total,
      pending: Math.max(0, total - submitted),
      urgent,
      submitted,
    };
  }, [assignmentList, selectedCourseFilter, submissionHistory]);

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
      setErrorMessage(`Đã quá hạn chót nộp bài (${new Date(currentTask.deadline).toLocaleString('vi-VN')})! Cổng nộp đã tự động đóng.`);
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
        'Cổng nộp bài đã đóng do quá hạn chót Deadline. Không cho phép nộp bổ sung nhằm bảo toàn tính toàn vẹn học thuật.',
      );
      setExceptionType('EXPIRED');
    } else {
      setErrorMessage(null);
      setExceptionType(null);
    }
  };

  const handleSubmit = async () => {
    if (isExpired) {
      setErrorMessage('Không thể nộp bài do đã quá hạn chót!');
      return;
    }
    const currentTask = selectedTask || task;
    if (selectedFile && currentTask) {
      if (selectedTask?.configuredTestCases) {
        try {
          await verifyAssignmentTestCases({
            id: selectedTask.id,
            courseId: selectedTask.courseId || '',
            title: selectedTask.title,
            description: selectedTask.description,
            deadline: selectedTask.deadline,
            timeLimitMs: selectedTask.timeLimitMs || 2000,
            memoryLimitMb: selectedTask.memoryLimitMb || 512,
            allowedLanguages: selectedTask.allowedLanguages || ['java', 'python', 'cpp'],
            testCases: selectedTask.configuredTestCases,
          });
        } catch (error) {
          setErrorMessage(
            error instanceof Error
              ? `Không thể đồng bộ đủ testcase lên máy chủ nên chưa gửi bài: ${error.message}`
              : 'Không thể đồng bộ đủ testcase lên máy chủ nên chưa gửi bài.',
          );
          return;
        }
      }

      // Lưu lại thông tin nộp bài tạm thời
      const newRecord: StudentSubmissionRecord = {
        assignmentId: currentTask.id,
        submittedAt: new Date().toISOString(),
        fileName: selectedFile.name,
        fileSizeMb: Number((selectedFile.size / (1024 * 1024)).toFixed(2)),
        sha256: sha256Checksum || undefined,
        language: selectedLanguage !== 'auto' ? selectedLanguage : undefined,
        status: 'QUEUED',
      };

      const updated = { ...submissionHistory, [currentTask.id]: newRecord };
      setSubmissionHistory(updated);
// Lưu trữ trực tiếp lên PostgreSQL thông qua API Gateway





      onSubmit(selectedFile, currentTask, selectedLanguage);
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
              border: '1px solid rgba(11, 18, 32, 0.08)',
              backgroundColor: 'rgba(11, 18, 32, 0.035)',
              color: '#0b1220',
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
            backgroundColor: 'rgba(37, 99, 235, 0.07)',
            border: '1px solid rgba(37, 99, 235, 0.14)',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e40af', fontSize: '13px', fontWeight: 700 }}>
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
                backgroundColor: exceptionType === 'OVERSIZE' ? 'rgba(11, 18, 32, 0.1)' : 'rgba(11, 18, 32, 0.05)',
                border: '1px solid rgba(11, 18, 32, 0.13)',
                color: 'var(--text-main)',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              Demo File &gt; 10MB
            </button>
            <button
              type="button"
              onClick={toggleDemoExpired}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                backgroundColor: isDeadlineSimulatedExpired ? 'rgba(11, 18, 32, 0.1)' : 'rgba(11, 18, 32, 0.05)',
                border: '1px solid rgba(11, 18, 32, 0.13)',
                color: 'var(--text-main)',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              {isDeadlineSimulatedExpired ? <RefreshCw size={12} /> : <Lock size={12} />}
              {isDeadlineSimulatedExpired ? 'Khôi phục Deadline' : 'Demo Quá Deadline'}
            </button>
          </div>
        </div>

        {/* Khung Thông Tin Bài Tập & Đếm Ngược Deadline */}
        <div className="glass-panel" style={{ padding: '24px', marginBottom: '20px' }}>
          {/* Hàng 1: Tiêu Đề, Mã Môn & Đồng Hồ Đếm Ngược */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '18px' }}>
            <div style={{ flex: 1, minWidth: '300px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '9px', flexWrap: 'wrap' }}>
                <span className="chip chip-blue chip-mono" style={{ textTransform: 'uppercase' }}>
                  {selectedTask.courseCode || 'PRO192'}
                </span>
                <span style={{ fontSize: '11.5px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                  {selectedTask.id}
                </span>
                <span className={`chip ${submissionHistory[selectedTask.id] ? 'chip-blue' : 'chip-outline'}`}>
                  {submissionHistory[selectedTask.id] ? 'Đã nộp bài' : 'Chưa nộp'}
                </span>
              </div>

              <h1 style={{ fontSize: '21px', fontWeight: 600, color: 'var(--text-main)', lineHeight: 1.35, letterSpacing: '-0.02em', marginBottom: '10px' }}>
                {selectedTask.title}
              </h1>

              <div style={{ marginBottom: '14px' }}>
                <AssignmentDescriptionView
                  mode="HEADER_COMPACT"
                  description={selectedTask.description}
                  title={selectedTask.title}
                  timeLimitMs={selectedTask.timeLimitMs}
                  memoryLimitMb={selectedTask.memoryLimitMb}
                  courseCode={selectedTask.courseCode}
                  testCasesCount={selectedTask.testCasesCount}
                  allowedLanguages={selectedTask.allowedLanguages}
                />
              </div>
            </div>

            {/* Đồng hồ đếm ngược thời gian thực */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', minWidth: '220px' }}>
              <CountdownTimer deadline={isDeadlineSimulatedExpired ? new Date(Date.now() - 3600000).toISOString() : selectedTask.deadline} />
              <div style={{ fontSize: '11.5px', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Clock size={12} color="var(--blue-400)" />
                <span>Hạn nộp: <strong style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{new Date(selectedTask.deadline).toLocaleString('vi-VN')}</strong></span>
              </div>
            </div>
          </div>

          {/* Hàng 2: 4 Thông Số Kỹ Thuật Sandbox */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: '0',
              padding: '0',
              borderRadius: '10px',
              backgroundColor: 'rgba(11, 18, 32, 0.02)',
              border: '1px solid var(--border-color)',
              marginBottom: '18px',
              overflow: 'hidden',
            }}
          >
            {[
              { icon: Cpu, label: 'CPU time limit', value: `${selectedTask.timeLimitMs || 2000} ms` },
              { icon: HardDrive, label: 'RAM sandbox', value: `${selectedTask.memoryLimitMb || 512} MB` },
              { icon: Code, label: 'Ngôn ngữ', value: (selectedTask.allowedLanguages || ['java', 'python', 'cpp']).join(', ').toUpperCase() },
              { icon: Layers, label: 'Bộ testcase', value: `${selectedTask.testCasesCount || 5} test` },
            ].map((metric, i) => {
              const Icon = metric.icon;
              return (
                <div
                  key={metric.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px 15px',
                    borderLeft: i === 0 ? 'none' : '1px solid var(--border-soft)',
                  }}
                >
                  <Icon size={15} color="var(--text-dim)" strokeWidth={2} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '10.5px', color: 'var(--text-dim)', letterSpacing: '0.03em' }}>{metric.label}</div>
                    <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-soft)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {metric.value}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Hàng 3: THANH ĐIỀU HƯỚNG TAB CHI TIẾT (4 TABS) */}
          <div
            style={{
              display: 'flex',
              gap: '8px',
              borderBottom: '1px solid rgba(11, 18, 32, 0.06)',
              paddingBottom: '12px',
              marginBottom: '20px',
              overflowX: 'auto',
            }}
          >
            {[
              { key: 'SPEC', label: 'Đề bài & yêu cầu', icon: <FileText size={14} /> },
              { key: 'SAMPLES', label: 'Testcase mẫu', icon: <Code size={14} />, badge: `${getEffectiveSampleTestCases(selectedTask).length}` },
              { key: 'RUBRICS', label: 'Barem điểm', icon: <Award size={14} />, badge: '10đ' },
              { key: 'GUIDE', label: 'Cấu trúc file', icon: <Layers size={14} /> },
            ].map((tab) => {
              const active = activeDetailTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveDetailTab(tab.key as any)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    padding: '7px 12px',
                    borderRadius: '7px',
                    border: active ? '1px solid var(--border-highlight)' : '1px solid transparent',
                    backgroundColor: active ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                    color: active ? 'var(--text-main)' : 'var(--text-muted)',
                    fontSize: '12.5px',
                    fontWeight: active ? 600 : 500,
                    cursor: 'pointer',
                    transition: 'color .15s ease, background-color .15s ease, border-color .15s ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        backgroundColor: active ? 'rgba(59, 130, 246, 0.25)' : 'rgba(11, 18, 32, 0.05)',
                        color: active ? 'var(--blue-200)' : 'var(--text-dim)',
                        fontWeight: 600,
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Hàng 4: NỘI DUNG TỪNG TAB CHI TIẾT */}
          {(() => {
            const req = getEffectiveRequirements(selectedTask);
            const samples = getEffectiveSampleTestCases(selectedTask);

            if (activeDetailTab === 'SPEC') {
              return (
                <AssignmentDescriptionView
                  mode="FULL_SPEC"
                  description={selectedTask.description}
                  title={selectedTask.title}
                  timeLimitMs={selectedTask.timeLimitMs}
                  memoryLimitMb={selectedTask.memoryLimitMb}
                  courseCode={selectedTask.courseCode}
                  testCasesCount={selectedTask.testCasesCount}
                  allowedLanguages={selectedTask.allowedLanguages}
                />
              );
            }

            if (activeDetailTab === 'SAMPLES') {
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    Dưới đây là các bộ dữ liệu kiểm thử mẫu giúp bạn chạy thử nghiệm trên máy cục bộ trước khi đóng gói nộp bài. Bấm nút <strong>Sao chép</strong> để dán nhanh vào môi trường IDE.
                  </div>

                  {samples.map((tc, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '18px',
                        borderRadius: '12px',
                        backgroundColor: '#f7f9fc',
                        border: '1px solid rgba(11, 18, 32, 0.06)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)', fontWeight: 700, fontSize: '14px' }}>
                          <Code size={16} color="var(--accent-cyan)" />
                          <span>{tc.name}</span>
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', backgroundColor: 'rgba(11, 18, 32, 0.05)', padding: '2px 8px', borderRadius: '4px' }}>
                          Mẫu #{idx + 1}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                        {/* Đầu vào mẫu */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--blue-300)' }}>ĐẦU VÀO (STDIN):</span>
                            <button
                              type="button"
                              onClick={() => handleCopyCode(tc.input, `input-${idx}`)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '11px',
                                color: '#0b1220',
                                backgroundColor: 'rgba(11, 18, 32, 0.05)',
                                border: 'none',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                              }}
                            >
                              {copiedSnippet === `input-${idx}` ? <Check size={11} color="#1d4ed8" /> : <Copy size={11} />}
                              <span>{copiedSnippet === `input-${idx}` ? 'Đã chép!' : 'Sao chép'}</span>
                            </button>
                          </div>
                          <pre
                            style={{
                              margin: 0,
                              padding: '12px',
                              borderRadius: '8px',
                              backgroundColor: '#fbfcfe',
                              border: '1px solid rgba(11, 18, 32, 0.06)',
                              color: 'var(--text-main)',
                              fontSize: '12.5px',
                              fontFamily: 'Consolas, Monaco, monospace',
                              whiteSpace: 'pre-wrap',
                              overflowX: 'auto',
                            }}
                          >
                            {tc.input}
                          </pre>
                        </div>

                        {/* Đầu ra mong đợi */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--blue-200)' }}>ĐẦU RA MONG ĐỢI (STDOUT):</span>
                            <button
                              type="button"
                              onClick={() => handleCopyCode(tc.expectedOutput, `output-${idx}`)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '11px',
                                color: '#0b1220',
                                backgroundColor: 'rgba(11, 18, 32, 0.05)',
                                border: 'none',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                              }}
                            >
                              {copiedSnippet === `output-${idx}` ? <Check size={11} color="#1d4ed8" /> : <Copy size={11} />}
                              <span>{copiedSnippet === `output-${idx}` ? 'Đã chép!' : 'Sao chép'}</span>
                            </button>
                          </div>
                          <pre
                            style={{
                              margin: 0,
                              padding: '12px',
                              borderRadius: '8px',
                              backgroundColor: '#fbfcfe',
                              border: '1px solid rgba(37, 99, 235, 0.12)',
                              color: 'var(--blue-200)',
                              fontSize: '12.5px',
                              fontFamily: 'Consolas, Monaco, monospace',
                              whiteSpace: 'pre-wrap',
                              overflowX: 'auto',
                            }}
                          >
                            {tc.expectedOutput}
                          </pre>
                        </div>
                      </div>

                      {/* Giải thích logic */}
                      <div
                        style={{
                          padding: '10px 14px',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(11, 18, 32, 0.03)',
                          fontSize: '12.5px',
                          color: '#33415a',
                          lineHeight: '1.5',
                        }}
                      >
                        <strong style={{ color: '#1e40af' }}>Giải thích bước chạy: </strong>
                        {tc.explanation}
                      </div>
                    </div>
                  ))}
                  {samples.length === 0 && (
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      Đề bài hiện không có testcase công khai. Các testcase ẩn không được hiển thị ở đây.
                    </div>
                  )}
                </div>
              );
            }

            if (activeDetailTab === 'RUBRICS') {
              const rubrics = selectedTask.rubrics && selectedTask.rubrics.length > 0
                ? selectedTask.rubrics
                : [
                    { criterion: 'Tính đúng đắn thuật toán & Vượt qua 100% Testcases', maxScore: 5.0, description: 'Vượt qua toàn bộ bộ testcases cơ sở và testcases dữ liệu lớn (TLE check)' },
                    { criterion: 'Thiết kế Hướng đối tượng & SOLID (SRP, DIP)', maxScore: 2.5, description: 'Tách riêng bộ xử lý nghiệp vụ khỏi I/O, sử dụng interface ISorter' },
                    { criterion: 'Tối ưu độ phức tạp O(N log N) & Clean Code', maxScore: 1.5, description: 'Mã nguồn tường minh, đặt tên chuẩn CamelCase, tối ưu thời gian CPU < 2000ms' },
                    { criterion: 'Liêm chính học thuật & AST Winnowing', maxScore: 1.0, description: 'Mã nguồn độc lập, mức độ tương đồng AST với sinh viên khác dưới 25%' },
                  ];

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    Hệ thống AITA sử dụng quy trình chấm điểm 2 tầng: Tầng 1 thực thi testcases trong Docker Sandbox cô lập, Tầng 2 phân tích cây cú pháp trừu tượng AST bằng mô hình GenAI để đánh giá tính tuân thủ nguyên lý SOLID và liêm chính học thuật.
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                    {rubrics.map((r, i) => (
                      <div
                        key={i}
                        style={{
                          padding: '16px',
                          borderRadius: '12px',
                          backgroundColor: 'rgba(11, 18, 32, 0.025)',
                          border: '1px solid rgba(11, 18, 32, 0.05)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '10px',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>{r.criterion}</span>
                            <span
                              style={{
                                fontSize: '13px',
                                fontWeight: 600,
                                padding: '2px 8px',
                                borderRadius: '6px',
                                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                                color: 'var(--accent-emerald)',
                                border: '1px solid rgba(37, 99, 235, 0.18)',
                              }}
                            >
                              +{r.maxScore}đ
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>{r.description}</div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--blue-200)' }}>
                          <CheckCircle size={12} /> Tự động đánh giá bởi AITA Autograding Engine
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Thông tin Liêm chính học thuật */}
                  <div
                    style={{
                      padding: '14px 18px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(37, 99, 235, 0.06)',
                      border: '1px solid rgba(37, 99, 235, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    <ShieldCheck size={24} color="#1d4ed8" />
                    <div style={{ fontSize: '12.5px', color: '#33415a', lineHeight: '1.5' }}>
                      <strong style={{ color: 'var(--text-main)' }}>Giám sát Liêm chính học thuật AST: </strong>
                      Mọi bài nộp sẽ được tạo chữ ký k-gram thông qua giải thuật Winnowing AST. Nếu độ tương đồng từ 80% trở lên, bài nộp sẽ bị tự động đánh dấu vi phạm đạo văn (điểm 0) và chuyển tới hội đồng giảng viên xem xét.
                    </div>
                  </div>
                </div>
              );
            }

            if (activeDetailTab === 'GUIDE') {
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px' }}>
                    {/* Hướng dẫn cấu trúc thư mục .zip */}
                    <div
                      style={{
                        padding: '18px',
                        borderRadius: '12px',
                        backgroundColor: 'rgba(11, 18, 32, 0.025)',
                        border: '1px solid rgba(11, 18, 32, 0.05)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--blue-300)', fontSize: '13.5px', fontWeight: 700, marginBottom: '10px' }}>
                        <FileArchive size={16} /> Cấu Trúc File Nén .ZIP Hợp Lệ
                      </div>
                      <p style={{ fontSize: '12.5px', color: '#33415a', marginBottom: '10px' }}>
                        Nén trực tiếp các file mã nguồn vào thư mục gốc của tệp <code>.zip</code>:
                      </p>
                      <pre
                        style={{
                          margin: 0,
                          padding: '12px',
                          borderRadius: '8px',
                          backgroundColor: '#fbfcfe',
                          border: '1px solid rgba(11, 18, 32, 0.06)',
                          color: 'var(--text-main)',
                          fontSize: '12px',
                          fontFamily: 'Consolas, Monaco, monospace',
                          lineHeight: '1.6',
                        }}
                      >
{`solution.zip
├── Solution.java (hoặc Main.java / main.py / main.cpp)
├── OrderSorter.java (nếu tách class SRP)
└── ISorter.java (nếu áp dụng DIP)`}
                      </pre>
                    </div>

                    {/* Ràng buộc Sandbox */}
                    <div
                      style={{
                        padding: '18px',
                        borderRadius: '12px',
                        backgroundColor: 'rgba(11, 18, 32, 0.025)',
                        border: '1px solid rgba(11, 18, 32, 0.05)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e40af', fontSize: '13.5px', fontWeight: 700, marginBottom: '10px' }}>
                        <Lock size={16} /> Quy Định An Toàn Docker Sandbox
                      </div>
                      <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12.5px', color: '#33415a', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <li>File nén chỉ chứa mã nguồn (.java, .py, .cpp, .cs). Không đính kèm file .class, .exe hoặc file rác.</li>
                        <li>Dung lượng file tối đa: <strong>10 MB</strong>. Vượt quá sẽ bị chặn theo quy định của hệ thống.</li>
                        <li>Nghiêm cấm: Gọi <code>System.exit()</code>, mở kết nối mạng Socket/HTTP, truy xuất file hệ thống.</li>
                        <li>Thời hạn nộp bài: Sau khi hết thời gian đếm ngược, cổng nộp bài tự động khóa tự động đóng.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              );
            }

            return null;
          })()}
        </div>

        {/* Thông báo nếu đã có bài nộp trước đó */}
        {/* KHOI LICH SU BAI NOP & XEM CHI TIET DANH GIA (CODE, TESTCASES, SOLID, AI) */}
        {(prevSubmission || taskSubmissions.length > 0) && (
          <div
            className="glass-panel"
            style={{
              padding: '22px 26px',
              borderRadius: '12px',
              backgroundColor: '#f7f9fc',
              border: '1px solid rgba(59, 130, 246, 0.24)',
              marginBottom: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxShadow: '0 8px 24px rgba(11, 18, 32, 0.05)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    backgroundColor: ((prevSubmission?.score ?? taskSubmissions[0]?.score ?? 0) >= 5) ? 'rgba(37, 99, 235, 0.08)' : 'rgba(11, 18, 32, 0.06)',
                    border: `1px solid ${((prevSubmission?.score ?? taskSubmissions[0]?.score ?? 0) >= 5) ? 'rgba(37, 99, 235, 0.16)' : 'rgba(11, 18, 32, 0.108)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CheckCircle size={22} color="#2563eb" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)' }}>
                      Lịch Sử Bài Nộp Gần Nhất Của Bạn
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '3px 10px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(37, 99, 235, 0.1)',
                        color: 'var(--blue-200)',
                        border: '1px solid rgba(37, 99, 235, 0.18)',
                      }}
                    >
                      ĐÃ CHẤM: {((prevSubmission?.score ?? taskSubmissions[0]?.score ?? 0)).toFixed(1)} / 10.0
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#4d5c76', marginTop: '3px' }}>
                    File: <strong style={{ color: 'var(--text-main)' }}>{prevSubmission?.fileName || taskSubmissions[0]?.fileName || 'Solution.zip'}</strong> • Nộp lúc: {new Date(prevSubmission?.submittedAt || taskSubmissions[0]?.createdAt || Date.now()).toLocaleString('vi-VN')}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => handleOpenDetailModal(taskSubmissions[0] || prevSubmission)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 20px',
                    borderRadius: '10px',
                    background: 'var(--blue-600)',
                    border: 'none',
                    color: 'var(--on-blue)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.35)',
                    transition: 'all 0.15s ease',
                  }}
                  title="Xem chi tiet ma nguon da nop, diem testcase, SOLID va nhan xet AI"
                >
                  <Sparkles size={16} /> Xem chi tiết (Code, Testcases & AI)
                </button>
              </div>
            </div>

            {/* Badges chi tiet cac thang diem */}
            <div
              style={{
                display: 'flex',
                gap: '10px',
                flexWrap: 'wrap',
                paddingTop: '12px',
                borderTop: '1px solid rgba(11, 18, 32, 0.05)',
              }}
            >
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  padding: '6px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(37, 99, 235, 0.08)',
                  color: 'var(--blue-200)',
                  border: '1px solid rgba(37, 99, 235, 0.12)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <CheckCircle size={14} /> Testcases: {(() => {
                  const p = prevSubmission?.passedTestcases ?? taskSubmissions[0]?.details?.passedTestcases;
                  const t = Math.max(
                    prevSubmission?.totalTestcases ?? 0,
                    taskSubmissions[0]?.details?.totalTestcases ?? 0,
                    selectedTask.testCasesCount ?? 0,
                  );
                  return p !== undefined && t > 0 ? `${p}/${t} Passed` : 'Đang chấm...';
                })()}
              </span>

              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  padding: '6px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(37, 99, 235, 0.08)',
                  color: 'var(--blue-200)',
                  border: '1px solid rgba(37, 99, 235, 0.12)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <Sparkles size={14} /> Clean Code: {(() => {
                  const c = prevSubmission?.aiRating?.cleanCodeScore ?? taskSubmissions[0]?.details?.aiRating?.cleanCodeScore;
                  return c !== undefined ? `${c} / 10.0` : '—';
                })()}
              </span>

              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  padding: '6px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(59, 130, 246, 0.09)',
                  color: '#1e40af',
                  border: '1px solid rgba(59, 130, 246, 0.16)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <Award size={14} /> Kiến Trúc SOLID: {(() => {
                  const ar = prevSubmission?.aiRating ?? taskSubmissions[0]?.details?.aiRating;
                  return ar?.solidScore
                    ? `${((ar.solidScore.s + ar.solidScore.o + ar.solidScore.l + ar.solidScore.i + ar.solidScore.d) / 5).toFixed(1)} / 10.0`
                    : '—';
                })()}
              </span>

              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: '6px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(11, 18, 32, 0.035)',
                  color: '#4d5c76',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <Clock size={14} /> Sandbox: {(() => {
                  const ms = prevSubmission?.executionTimeMs ?? taskSubmissions[0]?.details?.executionTimeMs;
                  return ms !== undefined ? `${ms} ms` : '—';
                })()}
              </span>
            </div>

            {/* Neu nop nhieu lan: danh sach cac lan nop */}
            {taskSubmissions.length > 1 && (
              <div style={{ marginTop: '4px', paddingTop: '10px', borderTop: '1px dashed rgba(11, 18, 32, 0.05)' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--blue-200)', marginBottom: '8px' }}>
                  Tất cả các lần nộp của bài này ({taskSubmissions.length} lần):
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {taskSubmissions.map((subItem: any, idx: number) => (
                    <div
                      key={subItem.submissionId || idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(11, 18, 32, 0.04)',
                        border: '1px solid rgba(11, 18, 32, 0.04)',
                        fontSize: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 600, color: 'var(--blue-300)' }}>Lần {taskSubmissions.length - idx}:</span>
                        <code>{subItem.submissionId}</code>
                        <span style={{ color: '#4d5c76' }}>({new Date(subItem.createdAt).toLocaleString('vi-VN')})</span>
                        <span style={{ fontWeight: 700, color: (subItem.score ?? 0) >= 5 ? '#1d4ed8' : 'var(--text-main)' }}>
                          {(subItem.score ?? 0).toFixed(1)}/10đ
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenDetailModal(subItem)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(37, 99, 235, 0.10)',
                          border: '1px solid rgba(59, 130, 246, 0.28)',
                          color: 'var(--blue-200)',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Xem chi tiết
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* VÙNG KÉO THẢ NỘP FILE .ZIP */}
        <div className="glass-panel" style={{ padding: '32px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UploadCloud size={20} color="var(--accent-cyan)" /> Tải Lên Mã Nguồn Bài Làm (.zip)
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Nén toàn bộ mã nguồn bài làm của bạn vào định dạng <code>.zip</code> (tối đa {selectedTask.maxSizeMb || 10}MB). Hệ thống sẽ tự động tính mã SHA-256 để chống chỉnh sửa và đối sánh đạo văn.
          </p>

          {/* LỰA CHỌN TRÌNH BIÊN DỊCH & MÔI TRƯỜNG THỰC THI (COMPILER SELECTION) */}
          <div
            style={{
              marginBottom: '20px',
              padding: '16px 18px',
              borderRadius: '12px',
              backgroundColor: 'rgba(11, 18, 32, 0.02)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Terminal size={17} color="var(--blue-500)" />
                <label htmlFor="submission-language-select" style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                  Lựa Chọn Trình Biên Dịch &amp; Ngôn Ngữ Nộp Bài (Compiler):
                </label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--text-dim)', flexWrap: 'wrap' }}>
                <span>Đề bài cho phép:</span>
                {(selectedTask.allowedLanguages && selectedTask.allowedLanguages.length > 0
                  ? selectedTask.allowedLanguages
                  : ['java', 'python', 'cpp', 'dotnet']
                ).map((l) => (
                  <span
                    key={l}
                    className="chip chip-neutral chip-mono"
                    style={{ padding: '2px 8px', fontSize: '11px', fontWeight: 700, color: 'var(--blue-400)', backgroundColor: 'rgba(37, 99, 235, 0.08)' }}
                  >
                    {l.toUpperCase()}
                  </span>
                ))}
              </div>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: 1.5 }}>
              Chỉ định trình biên dịch và runtime Docker Sandbox để hệ thống giải nén, biên dịch và chạy test cases cho gói mã nguồn <code>.zip</code>:
            </p>

            {/* Grid Thẻ Trình Biên Dịch Trực Quan */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                gap: '8px',
                marginBottom: '10px',
              }}
            >
              {COMPILER_OPTIONS.map((opt) => {
                const isSelected = selectedLanguage === opt.id;
                const allowedList = (selectedTask.allowedLanguages || ['java', 'python', 'cpp', 'dotnet']).map((l) => l.toLowerCase());
                const isPermitted =
                  opt.id === 'auto' ||
                  allowedList.includes(opt.id) ||
                  (opt.id === 'cpp' && (allowedList.includes('cpp') || allowedList.includes('c++'))) ||
                  (opt.id === 'dotnet' && (allowedList.includes('dotnet') || allowedList.includes('csharp') || allowedList.includes('cs')));

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedLanguage(opt.id)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: isSelected ? '1.5px solid var(--blue-500)' : '1px solid var(--border-color)',
                      backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.08)' : '#ffffff',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      outline: 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                      <span style={{ fontSize: '12.5px', fontWeight: 700, color: isSelected ? 'var(--blue-600)' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{opt.icon}</span> {opt.name}
                      </span>
                      {isSelected ? (
                        <CheckCircle size={14} color="var(--blue-600)" />
                      ) : isPermitted && opt.id !== 'auto' ? (
                        <span style={{ fontSize: '10px', color: '#16a34a', fontWeight: 700, backgroundColor: 'rgba(22, 163, 74, 0.1)', padding: '1px 5px', borderRadius: '4px' }}>
                          Cho phép
                        </span>
                      ) : null}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                      {opt.cmd}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Dropdown HTML tiêu chuẩn tương thích */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--border-soft)', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                Hoặc chọn qua danh sách thả xuống:
              </span>
              <select
                id="submission-language-select"
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: '#ffffff',
                  color: 'var(--text-main)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                {COMPILER_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.icon} {opt.name} ({opt.badge})
                  </option>
                ))}
              </select>
            </div>

            {/* Cảnh báo nếu chọn ngôn ngữ không thuộc allowedLanguages */}
            {(() => {
              const allowedList = (selectedTask.allowedLanguages || ['java', 'python', 'cpp', 'dotnet']).map((l) => l.toLowerCase());
              const isPermitted =
                selectedLanguage === 'auto' ||
                allowedList.includes(selectedLanguage) ||
                (selectedLanguage === 'cpp' && (allowedList.includes('cpp') || allowedList.includes('c++'))) ||
                (selectedLanguage === 'dotnet' && (allowedList.includes('dotnet') || allowedList.includes('csharp') || allowedList.includes('cs')));
              if (!isPermitted) {
                return (
                  <div
                    style={{
                      marginTop: '10px',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      color: '#dc2626',
                      fontSize: '11.5px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                    <span>
                      Cảnh báo: Ngôn ngữ biên dịch này không nằm trong danh sách cho phép của đề bài (
                      {allowedList.map((l) => l.toUpperCase()).join(', ')}). Hệ thống có thể từ chối nộp bài!
                    </span>
                  </div>
                );
              }
              return null;
            })()}
          </div>

          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragActive ? 'var(--accent-primary)' : selectedFile ? 'var(--accent-emerald)' : 'rgba(59, 130, 246, 0.24)'}`,
              borderRadius: '12px',
              padding: '40px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              backgroundColor: dragActive ? 'rgba(59, 130, 246, 0.09)' : '#eef2f8',
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
                    backgroundColor: 'rgba(37, 99, 235, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent-emerald)',
                  }}
                >
                  <FileArchive size={36} />
                </div>
                <div>
                  <h4 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)' }}>{selectedFile.name}</h4>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Kích thước: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                  {isHashing && (
                    <p style={{ fontSize: '12px', color: 'var(--blue-200)', marginTop: '4px' }}>
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
                        backgroundColor: 'rgba(59, 130, 246, 0.09)',
                        border: '1px solid rgba(59, 130, 246, 0.2)',
                        fontSize: '12px',
                        color: 'var(--blue-200)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      <ShieldCheck size={14} color="#2563eb" />
                      <span>SHA-256: {sha256Checksum.substring(0, 16)}...{sha256Checksum.substring(sha256Checksum.length - 8)}</span>
                    </div>
                  )}

                  {/* Thông tin Trình Biên Dịch & Sandbox */}
                  <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(37, 99, 235, 0.08)',
                        border: '1px solid rgba(37, 99, 235, 0.18)',
                        fontSize: '11.5px',
                        color: 'var(--text-main)',
                      }}
                    >
                      <Terminal size={12} color="var(--blue-500)" />
                      <span>
                        Trình biên dịch: <strong>{COMPILER_OPTIONS.find((o) => o.id === selectedLanguage)?.name || selectedLanguage}</strong>
                      </span>
                    </div>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(16, 185, 129, 0.08)',
                        border: '1px solid rgba(16, 185, 129, 0.2)',
                        fontSize: '11.5px',
                        color: 'var(--text-main)',
                      }}
                    >
                      <Cpu size={12} color="#10b981" />
                      <span>Docker Sandbox: <strong>512MB RAM • 2.0s TLE</strong></span>
                    </div>
                  </div>
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
                    backgroundColor: 'rgba(59, 130, 246, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--blue-200)',
                  }}
                >
                  <UploadCloud size={32} />
                </div>
                <div>
                  <h4 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)' }}>
                    Kéo và thả file bài làm .zip vào đây
                  </h4>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    hoặc <span style={{ color: 'var(--blue-200)', textDecoration: 'underline', fontWeight: 600 }}>bấm để chọn file từ máy tính</span>
                  </p>
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-dim)',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(11, 18, 32, 0.03)',
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
                backgroundColor: 'rgba(11, 18, 32, 0.06)',
                border: '1px solid rgba(11, 18, 32, 0.108)',
                color: 'var(--text-main)',
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
                    ? 'THÔNG BÁO: DUNG LƯỢNG VƯỢT QUÁ 10MB'
                    : exceptionType === 'EXPIRED'
                    ? 'THÔNG BÁO: QUÁ HẠN NỘP BÀI'
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
                border: '1px solid rgba(11, 18, 32, 0.08)',
                backgroundColor: 'transparent',
                color: '#0b1220',
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
                  ? 'rgba(11, 18, 32, 0.035)'
                  : selectedFile && !isHashing
                  ? 'var(--blue-500)'
                  : 'rgba(11, 18, 32, 0.06)',
                color: isExpired ? 'var(--text-main)' : 'var(--on-blue)',
                fontSize: '14px',
                fontWeight: 700,
                cursor: selectedFile && !isHashing && !isExpired ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: selectedFile && !isHashing && !isExpired ? '0 4px 15px rgba(59, 130, 246, 0.28)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              {isExpired ? (
                <>
                  <Lock size={16} /> Cổng Nộp Đã Đóng (Quá Hạn Chót)
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
          background: 'rgba(59, 130, 246, 0.06)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '3px 10px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(37, 99, 235, 0.1)',
                  color: 'var(--blue-200)',
                  border: '1px solid rgba(37, 99, 235, 0.18)',
                }}
              >
                CỔNG SINH VIÊN
              </span>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Sinh viên: <strong>{studentName}</strong> ({studentId})
              </span>
            </div>

            <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
              Danh Sách Bài Tập & Giám Sát Deadline Nộp Bài
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Xem toàn bộ các bài tập được giao, thời gian đếm ngược còn lại và bấm vào bài tập để tải lên mã nguồn nộp bài.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRefreshAll}
            title="Làm mới danh sách từ giảng viên"
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(11, 18, 32, 0.08)',
              backgroundColor: 'rgba(11, 18, 32, 0.04)',
              color: '#0b1220',
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
              backgroundColor: '#f7f9fc',
              border: '1px solid rgba(11, 18, 32, 0.05)',
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600 }}>TỔNG BÀI ĐƯỢC GIAO</div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-main)', marginTop: '4px' }}>{stats.total}</div>
          </div>

          <div
            style={{
              padding: '14px 18px',
              borderRadius: '12px',
              backgroundColor: '#f7f9fc',
              border: '1px solid rgba(37, 99, 235, 0.14)',
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--blue-200)', fontWeight: 600 }}>CẦN NỘP (CHƯA NỘP)</div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: '#1e40af', marginTop: '4px' }}>{stats.pending}</div>
          </div>

          <div
            style={{
              padding: '14px 18px',
              borderRadius: '12px',
              backgroundColor: '#f7f9fc',
              border: '1px solid rgba(11, 18, 32, 0.108)',
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--text-main)', fontWeight: 600 }}>SẮP HẾT HẠN (&lt; 48H)</div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-main)', marginTop: '4px' }}>{stats.urgent}</div>
          </div>

          <div
            style={{
              padding: '14px 18px',
              borderRadius: '12px',
              backgroundColor: '#f7f9fc',
              border: '1px solid rgba(37, 99, 235, 0.14)',
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--blue-200)', fontWeight: 600 }}>ĐÃ HOÀN THÀNH NỘP</div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--blue-300)', marginTop: '4px' }}>{stats.submitted}</div>
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
              backgroundColor: '#f7f9fc',
              border: '1px solid var(--border-color)',
              color: 'var(--text-main)',
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
              backgroundColor: '#f7f9fc',
              border: '1px solid var(--border-color)',
              color: 'var(--text-main)',
              fontSize: '13px',
              outline: 'none',
            }}
          >
            <option value="ALL">Tất Cả Môn Học</option>
            {courseOptions.map((c: string) => (
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
                  border: active ? '1px solid var(--accent-primary)' : '1px solid rgba(11, 18, 32, 0.06)',
                  backgroundColor: active ? 'rgba(59, 130, 246, 0.12)' : 'rgba(11, 18, 32, 0.03)',
                  color: active ? '#2563eb' : 'var(--text-muted)',
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
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
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
                  border: meta.isUrgent && !isSubmitted ? '1px solid rgba(11, 18, 32, 0.144)' : '1px solid var(--border-color)',
                  backgroundColor: '#f7f9fc',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '20px',
                  flexWrap: 'wrap',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.borderColor = 'var(--accent-primary)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(59, 130, 246, 0.09)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = meta.isUrgent && !isSubmitted ? 'rgba(11, 18, 32, 0.144)' : 'var(--border-color)';
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
                        fontWeight: 600,
                        backgroundColor: 'rgba(37, 99, 235, 0.10)',
                        color: 'var(--blue-200)',
                        border: '1px solid rgba(59, 130, 246, 0.24)',
                      }}
                    >
                      {assignment.courseCode || 'PRO192'}
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
                          backgroundColor: 'rgba(37, 99, 235, 0.1)',
                          color: 'var(--blue-200)',
                          border: '1px solid rgba(37, 99, 235, 0.18)',
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
                          backgroundColor: 'rgba(37, 99, 235, 0.1)',
                          color: 'var(--blue-200)',
                          border: '1px solid rgba(37, 99, 235, 0.16)',
                        }}
                      >
                        Chưa nộp
                      </span>
                    )}
                  </div>

                  <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px', lineHeight: '1.3' }}>
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
                    <span>{assignment.timeLimitMs || 2000}ms</span>
                    <span>{assignment.memoryLimitMb || 512}MB</span>
                    <span>{assignment.testCasesCount || 5} testcases</span>
                    <span>{(assignment.allowedLanguages || ['java', 'python', 'cpp']).join(', ').toUpperCase()}</span>
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
                      borderRadius: '12px',
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
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: isSubmitted ? '1px solid var(--border-color)' : '1px solid var(--blue-500)',
                      background: isSubmitted ? 'rgba(11, 18, 32, 0.035)' : 'var(--blue-600)',
                      color: isSubmitted ? 'var(--text-soft)' : 'var(--on-blue)',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      transition: 'background-color .15s ease, border-color .15s ease',
                    }}
                  >
                    {isSubmitted ? 'Nộp lại' : 'Nộp bài'} <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* Modal Xem Chi Tiet Bai Nop Day Du */}
      <SubmissionDetailModal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        submission={selectedDetailSubmission}
        apiBaseUrl={apiBaseUrl}
        onOpenAppeal={onOpenAppeal}
      />
    </div>
  );
};
