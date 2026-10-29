# BỘ SLIDE THUYẾT TRÌNH BẢO VỆ ĐỒ ÁN TỐT NGHIỆP / FINAL DEFENSE (15 PHÚT)
## HỆ THỐNG CHẤM MÃ NGUỒN TỰ ĐỘNG & GIÁM SÁT LIÊM CHÍNH HỌC THUẬT AITA-INTELLIGENT
> **Học phần:** SWP391 - Đồ án Phát triển Phần mềm (Chuẩn RBL 10 Tuần & IEEE Std 830-1998)  
> **Nhóm thực hiện:** Group 4 (5 Thành Viên)  
> **Thời gian báo cáo:** 15 Phút chính thức + 15 Phút Hỏi - Đáp (Q&A)  
> **Phiên bản hệ thống:** AITA v2.0 Production (Full Stack: React + NestJS + Docker + BullMQ + PostgreSQL 15)

---

## ⏱️ PHÂN BỔ THỜI GIAN THUYẾT TRÌNH CHO 5 THÀNH VIÊN (15 PHÚT)

| Mốc thời gian | Thời lượng | Người trình bày & Vai trò | Nội dung trọng tâm |
| :---: | :---: | :--- | :--- |
| **00:00 – 02:30** | 2.5 phút | **Thành viên 1** (Team Leader & DevOps) | Bối cảnh nghiên cứu, Nhu cầu thực tiễn & Kiến trúc tổng thể hệ thống AITA |
| **02:30 – 05:00** | 2.5 phút | **Thành viên 2** (Backend Core & Sandbox) | Thiết kế Docker Sandbox an toàn, Chống tấn công (TLE, MLE, Fork-bomb) |
| **05:00 – 07:30** | 2.5 phút | **Thành viên 3** (GenAI Specialist) | Tích hợp GenAI chấm Clean Code / SOLID & Quy trình tạo đề / testcase |
| **07:30 – 10:30** | 3.0 phút | **Thành viên 4** (Algorithm Specialist) | Thuật toán AST-Winnowing, Kết quả thực nghiệm 10 cặp mã nguồn ngụy trang |
| **10:30 – 13:30** | 3.0 phút | **Thành viên 5** (Frontend Lead & IEEE) | Trải nghiệm UI/UX, Đóng góp Bài báo Khoa học IEEE & Chứng minh SLA |
| **13:30 – 15:00** | 1.5 phút | **Cả nhóm** (Team Leader chốt) | Tổng kết dự án, Bài học kinh nghiệm & Chuyển sang phiên Q&A Hội đồng |

---

## SLIDE 1: BÌA BÁO CÁO & GIỚI THIỆU DỰ ÁN
* **Tiêu đề:** AITA-Intelligent — Nền tảng Chấm Mã Nguồn Tự Động & Giám Sát Liêm Chính Học Thuật Ứng Dụng AST Winnowing & GenAI
* **Đơn vị đào tạo:** Bộ môn Kỹ thuật Phần mềm (Software Engineering) — Đại học FPT
* **Giảng viên hướng dẫn:** ThS. Đinh Thành Trung
* **Đội ngũ thực hiện (Group 4):**
  1. **Đinh Thành Trung** (Leader, System Architect & DevOps Lead)
  2. **Trần Công Tiến** (Backend Core & Sandbox Security Engineer)
  3. **Nguyễn Hoàng Vinh** (GenAI Specialist & Database Architect)
  4. **Văn Thái Trung** (Algorithm Specialist & Plagiarism Engine Lead)
  5. **Linh Campochia** (Frontend Lead & Correspondence Author - Bài báo IEEE)

---

## SLIDE 2: BỐI CẢNH NGHIÊN CỨU & THỰC TRẠNG GIAN LẬN THỜI KỲ GENAI
* **Thực trạng cấp bách:**
  - Sự bùng nổ của ChatGPT-4o, GitHub Copilot, Claude khiến sinh viên dễ dàng tạo ra các đoạn mã "ngụy trang" chỉ bằng một câu lệnh prompt.
  - Các công cụ so khớp văn bản truyền thống (MOSS, text-diff) hoàn toàn bất lực trước: đổi tên biến, đảo ngược vòng lặp `for`/`while`, tách hàm, chèn dead-code.
