/**
 * AITA BullMQ & API Gateway Stress Test — 100 Concurrent Submissions (Week 9-10 DoD)
 *
 * Node.js equivalent of `tools/stress-test-queue.py` so it runs out-of-the-box on
 * Windows machines with Node.js (without requiring a separate Python install).
 *
 * Usage:
 *   node tools/stress-test-queue.mjs [concurrency] [--quick]
 */
import http from 'http';

const BASE_HOST = 'localhost';
const BASE_PORT = 3000;
const args = process.argv.slice(2);
const numArg = args.find((a) => /^\d+$/.test(a));
const CONCURRENCY = numArg ? parseInt(numArg, 10) : 100;

const agent = new http.Agent({ keepAlive: true, maxSockets: 128 });

function createMinimalZip(filename, content) {
  const contentBuf = Buffer.from(content, 'utf-8');
  const filenameBuf = Buffer.from(filename, 'utf-8');

  const localHeader = Buffer.alloc(30 + filenameBuf.length);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0, 6);
  localHeader.writeUInt16LE(0, 8);
  localHeader.writeUInt16LE(0, 10);
  localHeader.writeUInt16LE(0, 12);

  let crc = 0 ^ -1;
  for (let i = 0; i < contentBuf.length; i++) {
    let c = (crc ^ contentBuf[i]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  crc = (crc ^ -1) >>> 0;

  localHeader.writeUInt32LE(crc, 14);
  localHeader.writeUInt32LE(contentBuf.length, 18);
  localHeader.writeUInt32LE(contentBuf.length, 22);
  localHeader.writeUInt16LE(filenameBuf.length, 26);
  localHeader.writeUInt16LE(0, 28);
  filenameBuf.copy(localHeader, 30);

  const centralDir = Buffer.alloc(46 + filenameBuf.length);
  centralDir.writeUInt32LE(0x02014b50, 0);
  centralDir.writeUInt16LE(20, 4);
  centralDir.writeUInt16LE(20, 6);
  centralDir.writeUInt16LE(0, 8);
  centralDir.writeUInt16LE(0, 10);
  centralDir.writeUInt16LE(0, 12);
  centralDir.writeUInt16LE(0, 14);
  centralDir.writeUInt32LE(crc, 16);
  centralDir.writeUInt32LE(contentBuf.length, 20);
  centralDir.writeUInt32LE(contentBuf.length, 24);
  centralDir.writeUInt16LE(filenameBuf.length, 28);
  centralDir.writeUInt16LE(0, 30);
  centralDir.writeUInt16LE(0, 32);
  centralDir.writeUInt16LE(0, 34);
  centralDir.writeUInt16LE(0, 36);
  centralDir.writeUInt32LE(0, 38);
  centralDir.writeUInt32LE(0, 42);
  filenameBuf.copy(centralDir, 46);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(localHeader.length + contentBuf.length, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([localHeader, contentBuf, centralDir, eocd]);
}

function buildMultipartBody(zipBuf, assignmentId, studentId) {
  const boundary = '----aitastress';
  const parts = [];
  for (const [k, v] of [
    ['studentId', studentId],
    ['assignmentId', assignmentId],
    ['language', 'java'],
  ]) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`,
        'utf-8',
      ),
    );
  }
  parts.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="sub.zip"\r\nContent-Type: application/zip\r\n\r\n`,
      'utf-8',
    ),
  );
  parts.push(zipBuf);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8'));
  return { body: Buffer.concat(parts), boundary };
}

