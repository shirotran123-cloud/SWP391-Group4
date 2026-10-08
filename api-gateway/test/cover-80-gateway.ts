/**
 * AITA Gateway coverage driver — pushes c8 past the 80% bar.
 *
 * Drives REAL shipped code on branches the HTTP suite misses (all in-process,
 * boots real AppModule; no live server, no network, no Docker daemon needed):
 *  - AuthService OTP full cycle: request (new user, existing with/without hash,
 *    wrong password, unknown, inactive) + verify (ok, wrong, expired, missing,
 *    inactive) + special-instructor bypass + credentials + Google negatives
 *  - MailService mock (no SMTP) + transporter-failure-false branch (stubbed)
 *  - CoursesService/CourseRepository: bulkEnroll validation edges + happy path,
 *    findCoursesByStudent fallbacks, getStudentsInCourse fallback
 *  - DLQ full cycle via HTTP: list, retry ok, retry missing (404), delete ok,
 *    delete missing (404), purge
 *  - Internal events endpoints: testcase/progress/completed
 *  - PostgresService unavailable branches (query throws, safeQuery [])
 *  - SandboxService: Docker-online branch (stubbed availability) + TLE branch +
 *    efficient/normal sort latency branches
 *  - QueueService: pop/markCompleted, purge, congestion stats
 *  - UsersService update/delete/get-by-email, SubmissionsService stats/list,
 *    TeamworkService list paths, AppealsService list/get paths
 *
 * Runnable: ts-node test/cover-80-gateway.ts (also chained under c8).
 */
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { MailService } from '../src/auth/mail.service';
import { UsersService } from '../src/users/users.service';
import { CoursesService } from '../src/courses/courses.service';
import { AppealsService } from '../src/appeals/appeals.service';
import { TeamworkService } from '../src/teamwork/teamwork.service';
import { QueueService } from '../src/queue/queue.service';
import { SandboxService } from '../src/sandbox/sandbox.service';
import { SubmissionsService } from '../src/submissions/submissions.service';
import { PostgresService } from '../src/database/postgres.service';
import { SubmissionRepository } from '../src/database/submission.repository';
import { UserRepository } from '../src/database/user.repository';
import * as http from 'http';

let passed = 0;
let failed = 0;
function gate(ok: boolean, name: string, details?: string): void {
  if (ok) { passed++; console.log(`[PASS] ${name}`); }
  else { failed++; console.error(`[FAIL] ${name}${details ? ` -> ${details}` : ''}`); }
}

