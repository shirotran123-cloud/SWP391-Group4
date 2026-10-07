# AI Debugging Logs - Sandbox Worker (Phân hệ 2)

**1. Log: Phân tích sự cố Compiler (gcc/javac) bị crash do Seccomp chặn Syscall**
- **Sự cố**: Khi cấu hình Seccomp mặc định chặn các lệnh gọi hệ thống tạo tiến trình mới như `clone`, `fork`, `vfork`, và `execve` nhằm mục đích bảo mật chống mã độc, các trình biên dịch như `g++` (C++) và `javac` (Java) bất ngờ bị exit với lỗi (exit code 159 hoặc SIGSYS).
- **Nguyên nhân**: Trình biên dịch hoạt động bằng cách spawn ra các tiến trình con (ví dụ: `cc1plus` hoặc `as`). Việc chặn `fork` và `clone` thông qua seccomp profile đã trực tiếp làm sập pipeline biên dịch.
- **Giải pháp**: Gỡ bỏ `fork`, `vfork`, và `clone` khỏi danh sách cấm của `seccomp.json` (chuyển sang allow). Thay vào đó, để chống lại lỗ hổng Fork Bomb, tôi sử dụng cơ chế giới hạn tài nguyên cgroups của Docker bằng cờ `--pids-limit=64`. 

**2. Log: Giám sát OOM Killer & Exit code 137 (Memory Limit Exceeded)**
- **Sự cố**: Sinh viên gửi một đoạn mã C/C++ liên tục gọi `malloc(1024 * 1024)` mà không giải phóng, hoặc mảng siêu lớn, khiến Node.js worker bị treo nếu không kiểm soát tốt memory host.
- **Giải pháp**: Gắn giới hạn cứng `Memory: 512 * 1024 * 1024` (512MB RAM) vào `HostConfig` của Dockerode. 
- **Kết quả**: Khi container chạm ngưỡng 512MB, Linux kernel sẽ lập tức kích hoạt OOM (Out Of Memory) Killer để chém tiến trình. Container bị văng ra với trạng thái exit code 137. Phân hệ worker nhận dạng code 137 và format lỗi gửi về là `[MLE] Memory Limit Exceeded: Tràn bộ nhớ`.

**3. Log: Tối ưu bộ đệm luồng (Stream buffer) của Dockerode để đọc Logs**
- **Sự cố**: Khi sinh viên in ra hàng chục nghìn dòng log (ví dụ vòng lặp vô hạn `printf("a")`), lệnh `await container.logs({ stdout: true, stderr: true })` trong Node.js sử dụng bộ đệm bộ nhớ mặc định có thể gây nghẽn cổ chai (buffer overflow) khiến tiến trình worker sụp đổ.
- **Giải pháp**: Thay vì nhận nguyên string vào RAM, chúng tôi đọc qua streams hoặc lấy log kèm kích thước tối đa. Trong kiến trúc hiện tại, chúng tôi kết hợp với Watchdog (2000ms - TLE). Khi quá thời gian 2.0s, Watchdog gửi `SIGKILL` ngay lập tức để cắt đứt stdout.

**4. Log: Đánh chặn Segmentation Fault (Truy cập vùng nhớ trái phép)**
- **Sự cố**: Sinh viên gửi code C/C++ có chứa lỗi truy cập con trỏ NULL (`int *p = NULL; *p = 1;`) hoặc truy cập ngoài mảng.
- **Kết quả**: Hệ điều hành ném ra tín hiệu `SIGSEGV` (signal 11) và tiến trình sập. Exit code trả về là `128 + 11 = 139`. Sandbox Worker đã bắt đúng điều kiện `result.StatusCode === 139` để format stderr chuyển cho GenAI giải thích lỗi sư phạm.

**5. Log: Xử lý TLE (Time Limit Exceeded) bằng Watchdog Timer**
- **Sự cố**: Sinh viên viết vòng lặp vô hạn (`while(true) {}`) tiêu tốn 100% CPU.
- **Giải pháp**: Tạo một `setTimeout(..., 2000)` chạy ngầm. Nếu sau 2.0s container chưa kết thúc (chưa `wait()` xong), Watchdog sẽ gọi `container.kill({ signal: 'SIGKILL' })`. Trạng thái trả về thường là 137 (do SIGKILL) hoặc 138. Kết hợp kiểm tra `time_ms >= 2000` để kết luận chính xác đây là lỗi TLE.

**6. Log: Ngăn chặn truy cập Internet & Network Attacks (--network none)**
- **Sự cố**: Mã độc cố gắng dùng `curl` hoặc socket TCP/UDP để thực hiện DDoS, tải thêm payload độc hại từ bên ngoài, hoặc tấn công SSRF vào mạng nội bộ của nền tảng autograding.
- **Giải pháp**: Thiết lập `NetworkMode: 'none'` khi khởi tạo container bằng Dockerode. Mọi giao tiếp mạng bị vô hiệu hóa hoàn toàn từ cấp độ container network namespace.
