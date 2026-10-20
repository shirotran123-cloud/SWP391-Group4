import { Knex } from 'knex';

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
    { userId: 'HOD001', roleId: 'HOD', role: 'HOD', email: 'truongbm@fe.edu.vn', fullName: 'TS. Nguyễn Văn Hùng (Trưởng Bộ Môn)' },
    { userId: 'GV001', roleId: 'LECTURER', role: 'INSTRUCTOR', email: 'trungdt@fe.edu.vn', fullName: 'ThS. Đinh Thành Trung (Giảng viên)' },
    { userId: 'GV002', roleId: 'LECTURER', role: 'INSTRUCTOR', email: 'namlh@fe.edu.vn', fullName: 'TS. Lê Hoàng Nam (Giảng viên)' },
    { userId: 'GV003', roleId: 'LECTURER', role: 'INSTRUCTOR', email: 'huypq@fe.edu.vn', fullName: 'ThS. Phạm Quang Huy (Giảng viên)' },
    { userId: 'GV004', roleId: 'LECTURER', role: 'INSTRUCTOR', email: 'phuongttb@fe.edu.vn', fullName: 'TS. Trần Thị Bích Phượng (Giảng viên)' },
  ];

  // 50 Sinh viên với tên tiếng Việt thực tế
  const firstNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương'];
  const middleNames = ['Văn', 'Thị', 'Đức', 'Thành', 'Hoàng', 'Minh', 'Thanh', 'Quang', 'Ngọc', 'Hải', 'Tuấn', 'Quốc', 'Anh'];
  const lastNames = ['An', 'Bình', 'Cường', 'Dũng', 'Đạt', 'Giang', 'Hải', 'Huy', 'Khoa', 'Long', 'Minh', 'Nam', 'Nghĩa', 'Phúc', 'Quân', 'Sơn', 'Tài', 'Thắng', 'Trí', 'Tùng', 'Vinh', 'Vy', 'Yến', 'Trang', 'Phương', 'Linh', 'Nguyên'];

  const studentUsers: any[] = [];
  for (let i = 0; i < 50; i++) {
    const codeNum = (170000 + i).toString();
    const studentCode = `SE${codeNum}`;
    const fn = firstNames[i % firstNames.length];
    const mn = middleNames[(i * 3) % middleNames.length];
    const ln = lastNames[(i * 7) % lastNames.length];
    const fullName = `${fn} ${mn} ${ln}`;
    const email = `${ln.toLowerCase()}.${studentCode.toLowerCase()}@fpt.edu.vn`;

    studentUsers.push({
      userId: studentCode,
      roleId: 'STUDENT',
      role: 'STUDENT',
      studentCode,
      email,
      fullName,
    });
  }

  const allUsers = [...staffUsers, ...studentUsers].map((u) => ({
    user_id: u.userId,
    role_id: u.roleId,
    email: u.email,
    full_name: u.fullName,
    student_code: u.studentCode || null,
    role: u.role,
    password_hash: pwdHash,
    is_active: true,
  }));

  for (const chunk of chunkArray(allUsers, 20)) {
    await knex('users').insert(chunk).onConflict('user_id').ignore();
  }

  // ==========================================================================
  // 3. CLASSES (5 Lớp Học Phần)
  // ==========================================================================
  const classesData = [
    { class_id: 'CRS-SWP391', lecturer_id: 'GV001', class_code: 'SE1701-SWP391', class_name: 'Application Development Project (SWP391)', semester: 'Fall 2026', description: 'Dự án Phát triển phần mềm thực chiến Scrum' },
    { class_id: 'CRS-PRO192', lecturer_id: 'GV001', class_code: 'SE1702-PRO192', class_name: 'Object-Oriented Programming (PRO192)', semester: 'Fall 2026', description: 'Lập trình hướng đối tượng với Java Core' },
    { class_id: 'CRS-PRN211', lecturer_id: 'GV002', class_code: 'SE1703-PRN211', class_name: 'Basic Cross-Platform .NET (PRN211)', semester: 'Fall 2026', description: 'Lập trình ứng dụng đa nền tảng với .NET Core' },
    { class_id: 'CRS-CSD201', lecturer_id: 'GV003', class_code: 'SE1704-CSD201', class_name: 'Data Structures and Algorithms (CSD201)', semester: 'Fall 2026', description: 'Cấu trúc dữ liệu và giải thuật nâng cao' },
    { class_id: 'CRS-MAS291', lecturer_id: 'GV004', class_code: 'SE1705-MAS291', class_name: 'Statistics & Probability for CS (MAS291)', semester: 'Fall 2026', description: 'Xác suất thống kê ứng dụng cho Kỹ sư phần mềm' },
  ];
  await knex('classes').insert(classesData).onConflict('class_id').ignore();

  // ==========================================================================
  // 4. CLASS_MEMBERS (~130 lượt ghi danh sinh viên)
  // ==========================================================================
  const enrollments: any[] = [];
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
  // 5. ASSIGNMENTS (8 Đề bài thực hành)
  // ==========================================================================
  const now = new Date();
  const futureDue = new Date(now.getTime() + 14 * 86400 * 1000);
  const pastDue = new Date(now.getTime() - 2 * 86400 * 1000);

  const assignmentsData = [
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
      testcases_count: 2,
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
      testcases_count: 3,
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
      testcases_count: 3,
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
      testcases_count: 2,
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
      testcases_count: 3,
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
      testcases_count: 2,
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
      testcases_count: 3,
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
      testcases_count: 3,
    },
  ];

  await knex('assignments').insert(assignmentsData).onConflict('assignment_id').ignore();

  // ==========================================================================
  // 6. TEST_CASES (~24 test cases)
  // ==========================================================================
  const testCasesData: any[] = [];
  assignmentsData.forEach((a) => {
    testCasesData.push({
      test_case_id: `TC-${a.assignment_id}-01`,
      assignment_id: a.assignment_id,
      input_data: '5\n4 2 5 1 3',
      expected_output: '1 2 3 4 5',
      is_hidden: false,
      weight: 1.0,
      time_limit_ms: a.time_limit_ms,
    });
    testCasesData.push({
      test_case_id: `TC-${a.assignment_id}-02`,
      assignment_id: a.assignment_id,
      input_data: '10\n10 9 8 7 6 5 4 3 2 1',
      expected_output: '1 2 3 4 5 6 7 8 9 10',
      is_hidden: true,
      weight: 1.0,
      time_limit_ms: a.time_limit_ms,
    });
    testCasesData.push({
      test_case_id: `TC-${a.assignment_id}-03`,
      assignment_id: a.assignment_id,
      input_data: '3\n-5 0 10',
      expected_output: '-5 0 10',
      is_hidden: true,
      weight: 1.0,
      time_limit_ms: a.time_limit_ms,
    });
  });

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

  // Sinh 80 bài nộp
  for (let i = 0; i < 80; i++) {
    const subId = `SUB-DEMO-${(1001 + i).toString()}`;
    const stu = studentUsers[i % studentUsers.length];
    const assign = assignmentsData[i % assignmentsData.length];
    const lang = languages[i % languages.length];

    // Tạo điểm ngẫu nhiên thực tế (từ 4.5 đến 10.0)
    const baseScore = Math.min(10.0, Math.round((5.0 + Math.random() * 5.0) * 10) / 10);
    const tc1Passed = baseScore >= 5.0;
    const tc2Passed = baseScore >= 7.5;
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
      details: JSON.stringify({ passedTestcases: tc2Passed ? 2 : (tc1Passed ? 1 : 0), totalTestcases: 2 }),
      created_at: subTime,
      updated_at: subTime,
    });

    if (status === 'COMPLETED') {
      // 2 testcase logs
      submissionDetailsData.push({
        detail_id: `DTL-${subId}-01`,
        submission_id: subId,
        test_case_id: `TC-${assign.assignment_id}-01`,
        status: tc1Passed ? 'PASS' : 'FAIL',
        actual_output: tc1Passed ? '1 2 3 4 5' : 'Output mismatch at index 2',
        time_ms: Math.floor(20 + Math.random() * 80),
        memory_kb: Math.floor(15000 + Math.random() * 5000),
        error_log: tc1Passed ? null : 'Sai kết quả so với mong đợi trên test case cơ bản',
        created_at: subTime,
      });

      submissionDetailsData.push({
        detail_id: `DTL-${subId}-02`,
        submission_id: subId,
        test_case_id: `TC-${assign.assignment_id}-02`,
        status: tc2Passed ? 'PASS' : (baseScore < 6.0 ? 'TLE' : 'FAIL'),
        actual_output: tc2Passed ? '1 2 3 4 5 6 7 8 9 10' : '',
        time_ms: tc2Passed ? Math.floor(150 + Math.random() * 300) : 2005,
        memory_kb: Math.floor(18000 + Math.random() * 8000),
        error_log: tc2Passed ? null : 'Vượt quá thời gian tối đa Time Limit Exceeded (2.0s)',
        created_at: subTime,
      });

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

  for (const chunk of chunkArray(submissionsData, 25)) {
    await knex('submissions').insert(chunk).onConflict('submission_id').ignore();
  }
  for (const chunk of chunkArray(submissionDetailsData, 40)) {
    await knex('submission_details').insert(chunk).onConflict('detail_id').ignore();
  }
  for (const chunk of chunkArray(aiReviewsData, 25)) {
    await knex('ai_review_results').insert(chunk).onConflict('review_id').ignore();
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
  for (const chunk of chunkArray(fingerprintsData, 50)) {
    await knex('ast_fingerprints').insert(chunk).onConflict('fingerprint_id').ignore();
  }

  // ==========================================================================
  // 9. PLAGIARISM_REPORTS (20 Cặp đối sánh đạo văn)
  // ==========================================================================
  const plagiarismData: any[] = [
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

  console.log('🎉 ĐÃ NẠP THÀNH CÔNG HƠN 800 BẢN GHI DỮ LIỆU MẪU VÀO CƠ SỞ DỮ LIỆU POSTGRESQL 15!');
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}
