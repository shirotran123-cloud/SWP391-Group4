/**
 * Regression suite — Workflow 2 Step 6 REAL AST/Winnowing plagiarism detection.
 *
 * Fully offline: no Docker, no Redis, no PostgreSQL, no network, no GenAI Hub.
 * The hub call inside PlagiarismService fails fast (ECONNREFUSED) and the LOCAL_AST_ENGINE
 * mirror is exercised instead — which is exactly the offline path we must guarantee.
 *
 * Run: npx ts-node --transpile-only test/plagiarism-ast.test.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as AdmZip from 'adm-zip';
import {
  ASTNormalizer,
  ASTPlagiarismEngine,
  WinnowingEngine,
} from '../src/plagiarism/ast-plagiarism.engine';
import { PlagiarismRepository } from '../src/database/plagiarism.repository';
import { PlagiarismService } from '../src/plagiarism/plagiarism.service';
import { PostgresService } from '../src/database/postgres.service';
import { SubmissionRepository } from '../src/database/submission.repository';
import { UserRepository } from '../src/database/user.repository';
import { SUBMISSION_STATUS } from '../src/common/constants/queue.constants';
import { PlagiarismController } from '../src/plagiarism/plagiarism.controller';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

let passed = 0;
let failed = 0;
function check(ok: boolean, name: string, details?: string): void {
  if (ok) { passed++; console.log(`[PASS] ${name}`); }
  else { failed++; console.error(`[FAIL] ${name}${details ? ` -> ${details}` : ''}`); }
}

// ── Sample 1: canonical Python sorting module (compilable) ──────────────────────
const ORIGINAL_SORT = `# Sorting helpers used by the grading analytics report
def bubble_sort(values):
    n = len(values)
    for i in range(n - 1):
        for j in range(n - 1 - i):
            if values[j] > values[j + 1]:
                temp = values[j]
                values[j] = values[j + 1]
                values[j + 1] = temp
    return values


def find_minimum(values):
    smallest = values[0]
    index = 1
    while index < len(values):
        if values[index] < smallest:
            smallest = values[index]
        index = index + 1
    return smallest


def compute_average(values):
    total = 0
    count = 0
    for number in values:
        total = total + number
        count = count + 1
    if count == 0:
        return 0
    return total / count
`;

// ── Sample 2: SAME algorithm, genuinely obfuscated ──────────────────────────────
// every identifier renamed, both loops rewritten as while, comments rewritten,
// functions reordered, literals/expressions restructured where structure allows.
const OBFUSCATED_SORT = `"""Utility helpers (rewritten)"""
def g7(zz):
    t = 0
    s = 0
    while t < len(zz):
        s = s + zz[t]
        t = t + 1
    if s == 0:
        return 0
    return s / len(zz)


def q3(w):
    m = w[0]
    k = 1
    while k < len(w):
        if w[k] < m:
            m = w[k]
        k = k + 1
    return m


def h9(arr):
    ln = len(arr)
    p = 0
    while p < ln - 1:
        q = 0
        while q < ln - 1 - p:
            if arr[q] > arr[q + 1]:
                sw = arr[q]
                arr[q] = arr[q + 1]
                arr[q + 1] = sw
            q = q + 1
        p = p + 1
    return arr
`;

// ── Sample 3: unrelated module — localisation catalogue, no computation at all ──
// NOTE on the 40% bar: the AST structural cosine between two non-trivial Python files is
// inherently high (~90%) because both are dominated by the same token *vocabulary*
// (VAR_DECL/ASSIGN_OP/CALL_EXPR). Winnowing containment is what actually discriminates, so an
// unrelated module with a different literal/identifier profile lands well under 40%.
const UNRELATED_CATALOG = `"""Localisation string catalogue and lookup helpers for the AITA portal.

This module performs no computation: it only stores constants and resolves them.
"""
LOCALES = ["vi", "en", "jp"]
FALLBACK = "en"

CATALOG = {
    "vi": {
        "app.title": "He thong cham bai tu dong AITA",
        "app.subtitle": "Nen tang danh gia bai nop theo chuan RBL",
        "nav.dashboard": "Bang dieu khien",
        "nav.courses": "Khoa hoc",
        "nav.submissions": "Bai nop",
        "nav.appeals": "Phuc khao",
        "nav.plagiarism": "Dao van",
        "btn.submit": "Nop bai",
        "btn.cancel": "Huy",
        "btn.export": "Xuat bao cao",
        "msg.loading": "Dang tai du lieu...",
        "msg.empty": "Chua co du lieu",
        "msg.error": "Da xay ra loi",
        "unit.seconds": "giay",
        "unit.points": "diem",
    },
    "en": {
        "app.title": "AITA Automated Grading Platform",
        "app.subtitle": "RBL-aligned submission evaluation",
        "nav.dashboard": "Dashboard",
        "nav.courses": "Courses",
        "nav.submissions": "Submissions",
        "nav.appeals": "Appeals",
        "nav.plagiarism": "Plagiarism",
        "btn.submit": "Submit",
        "btn.cancel": "Cancel",
        "btn.export": "Export report",
        "msg.loading": "Loading data...",
        "msg.empty": "No data available",
        "msg.error": "An error occurred",
        "unit.seconds": "seconds",
        "unit.points": "points",
    },
    "jp": {
        "app.title": "AITA 自動採点プラットフォーム",
        "app.subtitle": "RBL 準拠の提出物評価",
        "nav.dashboard": "ダッシュボード",
        "nav.courses": "コース",
        "nav.submissions": "提出物",
        "nav.appeals": "異議申し立て",
        "nav.plagiarism": "盗用",
        "btn.submit": "提出",
        "btn.cancel": "キャンセル",
        "btn.export": "レポート出力",
        "msg.loading": "読み込み中...",
        "msg.empty": "データがありません",
        "msg.error": "エラーが発生しました",
        "unit.seconds": "秒",
        "unit.points": "点",
    },
}


def supported_locales():
    return LOCALES


def normalise_locale(locale):
    return locale if locale in LOCALES else FALLBACK


def translate(locale, key):
    bundle = CATALOG.get(normalise_locale(locale), {})
    return bundle.get(key, key)


def translate_many(locale, keys):
    return {key: translate(locale, key) for key in keys}


def missing_keys(locale):
    reference = set(CATALOG[FALLBACK].keys())
    current = set(CATALOG.get(normalise_locale(locale), {}).keys())
    return sorted(reference - current)
`;

// ── Sample 4: unrelated recursive data structure — must not be FLAGGED (>=70%) ──
const UNRELATED_RECURSIVE_LIST = `class ListNode:
    def __init__(self, data, tail=None):
        self.data = data
        self.tail = tail


class Chain:
    def __init__(self):
        self.root = None

    def size(self, node=None):
        if node is None:
            node = self.root
        if node is None:
            return 0
        return 1 + self.size(node.tail)

    def contains(self, wanted, node=None):
        if node is None:
            node = self.root
        if node is None:
            return False
        if node.data == wanted:
            return True
        return self.contains(wanted, node.tail)


def build_chain(items):
    if not items:
        return None
    return ListNode(items[0], build_chain(items[1:]))


def reverse_chain(node):
    if node is None or node.tail is None:
        return node
    rest = reverse_chain(node.tail)
    node.tail.tail = node
    node.tail = None
    return rest
`;

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'aita-plagiarism-'));
}

function writeZipFor(dir: string, fileName: string, innerName: string, code: string): string {
  const zipPath = path.join(dir, fileName);
  const zip = new AdmZip();
  zip.addFile(innerName, Buffer.from(code, 'utf-8'));
  zip.writeZip(zipPath);
  return zipPath;
}

async function main(): Promise<boolean> {
  const tmpDir = makeTmpDir();
  const suiteTs = Date.now();
  const createdSubmissionIds: string[] = [];

  // The repository hard-codes process.cwd()/data, so snapshot the store and restore it after
  // the run: this suite must leave the developer's JSON store exactly as it found it.
  const storePath = path.resolve(process.cwd(), 'data', 'plagiarism_store.json');
  const storeExisted = fs.existsSync(storePath);
  const storeBackup = storeExisted ? fs.readFileSync(storePath, 'utf-8') : null;

  const postgres = new PostgresService();
  const plagiarismRepo = new PlagiarismRepository(postgres);
  const submissionRepo = new SubmissionRepository(postgres);
  const userRepo = new UserRepository(postgres);
  const service = new PlagiarismService(plagiarismRepo, submissionRepo, userRepo);

  try {
    // ── 12. Module wiring: PlagiarismModule + global DatabaseModule resolves ───
    let wiringOk = false;
    try {
      wiringOk = await verifyModuleWiring();
    } catch (err: any) {
      console.error(`[FAIL] module wiring threw: ${err.message}`);
      wiringOk = false;
    }
    check(wiringOk, 'PlagiarismModule + DatabaseModule resolve PlagiarismService/Repository/Controller');

    // ── 1. Identical code -> ~100% and flagged ─────────────────────────────────
    const identical = ASTPlagiarismEngine.compareSubmissions(
      { submissionId: 'A', sourceCode: ORIGINAL_SORT, language: 'python' },
      { submissionId: 'B', sourceCode: ORIGINAL_SORT, language: 'python' },
    );
    check(identical.similarityRate >= 99.0, 'identical code similar >= 99%', `${identical.similarityRate}%`);
    check(identical.isFlagged === true && identical.status === 'FLAGGED_PLAGIARISM', 'identical code flagged', identical.status);
    check(identical.matchedTokensJson.winnowingContainment >= 99.0, 'identical containment 100%', `${identical.matchedTokensJson.winnowingContainment}%`);
    check(identical.matchedTokensJson.matchedSegments.length > 0, 'identical matched segments exported', `${identical.matchedTokensJson.matchedSegments.length}`);

    // ── 2. GenAI-obfuscated code -> still >= 70% and flagged ────────────────────
    const obfuscated = ASTPlagiarismEngine.compareSubmissions(
      { submissionId: 'A', sourceCode: ORIGINAL_SORT, language: 'python' },
      { submissionId: 'B', sourceCode: OBFUSCATED_SORT, language: 'python' },
    );
    check(
      obfuscated.similarityRate >= 70.0,
      'obfuscated (renamed ids, for->while, reordered methods) similar >= 70%',
      `${obfuscated.similarityRate}% (jaccard=${obfuscated.matchedTokensJson.jaccardSimilarity}, containment=${obfuscated.matchedTokensJson.winnowingContainment}, ast=${obfuscated.matchedTokensJson.astStructuralSimilarity})`,
    );
    check(obfuscated.isFlagged === true, 'obfuscated code flagged as plagiarism', obfuscated.status);
    check(
      obfuscated.matchedTokensJson.astStructuralSimilarity >= 80.0,
      'obfuscated AST structural cosine >= 80%',
      `${obfuscated.matchedTokensJson.astStructuralSimilarity}%`,
    );

    // ── 3. Unrelated code -> < 40% and NOT flagged ─────────────────────────────
    const unrelated = ASTPlagiarismEngine.compareSubmissions(
      { submissionId: 'A', sourceCode: UNRELATED_CATALOG, language: 'python' },
      { submissionId: 'B', sourceCode: ORIGINAL_SORT, language: 'python' },
    );
    check(
      unrelated.similarityRate < 40.0,
      'unrelated localisation catalog vs sort < 40%',
      `${unrelated.similarityRate}% (jaccard=${unrelated.matchedTokensJson.jaccardSimilarity}, containment=${unrelated.matchedTokensJson.winnowingContainment}, ast=${unrelated.matchedTokensJson.astStructuralSimilarity})`,
    );
    check(unrelated.isFlagged === false && unrelated.status === 'CLEAN', 'unrelated code NOT flagged', `${unrelated.status} ${unrelated.similarityRate}%`);

    // A different recursive data structure shares Python control-flow vocabulary with a sort,
    // so it may score in the SUSPECTED band — it must still stay below the 70% flag threshold.
    const unrelatedRecursive = ASTPlagiarismEngine.compareSubmissions(
      { submissionId: 'A', sourceCode: UNRELATED_RECURSIVE_LIST, language: 'python' },
      { submissionId: 'B', sourceCode: ORIGINAL_SORT, language: 'python' },
    );
    check(
      unrelatedRecursive.isFlagged === false && unrelatedRecursive.similarityRate < 70.0,
      'unrelated recursive linked-list stays below the 70% flag threshold',
      `${unrelatedRecursive.status} ${unrelatedRecursive.similarityRate}%`,
    );

    // ── 4. Empty / short input does not crash and is not flagged ───────────────
    const emptyVsEmpty = ASTPlagiarismEngine.compareSubmissions(
      { submissionId: 'A', sourceCode: '', language: 'python' },
      { submissionId: 'B', sourceCode: '', language: 'python' },
    );
    check(emptyVsEmpty.isFlagged === false, 'empty vs empty not flagged', `${emptyVsEmpty.similarityRate}%`);

    const shortVsSort = ASTPlagiarismEngine.compareSubmissions(
      { submissionId: 'A', sourceCode: 'x = 1', language: 'python' },
      { submissionId: 'B', sourceCode: ORIGINAL_SORT, language: 'python' },
    );
    check(shortVsSort.isFlagged === false, 'short snippet vs sort not flagged', `${shortVsSort.similarityRate}%`);

    const nullishCode = ASTPlagiarismEngine.compareSubmissions(
      { submissionId: 'A', sourceCode: null as any, language: 'python' },
      { submissionId: 'B', sourceCode: undefined as any, language: 'python' },
    );
    check(typeof nullishCode.similarityRate === 'number' && !Number.isNaN(nullishCode.similarityRate), 'null source does not crash', `${nullishCode.similarityRate}`);
    check(ASTNormalizer.normalize('', 'python').tokens.length === 0, 'empty code normalizes to zero tokens');
    check(WinnowingEngine.computeFingerprints([]).length === 0, 'zero tokens -> zero fingerprints');

    const matrixEmpty = ASTPlagiarismEngine.computeClassSimilarityMatrix([], 'ASM-EMPTY');
    check(matrixEmpty.totalPairsCompared === 0 && matrixEmpty.similarityMatrix.length === 0, 'empty class matrix does not crash');

    // ── 5. detectForSubmission with zero peers -> comparedCount 0, topMatch null ─
    const soloId = `SUB-PLG-SOLO-${suiteTs}`;
    await submissionRepo.create({
      submissionId: soloId,
      studentId: `SE-SOLO-${suiteTs}`,
      assignmentId: `ASM-PLG-SOLO-${suiteTs}`,
      language: 'python',
      fileName: 'solo.zip',
      fileSizeBytes: ORIGINAL_SORT.length,
      sha256Hash: `hash-solo-${suiteTs}`,
      filePath: path.join(tmpDir, 'solo.zip'),
      status: SUBMISSION_STATUS.QUEUED,
    });
    createdSubmissionIds.push(soloId);

    const soloResult = await service.detectForSubmission({
      submissionId: soloId,
      studentId: `SE-SOLO-${suiteTs}`,
      assignmentId: `ASM-PLG-SOLO-${suiteTs}`,
      language: 'python',
      sourceCode: ORIGINAL_SORT,
    });
    check(soloResult.comparedCount === 0, 'zero peers -> comparedCount 0', `${soloResult.comparedCount}`);
    check(soloResult.topMatch === null, 'zero peers -> topMatch null', JSON.stringify(soloResult.topMatch));
    check(soloResult.reportsPersisted === 0, 'zero peers -> no reports persisted', `${soloResult.reportsPersisted}`);
    check(soloResult.fingerprintsStored > 0, 'zero peers -> fingerprints still stored', `${soloResult.fingerprintsStored}`);

    // ── 6. Fingerprint persistence round-trip ──────────────────────────────────
    const roundTripId = `SUB-PLG-FP-${suiteTs}`;
    const normalized = ASTNormalizer.normalize(ORIGINAL_SORT, 'python');
    const fingerprints = WinnowingEngine.computeFingerprints(normalized.tokens);
    const storedCount = await plagiarismRepo.saveFingerprints(roundTripId, fingerprints, 'main.py');
    const readBack = await plagiarismRepo.findFingerprintsBySubmission(roundTripId);
    const savedHashes = new Set(fingerprints.map((f) => f.hashValue));
    const readHashes = new Set(readBack.map((r) => r.hashValue));

    check(storedCount === fingerprints.length, 'saveFingerprints returns stored count', `${storedCount}/${fingerprints.length}`);
    check(readBack.length === fingerprints.length, 'fingerprint read-back count matches', `${readBack.length}/${fingerprints.length}`);
    check(savedHashes.size === readHashes.size, 'fingerprint hash set size round-trips', `${savedHashes.size}/${readHashes.size}`);
    check(
      Array.from(savedHashes).every((h) => readHashes.has(h)),
      'every saved fingerprint hash is readable',
    );
    check(readBack.every((r) => r.submissionId === roundTripId && r.filePath === 'main.py'), 'fingerprint metadata persisted');

    // Idempotency: a second save replaces, never duplicates.
    const storedAgain = await plagiarismRepo.saveFingerprints(roundTripId, fingerprints, 'main.py');
    const readAgain = await plagiarismRepo.findFingerprintsBySubmission(roundTripId);
    check(storedAgain === storedCount && readAgain.length === readBack.length, 'saveFingerprints is idempotent', `${readAgain.length}`);

    // ── 7. detectForSubmission with a real peer zip (offline hub fallback) ──────
    const asmId = `ASM-PLG-E2E-${suiteTs}`;
    const curId = `SUB-PLG-CUR-${suiteTs}`;
    const peerId = `SUB-PLG-PEER-${suiteTs}`;
    const curZip = writeZipFor(tmpDir, 'cur.zip', 'sorter.py', ORIGINAL_SORT);
    const peerZip = writeZipFor(tmpDir, 'peer.zip', 'renamed/sorter.py', OBFUSCATED_SORT);

    await submissionRepo.create({
      submissionId: curId,
      studentId: `SE-CUR-${suiteTs}`,
      assignmentId: asmId,
      language: 'python',
      fileName: 'cur.zip',
      fileSizeBytes: ORIGINAL_SORT.length,
      sha256Hash: `hash-cur-${suiteTs}`,
      filePath: curZip,
      status: SUBMISSION_STATUS.COMPLETED,
    });
    await submissionRepo.create({
      submissionId: peerId,
      studentId: `SE-PEER-${suiteTs}`,
      assignmentId: asmId,
      language: 'python',
      fileName: 'peer.zip',
      fileSizeBytes: OBFUSCATED_SORT.length,
      sha256Hash: `hash-peer-${suiteTs}`,
      filePath: peerZip,
      status: SUBMISSION_STATUS.COMPLETED,
    });
    createdSubmissionIds.push(curId, peerId);

    const e2e = await service.detectForSubmission({
      submissionId: curId,
      studentId: `SE-CUR-${suiteTs}`,
      assignmentId: asmId,
      language: 'python',
      sourceCode: ORIGINAL_SORT,
    });

    check(e2e.comparedCount === 1, 'one peer -> comparedCount 1', `${e2e.comparedCount}`);
    check(!!e2e.topMatch, 'one peer -> topMatch present');
    check(e2e.reportsPersisted === 1, 'one peer -> one report persisted', `${e2e.reportsPersisted}`);
    check(e2e.engine === 'GENAI_HUB_HTTP' || e2e.engine === 'LOCAL_AST_ENGINE', 'engine reported', e2e.engine);
    check(e2e.topMatch?.matchedStudentId === `SE-PEER-${suiteTs}`, 'topMatch matchedStudentId mapped', `${e2e.topMatch?.matchedStudentId}`);
    check(
      e2e.topMatch?.sourceCodeA === ORIGINAL_SORT && e2e.topMatch?.sourceCodeB === OBFUSCATED_SORT,
      'topMatch sourceCodeA/B oriented current-vs-peer',
    );
    check(Array.isArray(e2e.topMatch?.matchedTokens) && e2e.topMatch!.matchedTokens.length > 0, 'topMatch matchedTokens mapped');
    check(
      !!e2e.topMatch!.matchedTokens[0].lineA && e2e.topMatch!.matchedTokens[0].lineA.length === 2,
      'matchedTokens lineA is a [start,end] tuple',
    );
    check(e2e.topMatch?.similarityRate >= 70 && e2e.topMatch?.isFlagged === true, 'peer obfuscated code flagged via service', `${e2e.topMatch?.similarityRate}%`);
    check(typeof e2e.fingerprintsStored === 'number' && e2e.fingerprintsStored > 0, 'service stored fingerprints', `${e2e.fingerprintsStored}`);

    // Report is queryable + honours the canonical pair ordering.
    const reports = await service.getReports({ assignmentId: asmId, flaggedOnly: true }) as any[];
    check(reports.length === 1, 'one flagged report retrievable by assignment', `${reports.length}`);
    check(!!reports[0] && reports[0].submissionAId <= reports[0].submissionBId, 'report stored with canonical A<B ordering', `${reports[0]?.submissionAId} / ${reports[0]?.submissionBId}`);
    const bySubmission = await plagiarismRepo.findReportsBySubmission(curId);
    check(bySubmission.length === 1, 'report reachable from either side of the pair', `${bySubmission.length}`);

    // Re-analysis must not duplicate the report (upsert on the pairwise unique key).
    const e2eAgain = await service.detectForSubmission({
      submissionId: curId,
      studentId: `SE-CUR-${suiteTs}`,
      assignmentId: asmId,
      language: 'python',
      sourceCode: ORIGINAL_SORT,
    });
    const reportsAgain = await service.getReports({ assignmentId: asmId }) as any[];
    check(reportsAgain.length === 1, 're-analysis upserts (no duplicate pair rows)', `${reportsAgain.length}`);
    check(e2eAgain.reportsPersisted === 1, 're-analysis reports persisted', `${e2eAgain.reportsPersisted}`);

    // ── 8. Missing / corrupt peer zip is skipped, never thrown ─────────────────
    const brokenId = `SUB-PLG-BROKEN-${suiteTs}`;
    const brokenZip = path.join(tmpDir, 'broken.zip');
    fs.writeFileSync(brokenZip, Buffer.from('this is not a zip archive'));
    await submissionRepo.create({
      submissionId: brokenId,
      studentId: `SE-BROKEN-${suiteTs}`,
      assignmentId: asmId,
      language: 'python',
      fileName: 'broken.zip',
      fileSizeBytes: 25,
      sha256Hash: `hash-broken-${suiteTs}`,
      filePath: brokenZip,
      status: SUBMISSION_STATUS.COMPLETED,
    });
    createdSubmissionIds.push(brokenId);

    const missingId = `SUB-PLG-MISSING-${suiteTs}`;
    await submissionRepo.create({
      submissionId: missingId,
      studentId: `SE-MISSING-${suiteTs}`,
      assignmentId: asmId,
      language: 'python',
      fileName: 'missing.zip',
      fileSizeBytes: 0,
      sha256Hash: `hash-missing-${suiteTs}`,
      filePath: path.join(tmpDir, 'does-not-exist.zip'),
      status: SUBMISSION_STATUS.COMPLETED,
    });
    createdSubmissionIds.push(missingId);

    let corruptThrew = false;
    let corruptResult: any = null;
    try {
      corruptResult = await service.detectForSubmission({
        submissionId: brokenId,
        studentId: `SE-BROKEN-${suiteTs}`,
        assignmentId: asmId,
        language: 'python',
        sourceCode: ORIGINAL_SORT,
      });
    } catch {
      corruptThrew = true;
    }
    check(!corruptThrew, 'corrupt/missing peer zips do not throw');
    check(corruptResult && corruptResult.comparedCount === 2, 'corrupt + missing zips skipped, valid peer still compared', `${corruptResult?.comparedCount}`);

    // ── 9. Assignment matrix path (BR-04 gated at the controller layer) ────────
    // The assignment currently holds 4 submissions: 2 with readable zips + 1 corrupt zip +
    // 1 missing file. Only the 2 readable ones may enter the matrix (1 pair).
    const matrix = await service.getAssignmentMatrix(asmId);
    check(matrix.totalSubmissions === 2, 'matrix counts only unzippable submissions', `${matrix.totalSubmissions}`);
    check(matrix.totalPairsCompared === 1, 'matrix compares only readable submissions', `${matrix.totalPairsCompared}`);
    check(matrix.similarityMatrix.length === matrix.totalSubmissions, 'matrix is square', `${matrix.similarityMatrix.length}`);
    check(matrix.similarityMatrix.every((row) => row.length === matrix.totalSubmissions), 'matrix rows are N wide');
    check(matrix.flaggedPairsCount >= 1, 'matrix flags the obfuscated pair', `${matrix.flaggedPairsCount}`);
    check(!!matrix.engine, 'matrix reports engine', matrix.engine);

    // ── 10. Self-comparison + duplicate-peer guards ─────────────────────────────
    const dupId = `SUB-PLG-DUP-${suiteTs}`;
    await submissionRepo.create({
      submissionId: dupId,
      studentId: `SE-DUP-${suiteTs}`,
      assignmentId: asmId,
      language: 'python',
      fileName: 'dup.zip',
      fileSizeBytes: OBFUSCATED_SORT.length,
      sha256Hash: `hash-peer-${suiteTs}`, // byte-identical duplicate of the peer upload
      filePath: peerZip,
      status: SUBMISSION_STATUS.COMPLETED,
    });
    createdSubmissionIds.push(dupId);

    const guarded = await service.detectForSubmission({
      submissionId: curId,
      studentId: `SE-CUR-${suiteTs}`,
      assignmentId: asmId,
      language: 'python',
      sourceCode: ORIGINAL_SORT,
    });
    check(
      guarded.topMatch?.matchedStudentId !== `SE-CUR-${suiteTs}`,
      'never self-compares (topMatch is a real peer)',
      `${guarded.topMatch?.matchedStudentId}`,
    );
    check(
      guarded.comparedCount === e2e.comparedCount,
      'duplicate-hash peer deduplicated (comparedCount unchanged after duplicate upload)',
      `${guarded.comparedCount} vs ${e2e.comparedCount}`,
    );

    const dupResult = await service.detectForSubmission({
      submissionId: dupId,
      studentId: `SE-DUP-${suiteTs}`,
      assignmentId: asmId,
      language: 'python',
      sourceCode: OBFUSCATED_SORT,
    });
    check(dupResult.comparedCount === 2, 'corrupt + missing skipped for the duplicate submission too', `${dupResult.comparedCount}`);
    check(!!dupResult.topMatch && dupResult.topMatch.isFlagged === true, 'duplicate submission still flagged against the original', `${dupResult.topMatch?.similarityRate}%`);

    // ── 11. BR-04 guard: students never get the plagiarism report ──────────────
    const controller = new PlagiarismController(service, submissionRepo);
    let studentBlocked = false;
    try {
      await controller.analyzeSubmission(curId, { role: 'STUDENT' });
    } catch (err: any) {
      studentBlocked = err instanceof ForbiddenException;
      if (studentBlocked) {
        check(
          err.getResponse().message === 'Báo cáo đạo văn chỉ dành cho Giảng viên/HOD (BR-04).',
          'BR-04 rejection message is exact',
          JSON.stringify(err.getResponse()),
        );
      }
    }
    check(studentBlocked, 'BR-04: POST analyze with role=STUDENT -> 403 Forbidden');

    let matrixBlocked = false;
    try {
      await controller.getAssignmentMatrix(asmId, 'student');
    } catch (err: any) {
      matrixBlocked = err instanceof ForbiddenException;
    }
    check(matrixBlocked, 'BR-04: GET matrix with role=student -> 403 Forbidden');

    let reportsBlocked = false;
    try {
      await controller.getReports(asmId, 'true', 'STUDENT');
    } catch (err: any) {
      reportsBlocked = err instanceof ForbiddenException;
    }
    check(reportsBlocked, 'BR-04: GET reports with role=STUDENT -> 403 Forbidden');

    // Staff role passes the guard and reaches the service.
    let staffAllowed = false;
    try {
      await controller.analyzeSubmission(curId, { role: 'INSTRUCTOR' });
      staffAllowed = true;
    } catch {
      staffAllowed = false;
    }
    check(staffAllowed, 'BR-04: POST analyze with role=INSTRUCTOR is allowed');

    const fpResponse: any = await controller.getFingerprints(curId, 'INSTRUCTOR');
    check(
      fpResponse?.data?.submissionId === curId && fpResponse.data.count > 0,
      'fingerprints endpoint returns stored fingerprints + count',
      `${fpResponse?.data?.count}`,
    );
    check(
      Array.isArray(fpResponse?.data?.fingerprints) &&
        fpResponse.data.fingerprints.length === fpResponse.data.count,
      'fingerprints endpoint list length matches count',
    );

    // Unknown role is not treated as a student (guard only blocks the literal STUDENT role).
    let unknownRoleAllowed = false;
    try {
      await controller.analyzeSubmission(curId, { role: 'HOD' });
      unknownRoleAllowed = true;
    } catch {
      unknownRoleAllowed = false;
    }
    check(unknownRoleAllowed, 'BR-04: role=HOD is allowed');

    // Missing submission id must 404 rather than silently return an empty report.
    let missing404 = false;
    try {
      await controller.analyzeSubmission(`SUB-PLG-ABSENT-${suiteTs}`, { role: 'INSTRUCTOR' });
    } catch (err: any) {
      missing404 = err instanceof NotFoundException;
    }
    check(missing404, 'analyze on unknown submission -> 404 NotFound');
  } finally {
    for (const id of createdSubmissionIds) {
      await submissionRepo.delete(id).catch(() => undefined);
    }
    try {
      if (storeExisted) {
        fs.writeFileSync(storePath, storeBackup as string, 'utf-8');
      } else if (fs.existsSync(storePath)) {
        fs.rmSync(storePath, { force: true });
      }
    } catch {
      // best-effort store restore
    }
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // best-effort temp cleanup
    }
  }

  console.log(`---\nPLAGIARISM-AST: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

/**
 * Module-wiring check: proves `PlagiarismModule` resolves on top of the global `DatabaseModule`
 * exactly as the integrator will mount it, with real Nest DI (no @nestjs/testing dependency).
 */
async function verifyModuleWiring(): Promise<boolean> {
  const { NestFactory } = require('@nestjs/core');
  const { Module } = require('@nestjs/common');
  const { DatabaseModule } = require('../src/database/database.module');
  const { PlagiarismModule } = require('../src/plagiarism/plagiarism.module');

  class WiringProbeModule {}
  Module({ imports: [DatabaseModule, PlagiarismModule] })(WiringProbeModule);

  const app = await NestFactory.createApplicationContext(WiringProbeModule as any, { logger: false });
  try {
    return !!app.get(PlagiarismService) && !!app.get(PlagiarismRepository) && !!app.get(PlagiarismController);
  } finally {
    await app.close();
  }
}

export { main as runPlagiarismAstSuite };

if (require.main === module) {
  main()
    .then((ok) => { if (!ok) process.exit(1); })
    .catch((err) => { console.error('[FAIL] plagiarism-ast suite crashed:', err); process.exit(1); });
}
