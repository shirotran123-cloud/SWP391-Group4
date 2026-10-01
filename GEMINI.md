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

## 2. 12 Use Cases Chuẩn SRS IEEE Std 830-1998

1. **UC-01**: Login via Google SSO (Domain Whitelist).
2. **UC-02**: Bulk Import Students via Excel (100% ACID SQL Transaction Rollback).
3. **UC-03**: Create Assignment & Configure Test Cases / Scoring Rubric.
4. **UC-04**: Submit Assignment (.zip Package, SHA-256, < 10MB, BullMQ).
5. **UC-05**: Real-time Grading Progress Tracking (WebSocket Socket.IO telemetry).
6. **UC-06**: View Detailed Evaluation & Appeal Score (Dispute window <= 48h, max 2 appeals).
7. **UC-07**: Isolated Code Execution (Docker 512MB Sandbox, 1 CPU, 2.0s TLE, Seccomp, no-network).
8. **UC-08**: AI-Assisted Exam & Rubric Generation (Few-shot, structured JSON schema).
9. **UC-09**: Semantic Clean Code & SOLID Review via GenAI (0.0-10.0, Temperature=0.2, prompt injection defense).
10. **UC-10**: AST Source Code Normalization (Tree-sitter/ANTLR, strip identifiers & comments).
11. **UC-11**: Winnowing Fingerprinting & Similarity Matrix Calculation (Jaccard index, >= 70% FLAGGED, >= 80% score 0).
12. **UC-12**: Git-based Teamwork Analytics (Commit & LOC tracking, contribution < 10% free-rider flag).

---

## 3. Quy Tắc Nghiệp Vụ Cốt Lõi (Business Rules)

- **BR-01**: Google SSO Whitelisting (@fpt.edu.vn / @fe.edu.vn cho Giảng viên/Admin, @gmail.com cho Sinh viên).
- **BR-02**: Đóng cổng nộp khi quá `due_date`, bảo toàn nguyên vẹn mã băm SHA-256 cho mọi lần nộp.
- **BR-03 (Công thức Điểm Tổng Hợp)**:
  $$\text{Final Score} = 70\% \times \text{Testcase Score} + 30\% \times \text{GenAI Quality Score (Clean Code \& SOLID)}$$
  - Lỗi biên dịch (CE) $\rightarrow$ Testcase = 0, AI chỉ giải thích lỗi tự nhiên mà không chấm Clean Code.
  - Đạo văn AST $\ge 80\%$ xác nhận $\rightarrow$ Điểm = 0 không thể hoàn tác.
- **BR-04**: Báo cáo đạo văn tuyệt đối không công khai cho sinh viên (chỉ dành cho Giảng viên/HOD).
- **BR-05**: Phúc khảo điểm chỉ cho phép $\le 2$ lần/bài nộp trong vòng $48$ giờ sau khi công bố kết quả.

---

## 4. Ràng Buộc Kỹ Thuật (Constraints) & NFR

- **Sandbox Boundary**: RAM $\le$ 512MB, Swap $\le$ 512MB, CPU $\le$ 1.0 core, `pids-limit` = 64, `--network none`, timeout 2.0s. Teardown container $\le$ 1.0s.
- **Upload Limits**: File `.zip` bài nộp $\le$ 10MB; File Excel import $\le$ 5MB, $\le$ 500 dòng/batch.
- **GenAI Ceiling**: Cửa sổ trượt tối đa 8,000 tokens, lọc bỏ mã nhị phân/thư viện ngoài trước khi gửi prompt.
- **Hiệu năng & Độ tin cậy**: Phản hồi API có cache $< 100$ms, API thông thường $< 300$ms (p95), Uptime $\ge 99.5\%$, Retry BullMQ tối đa 3 lần qua DLQ.
