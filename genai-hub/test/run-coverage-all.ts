/** Single-process entry running every genai-hub suite for one c8 report. */
async function main(): Promise<void> {
  let code = 0;
  const { runUnitTests } = require("./ast-engine.test");
  if (runUnitTests() !== true) code = 1;
  const { runASTBenchmark } = require("./run-ast-benchmark");
  try { runASTBenchmark(); } catch (e) { console.error(e); code = 1; }
  const { runCover80 } = require("./cover-80");
  if (!(await runCover80())) code = 1;
  const { runGoalGatesSuite } = require("./goal-gates");
  if (!(await runGoalGatesSuite())) code = 1;
  const { runMainSuite } = require("./run-all-tests");
  if (!(await runMainSuite())) code = 1;
  if (code !== 0) process.exit(1);
  console.log("COVERAGE-ALL: all genai suites green");
}

main().catch((err) => { console.error(err); process.exit(1); });
