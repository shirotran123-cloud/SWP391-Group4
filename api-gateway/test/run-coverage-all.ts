/** Single-process entry running every gateway suite for one c8 report. */
import * as fs from 'fs';
import * as path from 'path';

const STORE_FILES = [
  'users_store.json', 'courses_store.json', 'assignments_store.json',
  'appeals_store.json', 'submissions_store.json', 'teamwork_store.json',
  'dlq_store.json',
];

function snapshotStores(): Map<string, Buffer | null> {
  const snap = new Map<string, Buffer | null>();
  const dir = path.resolve(process.cwd(), 'data');
  for (const f of STORE_FILES) {
    const p = path.join(dir, f);
    snap.set(f, fs.existsSync(p) ? fs.readFileSync(p) : null);
  }
  return snap;
}

function restoreStores(snap: Map<string, Buffer | null>): void {
  const dir = path.resolve(process.cwd(), 'data');
  for (const f of STORE_FILES) {
    const p = path.join(dir, f);
    const buf = snap.get(f);
    if (buf === null || buf === undefined) {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } else {
      fs.writeFileSync(p, buf);
    }
  }
}

async function main(): Promise<void> {
  const snap = snapshotStores();
  let code = 0;
  try {
    // In-process drivers first (no ports needed beyond their own).
    const { runCoverGates } = require("./cover-gates");
    if (!(await runCoverGates())) code = 1;
    const { runDemoRealSuite } = require("./demo-real.test");
    if (!(await runDemoRealSuite())) code = 1;
    // HTTP suites each boot on their own port; stagger to avoid clashes.
    process.env.AITA_TEST_PORT = process.env.AITA_TEST_PORT || "3111";
    const { runGatewayCover80 } = require("./cover-80-gateway");
    if (!(await runGatewayCover80(parseInt(process.env.AITA_TEST_PORT, 10)))) code = 1;
    process.env.AITA_TEST_PORT = "3112";
    const { runGoalGates } = require("./verify-goal-gates");
    if (!(await runGoalGates())) code = 1;
    process.env.AITA_TEST_PORT = "3113";
    const { runHttpSuite } = require("./verify-gateway");
    if (!(await runHttpSuite())) code = 1;
    process.env.AITA_TEST_PORT = "3126";
    const { runTestCasesSuite } = require("./test-cases.test");
    if (!(await runTestCasesSuite())) code = 1;
  } finally {
    // Suites write COV/GATE/TEST rows into cwd data stores; restore seeds.
    restoreStores(snap);
  }
  if (code !== 0) process.exit(1);
  console.log("COVERAGE-ALL: all gateway suites green");
}

main().catch((err) => { console.error(err); process.exit(1); });
