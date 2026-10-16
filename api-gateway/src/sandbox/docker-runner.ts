/**
 * AITA Docker Sandbox Runner â€” REAL containerised code execution.
 *
 * This is the piece that was previously missing: `SandboxService.executeInDocker()`
 * used to return a hard-coded `'1 2 3 4 5\n'` without ever starting a container, so
 * the grading pipeline scored submissions by regex-scanning the source instead of
 * actually running the test cases.
 *
 * Responsibilities:
 *   1. Resolve the Docker endpoint. Docker Desktop on Windows exposes a NAMED PIPE
 *      (`//./pipe/docker_engine`), not TCP 2375 â€” probing only TCP means Docker is
 *      never detected on a normal developer machine.
 *   2. Compile + run the student's source inside a locked-down container
 *      (512 MB RAM, 1 CPU, pids-limit 64, `--network none`, read-only rootfs,
 *      all capabilities dropped, seccomp profile).
 *   3. Feed a test case on stdin and capture stdout/stderr, translating the
 *      exit status into TLE / MLE / SIGSEGV / COMPILE_ERROR verdicts.
 *
 * Everything degrades safely: if Docker is absent or the image is missing, the
 * caller falls back to the static analyser (see SandboxService).
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
// dockerode is a CommonJS package that exports the constructor directly (it has no
// `.default`). A plain default import compiles to `dockerode_1.default`, which is
// undefined at runtime -> "is not a constructor". `require` keeps it working under
// both CJS and the transpiled TS output.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const DockerConstructor = require('dockerode') as typeof import('dockerode');
type Docker = InstanceType<typeof DockerConstructor>;
type DockerOptions = import('dockerode').DockerOptions;
type Container = import('dockerode').Container;

export type SandboxVerdict =
  | 'PASSED'
  | 'FAILED'
  | 'COMPILE_ERROR'
  | 'TIME_LIMIT_EXCEEDED'
  | 'MEMORY_LIMIT_EXCEEDED'
  | 'RUNTIME_ERROR';

export interface TestCaseInput {
  input: string;
  expectedOutput: string;
  timeLimitMs?: number;
}

export interface TestCaseExecutionResult {
  verdict: SandboxVerdict;
  stdout: string;
  stderr: string;
  exitCode: number;
  timeMs: number;
  memoryKb: number;
  timedOut: boolean;
  compileOutput?: string;
  /** True when stdout matched the expected output after normalisation. */
  matched?: boolean;
}

export interface DockerRunOutcome {
  available: boolean;
  reason?: string;
  /** Filled when the container produced a compile error before any test ran. */
  compileError?: TestCaseExecutionResult;
  results: TestCaseExecutionResult[];
  mode: 'DOCKER' | 'DOCKER_UNAVAILABLE';
}

/** Per-language compile + run recipe inside the container. */
interface LanguageSpec {
  /** Docker image used for compile & run. */
  image: string;
  /** File name written into the sandbox directory. */
  filename: string;
  /** Compile command, or null for interpreted languages. */
  compile?: string[];
  /** Run command executed once per test case (file is compiled once, run many times). */
  run: string[];
}

const SANDBOX_DIR = '/sandbox';

const LANGUAGES: Record<string, LanguageSpec> = {
  python: {
    image: 'python:3.11-slim',
    filename: 'Solution.py',
    // -I = isolated mode: no user site-packages, no env leakage.
    run: ['python3', '-I', `${SANDBOX_DIR}/Solution.py`],
  },
  java: {
    image: 'eclipse-temurin:17-jdk',
    filename: 'Solution.java',
    // javac needs a writable output dir -> use /tmp (tmpfs mount).
    compile: ['javac', '-d', '/tmp/classes', `${SANDBOX_DIR}/Solution.java`],
    run: ['java', '-Xmx384m', '-XX:+UseSerialGC', '-cp', '/tmp/classes', 'Solution'],
  },
  cpp: {
    image: 'gcc:13',
    filename: 'Solution.cpp',
    compile: ['g++', '-O2', '-std=c++17', '-o', '/tmp/a.out', `${SANDBOX_DIR}/Solution.cpp`],
    run: ['/tmp/a.out'],
  },
  c: {
    image: 'gcc:13',
    filename: 'Solution.c',
    compile: ['gcc', '-O2', '-std=c11', '-o', '/tmp/a.out', `${SANDBOX_DIR}/Solution.c`],
    run: ['/tmp/a.out'],
  },
  dotnet: {
    image: 'mcr.microsoft.com/dotnet/sdk:8.0',
    filename: 'Program.cs',
    // `dotnet run` needs a writable project dir; build into tmpfs.
    compile: ['sh', '-c', `cd /tmp && dotnet new console -o app --force >/dev/null 2>&1 && cp ${SANDBOX_DIR}/Program.cs /tmp/app/Program.cs && cd /tmp/app && dotnet build -c Release -o /tmp/out >/dev/null`],
    run: ['dotnet', '/tmp/out/app.dll'],
  },
};

