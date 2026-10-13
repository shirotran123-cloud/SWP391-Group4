/** Single-process entry running every gateway suite for one c8 report. */
async function main(): Promise<void> {
  let code = 0;
  // In-process drivers first (no ports needed beyond their own).
  const { runCoverGates } = require("./cover-gates");
  if (!(await runCoverGates())) code = 1;
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
  if (code !== 0) process.exit(1);
  console.log("COVERAGE-ALL: all gateway suites green");
}

main().catch((err) => { console.error(err); process.exit(1); });
