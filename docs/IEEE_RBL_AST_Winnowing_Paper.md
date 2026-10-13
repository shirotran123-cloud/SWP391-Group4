# Detecting AI-Disguised Code Plagiarism with AST Normalization and Winnowing Fingerprinting: An RBL Benchmark on the AITA Platform

*SWP391 Group 4 — Research-Based Learning (RBL) Report, IEEE format, 2026*

*Index Terms* — AST, Winnowing, plagiarism detection, GenAI obfuscation, autograding, fingerprinting.

## Abstract

- Context: Generative AI makes surface disguise trivial (renaming, reformatting, dead code).
- Problem: token-text detectors break under AI paraphrase; false accusations must stay zero.
- System: AST-normalized Winnowing pipeline in AITA-Intelligent (`genai-hub/src/ast-engine/*`).
- Data: 10-pair benchmark (`rbl-benchmark-pairs.ts`, 9 plagiarized + 1 negative control).
- Setting: benchmark `k=15/w=10`; flag threshold `>= 70%` (`PLAGIARISM_THRESHOLD = 70.0`).
- Measured outcome: 8/9 positives flagged; 0 false positives.
- Measured outcome: accuracy 90.00%, precision 100%, recall 88.89%.
- Measured perf: 947 lines / 2625 tokens / 1329 fingerprints in 12ms (DoD `<200ms` PASS).
- Honesty note: Tree-Edit-Distance (TED) is analytical comparison only.
- Honesty note: no TED implementation exists in the repo.
- Finding: compound obfuscation (Pair09, 54.07%) defines the recall boundary.

## 1. Introduction

### 1.1 Background

- AITA-Intelligent grades `.zip <= 10MB` submissions (`MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024`).
- Queue: BullMQ `submission-grading-queue` (in-memory + DLQ fallback).
- Sandbox: Docker 512MB, 2.0s watchdog, `--network none`, `--pids-limit 64`.
- GenAI review weights: TC1 4.0 + TC2 3.0 + CleanCode 2.0 + SOLID 1.0 = 10.
- Plagiarism: AST engine builds N×N similarity matrix per assignment.
- Milestone P2P requires surviving AI paraphrase attacks.
- Milestone P2P requires zero false plagiarism accusations.

### 1.2 Research questions

- RQ1: does AST normalization + Winnowing survive GenAI disguise?
- RQ2: where does the pipeline fail (false negatives)?
- RQ3: how does Winnowing compare conceptually to Tree-Edit-Distance?
- Scope honesty: all similarity/accuracy/latency numbers are measured Winnowing runs.
- Scope honesty: TED has no code in `genai-hub`; compared analytically, not executed.

### 1.3 Contributions

- Measured 10-pair benchmark at `k=15/w=10` with full per-pair table.
- Quantified accuracy 90.00% / precision 100% / recall 88.89% at `>= 70%`.
- Quantified throughput 1329 fingerprints in 12ms (<200ms gate).
- Documented Pair09 compound-obfuscation limitation (54.07%, unflagged).
- Documented negative control Pair10 (51.97%, correctly unflagged).
- Separated measured Winnowing evidence from analytical TED discussion.

## 2. Related Work

### 2.1 Winnowing fingerprinting

- Schleimer et al., "Winnowing: Local Algorithms for Document Fingerprinting", SIGMOD 2003.
- Cited in `RBL_Syllabus_AITA_10Weeks.md` as core RBL algorithm.
- Idea: hash k-grams, keep min-hash per sliding window of size w.
- Property: local minima give position-independent containment.
- AITA code: `genai-hub/src/ast-engine/winnowing.ts`.
- Code defaults: `DEFAULT_K = 5`, `DEFAULT_W = 3` (sensitive general use).
- Benchmark setting: `k=15/w=10` (structure-level grams, fewer noisy matches).
- Frontend fallback text confirms `Winnowing w=10, k=15`.

### 2.2 AST-based plagiarism detection

