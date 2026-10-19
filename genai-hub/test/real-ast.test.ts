/**
 * Unit tests for the real Python `ast` parser bridge.
 *
 * These run as part of the hub suite so the Milestone 2 requirement — "AST Parser (sử dụng
 * Python `ast` module)" — stays enforced by CI rather than by a benchmark someone remembers to
 * run. They are skipped with a clear message when no Python interpreter is present, instead of
 * failing the suite for an environment reason.
 *
 * Run: npx ts-node --transpile-only test/real-ast.test.ts
 */
import {
  parsePythonSources,
  isRealAstAvailable,
  mapPythonNodeToToken,
} from '../src/ast-engine/real-ast-parser';
import { ASTPlagiarismEngine, CodeSubmission } from '../src/ast-engine/plagiarism-engine';

let passed = 0;
let failed = 0;

function check(ok: boolean, label: string, detail?: unknown): void {
  if (ok) {
    passed++;
    console.log(`[PASS] ${label}`);
  } else {
    failed++;
    console.error(`[FAIL] ${label}${detail !== undefined ? ` -> ${JSON.stringify(detail)}` : ''}`);
  }
}

const mk = (id: string, code: string, language = 'python'): CodeSubmission => ({
  submissionId: id,
  studentName: id,
  sourceCode: code,
  language,
  filePath: 'main.py',
});

