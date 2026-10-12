# QUY TẮC BẮT BUỘC DỰ ÁN AITA-INTELLIGENT (PROJECT SSOT RULES)

> **Mục đích:** Tệp quy tắc này được AI Agent tự động nạp vào bộ nhớ ngữ cảnh ở mọi phiên làm việc để đảm bảo tính nhất quán 100% với tài liệu đặc tả SRS (IEEE Std 830-1998) và kiến trúc hệ thống, ngăn chặn triệt để việc sai lệch hoặc quên các thực thể cốt lõi.

---

## 1. Cơ Sở Dữ Liệu Bắt Buộc (Database SSOT: Chính Xác 13 Thực Thể 3NF)

Khi thiết kế, truy vấn, kiểm thử hoặc trao đổi về Cơ sở dữ liệu của dự án AITA, **LUÔN LUÔN** tuân thủ chuẩn 13 bảng sau (tuyệt đối không được rút gọn về 10 bảng hay bất kỳ con số nào khác):

1. **`roles`**: Phân quyền RBAC (`ADMIN`, `HOD`, `LECTURER`, `STUDENT`).
2. **`users`**: Tài khoản, mã sinh viên (`student_code`), Google SSO email whitelist, mật khẩu BCrypt.
3. **`classes`**: Lớp học phần học kỳ (`SE1701-SWP391`, `PRO192`), học kỳ (`semester`), giảng viên phụ trách.
4. **`class_members`**: Danh sách sinh viên ghi danh trong lớp học phần (Roster).
5. **`assignments`**: Đề bài thực hành, hạn nộp (`due_date`), quota Sandbox (RAM 512MB, CPU 2.0s), ngôn ngữ.
6. **`test_cases`**: Test cases ẩn & công khai (Input, Output, trọng số `weight`, `time_limit_ms`).
7. **`submissions`**: Bài nộp code `.zip`, mã băm SHA-256 (`file_hash`), trạng thái chấm, điểm số.
8. **`submission_details`**: Log kết quả chi tiết từng testcase chạy trong Docker (PASS/FAIL/TLE/MLE/output/memory).
9. **`ai_review_results`**: Đánh giá Clean Code, điểm SOLID (0-10), danh sách code smells, phân tích lỗi crash.
10. **`ast_fingerprints`**: Dấu vân tay số Winnowing k-gram sinh ra từ cây cú pháp trừu tượng AST.
11. **`plagiarism_reports`**: Ma trận đối sánh độ tương đồng cặp bài nộp A-B (%), cờ gian lận `flagged_as_fraud`.
12. **`appeals`**: Đơn khiếu nại, phúc khảo điểm bài tập của sinh viên (`reason`, `status`, `resolution_note`).
13. **`teamwork_metrics`**: Đo lường đóng góp Git commit, LOC thêm/xóa để phát hiện "người đi nhờ xe" (free-rider).

*(Hai bảng phụ trợ hạ tầng microservices: `dead_letter_jobs` cho hàng đợi BullMQ DLQ, và `ai_prompt_templates` cho GenAI Hub).*

---

## 2. Nguyên Tắc Đối Chiếu Chéo (Cross-Verification Protocol)

1. **Luôn kiểm tra SRS trước khi thực thi**: Trước khi trả lời câu hỏi về số lượng bảng, API, Use Case, hay mô hình hóa UML, Agent phải tự động kiểm tra `PROJECT_CONTEXT_AITA.md` và `database/README.md`.
2. **Không bị "neo nhận thức" (Anchoring Bias)**: Yêu cầu của từng Milestone (ví dụ "tối thiểu 10 bảng cho Milestone 2") chỉ là tiêu chí chấm tạm thời, **KHÔNG ĐƯỢC** lấy đó làm giới hạn tổng thể của dự án thay cho tài liệu SRS 13 bảng.
3. **Lưu trữ kép (Dual-Persistence)**:
   - File JSON Store (`api-gateway/data/*.json`) phục vụ chạy test nhanh, độc lập.
   - Master PostgreSQL Script: [`database/init_all_13_tables.sql`](file:///database/init_all_13_tables.sql) phục vụ triển khai thực tế.