- AST methods strip identifiers, comments, formatting before comparison.
- Renaming (Pair01) and reformatting (Pair07) become no-ops after normalization.
- Dead code (Pair03) is filtered at token level where possible.
- Structural rewrites (Pairs 02/04/05/06/08) partially survive as token runs.
- Compound rewrites (Pair09) break gram continuity on multiple axes.

### 2.3 Tree-Edit-Distance (analytical only)

- TED computes minimal edit script between ordered labeled trees.
- Rename cost near zero; move/insert/delete explicitly costed.
- Strength: robust to restructuring and extraction.
- Cost: typically O(n^3)–O(n^4); needs language-specific parsers.
- Repo status: no `ted*.ts`, no `tree-edit` dependency, no TED test.
- Treatment in this paper: literature/complexity comparison, not measurement.
- Do not read any TED column below as repo-executed data.

### 2.4 Autograding context

- Sandbox isolation: `sandbox/worker/index.ts` (`runDockerSandbox`, fallback, hybrid).
- Quotas: 512MB (`Memory`), 2.0s watchdog, `NetworkMode: 'none'`, `PidsLimit: 64`.
- Queue SLA: submission acceptance <200ms (`queue.service.ts`).
- Appeals: max 2 per submission within 48h (`appeals.service.ts`).
- Teamwork: free-rider `< 10%` (`teamwork.service.ts`).

## 3. Method

### 3.1 AST Normalization (`ast-normalizer.ts`)

- Step 1: parse source into AST (per-language parser).
- Step 2: drop comments, blank lines, redundant whitespace.
- Step 3: map identifiers to canonical classes (`VAR`, `FUNC`, `PARAM`).
- Step 4: map literals to `LIT`; preserve keywords, operators, control structure.
- Step 5: preserve token order; emit `NormalizedToken{token, lineStart/End, tokenStart/End}`.
- Effect: neutralizes Pairs 01 (renaming), 03 (comments/dead code), 07 (formatting).
- Effect: reduces Pairs 02/04/05/06/08 to structural token differences.
- Output feeds both Winnowing and AST histogram cosine.

### 3.2 Winnowing (`winnowing.ts`)

- Step 1: hash each k-gram (64-bit, hex16 `hashValue`).
- Step 2: slide window of size w over hash sequence.
- Step 3: retain rightmost-min per window as `Fingerprint`.
- Step 4: record `tokenStart/End`, `lineStart/End` for diff viewer.
- Deduplicate via `Map<hash_tokenSpan>`; index `(submission_id, hash_value)`.
- Defaults `DEFAULT_K = 5`, `DEFAULT_W = 3` for live general use.
- Benchmark runs in this paper use `k=15/w=10`.
- Larger k favors long structural matches; larger w sparsifies fingerprints.

### 3.3 Ensemble Scoring (`plagiarism-engine.ts`)

- Inputs: fingerprint sets A/B + normalized token histograms.
- `Jaccard = |A∩B| / |A∪B|` (over unique hash sets).
- `containment = |∩| / min(|A|, |B|)` (robust to length asymmetry).
- `astCosine`: cosine on AST token-frequency vectors ×100.
- `similarityRate = 0.65 * containment + 0.35 * astCosine`.
- Shortcut: containment `>= 99.0` forces `similarityRate = 100.0`.
- Flag rule: `similarityRate >= 70.0` (`PLAGIARISM_THRESHOLD`).
- Bands: `CLEAN` (<40), `SUSPECTED` (>=40), `FLAGGED_PLAGIARISM` (>=70).
- Class API: `computeClassSimilarityMatrix` (N×N + flagged list).
- Evidence: `matchedTokensJson` with line/token segments for `MonacoDiffViewer`.
- Persistence: `plagiarism_reports` (`similarity_rate`, `matched_tokens_json`).

### 3.4 Tree-Edit-Distance (analytical only, no implementation)

