import { Knex } from 'knex';
import * as fs from 'fs';
import * as path from 'path';

export async function seed(knex: Knex): Promise<void> {
  console.log('🌱 Bắt đầu nạp dữ liệu mẫu quy mô lớn (Seed Data) cho AITA Platform...');

  // ==========================================================================
  // 1. ROLES
  // ==========================================================================
  await knex('roles').insert([
    { role_id: 'ADMIN', role_name: 'System Administrator', description: 'Toàn quyền cấu hình hệ thống' },
    { role_id: 'HOD', role_name: 'Head of Department', description: 'Trưởng bộ môn giám sát đạo văn và tiến độ' },
    { role_id: 'LECTURER', role_name: 'Course Lecturer', description: 'Giảng viên tạo lớp, đề thi, chấm phúc khảo' },
    { role_id: 'STUDENT', role_name: 'Enrolled Student', description: 'Sinh viên nộp bài, xem live score, gửi appeal' },
  ]).onConflict('role_id').ignore();

  // ==========================================================================
  // 2. USERS (Admin, HOD, 4 Giảng viên, 50 Sinh viên)
  // ==========================================================================
  const pwdHash = '$2a$10$e7mK8Z2oW2b2tqG9yT6kcuo2g1l6a7p8r9s0t1u2v3w4x5y6z7'; // Bcrypt dummy

  const staffUsers = [
    { userId: 'ADMIN001', roleId: 'ADMIN', role: 'ADMIN', email: 'admin@aita.fpt.edu.vn', fullName: 'Hệ Thống Quản Trị AITA' },
    { userId: 'ADMIN002', roleId: 'ADMIN', role: 'ADMIN', email: 'admin.aita@gmail.com', fullName: 'Quản Trị Viên AITA (Demo Gmail)' },
    { userId: 'HOD001', roleId: 'HOD', role: 'HOD', email: 'truongbm@fe.edu.vn', fullName: 'TS. Nguyễn Văn Hùng (Trưởng Bộ Môn)' },
    { userId: 'GV001', roleId: 'LECTURER', role: 'INSTRUCTOR', email: 'giangvien.edu@gmail.com', fullName: 'ThS. Giảng Viên AITA (Demo Gmail)' },
    { userId: 'GV002', roleId: 'LECTURER', role: 'INSTRUCTOR', email: 'trungdt@fe.edu.vn', fullName: 'ThS. Đinh Thành Trung (Giảng viên)' },
    { userId: 'GV003', roleId: 'LECTURER', role: 'INSTRUCTOR', email: 'namlh@fe.edu.vn', fullName: 'TS. Lê Hoàng Nam (Giảng viên)' },
    { userId: 'GV004', roleId: 'LECTURER', role: 'INSTRUCTOR', email: 'huypq@fe.edu.vn', fullName: 'ThS. Phạm Quang Huy (Giảng viên)' },
    { userId: 'GV005', roleId: 'LECTURER', role: 'INSTRUCTOR', email: 'phuongttb@fe.edu.vn', fullName: 'TS. Trần Thị Bích Phượng (Giảng viên)' },
  ];

  // 50 Sinh viên với tên tiếng Việt thực tế (bảo toàn các tài khoản demo đã xác minh)
  const specialStudents: Record<string, { email: string; fullName: string }> = {
    SE170001: { email: 'phaithayj@gmail.com', fullName: 'Nguyễn Hoàng Vinh' },
    SE170002: { email: 'linh.se170002@fpt.edu.vn', fullName: 'Linh Campochia' },
    SE170003: { email: 'wilson.se170003@fpt.edu.vn', fullName: 'Viktor Wilson' },
  };

  // Tài khoản sinh viên thực nghiệm nộp bài trực tiếp (Google SSO / Direct Email)
  const explicitTestUsers = [
    {
      userId: 'linhcampochia@gmail.com',
      roleId: 'STUDENT',
      role: 'STUDENT',
      studentCode: 'QE200033',
      email: 'linhcampochia@gmail.com',
      fullName: 'Linh Campochia',
    },
    {
      userId: 'mochibunnyyy123@gmail.com',
      roleId: 'STUDENT',
      role: 'STUDENT',
      studentCode: 'QE200000',
      email: 'mochibunnyyy123@gmail.com',
      fullName: 'Viktor Wilson',
    },
    {
      userId: 'QE200001',
      roleId: 'STUDENT',
      role: 'STUDENT',
      studentCode: 'QE200001',
      email: 'shirotran123@gmail.com',
      fullName: 'ABC',
    },
  ];

  const firstNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương'];
  const middleNames = ['Văn', 'Thị', 'Đức', 'Thành', 'Hoàng', 'Minh', 'Thanh', 'Quang', 'Ngọc', 'Hải', 'Tuấn', 'Quốc', 'Anh'];
  const lastNames = ['An', 'Bình', 'Cường', 'Dũng', 'Đạt', 'Giang', 'Hải', 'Huy', 'Khoa', 'Long', 'Minh', 'Nam', 'Nghĩa', 'Phúc', 'Quân', 'Sơn', 'Tài', 'Thắng', 'Trí', 'Tùng', 'Vinh', 'Vy', 'Yến', 'Trang', 'Phương', 'Linh', 'Nguyên'];

  const studentUsers: any[] = [];
  for (let i = 0; i < 50; i++) {
    const codeNum = (170000 + i).toString();
    const studentCode = `SE${codeNum}`;
    const special = specialStudents[studentCode];
    const fn = firstNames[i % firstNames.length];
    const mn = middleNames[(i * 3) % middleNames.length];
    const ln = lastNames[(i * 7) % lastNames.length];
    const fullName = special ? special.fullName : `${fn} ${mn} ${ln}`;
    const email = special ? special.email : `${ln.toLowerCase()}.${studentCode.toLowerCase()}@fpt.edu.vn`;

    studentUsers.push({
      userId: studentCode,
      roleId: 'STUDENT',
      role: 'STUDENT',
      studentCode,
      email,
      fullName,
    });
  }

  const allUsers = [...staffUsers, ...explicitTestUsers, ...studentUsers].map((u) => ({
    user_id: u.userId,
    role_id: u.roleId,
    email: u.email,
    full_name: u.fullName,
    student_code: u.studentCode || null,
    role: u.role,
    password_hash: pwdHash,
    is_active: true,
  }));

  for (const u of allUsers) {
    await knex('users')
      .insert(u)
      .onConflict('user_id')
      .merge()
      .catch(async () => {
        // Nếu trùng email với user_id khác, cập nhật thông tin theo email
        await knex('users')
          .where({ email: u.email })
          .update({
            full_name: u.full_name,
            role: u.role,
            role_id: u.role_id,
            is_active: u.is_active,
          })
          .catch(() => {});
      });
  }

  // ==========================================================================
  // 3. CLASSES (6 Lớp Học Phần)
  // ==========================================================================
  const classesData = [
    { class_id: 'CRS-TEST123456', lecturer_id: 'GV001', class_code: 'TEST123456', class_name: 'Test123456', semester: 'Học kỳ Thu 2026', description: 'Test123456' },
    { class_id: 'CRS-SWP391', lecturer_id: 'GV001', class_code: 'SE1701-SWP391', class_name: 'Application Development Project (SWP391)', semester: 'Fall 2026', description: 'Dự án Phát triển phần mềm thực chiến Scrum' },
    { class_id: 'CRS-PRO192', lecturer_id: 'GV001', class_code: 'SE1702-PRO192', class_name: 'Object-Oriented Programming (PRO192)', semester: 'Fall 2026', description: 'Lập trình hướng đối tượng với Java Core' },
    { class_id: 'CRS-PRN211', lecturer_id: 'GV002', class_code: 'SE1703-PRN211', class_name: 'Basic Cross-Platform .NET (PRN211)', semester: 'Fall 2026', description: 'Lập trình ứng dụng đa nền tảng với .NET Core' },
    { class_id: 'CRS-CSD201', lecturer_id: 'GV003', class_code: 'SE1704-CSD201', class_name: 'Data Structures and Algorithms (CSD201)', semester: 'Fall 2026', description: 'Cấu trúc dữ liệu và giải thuật nâng cao' },
    { class_id: 'CRS-MAS291', lecturer_id: 'GV004', class_code: 'SE1705-MAS291', class_name: 'Statistics & Probability for CS (MAS291)', semester: 'Fall 2026', description: 'Xác suất thống kê ứng dụng cho Kỹ sư phần mềm' },
  ];
  await knex('classes').insert(classesData).onConflict('class_id').merge();

  // ==========================================================================
  // 4. CLASS_MEMBERS (~135 lượt ghi danh sinh viên)
  // ==========================================================================
  const enrollments: any[] = [];
  // Ghi danh thành viên vào lớp thực nghiệm TEST123456
  enrollments.push(
    { class_id: 'CRS-TEST123456', user_id: 'linhcampochia@gmail.com', status: 'ACTIVE' },
    { class_id: 'CRS-TEST123456', user_id: 'mochibunnyyy123@gmail.com', status: 'ACTIVE' },
    { class_id: 'CRS-TEST123456', user_id: 'QE200001', status: 'ACTIVE' },
    { class_id: 'CRS-TEST123456', user_id: 'SE170002', status: 'ACTIVE' },
    { class_id: 'CRS-TEST123456', user_id: 'SE170003', status: 'ACTIVE' },
  );

  studentUsers.forEach((stu, idx) => {
    // 30 sinh viên đầu vào SWP391
    if (idx < 30) enrollments.push({ class_id: 'CRS-SWP391', user_id: stu.userId, status: 'ACTIVE' });
    // Sinh viên từ 10 đến 40 vào PRO192
    if (idx >= 10 && idx < 40) enrollments.push({ class_id: 'CRS-PRO192', user_id: stu.userId, status: 'ACTIVE' });
    // Sinh viên từ 20 đến 45 vào PRN211
    if (idx >= 20 && idx < 45) enrollments.push({ class_id: 'CRS-PRN211', user_id: stu.userId, status: 'ACTIVE' });
    // Sinh viên từ 0 đến 25 vào CSD201
    if (idx < 25) enrollments.push({ class_id: 'CRS-CSD201', user_id: stu.userId, status: 'ACTIVE' });
    // Sinh viên từ 30 đến 50 vào MAS291
    if (idx >= 30) enrollments.push({ class_id: 'CRS-MAS291', user_id: stu.userId, status: 'ACTIVE' });
  });

  for (const chunk of chunkArray(enrollments, 40)) {
    await knex('class_members').insert(chunk).onConflict(['class_id', 'user_id']).ignore();
  }

  // ==========================================================================
  // 5. ASSIGNMENTS (13 Đề bài thực hành)
  // ==========================================================================
  const now = new Date();
  const futureDue = new Date(now.getTime() + 14 * 86400 * 1000);
  const pastDue = new Date(now.getTime() - 2 * 86400 * 1000);

  const testClassAssignments = [
    // 5 bài tập thuộc lớp thực nghiệm TEST123456
    {
      assignment_id: 'ASM-219423',
      class_id: 'CRS-TEST123456',
      course_id: 'CRS-TEST123456',
      title: 'Thuật Toán Dãy Số Fibonacci & Tối Ưu Hóa Quy Hoạch Động (TEST123456)',
      description: 'Cài đặt thuật toán tính số Fibonacci thứ N với độ phức tạp tối ưu O(N) và bộ nhớ O(1), tuân thủ Clean Code & SOLID.',
      allowed_languages: JSON.stringify(['java', 'python', 'cpp']),
      max_score: 10.0,
      due_date: futureDue,
      deadline: futureDue,
      time_limit_ms: 2000,
      memory_limit_mb: 512,
      testcases_count: 3,
    },
    {
      assignment_id: 'ASM-835029',
      class_id: 'CRS-TEST123456',
      course_id: 'CRS-TEST123456',
      title: 'Bài Tập Lập Trình: Kiểm tra số nguyên tố tối ưu (TEST123456) - 1',
      description: 'Kiểm tra số nguyên tố tối ưu O(sqrt(N))',
      allowed_languages: JSON.stringify(['java']),
      max_score: 10.0,
      due_date: futureDue,
      deadline: futureDue,
      time_limit_ms: 2000,
      memory_limit_mb: 512,
      testcases_count: 3,
    },
    {
      assignment_id: 'ASM-766589',
      class_id: 'CRS-TEST123456',
      course_id: 'CRS-TEST123456',
      title: 'Bài Tập Lập Trình: Kiểm tra số nguyên tố tối ưu (TEST123456) - 2',
      description: 'Kiểm tra số nguyên tố tối ưu O(sqrt(N))',
      allowed_languages: JSON.stringify(['java']),
      max_score: 10.0,
      due_date: futureDue,
      deadline: futureDue,
      time_limit_ms: 2000,
      memory_limit_mb: 512,
      testcases_count: 3,
    },
    {
      assignment_id: 'ASM-723745',
      class_id: 'CRS-TEST123456',
      course_id: 'CRS-TEST123456',
      title: 'Bài Tập Lập Trình: Kiểm tra số nguyên tố tối ưu (TEST123456) - 3',
      description: 'Kiểm tra số nguyên tố tối ưu O(sqrt(N))',
      allowed_languages: JSON.stringify(['java']),
      max_score: 10.0,
      due_date: futureDue,
      deadline: futureDue,
      time_limit_ms: 2000,
      memory_limit_mb: 512,
      testcases_count: 3,
    },
    {
      assignment_id: 'ASM-655945',
      class_id: 'CRS-TEST123456',
      course_id: 'CRS-TEST123456',
      title: 'Bài Tập Lập Trình: Kiểm tra số nguyên tố tối ưu (TEST123456) - 4',
      description: 'Kiểm tra số nguyên tố tối ưu O(sqrt(N))',
      allowed_languages: JSON.stringify(['java']),
      max_score: 10.0,
      due_date: futureDue,
      deadline: futureDue,
      time_limit_ms: 2000,
      memory_limit_mb: 512,
      testcases_count: 3,
    },
  ];

  const standardAssignmentsData = [
    {
      assignment_id: 'TASK-SWP391-SPRINT2',
      class_id: 'CRS-SWP391',
      course_id: 'CRS-SWP391',
      title: 'Thuật toán Sắp xếp & Tối ưu hóa Bộ nhớ (Milestone 2)',
      description: 'Xây dựng thuật toán sắp xếp mảng 100,000 phần tử, tối ưu O(N log N) và tuân thủ các nguyên lý SOLID.',
      allowed_languages: JSON.stringify(['java', 'python', 'cpp', 'dotnet']),
      max_score: 10.0,
      due_date: futureDue,
      deadline: futureDue,
      time_limit_ms: 2000,
      memory_limit_mb: 512,
      testcases_count: 5,
    },
    {
      assignment_id: 'TASK-SWP391-M1',
      class_id: 'CRS-SWP391',
      course_id: 'CRS-SWP391',
      title: 'Thiết kế RBAC & Clean Architecture Gateway',
      description: 'Xây dựng kiến trúc phân quyền RBAC và tích hợp Google SSO Whitelist.',
      allowed_languages: JSON.stringify(['java', 'dotnet']),
      max_score: 10.0,
      due_date: pastDue,
      deadline: pastDue,
      time_limit_ms: 2000,
      memory_limit_mb: 512,
      testcases_count: 8,
    },
    {
      assignment_id: 'TASK-PRO192-A1',
      class_id: 'CRS-PRO192',
      course_id: 'CRS-PRO192',
      title: 'Quản lý Đội xe Vận tải hướng đối tượng OOP',
      description: 'Áp dụng tính kế thừa, bao đóng và đa hình quản lý xe tải, xe hơi và xe buýt.',
      allowed_languages: JSON.stringify(['java']),
      max_score: 10.0,
      due_date: futureDue,
      deadline: futureDue,
      time_limit_ms: 1500,
      memory_limit_mb: 256,
      testcases_count: 6,
    },
    {
      assignment_id: 'TASK-PRO192-A2',
      class_id: 'CRS-PRO192',
      course_id: 'CRS-PRO192',
      title: 'Đa hình & Interface trong Hệ thống Ngân hàng',
      description: 'Xây dựng interface PaymentProcessor và cài đặt cho VNPay, MoMo, Visa.',
      allowed_languages: JSON.stringify(['java']),
      max_score: 10.0,
      due_date: futureDue,
      deadline: futureDue,
      time_limit_ms: 2000,
      memory_limit_mb: 256,
      testcases_count: 4,
    },
    {
      assignment_id: 'TASK-PRN211-M1',
      class_id: 'CRS-PRN211',
      course_id: 'CRS-PRN211',
      title: 'Cài đặt Generic Binary Search Tree .NET 8',
      description: 'Cài đặt cây BST tổng quát hỗ trợ Comparable, tối ưu chèn và xóa nút.',
      allowed_languages: JSON.stringify(['dotnet', 'java']),
      max_score: 10.0,
      due_date: futureDue,
      deadline: futureDue,
      time_limit_ms: 2000,
      memory_limit_mb: 512,
      testcases_count: 7,
    },
    {
      assignment_id: 'TASK-PRN211-M2',
      class_id: 'CRS-PRN211',
      course_id: 'CRS-PRN211',
      title: 'Xây dựng RESTful API với ASP.NET Core & EF Core',
      description: 'Thiết kế RESTful CRUD quản lý sản phẩm với Repository Pattern.',
      allowed_languages: JSON.stringify(['dotnet']),
      max_score: 10.0,
      due_date: futureDue,
      deadline: futureDue,
      time_limit_ms: 3000,
      memory_limit_mb: 512,
      testcases_count: 3,
    },
    {
      assignment_id: 'TASK-CSD201-A1',
      class_id: 'CRS-CSD201',
      course_id: 'CRS-CSD201',
      title: 'Thuật toán Dijkstra tìm đường đi ngắn nhất',
      description: 'Cài đặt giải thuật Dijkstra với PriorityQueue tìm đường đi tối ưu trên đồ thị 10,000 đỉnh.',
      allowed_languages: JSON.stringify(['java', 'cpp', 'python']),
      max_score: 10.0,
      due_date: futureDue,
      deadline: futureDue,
      time_limit_ms: 2000,
      memory_limit_mb: 512,
      testcases_count: 10,
    },
    {
      assignment_id: 'TASK-CSD201-A2',
      class_id: 'CRS-CSD201',
      course_id: 'CRS-CSD201',
      title: 'Cân bằng cây AVL Tree & Phân tích O(log N)',
      description: 'Cài đặt các phép quay Left-Left, Right-Right, Left-Right, Right-Left duy trì chiều cao cây AVL.',
      allowed_languages: JSON.stringify(['java', 'cpp']),
      max_score: 10.0,
      due_date: futureDue,
      deadline: futureDue,
      time_limit_ms: 2000,
      memory_limit_mb: 512,
      testcases_count: 5,
    },
  ];

  const assignmentsData = [...testClassAssignments, ...standardAssignmentsData];

  await knex('assignments').insert(assignmentsData).onConflict('assignment_id').ignore();

  // ==========================================================================
  // 6. TEST_CASES — ĐỘNG theo testcases_count của từng assignment
  // ==========================================================================
  // Bộ mẫu input/output cho testcases đa dạng (vòng lặp sẽ chọn theo index)
  const tcTemplates = [
    { input: '5\n4 2 5 1 3',           output: '1 2 3 4 5',               hidden: false },
    { input: '10\n10 9 8 7 6 5 4 3 2 1', output: '1 2 3 4 5 6 7 8 9 10',   hidden: true },
    { input: '3\n-5 0 10',              output: '-5 0 10',                  hidden: true },
    { input: '1\n42',                    output: '42',                       hidden: false },
    { input: '7\n3 1 4 1 5 9 2',        output: '1 1 2 3 4 5 9',           hidden: true },
    { input: '4\n100 -100 0 50',        output: '-100 0 50 100',            hidden: true },
    { input: '6\n6 5 4 3 2 1',          output: '1 2 3 4 5 6',             hidden: true },
    { input: '8\n8 3 7 1 6 2 5 4',      output: '1 2 3 4 5 6 7 8',        hidden: true },
    { input: '2\n999 -999',             output: '-999 999',                 hidden: true },
    { input: '5\n0 0 0 0 0',            output: '0 0 0 0 0',               hidden: false },
  ];

  const testCasesData: any[] = [];
  // Map: assignment_id -> số lượng TC thực tế đã tạo
  const assignmentTcCountMap: Record<string, number> = {};

  assignmentsData.forEach((a) => {
    const tcCount = a.testcases_count || 3;
    assignmentTcCountMap[a.assignment_id] = tcCount;
    for (let t = 0; t < tcCount; t++) {
      const tpl = tcTemplates[t % tcTemplates.length];
      testCasesData.push({
        test_case_id: `TC-${a.assignment_id}-${String(t + 1).padStart(2, '0')}`,
        assignment_id: a.assignment_id,
        input_data: tpl.input,
        expected_output: tpl.output,
        is_hidden: t === 0 ? false : tpl.hidden,  // TC-01 luôn public
        weight: 1.0,
        time_limit_ms: a.time_limit_ms,
      });
    }
  });

  // Đảm bảo các testcases cụ thể cho ASM-219423 khớp chính xác với kết quả chi tiết
  testCasesData.push(
    {
      test_case_id: 'f80d6e90-d4b9-4e10-abaf-484e7caeee9d',
      assignment_id: 'ASM-219423',
      input_data: '1',
      expected_output: '1',
      is_hidden: false,
      weight: 2.30,
      time_limit_ms: 2000,
    },
    {
      test_case_id: '82a22505-371b-46d3-9701-dd4c7896536a',
      assignment_id: 'ASM-219423',
      input_data: '2',
      expected_output: '1',
      is_hidden: false,
      weight: 2.30,
      time_limit_ms: 2000,
    },
    {
      test_case_id: 'af7a9675-3715-4e8a-b362-346302546b29',
      assignment_id: 'ASM-219423',
      input_data: '5',
      expected_output: '5',
      is_hidden: false,
      weight: 2.40,
      time_limit_ms: 2000,
    },
  );

  await knex('test_cases').insert(testCasesData).onConflict('test_case_id').ignore();

  // ==========================================================================
  // 7. SUBMISSIONS, SUBMISSION_DETAILS, AI_REVIEW_RESULTS (~80 bài nộp & logs)
  // ==========================================================================
  const submissionsData: any[] = [];
  const submissionDetailsData: any[] = [];
  const aiReviewsData: any[] = [];

  const languages = ['java', 'python', 'cpp', 'dotnet'];
  const smellList = [
    { line: 12, rule: 'Long Method', description: 'Phương thức sortAndFilter() vượt quá 35 dòng code.' },
    { line: 45, rule: 'Magic Number', description: 'Sử dụng hằng số vô danh 100000 trực tiếp trong vòng lặp.' },
    { line: 78, rule: 'SRP Violation', description: 'Lớp ArrayManager vừa đọc file vừa thực thi logic sắp xếp.' },
    { line: 92, rule: 'Duplicate Logic', description: 'Đoạn mã đảo vị trí mảng bị lặp lại ở 2 nơi.' },
  ];

  // Sinh 80 bài nộp cho các lớp học phần tiêu chuẩn
  for (let i = 0; i < 80; i++) {
    const subId = `SUB-DEMO-${(1001 + i).toString()}`;
    const stu = studentUsers[i % studentUsers.length];
    const assign = standardAssignmentsData[i % standardAssignmentsData.length];
    const lang = languages[i % languages.length];

    // Tạo điểm ngẫu nhiên thực tế (từ 4.5 đến 10.0)
    const baseScore = Math.min(10.0, Math.round((5.0 + Math.random() * 5.0) * 10) / 10);

    // Số TC thực tế đã seed cho assignment này (ĐỘNG, không ghi cứng)
    const totalTC = assignmentTcCountMap[assign.assignment_id] || 3;
    // TC dễ → khó: threshold tăng dần, điểm cao mới pass TC cuối
    const tcPassResults: boolean[] = [];
    for (let t = 0; t < totalTC; t++) {
      const threshold = 5.0 + (t / Math.max(totalTC - 1, 1)) * 4.5;
      tcPassResults.push(baseScore >= threshold);
    }
    const passedCount = tcPassResults.filter(Boolean).length;

    const cleanScore = Math.round((6.0 + Math.random() * 3.8) * 10) / 10;
    const solidScore = Math.round((6.0 + Math.random() * 4.0) * 10) / 10;

    // Giả lập hash SHA-256 ngẫu nhiên
    const hash = `hash_${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}${i}`.padEnd(64, '0');
    const subTime = new Date(now.getTime() - Math.floor(Math.random() * 10 * 86400 * 1000));

    const status = i === 78 ? 'QUEUED' : (i === 79 ? 'IN_PROGRESS' : 'COMPLETED');

    submissionsData.push({
      submission_id: subId,
      assignment_id: assign.assignment_id,
      student_id: stu.userId,
      file_hash: hash,
      sha256_hash: hash,
      file_path: `uploads/${subId}/submission.zip`,
      file_name: 'solution.zip',
      file_size_bytes: Math.floor(10240 + Math.random() * 50000),
      language: lang,
      status,
      queue_job_id: `job-${subId}`,
      testcase_score: baseScore >= 7.5 ? 7.0 : (baseScore >= 5.0 ? 4.0 : 0.0),
      final_score: status === 'COMPLETED' ? baseScore : null,
      score: status === 'COMPLETED' ? baseScore : null,
      details: JSON.stringify({ passedTestcases: passedCount, totalTestcases: totalTC }),
      created_at: subTime,
      updated_at: subTime,
    });

    if (status === 'COMPLETED') {
      // Tạo N submission_details — ĐỘNG theo số TC thực tế
      for (let t = 0; t < totalTC; t++) {
        const tcId = `TC-${assign.assignment_id}-${String(t + 1).padStart(2, '0')}`;
        const passed = tcPassResults[t];
        const tpl = tcTemplates[t % tcTemplates.length];
        submissionDetailsData.push({
          detail_id: `DTL-${subId}-${String(t + 1).padStart(2, '0')}`,
          submission_id: subId,
          test_case_id: tcId,
          status: passed ? 'PASS' : (Math.random() < 0.3 ? 'TLE' : 'FAIL'),
          actual_output: passed ? tpl.output : 'Output mismatch',
          time_ms: passed ? Math.floor(20 + Math.random() * 200) : (Math.random() < 0.3 ? 2005 : Math.floor(50 + Math.random() * 150)),
          memory_kb: Math.floor(14000 + Math.random() * 8000),
          error_log: passed ? null : (Math.random() < 0.3 ? 'Time Limit Exceeded (2.0s)' : 'Sai kết quả so với mong đợi'),
          created_at: subTime,
        });
      }

      // AI review record
      const selectedSmells = smellList.slice(0, Math.floor(Math.random() * 3) + 1);
      aiReviewsData.push({
        review_id: `REV-${subId}`,
        submission_id: subId,
        clean_code_score: cleanScore,
        solid_score: solidScore,
        code_smells_count: selectedSmells.length,
        feedback_json: JSON.stringify(selectedSmells),
        compiler_explanation: 'Code tối ưu tốt các vòng lặp; cần chú ý phân tách thêm các hàm con để tuân thủ nguyên lý Đơn trách nhiệm (Single Responsibility).',
        model_used: 'gemini-1.5-pro',
        token_usage: JSON.stringify({ promptTokens: 320, completionTokens: 160, totalTokens: 480 }),
        evaluated_at: subTime,
        created_at: subTime,
        updated_at: subTime,
      });
    }
  }

  // ==========================================================================
  // Thêm 2 bài nộp thực nghiệm thực tế cho lớp TEST123456 (Linh Campochia & Viktor Wilson)
  // ==========================================================================
  const subLinhSource = `"""
Fibonacci Calculation Module - Variant with ~70-76% AST Similarity
Status: FLAGGED_HIGH (Flagged under UC-11 / BR-03 for high similarity >= 70%)
"""
import sys

class FibonacciCalculator:
    @staticmethod
    def calculate(n: int) -> int:
        if n <= 0:
            raise ValueError("Index N must be a positive integer (N >= 1)")
        if n == 1 or n == 2:
            return 1

        prev_val = 1
        curr_val = 1

        step = 3
        while step <= n:
            next_val = prev_val + curr_val
            prev_val = curr_val
            curr_val = next_val
            step += 1

        return curr_val

def main():
    try:
        raw_input = sys.stdin.read().split()
        if not raw_input:
            return
        n = int(raw_input[0])
        result = FibonacciCalculator.calculate(n)
        print(result)
    except Exception as e:
        sys.stderr.write(f"Error: {e}\\n")

if __name__ == '__main__':
    main()
`;

  const subViktorSource = `"""
Fibonacci Calculation Module - Standard Reference Implementation
Complies with Clean Code & SOLID (Single Responsibility Principle)
Time Complexity: O(N)
Space Complexity: O(1)
"""
import sys

class FibonacciCalculator:
    """
    Service responsible solely for calculating Fibonacci numbers.
    Adheres strictly to the Single Responsibility Principle (SRP).
    """
    @staticmethod
    def calculate(n: int) -> int:
        if n <= 0:
            raise ValueError("Index N must be a positive integer (N >= 1)")
        if n == 1 or n == 2:
            return 1

        prev_val = 1
        curr_val = 1

        for _ in range(3, n + 1):
            next_val = prev_val + curr_val
            prev_val = curr_val
            curr_val = next_val

        return curr_val

def main():
    try:
        raw_input = sys.stdin.read().strip()
        if not raw_input:
            return
        n = int(raw_input)
        result = FibonacciCalculator.calculate(n)
        print(result)
    except Exception as e:
        sys.stderr.write(f"Error: {e}\\n")

if __name__ == '__main__':
    main()
`;

  const subLinhDetails = {
    score: 9.5,
    status: 'COMPLETED',
    aiRating: {
      codeSmells: [
        { line: 8, rule: 'Dependency Inversion Principle', description: 'Tight Coupling: Consider defining an interface or abstract base class for calculators and injecting dependencies rather than relying strictly on static methods.' },
        { line: 28, rule: 'Single Responsibility Principle', description: 'Mixed Responsibilities: Separate the input/output IO logic from the algorithmic computation logic to improve modularity.' },
      ],
      solidScore: { d: 6, i: 10, l: 10, o: 8, s: 8 },
      explanation: 'The submission demonstrates good overall code structure with meaningful naming, type hinting, and proper exception handling. The iterative Fibonacci calculation avoids deep recursion limits. However, the static method usage within a tightly coupled class design reduces dependency inversion, and standard I/O is hardcoded inside the execution flow.',
      cleanCodeScore: 8.5,
    },
    maxScore: 10,
    sourceCode: subLinhSource,
    completedAt: '2026-10-29T11:27:43.664Z',
    compileError: false,
    submissionId: 'SUB-250024-JAH7DL',
    overallResult: 'PASSED',
    scoreBreakdown: { solid: 0.8, total: 9.5, cleanCode: 1.7, testcase1: 2.3, testcase2: 4.7 },
    similarityRate: 76,
    totalTestcases: 3,
    executionTimeMs: 120,
    passedTestcases: 3,
    plagiarismMatch: {
      status: 'FLAGGED_HIGH',
      isFlagged: true,
      sourceCodeA: subLinhSource,
      sourceCodeB: subViktorSource,
      matchedTokens: [
        { lineA: [6, 6], lineB: [7, 7] },
        { lineA: [6, 7], lineB: [7, 8] },
        { lineA: [7, 8], lineB: [8, 9] },
        { lineA: [8, 9], lineB: [9, 10] },
        { lineA: [9, 10], lineB: [10, 11] },
        { lineA: [12, 13], lineB: [13, 14] },
        { lineA: [17, 19], lineB: [17, 19] },
        { lineA: [22, 24], lineB: [21, 23] },
        { lineA: [24, 26], lineB: [23, 25] },
        { lineA: [27, 29], lineB: [26, 28] },
        { lineA: [30, 32], lineB: [29, 31] },
      ],
      similarityRate: 76,
      executionTimeMs: 395,
      matchedStudentId: 'mochibunnyyy123@gmail.com',
      jaccardSimilarity: 61.29,
      matchedStudentName: 'Viktor Wilson',
      winnowingContainment: 76,
      astStructuralSimilarity: 76,
    },
    testcaseResults: [
      { score: 2.3, status: 'PASSED', timeMs: 40, maxScore: 2.3, testcaseIndex: 1 },
      { score: 2.3, status: 'PASSED', timeMs: 40, maxScore: 2.3, testcaseIndex: 2 },
      { score: 2.3, status: 'PASSED', timeMs: 40, maxScore: 2.3, testcaseIndex: 3 },
    ],
    plagiarismStatus: 'ĐẠO VĂN',
    confirmedPlagiarism: false,
    executedInContainer: true,
    computedScoreBeforePenalty: 9.5,
  };

  const subViktorDetails = {
    score: 9.9,
    status: 'COMPLETED',
    aiRating: {
      codeSmells: [],
      solidScore: { d: 10, i: 10, l: 10, o: 10, s: 10 },
      explanation: 'The student submission is exceptionally well-written, following Python best practices, PEP 8 guidelines, and strict SOLID principles. The code is clean, well-documented, includes appropriate input validation and error handling, and implements an efficient O(N) time and O(1) space algorithm.',
      cleanCodeScore: 9.5,
    },
    maxScore: 10,
    sourceCode: subViktorSource,
    completedAt: '2026-10-29T11:25:05.650Z',
    compileError: false,
    submissionId: 'SUB-100009-ETK78X',
    overallResult: 'PASSED',
    scoreBreakdown: { solid: 1.0, total: 9.9, cleanCode: 1.9, testcase1: 2.3, testcase2: 4.7 },
    similarityRate: 8,
    totalTestcases: 3,
    executionTimeMs: 130,
    passedTestcases: 3,
    plagiarismMatch: {
      status: 'CLEAN',
      isFlagged: false,
      similarityRate: 8,
      executionTimeMs: 312,
      matchedStudentId: 'linhcampochia@gmail.com',
      jaccardSimilarity: 2.61,
      matchedStudentName: 'Linh Campochia',
      winnowingContainment: 8,
      astStructuralSimilarity: 8,
    },
    testcaseResults: [
      { score: 2.3, status: 'PASSED', timeMs: 40, maxScore: 2.3, testcaseIndex: 1 },
      { score: 2.3, status: 'PASSED', timeMs: 50, maxScore: 2.3, testcaseIndex: 2 },
      { score: 2.3, status: 'PASSED', timeMs: 40, maxScore: 2.3, testcaseIndex: 3 },
    ],
    plagiarismStatus: 'AN TOÀN',
    confirmedPlagiarism: false,
    executedInContainer: true,
    computedScoreBeforePenalty: 9.9,
  };

  // 1. Bài nộp của Linh Campochia (Đạo văn 76%)
  submissionsData.push({
    submission_id: 'SUB-250024-JAH7DL',
    assignment_id: 'ASM-219423',
    student_id: 'linhcampochia@gmail.com',
    file_hash: '56d28388f9ed6c3ef8b6e6d85656cc346fefa4c1403416fe36921259577810f2',
    sha256_hash: '56d28388f9ed6c3ef8b6e6d85656cc346fefa4c1403416fe36921259577810f2',
    file_path: 'uploads/submissions/SUB-250024-JAH7DL.zip',
    file_name: 'python_plagiarism_78.zip',
    file_size_bytes: 592,
    language: 'python',
    status: 'COMPLETED',
    queue_job_id: 'job_SUB-250024-JAH7DL',
    testcase_score: 6.70,
    final_score: 9.50,
    score: 9.50,
    details: JSON.stringify(subLinhDetails),
    created_at: new Date('2026-10-29T11:27:30.064Z'),
    updated_at: new Date('2026-10-29T11:27:43.670Z'),
  });

  // 2. Bài nộp của Viktor Wilson (An toàn 8%)
  submissionsData.push({
    submission_id: 'SUB-100009-ETK78X',
    assignment_id: 'ASM-219423',
    student_id: 'mochibunnyyy123@gmail.com',
    file_hash: '196fc19d04be2e01bc1e1c7b26341521d6246ba7e63eca66e9a9f481c5179486',
    sha256_hash: '196fc19d04be2e01bc1e1c7b26341521d6246ba7e63eca66e9a9f481c5179486',
    file_path: 'uploads/submissions/SUB-100009-ETK78X.zip',
    file_name: 'python_pass_100.zip',
    file_size_bytes: 643,
    language: 'python',
    status: 'COMPLETED',
    queue_job_id: 'job_SUB-100009-ETK78X',
    testcase_score: 6.90,
    final_score: 9.90,
    score: 9.90,
    details: JSON.stringify(subViktorDetails),
    created_at: new Date('2026-10-29T11:25:00.126Z'),
    updated_at: new Date('2026-10-29T11:25:05.657Z'),
  });

  // Chi tiết testcase của 2 bài nộp
  const expTcIds = [
    'f80d6e90-d4b9-4e10-abaf-484e7caeee9d',
    '82a22505-371b-46d3-9701-dd4c7896536a',
    'af7a9675-3715-4e8a-b362-346302546b29',
  ];
  expTcIds.forEach((tcId, idx) => {
    submissionDetailsData.push({
      detail_id: `DTL-SUB-250024-JAH7DL-TC${idx + 1}`,
      submission_id: 'SUB-250024-JAH7DL',
      test_case_id: tcId,
      status: 'PASS',
      actual_output: idx === 2 ? '5' : '1',
      time_ms: 40,
      memory_kb: 5500 + idx * 50,
      error_log: null,
      created_at: new Date('2026-10-29T11:27:43.676Z'),
    });
    submissionDetailsData.push({
      detail_id: `DTL-SUB-100009-ETK78X-TC${idx + 1}`,
      submission_id: 'SUB-100009-ETK78X',
      test_case_id: tcId,
      status: 'PASS',
      actual_output: idx === 2 ? '5' : '1',
      time_ms: 40 + idx * 5,
      memory_kb: 5600 + idx * 100,
      error_log: null,
      created_at: new Date('2026-10-29T11:25:05.666Z'),
    });
  });

  // AI Review results
  aiReviewsData.push({
    review_id: 'REV-SUB-250024-JAH7DL',
    submission_id: 'SUB-250024-JAH7DL',
    clean_code_score: 8.5,
    solid_score: 8.4,
    code_smells_count: 2,
    feedback_json: JSON.stringify(subLinhDetails.aiRating.codeSmells),
    compiler_explanation: subLinhDetails.aiRating.explanation,
    model_used: 'gemini-1.5-pro',
    token_usage: JSON.stringify({ promptTokens: 350, completionTokens: 180, totalTokens: 530 }),
    evaluated_at: new Date('2026-10-29T11:27:43.664Z'),
    created_at: new Date('2026-10-29T11:27:43.664Z'),
    updated_at: new Date('2026-10-29T11:27:43.664Z'),
  });

  aiReviewsData.push({
    review_id: 'REV-SUB-100009-ETK78X',
    submission_id: 'SUB-100009-ETK78X',
    clean_code_score: 9.5,
    solid_score: 10.0,
    code_smells_count: 0,
    feedback_json: JSON.stringify([]),
    compiler_explanation: subViktorDetails.aiRating.explanation,
    model_used: 'gemini-1.5-pro',
    token_usage: JSON.stringify({ promptTokens: 340, completionTokens: 150, totalTokens: 490 }),
    evaluated_at: new Date('2026-10-29T11:25:05.650Z'),
    created_at: new Date('2026-10-29T11:25:05.650Z'),
    updated_at: new Date('2026-10-29T11:25:05.650Z'),
  });

  for (const chunk of chunkArray(submissionsData, 25)) {
    await knex('submissions').insert(chunk).onConflict('submission_id').merge();
  }
  for (const chunk of chunkArray(submissionDetailsData, 40)) {
    await knex('submission_details').insert(chunk).onConflict('detail_id').merge();
  }
  for (const chunk of chunkArray(aiReviewsData, 25)) {
    await knex('ai_review_results').insert(chunk).onConflict('review_id').merge();
  }

  // ==========================================================================
  // 8. AST_FINGERPRINTS (~250 fingerprints cho bài nộp)
  // ==========================================================================
  const fingerprintsData: any[] = [];
  for (let i = 0; i < 50; i++) {
    const sub = submissionsData[i];
    for (let k = 0; k < 5; k++) {
      fingerprintsData.push({
        fingerprint_id: `FP-${sub.submission_id}-${k}`,
        submission_id: sub.submission_id,
        hash_value: `winnowing_hash_${(i * 13 + k * 17) % 9999}_kgram`,
        token_position: k * 12,
        ast_node_type: k % 2 === 0 ? 'MethodDeclaration' : 'BinaryExpression',
        file_path: 'src/Solution.java',
        line_start: k * 8 + 1,
        line_end: k * 8 + 7,
        token_start: k * 15,
        token_end: k * 15 + 14,
      });
    }
  }

  // Fingerprints cho 2 bài nộp thực nghiệm TEST123456
  for (let k = 0; k < 20; k++) {
    const isCommon = k < 15;
    const commonHash = `winnowing_fib_${k * 77}_hash`;
    fingerprintsData.push({
      fingerprint_id: `FP-SUB-100009-ETK78X-${k}`,
      submission_id: 'SUB-100009-ETK78X',
      hash_value: isCommon ? commonHash : `winnowing_viktor_uniq_${k}`,
      token_position: k * 10,
      ast_node_type: 'WINNOWING_KGRAM',
      file_path: 'main',
      line_start: k * 2 + 1,
      line_end: k * 2 + 3,
      token_start: k * 10,
      token_end: k * 10 + 9,
    });
    fingerprintsData.push({
      fingerprint_id: `FP-SUB-250024-JAH7DL-${k}`,
      submission_id: 'SUB-250024-JAH7DL',
      hash_value: isCommon ? commonHash : `winnowing_linh_uniq_${k}`,
      token_position: k * 10,
      ast_node_type: 'WINNOWING_KGRAM',
      file_path: 'main',
      line_start: k * 2 + 1,
      line_end: k * 2 + 3,
      token_start: k * 10,
      token_end: k * 10 + 9,
    });
  }

  for (const chunk of chunkArray(fingerprintsData, 50)) {
    await knex('ast_fingerprints').insert(chunk).onConflict('fingerprint_id').ignore();
  }

  // ==========================================================================
  // 9. PLAGIARISM_REPORTS (21 Cặp đối sánh đạo văn)
  // ==========================================================================
  const plagiarismData: any[] = [
    // Báo cáo đạo văn thực nghiệm giữa Linh Campochia và Viktor Wilson (76%)
    {
      report_id: 'PLG-730b11f9-99db-4373-b11f-71bc6977f504',
      assignment_id: 'ASM-219423',
      submission_a_id: 'SUB-100009-ETK78X',
      submission_b_id: 'SUB-250024-JAH7DL',
      similarity_rate: 76.0,
      flagged_as_fraud: true,
      common_fingerprints_count: 28,
      total_unique_fingerprints: 45,
      matched_tokens_json: JSON.stringify(subLinhDetails.plagiarismMatch.matchedTokens),
      status: 'FLAGGED_PLAGIARISM',
      created_at: new Date('2026-10-29T11:27:43.650Z'),
    },
    // 2 cặp đạo văn nặng (để demo cờ gian lận đỏ và Monaco Diff Viewer)
    {
      report_id: 'PLAG-01',
      assignment_id: 'TASK-SWP391-SPRINT2',
      submission_a_id: 'SUB-DEMO-1001',
      submission_b_id: 'SUB-DEMO-1002',
      similarity_rate: 94.5,
      flagged_as_fraud: true,
      common_fingerprints_count: 38,
      total_unique_fingerprints: 40,
      matched_tokens_json: JSON.stringify([{ lineA: [12, 35], lineB: [14, 37], tokens: 85 }]),
      status: 'FLAGGED_PLAGIARISM',
    },
    {
      report_id: 'PLAG-02',
      assignment_id: 'TASK-SWP391-SPRINT2',
      submission_a_id: 'SUB-DEMO-1003',
      submission_b_id: 'SUB-DEMO-1004',
      similarity_rate: 81.2,
      flagged_as_fraud: true,
      common_fingerprints_count: 32,
      total_unique_fingerprints: 39,
      matched_tokens_json: JSON.stringify([{ lineA: [20, 48], lineB: [22, 50], tokens: 68 }]),
      status: 'FLAGGED_HIGH',
    },
    // 3 cặp nghi vấn
    {
      report_id: 'PLAG-03',
      assignment_id: 'TASK-SWP391-SPRINT2',
      submission_a_id: 'SUB-DEMO-1005',
      submission_b_id: 'SUB-DEMO-1006',
      similarity_rate: 56.4,
      flagged_as_fraud: false,
      common_fingerprints_count: 22,
      total_unique_fingerprints: 40,
      matched_tokens_json: JSON.stringify([{ lineA: [10, 25], lineB: [15, 30], tokens: 35 }]),
      status: 'SUSPECTED',
    },
    {
      report_id: 'PLAG-04',
      assignment_id: 'TASK-PRO192-A1',
      submission_a_id: 'SUB-DEMO-1007',
      submission_b_id: 'SUB-DEMO-1008',
      similarity_rate: 61.8,
      flagged_as_fraud: false,
      common_fingerprints_count: 25,
      total_unique_fingerprints: 41,
      matched_tokens_json: JSON.stringify([]),
      status: 'SUSPECTED',
    },
  ];

  // Thêm 15 cặp sạch (similarity 8% - 25%)
  for (let i = 5; i <= 20; i++) {
    const subA = submissionsData[i];
    const subB = submissionsData[i + 15];
    plagiarismData.push({
      report_id: `PLAG-${i.toString().padStart(2, '0')}`,
      assignment_id: subA.assignment_id,
      submission_a_id: subA.submission_id,
      submission_b_id: subB.submission_id,
      similarity_rate: Math.round((8.0 + Math.random() * 15.0) * 10) / 10,
      flagged_as_fraud: false,
      common_fingerprints_count: Math.floor(2 + Math.random() * 5),
      total_unique_fingerprints: 45,
      matched_tokens_json: JSON.stringify([]),
      status: 'CLEAN',
    });
  }

  await knex('plagiarism_reports').insert(plagiarismData).onConflict('report_id').ignore();

  // ==========================================================================
  // 10. APPEALS (~18 đơn phúc khảo điểm)
  // ==========================================================================
  const appealsData = [
    {
      appeal_id: 'APL-DEMO-01',
      submission_id: 'SUB-DEMO-1001',
      student_id: submissionsData[0].student_id,
      reason: 'Kính gửi Thầy, bài của em testcase 2 bị trừ điểm TLE do mảng 100k phần tử nhưng trên máy em chạy dưới 1s. Kính mong Thầy xem xét chấm lại.',
      status: 'PENDING',
      created_at: new Date(now.getTime() - 4 * 3600 * 1000),
    },
    {
      appeal_id: 'APL-DEMO-02',
      submission_id: 'SUB-DEMO-1003',
      student_id: submissionsData[2].student_id,
      reason: 'Thưa Thầy, em bị AI trừ điểm SOLID ở nguyên lý OCP. Em đã dùng Interface Factory nhưng AI nhận nhầm là vi phạm.',
      status: 'PENDING',
      created_at: new Date(now.getTime() - 10 * 3600 * 1000),
    },
    {
      appeal_id: 'APL-DEMO-03',
      submission_id: 'SUB-DEMO-1005',
      student_id: submissionsData[4].student_id,
      reason: 'Kính xin Thầy xem lại testcase 1 bị thiếu khoảng trắng ở cuối dòng nên hệ thống chấm sai.',
      status: 'IN_REVIEW',
      reviewer_id: 'GV001',
      created_at: new Date(now.getTime() - 24 * 3600 * 1000),
    },
    {
      appeal_id: 'APL-DEMO-04',
      submission_id: 'SUB-DEMO-1007',
      student_id: submissionsData[6].student_id,
      reason: 'Em khiếu nại điểm Clean Code vì tên biến viết tắt chuẩn domain nghiệp vụ.',
      status: 'ACCEPTED',
      reviewer_id: 'GV001',
      resolution_note: 'Đã kiểm tra lại cấu trúc mã nguồn. Đồng ý cộng 1.0 điểm Clean Code.',
      resolved_at: new Date(now.getTime() - 12 * 3600 * 1000),
      created_at: new Date(now.getTime() - 36 * 3600 * 1000),
    },
    {
      appeal_id: 'APL-DEMO-05',
      submission_id: 'SUB-DEMO-1009',
      student_id: submissionsData[8].student_id,
      reason: 'Em xin chấm lại vì nộp nhầm file zip cũ.',
      status: 'REJECTED',
      reviewer_id: 'GV001',
      resolution_note: 'Theo quy chế BR-02, không chấp nhận phúc khảo do nộp nhầm file sau khi đã hết hạn deadline.',
      resolved_at: new Date(now.getTime() - 6 * 3600 * 1000),
      created_at: new Date(now.getTime() - 48 * 3600 * 1000),
    },
  ];

  // Thêm 13 appeals khác
  for (let i = 6; i <= 18; i++) {
    const sub = submissionsData[i + 5];
    appealsData.push({
      appeal_id: `APL-DEMO-${i.toString().padStart(2, '0')}`,
      submission_id: sub.submission_id,
      student_id: sub.student_id,
      reason: `Kính gửi Thầy, em xin phúc khảo bài tập ${sub.assignment_id} về cách tính điểm test case.`,
      status: i % 3 === 0 ? 'ACCEPTED' : (i % 2 === 0 ? 'PENDING' : 'REJECTED'),
      reviewer_id: 'GV001',
      resolution_note: i % 3 === 0 ? 'Đã xem xét và điều chỉnh điểm hợp lý.' : (i % 2 === 0 ? null : 'Giữ nguyên kết quả.'),
      resolved_at: i % 2 !== 0 ? new Date() : null,
      created_at: new Date(now.getTime() - (i * 2 + 1) * 3600 * 1000),
    });
  }

  await knex('appeals').insert(appealsData).onConflict('appeal_id').ignore();

  // ==========================================================================
  // 11. TEAMWORK_METRICS (~45 sinh viên trong lớp CRS-SWP391)
  // ==========================================================================
  const teamworkData: any[] = [];
  studentUsers.slice(0, 45).forEach((stu, idx) => {
    // 3 sinh viên giả lập Free-Rider (< 10% đóng góp theo BR-12)
    const isFree = idx === 12 || idx === 25 || idx === 38;
    const commitCount = isFree ? Math.floor(1 + Math.random() * 2) : Math.floor(12 + Math.random() * 25);
    const linesAdded = isFree ? Math.floor(20 + Math.random() * 50) : Math.floor(1200 + Math.random() * 2500);
    const linesDeleted = isFree ? Math.floor(5 + Math.random() * 15) : Math.floor(150 + Math.random() * 450);
    const contributionPct = isFree
      ? Math.round((2.0 + Math.random() * 5.5) * 10) / 10
      : Math.round((18.0 + Math.random() * 17.0) * 10) / 10;

    teamworkData.push({
      metric_id: `METRIC-SWP-${(idx + 1).toString().padStart(3, '0')}`,
      class_id: 'CRS-SWP391',
      student_id: stu.userId,
      commit_count: commitCount,
      lines_added: linesAdded,
      lines_deleted: linesDeleted,
      contribution_pct: contributionPct,
      is_free_rider: isFree,
      analyzed_at: now,
    });
  });

  await knex('teamwork_metrics').insert(teamworkData).onConflict(['class_id', 'student_id']).ignore();

  // ==========================================================================
  // 12. DEAD_LETTER_JOBS (8 tasks lỗi retry)
  // ==========================================================================
  const dlqData = [
    {
      dlq_id: 'DLQ-DEMO-01',
      queue_name: 'submission-grading-queue',
      original_job_id: 'job-err-101',
      submission_id: 'SUB-DEMO-1001',
      payload: JSON.stringify({ submissionId: 'SUB-DEMO-1001', language: 'java' }),
      failed_reason: 'Docker Sandbox memory limit 512MB exceeded (Out of Memory OOMKilled)',
      attempts_made: 3,
      stacktrace: 'Error: OOMKilled container at processBatch (SandboxService:L142)',
      status: 'FAILED',
    },
    {
      dlq_id: 'DLQ-DEMO-02',
      queue_name: 'submission-grading-queue',
      original_job_id: 'job-err-102',
      submission_id: 'SUB-DEMO-1002',
      payload: JSON.stringify({ submissionId: 'SUB-DEMO-1002', language: 'cpp' }),
      failed_reason: 'Segmentation fault (Core Dumped) inside seccomp sandbox',
      attempts_made: 3,
      stacktrace: 'Signal 11 (SIGSEGV) code=1 at 0x7fff8123 (native binary)',
      status: 'FAILED',
    },
    {
      dlq_id: 'DLQ-DEMO-03',
      queue_name: 'submission-grading-queue',
      original_job_id: 'job-err-103',
      submission_id: 'SUB-DEMO-1003',
      payload: JSON.stringify({ submissionId: 'SUB-DEMO-1003', language: 'python' }),
      failed_reason: 'BullMQ Worker Connection Timeout after 3 retries',
      attempts_made: 3,
      stacktrace: 'TimeoutError: Redis connection dropped during payload transfer',
      status: 'RETRIED',
    },
  ];

  for (let i = 4; i <= 8; i++) {
    dlqData.push({
      dlq_id: `DLQ-DEMO-0${i}`,
      queue_name: 'submission-grading-queue',
      original_job_id: `job-err-10${i}`,
      submission_id: submissionsData[i + 2].submission_id,
      payload: JSON.stringify({ submissionId: submissionsData[i + 2].submission_id }),
      failed_reason: 'Test execution exceeded maximum timeout 2000ms',
      attempts_made: 3,
      stacktrace: 'TimeoutException: Sandbox did not terminate within threshold',
      status: i % 2 === 0 ? 'FAILED' : 'RETRIED',
    });
  }

  await knex('dead_letter_jobs').insert(dlqData).onConflict('dlq_id').ignore();

  // ==========================================================================
  // 13. AI_PROMPT_TEMPLATES
  // ==========================================================================
  const promptTemplates = [
    {
      template_id: 'TPL-CLEAN-CODE',
      template_code: 'CLEAN_CODE_SOLID_V1',
      version: 1,
      description: 'Đánh giá Clean Code và các nguyên lý SOLID deterministically',
      system_prompt: 'You are the Lead Code Reviewer and Architectural Evaluator for the AITA Autograding System. Evaluate student code for Clean Code quality and SOLID principles deterministically.',
      user_prompt_template: 'Evaluate the submission for {{language}}. Context: {{topic}}. Student Code:\n{{code}}',
      temperature: 0.2,
      json_schema: JSON.stringify({ type: 'object', properties: { clean_code_score: { type: 'number' }, solid_score: { type: 'number' }, code_smells: { type: 'array' } }, required: ['clean_code_score', 'solid_score', 'code_smells'] }),
      is_active: true,
    },
    {
      template_id: 'TPL-EXAM-GEN',
      template_code: 'EXAM_RUBRIC_V1',
      version: 1,
      description: 'Tạo đề thi và rubric đánh giá tự động cho giảng viên (UC-08)',
      system_prompt: 'You are an expert Computer Science Professor and Curriculum Designer for the AITA Autograding System.',
      user_prompt_template: 'Generate an assignment for course {{courseCode}}, topic {{topic}}.',
      temperature: 0.3,
      json_schema: JSON.stringify({ type: 'object', properties: { title: { type: 'string' }, sampleTestCases: { type: 'array' } }, required: ['title', 'sampleTestCases'] }),
      is_active: true,
    },
    {
      template_id: 'TPL-COMPILER-EXP',
      template_code: 'COMPILER_EXPLAIN_V1',
      version: 1,
      description: 'Giải thích lỗi biên dịch Socratic theo phương pháp sư phạm',
      system_prompt: 'You are a supportive programming teaching assistant. Explain compiler crashes clearly without revealing full solutions.',
      user_prompt_template: 'Language: {{language}}. Error log:\n{{compilerOutput}}',
      temperature: 0.2,
      json_schema: JSON.stringify({ type: 'object', properties: { errorType: { type: 'string' }, simpleExplanation: { type: 'string' } }, required: ['errorType', 'simpleExplanation'] }),
      is_active: true,
    },
  ];

  await knex('ai_prompt_templates').insert(promptTemplates).onConflict('template_code').ignore();

  // Đảm bảo file zip bài nộp mẫu tồn tại trong api-gateway/uploads/submissions để chức năng tải file hoạt động
  try {
    const uploadsDir = path.resolve(__dirname, '../../../uploads/submissions');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const rootDir = path.resolve(__dirname, '../../../../');
    const passZip = path.join(rootDir, 'python_pass_100.zip');
    const plagZip = path.join(rootDir, 'python_plagiarism_70.zip');
    const targetPass = path.join(uploadsDir, 'SUB-100009-ETK78X.zip');
    const targetPlag = path.join(uploadsDir, 'SUB-250024-JAH7DL.zip');

    if (fs.existsSync(passZip) && !fs.existsSync(targetPass)) {
      fs.copyFileSync(passZip, targetPass);
    }
    if (fs.existsSync(plagZip) && !fs.existsSync(targetPlag)) {
      fs.copyFileSync(plagZip, targetPlag);
    }
  } catch {
    // Non-fatal if filesystem copy fails
  }

  console.log('🎉 ĐÃ NẠP THÀNH CÔNG HƠN 800 BẢN GHI DỮ LIỆU MẪU VÀO CƠ SỞ DỮ LIỆU POSTGRESQL 15!');
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}