* **Mục tiêu cốt lõi của AITA:**
  - **Đảm bảo tính thực thi an toàn 100%:** Sinh viên nộp code C++, Java, Python, C# được biên dịch và chạy cách ly tuyệt đối trong Docker Sandbox.
  - **Đánh giá toàn diện 2 tầng:** Tầng 1 kiểm định chức năng bằng Testcases; Tầng 2 dùng GenAI chấm Clean Code & 5 nguyên lý SOLID.
  - **Nguyên tắc vàng Liêm chính học thuật:** **Zero False Accusations (Độ chính xác 100% - Không bao giờ vu khống sinh viên trung thực)**.

---

## SLIDE 3: KIẾN TRÚC TỔNG THỂ HỆ THỐNG AITA-INTELLIGENT
```
┌────────────────────────────────────────────────────────────────────────┐
│                   CLIENT LAYER (React 18 + Vite)                       │
│    Giao diện Sinh viên (Nộp bài, Xem điểm, Phúc khảo) • Cổng Giảng viên│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / WebSocket (Socket.IO)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                API GATEWAY & ASYNC QUEUE (NestJS + BullMQ)              │
│    Xác thực Google SSO • Lưu trữ 13 bảng 3NF PostgreSQL • Redis Queue  │
└───────────────────┬───────────────────────────────┬────────────────────┘
                    │                               │
                    ▼                               ▼
┌───────────────────────────────────────┐ ┌──────────────────────────────┐
│       DOCKER SANDBOX ISOLATION        │ │    GENAI & INTEGRITY HUB     │
│  - gcc:13, openjdk:17, python:3.11    │ │  - Gemini Flash Lite 2026    │
│  - 512MB RAM, CPU 2.0s watchdog       │ │  - AST Normalizer Engine     │
│  - --network none, --pids-limit 64    │ │  - Winnowing Fingerprinting  │
└───────────────────────────────────────┘ └──────────────────────────────┘
```
* **Luồng xử lý bất đồng bộ:** Sinh viên nộp bài $\to$ Gateway trả mã `202 Accepted` trong $< 200$ms $\to$ Worker nhận job từ Redis $\to$ Sandbox thực thi $\to$ GenAI chấm kiến trúc $\to$ Trả kết quả Realtime qua Socket.IO.

---

## SLIDE 4: THIẾT KẾ DOCKER SANDBOX AN TOÀN & CƠ CHẾ DEFENSE-IN-DEPTH
* **4 Rào chắn An ninh Vật lý:**
  1. **Tách biệt Mạng (`--network none`):** Triệt tiêu hoàn toàn nguy cơ sinh viên gửi cờ bí mật ra Internet hoặc tải mã độc về container.
  2. **Giới hạn Tài nguyên Cực đại:** Áp trần RAM 512MB (`MemoryLimit`) và CPU 2.0s (`Watchdog Timer`).
  3. **Ngăn chặn Fork-bomb (`--pids-limit 64`):** Đánh chặn mã nguồn độc hại sinh tiến trình con làm tê liệt máy chủ.
  4. **Quyền Đọc-Ghi Cô lập (`Read-Only Rootfs & Ephemeral Bind Mount`):** Mã nguồn chỉ được biên dịch trong thư mục tạm, tự động xóa sạch trong $\le 1.0$s.
* **Cơ chế Circuit Breaker Fallback:** Nếu Docker Daemon gặp sự cố bất khả kháng, hệ thống chuyển sang Safe Fallback Engine để bảo toàn SLA không làm nghẽn tiến trình thi cử.

---

## SLIDE 5: GIẢI THUẬT AST-NORMALIZED WINNOWING & BAREM ĐẠO VĂN
* **Quy trình 4 bước triệt tiêu mã ngụy trang:**
  1. **Chuẩn hóa AST:** Bóc tách Abstract Syntax Tree, xóa toàn bộ comment và khoảng trắng thừa.
  2. **Bình thường hóa Định danh (Canonical Mapping):** Chuyển toàn bộ tên biến, hàm thành `VAR_1, VAR_2, FUNC_1, LITERAL`.
  3. **Tạo k-gram & Băm Winnowing:** Sử dụng cửa sổ trượt $w=10, k=15$ lấy các giá trị băm cực tiểu làm chữ ký số fingerprint.
  4. **Chỉ số tương đồng Ensemble:**
     $$S_{\text{comb}} = 0.65 \times \text{Containment} + 0.35 \times \text{Cosine(AST Histogram)}$$