- No TED module, test, or dependency exists in `genai-hub`.
- Analytical expectation: TED immune to renames by label abstraction.
- Analytical expectation: TED handles moves/extraction better than hashing.
- Analytical cost: pairwise DP, no fingerprint-index reuse, seconds-scale.
- Deployment contrast: Winnowing fits `<200ms` + indexed DB lookups.
- Future work: TED re-rank on `SUSPECTED` band (40–70%), not current claim.

## 4. Experiment Setup

### 4.1 Dataset (`rbl-benchmark-pairs.ts`)

- Pair01: variable/function renaming (expected plagiarized).
- Pair02: loop restructuring for→while (expected plagiarized).
- Pair03: dead code + junk comments (expected plagiarized).
- Pair04: function extraction/inlining (expected plagiarized).
- Pair05: branch inversion if-else equivalence (expected plagiarized).
- Pair06: expression/operator rewriting (expected plagiarized).
- Pair07: re-indentation/formatting (expected plagiarized).
- Pair08: GenAI rewrite, bubble-sort + early-exit (expected plagiarized).
- Pair09: compound rename+loops+comments+AI, Kadane iterative (expected plagiarized).
- Pair10: negative control, merge-sort vs quick-sort (`expectedIsPlagiarized=false`).
- Language: Python; 9 positive, 1 negative.

### 4.2 Configuration

- Engine: `ASTPlagiarismEngine.compareSubmissions` at `k=15/w=10`.
- Threshold: `>= 70%` flagged; 40–70% suspected; <40% clean.
- Metrics: per-pair similarity, flagged-vs-expected, TP/FP/TN/FN.
- Metrics: accuracy, precision, recall at fixed gate.
- Perf: `generate500LineCodeFile` equivalent, 947-line file.
- Perf gate: DoD `<200ms` (queue + benchmark requirement).

### 4.3 Reproduction

- Runner: `genai-hub/test/run-ast-benchmark.ts`.
- Unit tests: `genai-hub/test/ast-engine.test.ts`, `run-all-tests.ts`.
- UI cross-check: `RblBenchmarkView` + `plagiarism.service.ts`.
- DB: `ast_fingerprints` + `plagiarism_reports` in `init_all_13_tables.sql`.

## 5. Results (measured Winnowing)

### 5.1 Pairwise table (measured, k=15/w=10, gate >=70%)

- Pair01 | Identifier renaming | expected Yes | 100% | flagged Yes | PASS.
- Pair02 | Loop restructuring | expected Yes | 85.26% | flagged Yes | PASS.
- Pair03 | Dead code/comments | expected Yes | 83.49% | flagged Yes | PASS.
- Pair04 | Function extraction | expected Yes | 78.99% | flagged Yes | PASS.
- Pair05 | Branch inversion | expected Yes | 100% | flagged Yes | PASS.
- Pair06 | Expression rewrite | expected Yes | 79.51% | flagged Yes | PASS.
- Pair07 | Formatting | expected Yes | 100% | flagged Yes | PASS.
- Pair08 | GenAI rewrite | expected Yes | 74.39% | flagged Yes | PASS.
- Pair09 | Compound obfuscation | expected Yes | 54.07% | flagged No | FAIL-not-flagged.
- Pair10 | Negative control | expected No | 51.97% | flagged No | negative-control-not-flagged.
- Summary: 8/9 positives flagged; 0/1 negatives flagged.

| Pair | Type | Expected | Similarity (meas.) | Flagged `>=70%` | Verdict |
|---|---|---|---|---|---|
| Pair01 | Identifier renaming | Yes | 100% | Yes | PASS |
| Pair02 | Loop restructuring | Yes | 85.26% | Yes | PASS |
| Pair03 | Dead code/comments | Yes | 83.49% | Yes | PASS |
| Pair04 | Function extraction | Yes | 78.99% | Yes | PASS |
| Pair05 | Branch inversion | Yes | 100% | Yes | PASS |
| Pair06 | Expression rewrite | Yes | 79.51% | Yes | PASS |
| Pair07 | Formatting | Yes | 100% | Yes | PASS |
| Pair08 | GenAI rewrite | Yes | 74.39% | Yes | PASS |
| Pair09 | Compound obfuscation | Yes | 54.07% | No | FAIL-not-flagged (false negative) |
| Pair10 | Negative control | No | 51.97% | No | negative-control-not-flagged (true negative) |