const DEFAULT_TIME_LIMIT_MS = 2000;
const MEMORY_LIMIT_BYTES = 512 * 1024 * 1024;
const PIDS_LIMIT = 64;
/** Container teardown budget from the SRS (<= 1.0s). */
const TEARDOWN_BUDGET_MS = 1000;

export class DockerSandboxRunner {
  private docker: Docker | null = null;
  private available: boolean | null = null;
  private availabilityReason = '';
  private readonly seccompPath: string;

  constructor(seccompPath?: string) {
    this.seccompPath = seccompPath || this.resolveSeccompPath();
  }

  /** Looks for the seccomp profile in the sandbox subsystem and next to this build. */
  private resolveSeccompPath(): string {
    const candidates = [
      path.resolve(process.cwd(), '..', 'sandbox', 'security', 'seccomp.json'),
      path.resolve(process.cwd(), 'sandbox', 'security', 'seccomp.json'),
      path.resolve(__dirname, '..', '..', '..', '..', 'sandbox', 'security', 'seccomp.json'),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate;
    }
    return '';
  }

  /**
   * Detects Docker once per process.
   *
   * Docker Desktop on Windows/macOS uses a named pipe / unix socket, NOT TCP:2375.
   * dockerode picks the right default when constructed with no arguments, so we let
   * it decide and only fall back to an explicit TCP host when configured via env.
   */
  public async isAvailable(): Promise<boolean> {
    if (this.available !== null) return this.available;

    try {
      const options: DockerOptions = {};
      if (process.env.DOCKER_HOST) {
        // e.g. tcp://127.0.0.1:2375 or npipe:////./pipe/docker_engine
        options.host = process.env.DOCKER_HOST;
      } else if (process.env.DOCKER_SOCKET) {
        options.socketPath = process.env.DOCKER_SOCKET;
      }

      this.docker = new DockerConstructor(options);
      // ping() rejects quickly when the daemon is not reachable.
      await Promise.race([
        this.docker.ping(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('docker ping timeout (1500ms)')), 1500)),
      ]);

