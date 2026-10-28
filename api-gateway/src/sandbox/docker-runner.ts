import * as Docker from 'dockerode';
import * as fs from 'fs';
import * as path from 'path';

const DockerClass: any = (Docker as any).default || Docker;

export interface TestCaseInput {
  input: string;
  expectedOutput?: string;
  timeLimitMs?: number;
}

export interface TestCaseExecutionResult {
  testcaseIndex: number;
  verdict: 'ACCEPTED' | 'WRONG_ANSWER' | 'TIME_LIMIT_EXCEEDED' | 'MEMORY_LIMIT_EXCEEDED' | 'RUNTIME_ERROR';
  timeMs: number;
  memoryKb: number;
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface DockerRunOutcome {
  available: boolean;
  reason?: string;
  compileError?: {
    compileOutput: string;
    stderr: string;
    timeMs: number;
    exitCode: number;
  };
  results: TestCaseExecutionResult[];
}

/** Cấu hình từng ngôn ngữ: image, tên file, lệnh biên dịch (nếu có) và lệnh chạy. */
interface LanguageProfile {
  image: string;
  filename: string;
  /** Lệnh biên dịch chạy trong container biên dịch: đọc /sandbox (ro), ghi /build (rw). */
  compile: string | null;
  /** Lệnh chạy chương trình trong container chạy: /sandbox và /build đều read-only. */
  run: string;
}

// ── Giới hạn Sandbox theo SRS (UC-07, mục 4 Constraints) ───────────────────────
const MEMORY_BYTES = 512 * 1024 * 1024; // RAM <= 512MB
const SWAP_TOTAL_BYTES = 512 * 1024 * 1024; // MemorySwap = Memory -> không dùng swap thêm
const CPU_QUOTA = 100000; // 1.0 core
const CPU_PERIOD = 100000;
const PIDS_LIMIT = 64; // chặn fork-bomb
const DEFAULT_TIME_LIMIT_MS = 2000; // TLE 2.0s
const COMPILE_TIMEOUT_MS = 30000; // biên dịch có ngân sách riêng, KHÔNG tính vào TLE
const OUTPUT_LIMIT_BYTES = 50 * 1024; // chống log flooding: chỉ giữ 50KB
const META = '__AITA_META__';
const ERR = '__AITA_STDERR__';

/**
 * DockerSandboxRunner - Quản lý thực thi mã nguồn trong Isolated Container Sandbox
 * Tuân thủ IEEE Std 830-1998, NFR & Sandbox Boundary:
 * - 4 Images: python:3.11-slim, eclipse-temurin:17-jdk, gcc:13, node:20-alpine
 * - Quota: Memory 512MB, không swap, CPU 1.0 core, pids-limit 64, network none, readonly rootfs,
 *   CapDrop ALL, no-new-privileges, seccomp mặc định của Docker
 * - Biên dịch MỘT LẦN trong container riêng; mỗi testcase chạy trong một container mới
 * - TLE 2.0s chỉ đo thời gian chạy chương trình (không gồm khởi động container / biên dịch)
 */
export class DockerSandboxRunner {
  private docker: any;
  private availabilityReason: string = 'Chưa kiểm tra Docker daemon';

  constructor() {
    const isWindows = process.platform === 'win32';
    if (isWindows) {
      // Thử kết nối named pipe mặc định của Docker Desktop trên Windows
      this.docker = new DockerClass({ socketPath: '//./pipe/dockerDesktopLinuxEngine' });
    } else {
      this.docker = new DockerClass({ socketPath: '/var/run/docker.sock' });
    }
  }

  public getAvailabilityReason(): string {
    return this.availabilityReason;
  }

