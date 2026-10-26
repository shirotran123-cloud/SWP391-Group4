# 📌 BÁO CÁO TOÀN DIỆN CÁC VẤN ĐỀ TỒN ĐỌNG & KẾ HOẠCH NÂNG CẤP HỆ THỐNG AITA-INTELLIGENT
> **Dự án:** AITA-Intelligent (Hệ thống Chấm Mã Nguồn & Giám Sát Liêm Chính Học Thuật Tự Động)  
> **Học phần:** SWP391 - Đồ Án Phát Triển Phần Mềm (Chuẩn RBL 10 Tuần & IEEE Std 830-1998)  
> **Nhóm thực hiện:** Group 4 (5 Thành Viên)  
> **Thời điểm kiểm toán:** 25/10/2026 (Phiên bản đồng bộ sau khi kéo nhánh `origin/main`)

---

## 📑 MỤC LỤC
1. [Các Lỗi Nghiêm Trọng (Critical Bugs) Cần Sửa Gấp](#1-các-lỗi-nghiêm-trọng-critical-bugs-cần-sửa-gấp)
2. [Các Khâu Còn Dùng Mock / Dữ Liệu Tĩnh Cần Nâng Cấp](#2-các-khâu-còn-dùng-mock--dữ-liệu-tĩnh-cần-nâng-cấp)
3. [Khoảng Trống So Với Đề Cương 10 Tuần (RBL Syllabus Gap)](#3-khoảng-trống-so-với-đề-cương-10-tuần-rbl-syllabus-gap)
4. [Phân Chia Nhiệm Vụ Xử Lý Cho 5 Thành Viên](#4-phân-chia-nhiệm-vụ-xử-lý-cho-5-thành-viên)
5. [Checklist Chuẩn Bị Cho Ngày Bảo Vệ Trước Hội Đồng](#5-checklist-chuẩn-bị-cho-ngày-bảo-vệ-trước-hội-đồng)
6. [Kiểm Toán Toàn Diện Giao Diện & Trải Nghiệm Người Dùng (UI/UX Audit)](#6-kiểm-toán-toàn-diện-giao-diện--trải-nghiệm-người-dùng-uiux-audit)

---

## 1. CÁC LỖI NGHIÊM TRỌNG (CRITICAL BUGS) CẦN SỬA GẤP

### 🚨 Bug 1: Ép sai ngôn ngữ khi nộp bài làm hỏng bài thi C++ / C#
* **Vị trí code:** [`frontend/src/App.tsx`](file:///c:/Users/ADMIN/Documents/GitHub/SWP391-Group4/frontend/src/App.tsx#L415)
  ```typescript
  formData.append('language', codeToGrade.includes('def ') ? 'python' : 'java');
  ```
* **Mô tả & Hậu quả:**  
  Khi sinh viên nộp file `.zip`, hệ thống chỉ kiểm tra nếu có từ khóa `def ` thì gửi `python`, còn lại **tất cả đều ép thành `java`**. Nếu sinh viên nộp bài C++ (`.cpp`), C# (`.cs`), Backend Gateway sẽ chỉ tìm file `.java` trong zip $\to$ không tìm thấy $\to$ **đánh rớt bài nộp ngay lập tức với 0 điểm** (`INVALID_SUBMISSION`).
* **Giải pháp khắc phục:**  
  Lấy giá trị ngôn ngữ trực tiếp từ state `selectedLanguage` của sinh viên hoặc giải nén kiểm tra phần mở rộng file (`.cpp`, `.java`, `.py`, `.cs`) trước khi gửi request.

---

### 🚨 Bug 2: Đứt gãy lưu trữ Đề bài & Test Cases (Frontend kẹt ở LocalStorage)
* **Vị trí code:** [`frontend/src/components/LecturerDashboard.tsx`](file:///c:/Users/ADMIN/Documents/GitHub/SWP391-Group4/frontend/src/components/LecturerDashboard.tsx#L838-L845)
  ```typescript
  // Khi Giảng viên bấm "Lưu & Xuất Bản Bài Tập":
  const updatedAsms = [newAsm, ...publishedAssignments];
  setPublishedAssignments(updatedAsms);
  localStorage.setItem('aita_published_assignments', JSON.stringify(updatedAsms));
  ```
* **Mô tả & Hậu quả:**  
  Mặc dù AI Gemini sinh đề và test cases cực kỳ chuẩn xác, nhưng khi Giảng viên bấm xuất bản, dữ liệu **chỉ lưu vào `localStorage` của trình duyệt** mà **CHƯA GỬI VỀ BACKEND POSTGRESQL** (`POST /api/v1/assignments` và `POST /api/v1/test-cases`).
  * Hậu quả 1: Mở trình duyệt khác hoặc máy khác, sinh viên sẽ không thấy bài tập mới của Giảng viên.
  * Hậu quả 2: Khi sinh viên nộp bài, Backend Docker Sandbox truy vấn bảng `test_cases` trong PostgreSQL không thấy dữ liệu $\to$ **tự động rơi về bộ test case mặc định của bài toán Sorting**!
* **Giải pháp khắc phục:**  
  Bổ sung lời gọi API trong hàm `handleSaveAssignment`:
  1. `POST http://localhost:3000/api/v1/assignments`
  2. `POST http://localhost:3000/api/v1/test-cases` (lưu từng test case vào DB).

---

### 🚨 Bug 3: Giao diện Sinh viên đọc danh sách đề bài từ LocalStorage
* **Vị trí code:** [`frontend/src/components/SubmissionView.tsx`](file:///c:/Users/ADMIN/Documents/GitHub/SWP391-Group4/frontend/src/components/SubmissionView.tsx#L634)
  ```typescript
  const savedPublished = localStorage.getItem('aita_published_assignments');
  ```
* **Mô tả & Hậu quả:**  
  Sinh viên lấy đề bài từ bộ nhớ tạm của trình duyệt thay vì gọi API `GET /api/v1/assignments?courseId=...`. Dẫn đến việc dữ liệu giữa các máy không đồng bộ.
* **Giải pháp khắc phục:**  
  Chuyển sang `fetch('http://localhost:3000/api/v1/assignments')` khi component mount.

---

### 🚨 Bug 4: Tự động chạy Mock giả lập khi mất kết nối Socket.IO
* **Vị trí code:** [`frontend/src/App.tsx`](file:///c:/Users/ADMIN/Documents/GitHub/SWP391-Group4/frontend/src/App.tsx#L473-L480)
  ```typescript
  } catch (err) {
    console.warn('[Gateway] API Gateway lỗi kết nối, kích hoạt cơ chế mô phỏng tự động chuẩn xác:', err);
  }
  const subId = generateFallbackSubId();
  simulateSocketGradingEvents(computedPlagiarism);
  ```
* **Mô tả & Hậu quả:**  
  Nếu cổng WebSocket 3000 bị nghẽn hoặc rớt mạng, Frontend sẽ âm thầm gọi hàm `simulateSocketGradingEvents` (MOCK 100%) để chạy thanh tiến trình giả lập.
* **Giải pháp khắc phục:**  
  Hiển thị thông báo mất kết nối và nút *"Thử lại"* cho sinh viên, tránh rơi vào mock ngầm làm sai lệch kết quả chấm thực tế.

---

### 🚨 Bug 5: WebSocket Telemetry bị hardcode 2 Test Cases
* **Vị trí code:** [`api-gateway/src/queue/grading-worker.consumer.ts`](file:///c:/Users/ADMIN/Documents/GitHub/SWP391-Group4/api-gateway/src/queue/grading-worker.consumer.ts#L350-L405)
* **Mô tả & Hậu quả:**  
  Ở Bước 3 và Bước 4 của luồng chấm, server phát cứng sự kiện: `testcaseId: 'TC-01'`, `testcaseId: 'TC-02'`, `totalTestcases: 2` và `memoryKb: 16420`, bất kể đề thi thực tế có 5 hay 10 test cases.
* **Giải pháp khắc phục:**  
  Dùng vòng lặp `for (let i = 0; i < casesToRun.length; i++)` để phát sự kiện động theo số lượng test cases thực tế.

---

## 2. CÁC KHÂU CÒN DÙNG MOCK / DỮ LIỆU TĨNH CẦN NÂNG CẤP

| STT | Phân hệ / Nghiệp vụ | Hiện trạng kỹ thuật | Giải pháp nâng cấp thành THẬT 100% |
| :---: | :--- | :--- | :--- |
| **1** | **Git Teamwork Analytics (UC-12)** | File [`teamwork.repository.ts`](file:///c:/Users/ADMIN/Documents/GitHub/SWP391-Group4/api-gateway/src/database/teamwork.repository.ts) đang đọc danh sách 4 thành viên cố định từ file `teamwork_store.json` (`Đinh Thành Trung 14 commits`, `Nguyễn Văn Ỷ Lại 1 commit`). | Viết module Git CLI Parser thật (gọi lệnh `git log --shortstat` trên repository hoặc gọi GitHub API) để tính toán tỷ lệ đóng góp thực tế của từng thành viên. |
| **2** | **Circuit Breaker Fallback (Sandbox)** | Hàm `analyzeSourceCode()` trong [`grading-core.ts`](file:///c:/Users/ADMIN/Documents/GitHub/SWP391-Group4/api-gateway/src/queue/grading-core.ts) dùng Regex chỉ bắt được đề bài Thuật toán Sắp Xếp (Sorting). | Đảm bảo Docker Desktop luôn bật để chạy container thật 100%. Nếu có fallback, dùng AST Parser bóc tách thay vì regex cố định. |
| **3** | **CSDL Dual-Mode Fallback** | Nếu không có container PostgreSQL 15, các repository âm thầm ghi vào file JSON (`data/*.json`). | Luôn khởi động `docker-compose.yml` trước khi chạy server; chạy `npm run db:migrate` để đảm bảo lưu dữ liệu vào PostgreSQL thật. |
| **4** | **GenAI Review (UC-09)** | Đã cấu hình Key thật và Model `gemini-flash-lite-latest` tại `genai-hub/.env`. | Cần đảm bảo tiến trình `genai-hub` (port 3001) luôn được khởi động song song với API Gateway khi chạy hệ thống. |

---

## 3. KHOẢNG TRỐNG SO VỚI ĐỀ CƯƠNG 10 TUẦN (RBL SYLLABUS GAP)

So chiếu với tài liệu [`RBL_Syllabus_AITA_10Weeks.md`](file:///c:/Users/ADMIN/Documents/GitHub/SWP391-Group4/RBL_Syllabus_AITA_10Weeks.md), nhóm cần hoàn thiện 4 hạng mục sau để đạt điểm tối đa tại vòng **Final Defense (Tuần 10)**:

1. **📄 Báo cáo Nghiên cứu Khoa học RBL chuẩn IEEE (6 - 8 trang):**
   * *Yêu cầu:* Viết bài báo khoa học theo cấu trúc chuẩn IEEE (2 cột) với tiêu đề: *"A Comparative Study of AST-based Winnowing and Tree Edit Distance in Detecting GenAI-Obfuscated Source Code"*.
   * *Nội dung bắt buộc:* Bảng số liệu thực nghiệm so sánh độ nhạy và thời gian xử lý giữa AST Winnowing vs text diff truyền thống khi đối phó với mã nguồn bị ChatGPT đổi tên biến/đảo hàm.
   * *Trọng số:* Chiếm tới 15% - 40% điểm tổng kết.

2. **☁️ Triển khai lên Môi trường Cloud thực tế (Deployment):**
   * *Yêu cầu của Milestone 3 (Tuần 8):* Hệ thống không chỉ chạy ở `localhost` mà cần deploy live:
     * Frontend React: Deploy lên **Vercel** / Netlify.
     * API Gateway & Database: Deploy lên **Render / Railway / Supabase**.

3. **🧪 Độ bao phủ kiểm thử Unit Test đạt $\ge 80\%$:**
   * *Yêu cầu của Đề cương:* Mã nguồn bắt buộc phải vượt qua bài kiểm linting nghiêm ngặt và đạt độ bao phủ Unit Test tối thiểu 80% trên các module cốt lõi mới được chấm điểm tối đa. Hiện tại nhóm mới có test integration `verify-gateway.ts`.

4. **⚡ Stress Testing với 100 Requests đồng thời:**
   * *Yêu cầu của Tuần 9:* Chạy script kiểm thử tải (dùng `tools/stress-test-queue.py` hoặc `k6`) chứng minh hàng đợi BullMQ chịu được 100 bài nộp đồng thời với độ trễ phản hồi p95 < 100ms.

---

## 4. PHÂN CHIA NHIỆM VỤ XỬ LÝ CHO 5 THÀNH VIÊN

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                            BẢNG PHÂN CÔNG GIẢI QUYẾT TỒN ĐỌNG CHO 5 BẠN                          │
├────────────────────┬────────────────────┬────────────────────┬───────────────────┬───────────────┤
│    THÀNH VIÊN 1    │    THÀNH VIÊN 2    │    THÀNH VIÊN 3    │   THÀNH VIÊN 4    │ THÀNH VIÊN 5  │
│ (Lead & DevOps)    │ (Sandbox & Worker) │ (GenAI Specialist) │ (AST & Git Audit) │ (UI & IEEE)   │
└────────────────────┴────────────────────┴────────────────────┴───────────────────┴───────────────┘
```

### 👤 THÀNH VIÊN 1: Team Leader, DevOps & Triển Khai Cloud
* **Nhiệm vụ:**
  1. Giám sát Docker Compose (PostgreSQL 15, Redis 7), chạy `npm run db:migrate` nạp dữ liệu sạch cho 13 bảng 3NF.
  2. Triển khai Frontend lên Vercel và Backend lên Render/Railway để có link demo online.
  3. Chạy script Stress Test `tools/stress-test-queue.py` với 100 submissions đồng thời để lấy số liệu đo đạc SLA.
* **File phụ trách:** `docker-compose.yml`, `start-services.bat`, `tools/stress-test-queue.py`.

### 👤 THÀNH VIÊN 2: Backend Core & Docker Sandbox Security
* **Nhiệm vụ:**
  1. Sửa **Bug 5**: Cập nhật Bước 3 & 4 trong `grading-worker.consumer.ts` thành vòng lặp duyệt `casesToRun` động.
  2. Pre-pull sẵn 4 image: `python:3.11-slim`, `eclipse-temurin:17-jdk`, `gcc:13`, `node:20-alpine`.
  3. Chạy `tools/verify-sandbox-security.py`, chuẩn bị minh chứng 8/8 kịch bản tấn công Sandbox (TLE 2.0s, MLE 512MB, fork-bomb, no-network) phục vụ phần P2P Defense.
* **File phụ trách:** `api-gateway/src/sandbox/docker-runner.ts`, `api-gateway/src/queue/grading-worker.consumer.ts`.

### 👤 THÀNH VIÊN 3: GenAI Specialist & Nối CSDL Đề Thi
* **Nhiệm vụ:**
  1. Sửa **Bug 2**: Nối nút *"Lưu & Xuất bản"* trong `LecturerDashboard.tsx` gọi `POST /api/v1/assignments` và `POST /api/v1/test-cases` về PostgreSQL.
  2. Sửa **Bug 3**: Cập nhật `SubmissionView.tsx` lấy danh sách bài tập qua `GET /api/v1/assignments`.
  3. Đảm bảo server `genai-hub` (port 3001) chạy ổn định với Key thật và model `gemini-flash-lite-latest`.
* **File phụ trách:** `frontend/src/components/LecturerDashboard.tsx`, `frontend/src/components/SubmissionView.tsx`, `genai-hub/src/`.

### 👤 THÀNH VIÊN 4: Algorithm Specialist & Git Analytics Live Parser
* **Nhiệm vụ:**
  1. Nâng cấp `teamwork.repository.ts` từ dữ liệu tĩnh sang Git CLI Parser thật (chạy lệnh `git log --shortstat` phân tích số commits và LOC thêm/xóa của sinh viên).
  2. Tinh chỉnh ngưỡng đạo văn AST Winnowing: $\ge 70\%$ gắn cờ, $\ge 80\%$ kích hoạt BR-03 ép về 0 điểm.
  3. Cung cấp bảng số liệu thực nghiệm đối soát mã nguồn ngụy trang phục vụ Bài báo IEEE.
* **File phụ trách:** `api-gateway/src/database/teamwork.repository.ts`, `api-gateway/src/plagiarism/plagiarism.service.ts`.

### 👤 THÀNH VIÊN 5: Frontend Lead, Sửa Bug Nộp Bài & Chủ Trì Bài Báo IEEE
* **Nhiệm vụ:**
  1. Sửa **Bug 1**: Khắc phục dòng 415 trong `App.tsx` để nhận diện chuẩn xác ngôn ngữ sinh viên nộp (Java, Python, C++, C#).
  2. Sửa **Bug 4**: Bỏ mock âm thầm `simulateSocketGradingEvents`, bổ sung thông báo trạng thái mạng rõ ràng.
  3. Chủ trì soạn thảo **Bài báo Khoa học chuẩn IEEE (6 - 8 trang)** và chuẩn bị Slide thuyết trình 15 phút.
* **File phụ trách:** `frontend/src/App.tsx`, `frontend/src/components/LoginView.tsx`, File PDF Bài báo IEEE, Slide PowerPoint.

---

## 5. CHECKLIST CHUẨN BỊ CHO NGÀY BẢO VỆ TRƯỚC HỘI ĐỒNG

- [ ] **1. Môi trường:** Đã mở sẵn Docker Desktop (Engine Running) và chạy `start-services.bat` khởi động đủ 4 cửa sổ (Postgres, Redis, API Gateway 3000, GenAI Hub 3001, Frontend 5173).
- [ ] **2. Thư mục Demo Desktop:** Đã chuẩn bị sẵn 5 file `.zip` mẫu ngoài màn hình Desktop:
  * `01_pass_clean_solid.zip` (Pass 100%, Clean Code & SOLID cao).
  * `02_fail_tle_loop.zip` (Chứa vòng lặp vô tận $\to$ chứng minh Watchdog 2.0s TLE).
  * `03_fail_mle_leak.zip` (Cấp phát mảng lớn ngốn > 512MB RAM $\to$ chứng minh Linux OOM 137).
  * `04_plagiarism_A.zip` & `05_plagiarism_B.zip` (Cặp bài nộp ngụy trang $\ge 80\% \to$ chứng minh AST Winnowing & BR-03 về 0 điểm).
- [ ] **3. File Excel Roster:** Chuẩn bị file `roster_valid.xlsx` (100% commit) và `roster_error.xlsx` (dòng 5 trùng email $\to$ chứng minh 100% SQL Rollback R06).
- [ ] **4. Hồ sơ nộp Hội đồng:** In sẵn Slide báo cáo và File Bài báo Khoa học IEEE (PDF 6-8 trang).

---

## 6. KIỂM TOÁN TOÀN DIỆN GIAO DIỆN & TRẢI NGHIỆM NGƯỜI DÙNG (UI/UX AUDIT)

> **Mục tiêu:** Rà soát từng component frontend (React + Vite) nhằm loại bỏ triệt để các mâu thuẫn hiển thị, lỗi đơ layout, dữ liệu mock tĩnh lộ liễu và các lỗi tương tác có thể làm mất điểm khi trình chiếu trước Hội đồng.

---

### 🖥️ UI Bug 1: Mâu thuẫn danh sách Testcase cứng trong Modal chi tiết bài nộp
* **Vị trí code:** [`frontend/src/components/SubmissionDetailModal.tsx`](file:///c:/Users/ADMIN/Documents/GitHub/SWP391-Group4/frontend/src/components/SubmissionDetailModal.tsx#L424-L480)
  ```tsx
  {/* Bảng danh sách Testcase */}
  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
    <div>... Test Case 01: Chuẩn hóa dữ liệu đầu vào ... PASSED (45ms • 14MB)</div>
    <div>... Test Case 02: Trường hợp biên & Tải lớn ... PASSED (62ms • 18MB)</div>
  </div>
  ```
* **Mô tả & Hậu quả:**  
  Trong `SubmissionDetailModal`, danh sách 2 testcase chạy Sandbox bị **hardcode tĩnh 100% là PASSED**.  
  Khi sinh viên nộp bài bị lỗi Biên dịch (Compile Error), quá thời gian (TLE) hoặc trượt testcase (Điểm 0/10), ở bảng ngoài hiện `FAILED` nhưng khi Giảng viên / Hội đồng bấm **"Xem chi tiết bài nộp"**, bên trong modal vẫn hiển thị **"Test Case 01: PASSED"** và **"Test Case 02: PASSED"**!  
  👉 *Đây là lỗ hổng mâu thuẫn trực quan cực lớn, Hội đồng sẽ phát hiện hệ thống không chạy thật.*
* **Giải pháp khắc phục:**  
  Duyệt mảng động dựa trên `submission.passedTestcases`, `submission.totalTestcases` và `submission.status`. Nếu `passedTestcases === 0` hoặc trạng thái `FAILED`, hiển thị icon đỏ `XCircle` kèm trạng thái `FAILED (TLE / Wrong Answer)` thay vì ép cứng `PASSED`.

---

### 🖥️ UI Bug 2: Ngôn ngữ Highlight bị gán cứng `language="java"` trong Diff Editor đạo văn
* **Vị trí code:** [`frontend/src/components/PlagiarismDiffModal.tsx`](file:///c:/Users/ADMIN/Documents/GitHub/SWP391-Group4/frontend/src/components/PlagiarismDiffModal.tsx#L316)
  ```tsx
  <DiffEditor
    height="100%"
    language="java"
    theme={AITA_THEME}
    ...
  />
  ```
* **Mô tả & Hậu quả:**  
  Trình so sánh đạo văn Monaco Diff Editor bị gán cứng `language="java"`. Khi hai bài nộp là ngôn ngữ **Python** (`.py`) hoặc **C++** (`.cpp`), Monaco Editor vẫn dùng ngữ pháp của Java để tô màu mã nguồn. Dẫn đến việc từ khóa Python (`def`, `import`, `# comment`) không được highlight đúng hoặc sinh cảnh báo cú pháp sai lệch trên màn hình.
* **Giải pháp khắc phục:**  
  Truyền prop `language` động từ `match.language` hoặc tự động phát hiện đuôi file (`python`, `cpp`, `java`).

---

### 🖥️ UI Bug 3: Xung đột Theme (Khối đen vs-dark giữa giao diện sáng Minimalist)
* **Vị trí code:** [`frontend/src/components/SubmissionDetailModal.tsx`](file:///c:/Users/ADMIN/Documents/GitHub/SWP391-Group4/frontend/src/components/SubmissionDetailModal.tsx#L672)
  ```tsx
  <Editor
    height="420px"
    language={submission.language === 'python' ? 'python' : submission.language === 'cpp' ? 'cpp' : 'java'}
    theme="vs-dark"
    ...
  />
  ```
* **Mô tả & Hậu quả:**  
  Hệ thống AITA v2.0 đã chuẩn hóa sang **Clean Light Theme** (nền trắng `#ffffff`, thẻ xám `#f7f9fc`, chữ xanh navy/đen). Tuy nhiên tab xem mã nguồn của bài nộp lại dùng `theme="vs-dark"`. Khi chuyển tab, một khối màu đen tuyền khổng lồ bật lên giữa modal màu trắng, gây giật mắt và phá vỡ tính đồng bộ của Design System.
* **Giải pháp khắc phục:**  
  Đổi sang `theme="vs"` (Monaco Light Theme chuẩn) hoặc áp dụng theme `aita-diff-light` để màu nền trình soạn thảo đồng nhất với viền modal.

---

### 🖥️ UI Bug 4: Nút tài khoản Demo nhanh trong LoginView bị trả về mã lỗi 401
* **Vị trí code:** [`frontend/src/components/LoginView.tsx`](file:///c:/Users/ADMIN/Documents/GitHub/SWP391-Group4/frontend/src/components/LoginView.tsx#L45) & [L434-L437](file:///c:/Users/ADMIN/Documents/GitHub/SWP391-Group4/frontend/src/components/LoginView.tsx#L434-L437)
  ```tsx
  const [directEmailInput, setDirectEmailInput] = useState<string>('linhcampochia@gmail.com');
  // ...
  { email: 'linhcampochia@gmail.com', name: 'Linh Campochia', note: 'Tài khoản của bạn • Student' },
  { email: 'linhcampochia@gmail.com', name: 'Linh Cam Po Chia', note: 'Đã cấp quyền • Giảng Viên' },
  ```
* **Mô tả & Hậu quả:**  
  Trong ô đăng nhập nhanh và danh sách nút demo preset, email mặc định được điền là `linhcampochia@gmail.com`. Tuy nhiên, trong CSDL `users_store.json`, email này **hoàn toàn chưa được cấp quyền**. Khi bấm vào, màn hình hiển thị ngay thông báo lỗi màu đỏ:  
  `Tài khoản Gmail 'linhcampochia@gmail.com' chưa có trên hệ thống AITA! Hệ thống từ chối cấp quyền truy cập.`
* **Giải pháp khắc phục:**  
  1. Thêm bản ghi tài khoản `linhcampochia@gmail.com` vào `api-gateway/data/users_store.json`.
  2. Hoặc trỏ các nút demo sang tài khoản đã có sẵn trong seed:
     - Giảng viên: `giangvien.edu@gmail.com` (ThS. Giảng Viên AITA - `INSTRUCTOR`)
     - Sinh viên: `phaithayj@gmail.com` hoặc `trungdt.student@aita.fpt.edu.vn` (`STUDENT`)
     - Quản trị viên: `admin.aita@gmail.com` (`ADMIN`)

---

### 🖥️ UI Bug 5: Thiếu thanh chuyển vai trò nhanh (Role Switcher) khi trình diễn
* **Vị trí code:** [`frontend/src/App.tsx`](file:///c:/Users/ADMIN/Documents/GitHub/SWP391-Group4/frontend/src/App.tsx#L559-L564)
  ```tsx
  const navTabs = currentUser.role === 'ADMIN'
    ? [
        { key: 'admin', label: 'Hệ thống Quản trị', icon: <LayoutDashboard size={14} /> },
        { key: 'lecturer', label: 'Cổng Giảng Viên', icon: <BookOpen size={14} /> },
      ]
    : [];
  ```
* **Mô tả & Hậu quả:**  
  Chỉ có tài khoản `ADMIN` mới có thanh Tab chuyển đổi màn hình. Giảng viên (`INSTRUCTOR`) và Sinh viên (`STUDENT`) có mảng `navTabs = []`.  
  Khi báo cáo luồng nghiệp vụ (Giảng viên tạo đề $\to$ Sinh viên nộp bài $\to$ Giảng viên xem chấm điểm & Đạo văn), nhóm bắt buộc phải bấm **"Đăng xuất"** rồi đăng nhập lại từ đầu, làm đứt quãng mạch thuyết trình trước Hội đồng.
* **Giải pháp khắc phục:**  
  Thêm một dropdown hoặc phím tắt demo góc phải thanh Navbar cho phép chuyển đổi nhanh giữa 3 vai trò (`ADMIN`, `LECTURER`, `STUDENT`) mà không cần đăng xuất.

---

### 🖥️ UI Bug 6: Comment lộ liễu và Mock Testcase cố định trong Quản lý Phúc khảo
* **Vị trí code:** [`frontend/src/components/LecturerAppealsManager.tsx`](file:///c:/Users/ADMIN/Documents/GitHub/SWP391-Group4/frontend/src/components/LecturerAppealsManager.tsx#L208-L215) & [L270-L320](file:///c:/Users/ADMIN/Documents/GitHub/SWP391-Group4/frontend/src/components/LecturerAppealsManager.tsx#L270-L320)
  ```tsx
  // LƯU Ý HỘI ĐỒNG: File nộp thực tế trên máy chủ là PRJ301-1.zip (3.23 MB - Nộp nhầm file đồ án Web PRJ301).
  // Do đó hệ thống tự động cho 0 điểm. Sinh viên gửi đơn phúc khảo kèm mã nguồn QuickSort chuẩn bên dưới...
  ```
* **Mô tả & Hậu quả:**  
  Khi Giảng viên mở bất kỳ đơn phúc khảo nào của sinh viên, tab Thẩm định chi tiết đều hiện đoạn comment có chữ `LƯU Ý HỘI ĐỒNG`, và bảng testcase luôn là bài toán Sorting 100,000 số nguyên. Kể cả sinh viên nộp bài Cây AVL môn CSD201 hay bài tập khác, mã nguồn hiển thị vẫn bị trói vào đoạn mock này.
* **Giải pháp khắc phục:**  
  Loại bỏ chuỗi comment gán cứng; ưu tiên lấy mã nguồn thật từ `submissionDetail.sourceCode` hoặc API `GET /api/v1/submissions/:id/source`. Nếu là mock dự phòng, chỉ để comment chuyên môn trung tính (ví dụ: `// Source code submitted for assignment evaluation`).

---

### 🖥️ UI Bug 7: Bảng điểm Gradebook quá tải cột trên màn hình máy chiếu (1366x768)
* **Vị trí code:** [`frontend/src/components/LecturerDashboard.tsx`](file:///c:/Users/ADMIN/Documents/GitHub/SWP391-Group4/frontend/src/components/LecturerDashboard.tsx) (Khu vực Render Bảng Submissions)
* **Mô tả & Hậu quả:**  
  Bảng Gradebook hiển thị đồng thời hơn 12 cột (Mã nộp, Sinh viên, Học phần, Lượt nộp, Tên file, Thời gian, Testcase, Clean Code, SOLID, Điểm Tổng, Tương đồng, Trạng thái, Thao tác).  
  Trên màn hình máy chiếu phòng bảo vệ (thường là tỷ lệ 16:9 độ phân giải 1366x768), bảng bị tràn ngang nghiêm trọng. Các nút bấm hành động (*Xem mã*, *Diff*, *Tải Zip*) bị co hẹp hoặc rớt dòng gây vỡ giao diện.
* **Giải pháp khắc phục:**  
  - Ẩn bớt cột "Lượt nộp" và "Tên file" trên màn hình `< 1440px`.
  - Gom các nút thao tác vào một nút bấm duy nhất dạng icon hoặc Dropdown Menu `⋮`.

---

### 🖥️ UI Bug 8: Fallback điểm số ảo (9.8đ) và điểm AI (9.5đ) khi bài nộp chưa có dữ liệu
* **Vị trí code:** [`frontend/src/components/LecturerDashboard.tsx`](file:///c:/Users/ADMIN/Documents/GitHub/SWP391-Group4/frontend/src/components/LecturerDashboard.tsx#L293-L305) & [`AdminDashboard.tsx`](file:///c:/Users/ADMIN/Documents/GitHub/SWP391-Group4/frontend/src/components/AdminDashboard.tsx#L105-L115)
  ```tsx
  score: sub.finalScore ?? sub.score ?? sub.details?.score ?? 9.8,
  aiRating: sub.aiRating || sub.details?.aiRating || {
    cleanCodeScore: sub.cleanCodeScore ?? 9.5,
    solidScore: { s: 9.0, o: 8.5, l: 9.0, i: 9.0, d: 8.5 },
    codeSmells: [],
    explanation: "Ma nguon to chuc ro rang, phan tach trach nhiem module tot.",
  },
  ```
* **Mô tả & Hậu quả:**  
  Khi mở một bài nộp đang ở trạng thái `QUEUED` hoặc chưa chạy xong AI, code tự động điền điểm `9.8` và điểm Clean Code `9.5` cùng 5 tiêu chuẩn SOLID ảo. Điều này khiến bài tập chưa chấm cũng hiện điểm xuất sắc.
* **Giải pháp khắc phục:**  
  Kiểm tra nếu `score === undefined` thì hiển thị `—` hoặc huy hiệu `"Đang xử lý"`. Tuyệt đối không fallback về điểm số giả lập.

---

### 🖥️ UI Bug 9: Hardcode địa chỉ API Gateway `http://localhost:3000` ở 12+ files
* **Vị trí code:** Rải rác trong `SubmissionView.tsx`, `SubmissionDetailModal.tsx`, `StudentHistoryView.tsx`, `StudentAppealsView.tsx`, `AdminDashboard.tsx`, `LecturerPanel.tsx`, `LecturerDashboard.tsx`, `LecturerAppealsManager.tsx`, v.v.
* **Mô tả & Hậu quả:**  
  Các components đều tự khai báo `const API_BASE_URL = 'http://localhost:3000'`. Nếu nhóm demo qua mạng nội bộ LAN (ví dụ máy chủ chạy ở IP `192.168.1.15:3000` hoặc deploy lên domain test), toàn bộ frontend sẽ gửi request về máy cục bộ của người xem $\to$ sập toàn bộ kết nối.
* **Giải pháp khắc phục:**  
  Tạo file cấu hình tập trung [`frontend/src/config/api.ts`](file:///c:/Users/ADMIN/Documents/GitHub/SWP391-Group4/frontend/src/config/api.ts):
  ```typescript
  export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  ```
  Import biến này đồng nhất ở mọi components.

---

### 🖥️ UI Bug 10: Tiêu đề mang thuật ngữ kỹ thuật đặc tả nội bộ trong giao diện Sinh viên
* **Vị trí code:** [`frontend/src/components/StudentAppealsView.tsx`](file:///c:/Users/ADMIN/Documents/GitHub/SWP391-Group4/frontend/src/components/StudentAppealsView.tsx#L84-L86)
  ```tsx
  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--blue-200)' }}>
    USE CASE 06 &amp; QUY TẮC BR-05
  </span>
  ```
* **Mô tả & Hậu quả:**  
  Trên màn hình của Sinh viên xuất hiện dòng chữ in hoa kỹ thuật: *"USE CASE 06 & QUY TẮC BR-05"*. Đây là tên mã trong tài liệu SRS thiết kế, hiển thị trực tiếp lên giao diện người dùng cuối sẽ tạo cảm giác như một bản nháp bài tập lớn chưa được trau chuốt thành sản phẩm thương mại.
* **Giải pháp khắc phục:**  
  Đổi thẻ kicker thành văn phong nghiệp vụ thân thiện:
  `<span className="eyebrow">Cổng dịch vụ sinh viên • Phúc khảo điểm</span>`.

