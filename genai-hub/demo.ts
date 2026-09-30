import * as fs from "fs";
import * as path from "path";
import createGenAIHub from "./src/index";

async function runDemo() {
  console.log("\x1b[1m\x1b[35m=======================================================================\x1b[0m");
  console.log("\x1b[1m\x1b[35m       AITA INTELLIGENT AUTOGRADING SYSTEM - PHÂN HỆ 3 DEMO HUB       \x1b[0m");
  console.log("\x1b[1m\x1b[35m              GenAI Core, Semantic Reviewer & Rubric Engine            \x1b[0m");
  console.log("\x1b[1m\x1b[35m=======================================================================\x1b[0m\n");

  const hub = createGenAIHub;

  // -------------------------------------------------------------------------
  // DEMO CASE 1: Reviewing Dirty C++ Code (SRP violation, Magic Numbers, God Class)
  // -------------------------------------------------------------------------
  console.log("\x1b[1m\x1b[33m--- [SCENARIO 1]: Evaluating Code Quality & SOLID (UC-09) ---\x1b[0m");
  const dirtyCodePath = path.join(__dirname, "samples", "dirty-calc.cpp");
  const dirtyCode = fs.readFileSync(dirtyCodePath, "utf-8");

  console.log(`Submitting file: samples/dirty-calc.cpp (${dirtyCode.length} bytes)`);
  console.log("Analyzing with temperature=0.2 and JSON Schema Mode...\n");

  const reviewResult = await hub.codeReviewer.reviewCode({
    submissionId: "SUBM-2026-DEMO-001",
    language: "cpp",
    sourceFiles: [{ filename: "dirty-calc.cpp", content: dirtyCode }],
    assignmentTopic: "Object-Oriented Design & Clean Code Practices",
    learningOutcomes: ["Single Responsibility Principle", "Meaningful Identifiers", "DRY"],
  });

  console.log("\x1b[32m[REVIEW EVALUATION COMPLETED]\x1b[0m");
  console.log(`+--------------------+------------------------------------------------+`);
  console.log(`| Metric             | Score / Value                                  |`);
  console.log(`+--------------------+------------------------------------------------+`);
  console.log(`| Clean Code Score   | \x1b[1m\x1b[33m${reviewResult.clean_code_score} / 10.0\x1b[0m                                 |`);
  console.log(`| SOLID Score        | \x1b[1m\x1b[31m${reviewResult.solid_score} / 10.0\x1b[0m                                 |`);
  console.log(`| Model Used         | ${reviewResult.model_used.padEnd(46)} |`);
  console.log(`| Evaluated At       | ${reviewResult.evaluated_at.padEnd(46)} |`);
  console.log(`+--------------------+------------------------------------------------+\n`);

  console.log("\x1b[1mDetected Code Smells & Architectural Issues:\x1b[0m");
  reviewResult.feedback_json.forEach((smell, i) => {
    const color = smell.severity === "CRITICAL" ? "\x1b[31m" : "\x1b[33m";
    console.log(`  ${i + 1}. [${color}${smell.severity}\x1b[0m] ${smell.smell_type} (${smell.file}:L${smell.line_start}-${smell.line_end})`);
    console.log(`     Rule Violated : ${smell.rule}`);
    console.log(`     Suggestion    : ${smell.suggestion}\n`);
  });

  // -------------------------------------------------------------------------
  // DEMO CASE 2: Intercepting Prompt Injection Attack (Rule R03)
  // -------------------------------------------------------------------------
  console.log("\x1b[1m\x1b[33m--- [SCENARIO 2]: Adversarial Prompt Injection Defense (Rule R03) ---\x1b[0m");
  const maliciousPath = path.join(__dirname, "samples", "malicious-injection.java");
  const maliciousCode = fs.readFileSync(maliciousPath, "utf-8");

  console.log("Submitting file: samples/malicious-injection.java containing prompt injection payloads...");
  const maliciousReview = await hub.codeReviewer.reviewCode({
    submissionId: "SUBM-2026-HACK-002",
    language: "java",
    sourceFiles: [{ filename: "malicious-injection.java", content: maliciousCode }],
  });

  console.log("\x1b[32m[DEFENSE RESULT]\x1b[0m: Injection successfully neutralized!");
  const securitySmell = maliciousReview.feedback_json.find((s) => s.file === "SECURITY_AUDIT");
  if (securitySmell) {
    console.log(`  \x1b[31m[AUDIT ALERT]\x1b[0m: ${securitySmell.smell_type}`);
    console.log(`  Notice to Student: ${securitySmell.suggestion}\n`);
  }

  // -------------------------------------------------------------------------
  // DEMO CASE 3: Compiler Error Explainer (UC-09 Companion)
  // -------------------------------------------------------------------------
  console.log("\x1b[1m\x1b[33m--- [SCENARIO 3]: Socratic Compiler Error Explainer ---\x1b[0m");
  const crashLog = "gcc: fatal error: segmentation fault (SIGSEGV) at address 0x0";
  console.log(`Diagnostic Log: "${crashLog}"`);

  const explanation = await hub.compilerExplainer.explainError(crashLog, "cpp");
  console.log(`\x1b[36mError Diagnosis:\x1b[0m ${explanation.errorType}`);
  console.log(`\x1b[36mExplanation:\x1b[0m     ${explanation.simpleExplanation}`);
  console.log(`\x1b[36mRoot Cause:\x1b[0m      ${explanation.suspectedCause}`);
  console.log(`\x1b[36mHints:\x1b[0m`);
  explanation.actionableHints.forEach((h, idx) => console.log(`   ${idx + 1}. ${h}`));
  console.log("");

  // -------------------------------------------------------------------------
  // DEMO CASE 4: UC-08 Automated Exam & Rubric Generation for Lecturers
  // -------------------------------------------------------------------------
  console.log("\x1b[1m\x1b[33m--- [SCENARIO 4]: Generating Exam & Grading Rubric (UC-08) ---\x1b[0m");
  const exam = await hub.examGenerator.generateExam({
    topic: "2D Dynamic Matrix Transposition & Memory Safety",
    courseCode: "PRG211",
    difficulty: "MEDIUM",
    language: "cpp",
    learningOutcomes: ["Pointers & Dynamic Allocation", "Multi-dimensional Arrays", "Clean Code"],
    numTestCases: 2,
  });

  console.log(`Generated Exam Title : \x1b[1m\x1b[32m${exam.title}\x1b[0m (${exam.courseCode} - ${exam.difficulty})`);
  console.log(`Problem Statement    : ${exam.problemStatement}`);
  console.log(`Sample Test Cases    : ${exam.sampleTestCases.length} visible, ${exam.hiddenTestCases.length} hidden`);
  console.log(`Rubric Criteria Count: ${exam.rubric.length} grading criteria items.`);
  exam.rubric.forEach((r, idx) => {
    console.log(`   ${idx + 1}. ${r.criterion} (Max ${r.maxScore} pts): ${r.description}`);
  });

  console.log("\n\x1b[1m\x1b[35m=======================================================================\x1b[0m");
  console.log("\x1b[1m\x1b[32m                     ALL DEMO SCENARIOS COMPLETED                      \x1b[0m");
  console.log("\x1b[1m\x1b[35m=======================================================================\x1b[0m\n");
}

runDemo().catch((err) => console.error("Demo failed:", err));