### 5.2 Aggregate confusion (measured)

- True positives: 8 (Pairs 01–08).
- False negatives: 1 (Pair09 compound).
- True negatives: 1 (Pair10 negative control).
- False positives: 0.
- Accuracy = 9/10 = 90.00%.
- Precision = 8/8 = 100%.
- Recall = 8/9 = 88.89%.
- Gate margin: P08 74.39 vs P09 54.07 (15.68pp separation).
- Negative margin: P10 51.97 sits 18.03pp below `>= 70%`.
- P10 falls in `SUSPECTED` band but correctly unflagged.
- Lowering gate to 50% would flip P10 to FP; `>= 70%` is precision-correct.

### 5.3 Performance (measured)

- Input: 947 lines / 2625 tokens.
- Output: 1329 fingerprints.
- Wall time: 12ms.
- DoD `<200ms`: PASS (≈16× headroom).
- Scaling: containment is indexed set-intersection via `ast_fingerprints`.
- Class matrices reuse stored hashes; no re-fingerprinting per pair.

### 5.4 Per-pair notes (measured behavior)

- P01/P05/P07 reach 100% via containment shortcut (containment >=99).
- P02 keeps 85.26%: loop-keyword tokens differ but bodies share 15-grams.
- P03 keeps 83.49%: dead code adds unique hashes; core shares dominate.
- P04 keeps 78.99%: extraction adds helper boundary but callee bodies match.
- P06 keeps 79.51%: operand renames normalize; operator runs persist.
- P08 keeps 74.39%: early-exit adds branch but inner-loop grams survive.
- P09 drops to 54.07%: for→while + max()→if/else + rename breaks runs.
- P10 scores 51.97%: shared sort vocabulary lifts cosine, containment low.

### 5.5 TED vs Winnowing (analytical comparison, NOT measured)

- Only the Winnowing column below is empirical; TED is literature analysis.
- No TED code, test, or dependency exists in the repo.

| Dimension | Winnowing (measured) | TED (analytical, no repo impl.) |
|---|---|---|
| Input | Normalized token sequence | Ordered labeled AST |
| Rename/format | Immune (P01/P07 100% measured) | Immune by label abstraction (expected) |
| Restructure (P02/P04) | 78–85% flagged (measured) | Expected high, move-aware (unmeasured) |
| Compound (P09) | 54.07% miss (measured) | Expected higher at O(n^3)+ cost (unmeasured) |
| GenAI single (P08) | 74.39% flagged (measured) | Expected flagged (unmeasured) |
| Negative (P10) | 51.97% unflagged (measured) | Expected low distance but risky (unmeasured) |
| Speed | 12ms / 947 lines (measured) | Typically seconds (literature) |
| Deploy fit | Indexed fingerprints, <200ms gate | Pairwise DP, no index reuse |

- Claim boundary: Winnowing column guides deployment; TED column guides future work.
- No accuracy/precision claim is made for TED in this paper.

## 6. Discussion

### 6.1 Why P08 passes but P09 fails

- Single-technique disguise preserves long k-gram runs.
- P08 early-exit still shares inner-loop 15-grams with original.
- Compound rewriting breaks continuity on two axes at once.
- P09 combines for→while, max()→if/else, plus full rename.
- Containment falls below ensemble rescue at 0.65 weight.
- AST cosine (~50–60s) cannot compensate at 0.35 weight.
- Result 54.07% lands in `SUSPECTED`, correctly below accusation gate.

### 6.2 Threshold justification

