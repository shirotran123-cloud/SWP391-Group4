## 📌 Pull Request Information

**Author:** Đinh Thanh Trung / Team Member  
**Sprint:** Sprint 2 (Tuần 4)  
**Kanban Task Card:** [GitHub Projects #ISSUE_ID]  
**Component:** `api-gateway` | `frontend` | `genai-hub` | `sandbox`  

---

### 📝 Tóm tắt Thay đổi (Summary of Changes)
- [ ] Tính năng mới (feat)
- [ ] Sửa lỗi (fix)
- [ ] Tối ưu hiệu năng (perf)
- [ ] Tái cấu trúc code (refactor)
- [ ] Tài liệu hóa (docs)
- [ ] Kiểm thử tự động (test)

### 🎯 Mô tả chi tiết (Description)
*(Mô tả chi tiết giải pháp kỹ thuật, API endpoints, hoặc component được cập nhật)*

---

### 🛡️ Tiêu chuẩn Chấp thuận (Definition of Done - DoD Checklist)
- [ ] **Quy chuẩn Commit:** Đã tuân thủ chuẩn Conventional Commits (`feat:`, `fix:`, `perf:`...) phục vụ Git Analytics.
- [ ] **SLA Hiệu năng:** API Gateway tiếp nhận bài nộp và đẩy BullMQ hoàn thành dưới 200ms.
- [ ] **Dung lượng File:** Giới hạn file $\le$ 10MB được kiểm duyệt nghiêm ngặt.
- [ ] **Bảo mật:** Mã hash SHA-256 được tính toán chính xác để đối soát tính toàn vẹn.
- [ ] **WebSocket Stream:** Đã kiểm thử luồng Socket.IO với các sự kiện `testcase:evaluated` và `grading:completed`.
- [ ] **Chính sách Code Review:** Tuyệt đối không merge trực tiếp vào `main`. Yêu cầu ít nhất 1 phê duyệt (Approval) từ Team Leader (Đinh Thanh Trung) hoặc peer reviewer.
- [ ] **CI/CD Status:** Toàn bộ GitHub Actions pipeline đều đạt trạng thái xanh (Passed).

---

### 📸 Bằng chứng Kiểm thử (Test Evidence)
```bash
# Output chạy bộ test tự động npx ts-node test/verify-gateway.ts
```
