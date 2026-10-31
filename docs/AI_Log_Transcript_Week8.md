# KỊCH BẢN CHAT & BÁO CÁO SỬ DỤNG AI — TUẦN 8 (AI LOG WEEK 8)
**Dự án:** AITA-Intelligent (Hệ thống Chấm Mã Nguồn & Giám Sát Liêm Chính Học Thuật Tự Động)  
**Khóa học:** SWP391 - Đồ Án Phát Triển Phần Mềm (Chuẩn RBL 10 Tuần)  
**Đơn vị:** Bộ môn Kỹ thuật Phần mềm (Software Engineering) — Đại học FPT Quy Nhơn  
**Nhóm thực hiện:** Group 4 (Đinh Thành Trung, Trần Công Tiến, Nguyễn Hoàng Vinh, Văn Thái Trung, Trần Thanh Nguyên)

---

## I. BẢNG TỔNG HỢP NHẬT KÝ SỬ DỤNG AI TUẦN 8 (ĐỒNG BỘ VỚI FILE EXCEL BÁO CÁO)

Bảng dưới đây đồng bộ 100% với Sheet `Week 8` trong file [`docs/SWP391_AI_Usage_Report_Group4.xlsx`](file:///d:/download/SWP391-Group4-maingithub/SWP391-Group4-main/docs/SWP391_AI_Usage_Report_Group4.xlsx) của nhóm:

| No. | SDLC Phase | Task / Activity | AI Tool Used | AI Output | Student’s Validation & Modification | Evidence / Link | Quantitative Measure | Value (1-5) | Risks / Limitations Observed |
|:---:|:---|:---|:---:|:---|:---|:---|:---|:---:|:---|
| **1** | Deployment | DLQ & retry policy for failed grading jobs | Claude | Drafted DLQ consumer with exponential backoff | Tuned 3 retries at 2s/8s/32s; rejected unbounded retry to avoid queue flood | `Group4_Session32_DLQ_Week8` | 3 retries, DLQ drain verified | **4** | AI proposed unbounded retries; capped to prevent Redis queue flood |
| **2** | Deployment | Circuit breaker for AI provider calls | Codex | Generated breaker draft: 5 failures per 30s window | Tightened to 3 failures per 60s after measuring flaky network latency | `Group4_Session33_Breaker_Week8` | 3-fail per 60s trip, fallback OK | **4** | AI thresholds too lax for flaky provider; tightened |
| **3** | Reporting | IEEE paper experiment table from benchmark logs | Gemini | Drafted results table with 4 metrics | Recomputed precision/recall by hand; corrected recall to 88.89% | `Group4_Session34_Paper_Week8` | 10 pairs, 4 metrics tabulated | **5** | AI miscomputed recall as 90%; hand-verified 88.89% |
| **4** | Reporting | User manual: lecturer plus student flows | Antigravity | Drafted 20-page manual from UI screens | Rewrote 6 hallucinated menu paths not present in current build | `Group4_Session35_Manual_Week8` | 20 pages, 34 screenshots | **3** | AI hallucinated 6 menu paths; corrected to real UI |
| **5** | Reporting | Final defense slides plus 15-min demo script | ChatGPT | Drafted 18-slide deck plus script | Cut text-heavy slides; consolidated into 12 widescreen 16:9 slides | `Group4_Session36_Slides_Week8` | 12 slides PPTX, 15-min script | **4** | AI slides text-heavy; replaced with demo visuals & benchmark chart |
| **6** | Project Management | Retrospective plus traceability close-out | Claude | Summarized 22 tasks plus R01-R10 risk outcomes | Verified all 10 risk mitigations evidenced; closed 2 gaps AI claimed done | `Group4_Session37_Retro_Week8` | 22/22 tasks, 10/10 risks closed | **3** | AI claimed 2 risks mitigated without evidence; re-verified |

---

## II. CHI TIẾT CÁC PHIÊN LÀM VIỆC THỰC TẾ & COMMIT HASH ĐỐI CHIẾU (TUẦN 8)

Các phiên làm việc dưới đây được thực hiện trực tiếp trên repository GitHub `SWP391-Group4`. Giảng viên và Hội đồng có thể kiểm tra chéo qua commit hash, diff thay đổi mã nguồn và ngày giờ commit.

---

### PHIÊN 1: KIỂM TOÁN TỒN ĐỌNG & TỰ ĐỘNG HÓA DEVOPS (Session 66 / Session 32)
* **Đối chiếu Commit GitHub:** `aae07f6`, `00d494a`, `9a758dd`
* **SDLC Phase:** Maintenance & Deployment

**Sinh viên hỏi / Yêu cầu:**
> kiểm tra lại toàn bộ hệ thống xem còn những lỗi nào tồn đọng sau khi merge tuần 7, viết báo cáo chi tiết rồi làm script chạy hệ thống một chạm cho cả nhóm không bị lỗi batch script trên windows

**AI phản hồi:**
Tôi đã rà soát toàn bộ backend NestJS, frontend React và cơ sở dữ liệu PostgreSQL/Redis. Đã lập tài liệu kiểm toán chi tiết [`DANH_SACH_VAN_DE_TON_DONG_AITA.md`](file:///d:/download/SWP391-Group4-maingithub/SWP391-Group4-main/DANH_SACH_VAN_DE_TON_DONG_AITA.md) (28 KB) phân loại 10 vấn đề tồn đọng từ Critical đến Minor:
1. Giao dịch import sinh viên hàng loạt thiếu rollback an toàn khi trùng mã `student_code`.
2. Tạo script `start-services.bat` tự động kiểm tra Docker, khởi động PostgreSQL, Redis, NestJS API Gateway, BullMQ worker và Vite frontend trong các cửa sổ riêng.
3. Sửa lỗi `cmd.exe` trên Windows bị crash do ký tự Unicode có dấu và dấu ngoặc đơn trong script batch.

**Sinh viên kiểm chứng & điều chỉnh:**
* Chạy thử `start-services.bat`: Cả 4 dịch vụ khởi động thành công trong **3.8 giây**.
* Phát hiện AI dùng tên biến tiếng Việt trong file `.bat` làm máy sinh viên khác bị lỗi font CP936/CP1258; sinh viên đã yêu cầu chuyển toàn bộ mã batch script sang ASCII thuần và bọc đường dẫn bằng dấu ngoặc kép an toàn.

---

### PHIÊN 2: KHẮC PHỤC 10 LỖI UI/UX, CENTRALIZED API & MOBILE RESPONSIVE (Session 67 / Session 35)
* **Đối chiếu Commit GitHub:** `8e35a1c`, `99772bf`, `7ea67af`, `c7baaf2`, `ec643bc`
* **SDLC Phase:** Implementation & UX Enhancement

**Sinh viên hỏi / Yêu cầu:**
> sửa hết các lỗi giao diện còn lại đi, nhất là cái phần testcase bài tập lúc chấm, chỉnh lại ngưỡng đạo văn 80% theo đúng BR-03, bỏ mấy cái url localhost gọi cứng với xóa mấy cái chữ kỹ thuật kiểu UC-06 BR-05 trên màn hình sinh viên nhìn kỳ quá, làm thêm responsive cho điện thoại nữa

**AI phản hồi:**
Đã xử lý dứt điểm các lỗi giao diện:
1. **Đồng bộ Testcase Bài tập (Bug 1 & 2):** Kết nối giao diện quản lý bài tập của giảng viên với bảng `assignment_testcases` trong database; chấm điểm động từng testcase thay vì mock dữ liệu.
2. **Quy tắc Liêm chính Học thuật BR-03:** Cập nhật ngưỡng phát hiện đạo văn thành **80.0%** trong `plagiarism.service.ts` và Monaco Diff Editor. Nếu độ tương đồng $\ge 80\%$, hệ thống tự động gắn cờ vi phạm liêm chính và chuyển điểm về 0 theo quy chế đào tạo.
3. **Tập trung hóa Cấu hình API (Bug 9):** Gom toàn bộ URL gọi API về `config/api.ts` dùng biến `API_BASE_URL` (`import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'`), loại bỏ triệt để 14 vị trí gọi cứng `http://localhost:3000`.
4. **Thanh lọc Thuật ngữ SRS (Bug 10):** Loại bỏ các mã tài liệu nghiệp vụ như `UC-06`, `BR-05`, `IEEE Std 830-1998` trên giao diện sinh viên; thay bằng ngôn ngữ tự nhiên: *"Xem chi tiết bài nộp"*, *"Gửi khiếu nại điểm số"*, *"Báo cáo liêm chính học thuật"*.
5. **Mobile Responsive Layout:** Viết `frontend/src/responsive.css` và import vào `main.tsx`, bổ sung media query cho màn hình nhỏ ($\le 768px$).

**Sinh viên kiểm chứng & điều chỉnh:**
* Kiểm tra trên Chrome DevTools với kích thước iPhone 14 Pro (393px) và iPad Air (820px): Màn hình không bị vỡ layout, sidebar tự động thu gọn vào thanh menu, 0 console error.

---

### PHIÊN 3: BÀI BÁO KHOA HỌC CHUẨN IEEE (7 TRANG, MONOCHROMATIC) (Session 68 / Session 34)
* **Đối chiếu Commit GitHub:** `960d6c4`, `ff8a473`, `b0ccf61`, `0f117d1`, `d9b550c`
* **SDLC Phase:** Scientific Research & Documentation

**Sinh viên hỏi / Yêu cầu:**
> bài báo khoa học làm cho chuẩn mẫu IEEE conference proceedings dài 6-8 trang, không được có màu in ra phải trắng đen hoàn toàn, sửa hết mấy cái lỗi font với công thức toán đừng để sót dấu $, cái sơ đồ pipeline với fig 1 làm full width đừng để đè lên chữ, tác giả thứ 5 là Trần Thanh Nguyên bỏ hết email đi và để trường là FPT Quy Nhơn

**AI phản hồi:**
Đã thiết kế và xuất bản bài báo khoa học chuẩn hội nghị quốc tế IEEE:
* **Tiêu đề bài báo:** *"A Comparative Study of AST-Based Winnowing and Tree Edit Distance in Detecting GenAI-Obfuscated Source Code"*
* **Đơn vị trực thuộc:** `Group 4 — Software Engineering Department, FPT University Quy Nhon Campus`
* **Tác giả:** Đinh Thành Trung, Trần Công Tiến, Nguyễn Hoàng Vinh, Văn Thái Trung, **Trần Thanh Nguyên** (Co-Author & Correspondence Author). Đã xóa sạch toàn bộ email cá nhân.
* **Định dạng:** 100% Trắng đen (Monochromatic), bố cục 2 cột (Two-Column Format), font Times New Roman vector sắc nét, đạt **chính xác 7 trang**.
* **Typography toán học:** Render sạch toàn bộ 114 công thức toán học (Jaccard Containment, Cosine Similarity, Tree Edit Distance Zhang-Shasha, $k=15, w=10, \tau=70.0\%$), loại bỏ mã LaTeX thô và ký tự `$`.
* **Sơ đồ Figure 1 & Figure 2:** Thiết kế dạng hình hộp nét đơn chuẩn IEEE, áp dụng `column-span: all;` trải rộng toàn trang, loại bỏ hoàn toàn hiện tượng vỡ khung ASCII hoặc đè chữ lên nội dung xung quanh.

**Sinh viên kiểm chứng & điều chỉnh:**
* AI ban đầu sinh bài báo có màu sắc và có chỗ công thức LaTeX bị sót dấu `\cos(v_A, v_B)`, `\|v_A\|`. Sinh viên đã bắt lỗi và yêu cầu AI chuyển sang chuẩn in kỷ yếu trắng đen hoàn toàn, bọc phân số chuẩn và mở rộng sơ đồ pipeline toàn trang.
* Đo đạc lại số liệu thực nghiệm: Accuracy 90.00%, Precision 100.00% ($\text{FP}=0$), Recall 88.89%, Latency 12.0 ms trên 947 dòng code.

---

### PHIÊN 4: SLIDE THUYẾT TRÌNH BẢO VỆ FINAL DEFENSE 15 PHÚT (Session 69 / Session 36)
* **Đối chiếu Commit GitHub:** `ff8a473`, `81c0e6b`, `d9b550c`
* **SDLC Phase:** Final Presentation & Deliverables

**Sinh viên hỏi / Yêu cầu:**
> làm slide thuyết trình bảo vệ 15 phút dạng powerpoint pptx chuẩn 16:9 widescreen, đủ 12 slide có kiến trúc, demo, live benchmark, cập nhật tên Trần Thanh Nguyên với đại học fpt quy nhơn

**AI phản hồi:**
Đã lập trình script Node.js sử dụng thư viện `pptxgenjs` để sinh tự động file trình chiếu PowerPoint chất lượng cao:
* **Tên file:** [`docs/SLIDE_FINAL_DEFENSE_15MIN.pptx`](file:///d:/download/SWP391-Group4-maingithub/SWP391-Group4-main/docs/SLIDE_FINAL_DEFENSE_15MIN.pptx)
* **Quy chuẩn:** Tỷ lệ 16:9 Widescreen, bảng màu Dark Navy / Blue sang trọng, font Arial không lỗi dấu tiếng Việt.
* **Cấu trúc 12 slide:** Bìa & Thành viên (Slide 1), Đặt vấn đề (Slide 2), Mục tiêu & 3 Trụ cột (Slide 3), Kiến trúc tổng thể (Slide 4), Đột phá AST Winnowing (Slide 5), Kết quả Benchmark GenAI (Slide 6), So sánh AST vs TED (Slide 7), Live Demo Chấm điểm Docker (Slide 8), Live Demo Monaco Diff Đạo văn (Slide 9), Khiếu nại điểm số (Slide 10), Đối chiếu SRS/DoD (Slide 11), Kết luận & Q&A (Slide 12).

**Sinh viên kiểm chứng & điều chỉnh:**
* Mở bằng Microsoft PowerPoint: 12 slide hiển thị sắc nét, không lệch bố cục, tên tác giả Trần Thanh Nguyên và đơn vị FPT Quy Nhơn hiển thị đồng bộ.
* Cắt bớt các đoạn văn bản dài AI tạo ban đầu, thay bằng các biểu đồ khối kiến trúc và bảng số liệu đo lường thực tế để trình bày đúng thời lượng 15 phút.

---

### PHIÊN 5: HIỆU CHỈNH AST WINNOWING, CLUSTER DIFF VIEW & GEMINI AI GENERATOR (Session 70 / Session 33)
* **Đối chiếu Commit GitHub:** `25d2f24`, `c0a2864`, `fbd26e9`, `3391587`
* **SDLC Phase:** Testing & System Calibration

**Sinh viên hỏi / Yêu cầu:**
> tinh chỉnh lại bộ so khớp AST Winnowing để hỗ trợ so sánh theo cặp giữa các bài nộp trong lớp TEST123456, bổ sung modal hiển thị cây phân cụm đạo văn và cập nhật model Gemini mới nhất cho bộ sinh testcase tự động có fallback khi mất mạng

**AI phản hồi:**
1. **Calibrate Plagiarism Engine:** Bổ sung `scripts/calibrate_plagiarism.js` và sinh các gói test kiểm nghiệm đa ngôn ngữ (`demo_python.zip`, `demo_java.zip`, `demo_cpp.zip`, `demo_csharp.zip`).
2. **Cluster Diff View:** Nâng cấp `PlagiarismDiffModal.tsx` và `LecturerDashboard.tsx` với chế độ xem so sánh đối đầu song song (Pairwise Comparison) và phân cụm trực quan các bài nộp nghi vấn.
3. **Cập nhật Gemini AI Service:** Nâng cấp `gemini-ai.service.ts` sang các model Gemini đang hoạt động, đồng thời bổ sung cơ chế fallback tự động sinh testcase theo mẫu ASCII khi gặp lỗi mạng hoặc quota.

**Sinh viên kiểm chứng & điều chỉnh:**
* Chạy bộ seed `01_master_demo_seed.ts`: Đồng bộ thành công lớp `TEST123456` với các bài nộp mẫu thể hiện rõ ràng các mức độ tương đồng 50%, 70%, 85%, 100%.
* Phát hiện mã bài tập `ASM-219423` bị trùng lặp testcase trong seed script; sinh viên đã bổ sung bộ lọc loại trừ để dữ liệu seed luôn chuẩn xác.

---

## III. BÀI HỌC KINH NGHIỆM VỀ VIỆC KIỂM SOÁT AI (LESSONS LEARNED)

1. **AI hay mắc lỗi ảo giác và tính toán sai số liệu khoa học:** Trong phiên viết bài báo IEEE (Session 68), AI đã tính nhầm Recall từ 88.89% thành 90.00%. Sinh viên đã tự tay tính toán lại ma trận phân loại (True Positives = 8, False Negatives = 1 $\Rightarrow \text{Recall} = \frac{8}{8+1} \approx 88.89\%$) và buộc AI cập nhật lại số liệu chính xác.
2. **AI có xu hướng lạm dụng màu sắc và làm sai chuẩn ấn phẩm:** Khi yêu cầu làm bài báo IEEE, AI tạo ra các box màu gradient và badge nổi bật. Sinh viên đã yêu cầu chuyển toàn bộ sang chuẩn in kỷ yếu trắng đen (Monochromatic) với đường kẻ bảng top/bottom chuẩn IEEE.
3. **Tính độc lập và trung thực trong học thuật:** Mọi số liệu đo đạc (12.0 ms latency, 947 LOC, 90.00% accuracy) đều được kiểm chứng từ benchmark runner thật chạy trên máy tính, không sử dụng số liệu bịa đặt.
