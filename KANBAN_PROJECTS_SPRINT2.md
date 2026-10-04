# 📋 AITA PLATFORM - KANBAN PROJECTS & CI/CD GOVERNANCE
## BẢNG QUẢN TRỊ TIẾN ĐỘ SPRINT 2 (TUẦN 4) - NHÓM 4
**Người phụ trách quản trị (Lead & System Architect):** Đinh Thanh Trung (SE170000)

---

## 🎯 1. GitHub Projects Kanban Board Structure

Hệ thống quản lý công việc theo mô hình Kanban tinh gọn trên GitHub Projects, tuân thủ nghiêm ngặt **WIP Limits (Work-In-Progress)** để tránh nghẽn cổ chai:

| Cột Kanban | WIP Limit | Mô tả trạng thái | Tiêu chí chuyển trạng thái |
|:---|:---:|:---|:---|
| **1. Backlog** | $\infty$ | Danh sách các User Stories & Tasks đã lập kế hoạch cho Sprint 2 | Task đã được mô tả rõ Acceptance Criteria |
| **2. Ready (To Do)** | 8 | Các nhiệm vụ đã chuẩn bị kỹ thuật, sẵn sàng phân bổ lập trình viên | Có branch riêng `feature/<task-name>` |
| **3. In Progress** | 4 (1/dev) | Đang được các thành viên tích cực code và test nội bộ | Commit liên tục theo chuẩn Conventional Commits |
| **4. Code Review** | 3 | PR đã mở, chờ Team Leader (Đinh Thanh Trung) hoặc Peer review | Toàn bộ GitHub Actions CI xanh (PASS) |
| **5. Testing / QA** | 2 | Kiểm thử tích hợp End-to-End giữa Gateway - Sandbox - AI Hub | Vượt qua bộ test tự động `verify-gateway.ts` |
| **6. Done (DoD)** | $\infty$ | Đã merge vào `main` thông qua PR có Approval và deploy thành công | Đáp ứng 100% Definition of Done của Sprint |

---

## 📌 2. Danh sách Task Card trên GitHub Projects (Sprint 2)

### 🥇 Epics & Tasks - Đinh Thanh Trung (Team Leader & System Architect)
- **[AITA-101]** Kiến trúc cầu nối trung tâm NestJS API Gateway (Phân hệ 1 & 5). `[Done]`
- **[AITA-102]** Phát triển endpoint tiếp nhận bài nộp `POST /api/v1/submissions` (multipart/form-data, $\le 10$MB, SHA-256 hash). `[Done]`
- **[AITA-103]** Tích hợp hàng đợi phân tán Redis BullMQ với SLA phản hồi $< 200$ms. `[Done]`
- **[AITA-104]** Xây dựng WebSocket Socket.IO Gateway stream sự kiện `testcase:evaluated`, `grading:progress`, `grading:completed`. `[Done]`
- **[AITA-105]** Thiết lập GitHub Actions CI/CD Quality Gate, commitlint và Branch Protection rules. `[Done]`

### 🥈 Tasks - Đồng đội (Co-workers)
- **[AITA-201] (Vạn Thái Trung):** Docker Sandbox Container Isolation, Seccomp BPF filters, cgroups CPU/RAM constraints. `[In Progress]`
- **[AITA-301] (Trần Thanh Nguyên):** AST Tokenizer, Winnowing Fingerprinting Algorithm (w=10, k=15). `[In Progress]`
- **[AITA-401] (Vũ Hoàng Gia Bảo):** GenAI Hub Integration (GPT-4o / Gemini), Structured JSON Schema Mode, Few-shot Prompting. `[In Progress]`

---

## 🛡️ 3. Quy chuẩn Conventional Commits (Tối ưu điểm Git Analytics)

Để đạt điểm tuyệt đối ở tiêu chí **Git Analytics** của giảng viên (tần suất commit, tính nhất quán, cấu trúc commit rõ ràng), tất cả thành viên bắt buộc tuân thủ chuẩn sau:

### Cú pháp chuẩn (Format):
```
<type>(<scope>): <subject>

[optional body]

[optional footer(s)]
```

### Các tiền tố hợp lệ (Prefixes):
| Tiền tố | Mục đích | Ví dụ |
|:---|:---|:---|
| `feat:` | Bổ sung tính năng mới | `feat(gateway): add POST /api/v1/submissions with 202 Accepted` |
| `fix:` | Sửa lỗi hệ thống | `fix(queue): handle non-blocking redis connection fallback` |
| `perf:` | Tối ưu hóa hiệu năng ($<200$ms) | `perf(hash): accelerate sha256 calculation for 10MB zip` |
| `test:` | Viết test tự động | `test(gateway): add automated E2E test for testcase streaming` |
| `docs:` | Bổ sung tài liệu thiết kế, KANBAN | `docs(board): document Sprint 2 kanban and commit policies` |
| `refactor:` | Tái cấu trúc mã nguồn không đổi logic | `refactor(socket): modularize room joining by submissionId` |
| `ci:` | Cấu hình CI/CD và workflows | `ci(github): add commitlint and test suite execution action` |

---

## 🔒 4. Chính sách Code Review & Branch Protection

Giảng viên yêu cầu: *"Không có PR nào merge thẳng vào main mà không qua review."*

1. **Bảo vệ nhánh `main`:**
   - Kích hoạt quy tắc GitHub Branch Protection cho nhánh `main`.
   - **Require a pull request before merging:** Bật (Bắt buộc).
   - **Require approvals:** Tối thiểu 1 phê duyệt (Team Leader Đinh Thanh Trung duyệt kiến trúc).
   - **Require status checks to pass:** Tất cả các job trong `.github/workflows/ci.yml` phải xanh.
   - **Do not allow bypassing the above settings:** Áp dụng cho cả Administrators.

2. **Quy trình đóng góp (Git Flow):**
   ```text
   main (chỉ nhận PR đã review & test pass)
     ▲
     │  (Pull Request có Reviewer Approval)
     └── feature/AITA-102-submission-api
          (Commits tuân thủ Conventional Commits)
   ```
