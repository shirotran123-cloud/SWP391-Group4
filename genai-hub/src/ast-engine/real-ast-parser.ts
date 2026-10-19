import { execFile } from 'node:child_process';
import * as path from 'node:path';
import { NormalizedToken, NormalizedTokenType } from './ast-normalizer';

/**
 * Real AST parsing for Python, delegated to Python's own `ast` module.
 *
 * Milestone 2 of the RBL syllabus requires an AST parser built on *"Python's `ast` module for
 * Python source, or Roslyn for C#"*. `ASTNormalizer` tokenises with regular expressions: it
 * produces AST-*shaped* labels (`FUNC_DEF`, `RETURN_STMT`) without ever building a parse tree,
 * so it cannot distinguish a genuinely rewritten program from one whose surface spelling merely
 * changed.
 *
 * This bridge spawns `ast_parser.py`, which walks the real tree with `ast.walk` and emits one
 * record per structural node. The result is mapped onto the existing `NormalizedToken` shape so
 * every caller — the Winnowing engine, the plagiarism ensemble, the persisted fingerprints —
 * keeps working unchanged.
 *
 * The parse is delegated rather than reimplemented in TypeScript on purpose: writing a
 * Python grammar by hand would be a second, subtly different parser, and "which parser is
 * right" is not a question a grading system should have two answers to.
 */

export interface RealAstParseResult {
  /** True when Python parsed the source successfully. */
  ok: boolean;
  /** Structural tokens in source order; empty when parsing failed. */
  tokens: NormalizedToken[];
  /** Number of nodes in the tree, a rough measure of program size. */
  nodeCount: number;
  /** Maximum nesting depth, which distinguishes a flat script from nested logic. */
  maxDepth: number;
  /** Parse error text when `ok` is false. */
  error?: string;
  /** How long the parse took, for the performance budget. */
  elapsedMs: number;
}

/** Python AST node class -> the token vocabulary the rest of the engine already speaks. */
const PYTHON_NODE_TO_TOKEN: Record<string, NormalizedTokenType> = {
  FunctionDef: 'FUNC_DEF',
  AsyncFunctionDef: 'FUNC_DEF',
  Lambda: 'FUNC_DEF',
  ClassDef: 'CLASS_DECL',

  arg: 'PARAM_DECL',
  Assign: 'VAR_DECL',
  AnnAssign: 'VAR_DECL',
  AugAssign: 'VAR_DECL',
  NamedExpr: 'VAR_DECL',
  Global: 'VAR_DECL',
  Nonlocal: 'VAR_DECL',

  If: 'COND_STMT',
  IfExp: 'COND_STMT',
  Match: 'COND_STMT',
  match_case: 'COND_STMT',

  For: 'LOOP_STMT',
  AsyncFor: 'LOOP_STMT',
  While: 'LOOP_STMT',
  comprehension: 'LOOP_STMT',
  ListComp: 'LOOP_STMT',
  SetComp: 'LOOP_STMT',
  DictComp: 'LOOP_STMT',
  GeneratorExp: 'LOOP_STMT',

  Try: 'TRY_CATCH',
  TryStar: 'TRY_CATCH',
  ExceptHandler: 'TRY_CATCH',
  With: 'TRY_CATCH',
  AsyncWith: 'TRY_CATCH',
  Raise: 'TRY_CATCH',
  Assert: 'TRY_CATCH',

  Return: 'RETURN_STMT',
  Yield: 'RETURN_STMT',
  YieldFrom: 'RETURN_STMT',

  Break: 'JUMP_STMT',
  Continue: 'JUMP_STMT',
  Pass: 'JUMP_STMT',
  Delete: 'JUMP_STMT',

  Call: 'CALL_EXPR',
  Await: 'CALL_EXPR',

  Constant: 'LITERAL',

  Module: 'BLOCK_OPEN',
};

/** BinOp operator classes collapse into a single BIN_OP token. */
const BIN_OP_NODES = new Set([
  'Add', 'Sub', 'Mult', 'Div', 'FloorDiv', 'Mod', 'Pow',
  'LShift', 'RShift', 'BitOr', 'BitXor', 'BitAnd', 'MatMult',
]);

/** Unary and comparison operators. */
const UNARY_OP_NODES = new Set(['UAdd', 'USub', 'Not', 'Invert']);
const COMPARE_OP_NODES = new Set([
  'Eq', 'NotEq', 'Lt', 'LtE', 'Gt', 'GtE', 'Is', 'IsNot', 'In', 'NotIn',
]);

/**
 * Structural operators: the *shape* of an expression tree, which the token vocabulary has no
 * dedicated slot for. They are emitted as distinct canonical strings so `a+b` and `a-b` do not
 * collapse into the same stream, while still being cast to the shared union type.
 */
const EXPR_STRUCTURE_NODES = new Set([
  'Expr', 'BinOp', 'UnaryOp', 'BoolOp', 'Compare', 'Subscript', 'Slice', 'Attribute',
  'Tuple', 'List', 'Set', 'Dict', 'Starred', 'JoinedStr', 'FormattedValue',
  'Import', 'ImportFrom', 'keyword', 'alias', 'arguments', 'Load', 'Store', 'Name',
]);

