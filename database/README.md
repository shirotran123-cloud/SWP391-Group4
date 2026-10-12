# Kiến Trúc Cơ Sở Dữ Liệu AITA (Database Architecture - SRS Compliant)
## Hệ Thống Tự Động Chấm Điểm & Đánh Giá Mã Nguồn Bằng AI & AST

> **Chuẩn Đặc Tả SRS (IEEE Std 830-1998 & ERD Mục 4):** CSDL quan hệ chuẩn hóa 3NF gồm **đúng 13 thực thể (13 Tables)** bao quát toàn bộ quy trình nghiệp vụ của AITA-Intelligent, cộng thêm **2 bảng hạ tầng hệ thống (Auxiliary Tables)** phục vụ hàng đợi Dead Letter Queue và quản lý phiên bản Prompt GenAI.

---

## 1. Bảng Đối Chiếu 13 Thực Thể Chuẩn SRS (Single Source of Truth)

| STT | Tên Bảng (SRS Entity) | Phân Hệ Nghiệp Vụ | Mục Đích & Mô Tả Dữ Liệu | Khóa Chính (PK) | Khóa Ngoại (FK) & Ràng Buộc |
|:---:|:---|:---|:---|:---|:---|
| **1** | `roles` | RBAC Security | Định nghĩa 4 vai trò hệ thống: `ADMIN`, `HOD` (Trưởng bộ môn), `LECTURER` (Giảng viên), `STUDENT` (Sinh viên). | `role_id` | `UNIQUE(role_name)` |
| **2** | `users` | Identity & Auth | Hồ sơ người dùng, mã sinh viên (`student_code`), Google SSO email whitelist, mật khẩu mã hóa BCrypt. | `user_id` | `role_id` $\rightarrow$ `roles(role_id)` |
| **3** | `classes` | Academic Management | Lớp học phần học kỳ (`SE1701-SWP391`, `PRO192`), học kỳ (`semester`), giảng viên phụ trách. | `class_id` | `lecturer_id` $\rightarrow$ `users(user_id)` |
| **4** | `class_members` | Course Enrollment | Danh sách điểm danh sinh viên trong từng lớp học phần (Roster). | `member_id` | `class_id` $\rightarrow$ `classes`<br>`user_id` $\rightarrow$ `users`<br>`UNIQUE(class_id, user_id)` |
| **5** | `assignments` | Academic & Grading | Đề bài thực hành, hạn nộp (`due_date`), hạn ngạch tài nguyên Sandbox (RAM 512MB, CPU 2.0s), ngôn ngữ cho phép. | `assignment_id` | `class_id` $\rightarrow$ `classes(class_id)` |
| **6** | `test_cases` | Verification Suites | Bộ test case công khai và ẩn (Input/Output, trọng số `weight`, thời gian tối đa `time_limit_ms`). | `test_case_id` | `assignment_id` $\rightarrow$ `assignments(assignment_id)` |
| **7** | `submissions` | Execution Pipeline | Ghi nhận gói code `.zip`, mã băm SHA-256 (`file_hash`), trạng thái chấm BullMQ, điểm testcase và điểm tổng kết. | `submission_id` | `assignment_id` $\rightarrow$ `assignments`<br>`student_id` $\rightarrow$ `users` |
| **8** | `submission_details` | Sandbox Execution Logs | Chi tiết kết quả chạy từng test case trong container Docker (PASS, FAIL, TLE, MLE, actual output, memory KB, error log). | `detail_id` | `submission_id` $\rightarrow$ `submissions`<br>`test_case_id` $\rightarrow$ `test_cases` |
| **9** | `ai_review_results` | GenAI Hub Review | Điểm Clean Code, điểm SOLID (0.0 - 10.0), số lượng code smells, giải thích lỗi crash Socratic từ LLM. | `review_id` | `submission_id` $\rightarrow$ `submissions(submission_id)` |
| **10** | `ast_fingerprints` | AST Winnowing Hashes | Dấu vân tay số k-gram sinh ra từ cây cú pháp trừu tượng AST (vị trí token, dòng code, node type). | `fingerprint_id` | `submission_id` $\rightarrow$ `submissions(submission_id)` |
| **11** | `plagiarism_reports` | Fraud Detection | Báo cáo đối sánh độ tương đồng cặp bài nộp (A và B), tỷ lệ trùng lặp %, gắn cờ gian lận (`flagged_as_fraud`). | `report_id` | `submission_a_id`, `submission_b_id` $\rightarrow$ `submissions`<br>`assignment_id` $\rightarrow$ `assignments` |
| **12** | `appeals` | Grade Dispute Workflow | Đơn khiếu nại/phúc khảo điểm của sinh viên (`reason`), trạng thái (`PENDING/ACCEPTED/REJECTED`), giảng viên thụ lý. | `appeal_id` | `submission_id` $\rightarrow$ `submissions`<br>`student_id`, `reviewer_id` $\rightarrow$ `users` |
| **13** | `teamwork_metrics` | Git Free-Rider Audit | Phân tích đóng góp qua Git commit, LOC thêm/xóa, % đóng góp của sinh viên để phát hiện "người đi nhờ xe" (free-rider). | `metric_id` | `class_id` $\rightarrow$ `classes`<br>`student_id` $\rightarrow$ `users`<br>`UNIQUE(class_id, student_id)` |

---

## 2. Bảng Hạ Tầng Bổ Trợ (Auxiliary Infrastructure Tables)

Nhằm đảm bảo tính chịu lỗi (Fault Tolerance) và khả năng quản lý động cho hệ thống Microservices:

| STT | Tên Bảng | Phân Hệ | Mục Đích Sử Dụng |
|:---:|:---|:---|:---|
| **14** | `dead_letter_jobs` | BullMQ Queue | Lưu trữ các tác vụ chấm bài thất bại quá 3 lần retry (Exponential Backoff), phục vụ cơ chế replay và giám sát lỗi. |
| **15** | `ai_prompt_templates` | GenAI Hub | Quản lý phiên bản System Prompts, JSON Schema và cấu hình nhiệt độ (Temperature) mà không cần deploy lại code. |

---

## 3. Khởi Chạy Cơ Sở Dữ Liệu 1-Click

### Với Docker Compose:
```bash
docker compose up -d
```
Docker sẽ khởi tạo PostgreSQL 15 trên cổng `5432` và tự động thực thi nạp toàn bộ cấu trúc 13 bảng SRS kèm dữ liệu mẫu từ [`database/init_all_13_tables.sql`](file:///database/init_all_13_tables.sql).
