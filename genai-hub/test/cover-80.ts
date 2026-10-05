/**
 * AITA GenAI coverage driver — pushes c8 past the 80% bar.
 *
 * Drives REAL shipped code on branches the main suite misses:
 *  - ASTNormalizer C-style/JS branches: block comments, every keyword family,
 *    literals, call-expr vs var identifiers, all symbol classes, docstrings
 *  - Winnowing short-input path (< k tokens) + custom k/w options
 *  - OpenAI/Gemini providers: success with usage + JSON schema, HTTP-error retry
 *    then recovery, empty-pool throw, invalid-JSON tolerance (fetch mocked)
 *  - KeyRotator multi-error/cooldown/success paths, schema adapters,
 *    review-response validator reject paths, fallback provider chain.
 *
 * Runnable: ts-node test/cover-80.ts (also imported by run-all-tests).
 */
import { ASTNormalizer } from "../src/ast-engine/ast-normalizer";
import { WinnowingEngine } from "../src/ast-engine/winnowing";
import { ASTPlagiarismEngine } from "../src/ast-engine/plagiarism-engine";
import { OpenAIProvider } from "../src/providers/openai.provider";
import { GeminiProvider } from "../src/providers/gemini.provider";
import { FallbackProvider } from "../src/providers/fallback.provider";
import { MockProvider } from "../src/providers/mock.provider";
import { KeyRotatorService } from "../src/services/key-rotator.service";
import { adaptSchemaForOpenAI, adaptSchemaForGemini } from "../src/schemas/schema-adapter";
import { ReviewResponseValidator } from "../src/validation/review-response.validator";
import { CODE_REVIEW_JSON_SCHEMA } from "../src/schemas/code-review.schema";

let passed = 0;
let failed = 0;
function gate(ok: boolean, name: string, details?: string): void {
  if (ok) { passed++; console.log(`[PASS] ${name}`); }
  else { failed++; console.error(`[FAIL] ${name}${details ? ` -> ${details}` : ""}`); }
}

const CSTYLE_ALL_BRANCHES = `/* block comment line 1
   block comment line 2 */
function computeTotal(items) {
  const limit = 100;
  let acc = 0;
  var flag = true;
  double ratio = 1.5;
  char sep = ',';
  boolean done = false;
  // single line comment
  if (acc == 0) {
    acc += 10;
  } else {
    acc -= 1;
  }
  for (let i = 0; i < limit; i++) {
    acc = acc + i;
  }
  while (done != true) {
    break;
  }
  do {
    acc *= 2;
  } while (acc < 5);
  try {
    acc /= 2;
  } catch (e) {
    acc = 0;
  } finally {
    done = true;
  }
  if (acc >= 10 && flag || !done) {
    computeTotal(acc);
  }
  publicHelper(acc);
  return acc;
}
class Calculator {
  public static void render() {}
  private int hidden;
  protected helper() {}
}
`;

const PY_ALL_BRANCHES = `"""Module docstring.
Spanning two lines."""
def process(items):
    # hash comment line
    // double slash comment
    total = 0
    if total <= 1:
        total = 1
    elif total == 2:
        total = 20
    else:
        total = 30
    for item in items:
        total = total + item
    while total != 0 and total is not 99 or not total in items:
        break
    try:
        total += 1
    except ValueError:
        pass
    finally:
        total -= 1
    with open('f') as fh:
        data = fh.read()
    f = lambda x: x * 2
    raise ValueError('bad')
    yield total
    from os import path as p
    import sys
    return total
`;

function mockFetchOnce(handler: (url: string, init: any) => Promise<Response>): () => void {
  const original = global.fetch;
  (global as any).fetch = async (input: any, init: any) => handler(String(input), init);
  return () => { (global as any).fetch = original; };
}