interface RawToken {
  type: string;
  line: number | null;
}

interface RawResult {
  ok: boolean;
  tokens?: RawToken[];
  nodeCount?: number;
  maxDepth?: number;
  error?: string;
}

const PARSER_SCRIPT = path.resolve(__dirname, 'ast_parser.py');

// A parse is a pure tree walk over a source file capped at 10 MB by the upload limit; anything
// approaching this ceiling means Python itself is wedged, so kill it rather than hold the worker.
const PARSE_TIMEOUT_MS = 15_000;

/**
 * Parses Python sources with the real `ast` module.
 *
 * Batched deliberately: spawning one Python process per submission would dominate the grading
 * cost, so all sources for one comparison are sent in a single round trip.
 *
 * Returns `null` when Python is unavailable, which lets the caller fall back to the regex
 * normaliser instead of failing the whole grading run.
 */
export async function parsePythonSources(
  sources: Record<string, string>,
): Promise<Record<string, RealAstParseResult> | null> {
  const started = Date.now();

  const payload = JSON.stringify({ language: 'python', sources });

  const stdout = await new Promise<string | null>((resolve) => {
    const child = execFile(
      process.env.PYTHON_BIN || 'python',
      [PARSER_SCRIPT],
      { timeout: PARSE_TIMEOUT_MS, maxBuffer: 32 * 1024 * 1024 },
      (error, out) => {
        // A non-zero exit still carries usable stdout only if Python printed JSON; treat any
        // spawn failure (python missing, script absent) as "unavailable" so the caller degrades.
        if (error && !out) {
          resolve(null);
          return;
        }
        resolve(out);
      },
    );
    if (child.stdin) {
      child.stdin.on('error', () => {
        /* the child may exit before we finish writing; the callback reports the real error */
      });
      child.stdin.end(payload, 'utf8');
    }
  });

  if (!stdout) return null;

  let parsed: { ok?: boolean; results?: Record<string, RawResult> };
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return null;
  }
  if (!parsed || parsed.ok !== true || !parsed.results) return null;

  const elapsedMs = Date.now() - started;
  const out: Record<string, RealAstParseResult> = {};

  for (const [key, raw] of Object.entries(parsed.results)) {
    if (!raw || raw.ok !== true) {
      out[key] = {
        ok: false,
        tokens: [],
        nodeCount: 0,
        maxDepth: 0,
        error: raw?.error || 'Python could not parse this source',
        elapsedMs,
      };
      continue;
    }
    out[key] = {
      ok: true,
      tokens: mapTokens(raw.tokens || []),
      nodeCount: raw.nodeCount || 0,
      maxDepth: raw.maxDepth || 0,
      elapsedMs,
    };
  }

  return out;
}

/**
 * Converts Python AST node names into the shared token vocabulary.
 *
 * Unmapped nodes are dropped rather than guessed at: inventing a token for a node the engine
 * does not model would add noise to the fingerprint set and inflate similarity between
 * unrelated programs.
 */
function mapTokens(rawTokens: RawToken[]): NormalizedToken[] {
  const mapped: NormalizedToken[] = [];

  for (const raw of rawTokens) {
    const tokenType = toTokenType(raw.type);
    if (!tokenType) continue;

    const line = raw.line ?? 1;
    mapped.push({
      token: tokenType,
      lineStart: line,
      lineEnd: line,
      colStart: 0,
      colEnd: 0,
      // Kept so a lecturer reading the diff can see which construct matched.
      originalSnippet: raw.type,
    });
  }

  return mapped;
}

function toTokenType(pythonNode: string): NormalizedTokenType | null {
  const direct = PYTHON_NODE_TO_TOKEN[pythonNode];
  if (direct) return direct;

  // `BinOp:Add` style entries from the parser carry their operator in the name.
  if (pythonNode.startsWith('BinOp:')) return 'BIN_OP';
  if (pythonNode.startsWith('CmpOp:')) return 'BIN_OP';

  if (BIN_OP_NODES.has(pythonNode)) return 'BIN_OP';
  if (UNARY_OP_NODES.has(pythonNode)) return 'UN_OP';
  if (COMPARE_OP_NODES.has(pythonNode)) return 'BIN_OP';
  if (EXPR_STRUCTURE_NODES.has(pythonNode)) return 'CALL_EXPR';

  return null;
}

/** Exposed for tests: the mapping table, without needing to spawn Python. */
export function mapPythonNodeToToken(pythonNode: string): NormalizedTokenType | null {
  return toTokenType(pythonNode);
}

/** True when a real Python interpreter is reachable, so callers can decide up front. */
export async function isRealAstAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(
      process.env.PYTHON_BIN || 'python',
      ['-c', 'import ast; print("ok")'],
      { timeout: 5000 },
      (error) => resolve(!error),
    );
  });
}