export async function runRealAstTests(): Promise<boolean> {
  passed = 0;
  failed = 0;

  console.log('\n=== Real Python AST parser (Milestone 2) ===');

  const available = await isRealAstAvailable();

  // ── The node -> token mapping is pure, so it is testable without Python ──
  check(mapPythonNodeToToken('FunctionDef') === 'FUNC_DEF', 'FunctionDef maps to FUNC_DEF');
  check(mapPythonNodeToToken('AsyncFunctionDef') === 'FUNC_DEF', 'AsyncFunctionDef maps to FUNC_DEF');
  check(mapPythonNodeToToken('ClassDef') === 'CLASS_DECL', 'ClassDef maps to CLASS_DECL');
  check(mapPythonNodeToToken('For') === 'LOOP_STMT', 'For maps to LOOP_STMT');
  check(mapPythonNodeToToken('While') === 'LOOP_STMT', 'While maps to LOOP_STMT');
  check(mapPythonNodeToToken('If') === 'COND_STMT', 'If maps to COND_STMT');
  check(mapPythonNodeToToken('Try') === 'TRY_CATCH', 'Try maps to TRY_CATCH');
  check(mapPythonNodeToToken('Return') === 'RETURN_STMT', 'Return maps to RETURN_STMT');
  check(mapPythonNodeToToken('Call') === 'CALL_EXPR', 'Call maps to CALL_EXPR');
  check(mapPythonNodeToToken('Constant') === 'LITERAL', 'Constant maps to LITERAL');
  check(mapPythonNodeToToken('BinOp:Add') === 'BIN_OP', 'a BinOp operator maps to BIN_OP');
  check(mapPythonNodeToToken('Add') === 'BIN_OP', 'Add maps to BIN_OP');
  check(mapPythonNodeToToken('Not') === 'UN_OP', 'Not maps to UN_OP');
  check(mapPythonNodeToToken('Module') === 'BLOCK_OPEN', 'Module maps to BLOCK_OPEN');
  // An unknown node must be dropped rather than guessed at, or unrelated code would appear similar.
  check(mapPythonNodeToToken('SomeNodeThatDoesNotExist') === null, 'an unknown node maps to null');

  if (!available) {
    console.log('[SKIP] No Python interpreter found — the parse tests cannot run.');
    console.log('       Set PYTHON_BIN to a Python 3 executable to enable them.');
    console.log(`\nREAL-AST: ${passed} passed, ${failed} failed (parse tests skipped)`);
    return failed === 0;
  }

  // ── Real parsing ──
  const simple = await parsePythonSources({
    a: 'def f(x):\n    return x + 1\n',
    b: 'def g(y):\n    return y + 1\n',
  });
  check(simple !== null, 'parsePythonSources returns a result');
  if (simple) {
    check(simple.a.ok === true, 'valid Python parses successfully');
    check(simple.a.tokens.length > 0, 'tokens were produced', simple.a.tokens.length);
    check(simple.a.nodeCount > 0, 'the node count was reported', simple.a.nodeCount);
    check(simple.a.maxDepth > 0, 'the tree depth was reported', simple.a.maxDepth);

    // The core rename-invariance property: same structure, different names.
    const typesA = simple.a.tokens.map((t) => t.token).join(' ');
    const typesB = simple.b.tokens.map((t) => t.token).join(' ');
    check(typesA === typesB, 'renaming every identifier yields an identical token stream', {
      a: typesA,
      b: typesB,
    });

    // A real parse tree means a syntax error is detected, not silently tokenised.
    const broken = await parsePythonSources({ bad: 'def broken(:\n    return' });
    check(broken?.bad.ok === false, 'invalid Python is reported as a parse failure');
    check(!!broken?.bad.error, 'the parse failure carries an error message', broken?.bad.error);

    // A structurally different program must NOT produce the same stream.
    const different = await parsePythonSources({
      loop: 'for i in range(3):\n    print(i)\n',
      cond: 'if x:\n    print(x)\n',
    });
    if (different) {
      const loopTypes = different.loop.tokens.map((t) => t.token).join(' ');
      const condTypes = different.cond.tokens.map((t) => t.token).join(' ');
      check(loopTypes !== condTypes, 'a loop and a conditional produce different token streams');
    }

    // Type annotations, decorators and async must not crash the walker.
    const exotic = await parsePythonSources({
      decorated: '@staticmethod\ndef f(x: int) -> int:\n    return x\n',
      asyncFn: 'import asyncio\nasync def g():\n    await asyncio.sleep(1)\n',
      matchStmt: 'match x:\n    case 1:\n        pass\n',
      comprehension: 'y = [i * 2 for i in range(10) if i % 2 == 0]\n',
    });
    if (exotic) {
      check(exotic.decorated.ok === true, 'a decorated function with annotations parses');
      check(exotic.asyncFn.ok === true, 'async/await parses');
      check(exotic.matchStmt.ok === true, 'a match statement parses');
      check(exotic.comprehension.ok === true, 'a comprehension parses');
    }

    check(
      (await parsePythonSources({})) !== null,
      'an empty request is handled without crashing',
    );
  }

  // ── The engine integration ──
  const original = `
def calculate_total(values):
    result = 0
    for value in values:
        result = result + value
    return result
`;
  const disguised = `
def compute_sum(items):
    accumulator = 0
    for entry in items:
        accumulator = accumulator + entry
    return accumulator
`;

  const withAst = await ASTPlagiarismEngine.compareSubmissionsWithRealAst(
    mk('A', original),
    mk('B', disguised),
  );
  check(withAst.astSource === 'PYTHON_AST', 'Python pairs are judged by the real AST', withAst.astSource);
  check(withAst.similarityRate >= 70, 'a renamed copy is still flagged', withAst.similarityRate);

  // A non-Python language must fall back rather than be forced through a Python parser.
  const java = await ASTPlagiarismEngine.compareSubmissionsWithRealAst(
    mk('A', 'public class A { void f() {} }', 'java'),
    mk('B', 'public class B { void g() {} }', 'java'),
  );
  check(
    java.astSource === 'REGEX_FALLBACK',
    'non-Python submissions fall back to the regex tokeniser',
    java.astSource,
  );

  // Unparseable Python must also fall back, not produce a confident wrong verdict.
  const broken = await ASTPlagiarismEngine.compareSubmissionsWithRealAst(
    mk('A', original),
    mk('B', 'def broken(:\n    return'),
  );
  check(
    broken.astSource === 'REGEX_FALLBACK',
    'a syntax error falls back instead of guessing',
    broken.astSource,
  );

  // The class matrix must report which engine judged the cohort.
  const matrix = await ASTPlagiarismEngine.computeClassSimilarityMatrixWithRealAst([
    mk('A', original),
    mk('B', disguised),
    mk('C', 'class Tree:\n    def __init__(self):\n        self.root = None\n'),
  ]);
  check(matrix.astSource === 'PYTHON_AST', 'the class matrix uses the real AST', matrix.astSource);
  check(matrix.totalSubmissions === 3, 'the matrix covers every submission', matrix.totalSubmissions);
  check(matrix.totalPairsCompared === 3, 'the matrix compares every pair', matrix.totalPairsCompared);
  check(matrix.similarityMatrix.length === 3, 'the matrix is square');

  console.log(`\nREAL-AST: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

if (require.main === module) {
  runRealAstTests()
    .then((ok) => {
      if (!ok) process.exitCode = 1;
    })
    .catch((err) => {
      console.error('Suite crashed:', err);
      process.exitCode = 1;
    });
}
