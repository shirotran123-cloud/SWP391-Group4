/**
 * Unit Test Suite - AST Normalizer & Winnowing Core Engine
 *
 * Tests individual components of Subsystem 4 (RBL Core):
 * 1. AST Normalizer token extraction & comment stripping
 * 2. Winnowing algorithm k-grams & digital fingerprints
 * 3. Pairwise Jaccard / Containment / Hybrid Similarity calculations
 * 4. Class similarity matrix computation & matched_tokens_json format
 */

import { ASTNormalizer } from "../src/ast-engine/ast-normalizer";
import { WinnowingEngine } from "../src/ast-engine/winnowing";
import { ASTPlagiarismEngine, CodeSubmission } from "../src/ast-engine/plagiarism-engine";

export function runUnitTests() {
  console.log("==========================================================================");
  console.log("                   UNIT TESTS: AST & WINNOWING CORE                        ");
  console.log("==========================================================================");

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`[TEST PASS] ${testName}`);
    } else {
      console.error(`[TEST FAIL] ${testName}`);
    }
  }

  // --------------------------------------------------------------------------
  // 1. Test AST Normalizer
  // --------------------------------------------------------------------------
  console.log("\n--- Section 1: AST Normalizer Tests ---");

  const pythonCode = `
def add_numbers(a, b):
    # This is a comment
    result = a + b
    return result
`;
  const normPy = ASTNormalizer.normalize(pythonCode, "python");
  assert(normPy.tokens.length > 0, "Python code produces non-empty AST token sequence");
  assert(!normPy.normalizedString.includes("add_numbers"), "Normalizer strips function name 'add_numbers'");
  assert(!normPy.normalizedString.includes("comment"), "Normalizer strips inline comment");
  assert(normPy.tokens.some((t) => t.token === "FUNC_DEF"), "Identifies FUNC_DEF keyword token");
  assert(normPy.tokens.some((t) => t.token === "RETURN_STMT"), "Identifies RETURN_STMT keyword token");

  const cStyleCode = `
// C-Style Code Sample
int calculate(int x) {
    if (x > 0) {
        return x * 2;
    }
    return 0;
}
`;
  const normC = ASTNormalizer.normalize(cStyleCode, "cpp");
  assert(normC.tokens.length > 0, "C-Style code produces AST tokens");
  assert(!normC.normalizedString.includes("calculate"), "C-Style normalizer strips function name 'calculate'");
  assert(normC.tokens.some((t) => t.token === "COND_STMT"), "Identifies COND_STMT (if)");

  // --------------------------------------------------------------------------
  // 2. Test Winnowing Engine
  // --------------------------------------------------------------------------
  console.log("\n--- Section 2: Winnowing Engine Tests ---");

  const fingerprints = WinnowingEngine.computeFingerprints(normPy.tokens);
  assert(fingerprints.length > 0, "Winnowing computes digital fingerprints array");
  assert(typeof fingerprints[0].hashValue === "string", "Fingerprint has string hashValue");
  assert(fingerprints[0].lineStart >= 1, "Fingerprint tracks valid lineStart coordinate");

  // Identical token sequences produce identical fingerprint hash sets
  const normPy2 = ASTNormalizer.normalize(pythonCode, "python");
  const fingerprints2 = WinnowingEngine.computeFingerprints(normPy2.tokens);
  assert(
    fingerprints.length === fingerprints2.length &&
      fingerprints[0].hashValue === fingerprints2[0].hashValue,
    "Deterministic code produces identical digital fingerprints"
  );

  // --------------------------------------------------------------------------
  // 3. Test Pairwise Plagiarism Comparison & Threshold
  // --------------------------------------------------------------------------
  console.log("\n--- Section 3: Pairwise Similarity & Report Tests ---");

  const subA: CodeSubmission = {
    submissionId: "SUB_A_01",
    studentName: "Student A",
    sourceCode: pythonCode,
    language: "python",
  };

  const subB: CodeSubmission = {
    submissionId: "SUB_B_01",
    studentName: "Student B",
    sourceCode: `
def sum_vals(x, y):
    // Renamed variables and function name
    total = x + y
    return total
`,
    language: "python",
  };

  const pairResult = ASTPlagiarismEngine.compareSubmissions(subA, subB);
  assert(pairResult.similarityRate === 100, "Identical logic produces 100% similarity rate");
  assert(pairResult.isFlagged === true, "Pairs with similarity >= 70% are flagged as plagiarized");
  assert(pairResult.status === "FLAGGED_HIGH", "Status is FLAGGED_HIGH for 100% similarity");
  assert(pairResult.matchedTokensJson.matchedSegments.length > 0, "matched_tokens_json contains line coordinates");

  // --------------------------------------------------------------------------
  // 4. Test Class Similarity Matrix
  // --------------------------------------------------------------------------
  console.log("\n--- Section 4: Class Similarity Matrix Tests ---");

  const classSubmissions: CodeSubmission[] = [
    subA,
    subB,
    {
      submissionId: "SUB_C_01",
      studentName: "Student C",
      sourceCode: `
def quick_sort(arr):
    if len(arr) <= 1: return arr
    pivot = arr[len(arr) // 2]
    return quick_sort([x for x in arr if x < pivot]) + [x for x in arr if x == pivot] + quick_sort([x for x in arr if x > pivot])
`,
      language: "python",
    },
  ];

  const matrixReport = ASTPlagiarismEngine.computeClassSimilarityMatrix(classSubmissions, "ASSIGNMENT_01");
  assert(matrixReport.totalSubmissions === 3, "Matrix computes for 3 class submissions");
  assert(matrixReport.totalPairsCompared === 3, "3 total pairwise comparisons made (3*2/2 = 3)");
  assert(matrixReport.similarityMatrix[0][1] === 100, "Matrix cell [0][1] equals 100%");
  assert(matrixReport.flaggedPairsCount >= 1, "Matrix correctly counts flagged pairs >= 70%");
  assert(matrixReport.totalExecutionTimeMs < 200, "Full matrix computation completes under 200ms");

  console.log("\n--------------------------------------------------------------------------");
  console.log(`UNIT TEST RESULTS: ${passed}/${total} TESTS PASSED (${((passed / total) * 100).toFixed(1)}%)`);
  console.log("--------------------------------------------------------------------------\n");

  return passed === total;
}

if (require.main === module) {
  runUnitTests();
}