* **3 Dải phân loại học thuật (Rule BR-03):**
  - **$S < 40\%$ (CLEAN):** Mã nguồn độc lập, tự động thông qua.
  - **$40\% \le S < 70\%$ (SUSPECTED):** Nghi vấn; chuyển giảng viên thẩm định trực quan.
  - **$S \ge 70\%$ (FLAGGED):** Gắn cờ gian lận, chuyển Hội đồng xử lý.

---

## SLIDE 6: KẾT QUẢ THỰC NGHIỆM ĐỐI SOÁT 10 CẶP MÃ NGUỒN NGỤY TRANG

| Cặp thử nghiệm | Kiểu ngụy trang GenAI | Ground Truth | Độ tương đồng AITA | Trạng thái cờ | Đánh giá |
| :---: | :--- | :---: | :---: | :---: | :---: |
| **Pair 01** | Đổi tên toàn bộ biến & hàm | Plagiarized | **100.00%** | Gắn cờ | **PASS (Bắt trúng)** |
| **Pair 02** | Đảo vòng lặp `for` thành `while` | Plagiarized | **85.26%** | Gắn cờ | **PASS (Bắt trúng)** |
| **Pair 03** | Chèn Dead Code & Comment rác | Plagiarized | **83.49%** | Gắn cờ | **PASS (Bắt trúng)** |
| **Pair 04** | Tách hàm con & Inlining | Plagiarized | **78.99%** | Gắn cờ | **PASS (Bắt trúng)** |
| **Pair 05** | Đảo nhánh điều kiện `if-else` | Plagiarized | **100.00%** | Gắn cờ | **PASS (Bắt trúng)** |
| **Pair 06** | Thay thế biểu thức tương đương | Plagiarized | **79.51%** | Gắn cờ | **PASS (Bắt trúng)** |
| **Pair 07** | Phá vỡ định dạng Indentation | Plagiarized | **100.00%** | Gắn cờ | **PASS (Bắt trúng)** |
| **Pair 08** | ChatGPT-4o viết lại cấu trúc | Plagiarized | **74.39%** | Gắn cờ | **PASS (Bắt trúng)** |
| **Pair 09** | Ngụy trang hỗn hợp đa tầng | Plagiarized | **54.07%** | Nghi vấn | **Chuyển GV (An toàn)** |
| **Pair 10** | **Mẫu đối chứng: MergeSort vs QuickSort** | **CLEAN** | **51.97%** | **KHÔNG CỜ** | **PASS (Không vu khống)** |

* **Chỉ số đo lường thực nghiệm:** **Độ chính xác 90.00% | Precision 100% | Recall 88.89%**.

---

## SLIDE 7: SO SÁNH THỰC NGHIỆM VÀ ĐỐI SÁNH TREE EDIT DISTANCE (TED)
* **Câu hỏi nghiên cứu: Tại sao không dùng Tree Edit Distance (TED)?**
  - **Độ phức tạp tính toán:** TED yêu cầu $\mathcal{O}(N^3)$ đến $\mathcal{O}(N^4)$, mất từ $1.5\text{s} - 4.5\text{s}$ cho mỗi cặp bài nộp.
  - **Khả năng lập chỉ mục:** Winnowing cho phép lưu trữ Fingerprints vào PostgreSQL B-Tree Index, tra cứu 1-nhiều cực nhanh. TED bắt buộc phải so sánh tay từng cặp (Pairwise DP) không thể đánh chỉ mục.
  - **Hiệu năng thực tế AITA:** Xử lý **947 dòng code (2,625 tokens)** chỉ mất **12.0 ms** (Thỏa mãn vượt bậc tiêu chuẩn SLA $< 200$ ms).
* **Đề xuất Kiến trúc Lai (Two-Tier Hybrid Engine):**
  - Tầng 1 (AST Winnowing): Sàng lọc nhanh $95\%$ bài nộp trong 12ms.
  - Tầng 2 (TED Refinement): Chỉ kích hoạt đối với các bài rơi vào dải Nghi vấn ($40\% - 70\%$).

---

## SLIDE 8: ĐÁNH GIÁ CHẤT LƯỢNG MÃ NGUỒN GENAI (SOLID & CLEAN CODE)
* **Bảng Barem Điểm 4 Thành Phần Chuẩn Hóa:**
  $$\text{Tổng Điểm} = \text{TC1 (3.5đ)} + \text{TC2 (3.5đ)} + \text{Clean Code (2.0đ)} + \text{SOLID (1.0đ)} = \mathbf{10.0đ}$$ (Mỗi testcase có điểm ngang nhau = 7.0 / N)