  /**
   * Kiểm tra Docker Daemon có sẵn sàng không
   */
  public async isAvailable(): Promise<boolean> {
    try {
      const pingPromise = this.docker.ping();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Docker ping timeout')), 500),
      );
      await Promise.race([pingPromise, timeoutPromise]);
      this.availabilityReason = 'Docker Daemon ONLINE';
      return true;
    } catch {
      try {
        const fallbackDocker = new DockerClass();
        const pingFallback = fallbackDocker.ping();
        const timeoutFallback = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Docker fallback ping timeout')), 400),
        );
        await Promise.race([pingFallback, timeoutFallback]);
        this.docker = fallbackDocker;
        this.availabilityReason = 'Docker Daemon ONLINE (via default socket)';
        return true;
      } catch (err: any) {
        this.availabilityReason = `Docker Daemon OFFLINE (${err.message || 'connection failed'})`;
        return false;
      }
    }
  }

  private getProfile(language: string, codeContent: string): LanguageProfile | null {
    switch (language.toLowerCase()) {
      case 'python':
        return { image: 'python:3.11-slim', filename: 'solution.py', compile: null, run: 'python3 /sandbox/solution.py' };
      case 'java': {
        const classMatch = codeContent.match(/public\s+class\s+([A-Za-z0-9_]+)/);
        const className = classMatch ? classMatch[1] : 'Main';
        return {
          image: 'eclipse-temurin:17-jdk',
          filename: `${className}.java`,
          compile: `javac -J-Xmx256m -d /build /sandbox/${className}.java`,
          run: `java -Xmx256m -Xss64m -cp /build ${className}`,
        };
      }
      case 'cpp':
      case 'c':
        return {
          image: 'gcc:13',
          filename: 'solution.cpp',
          compile: 'g++ -O2 -std=c++17 /sandbox/solution.cpp -o /build/a.out',
          run: '/build/a.out',
        };
      case 'javascript':
      case 'node':
      case 'typescript':
        return { image: 'node:20-alpine', filename: 'solution.js', compile: null, run: 'node /sandbox/solution.js' };
      default:
        return null;
    }
  }

  /**
   * Chạy tập test cases trong container Docker cô lập
   */
  public async runTestCases(
    language: string,
    codeContent: string,
    testCases: TestCaseInput[],
  ): Promise<DockerRunOutcome> {
    const isUp = await this.isAvailable();
    if (!isUp) {
      return { available: false, reason: this.availabilityReason, results: [] };
    }

    const profile = this.getProfile(language, codeContent);
    if (!profile) {
      return { available: false, reason: `Ngôn ngữ '${language}' chưa được hỗ trợ trong Docker Sandbox`, results: [] };
    }

    const tempDir = path.resolve(
      process.cwd(),
      'temp',
      `sandbox_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    );
    const srcDir = path.join(tempDir, 'src');
    const buildDir = path.join(tempDir, 'build');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.mkdirSync(buildDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, profile.filename), codeContent, 'utf-8');

    try {
      // ── 1) BIÊN DỊCH MỘT LẦN (container riêng, ngân sách 30s, không tính vào TLE) ──
      if (profile.compile) {
        const c = await this.executeContainer({
          image: profile.image,
          script: `${profile.compile} 2>&1; rc=$?; echo "${META} rc=$rc"; exit $rc`,
          srcDir,
          buildDir,
          buildWritable: true,
          watchdogMs: COMPILE_TIMEOUT_MS,
        });
        const meta = parseMeta(c.raw);
        const compileOutput = meta.before.trim();
        if (c.killed || meta.rc !== 0) {
          return {
            available: true,
            compileError: {
              compileOutput: c.killed ? `Biên dịch vượt quá ${COMPILE_TIMEOUT_MS / 1000}s` : compileOutput,
              stderr: compileOutput,
              timeMs: c.wallMs,
              exitCode: meta.rc ?? c.exitCode,
            },
            results: [],
          };
        }
      }

      // ── 2) CHẠY TỪNG TESTCASE trong container mới (đã cô lập hoàn toàn) ──────────
      const results: TestCaseExecutionResult[] = [];
      for (let i = 0; i < testCases.length; i++) {
        const tc = testCases[i];
        const limitMs = tc.timeLimitMs || DEFAULT_TIME_LIMIT_MS;
        const inputName = `input_${i}.txt`;
        fs.writeFileSync(path.join(srcDir, inputName), tc.input || '', 'utf-8');

        // `timeout` (coreutils / busybox) giết chương trình đúng hạn; thời gian chạy được
        // đo bằng /proc/uptime bên trong container -> không tính thời gian khởi động.
        const limitSec = Math.max(1, Math.ceil(limitMs / 1000));
        const script =
          `cd /tmp; s=$(cut -d' ' -f1 /proc/uptime); ` +
          `timeout -s KILL ${limitSec} ${profile.run} < /sandbox/${inputName} > /tmp/out 2> /tmp/err; rc=$?; ` +
          `e=$(cut -d' ' -f1 /proc/uptime); ` +
          `head -c ${OUTPUT_LIMIT_BYTES} /tmp/out; ` +
          `echo; echo "${ERR}"; head -c 4096 /tmp/err; echo; ` +
          `echo "${META} rc=$rc s=$s e=$e mem=$(cat /sys/fs/cgroup/memory.peak 2>/dev/null || cat /sys/fs/cgroup/memory/memory.max_usage_in_bytes 2>/dev/null || echo 0)"; ` +
          `exit 0`;

        const r = await this.executeContainer({
          image: profile.image,
          script,
          srcDir,
          buildDir,
          buildWritable: false,
          // Watchdog ngoài: phòng trường hợp chính `timeout` bị vô hiệu
          watchdogMs: limitMs + 5000,
        });

        const meta = parseMeta(r.raw);
        const [stdoutPart, stderrPart = ''] = meta.before.split(`\n${ERR}\n`);
        const stdout = stdoutPart.replace(/\n$/, '');
        const stderr = stderrPart.trim();
        const rc = meta.rc ?? r.exitCode;
        const timeMs = meta.elapsedMs ?? r.wallMs;
        const memoryKb = meta.memKb ?? 0;
        const memLimitKb = MEMORY_BYTES / 1024;

        let verdict: TestCaseExecutionResult['verdict'] = 'ACCEPTED';
        if (r.killed) {
          verdict = 'TIME_LIMIT_EXCEEDED';
        } else if (rc === 137 && timeMs >= limitMs - 50) {
          verdict = 'TIME_LIMIT_EXCEEDED'; // timeout -s KILL bắn khi hết giờ
        } else if (rc === 137 || memoryKb >= memLimitKb * 0.98) {
          verdict = 'MEMORY_LIMIT_EXCEEDED'; // OOM killer của cgroup 512MB
        } else if (rc !== 0) {
          verdict = 'RUNTIME_ERROR';
        } else if (tc.expectedOutput !== undefined && tc.expectedOutput !== '') {
          const norm = (s: string) => s.replace(/\r\n/g, '\n').split('\n').map((l) => l.trimEnd()).join('\n').trim();
          if (norm(stdout) !== norm(tc.expectedOutput)) verdict = 'WRONG_ANSWER';
        }

        results.push({
          testcaseIndex: i + 1,
          verdict,
          timeMs: verdict === 'TIME_LIMIT_EXCEEDED' ? Math.max(timeMs, limitMs) : timeMs,
          memoryKb,
          stdout,
          stderr,
          exitCode: rc,
        });
      }

      return { available: true, results };
    } catch (err: any) {
      return { available: false, reason: err.message, results: [] };
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  /**
   * Tạo + chạy + dọn một container với đầy đủ ràng buộc bảo mật của SRS.
   */
  private async executeContainer(opts: {
    image: string;
    script: string;
    srcDir: string;
    buildDir: string;
    buildWritable: boolean;
    watchdogMs: number;
  }): Promise<{ raw: string; exitCode: number; wallMs: number; killed: boolean }> {
    // Chuẩn hóa đường dẫn Windows để Docker daemon không lỗi bind mount
    const norm = (p: string) => p.replace(/\\/g, '/');
    const startTime = Date.now();
    let killed = false;

    const container = await this.docker.createContainer({
      Image: opts.image,
      Cmd: ['sh', '-c', opts.script],
      Tty: true, // gộp luồng -> logs là text thuần, ta tự tách stdout/stderr bằng marker
      User: '1000:1000',      // NON-ROOT: tránh setuid(0) bypass CapDrop=ALL
      NetworkDisabled: true,
      HostConfig: {
        Memory: MEMORY_BYTES,
        MemorySwap: SWAP_TOTAL_BYTES,
        CpuQuota: CPU_QUOTA,
        CpuPeriod: CPU_PERIOD,
        PidsLimit: PIDS_LIMIT,
        NetworkMode: 'none', // --network none
        IpcMode: 'none',
        ReadonlyRootfs: true,
        // exec cần cho JVM/g++ ghi file tạm; dữ liệu vẫn nằm trong RAM 64MB
        Tmpfs: { '/tmp': 'rw,exec,size=64m' },
        CapDrop: ['ALL'],
        SecurityOpt: ['no-new-privileges'], // seccomp mặc định của Docker vẫn áp dụng
        LogConfig: { Type: 'json-file', Config: { 'max-size': '1m' } },
        Binds: [
          `${norm(opts.srcDir)}:/sandbox:ro`,
          `${norm(opts.buildDir)}:/build:${opts.buildWritable ? 'rw' : 'ro'}`,
        ],
      },
    });

    try {
      await container.start();
      const watchdog = setTimeout(async () => {
        killed = true;
        try {
          await container.kill({ signal: 'SIGKILL' });
        } catch {}
      }, opts.watchdogMs);

      const waitResult = await container.wait();
      clearTimeout(watchdog);

      const logs: Buffer = await container.logs({ stdout: true, stderr: true });
      const raw = logs
        .toString('utf-8')
        .replace(/\r\n/g, '\n')
        .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

      return { raw, exitCode: waitResult.StatusCode, wallMs: Date.now() - startTime, killed };
    } finally {
      // Teardown ngay (mục tiêu <= 1.0s), xoá cả volume ẩn danh
      await container.remove({ force: true, v: true }).catch(() => {});
    }
  }
}

/** Tách dòng meta `__AITA_META__ rc=.. s=.. e=.. mem=..` khỏi output. */
function parseMeta(raw: string): { before: string; rc?: number; elapsedMs?: number; memKb?: number } {
  const idx = raw.lastIndexOf(META);
  if (idx === -1) return { before: raw };
  const before = raw.slice(0, idx).replace(/\n$/, '');
  const line = raw.slice(idx).split('\n')[0];
  const get = (k: string) => {
    const m = line.match(new RegExp(`${k}=([0-9.]+)`));
    return m ? Number(m[1]) : undefined;
  };
  const rc = get('rc');
  const s = get('s');
  const e = get('e');
  const mem = get('mem');
  return {
    before,
    rc,
    elapsedMs: s !== undefined && e !== undefined ? Math.max(1, Math.round((e - s) * 1000)) : undefined,
    memKb: mem !== undefined && mem > 0 ? Math.round(mem / 1024) : undefined,
  };
}

let singletonRunner: DockerSandboxRunner | null = null;
export function getDockerSandboxRunner(): DockerSandboxRunner {
  if (!singletonRunner) {
    singletonRunner = new DockerSandboxRunner();
  }
  return singletonRunner;
}
