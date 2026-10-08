# AITA Platform – Phân Hệ 1: Presentation & Real-Time Visualizer
**Dự án:** AITA – Intelligent Autograding Platform (SWP391)  
**Người phụ trách:** Văn Thái Trung (Frontend & UI/UX Lead - `Trung270806`)  
**Công nghệ:** React 19, Vite, TypeScript, Recharts, Monaco Editor (`@monaco-editor/react`), Socket.IO Client, Lucide React.  

---

## 🚀 1. Tổng Quan Kiến Trúc Giao Diện (Milestone 2)

Phân hệ Presentation đóng vai trò là điểm tiếp xúc trực quan giữa Giảng viên / Sinh viên và toàn bộ hạ tầng chấm điểm tự động AITA. Ứng dụng được thiết kế theo phong cách giao diện hiện đại (Glassmorphism & Dark Cyberpunk Mode), tối ưu trải nghiệm thời gian thực (Zero-refresh UX).

```
[ Sinh viên nộp .zip ] ─── Pre-flight SHA-256 ───► POST /api/v1/submissions
         │
         ▼ (WSS Socket.IO Channel: submission_{id})
┌────────────────────────────────────────────────────────────────────────┐
│                        LiveGradingModal.tsx                            │
│  ├─ 1. Queue Ingestion & SHA-256 Verified                              │
│  ├─ 2. Docker Sandbox Isolation (Seccomp & cgroups v2)                │
│  ├─ 3. Testcase 1 Evaluation (StdIn / StdOut)                          │
│  ├─ 4. Testcase 2 Evaluation (Watchdog TLE & MLE Watch)               │
│  ├─ 5. GenAI Review (Clean Code & 5 trục SOLID) ──► SolidRadarChart.tsx│
│  ├─ 6. AST & Winnowing Fingerprinting ───────────► MonacoDiffViewer.tsx │
│  └─ 7. Final Completion & Socratic Hint Explainer                      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🎨 2. Danh Mục Các Thành Phần Giao Diện (Component Catalog)

### 1. `SubmissionView.tsx` (Khu Vực Nộp Bài Tập)
* **Kéo thả tệp (.zip):** Tự động phát hiện định dạng file nén và từ chối các định dạng không hợp lệ.
* **Pre-flight Validation ($\le 10$MB):** Kiểm tra dung lượng ngay tại trình duyệt trước khi upload, chống tràn băng thông.
* **Xác thực SHA-256 Client-side:** Sử dụng Web Crypto API (`crypto.subtle.digest`) tính toán mã băm SHA-256 ngay khi chọn file, hiển thị badge minh bạch bài thi.
* **Đồng hồ đếm ngược:** Tích hợp `CountdownTimer.tsx` hiển thị thời gian còn lại trước hạn nộp bài.

### 2. `LiveGradingModal.tsx` (Bảng Theo Dõi Tiến Độ Real-Time)
* **Lắng nghe Socket.IO:** Kết nối trực tiếp vào phòng `submission_{id}`, cập nhật từng bước đánh giá mượt mà không cần F5 tải lại trang.
* **Trực quan hóa trạng thái:** Icon phân cấp trực quan cho từng bước: Pending (Đang chờ), In Progress (Đang chạy với hiệu ứng xoay), Passed (Thành công), Failed (Thất bại).
* **Keyboard Shortcut:** Tự động lắng nghe phím `Escape` để đóng modal an toàn khi chấm xong.

### 3. `SolidRadarChart.tsx` (Biểu Đồ 5 Trục SOLID)
* **Hiển thị mạng nhện Recharts:** Trực quan hóa 5 nguyên lý thiết kế hướng đối tượng:
  - **S:** Single Responsibility Principle (SRP)
  - **O:** Open/Closed Principle (OCP)
  - **L:** Liskov Substitution Principle (LSP)
  - **I:** Interface Segregation Principle (ISP)
  - **D:** Dependency Inversion Principle (DIP)
* **Thang đo chuẩn học thuật:** Khóa cứng trục `[0, 10]` điểm và tích hợp `CustomSolidTooltip` hiển thị chi tiết tên nguyên lý.

### 4. `MonacoDiffViewer.tsx` (Đối Soát Đạo Văn Song Song)
* **Tích hợp VS Code Monaco Engine:** Cho phép xem mã nguồn với đầy đủ tính năng Syntax Highlighting, số dòng và cuộn mượt mà.
* **Chế độ So Sánh Song Song (Side-by-side):** Đối soát trực quan bài làm của sinh viên với bài thi bị nghi vấn sao chép.
* **Cảnh báo mức độ rủi ro:** Đổi màu viền và huy hiệu theo tỷ lệ tương đồng ($<30\%$ An toàn, $30-69\%$ Cảnh báo, $\ge 70\%$ Vi phạm nghiêm trọng).

---

## 🛠️ 3. Hướng Dẫn Chạy & Build Dự Án

### Cài đặt thư viện:
```bash
npm install
```

### Chạy môi trường phát triển (Development):
```bash
npm run dev
# Mở trình duyệt tại http://localhost:5173
```

### Kiểm tra cú pháp & Build Production:
```bash
npm run build
# Thực hiện typecheck qua tsc -b và bundle tối ưu qua Vite
```

---

## 📋 4. Kiểm Thử & Định Nghĩa Hoàn Thành (DoD Milestone 2)
* [x] Giao diện nộp bài đáp ứng tiêu chuẩn nộp file $\le 10$MB và tính toán SHA-256.
* [x] Kết nối WebSocket Socket.IO ổn định với `api-gateway` (Port 3000).
* [x] Trực quan hóa đầy đủ kết quả của cả 3 phân hệ cốt lõi: Sandbox, GenAI Hub và AST Engine.
* [x] Đáp ứng chuẩn Responsive trên màn hình Desktop và Laptop.