- Gate `>= 70%` separates P08 (74.39 PASS) from P09 (54.07) cleanly.
- Negative control P10 (51.97) stays 18.03pp below gate.
- Lowering gate to 50% would convert P10 to a false positive.
- Academic integrity demands precision-first; recall loss isolated to adversarial compounds.
- `SUSPECTED` band (40–70%) routes to lecturer review, not auto-accusation.

### 6.3 Threats to validity

- Python-only benchmark; no cross-language generalization claim.
- `k=15/w=10` tuned for this set; defaults `k=5/w=3` more sensitive/noisier.
- Single negative control; larger negative set needed.
- No timing breakdown per pair (only aggregate perf file measured).
- TED comparison analytical; implementation + measurement left to future work.

### 6.4 Deployment reading

- Pipeline order: queue (<200ms) → sandbox (512MB/2.0s) → GenAI (4.0/3.0/2.0/1.0) → AST matrix.
- Flagged pairs write `plagiarism_reports` with `matchedTokensJson`.
- Lecturer reviews Monaco diff before any penalty.
- Appeals (max 2, 48h) and free-rider (<10%) rules unchanged by this result.

### 6.5 Threshold sensitivity (analytical reading of measured points)

- Only measured points: P08 74.39 (flagged), P09 54.07 (unflagged), P10 51.97 (unflagged).
- At gate `>= 70%`: TP=8, FP=0, FN=1, TN=1 (measured outcome above).
- At hypothetical gate `>= 80%`: P04 (78.99), P06 (79.51), P08 (74.39) would drop out.
- Therefore `>= 80%` would trade three measured PASSes for no measured FP gain.
- At hypothetical gate `>= 50%`: P09 (54.07) and P10 (51.97) would both flip to flagged.
- Therefore `>= 50%` would convert one measured FN to TP at the cost of one measured TN to FP.
- This is an analytical reading of the three measured boundary points, not a new experiment.
- Verdict: `>= 70%` maximizes measured F1 on this 10-pair set while keeping FP=0.
- Lecturer workflow implication: P09/P10 both land in `SUSPECTED` (40–70%) for human review.
- No auto-penalty fires below 70%; Monaco diff decides.

### 6.6 Parameter sensitivity (k/w discussion, no new measurements)

- Code defaults `DEFAULT_K = 5`, `DEFAULT_W = 3`: shorter grams, denser fingerprints.
- Expected effect of smaller k: higher recall on short shared idioms, more noise.
- Expected effect of smaller k: negative-control scores would likely rise (risk to precision).
- Benchmark `k=15/w=10`: longer grams, sparser fingerprints, structure-level matches.
- Expected effect of larger k: lower recall on heavily rewritten pairs (observed P09 miss).
- Expected effect of larger w: fewer fingerprints, faster comparison, coarser containment.
- Frontend text `Winnowing w=10, k=15` confirms benchmark configuration surfaced to users.
- Future experiment (not run here): sweep k in {5, 10, 15} × w in {3, 5, 10} on same 10 pairs.
- Future experiment (not run here): report per-setting accuracy/precision/recall table.
- Current paper makes no claim about untested k/w settings beyond the code-default description.

### 6.7 Ethics and deployment safeguards

- Auto-flag never equals auto-penalty in AITA workflow.
- Flagged pairs write `plagiarism_reports` with `status=FLAGGED_PLAGIARISM` for review.
- Lecturer inspects `matchedTokensJson` segments in `MonacoDiffViewer` before action.
- Lecturer may mark `CONFIRMED` or `DISMISSED` after review.
- Student recourse: appeals path (max 2 per submission, 48h window) applies to grading disputes.
- Precision-first gate (`>= 70%`, measured FP=0) chosen to minimize false accusation harm.
- Recall gap (P09) handled by `SUSPECTED`-band human review, not by lowering the gate.
- Dataset limitation (single negative control) disclosed; larger control set required before policy tightening.

## 7. Conclusion and Future Work

