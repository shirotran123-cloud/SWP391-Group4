# PHÂN HỆ 2: DOCKER AUTOGRADING SANDBOX & SECURITY SECCOMP
**Kỹ sư phụ trách:** Trần Công Tiến (DevOps & Security Engineer)  
**Tiêu chuẩn bảo mật:** Linux cgroups v2, Seccomp BPF Filter, POSIX Signal Telemetry, và Zero-Trust Network Isolation.

---

## 1. Kiến Trúc Cô Lập Đa Tầng (Multi-Layer Sandbox Isolation)

```text
[Node.js Sandbox Worker]
         │
         ├──► 1. Kiểm tra sức khỏe Docker Socket (Healthcheck < 500ms)
         │       ├── Có Daemon  ──► Khởi tạo Docker Container (Isolated cgroups v2)
         │       └── Mất Daemon ──► Chuyển mạch Graceful Fallback Circuit Breaker
         │
         └──► 2. Cấu hình Container Boundary (Dockerode HostConfig):
                 ├── Memory: 512MB RAM (Hard Limit)
                 ├── MemorySwap: 512MB (No Swap Overcommit)
                 ├── CpuQuota: 100,000 (1.0 CPU Core)
                 ├── PidsLimit: 64 (Chặn đứng Fork Bombs)
                 ├── NetworkMode: 'none' (Cách ly mạng 100%)
                 ├── ReadonlyRootfs: true (Khóa cứng hệ thống tệp)
                 ├── CapDrop: ['ALL'] (Tước bỏ quyền root Linux Capabilities)
                 └── SecurityOpt: ['seccomp=seccomp.json']
```

---

## 2. Xử Lý 3 Ngoại Lệ An Ninh Cốt Lõi (Core Exception Handlers)

1. **Time Limit Exceeded (TLE - Watchdog 2.0s):**
   - Thiết lập bộ đếm ngược `setTimeout(2000)`.
   - Nếu container không hoàn tất trong 2.0 giây, Watchdog phát tín hiệu `SIGKILL` bắn hạ tiến trình.
   - Bắt mã thoát 137/138, gắn nhãn lỗi `[TLE]` và dọn dẹp container trong $\le 1.0$ giây.

2. **Memory Limit Exceeded (MLE - Linux OOM Killer):**
   - Cấu hình cgroups v2 `Memory: 512MB`.
   - Khi tiến trình sinh viên gọi `malloc()` hoặc cấp phát mảng vượt ngưỡng, Linux Kernel OOM Killer lập tức dập tắt tiến trình.
   - Bắt mã thoát POSIX: $128 + 9 = 137$, gắn nhãn lỗi `[MLE]`.

3. **Segmentation Fault (SIGSEGV - Exit Code 139):**
   - Đánh chặn lỗi con trỏ NULL hoặc tràn chỉ số mảng trong C/C++.
   - Bắt mã thoát POSIX: $128 + 11 = 139$, trích xuất log stderr để GenAI Hub giải thích sư phạm.

---

## 3. Lệnh Chạy Kiểm Thử Tự Động

- Chạy kiểm thử tấn công Sandbox:
  ```bash
  npx ts-node run-tests.ts
  ```

- Chạy kiểm thử 3 kịch bản ngoại lệ bảo mật:
  ```bash
  npx ts-node test-exception-paths.ts
  ```

- Chạy kiểm chuẩn SLA & thời gian dọn dẹp Teardown:
  ```bash
  npx ts-node test-sandbox-benchmarks.ts
  ```
