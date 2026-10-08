import * as http from 'http';
import * as net from 'net';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';

let passed = 0;
let failed = 0;
function check(ok: boolean, name: string, details?: string): void {
  if (ok) { passed++; console.log(`[PASS] ${name}`); }
  else { failed++; console.error(`[FAIL] ${name}${details ? ` -> ${details}` : ''}`); }
}

function req(urlStr: string, method: string, data?: any): Promise<{ statusCode: number; data: any }> {
  const url = new URL(urlStr);
  const body = data ? Buffer.from(JSON.stringify(data), 'utf-8') : null;
  return new Promise((resolve, reject) => {
    const r = http.request(
      { hostname: url.hostname, port: url.port || 3000, path: `${url.pathname}${url.search}`, method, headers: { 'Content-Type': 'application/json', ...(body ? { 'Content-Length': body.length } : {}) } },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          try { resolve({ statusCode: res.statusCode || 500, data: JSON.parse(raw) }); }
          catch { resolve({ statusCode: res.statusCode || 500, data: raw }); }
        });
      },
    );
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
}

function portOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = new net.Socket();
    s.setTimeout(300);
    s.on('connect', () => { s.destroy(); resolve(true); });
    s.on('timeout', () => { s.destroy(); resolve(false); });
    s.on('error', () => resolve(false));
    s.connect(port, '127.0.0.1');
  });
}

async function main(): Promise<boolean> {
  const port = parseInt(process.env.AITA_TEST_PORT || '3126', 10);
  let app: any = null;
  if (!(await portOpen(port))) {
    app = await NestFactory.create(AppModule, { logger: false });
    app.enableCors({ origin: '*' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen(port);
  }
  const base = `http://localhost:${port}`;
  const timer = setTimeout(() => { console.error('[FAIL] timeout'); process.exit(1); }, 80000);
  try {
    const ts = Date.now();
    const asmId = `ASM-TC-${ts}`;
    const aRes = await req(`${base}/api/v1/assignments`, 'POST', {
      assignmentId: asmId, courseId: `CRS-${ts}`, title: `TC fixture ${ts}`,
      deadline: new Date(Date.now() + 86400000).toISOString(),
    });
    check(aRes.statusCode === 201, 'create assignment', `${aRes.statusCode}`);

    const c1 = await req(`${base}/api/v1/test-cases`, 'POST', { assignmentId: asmId, inputData: 'input-1', expectedOutput: 'output-1' });
    check(c1.statusCode === 201, 'create public test case', `${c1.statusCode}`);
    const tc1Id = c1.data?.data?.testCaseId;
    const c2 = await req(`${base}/api/v1/test-cases`, 'POST', { assignmentId: asmId, inputData: 'input-2', expectedOutput: 'output-2', isHidden: true });
    check(c2.statusCode === 201, 'create hidden test case', `${c2.statusCode}`);
    const tc2Id = c2.data?.data?.testCaseId;

    const list = await req(`${base}/api/v1/test-cases/assignment/${asmId}`, 'GET');
    const hiddenRow = (list.data?.data || []).find((t: any) => t.testCaseId === tc2Id);
    check(list.statusCode === 200, 'list without includeHidden 200', `${list.statusCode}`);
    check(hiddenRow && hiddenRow.expectedOutput === null, 'hidden expectedOutput null for students', JSON.stringify(hiddenRow));

    const listH = await req(`${base}/api/v1/test-cases/assignment/${asmId}?includeHidden=true`, 'GET');
    const hiddenRowH = (listH.data?.data || []).find((t: any) => t.testCaseId === tc2Id);
    check(listH.statusCode === 200 && hiddenRowH && hiddenRowH.expectedOutput === 'output-2', 'list includeHidden=true shows expected', JSON.stringify(hiddenRowH));

    const g1 = await req(`${base}/api/v1/test-cases/${tc1Id}`, 'GET');
    check(g1.statusCode === 200 && g1.data?.data?.testCaseId === tc1Id, 'get one test case', `${g1.statusCode}`);

    const up = await req(`${base}/api/v1/test-cases/${tc1Id}`, 'PUT', { weight: 2.5 });
    check(up.statusCode === 200 && up.data?.data?.weight === 2.5, 'update weight', `${up.statusCode} ${JSON.stringify(up.data?.data)}`);

    const del = await req(`${base}/api/v1/test-cases/${tc2Id}`, 'DELETE');
    check(del.statusCode === 200 && del.data?.success === true, 'delete returns success', `${del.statusCode} ${JSON.stringify(del.data)}`);

    const miss = await req(`${base}/api/v1/test-cases/NOPE-${ts}`, 'GET');
    check(miss.statusCode === 404, 'get missing 404', `${miss.statusCode}`);

    const bad = await req(`${base}/api/v1/test-cases`, 'POST', { assignmentId: asmId, inputData: '   ', expectedOutput: 'x' });
    check(bad.statusCode === 400, 'create empty input 400', `${bad.statusCode}`);

    const dup = await req(`${base}/api/v1/test-cases`, 'POST', { assignmentId: asmId, inputData: 'input-1', expectedOutput: 'output-1' });
    check(dup.statusCode === 409, 'duplicate 409', `${dup.statusCode}`);

    console.log(`---\nTEST-CASES: ${passed} passed, ${failed} failed`);
    return failed === 0;
  } finally {
    clearTimeout(timer);
    if (app) await app.close();
  }
}

export { main as runTestCasesSuite };

if (require.main === module) {
  main().then((ok) => { if (!ok) process.exit(1); }).catch((e) => { console.error(e); process.exit(1); });
}