* **Đánh giá tự động 5 nguyên lý SOLID qua Gemini Flash Lite:**
  - **S (Single Responsibility):** Phát hiện các hàm vừa tính toán thuật toán, vừa in console, vừa ghi file.
  - **O (Open/Closed):** Khuyến khích mở rộng qua Generic và Kế thừa thay vì chuỗi `if-else` cứng.
  - **L (Liskov Substitution):** Đảm bảo lớp con thay thế được lớp cha mà không làm hỏng logic.
  - **I (Interface Segregation):** Khuyến khích các Interface nhỏ gọn, chuyên biệt.
  - **D (Dependency Inversion):** Khuyến khích phụ thuộc vào Abstraction (`ISorter`) thay vì cụ thể.

---

## SLIDE 9: KIỂM THỬ TẢI HỆ THỐNG & ĐO ĐẠC ĐÓNG GÓP NHÓM (GIT ANALYTICS)
* **Kiểm thử tải Hàng đợi BullMQ (Stress Test):**
  - Chạy script mô phỏng 100 submissions đồng thời.
  - Thời gian phản hồi tiếp nhận bài: $p_{95} = 45$ ms (Đạt chuẩn SLA $< 200$ ms).
  - Tỷ lệ hoàn thành công việc: $100\%$ không bị rơi rụng job.
* **Minh bạch Đóng góp Nhóm (Git Analytics Parser thật - UC-12):**
  - Hệ thống tích hợp module bóc tách `git log --shortstat` trực tiếp từ repo.
  - Tính toán chính xác số commit, dòng thêm/xóa của từng bạn sinh viên.
  - Tự động gắn cờ Free-Rider nếu thành viên có tỷ lệ đóng góp $< 10\%$.

---

## SLIDE 10: TRẢI NGHIỆM NGƯỜI DÙNG & TỔNG KẾT NÂNG CẤP V2.0
* **Các điểm sửa đổi quan trọng vừa hoàn tất:**
  - **Sửa Bug 1 (Ngôn ngữ bài nộp):** Sinh viên có thể chọn trực tiếp C++, C#, Java, Python từ dropdown; bộ lọc zip nhận diện chuẩn xác đuôi file và signature mã nguồn.
  - **Sửa Bug 4 (Không mock ngầm):** Khi mất kết nối hoặc server gặp sự cố, hệ thống hiển thị thông báo minh bạch kèm nút *"Thử lại"* thay vì chạy điểm giả lập.
  - **Role Switcher tiện lợi:** Tích hợp thanh đổi vai trò nhanh (Admin $\leftrightarrow$ Giảng viên $\leftrightarrow$ Sinh viên) trực tiếp trên thanh điều hướng, giúp buổi thuyết trình không bị ngắt quãng.
  - **Phân quyền Google SSO:** Chuẩn hóa các tài khoản preset demo không còn gặp lỗi 401.

---

## SLIDE 11: ĐÓNG GÓP KHOA HỌC & BÀI BÁO IEEE RBL
* **Bài báo Nghiên cứu Khoa học chuẩn IEEE (6 - 8 trang):**
  - Tiêu đề: *"A Comparative Study of AST-Based Winnowing and Tree Edit Distance in Detecting GenAI-Obfuscated Source Code"*.
  - Nội dung hoàn chỉnh: Đầy đủ 8 phần từ Abstract, Formal Math Model, Bảng thực nghiệm 10 cặp, Phân tích ngưỡng $\tau = 70\%$, đến Tham khảo học thuật.
  - Sẵn sàng xuất bản và nộp lưu chiểu cho Hội đồng Nghiên cứu Khoa học FPT.

---

## SLIDE 12: TỔNG KẾT, BÀI HỌC KINH NGHIỆM & PHIÊN HỎI - ĐÁP (Q&A)
* **Giá trị đạt được qua 10 tuần RBL:**
  - Làm chủ kiến trúc Microservices hướng sự kiện (Event-Driven Architecture) với NestJS, Redis BullMQ và Docker Engine.
  - Ứng dụng thành công lý thuyết Cây Cú Pháp Trừu Tượng (AST) và Giải thuật Winnowing vào giải quyết vấn đề liêm chính học thuật thực tế.
  - Xây dựng sản phẩm hoàn thiện, giao diện chuyên nghiệp, sẵn sàng triển khai thực tế.
* **Nhóm 4 xin trân trọng cảm ơn Thầy/Cô trong Hội đồng!**
* *Xin mời Hội đồng đặt câu hỏi phản biện.*
