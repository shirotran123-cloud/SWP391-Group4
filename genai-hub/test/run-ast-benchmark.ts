/**
 * RBL Research Core - AST & Winnowing Experimental Benchmark Runner
 *
 * Runs the 10 AI-obfuscated code pairs, measures accuracy/precision/recall,
 * and validates the < 200ms DoD requirement for a 500-line code file.
 */

import { ASTPlagiarismEngine } from "../src/ast-engine/plagiarism-engine";
import { ASTNormalizer } from "../src/ast-engine/ast-normalizer";
import { WinnowingEngine } from "../src/ast-engine/winnowing";
import { RBL_BENCHMARK_PAIRS, generate500LineCodeFile } from "../samples/rbl-dataset/rbl-benchmark-pairs";

export function runASTBenchmark() {
  console.log("==========================================================================");
  console.log("   RBL RESEARCH BENCHMARK: AST NORMALIZER & WINNOWING PLAGIARISM ENGINE   ");
  console.log("==========================================================================");
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Config: k-gram = 15, sliding window w = 10, threshold = 70.0%\n`);

  let truePositives = 0;
  let falsePositives = 0;
  let trueNegatives = 0;
  let falseNegatives = 0;

  const resultsTable: Array<{
    pairId: number;
    title: string;
    obfuscationType: string;
    expectedPlagiarism: boolean;
    detectedSimilarity: string;
    isFlagged: boolean;
    status: string;
    timeMs: number;
    passed: boolean;
  }> = [];

  for (const pair of RBL_BENCHMARK_PAIRS) {
    const result = ASTPlagiarismEngine.compareSubmissions(
      { submissionId: `Sub-A-${pair.pairId}`, sourceCode: pair.codeA, language: "python" },
      { submissionId: `Sub-B-${pair.pairId}`, sourceCode: pair.codeB, language: "python" }
    );

    const isPlagiarizedDetected = result.similarityRate >= 70.0;
    const passed = isPlagiarizedDetected === pair.expectedIsPlagiarized;

    if (pair.expectedIsPlagiarized && isPlagiarizedDetected) truePositives++;
    else if (!pair.expectedIsPlagiarized && isPlagiarizedDetected) falsePositives++;
    else if (!pair.expectedIsPlagiarized && !isPlagiarizedDetected) trueNegatives++;
    else if (pair.expectedIsPlagiarized && !isPlagiarizedDetected) falseNegatives++;

    resultsTable.push({
      pairId: pair.pairId,
      title: pair.title,
      obfuscationType: pair.obfuscationType,
      expectedPlagiarism: pair.expectedIsPlagiarized,
      detectedSimilarity: `${result.similarityRate}%`,
      isFlagged: result.isFlagged,
      status: passed ? "PASS [CORRECT]" : "FAIL [MISMATCH]",
      timeMs: result.executionTimeMs,
      passed,
    });

    console.log(
      `[Pair ${String(pair.pairId).padStart(2, "0")}] ${pair.title.padEnd(60)} | ` +
      `Sim: ${String(result.similarityRate).padStart(6)}% | ` +
      `Flagged: ${String(result.isFlagged).padEnd(5)} | ` +
      `Time: ${result.executionTimeMs}ms | ` +
      `${passed ? "✔ PASS" : "✖ FAIL"}`
    );
  }

  const totalPairs = RBL_BENCHMARK_PAIRS.length;
  const totalCorrect = truePositives + trueNegatives;
  const accuracy = (totalCorrect / totalPairs) * 100;
  const precision = truePositives + falsePositives > 0 ? (truePositives / (truePositives + falsePositives)) * 100 : 100;
  const recall = truePositives + falseNegatives > 0 ? (truePositives / (truePositives + falseNegatives)) * 100 : 100;

  console.log("\n--------------------------------------------------------------------------");
  console.log("                     EXPERIMENTAL BENCHMARK SUMMARY                       ");
  console.log("--------------------------------------------------------------------------");
  console.log(`Total Code Pairs Evaluated: ${totalPairs}`);
  console.log(`True Positives (TP):        ${truePositives}`);
  console.log(`True Negatives (TN):        ${trueNegatives}`);
  console.log(`False Positives (FP):       ${falsePositives}`);
  console.log(`False Negatives (FN):       ${falseNegatives}`);
  console.log(`Algorithm Accuracy:         ${accuracy.toFixed(2)}% (Target: > 80.0%)`);
  console.log(`Algorithm Precision:        ${precision.toFixed(2)}%`);
  console.log(`Algorithm Recall:           ${recall.toFixed(2)}%`);
  console.log("--------------------------------------------------------------------------\n");

  // 500-Line Performance Benchmark
  console.log("--------------------------------------------------------------------------");
  console.log("            PERFORMANCE DOD TEST: 500-LINE CODE PROCESSING SPEED           ");
  console.log("--------------------------------------------------------------------------");
  const synthetic500LineCode = generate500LineCodeFile();
  const actualLineCount = synthetic500LineCode.split(/\r?\n/).length;

  const perfStartTime = Date.now();
  const normResult = ASTNormalizer.normalize(synthetic500LineCode, "python");
  const fingerprints = WinnowingEngine.computeFingerprints(normResult.tokens);
  const perfDurationMs = Date.now() - perfStartTime;

  console.log(`Synthetic Code Lines:     ${actualLineCount} lines`);
  console.log(`Extracted AST Tokens:     ${normResult.tokens.length} tokens`);
  console.log(`Winnowing Fingerprints:   ${fingerprints.length} fingerprints`);
  console.log(`Total Execution Time:     ${perfDurationMs} ms (Target DoD: < 200 ms)`);
  console.log(`Performance DoD Status:   ${perfDurationMs < 200 ? "PASSED (< 200ms)" : "FAILED (>= 200ms)"}`);
  console.log("--------------------------------------------------------------------------\n");

  if (accuracy >= 80.0 && perfDurationMs < 200) {
    console.log("SUCCESS: ALL RBL RESEARCH LEAD DEFINITION OF DONE REQUIREMENTS SATISFIED!");
  } else {
    console.error("FAILURE: Benchmark requirements not fully met.");
  }

  return {
    accuracy,
    precision,
    recall,
    perfDurationMs,
    resultsTable,
  };
}

if (require.main === module) {
  runASTBenchmark();
}
