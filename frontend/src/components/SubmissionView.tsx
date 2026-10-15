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
import type { Task } from '../types';

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
  onSelectCourse?: (courseId: string) => void;
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
    technicalRequirements: {
      problemContext: 'Xây dựng cấu trúc cây tìm kiếm nhị phân Generic BST<T extends Comparable<T>> quản lý danh mục sản phẩm. Hỗ trợ các thao tác chèn (Insert), xóa (Delete), tìm kiếm (Search) và duyệt cây In-Order / Pre-Order.',
      inputFormat: [
        'Dòng 1: Số lượng thao tác Q (1 ≤ Q ≤ 50,000).',
        'Q dòng tiếp theo: Mỗi dòng chứa lệnh INSERT x, DELETE x hoặc SEARCH x.',
      ],
      outputFormat: [
        'Với thao tác SEARCH x: In ra FOUND hoặc NOT_FOUND trên một dòng.',
        'Kết thúc toàn bộ thao tác: In ra chuỗi duyệt In-Order của cây.',
      ],
      constraints: [
        '1 ≤ Q ≤ 50,000 thao tác.',
        'Giá trị phần tử: -10^6 ≤ x ≤ 10^6.',
        'Thời gian chạy tối đa: 2000 ms, RAM 512MB.',
      ],
      complexityRequirements: [
        'Tìm kiếm, chèn, xóa trung bình: O(log N).',
        'Duyệt cây: O(N).',
      ],
      solidGuidelines: [
        'Tách Node class thành Generic class riêng biệt.',
        'Sử dụng Interface IBstTree<T> để đóng gói các hành vi của cây.',
      ],
    },
    sampleTestCases: [
      {
        name: 'Testcase Mẫu 1 (Thao Tác Chèn & Duyệt In-Order)',
        input: '5\\nINSERT 20\\nINSERT 10\\nINSERT 30\\nINSERT 25\\nSEARCH 30',
        expectedOutput: 'FOUND\\n10 20 25 30',
        explanation: 'Chèn các nút vào cây BST, tìm thấy 30 in FOUND, sau đó duyệt In-Order thu được dãy tăng dần 10 20 25 30.',
      },
    ],
  },
  {
    id: 'ASM-SWP-02',
    courseId: 'COURSE-SWP391',
    courseCode: 'SWP391',
    course: 'SWP391 - Đồ Án Phát Triển Phần Mềm (Agile Scrum)',
    title: 'Thuật toán Sắp xếp & Tối ưu O(N log N) 3-Way Partitioning',
    description: 'Cài đặt giải thuật QuickSort tối ưu hóa phân hoạch 3 phần (3-Way Partitioning) nhằm triệt tiêu hoàn toàn trường hợp suy biến trên tập dữ liệu trùng lặp.',
    deadline: new Date(Date.now() + 18 * 3600 * 1000 + 30 * 60 * 1000).toISOString(),
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
    technicalRequirements: {
      problemContext: 'Khi mảng có nhiều phần tử trùng lặp (ví dụ: mảng toàn số 1 và 0), thuật toán QuickSort truyền thống sẽ suy biến thành O(N^2). Sinh viên cần triển khai giải thuật phân hoạch 3 đoạn (Dutch National Flag Algorithm) chia mảng thành: nhỏ hơn pivot, bằng pivot và lớn hơn pivot, đảm bảo O(N log N) ngay cả khi tất cả phần tử đều bằng nhau.',
      inputFormat: [
        'Dòng 1: Số nguyên dương N (1 ≤ N ≤ 200,000).',
        'Dòng 2: N số nguyên cách nhau bởi khoảng trắng.',
      ],
      outputFormat: [
        'In ra mảng sau khi sắp xếp tăng dần trên một dòng.',
      ],
      constraints: [
        '1 ≤ N ≤ 200,000.',
        'Thời gian thực thi tối đa: 1500 ms.',
      ],
      complexityRequirements: [
        'Độ phức tạp thời gian: O(N log N) trong mọi trường hợp trùng lặp.',
      ],
      solidGuidelines: [
        'Tách logic phân hoạch (PartitionEngine) độc lập với hàm sắp xếp đệ quy.',
      ],
    },
    sampleTestCases: [
      {
        name: 'Testcase Mẫu 1 (Trùng Lặp Cao)',
        input: '7\\n2 1 2 0 1 2 0',
        expectedOutput: '0 0 1 1 2 2 2',
        explanation: 'Phân hoạch 3 phần sắp xếp chính xác trong O(N) khi số lượng giá trị phân biệt nhỏ.',
      },
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
    technicalRequirements: {
      problemContext: 'Cài đặt cây nhị phân tìm kiếm tự cân bằng AVL Tree. Mỗi nút lưu trữ giá trị và chiều cao (height). Sau mỗi thao tác chèn hoặc xóa, tính toán hệ số cân bằng Balance Factor = height(left) - height(right). Nếu Balance Factor không thuộc {-1, 0, 1}, phải kích hoạt phép xoay tương ứng (Left Rotation, Right Rotation, Left-Right Rotation, Right-Left Rotation).',
      inputFormat: [
        'Dòng 1: Số nguyên dương N là số lượng thao tác (1 ≤ N ≤ 50,000).',
        'N dòng tiếp theo: Mỗi dòng là lệnh INSERT x hoặc DELETE x.',
      ],
      outputFormat: [
        'Dòng 1: Duyệt cây theo thứ tự In-Order sau khi hoàn tất chuỗi thao tác.',
        'Dòng 2: In ra thông tin gốc và chiều cao dạng "Root: X | Height: Y".',
      ],
      constraints: [
        '1 ≤ N ≤ 50,000.',
        'Giá trị nút: -10^6 ≤ x ≤ 10^6.',
        'Thời gian chạy tối đa: 2000 ms, RAM 512MB.',
        'Không được dùng thư viện có sẵn như std::map hay java.util.TreeMap.',
      ],
      complexityRequirements: [
        'Thời gian chèn/xóa/tìm kiếm: O(log N) nghiêm ngặt.',
        'Không gian bộ nhớ: O(N).',
      ],
      solidGuidelines: [
        'Node class lưu trữ height và các con trỏ.',
        'Tách logic xoay (rotateLeft, rotateRight) thành các hàm helper sạch sẽ.',
      ],
    },
    sampleTestCases: [
      {
        name: 'Testcase Mẫu 1 (Xoay Kép Left-Right)',
        input: '3\\nINSERT 30\\nINSERT 10\\nINSERT 20',
        expectedOutput: '10 20 30\\nRoot: 20 | Height: 2',
        explanation: 'Chèn 30 -> 10 -> 20 tạo thành thế mất cân bằng LR tại nút 30. Thực hiện xoay kép đưa 20 lên làm gốc, chiều cao đạt 2.',
      },
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
    technicalRequirements: {
      problemContext: 'Cho đồ thị có hướng G = (V, E) với trọng số các cạnh w ≥ 0 đại diện cho mạng lưới các trung tâm định tuyến dữ liệu. Tìm độ dài đường đi ngắn nhất từ đỉnh xuất phát S đến tất cả các đỉnh còn lại trong đồ thị. Bắt buộc sử dụng hàng đợi ưu tiên Min-Heap để tối ưu độ phức tạp thời gian đạt O((V + E) log V).',
      inputFormat: [
        'Dòng 1: Ba số nguyên V (số đỉnh), E (số cạnh), S (đỉnh nguồn) (1 ≤ V ≤ 10,000; 1 ≤ E ≤ 100,000; 1 ≤ S ≤ V).',
        'E dòng tiếp theo: Mỗi dòng gồm 3 số nguyên u, v, w biểu diễn cạnh có hướng từ u đến v với trọng số w (1 ≤ w ≤ 10^6).',
      ],
      outputFormat: [
        'In ra trên một dòng khoảng cách ngắn nhất từ S đến lần lượt các đỉnh 1, 2, ..., V, cách nhau bởi khoảng trắng. Nếu không có đường đi đến đỉnh i, in ra -1.',
      ],
      constraints: [
        '1 ≤ V ≤ 10,000 đỉnh.',
        '1 ≤ E ≤ 100,000 cạnh.',
        'Trọng số w không âm: 0 ≤ w ≤ 1,000,000.',
        'Thời gian thực thi tối đa: 2500 ms.',
      ],
      complexityRequirements: [
        'Thời gian: O((V + E) log V) sử dụng Min-Heap.',
        'Bộ nhớ: O(V + E) danh sách kề.',
      ],
      solidGuidelines: [
        'Đóng gói riêng các class: Edge, NodeDistance, Graph, DijkstraSolver.',
      ],
    },
    sampleTestCases: [
      {
        name: 'Testcase Mẫu 1 (Đồ Thị 4 Đỉnh Có Hướng)',
        input: '4 4 1\\n1 2 2\\n1 3 5\\n2 3 1\\n3 4 3',
        expectedOutput: '0 2 3 6',
        explanation: 'Đường đi từ 1: Đến 1 là 0, đến 2 là 2, đến 3 là 1->2->3 = 3, đến 4 là 1->2->3->4 = 6.',
      },
    ],
  },
  {
    id: 'ASM-49243',
    courseId: 'COURSE-CSD201',
    courseCode: 'CSD201',
    course: 'CSD201 - Cấu Trúc Dữ Liệu & Giải Thuật Nâng Cao',
    title: 'Hệ thống Quản lý Edge CDN - Định tuyến Lát cắt Video thông minh với Cây AVL',
    description: 'Trong hạ tầng Cloud & CDN Streaming toàn cầu, việc duy trì độ trễ thấp cho hàng triệu người xem đồng thời yêu cầu phân phối các lát cắt video đến các Edge Node tối ưu. Triển khai cây AVL tự cân bằng lưu trữ tải trọng băng thông máy chủ theo thời gian thực.',
    deadline: new Date(Date.now() + 12 * 24 * 3600 * 1000 + 16 * 3600 * 1000).toISOString(),
    timeLimitMs: 2000,
    memoryLimitMb: 512,
    allowedLanguages: ['java', 'cpp', 'python'],
    allowedExtensions: ['.zip'],
    maxSizeMb: 10,
    testCasesCount: 6,
    status: 'PUBLISHED',
    rubrics: [
      { criterion: 'Cân bằng AVL & Định tuyến O(log N)', maxScore: 6.0, description: 'Phân phối lát cắt video đúng Edge Server tối ưu' },
      { criterion: 'Cập nhật tải trọng động & Clean Architecture', maxScore: 4.0, description: 'Cập nhật tải server và tái cân bằng cây tức thời' },
    ],
    technicalRequirements: {
      problemContext: 'Xây dựng mô đun định tuyến Edge CDN Server cho hệ thống live-streaming. Mỗi Edge Server có ServerID và Capacity khả dụng. Yêu cầu sinh viên duy trì một cây AVL có khóa là Capacity để khi có yêu cầu truyền lát cắt video dung lượng S (MB), hệ thống sẽ tìm kiếm Edge Server có Capacity nhỏ nhất thỏa mãn Capacity ≥ S trong thời gian O(log N). Sau đó trừ dung lượng đã cấp và tái cân bằng cây.',
      inputFormat: [
        'Dòng 1: Số nguyên dương N là số lượng thao tác (1 ≤ N ≤ 50,000).',
        'N dòng tiếp theo: Chứa câu lệnh ADD_SERVER id capacity, ALLOCATE size hoặc RELEASE id size.',
      ],
      outputFormat: [
        'Với mỗi lệnh ALLOCATE: In ra ServerID được chọn. Nếu không có server nào đủ dung lượng, in ra REJECT.',
      ],
      constraints: [
        '1 ≤ N ≤ 50,000.',
        'Thời gian thực thi tối đa: 2000 ms, RAM 512MB.',
      ],
      complexityRequirements: [
        'Truy vấn định tuyến & cập nhật tải: O(log N).',
      ],
      solidGuidelines: [
        'Áp dụng Factory Pattern hoặc Strategy Pattern trong việc lựa chọn thuật toán định tuyến.',
      ],
    },
    sampleTestCases: [
      {
        name: 'Testcase Mẫu 1 (Định Tuyến Cắt Video)',
        input: '4\\nADD_SERVER S1 100\\nADD_SERVER S2 200\\nALLOCATE 150\\nALLOCATE 200',
        expectedOutput: 'S2\\nREJECT',
        explanation: 'S1 có 100, S2 có 200. Yêu cầu 150 chọn S2 (còn lại 50). Yêu cầu tiếp theo 200 bị REJECT vì không server nào đủ dung lượng.',
      },
    ],
  },
  {
    id: 'ASM-PRN-01',
    courseId: 'COURSE-PRN211',
    courseCode: 'PRN211',
    course: 'PRN211 - Lập Trình Ứng Dụng Đa Nền Tảng .NET',
    title: 'Xử lý Luồng Dữ liệu Bất Đồng Bộ (.NET C# Async/Await & Task Parallel)',
    description: 'Xây dựng ứng dụng .NET C# xử lý hàng loạt tác vụ phân tích dữ liệu đa luồng bất đồng bộ (async/await, Task.WhenAll) và truy vấn LINQ tối ưu bộ nhớ.',
    deadline: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    timeLimitMs: 2000,
    memoryLimitMb: 512,
    allowedLanguages: ['dotnet', 'csharp', 'java'],
    allowedExtensions: ['.zip'],
    maxSizeMb: 10,
    testCasesCount: 5,
    status: 'PUBLISHED',
    rubrics: [
      { criterion: 'Tính đúng đắn đa luồng & Không Deadlock', maxScore: 6.0, description: 'Sử dụng Task.WhenAll và CancellationToken hợp lệ' },
      { criterion: 'Tối ưu LINQ & Garbage Collection', maxScore: 4.0, description: 'Sử dụng IAsyncEnumerable và hạn chế cấp phát bộ nhớ rác' },
    ],
    technicalRequirements: {
      problemContext: 'Xây dựng dịch vụ phân tích dữ liệu tổng hợp từ nhiều nguồn API song song trong ứng dụng .NET Core. Yêu cầu triển khai xử lý bất đồng bộ không gây nghẽn ThreadPool (Non-blocking I/O), xử lý ngoại lệ AggregateException chuẩn mực.',
      inputFormat: [
        'Dòng 1: Số nguyên N tác vụ cần xử lý.',
        'N dòng tiếp theo: Tên tác vụ và thời gian trễ mô phỏng.',
      ],
      outputFormat: [
        'In ra danh sách tác vụ hoàn thành theo thứ tự thời gian và tổng thời gian xử lý.',
      ],
      constraints: [
        'Thời gian chạy tối đa: 2000 ms, RAM 512MB.',
      ],
      complexityRequirements: [
        'Xử lý song song N tác vụ với Task.WhenAll.',
      ],
      solidGuidelines: [
        'Dependency Injection với IDataProcessor service.',
      ],
    },
    sampleTestCases: [
      {
        name: 'Testcase Mẫu 1 (Xử Lý Song Song)',
        input: '3\\nTaskA 100\\nTaskB 50\\nTaskC 80',
        expectedOutput: 'COMPLETED: TaskB, TaskC, TaskA\\nTOTAL_ELAPSED: ~100ms',
        explanation: '3 tác vụ chạy đồng thời, TaskB hoàn thành nhanh nhất (50ms), tiếp theo là TaskC (80ms) và TaskA (100ms).',
      },
    ],
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
    problemContext: `Đề bài yêu cầu sinh viên xây dựng giải thuật xử lý dữ liệu chuẩn hóa trong dự án phần mềm (${task.courseCode || 'SWP391'}). Mã nguồn phải được đóng gói theo chuẩn Clean Code, áp dụng các nguyên lý SOLID và đảm bảo vượt qua các trường hợp kiểm thử biên trong môi trường Docker Sandbox.`,
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

export const SubmissionView: React.FC<SubmissionViewProps> = ({
  task,
  studentId = 'SE170000',
  studentName = 'Sinh Viên',
  enrolledCourses = [],
  selectedCourseId = 'ALL',
  onSelectCourse,
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
      const normalized = selectedCourseId.replace(/.*-/, '').trim().toUpperCase();
      setSelectedCourseFilter(normalized);
    }
  }, [selectedCourseId]);


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

  // 1. Tải danh sách bài tập đã xuất bản (Đồng bộ thời gian thực 100% với Giảng viên)
  useEffect(() => {
    loadAssignmentsAndSubmissions();

    const handleSync = () => {
      loadAssignmentsAndSubmissions();
    };

    window.addEventListener('storage', handleSync);
    window.addEventListener('aita_published_assignments_updated', handleSync);

    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('aita_published_assignments_updated', handleSync);
    };
  }, [studentId]);

  const loadAssignmentsAndSubmissions = () => {
    let listToDisplay: StudentTaskItem[] = [];

    try {
      const savedPublished = localStorage.getItem('aita_published_assignments');
      let publishedList: any[] = [];
      if (savedPublished) {
        try {
          publishedList = JSON.parse(savedPublished);
        } catch {
          publishedList = [];
        }
      }

      // Nếu chưa có trong localStorage, sử dụng defaultAssignmentPool làm nguồn chuẩn ban đầu
      if (!Array.isArray(publishedList) || publishedList.length === 0) {
        publishedList = defaultAssignmentPool;
        try {
          localStorage.setItem('aita_published_assignments', JSON.stringify(defaultAssignmentPool));
        } catch {
          // ignore
        }
      }

      // Đồng bộ trực tiếp từ danh sách bài tập Giảng viên đã giao - KHÔNG tự động chèn thêm bài tập ảo
      listToDisplay = publishedList.map((item) => {
        const matchedTemplate = defaultAssignmentPool.find(
          (t) => t.id === item.id || t.title.toLowerCase().trim() === (item.title || '').toLowerCase().trim()
        );
        const courseId = item.courseId || 'COURSE-SWP391';
        const courseCode = item.courseCode || courseId.replace('COURSE-', '').replace('CRS-', '');

        return {
          id: item.id || `ASM-${Date.now()}`,
          courseId: courseId,
          courseCode: courseCode,
          course: item.course || `${courseCode} - Bài Tập Giảng Viên Đã Giao`,
          title: item.title,
          description: item.description,
          deadline: item.deadline ? (item.deadline.includes('T') ? item.deadline : `${item.deadline}T23:59:00`) : new Date(Date.now() + 7 * 86400000).toISOString(),
          timeLimitMs: item.timeLimitMs || matchedTemplate?.timeLimitMs || 2000,
          memoryLimitMb: item.memoryLimitMb || matchedTemplate?.memoryLimitMb || 512,
          allowedLanguages: item.allowedLanguages || matchedTemplate?.allowedLanguages || ['java', 'python', 'cpp'],
          allowedExtensions: item.allowedExtensions || ['.zip'],
          maxSizeMb: item.maxSizeMb || 10,
          testCasesCount: item.testCases ? item.testCases.length : (matchedTemplate?.testCasesCount || 5),
          rubrics: item.rubrics && item.rubrics.length > 0 ? item.rubrics : matchedTemplate?.rubrics,
          technicalRequirements: matchedTemplate?.technicalRequirements,
          sampleTestCases: matchedTemplate?.sampleTestCases,
          status: item.status || 'PUBLISHED',
        };
      });
    } catch (e) {
      console.warn('Không thể đọc aita_published_assignments:', e);
      listToDisplay = [...defaultAssignmentPool];
    }

    setAssignmentList(listToDisplay);

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
      const matched = listToDisplay.find((t: StudentTaskItem) => t.id === task.id);
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
    if (enrolledCourses && enrolledCourses.length > 0) {
      return enrolledCourses.map((c) => c.courseCode.replace(/.*-/, '').trim().toUpperCase());
    }
    const set = new Set<string>();
    assignmentList.forEach((a) => {
      const code = a.courseCode || a.course?.split('-')[0].trim();
      if (code) set.add(code.toUpperCase());
    });
    return Array.from(set);
  }, [enrolledCourses, assignmentList]);

  // Lọc bài tập theo tìm kiếm, môn học và trạng thái
  const filteredAssignments = useMemo(() => {
    const enrolledSet = new Set<string>(
      enrolledCourses && enrolledCourses.length > 0
        ? enrolledCourses.map((c) => c.courseCode.replace(/.*-/, '').trim().toUpperCase())
        : ['SWP391', 'PRN211', 'CSD201']
    );

    return assignmentList.filter((item) => {
      // 1. Chỉ hiện bài tập của môn sinh viên đang học (Enrolled Courses)
      const itemCode = (item.courseCode || item.course?.split('-')[0].trim() || '').toUpperCase();
      const isEnrolled = Array.from(enrolledSet).some((ec: string) => itemCode.includes(ec) || ec.includes(itemCode));
      if (!isEnrolled) return false;

      // 2. Lọc theo môn học đang chọn
      if (selectedCourseFilter !== 'ALL') {
        const filterCode = selectedCourseFilter.toUpperCase();
        const matchesFilter = itemCode.includes(filterCode) || filterCode.includes(itemCode);
        if (!matchesFilter) return false;
      }

      // 3. Tìm kiếm từ khóa
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchSearch =
          item.title.toLowerCase().includes(query) ||
          item.course?.toLowerCase().includes(query) ||
          item.id.toLowerCase().includes(query);
        if (!matchSearch) return false;
      }

      // 4. Trạng thái deadline
      const meta = getDeadlineMetadata(item.deadline);
      const isSubmitted = !!submissionHistory[item.id];

      if (statusFilter === 'SUBMITTED' && !isSubmitted) return false;
      if (statusFilter === 'PENDING' && isSubmitted) return false;
      if (statusFilter === 'URGENT' && (!meta.isUrgent || isSubmitted)) return false;

      return true;
    });
  }, [assignmentList, enrolledCourses, selectedCourseFilter, searchQuery, statusFilter, submissionHistory]);

  // Thống kê nhanh
  const stats = useMemo(() => {
    const enrolledSet = new Set<string>(
      enrolledCourses && enrolledCourses.length > 0
        ? enrolledCourses.map((c) => c.courseCode.replace(/.*-/, '').trim().toUpperCase())
        : ['SWP391', 'PRN211', 'CSD201']
    );

    const relevant = assignmentList.filter((item) => {
      const itemCode = (item.courseCode || item.course?.split('-')[0].trim() || '').toUpperCase();
      return Array.from(enrolledSet).some((ec: string) => itemCode.includes(ec) || ec.includes(itemCode));
    });

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
      pending: total - submitted,
      urgent,
      submitted,
    };
  }, [assignmentList, enrolledCourses, submissionHistory]);

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
          {/* Hàng 1: Tiêu Đề, Mã Môn & Đồng Hồ Đếm Ngược */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
            <div style={{ flex: 1, minWidth: '300px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '3px 10px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(99, 102, 241, 0.25)',
                    color: 'var(--accent-cyan)',
                    border: '1px solid rgba(99, 102, 241, 0.4)',
                    textTransform: 'uppercase',
                  }}
                >
                  {selectedTask.courseCode || 'SWP391'}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Mã bài tập: <strong>{selectedTask.id}</strong>
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    backgroundColor: submissionHistory[selectedTask.id] ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                    color: submissionHistory[selectedTask.id] ? '#34d399' : '#fbbf24',
                    border: `1px solid ${submissionHistory[selectedTask.id] ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`,
                  }}
                >
                  {submissionHistory[selectedTask.id] ? '✓ ĐÃ NỘP BÀI' : '⏳ CHƯA HOÀN THÀNH'}
                </span>
              </div>

              <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#ffffff', lineHeight: '1.3', marginBottom: '8px' }}>
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
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Clock size={13} color="var(--accent-cyan)" />
                <span>Hạn nộp: <strong>{new Date(selectedTask.deadline).toLocaleString('vi-VN')}</strong></span>
              </div>
            </div>
          </div>

          {/* Hàng 2: 4 Thông Số Kỹ Thuật Sandbox */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px',
              padding: '16px',
              borderRadius: '12px',
              backgroundColor: 'rgba(10, 15, 29, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              marginBottom: '24px',
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

          {/* Hàng 3: THANH ĐIỀU HƯỚNG TAB CHI TIẾT (4 TABS) */}
          <div
            style={{
              display: 'flex',
              gap: '8px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              paddingBottom: '12px',
              marginBottom: '20px',
              overflowX: 'auto',
            }}
          >
            {[
              { key: 'SPEC', label: 'Yêu Cầu Kỹ Thuật & Đề Bài', icon: <FileText size={15} /> },
              { key: 'SAMPLES', label: 'Testcase Mẫu & Ví Dụ', icon: <Code size={15} />, badge: `${getEffectiveSampleTestCases(selectedTask).length} Mẫu` },
              { key: 'RUBRICS', label: 'Barem Điểm & SOLID', icon: <Award size={15} />, badge: 'Thang 10đ' },
              { key: 'GUIDE', label: 'Cấu Trúc File & Sandbox', icon: <Layers size={15} /> },
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
                    gap: '8px',
                    padding: '9px 16px',
                    borderRadius: '10px',
                    border: active ? '1.5px solid var(--accent-primary)' : '1px solid rgba(255, 255, 255, 0.08)',
                    backgroundColor: active ? 'rgba(99, 102, 241, 0.22)' : 'rgba(255, 255, 255, 0.03)',
                    color: active ? '#ffffff' : 'var(--text-muted)',
                    fontSize: '13px',
                    fontWeight: active ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: active ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.1)',
                        color: '#ffffff',
                        fontWeight: 700,
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
                        backgroundColor: 'rgba(15, 23, 42, 0.8)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ffffff', fontWeight: 700, fontSize: '14px' }}>
                          <Code size={16} color="var(--accent-cyan)" />
                          <span>{tc.name}</span>
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', backgroundColor: 'rgba(255, 255, 255, 0.08)', padding: '2px 8px', borderRadius: '4px' }}>
                          Mẫu #{idx + 1}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                        {/* Đầu vào mẫu */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8' }}>ĐẦU VÀO (STDIN):</span>
                            <button
                              type="button"
                              onClick={() => handleCopyCode(tc.input, `input-${idx}`)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '11px',
                                color: '#e5e7eb',
                                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                border: 'none',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                              }}
                            >
                              {copiedSnippet === `input-${idx}` ? <Check size={11} color="#34d399" /> : <Copy size={11} />}
                              <span>{copiedSnippet === `input-${idx}` ? 'Đã chép!' : 'Sao chép'}</span>
                            </button>
                          </div>
                          <pre
                            style={{
                              margin: 0,
                              padding: '12px',
                              borderRadius: '8px',
                              backgroundColor: '#0a0f1d',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              color: '#f8fafc',
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
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#34d399' }}>ĐẦU RA MONG ĐỢI (STDOUT):</span>
                            <button
                              type="button"
                              onClick={() => handleCopyCode(tc.expectedOutput, `output-${idx}`)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '11px',
                                color: '#e5e7eb',
                                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                border: 'none',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                              }}
                            >
                              {copiedSnippet === `output-${idx}` ? <Check size={11} color="#34d399" /> : <Copy size={11} />}
                              <span>{copiedSnippet === `output-${idx}` ? 'Đã chép!' : 'Sao chép'}</span>
                            </button>
                          </div>
                          <pre
                            style={{
                              margin: 0,
                              padding: '12px',
                              borderRadius: '8px',
                              backgroundColor: '#0a0f1d',
                              border: '1px solid rgba(52, 211, 153, 0.25)',
                              color: '#34d399',
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
                          backgroundColor: 'rgba(255, 255, 255, 0.04)',
                          fontSize: '12.5px',
                          color: '#d1d5db',
                          lineHeight: '1.5',
                        }}
                      >
                        <strong style={{ color: '#fbbf24' }}>💡 Giải thích bước chạy: </strong>
                        {tc.explanation}
                      </div>
                    </div>
                  ))}
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
                          backgroundColor: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '10px',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 800, color: '#ffffff' }}>{r.criterion}</span>
                            <span
                              style={{
                                fontSize: '13px',
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: '6px',
                                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                                color: 'var(--accent-emerald)',
                                border: '1px solid rgba(16, 185, 129, 0.4)',
                              }}
                            >
                              +{r.maxScore}đ
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>{r.description}</div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--accent-cyan)' }}>
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
                      backgroundColor: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    <ShieldCheck size={24} color="#34d399" />
                    <div style={{ fontSize: '12.5px', color: '#d1d5db', lineHeight: '1.5' }}>
                      <strong style={{ color: '#ffffff' }}>Giám sát Liêm chính học thuật AST: </strong>
                      Mọi bài nộp sẽ được tạo chữ ký k-gram thông qua giải thuật Winnowing AST. Nếu độ tương đồng vượt quá 70%, bài nộp sẽ bị tự động đánh dấu nghi vấn gian lận và chuyển tới hội đồng giảng viên xem xét.
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
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', fontSize: '13.5px', fontWeight: 700, marginBottom: '10px' }}>
                        <FileArchive size={16} /> Cấu Trúc File Nén .ZIP Hợp Lệ
                      </div>
                      <p style={{ fontSize: '12.5px', color: '#d1d5db', marginBottom: '10px' }}>
                        Nén trực tiếp các file mã nguồn vào thư mục gốc của tệp <code>.zip</code>:
                      </p>
                      <pre
                        style={{
                          margin: 0,
                          padding: '12px',
                          borderRadius: '8px',
                          backgroundColor: '#0a0f1d',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          color: '#f8fafc',
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
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fbbf24', fontSize: '13.5px', fontWeight: 700, marginBottom: '10px' }}>
                        <Lock size={16} /> Quy Định An Toàn Docker Sandbox
                      </div>
                      <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12.5px', color: '#d1d5db', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <li>File nén chỉ chứa mã nguồn (.java, .py, .cpp, .cs). Không đính kèm file .class, .exe hoặc file rác.</li>
                        <li>Dung lượng file tối đa: <strong>10 MB</strong>. Vượt quá sẽ bị chặn theo chuẩn <em>BR-01</em>.</li>
                        <li>Nghiêm cấm: Gọi <code>System.exit()</code>, mở kết nối mạng Socket/HTTP, truy xuất file hệ thống.</li>
                        <li>Thời hạn nộp bài: Sau khi hết thời gian đếm ngược, cổng nộp bài tự động khóa theo chuẩn <em>BR-02</em>.</li>
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