      const info = await this.docker.info();
      this.available = true;
      this.availabilityReason = `daemon ${info.ServerVersion} on ${info.OperatingSystem}`;
      return true;
    } catch (err: any) {
      this.available = false;
      this.availabilityReason = err?.message || 'docker daemon unreachable';
      this.docker = null;
      return false;
    }
  }

  public getAvailabilityReason(): string {
    return this.availabilityReason;
  }

  /** True when the image is already present locally (we never pull automatically). */
  public async hasImage(language: string): Promise<boolean> {
    const spec = this.specFor(language);
    if (!spec || !this.docker) return false;
    try {
      await this.docker.getImage(spec.image).inspect();
      return true;
    } catch {
      return false;
    }
  }

  private specFor(language: string): LanguageSpec | null {
    return LANGUAGES[(language || '').toLowerCase()] || null;
  }

  /**
   * Compiles once, then runs every test case in a fresh container.
   * Returns `available: false` when Docker or the image is unavailable so the
   * caller can fall back instead of failing the submission.
   */
  public async runTestCases(
    language: string,
    sourceCode: string,
    testCases: TestCaseInput[],
  ): Promise<DockerRunOutcome> {
    if (!(await this.isAvailable()) || !this.docker) {
      return { available: false, reason: this.availabilityReason, results: [], mode: 'DOCKER_UNAVAILABLE' };
    }

    const spec = this.specFor(language);
    if (!spec) {
      return { available: false, reason: `unsupported language '${language}'`, results: [], mode: 'DOCKER_UNAVAILABLE' };
    }

    if (!(await this.hasImage(language))) {
      return {
        available: false,
        reason: `image '${spec.image}' not present locally (run: docker pull ${spec.image})`,
        results: [],
        mode: 'DOCKER_UNAVAILABLE',
      };
    }

    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aita-sandbox-'));
    // The container runs unprivileged but the compiled-artefact dir must be writable
    // by the sandbox user, so widen permissions on the bind-mounted folder only.
    fs.writeFileSync(path.join(workDir, spec.filename), sourceCode, 'utf-8');
    try {
      fs.chmodSync(workDir, 0o777);
      fs.chmodSync(path.join(workDir, spec.filename), 0o644);
    } catch {
      // Windows hosts ignore POSIX modes; the container user is root in the images we use.
    }

    try {
      // â”€â”€ Compile step (only if the language needs one) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      if (spec.compile) {
        const compileResult = await this.runOnce(spec, workDir, spec.compile, '', DEFAULT_TIME_LIMIT_MS * 5);
        if (compileResult.exitCode !== 0) {
          return {
            available: true,
            compileError: {
              ...compileResult,
              verdict: 'COMPILE_ERROR',
              compileOutput: `${compileResult.stdout}\n${compileResult.stderr}`.trim(),
            },
            results: [],
            mode: 'DOCKER',
          };
        }
      }

      // â”€â”€ Run every test case â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const results: TestCaseExecutionResult[] = [];
      for (const tc of testCases) {
        const limit = tc.timeLimitMs && tc.timeLimitMs > 0 ? tc.timeLimitMs : DEFAULT_TIME_LIMIT_MS;
        const runResult = await this.runOnce(spec, workDir, spec.run, tc.input, limit);
        const matched = this.outputsMatch(runResult.stdout, tc.expectedOutput);
        results.push({
          ...runResult,
          verdict: this.classify(runResult, limit, matched),
          matched,
        });
      }

      return { available: true, results, mode: 'DOCKER' };
    } finally {
      try {
        fs.rmSync(workDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup failures
      }
    }
  }

  /**
   * Starts one container, writes stdin, waits for exit under a watchdog, and always
   * removes the container (SRS: teardown <= 1.0s, no orphaned containers).
   */
  private async runOnce(
    spec: LanguageSpec,
    workDir: string,
    cmd: string[],
    stdin: string,
    timeLimitMs: number,
  ): Promise<TestCaseExecutionResult> {
    const docker = this.docker!;
    const startTime = Date.now();
    let container: Container | null = null;
    let timedOut = false;

    const securityOpt: string[] = [];
    if (fs.existsSync(this.seccompPath)) {
      // Docker's seccomp option accepts an inline JSON string.
      securityOpt.push(`seccomp=${fs.readFileSync(this.seccompPath, 'utf-8')}`);
    }

    try {
      container = await docker.createContainer({
        Image: spec.image,
        Cmd: cmd,
        WorkingDir: SANDBOX_DIR,
        Tty: false,
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true,
        NetworkDisabled: true,
        HostConfig: {
          Memory: MEMORY_LIMIT_BYTES,
          MemorySwap: MEMORY_LIMIT_BYTES,
          CpuQuota: 100000,
          CpuPeriod: 100000,
          PidsLimit: PIDS_LIMIT,
          NetworkMode: 'none',
          IpcMode: 'none',
          ReadonlyRootfs: true,
          // Writable tmpfs for compiler output; /sandbox itself stays read-only.
          Tmpfs: { '/tmp': 'rw,size=64m,exec' },
          CapDrop: ['ALL'],
          SecurityOpt: securityOpt.length ? securityOpt : undefined,
          Binds: [`${workDir}:${SANDBOX_DIR}:ro`],
          LogConfig: { Type: 'json-file', Config: { 'max-size': '1m', 'max-file': '1' } },
        },
      });

      const stream = await container.attach({ stream: true, stdin: true, stdout: true, stderr: true });
      await container.start();

      // Feed stdin, then close it so programs reading until EOF terminate.
      if (stdin) stream.write(stdin.endsWith('\n') ? stdin : `${stdin}\n`);
      stream.end();

      // Drain stdout/stderr, demultiplexing the Docker stream header.
      let stdout = '';
      let stderr = '';
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      const drained = new Promise<void>((resolve) => stream.on('end', () => resolve()));

      const waitResult = await this.waitWithWatchdog(container, timeLimitMs);
      timedOut = waitResult.timedOut;
      const exitCode = waitResult.exitCode;

      await Promise.race([drained, new Promise((r) => setTimeout(r, 300))]);
      const demuxed = this.demux(Buffer.concat(chunks));
      stdout = demuxed.stdout;
      stderr = demuxed.stderr;

      return {
        verdict: 'FAILED',
        stdout: this.truncate(stdout),
        stderr: this.truncate(stderr),
        exitCode,
        timeMs: Date.now() - startTime,
        memoryKb: 0,
        timedOut,
      };
    } catch (err: any) {
      return {
        verdict: 'RUNTIME_ERROR',
        stdout: '',
        stderr: `[Sandbox] ${err?.message || String(err)}`,
        exitCode: -1,
        timeMs: Date.now() - startTime,
        memoryKb: 0,
        timedOut: false,
      };
    } finally {
      // Always remove the container, even on the timeout path.
      if (container) {
        const started = Date.now();
        try {
          await container.remove({ force: true, v: true });
        } catch {
          // already gone
        }
        const teardownMs = Date.now() - started;
        if (teardownMs > TEARDOWN_BUDGET_MS) {
          // Surfaced via stderr of the caller's log, not thrown.
          process.stderr.write(`[Sandbox] teardown took ${teardownMs}ms (> ${TEARDOWN_BUDGET_MS}ms budget)\n`);
        }
      }
    }
  }

  /** Waits for the container to exit, killing it when the time limit is exceeded. */
  private async waitWithWatchdog(
    container: Container,
    timeLimitMs: number,
  ): Promise<{ exitCode: number; timedOut: boolean }> {
    let timedOut = false;
    const waitPromise = container.wait();

    const watchdog = new Promise<{ StatusCode: number }>((resolve) => {
      setTimeout(async () => {
        timedOut = true;
        try {
          await container.kill({ signal: 'SIGKILL' });
        } catch {
          // container already exited
        }
        resolve({ StatusCode: 137 });
      }, timeLimitMs);
    });

    const result: any = await Promise.race([waitPromise.catch(() => ({ StatusCode: -1 })), watchdog]);
    return { exitCode: typeof result?.StatusCode === 'number' ? result.StatusCode : -1, timedOut };
  }

  /** Maps a raw exit status + output onto the verdict vocabulary. */
  private classify(
    result: TestCaseExecutionResult,
    timeLimitMs: number,
    matched: boolean,
  ): SandboxVerdict {
    if (result.timedOut || result.exitCode === 137 && result.timeMs >= timeLimitMs) {
      return 'TIME_LIMIT_EXCEEDED';
    }
    if (result.exitCode === 137) return 'MEMORY_LIMIT_EXCEEDED';
    if (result.exitCode === 139) return 'RUNTIME_ERROR'; // SIGSEGV
    if (result.exitCode === 134) return 'RUNTIME_ERROR'; // SIGABRT
    if (result.exitCode !== 0) return 'RUNTIME_ERROR';
    return matched ? 'PASSED' : 'FAILED';
  }

  /** Normalises trailing whitespace/CRLF before comparing with the expected output. */
  public outputsMatch(actual: string, expected: string): boolean {
    return this.normalise(actual) === this.normalise(expected);
  }

  private normalise(value: string): string {
    return (value || '')
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((line) => line.replace(/\s+$/, ''))
      .join('\n')
      .trim();
  }

  /**
   * Docker multiplexes stdout/stderr with an 8-byte header per frame when TTY is off.
   * Falls back to raw text when the payload is not framed.
   */
  private demux(buffer: Buffer): { stdout: string; stderr: string } {
    let stdout = '';
    let stderr = '';
    let offset = 0;
    let framed = false;

    while (offset + 8 <= buffer.length) {
      const streamType = buffer[offset];
      // Frame header: [type(1)][0][0][0][size(4, big-endian)]
      if ((streamType !== 1 && streamType !== 2) || buffer[offset + 1] !== 0 || buffer[offset + 2] !== 0 || buffer[offset + 3] !== 0) {
        break;
      }
      const size = buffer.readUInt32BE(offset + 4);
      if (offset + 8 + size > buffer.length) break;
      const payload = buffer.subarray(offset + 8, offset + 8 + size).toString('utf-8');
      if (streamType === 1) stdout += payload;
      else stderr += payload;
      framed = true;
      offset += 8 + size;
    }

    if (!framed) {
      const raw = buffer.toString('utf-8').replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
      return { stdout: raw, stderr: '' };
    }
    return { stdout, stderr };
  }

  private truncate(value: string, max = 20000): string {
    if (value.length <= max) return value;
    return `${value.slice(0, max)}\n... [TRUNCATED ${value.length - max} chars]`;
  }
}

/** Shared singleton so the Docker connection is probed once per process. */
let sharedRunner: DockerSandboxRunner | null = null;
export function getDockerSandboxRunner(): DockerSandboxRunner {
  if (!sharedRunner) sharedRunner = new DockerSandboxRunner();
  return sharedRunner;
}