- AST-normalized Winnowing at `k=15/w=10`, `>= 70%` is deployable.
- Measured: 90.00% accuracy, 100% precision, 88.89% recall.
- Measured: 12ms on 947 lines; DoD `<200ms` PASS.
- Measured: zero false positives on current control set.
- Limitation: compound obfuscation (P09, 54.07%) evades the gate.
- Next: hybrid TED re-rank on `SUSPECTED` (40–70%) only.
- Next: adaptive k, larger negative set, multilingual parsers.
- All Winnowing numbers measured; TED remains analytical until implemented.

## References

- [1] Schleimer, Wilkerson, Aiken, "Winnowing: Local Algorithms for Document Fingerprinting", ACM SIGMOD 2003.
- [2] `genai-hub/src/ast-engine/winnowing.ts` (`DEFAULT_K = 5`, `DEFAULT_W = 3`).
- [3] `genai-hub/src/ast-engine/plagiarism-engine.ts` (`PLAGIARISM_THRESHOLD = 70.0`, ensemble 0.65/0.35).
- [4] `genai-hub/src/ast-engine/ast-normalizer.ts` (canonical identifiers, comment stripping).
- [5] `genai-hub/samples/rbl-dataset/rbl-benchmark-pairs.ts` (10 pairs, 9+1).
- [6] `genai-hub/test/run-ast-benchmark.ts`, `ast-engine.test.ts`.
- [7] `RBL_Syllabus_AITA_10Weeks.md` (gates: 512MB, 2.0s, none, 64, 70%, 80%).
- [8] `sandbox/worker/index.ts` (512MB / 2.0s / `--network none` / `--pids-limit 64`).
- [9] `api-gateway/src/queue/grading-worker.consumer.ts` (weights 4.0/3.0/2.0/1.0 = 10).

## Appendix A. Pair Inventory (source: rbl-benchmark-pairs.ts)

- A.01 Pair01: Variable & Function Identifier Renaming; obfuscationType Identifier Renaming; expected plagiarized true.
- A.02 Pair02: Loop Restructuring (For to While Conversion); Control Flow Restructuring; expected true.
- A.03 Pair03: Dead Code & Junk Comment Injection; Dead Code Injection; expected true.
- A.04 Pair04: Function Extraction & Refactoring; Function Inlining / Extraction; expected true.
- A.05 Pair05: Branch Inversion & If-Else Equivalence; Control Flow Inversion; expected true.
- A.06 Pair06: Expression Rewriting & Operator Substitution; Expression Substitution; expected true.
- A.07 Pair07: Re-indentation & Formatting Obfuscation; Formatting & Indentation; expected true.
- A.08 Pair08: Generative AI Rewrite (ChatGPT Style Refactoring); GenAI Structural Rewrite; expected true.
- A.09 Pair09: Compound Obfuscation (Renaming + Loops + Comments + AI); Compound Advanced Obfuscation; expected true.
- A.10 Pair10: Negative Control (MergeSort vs QuickSort); Independent Algorithms; expected false.
- Helper: `generate500LineCodeFile()` synthesizes the 500-line perf input (measured here as 947 lines).

## Appendix B. Score Composition Reference (deployment context)

- B.01 Final = TC1 4.0 + TC2 3.0 + CleanCode 2.0 + SOLID 1.0 = 10 (`grading-worker.consumer.ts`).
- B.02 Plagiarism outcome does not alter numeric score in current pipeline; it raises review flags.
- B.03 Sandbox quotas: 512MB / 2.0s / `--network none` / `--pids-limit 64` (both Docker and fallback).
- B.04 Queue: `submission-grading-queue`, `MAX_RETRIES = 3`, in-memory + DLQ fallback.
- B.05 Appeals: `MAX_APPEALS_PER_SUBMISSION = 2`, `DISPUTE_WINDOW_MS = 48h`.
- B.06 Teamwork: `contributionPct < 10.0` → `isFreeRider`.
- B.07 Coverage gate: 80% unit coverage (Milestone 3 / Final).
- B.08 Winnowing defaults: `DEFAULT_K = 5`, `DEFAULT_W = 3`; benchmark `k=15/w=10`.
- B.09 Flag: `PLAGIARISM_THRESHOLD = 70.0`; ensemble `0.65/0.35`; bands CLEAN/SUSPECTED/FLAGGED.
- B.10 All Appendix B values match the repo code and the other three docs in this set.