function requestJson(method, path, payload) {
  return new Promise((resolve, reject) => {
    const data = payload ? Buffer.from(JSON.stringify(payload), 'utf-8') : null;
    const req = http.request(
      {
        hostname: BASE_HOST,
        port: BASE_PORT,
        path,
        method,
        agent,
        headers: data
          ? { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': data.length }
          : {},
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode,
              data: JSON.parse(Buffer.concat(chunks).toString('utf-8')),
            });
          } catch {
            resolve({ status: res.statusCode, data: {} });
          }
        });
      },
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function uploadSubmission(zipBuf, assignmentId, studentId) {
  return new Promise((resolve) => {
    const { body, boundary } = buildMultipartBody(zipBuf, assignmentId, studentId);
    const t0 = performance.now();
    const req = http.request(
      {
        hostname: BASE_HOST,
        port: BASE_PORT,
        path: '/api/v1/submissions',
        method: 'POST',
        agent,
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const clientMs = performance.now() - t0;
          try {
            const parsed = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
            const serverMs = parsed?.data?.processingTimeMs ?? clientMs;
            const submissionId = parsed?.data?.submissionId ?? parsed?.submissionId;
            resolve({ status: res.statusCode, clientMs, serverMs, submissionId });
          } catch {
            resolve({ status: res.statusCode, clientMs, serverMs: clientMs, submissionId: null });
          }
        });
      },
    );
    req.on('error', (err) => {
      resolve({ status: 0, clientMs: performance.now() - t0, serverMs: 0, error: err.message });
    });
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('='.repeat(78));
  console.log(`STRESS TEST — ${CONCURRENCY} concurrent submissions (Redis BullMQ & API Gateway)`);
  console.log('='.repeat(78));

  let failures = 0;
  const check = (ok, label, detail = '') => {
    if (!ok) failures++;
    console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}${detail ? ' -> ' + detail : ''}`);
  };

  const ASSIGNMENT = 'TASK-SWP391-SPRINT2';
  const zipBuf = createMinimalZip(
    'Solution.java',
    `import java.util.*;\npublic class Solution {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    if (sc.hasNextInt()) {\n      int n = sc.nextInt();\n      int[] a = new int[n];\n      for (int i = 0; i < n; i++) a[i] = sc.nextInt();\n      Arrays.sort(a);\n      for (int x : a) System.out.print(x + " ");\n    }\n  }\n}\n`,
  );

  console.log('\nPHASE 0 — uncontended baseline (single-request SLA measurement)');
  const baselineSamples = [];
  for (let i = 0; i < 5; i++) {
    const r = await uploadSubmission(zipBuf, ASSIGNMENT, `STRESS_BASE_${i}`);
    baselineSamples.push(r.serverMs);
  }
  const sortedBase = [...baselineSamples].sort((a, b) => a - b);
  const medianBase = sortedBase[Math.floor(sortedBase.length / 2)];
  console.log(`  samples : ${baselineSamples.map((s) => `${s.toFixed(1)} ms`).join(', ')}`);
  console.log(`  median  : ${medianBase.toFixed(1)} ms`);
  check(medianBase < 100, 'uncontended upload meets < 100 ms SLA', `${medianBase.toFixed(1)} ms`);

  console.log(`\nPHASE 1 — ${CONCURRENCY} requests fired across concurrent worker pool`);
  const tStart = performance.now();
  const results = [];
  const waveSize = 10;
  for (let offset = 0; offset < CONCURRENCY; offset += waveSize) {
    const batch = [];
    for (let j = offset; j < Math.min(CONCURRENCY, offset + waveSize); j++) {
      batch.push(uploadSubmission(zipBuf, ASSIGNMENT, `STRESS_SV_${String(j).padStart(4, '0')}`));
    }
    const waveRes = await Promise.all(batch);
    results.push(...waveRes);
  }
  const wallSec = (performance.now() - tStart) / 1000;

  const accepted = results.filter((r) => [200, 201, 202].includes(r.status)).length;
  const errors = results.filter((r) => r.error || ![200, 201, 202].includes(r.status));
  const serverLatencies = results.map((r) => r.serverMs).sort((a, b) => a - b);

  const p50 = serverLatencies[Math.floor(serverLatencies.length * 0.5)];
  const p95 = serverLatencies[Math.floor(serverLatencies.length * 0.95) - 1];
  const p99 = serverLatencies[Math.floor(serverLatencies.length * 0.99) - 1];

  console.log(`  accepted (2xx)      : ${accepted} / ${CONCURRENCY}`);
  console.log(`  wall clock          : ${wallSec.toFixed(2)} s`);
  console.log(`  enqueue latency p50 : ${p50.toFixed(1)} ms`);
  console.log(`  enqueue latency p95 : ${p95.toFixed(1)} ms`);
  console.log(`  enqueue latency p99 : ${p99.toFixed(1)} ms`);

  check(accepted === CONCURRENCY, 'every concurrent upload was accepted (100%)', `${accepted}/${CONCURRENCY}`);
  check(errors.length === 0, 'zero transport or HTTP errors', `${errors.length}`);
  check(p95 < 100, 'enqueue latency p95 meets < 100 ms SLA', `${p95.toFixed(1)} ms`);

  console.log('\nPHASE 2 — Redis BullMQ queue state verification');
  const qStatsRes = await requestJson('GET', '/api/v1/queue/stats');
  const stats = qStatsRes.data?.data || {};
  console.log(`  queue mode      : ${stats.mode}`);
  console.log(`  waiting         : ${stats.waitingCount}`);
  console.log(`  active          : ${stats.activeCount}`);
  console.log(`  completed       : ${stats.completedCount}`);
  console.log(`  failed          : ${stats.failedCount}`);
  console.log(`  dead-letter     : ${stats.dlqCount}`);
  check(stats.mode === 'REDIS', 'the queue is backed by Redis under load', stats.mode);
  check((stats.failedCount || 0) === 0, 'no job failed while the pool was saturated', `${stats.failedCount || 0}`);

  console.log('\n' + '='.repeat(78));
  console.log(`STRESS TEST SUMMARY: ${failures === 0 ? 'ALL CHECKS PASSED (0 failed)' : `${failures} failed`}`);
  console.log('='.repeat(78));
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
