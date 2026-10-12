# Kiến Trúc Cơ Sở Dữ Liệu AITA (Database Architecture)
## Hệ Thống Tự Động Chấm Điểm & Đánh Giá Mã Nguồn Bằng AI & AST

> **Chuẩn Milestone 2:** CSDL quan hệ chuẩn hóa 3NF đạt tối thiểu **10 bảng**, đầy đủ Khóa chính (PK), Khóa ngoại (FK), Ràng buộc toàn vẹn (CHECK constraints, UNIQUE), và Chỉ mục (B-Tree Indexes).

---

## 1. Danh Mục 10 Bảng Cơ Sở Dữ Liệu (3NF Normalized)

Hệ thống được thiết kế theo kiến trúc Microservices & Module tách biệt rõ ràng, phân bổ qua 3 phân hệ cốt lõi:

| STT | Tên Bảng (Table Name) | Phân Hệ / Subsystem | Mục Đích & Mô Tả Dữ Liệu | Khóa Chính (PK) | Khóa Ngoại (FK) |
|:---:|:---|:---|:---|:---|:---|
| **1** | `users` | Phân hệ 1 (Auth & Gateway) | Quản lý danh tính người dùng (Admin, Giảng viên, Sinh viên), mật khẩu mã hóa BCrypt, Google SSO email whitelist. | `user_id` | - |
| **2** | `courses` | Phân hệ 1 (Gateway & Academic) | Quản lý thông tin lớp môn học (PRF192, PRO192, SWP391), học kỳ, phân công giảng viên. | `course_id` | `instructor_id` $\rightarrow$ `users(user_id)` |
| **3** | `assignments` | Phân hệ 1 (Academic & Grading) | Đề bài thực hành, cấu hình bộ giới hạn Sandbox (RAM MB, CPU Time ms), danh sách ngôn ngữ cho phép, deadline. | `assignment_id` | `course_id` $\rightarrow$ `courses(course_id)` |
| **4** | `submissions` | Phân hệ 1 & 2 (Execution Pipeline) | Ghi nhận bài nộp zip của sinh viên, mã băm SHA-256 xác thực chống giả mạo, trạng thái hàng đợi BullMQ, điểm tổng. | `submission_id` | `student_id` $\rightarrow$ `users(user_id)`<br>`assignment_id` $\rightarrow$ `assignments(assignment_id)` |
| **5** | `dead_letter_jobs` | Phân hệ 1 & 2 (Fault Tolerance) | Bảng giám sát Dead Letter Queue (DLQ), lưu trữ job lỗi quá 3 lần retry, payload, stacktrace phục vụ replay. | `dlq_id` | `submission_id` $\rightarrow$ `submissions(submission_id)` |
| **6** | `ai_review_results` | Phân hệ 3 (GenAI Hub) | Kết quả thẩm định Clean Code, điểm SOLID (0.0 - 10.0), Code Smells phát hiện, giải thích lỗi biên dịch Socratic. | `review_id` | `submission_id` $\rightarrow$ `submissions(submission_id)` |
| **7** | `ai_prompt_templates` | Phân hệ 3 (GenAI Prompt Engine) | Quản lý phiên bản hóa System Prompts, JSON Schema ràng buộc đầu ra cho AI reviewer, nhiệt độ temperature. | `template_id` | - |
| **8** | `ast_fingerprints` | Phân hệ 4 (AST & Plagiarism) | Dấu vân tay số Winnowing băm từ cây cú pháp trừu tượng AST, định vị chính xác line & token trong mã nguồn. | `fingerprint_id` | `submission_id` $\rightarrow$ `submissions(submission_id)` |
| **9** | `plagiarism_reports` | Phân hệ 4 (Plagiarism Detection) | Ma trận đối sánh tương đồng pairwise giữa 2 bài nộp A và B, tỷ lệ giống nhau %, trạng thái cảnh báo đạo văn. | `report_id` | `submission_a_id` $\rightarrow$ `submissions(submission_id)`<br>`submission_b_id` $\rightarrow$ `submissions(submission_id)`<br>`assignment_id` $\rightarrow$ `assignments(assignment_id)` |
| **10** | `plagiarism_matches` | Phân hệ 4 (AST Segment Mapping) | Chi tiết các đoạn code trùng khớp giữa Submission A và B (tọa độ dòng bắt đầu/kết thúc) phục vụ Monaco Diff Viewer. | `match_id` | `report_id` $\rightarrow$ `plagiarism_reports(report_id)` |

---

## 2. Chiến Lược Lưu Trữ Kép (Dual-Persistence Architecture)

Hệ thống AITA hỗ trợ linh hoạt 2 chế độ vận hành:

1. **Chế độ Phát triển / Kiểm thử Tự Động (Dev & CI Standalone Mode):**
   - Triển khai **Repository Pattern** với Persistent Local JSON Stores (`api-gateway/data/*.json`) và in-memory caches.
   - Giúp chạy toàn bộ Unit Tests, E2E Tests, và CI/CD độc lập mà không bắt buộc cài đặt external database engine.
2. **Chế độ Triển Khai Thực Tế (Production / PostgreSQL 14+ Mode):**
   - File DDL Master: [`init_all_10_tables.sql`](file:///database/init_all_10_tables.sql)
   - Tương thích 100% với **PostgreSQL 14+**, **Neon Database**, **Supabase**, hoặc **Azure Database for PostgreSQL**.
   - Hỗ trợ đầy đủ `pgcrypto`, `JSONB`, `CHECK` constraints, và `ON DELETE CASCADE / RESTRICT`.

---

## 3. Hướng Dẫn Khởi Chạy Cơ Sở Dữ Liệu

### Cách 1: Khởi động nhanh với Docker Compose (Khuyến nghị)
Chạy lệnh sau tại thư mục gốc của dự án:
```bash
docker compose up -d
```
Hệ thống sẽ tự động khởi động:
- **PostgreSQL 15**: Port `5432`, Database `aita_autograding`, tự động nạp toàn bộ 10 bảng và dữ liệu mẫu (Seed Data).
- **Redis 7**: Port `6379`, phục vụ hàng đợi BullMQ chấm điểm.

### Cách 2: Nạp vào PostgreSQL sẵn có (Local hoặc Cloud)
```bash
psql -h <HOST> -U <USER> -d <DATABASE_NAME> -f database/init_all_10_tables.sql
```

### Cách 3: Nạp vào Supabase / Neon Dashboard
Mở **SQL Editor** trên Supabase hoặc Neon, copy toàn bộ nội dung file [`init_all_10_tables.sql`](file:///database/init_all_10_tables.sql) và nhấn **Run**.
