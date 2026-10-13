/**
 * AITA Goal Gates — API Gateway verification.
 *
 * Mirrors verify-gateway.ts: boots Nest AppModule when :3000 is free, else
 * hits the live server. Covers (a) auth guard + valid SSO flow, (b) queue
 * submit->status via the real sample_solution_pass.zip, (c) appeals
 * create/resolve/BR-05 cap. Prints [PASS]/[FAIL] + summary. Target < 3 min.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as http from 'http';
import * as net from 'net';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';

function httpRequest(
  urlStr: string,
  method: string,
  data?: any,
  contentType = 'application/json',
  extraHeaders: Record<string, string> = {},
): Promise<{ statusCode: number; data: any; durationMs: number }> {
  const url = new URL(urlStr);
  let bodyBuffer: Buffer | null = null;
  if (data) {
    bodyBuffer = Buffer.isBuffer(data)
      ? data
      : Buffer.from(typeof data === 'string' ? data : JSON.stringify(data), 'utf-8');
  }
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port || 3000,
        path: `${url.pathname}${url.search}`,
        method,
        headers: {
          'Content-Type': contentType,
          ...extraHeaders,
          ...(bodyBuffer ? { 'Content-Length': bodyBuffer.length } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          const durationMs = Math.round(performance.now() - start);
          try {
            resolve({ statusCode: res.statusCode || 500, data: JSON.parse(raw), durationMs });
          } catch {
            resolve({ statusCode: res.statusCode || 500, data: raw, durationMs });
          }
        });
      },
    );
    req.on('error', reject);
    if (bodyBuffer) req.write(bodyBuffer);
    req.end();
  });
}

function buildMultipartPayload(
  fields: Record<string, string>,
  fileField: string,
  fileName: string,
  fileBuffer: Buffer,
): { body: Buffer; contentType: string } {
  const boundary = `----AITAGoalGate${Date.now()}`;
  const crlf = '\r\n';
  const parts: Buffer[] = [];
  for (const [key, value] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}${crlf}Content-Disposition: form-data; name="${key}"${crlf}${crlf}${value}${crlf}`, 'utf-8'));
  }
  parts.push(
    Buffer.from(
      `--${boundary}${crlf}Content-Disposition: form-data; name="${fileField}"; filename="${fileName}"${crlf}Content-Type: application/zip${crlf}${crlf}`,
      'utf-8',
    ),
  );
  parts.push(fileBuffer);
  parts.push(Buffer.from(`${crlf}--${boundary}--${crlf}`, 'utf-8'));
  return { body: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${boundary}` };
}

function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = new net.Socket();
    s.setTimeout(300);
    s.on('connect', () => { s.destroy(); resolve(true); });
    s.on('timeout', () => { s.destroy(); resolve(false); });
    s.on('error', () => resolve(false));
    s.connect(port, '127.0.0.1');
  });
}

let passed = 0;
let failed = 0;
function gate(ok: boolean, name: string, details?: string): void {
  if (ok) { passed++; console.log(`[PASS] ${name}`); }
  else { failed++; console.error(`[FAIL] ${name}${details ? ` -> ${details}` : ''}`); }
}

async function main(): Promise<boolean> {
  const started = Date.now();
  const port = parseInt(process.env.AITA_TEST_PORT || '3000', 10);
  let app: any = null;
  if (!(await isPortOpen(port))) {
    app = await NestFactory.create(AppModule, { logger: false });
    app.enableCors({ origin: '*' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen(port);
    console.log(`booted in-memory gateway on :${port}`);
  } else {
    console.log(`using live gateway on :${port}`);
  }
  const base = `http://localhost:${port}`;

  try {
    // (a) Auth guard + valid SSO flow (same routes as verify-gateway.ts).
    const invalid = await httpRequest(`${base}/api/v1/auth/me`, 'GET', undefined, 'application/json', {
      authorization: 'Bearer invalid',
    });
    gate(invalid.statusCode === 401, 'auth guard: invalid JWT -> 401', `got ${invalid.statusCode}`);

    const sso = await httpRequest(`${base}/api/v1/auth/google`, 'POST', {
      email: 'sinhvien.test@fpt.edu.vn',
      fullName: 'Sinh Vien FPT Test',
    });
    gate(sso.statusCode === 200, 'auth google-sso @fpt.edu.vn -> 200', `got ${sso.statusCode}`);
    const token: string | undefined = sso.data?.data?.token;
    gate(typeof token === 'string' && token.length > 0, 'auth google-sso returns token');

    const me = await httpRequest(`${base}/api/v1/auth/me`, 'GET', undefined, 'application/json', {
      authorization: `Bearer ${token}`,
    });
    gate(
      me.statusCode === 200 && me.data?.data?.email === 'sinhvien.test@fpt.edu.vn',
      'auth /me with valid token -> 200',
      `got ${me.statusCode} ${JSON.stringify(me.data)?.slice(0, 120)}`,
    );

    // (b) Queue submit->status with the real passing sample.
    const zipPath = path.resolve(process.cwd(), '..', 'sample_solution_pass.zip');
    const zipBuf = fs.readFileSync(zipPath);
    const expectedSha = crypto.createHash('sha256').update(zipBuf).digest('hex');
    const payload = buildMultipartPayload(
      { studentId: 'SE170000', assignmentId: 'TASK-SWP391-SPRINT2', language: 'java' },
      'file',
      'sample_solution_pass.zip',
      zipBuf,
    );
    const sub = await httpRequest(`${base}/api/v1/submissions`, 'POST', payload.body, payload.contentType);
    gate(sub.statusCode === 202, 'queue submit -> 202', `got ${sub.statusCode}`);
    gate(sub.data?.data?.sha256Hash === expectedSha, 'queue submit sha256 match');
    gate(
      typeof sub.data?.data?.processingTimeMs === 'number' && sub.data.data.processingTimeMs < 200,
      'queue submit enqueue <200ms',
      `got ${sub.data?.data?.processingTimeMs}ms`,
    );
    const submissionId: string = sub.data?.data?.submissionId;

    let detail: any = null;
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2000));
      const st = await httpRequest(`${base}/api/v1/submissions/${submissionId}`, 'GET');
      detail = st.data?.data;
      if (detail?.status === 'COMPLETED' || detail?.status === 'FAILED') break;
    }
    gate(detail?.status === 'COMPLETED', 'queue submission reaches COMPLETED', `got ${detail?.status}`);
    const result = detail?.details ?? {};
    gate(typeof result.score === 'number', 'queue result score numeric', `got ${result.score}`);
    gate(!!result.scoreBreakdown && typeof result.scoreBreakdown.total === 'number', 'queue result scoreBreakdown sane');
    gate(!!result.aiRating && typeof result.aiRating.cleanCodeScore === 'number', 'queue result aiRating sane');
    gate(
      result.passedTestcases !== undefined && result.totalTestcases === 2,
      'queue result test breakdown sane',
      `got ${result.passedTestcases}/${result.totalTestcases}`,
    );

    // (c) Appeals: create (201) + resolve (200 ACCEPTED) + third create (400).
    const reason1 = 'Gate appeal 1: request re-check of testcase timing margin, please review.';
    const a1 = await httpRequest(`${base}/api/v1/appeals`, 'POST', {
      submissionId,
      studentId: 'SE170000',
      reason: reason1,
    });
    gate(a1.statusCode === 201, 'appeals create #1 -> 201', `got ${a1.statusCode}`);
    const appealId: string | undefined = a1.data?.data?.appealId;

    const resolve = await httpRequest(`${base}/api/v1/appeals/${appealId}/resolve`, 'PUT', {
      status: 'ACCEPTED',
      reviewerId: 'GV001',
      resolutionNote: 'Gate resolution: re-checked, timing within margin.',
      adjustedScore: 9.5,
    });
    gate(
      resolve.statusCode === 200 && resolve.data?.data?.status === 'ACCEPTED',
      'appeals resolve -> 200 ACCEPTED',
      `got ${resolve.statusCode} ${resolve.data?.data?.status}`,
    );

    const a2 = await httpRequest(`${base}/api/v1/appeals`, 'POST', {
      submissionId,
      studentId: 'SE170000',
      reason: 'Gate appeal 2: supplementary explanation of O(N log N) approach.',
    });
    gate(a2.statusCode === 201, 'appeals create #2 -> 201', `got ${a2.statusCode}`);

    const a3 = await httpRequest(`${base}/api/v1/appeals`, 'POST', {
      submissionId,
      studentId: 'SE170000',
      reason: 'Gate appeal 3: must be rejected by BR-05 cap of 2.',
    });
    gate(a3.statusCode === 400, 'appeals create #3 rejected -> 400', `got ${a3.statusCode}`);
  } finally {
    if (app) await app.close();
  }

  const elapsed = Date.now() - started;
  console.log(`---\nGATES: ${passed} passed, ${failed} failed (${elapsed}ms)`);
  if (elapsed >= 180000) { failed++; console.error('[FAIL] total runtime >= 3min'); }
  return failed === 0;
}

export { main as runGoalGates };

if (require.main === module) {
  main().then((ok) => {
    if (!ok) process.exit(1);
  }).catch((err) => {
    console.error('[FAIL] verify-goal-gates crashed:', err);
    process.exit(1);
  });
}