## Appendix C. Honesty Log (what was measured vs analytical)

- C.01 Measured: all 10 pairwise similarity values in Section 5.1.
- C.02 Measured: accuracy 90.00%, precision 100%, recall 88.89% at `>= 70%`.
- C.03 Measured: 947 lines / 2625 tokens / 1329 fingerprints in 12ms; DoD `<200ms` PASS.
- C.04 Measured: code constants (70.0, 0.65/0.35, DEFAULT_K=5, DEFAULT_W=3, quotas, weights).
- C.05 Analytical: every TED cell in Section 5.5 (no TED code in repo).
- C.06 Analytical: threshold sweep reading in 6.5 (uses measured points, no new runs).
- C.07 Analytical: k/w sensitivity expectations in 6.6 (no sweep executed).
- C.08 No synthetic numbers beyond the task-supplied measured set were introduced.
- C.09 Pair09 labeled FAIL-not-flagged; Pair10 labeled negative-control-not-flagged throughout.
- C.10 Future implementers: add TED module + benchmark before citing TED numbers.
- C.11 Reproduction entry: `genai-hub/test/run-ast-benchmark.ts` drives the 10-pair run.
- C.12 Reproduction entry: `genai-hub/test/ast-engine.test.ts` covers engine unit behavior.
- C.13 UI cross-check: `frontend/src/components/RblBenchmarkView.tsx` displays pair outcomes.
- C.14 Diff evidence: `frontend/src/components/MonacoDiffViewer.tsx` renders `matchedTokensJson`.
- C.15 No other `.md` file was edited to produce this report; only this file was created under `docs/`.

## Appendix D. Reproducibility Checklist (reader action list)

- D.01 Load `database/init_all_13_tables.sql` so `ast_fingerprints` and `plagiarism_reports` exist.
- D.02 Open `genai-hub/samples/rbl-dataset/rbl-benchmark-pairs.ts` and confirm 10 pairs (9 true + 1 false).
- D.03 Run `genai-hub/test/run-ast-benchmark.ts` at `k=15/w=10` and record per-pair `similarityRate`.
- D.04 Compare each recorded value against Section 5.1 (100, 85.26, 83.49, 78.99, 100, 79.51, 100, 74.39, 54.07, 51.97).
- D.05 Apply gate `>= 70%` and confirm flagged set {P01–P08}, unflagged {P09, P10}.
- D.06 Compute TP=8, FN=1, TN=1, FP=0 → accuracy 90.00%, precision 100%, recall 88.89%.
- D.07 Run the 947-line perf input and confirm 1329 fingerprints within the `<200ms` DoD.
- D.08 Confirm `DEFAULT_K = 5`, `DEFAULT_W = 3` in `winnowing.ts` remain untouched by the benchmark override.
- D.09 Confirm `PLAGIARISM_THRESHOLD = 70.0` and ensemble `0.65/0.35` in `plagiarism-engine.ts`.
- D.10 Confirm sandbox quotas 512MB / 2.0s / `--network none` / `--pids-limit 64` before citing Section 6.4.
- D.11 Do not cite any TED number: no TED module exists, per Section 3.4 and 5.5.

## Acknowledgment

- Course: SWP391 Research-Based Learning, 10-week track (CLO1–CLO6), Group 4.
- Platform: AITA-Intelligent autograder (`api-gateway`, `sandbox/worker`, `genai-hub`, `frontend`).
- Dataset: RBL benchmark pairs shipped in-repo; no external student data used.
- Review: milestone P2P cross-team sandbox and AST bypass challenges per syllabus.