export async function runCover80(): Promise<boolean> {
  console.log("=== AITA GENAI COVER-80 (branch driver) ===");

  // ── 1. C-style normalizer: every keyword/symbol branch ──
  const cNorm = ASTNormalizer.normalize(CSTYLE_ALL_BRANCHES, "cpp");
  const cSet = new Set(cNorm.tokens.map((t) => t.token));
  for (const want of ["FUNC_DEF", "CLASS_DECL", "COND_STMT", "LOOP_STMT", "RETURN_STMT",
    "JUMP_STMT", "TRY_CATCH", "BIN_OP", "ASSIGN_OP", "CALL_EXPR", "LITERAL",
    "BLOCK_OPEN", "BLOCK_CLOSE", "VAR_DECL"]) {
    gate(cSet.has(want as any), `cstyle emits ${want}`);
  }
  gate(!cNorm.normalizedString.includes("block comment"), "cstyle strips block comments");
  gate(!cNorm.normalizedString.includes("single line"), "cstyle strips // comments");

  // ── 2. JS/TS path + Python full-keyword path ──
  const jsNorm = ASTNormalizer.normalize(`function hello(name) { return "hi " + name; }`, "typescript");
  gate(jsNorm.tokens.some((t) => t.token === "FUNC_DEF"), "jsts path emits FUNC_DEF");
  const pyNorm = ASTNormalizer.normalize(PY_ALL_BRANCHES, "python");
  const pySet = new Set(pyNorm.tokens.map((t) => t.token));
  for (const want of ["FUNC_DEF", "COND_STMT", "LOOP_STMT", "RETURN_STMT", "JUMP_STMT",
    "TRY_CATCH", "BIN_OP", "ASSIGN_OP", "CALL_EXPR", "LITERAL", "VAR_DECL"]) {
    gate(pySet.has(want as any), `python emits ${want}`);
  }
  gate(!pyNorm.normalizedString.includes("docstring"), "python strips docstrings");
  gate(!pyNorm.normalizedString.includes("hash comment"), "python strips # comments");
  const emptyNorm = ASTNormalizer.normalize("", "python");
  gate(emptyNorm.tokens.length === 0, "empty source yields zero tokens");

  // ── 3. Winnowing short-input + custom options ──
  const tiny = ASTNormalizer.normalize("x = 1", "python");
  const tinyFp = WinnowingEngine.computeFingerprints(tiny.tokens);
  gate(tinyFp.length === 1, "winnowing short-input single fingerprint", `got ${tinyFp.length}`);
  const customFp = WinnowingEngine.computeFingerprints(pyNorm.tokens, { kGramSize: 3, windowSize: 2 });
  gate(customFp.length > 0, "winnowing custom k/w fingerprints");
  const emptyFp = WinnowingEngine.computeFingerprints([]);
  gate(emptyFp.length === 0, "winnowing empty tokens zero fingerprints");

  // ── 4. Plagiarism edge paths: empty vs code, identical short ──
  const edgeRes = ASTPlagiarismEngine.compareSubmissions(
    { submissionId: "E1", sourceCode: "", language: "python" },
    { submissionId: "E2", sourceCode: "x = 1", language: "python" },
  );
  gate(typeof edgeRes.similarityRate === "number", "plagiarism empty-vs-code numeric similarity");
  const shortRes = ASTPlagiarismEngine.compareSubmissions(
    { submissionId: "S1", sourceCode: "x = 1", language: "python" },
    { submissionId: "S2", sourceCode: "x = 1", language: "python" },
  );
  gate(shortRes.similarityRate >= 99, "plagiarism identical short code ~100%", `got ${shortRes.similarityRate}`);

  // ── 5. OpenAI provider: schema success, HTTP-error retry, pool exhaustion ──
  const okRestore = mockFetchOnce(async () => new Response(JSON.stringify({
    model: "gpt-4o", choices: [{ message: { content: '{"clean_code_score": 8.0}' } }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  }), { status: 200, headers: { "Content-Type": "application/json" } }));
  try {
    const p = new OpenAIProvider(new KeyRotatorService(["k1", "k2"]));
    const r = await p.generateCompletion([{ role: "user", content: "review" }],
      { jsonSchema: CODE_REVIEW_JSON_SCHEMA as any, schemaName: "review" });
    gate(r.parsedJson !== undefined && r.usage?.total_tokens === 15, "openai schema success + usage mapping");
  } finally { okRestore(); }

  let calls = 0;
  const retryRestore = mockFetchOnce(async () => {
    calls++;
    if (calls === 1) return new Response("rate limited", { status: 429 });
    return new Response(JSON.stringify({ model: "m", choices: [{ message: { content: "recovered" } }] }),
      { status: 200, headers: { "Content-Type": "application/json" } });
  });
  // Mock setTimeout-driven backoff to instant to keep the test fast.
  const origSetTimeout = global.setTimeout;
  (global as any).setTimeout = ((fn: any, _ms?: any, ...a: any[]) => origSetTimeout(fn, 0, ...a)) as any;
  try {
    const p2 = new OpenAIProvider(new KeyRotatorService(["rk1", "rk2"]));
    const r2 = await p2.generateCompletion([{ role: "user", content: "hi" }]);
    gate(calls === 2 && r2.content === "recovered", "openai 429 retry then recovery");
  } finally { retryRestore(); (global as any).setTimeout = origSetTimeout; }

  const emptyPool = new OpenAIProvider(new KeyRotatorService([]));
  let poolThrew = false;
  // Empty pool throws before any fetch; guard with instant-timeout anyway.
  (global as any).setTimeout = ((fn: any, _ms?: any, ...a: any[]) => origSetTimeout(fn, 0, ...a)) as any;
  try {
    await emptyPool.generateCompletion([{ role: "user", content: "hi" }]);
  } catch { poolThrew = true; } finally { (global as any).setTimeout = origSetTimeout; }
  gate(poolThrew, "openai empty key pool throws");

  const badJsonRestore = mockFetchOnce(async () => new Response(JSON.stringify({
    model: "m", choices: [{ message: { content: "not-json{{{" } }],
  }), { status: 200, headers: { "Content-Type": "application/json" } }));
  try {
    const p3 = new OpenAIProvider(new KeyRotatorService(["jk1"]));
    const r3 = await p3.generateCompletion([{ role: "user", content: "x" }], { jsonSchema: CODE_REVIEW_JSON_SCHEMA as any });
    gate(r3.parsedJson === undefined && r3.content === "not-json{{{", "openai invalid JSON tolerated");
  } finally { badJsonRestore(); }

  // ── 6. Gemini provider: success + system instruction + retry ──
  let gemUrl = "";
  const gemRestore = mockFetchOnce(async (url) => {
    gemUrl = url;
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: '{"ok": true}' }] } }],
      usageMetadata: { promptTokenCount: 7, candidatesTokenCount: 3, totalTokenCount: 10 },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  try {
    const g = new GeminiProvider(new KeyRotatorService(["gk1"], ["gem-k1"]));
    const gr = await g.generateCompletion([
      { role: "system", content: "sys" },
      { role: "assistant", content: "prior" },
      { role: "user", content: "go" },
    ], { jsonSchema: CODE_REVIEW_JSON_SCHEMA as any });
    gate(gr.usage?.total_tokens === 10 && gr.parsedJson !== undefined, "gemini success + usage + schema");
    gate(gemUrl.includes("generateContent?key="), "gemini key in URL");
  } finally { gemRestore(); }

  let gCalls = 0;
  const gemRetryRestore = mockFetchOnce(async () => {
    gCalls++;
    if (gCalls === 1) return new Response("boom", { status: 500 });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "fine" }] } }] }),
      { status: 200, headers: { "Content-Type": "application/json" } });
  });
  (global as any).setTimeout = ((fn: any, _ms?: any, ...a: any[]) => origSetTimeout(fn, 0, ...a)) as any;
  try {
    const g2 = new GeminiProvider(new KeyRotatorService([], ["gem-r1", "gem-r2"]));
    const gr2 = await g2.generateCompletion([{ role: "user", content: "hi" }]);
    gate(gCalls === 2 && gr2.content === "fine", "gemini 500 retry then recovery");
  } finally { gemRetryRestore(); (global as any).setTimeout = origSetTimeout; }

  // ── 7. Schema adapters + validator reject paths ──
  const oaSchema = adaptSchemaForOpenAI(CODE_REVIEW_JSON_SCHEMA as any);
  gate(!!oaSchema && typeof oaSchema === "object", "openai schema adapter output");
  const gemSchema = adaptSchemaForGemini(CODE_REVIEW_JSON_SCHEMA as any);
  gate(!!gemSchema && typeof gemSchema === "object", "gemini schema adapter output");
  const badValidate = ReviewResponseValidator.validate("not json at all {{{");
  gate(badValidate.valid === false, "validator rejects non-JSON");
  const rangeValidate = ReviewResponseValidator.validate(JSON.stringify({ clean_code_score: 99, solid_score: 5, code_smells: [] }));
  gate(rangeValidate.valid === false, "validator rejects out-of-range score");

  // ── 8. Fallback chain + mock provider branches ──
  const fb = new FallbackProvider([new MockProvider()]);
  const fbRes = await fb.generateCompletion([{ role: "user", content: "GENERATE_EXAM topic sorting" }]);
  gate(!!fbRes.content, "fallback provider exam path");
  const mock = new MockProvider();
  const diag = await mock.generateCompletion([{ role: "user", content: "Compiler / Runtime Diagnostic: Segmentation fault at line 5" }]);
  gate(diag.model === "aita-mock-explainer-v1", "mock provider diagnostic branch");

  console.log(`---\nCOVER-80 GENAI: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

if (require.main === module) {
  runCover80().then((ok) => process.exit(ok ? 0 : 1));
}
