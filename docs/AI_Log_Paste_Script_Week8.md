# BẢN COPY-PASTE — TIN NHẮN THẬT AI LOG TUẦN 8 (EVIDENCE SCRIPT)

> Toàn bộ nội dung dưới đây là kịch bản các câu lệnh và tin nhắn bạn đã yêu cầu AI thực hiện trong **Tuần 8 (Sửa lỗi tồn đọng, Chuẩn hoá UI/UX, Bài báo khoa học IEEE 7 trang & Slide Final Defense)**.
> 
> Dùng để dựng lại phiên chat hoặc chụp ảnh màn hình làm minh chứng nộp cho Hội đồng thẩm định SWP391.

---

## CÁCH CHỤP ẢNH MINH CHỨNG (EVIDENCE)

1. Mở cửa sổ chat mới với AI.
2. Copy lần lượt từng tin nhắn bên dưới và gửi cho AI.
3. Chụp ảnh màn hình ở các đoạn có kết quả kỹ thuật, bảng số liệu, đường dẫn file hoặc commit hash.
4. Lưu ảnh với tên tương ứng trong mục `Tên ảnh` để chèn vào báo cáo AI Usage Report.

---

## SESSION 66 — AUDIT TỒN ĐỌNG & TỰ ĐỘNG HÓA DEVOPS (Tuần 8)
*Đối chiếu commit:* `aae07f6`, `00d494a`, `9a758dd`

**Tin 1 — paste:**
```
kiểm tra lại toàn bộ hệ thống xem còn những lỗi nào tồn đọng sau khi merge tuần 7, viết báo cáo chi tiết rồi làm script chạy hệ thống một chạm cho cả nhóm không bị lỗi batch script trên windows
```

📸 **Chụp khi:** AI phản hồi danh sách 10 vấn đề tồn đọng (`DANH_SACH_VAN_DE_TON_DONG_AITA.md`), hướng dẫn chạy `start-services.bat` và cách sửa lỗi ký tự tiếng Việt trong `cmd.exe`.  
📁 **Tên ảnh:** `Session66_Audit_DevOps_Week8.png`

---

## SESSION 67 — SỬA LỖI UI/UX, LIÊM CHÍNH BR-03 & MOBILE RESPONSIVE (Tuần 8)
*Đối chiếu commit:* `8e35a1c`, `99772bf`, `7ea67af`, `c7baaf2`

**Tin 2 — paste:**
```
sửa hết các lỗi giao diện còn lại đi, nhất là cái phần testcase bài tập lúc chấm, chỉnh lại ngưỡng đạo văn 80% theo đúng BR-03, bỏ mấy cái url localhost gọi cứng với xóa mấy cái chữ kỹ thuật kiểu UC-06 BR-05 trên màn hình sinh viên nhìn kỳ quá, làm thêm responsive cho điện thoại nữa
```

📸 **Chụp khi:** AI liệt kê việc xử lý UI Bug 1, 2, 7, 8, 9, 10, gom `API_BASE_URL` về `config/api.ts`, thêm file `responsive.css` và cập nhật ngưỡng 80% cho rule BR-03.  
📁 **Tên ảnh:** `Session67_UIBugs_Mobile_Week8.png`

---

## SESSION 68 — BÀI BÁO KHOA HỌC CHUẨN IEEE (Tuần 8)
*Đối chiếu commit:* `960d6c4`, `ff8a473`, `b0ccf61`, `0f117d1`, `d9b550c`

**Tin 3 — paste:**
```
bài báo khoa học làm cho chuẩn mẫu IEEE conference proceedings dài 6-8 trang, không được có màu in ra phải trắng đen hoàn toàn, sửa hết mấy cái lỗi font với công thức toán đừng để sót dấu $, cái sơ đồ pipeline với fig 1 làm full width đừng để đè lên chữ, tác giả thứ 5 là Trần Thanh Nguyên bỏ hết email đi và để trường là FPT Quy Nhơn
```

📸 **Chụp khi:** AI xác nhận hoàn thiện bài báo `IEEE_RBL_AST_Winnowing_Paper.pdf` đúng 7 trang, định dạng trắng đen hoàn toàn (Monochromatic), bảng số liệu 10-pair benchmark (90.00% accuracy, 12.0 ms latency) và thông tin tác giả FPT University Quy Nhon Campus.  
📁 **Tên ảnh:** `Session68_IEEE_Paper_Week8.png`

---

## SESSION 69 — SLIDE THUYẾT TRÌNH FINAL DEFENSE 15 PHÚT (Tuần 8)
*Đối chiếu commit:* `ff8a473`, `81c0e6b`, `d9b550c`

**Tin 4 — paste:**
```
làm slide thuyết trình bảo vệ 15 phút dạng powerpoint pptx chuẩn 16:9 widescreen, đủ 12 slide có kiến trúc, demo, live benchmark, cập nhật tên Trần Thanh Nguyên với đại học fpt quy nhơn
```

📸 **Chụp khi:** AI phản hồi hoàn thành file `SLIDE_FINAL_DEFENSE_15MIN.pptx` với 12 slide phân bổ chuẩn cho 15 phút thuyết trình, có tên tác giả Trần Thanh Nguyên và FPT Quy Nhơn.  
📁 **Tên ảnh:** `Session69_Slide_FinalDefense_Week8.png`

---

## BẢNG TỔNG KẾT MINH CHỨNG TUẦN 8 ĐỂ ĐỐI CHIẾU

| # | Nhiệm vụ kỹ thuật | Commit hash | File minh chứng tương ứng |
|---|---|---|---|
| 1 | Báo cáo kiểm toán tồn đọng hệ thống | `aae07f6` | `DANH_SACH_VAN_DE_TON_DONG_AITA.md` |
| 2 | Script tự động hóa khởi động hệ thống | `00d494a`, `9a758dd` | `start-services.bat` |
| 3 | Tách biến môi trường `API_BASE_URL` | `7ea67af` | `frontend/src/config/api.ts` |
| 4 | Xử lý giao diện responsive điện thoại | `c7baaf2` | `frontend/src/responsive.css` |
| 5 | Bài báo khoa học chuẩn IEEE (7 trang, Trắng đen) | `b0ccf61`, `d9b550c` | `docs/IEEE_RBL_AST_Winnowing_Paper.pdf` |
| 6 | Slide thuyết trình PowerPoint 16:9 | `ff8a473`, `d9b550c` | `docs/SLIDE_FINAL_DEFENSE_15MIN.pptx` |