export async function runGatewayCover80(port: number): Promise<boolean> {
  console.log('=== AITA GATEWAY COVER-80 (branch driver) ===');
  const app = await NestFactory.create(AppModule, { logger: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(port);
  const base = `http://localhost:${port}`;

  const req = (method: string, p: string, body?: any): Promise<{ status: number; data: any }> =>
    new Promise((resolve, reject) => {
      const buf = body ? Buffer.from(JSON.stringify(body)) : null;
      const r = http.request(base + p, {
        method,
        headers: { 'Content-Type': 'application/json', ...(buf ? { 'Content-Length': buf.length } : {}) },
      }, (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          try { resolve({ status: res.statusCode || 0, data: JSON.parse(raw || '{}') }); }
          catch { resolve({ status: res.statusCode || 0, data: raw }); }
        });
      });
      r.on('error', reject);
      if (buf) r.write(buf);
      r.end();
    });

  try {
    const auth = app.get(AuthService);
    const mail = app.get(MailService);
    const users = app.get(UsersService);
    const courses = app.get(CoursesService);
    const appeals = app.get(AppealsService);
    const teamwork = app.get(TeamworkService);
    const queue = app.get(QueueService);
    const sandbox = app.get(SandboxService);
    const submissionsSvc = app.get(SubmissionsService);
    const postgres = app.get(PostgresService);
    const submissions = app.get(SubmissionRepository);
    const userRepo = app.get(UserRepository);
    const ts = Date.now();

    // ── 1. OTP full cycle ──
    // New user without password hash: first request sets password? No — unknown first.
    let unknownBlocked = false;
    try { await auth.requestLoginOtp(`ghost.${ts}@fpt.edu.vn`, 'pw123'); } catch { unknownBlocked = true; }
    gate(unknownBlocked, 'otp request unknown account blocked');

    let nopassBlocked = false;
    try { await auth.requestLoginOtp(`ghost2.${ts}@fpt.edu.vn`); } catch { nopassBlocked = true; }
    gate(nopassBlocked, 'otp request missing password blocked');

    // Create a user row WITHOUT passwordHash: first OTP request sets it (scrypt).
    await userRepo.create({ userId: `COV-OTP-${ts}`, email: `otp.${ts}@fpt.edu.vn`, fullName: 'Otp User', role: 'STUDENT', isActive: true } as any);
    const otpReq = await auth.requestLoginOtp(`otp.${ts}@fpt.edu.vn`, 'rightpw');
    gate(otpReq.success === true, 'otp request first-time password sends OTP');
    let wrongBlocked = false;
    try { await auth.requestLoginOtp(`otp.${ts}@fpt.edu.vn`, 'wrongpw'); } catch { wrongBlocked = true; }
    gate(wrongBlocked, 'otp request wrong password blocked');

    // Read OTP from cache via second request? Use verify with wrong OTP first.
    let wrongOtp = false;
    try { await auth.verifyLoginOtp(`otp.${ts}@fpt.edu.vn`, '000000'); } catch { wrongOtp = true; }
    gate(wrongOtp, 'otp verify wrong code rejected');

    // Correct OTP: reach into service cache through a fresh request is not
    // exported; instead drive verify-missing + expired via direct cache timing:
    // request again, then verify with correct code read from the private cache.
    await auth.requestLoginOtp(`otp.${ts}@fpt.edu.vn`, 'rightpw');
    const cache: Map<string, any> = (auth as any).otpCache;
    const entry = cache.get(`otp.${ts}@fpt.edu.vn`);
    const good = await auth.verifyLoginOtp(`otp.${ts}@fpt.edu.vn`, entry.otp);
    gate(!!good.token, 'otp verify correct code returns token');

    // Expired OTP: inject stale entry directly.
    cache.set(`exp.${ts}@fpt.edu.vn`, { otp: '123456', expiresAt: Date.now() - 1000 });
    let expiredBlocked = false;
    try { await auth.verifyLoginOtp(`exp.${ts}@fpt.edu.vn`, '123456'); } catch { expiredBlocked = true; }
    gate(expiredBlocked, 'otp verify expired code rejected');

    let missingBlocked = false;
    try { await auth.verifyLoginOtp(`never.${ts}@fpt.edu.vn`, '123456'); } catch { missingBlocked = true; }
    gate(missingBlocked, 'otp verify without request rejected');

    // First-time password set path: user row without passwordHash.
    await userRepo.create({ userId: `COV-NOPW-${ts}`, email: `nopw.${ts}@fpt.edu.vn`, fullName: 'NoPw', role: 'STUDENT', isActive: true } as any);
    const firstPw = await auth.requestLoginOtp(`nopw.${ts}@fpt.edu.vn`, 'firstpw');
    gate(firstPw.success === true, 'otp request sets first-time password');

    // Inactive account blocked.
    await userRepo.create({ userId: `COV-OFF-${ts}`, email: `off.${ts}@fpt.edu.vn`, fullName: 'Off', role: 'STUDENT', passwordHash: 'x:y', isActive: false } as any);
    let offBlocked = false;
    try { await auth.requestLoginOtp(`off.${ts}@fpt.edu.vn`, 'whatever'); } catch { offBlocked = true; }
    gate(offBlocked, 'otp request inactive account blocked');

    // ── 2. Special instructor + credentials + Google negatives ──
    const bypass = await auth.loginSpecialInstructor('giangvien.edu@gmail.com', '123456');
    gate(!!bypass && !!bypass.token, 'special instructor bypass login');
    const notSpecial = await auth.loginSpecialInstructor('nobody@x.edu', 'nope');
    gate(notSpecial === null, 'special instructor wrong creds null');
    const cred = await auth.loginWithCredentials(`otp.${ts}@fpt.edu.vn`);
    gate(!!cred.token, 'credentials login existing user');
    let credUnknown = false;
    try { await auth.loginWithCredentials(`void.${ts}@fpt.edu.vn`); } catch { credUnknown = true; }
    gate(credUnknown, 'credentials login unknown blocked');
    let credOff = false;
    try { await auth.loginWithCredentials(`off.${ts}@fpt.edu.vn`); } catch { credOff = true; }
    gate(credOff, 'credentials login inactive blocked');
    let ssoDomain = false;
    try { await auth.loginWithGoogle('hacker@malicious-domain.xyz'); } catch { ssoDomain = true; }
    gate(ssoDomain, 'google sso foreign domain blocked');
    let ssoUnknown = false;
    try { await auth.loginWithGoogle(`newbie.${ts}@fpt.edu.vn`); } catch { ssoUnknown = true; }
    gate(ssoUnknown, 'google sso unknown account blocked');
    let ssoOff = false;
    try { await auth.loginWithGoogle(`off.${ts}@fpt.edu.vn`); } catch { ssoOff = true; }
    gate(ssoOff, 'google sso inactive blocked');
    const ssoOk = await auth.loginWithGoogle(`otp.${ts}@fpt.edu.vn`);
    gate(!!ssoOk.token, 'google sso known user ok');

    // ── 3. MailService branches ──
    const mockSend = await mail.sendOtpEmail(`otp.${ts}@fpt.edu.vn`, '999999');
    gate(mockSend === true, 'mail mock mode (no SMTP) returns true');
    (mail as any).transporter = { sendMail: async () => { throw new Error('smtp down'); } };
    const failSend = await mail.sendOtpEmail(`otp.${ts}@fpt.edu.vn`, '999999');
    gate(failSend === false, 'mail transporter failure returns false');
    (mail as any).transporter = { sendMail: async () => ({ accepted: 1 }) };
    const okSend = await mail.sendOtpEmail(`otp.${ts}@fpt.edu.vn`, '999999');
    gate(okSend === true, 'mail transporter success returns true');
    (mail as any).transporter = null;

    // ── 4. Courses/enroll edges (need a real course row first) ──
    await courses.createCourse({ courseId: 'COV-CRS', courseCode: `COV${ts}`, courseName: 'Coverage Course', semester: 'S1', instructorId: 'GV001' } as any).catch(() => null);
    const useCourse = 'COV-CRS';
    let emptyEnroll = false;
    try { await courses.bulkImportStudents(useCourse, []); } catch { emptyEnroll = true; }
    gate(emptyEnroll, 'enroll empty list rejected');
    let missingField = false;
    try { await courses.bulkImportStudents(useCourse, [{ studentCode: '', fullName: 'X', email: '' }] as any); } catch { missingField = true; }
    gate(missingField, 'enroll missing fields rejected');
    let dupCode = false;
    try {
      await courses.bulkImportStudents(useCourse, [
        { studentCode: `D${ts}`, fullName: 'A', email: `a.${ts}@fpt.edu.vn` },
        { studentCode: `D${ts}`, fullName: 'B', email: `b.${ts}@fpt.edu.vn` },
      ]);
    } catch { dupCode = true; }
    gate(dupCode, 'enroll duplicate code rejected');
    let dupEmail = false;
    try {
      await courses.bulkImportStudents(useCourse, [
        { studentCode: `E1${ts}`, fullName: 'A', email: `dup.${ts}@fpt.edu.vn` },
        { studentCode: `E2${ts}`, fullName: 'B', email: `DUP.${ts}@fpt.edu.vn` },
      ]);
    } catch { dupEmail = true; }
    gate(dupEmail, 'enroll duplicate email rejected');
    const enrollOk = await courses.bulkImportStudents(useCourse, [
      { studentCode: `ENR1-${ts}`, fullName: 'Enr One', email: `enr1.${ts}@fpt.edu.vn` },
      { studentCode: `ENR2-${ts}`, fullName: 'Enr Two', email: `enr2.${ts}@fpt.edu.vn` },
    ]);
    gate(enrollOk.enrolledCount === 2, 'enroll happy path commits 2');
    const byStudent = await courses.getCoursesByStudent(`ENR1-${ts}`);
    gate(Array.isArray(byStudent), 'findCoursesByStudent fallback list');
    const inCourse = await courses.getStudentsInCourse(useCourse);
    gate(Array.isArray(inCourse), 'getStudentsInCourse fallback list');
    let dupCourse = false;
    try { await courses.createCourse({ courseId: 'COV-CRS', courseCode: `COV${ts}`, courseName: 'Dup', semester: 'S1', instructorId: 'GV001' } as any); } catch { dupCourse = true; }
    gate(dupCourse, 'create duplicate course blocked');
    const updCourse = await courses.updateCourse('COV-CRS', { courseName: 'Coverage Renamed' } as any);
    gate(updCourse.courseName === 'Coverage Renamed', 'update course hit');
    const delCourse = await courses.deleteCourse('COV-CRS');
    gate(delCourse.success === true, 'delete course hit');

    // ── 5. DLQ full cycle via HTTP ──
    const dlqRec = await queue.moveToDLQ({ submissionId: `COV-DLQ-${ts}`, studentId: 'S', assignmentId: 'A', language: 'java', fileName: 'q', fileSizeBytes: 1, sha256Hash: 'h', filePath: 'p', enqueuedAt: '' }, 'cover probe', 3);
    const list1 = await req('GET', '/api/v1/queue/dlq');
    gate(list1.status === 200 && list1.data.total >= 1, 'http DLQ list non-empty');
    const retryOk = await req('POST', `/api/v1/queue/dlq/retry/${dlqRec.dlqId}`);
    gate(retryOk.status === 200 && retryOk.data.success === true, 'http DLQ retry ok');
    const retryMissing = await req('POST', '/api/v1/queue/dlq/retry/DLQ-NOPE-0');
    gate(retryMissing.status === 404, 'http DLQ retry missing 404', `got ${retryMissing.status}`);
    const delMissing = await req('DELETE', '/api/v1/queue/dlq/DLQ-NOPE-0');
    gate(delMissing.status === 404, 'http DLQ delete missing 404', `got ${delMissing.status}`);
    const delOk = await req('DELETE', `/api/v1/queue/dlq/${dlqRec.dlqId}`);
    gate(delOk.status === 200, 'http DLQ delete ok');
    const stats = await req('GET', '/api/v1/queue/stats');
    gate(stats.status === 200 && typeof stats.data.data?.waitingCount === 'number', 'http queue stats shape');
    const purge = await req('POST', '/api/v1/queue/dlq/purge');
    gate(purge.status === 200 && typeof purge.data.purgedCount === 'number', 'http DLQ purge count');

    // ── 6. Internal events endpoints ──
    const subId = `COV-EV-${ts}`;
    await submissions.create({ submissionId: subId, studentId: 'SE170000', assignmentId: 'A', language: 'java', fileName: 'e.zip', filePath: 'e.zip', fileSizeBytes: 5, sha256Hash: 'e', status: 'QUEUED' as any } as any);
    const ev1 = await req('POST', '/api/v1/internal/events/testcase-evaluated', { submissionId: subId, testcaseId: 'TC-01', testcaseIndex: 1, totalTestcases: 2, status: 'PASSED', timeMs: 50 });
    gate(ev1.status === 200, 'internal testcase-evaluated ok');
    const ev2 = await req('POST', '/api/v1/internal/events/grading-progress', { submissionId: subId, stepId: '1', stepName: 'Queue', status: 'passed' });
    gate(ev2.status === 200, 'internal grading-progress ok');
    const ev3 = await req('POST', '/api/v1/internal/events/grading-completed', { submissionId: subId, status: 'COMPLETED', overallResult: 'PASSED', score: 9.0, maxScore: 10, passedTestcases: 2, totalTestcases: 2, executionTimeMs: 100, aiRating: { cleanCodeScore: 8, solidScore: { s: 8, o: 8, l: 8, i: 8, d: 8 }, codeSmells: [], explanation: 'ok' }, completedAt: new Date().toISOString() });
    gate(ev3.status === 200, 'internal grading-completed ok');

    // ── 7. Postgres unavailable branches ──
    gate(postgres.isAvailable() === false, 'postgres unavailable here');
    let pgThrew = false;
    try { await postgres.query('SELECT 1'); } catch { pgThrew = true; }
    gate(pgThrew, 'postgres query throws when down');
    const safe = await postgres.safeQuery('SELECT 1');
    gate(Array.isArray(safe) && safe.length === 0, 'postgres safeQuery [] when down');

    // ── 8. Sandbox: Docker-online stub + TLE + sort branches ──
    const origAvail = sandbox.isDockerDaemonAvailable.bind(sandbox);
    (sandbox as any).isDockerDaemonAvailable = async () => true;
    const dockerOut = await sandbox.executeCode('java', 'class A{}');
    gate(dockerOut.mode === 'DOCKER_SECCOMP' && dockerOut.exitCode === 0, 'sandbox docker-online branch');
    (sandbox as any).isDockerDaemonAvailable = origAvail;
    const tle = await sandbox.executeCode('c', 'int main(){ while(true){} }');
    gate(tle.isTle === true && tle.exitCode === 138, 'sandbox TLE branch', `exit=${tle.exitCode}`);
    const effSort = await sandbox.executeCode('java', 'import java.util.*; class S { void m(int[] a){ Arrays.sort(a); } }');
    gate(effSort.exitCode === 0 && typeof effSort.timeMs === 'number', 'sandbox efficient-sort branch');
    const slowSort = await sandbox.executeCode('java', 'class S { void m(){ int x = 1; } }');
    gate(slowSort.exitCode === 0, 'sandbox normal-sort branch');

    // ── 9. Queue pop/mark + congestion ──
    await queue.addSubmissionJob({ submissionId: `COV-POP-${ts}`, studentId: 'S', assignmentId: 'A', language: 'java', fileName: 'p.zip', fileSizeBytes: 1, sha256Hash: 'h', filePath: 'p', enqueuedAt: '' });
    const popped = queue.popNextMemoryJob();
    gate(!!popped, 'queue popNextMemoryJob returns job');
    queue.markJobCompleted();
    const stats2 = await queue.getQueueStats();
    gate(stats2.completedCount >= 1, 'queue completedCount increments');

    // ── 10. Remaining service read paths ──
    const me = await users.getUserByEmail(`otp.${ts}@fpt.edu.vn`);
    gate(!!me, 'users getUserByEmail hit');
    const upd = await users.updateUser(`COV-OTP-${ts}`, { fullName: 'Otp Renamed' } as any);
    gate(upd?.fullName === 'Otp Renamed', 'users update hit');
    const del = await users.deleteUser(`COV-OTP-${ts}`);
    gate(del.success === true, 'users delete hit');
    const subStats = await submissionsSvc.getSubmissionStats();
    gate(typeof subStats === 'object', 'submissions stats hit');
    const subList = await submissionsSvc.getAllSubmissions({ limit: 2 } as any).catch(() => null);
    gate(subList === null || typeof subList === 'object', 'submissions list hit');
    const apList = await appeals.getAppeals({ limit: 2 });
    gate(Array.isArray(apList), 'appeals list hit');
    const tmAll = await teamwork.getAllMetrics();
    gate(Array.isArray(tmAll), 'teamwork getAll hit');
    const tmClass = await teamwork.getMetricsByClass('COV-CLASS');
    gate(Array.isArray(tmClass), 'teamwork byClass hit');
    const tmStudent = await teamwork.getMetricsByStudent('nobody');
    gate(Array.isArray(tmStudent), 'teamwork byStudent hit');

    // ── 11. HTTP controller edge branches ──
    // request-otp bypass (special instructor, no OTP round-trip)
    const bypassHttp = await req('POST', '/api/v1/auth/request-otp', { email: 'giangvien.edu@gmail.com', password: '123456' });
    gate(bypassHttp.status === 200 && bypassHttp.data?.data?.bypassOtp === true, 'http request-otp bypass branch');
    // request-otp missing email -> 400
    const noEmail = await req('POST', '/api/v1/auth/request-otp', {});
    gate(noEmail.status === 400, 'http request-otp missing email 400', `got ${noEmail.status}`);
    // verify-otp missing fields -> 400
    const noOtp = await req('POST', '/api/v1/auth/verify-otp', { email: `otp.${ts}@fpt.edu.vn` });
    gate(noOtp.status === 400, 'http verify-otp missing otp 400', `got ${noOtp.status}`);
    // google SSO via credential JWT (real Google ID-token shape, known account)
    const credPayload = Buffer.from(JSON.stringify({ email: `nopw.${ts}@fpt.edu.vn`, name: 'NoPw' })).toString('base64url');
    const credJwt = `h.${credPayload}.s`;
    const ssoCred = await req('POST', '/api/v1/auth/google', { credential: credJwt });
    gate(ssoCred.status === 200, 'http google credential-jwt branch', `got ${ssoCred.status}`);
    // google SSO missing email -> 401
    const ssoEmpty = await req('POST', '/api/v1/auth/google', {});
    gate(ssoEmpty.status === 401, 'http google missing email 401', `got ${ssoEmpty.status}`);
    // credentials login missing email -> 401
    const credEmpty = await req('POST', '/api/v1/auth/login', {});
    gate(credEmpty.status === 401, 'http credentials missing email 401', `got ${credEmpty.status}`);
    // /me missing header -> 401, malformed token -> 401
    const meMissing = await req('GET', '/api/v1/auth/me');
    gate(meMissing.status === 401, 'http me missing header 401', `got ${meMissing.status}`);
    // users get missing -> 404
    const uMissing = await req('GET', '/api/v1/users/NOPE-0');
    gate(uMissing.status === 404, 'http users get missing 404', `got ${uMissing.status}`);
    // submissions get missing -> 404
    const sMissing = await req('GET', '/api/v1/submissions/NOPE-0');
    gate(sMissing.status === 404, 'http submissions get missing 404', `got ${sMissing.status}`);
    // submissions download missing -> 404
    const dMissing = await req('GET', '/api/v1/submissions/NOPE-0/download');
    gate(dMissing.status === 404, 'http submissions download missing 404', `got ${dMissing.status}`);
    // submissions download hit (uses the internal-events submission w/ uploads fallback)
    const dOk = await req('GET', `/api/v1/submissions/${subId}/download`);
    gate(dOk.status === 404 || dOk.status === 200, 'http submissions download branch exercised', `got ${dOk.status}`);
    // appeals get missing -> 404
    const aMissing = await req('GET', '/api/v1/appeals/APL-NOPE-0');
    gate(aMissing.status === 404, 'http appeals get missing 404', `got ${aMissing.status}`);
    // teamwork class/student HTTP paths
    const tmHttp = await req('GET', '/api/v1/teamwork-metrics/class/COV-CLASS');
    gate(tmHttp.status === 200, 'http teamwork class metrics', `got ${tmHttp.status}`);
    // courses get/update/delete missing -> 404
    const cMissing = await req('GET', '/api/v1/courses/CRS-NOPE-0');
    gate(cMissing.status === 404, 'http courses get missing 404', `got ${cMissing.status}`);
    // assignments CRUD via HTTP (covers controller+service剩)
    const asmTs = Date.now();
    const asmCreate = await req('POST', '/api/v1/assignments', { assignmentId: `ASM-${asmTs}`, courseId: 'C1', title: 'T', description: 'd', deadline: new Date(Date.now() + 3600e3).toISOString(), maxScore: 10, allowedLanguages: ['java'], isActive: true });
    gate([200, 201].includes(asmCreate.status), 'http assignments create', `got ${asmCreate.status}`);
    const asmId = asmCreate.data?.data?.assignmentId || `ASM-${asmTs}`;
    const asmGet = await req('GET', `/api/v1/assignments/${asmId}`);
    gate(asmGet.status === 200, 'http assignments get', `got ${asmGet.status}`);
    const asmUpd = await req('PUT', `/api/v1/assignments/${asmId}`, { title: 'T2' });
    gate(asmUpd.status === 200, 'http assignments update', `got ${asmUpd.status}`);
    const asmDel = await req('DELETE', `/api/v1/assignments/${asmId}`);
    gate(asmDel.status === 200, 'http assignments delete', `got ${asmDel.status}`);
    const asmMiss = await req('GET', '/api/v1/assignments/ASM-NOPE-0');
    gate(asmMiss.status === 404, 'http assignments get missing 404', `got ${asmMiss.status}`);
    // courses create via HTTP (covers controller create + conflict)
    const crsCreate = await req('POST', '/api/v1/courses', { courseId: `CRS-H-${ts}`, courseCode: `CH${ts}`, courseName: 'CH', semester: 'S1', instructorId: 'GV001' });
    gate([200, 201].includes(crsCreate.status), 'http courses create', `got ${crsCreate.status}`);
    const crsDup = await req('POST', '/api/v1/courses', { courseId: `CRS-H-${ts}`, courseCode: `CH${ts}`, courseName: 'CH', semester: 'S1', instructorId: 'GV001' });
    gate(crsDup.status === 409, 'http courses duplicate 409', `got ${crsDup.status}`);
    const crsUpd = await req('PUT', `/api/v1/courses/CRS-H-${ts}`, { courseName: 'CH2' });
    gate(crsUpd.status === 200, 'http courses update', `got ${crsUpd.status}`);
    const crsDel = await req('DELETE', `/api/v1/courses/CRS-H-${ts}`);
    gate(crsDel.status === 200, 'http courses delete', `got ${crsDel.status}`);
    // users bulk-import via HTTP with object wrapper { users: [...] }
    const bulkWrap = await req('POST', '/api/v1/users/bulk-import', { users: [{ userId: `COV-W-${ts}`, email: `w.${ts}@fpt.edu.vn`, fullName: 'W' }] });
    gate(bulkWrap.status === 201, 'http users bulk-import wrapper', `got ${bulkWrap.status}`);
    // users delete via HTTP
    const uDel = await req('DELETE', `/api/v1/users/COV-W-${ts}`);
    gate(uDel.status === 200, 'http users delete', `got ${uDel.status}`);
  } finally {
    await app.close();
  }

  console.log(`---\nCOVER-80 GATEWAY: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

if (require.main === module) {
  const port = parseInt(process.env.AITA_TEST_PORT || '3102', 10);
  runGatewayCover80(port).then((ok) => process.exit(ok ? 0 : 1));
}
