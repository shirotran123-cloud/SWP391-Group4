import Docker from 'dockerode';
import * as fs from 'fs';
import * as path from 'path';

const docker = new Docker(); // Connects to local Docker socket

export async function runSandbox(language: string, codeContent: string) {
    const seccompProfile = fs.readFileSync(path.join(__dirname, '../security/seccomp.json'), 'utf-8');
    
    let image = '';
    let cmd: string[] = [];
    let filename = '';
    
    switch (language) {
        case 'python':
            image = 'python:3.11-slim';
            filename = 'code.py';
            cmd = ['python3', `/sandbox/${filename}`];
            break;
        case 'cpp':
            image = 'gcc:11';
            filename = 'code.cpp';
            cmd = ['sh', '-c', `g++ /sandbox/${filename} -o /sandbox/a.out && /sandbox/a.out`];
            break;
        case 'java':
            image = 'openjdk:17-slim';
            filename = 'Main.java';
            cmd = ['sh', '-c', `javac /sandbox/${filename} && java -cp /sandbox Main`];
            break;
        case 'dotnet':
            image = 'mcr.microsoft.com/dotnet/sdk:8.0';
            filename = 'Program.cs';
            cmd = ['sh', '-c', `mkdir -p /sandbox/app && cd /sandbox/app && dotnet new console && cp /sandbox/${filename} Program.cs && dotnet run`];
            break;
        default:
            throw new Error("Language not supported");
    }

    // Tạo thư mục tạm và ghi file code
    const tempDir = path.join(__dirname, 'temp', Date.now().toString());
    fs.mkdirSync(tempDir, { recursive: true });
    fs.writeFileSync(path.join(tempDir, filename), codeContent);

    console.log(`[Sandbox] Starting container for ${language}...`);
    
    try {
        const container = await docker.createContainer({
            Image: image,
            Cmd: cmd,
            Tty: true,                 // [Tối ưu] Bật TTY để output không bị chèn các ký tự rác (multiplex headers) của Docker
            HostConfig: {
                Memory: 512 * 1024 * 1024, // RAM limit: 512MB
                CpuQuota: 100000,          // CPU: 1.0 (1 core)
                CpuPeriod: 100000,
                PidsLimit: 64,             // PIDs limit: 64 (Defense-in-depth against fork bombs)
                NetworkMode: 'none',       // No internet access
                IpcMode: 'none',           // [Tối ưu] Disable IPC (ngăn tấn công shared memory)
                ReadonlyRootfs: true,      // [Tối ưu] Khóa cứng RootFS (không cho sửa file hệ thống)
                Tmpfs: { '/tmp': 'size=50m' }, // [Tối ưu] Cấp thư mục tạm cho compiler hoạt động
                CapDrop: ['ALL'],          // [Tối ưu] Tước bỏ toàn bộ quyền Linux Capabilities
                LogConfig: {               // [Tối ưu] Giới hạn dung lượng Log sinh ra (chống tràn ổ cứng)
                    Type: 'json-file',
                    Config: { 'max-size': '1m' }
                },
                SecurityOpt: [`seccomp=${seccompProfile}`], // Apply Seccomp profile
                Binds: [`${tempDir}:/sandbox`] // Mount code to /sandbox
            }
        });

        await container.start();
        console.log(`[Sandbox] Container ${container.id} started.`);

        const startTime = Date.now();

        // Watchdog mechanism: Kill after 2.0 seconds (TLE)
        const watchdog = setTimeout(async () => {
            console.log(`[Sandbox] TLE! Killing container ${container.id}...`);
            try {
                await container.kill({ signal: 'SIGKILL' });
            } catch (e) {
                // Ignore kill errors if already stopped
            }
        }, 2000);

        const result = await container.wait();
        clearTimeout(watchdog);
        
        const time_ms = Date.now() - startTime;
        console.log(`[Sandbox] Container exited with code: ${result.StatusCode}`);

        // Fetch logs (Tối ưu: Giới hạn độ dài để tránh crash RAM của Worker)
        const logs = await container.logs({ stdout: true, stderr: true });
        let output = '';
        if (logs.length > 50000) {
            output = logs.subarray(0, 50000).toString('utf-8') + '\n\n... [TRUNCATED] Output quá dài (Vượt quá 50KB)';
        } else {
            output = logs.toString('utf-8');
        }

        // Tối ưu: Lọc các ký tự điều khiển rác (nếu có) nhưng giữ lại Tab (\t) và NewLine (\n, \r)
        output = output.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

        // Dọn dẹp container thật nhanh (<= 1.0s)
        await container.remove({ force: true, v: true });
        
        // Dọn dẹp file code tạm
        fs.rmSync(tempDir, { recursive: true, force: true });
        
        console.log(`[Sandbox] Container removed.`);
        
        let finalStderr = result.StatusCode !== 0 ? output : '';
        if (time_ms >= 1900 && result.StatusCode !== 0) {
            finalStderr = "[TLE] Time Limit Exceeded: Quá thời gian thực thi.\n" + finalStderr;
        } else if (result.StatusCode === 139) {
            finalStderr = "[SIGSEGV] Segmentation fault: Lỗi truy cập bộ nhớ.\n" + finalStderr;
        } else if (result.StatusCode === 137) {
            finalStderr = "[MLE] Memory Limit Exceeded: Tràn bộ nhớ.\n" + finalStderr;
        } else if (result.StatusCode === 138) {
            finalStderr = "[TLE] Time Limit Exceeded: Quá thời gian thực thi.\n" + finalStderr;
        }

        return {
            stdout: result.StatusCode === 0 ? output : '',
            stderr: finalStderr,
            time_ms,
            exitCode: result.StatusCode
        };
        
    } catch (err) {
        console.error(`[Sandbox] Error:`, err);
        return { error: err };
    }
}
