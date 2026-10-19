/**
 * Proves the real Python `ast` parser beats the regex tokeniser on disguised code.
 *
 * The Milestone 2 P2P exercise is explicit: an opponent takes a sample program, uses generative
 * AI to disguise it — renaming every variable and function, rewriting comments, reordering some
 * functions — and submits it. The plagiarism engine must still report >80% similarity.
 *
 * This compares both engines on the same pairs so the claim is measured, not asserted:
 *
 *   • PYTHON_AST     — walks the genuine parse tree
 *   • REGEX_FALLBACK — the previous regex tokeniser
 *
 * Each pair is a real disguise of the same program. A pair the real parser catches and the
 * regex parser misses is the concrete justification for the change.
 *
 * Run: npx ts-node --transpile-only test/run-real-ast-benchmark.ts
 */
import { ASTPlagiarismEngine, CodeSubmission } from '../src/ast-engine/plagiarism-engine';
import { isRealAstAvailable } from '../src/ast-engine/real-ast-parser';

interface Pair {
  name: string;
  disguise: string;
  original: string;
  disguised: string;
  /**
   * True when this pair matches the transformations the syllabus actually specifies for the
   * P2P exercise. Those are the ones the >80% requirement applies to. Pairs marked `false` are
   * harder than the requirement and are reported separately rather than used to fail it —
   * inflating the bar would be as dishonest as lowering it.
   */
  requiredBySyllabus: boolean;
}

const mk = (id: string, code: string): CodeSubmission => ({
  submissionId: id,
  studentName: id,
  sourceCode: code,
  language: 'python',
  filePath: 'main.py',
});

const PAIRS: Pair[] = [
  {
    name: 'Identifier renaming',
    disguise: 'every variable and function renamed',
    requiredBySyllabus: true,
    original: `
def calculate_factorial(n):
    if n <= 1:
        return 1
    total_result = n * calculate_factorial(n - 1)
    return total_result

def process_numbers(num_list):
    results = []
    for item in num_list:
        val = calculate_factorial(item)
        results.append(val)
    return results
`,
    disguised: `
def compute_fact(x_val):
    if x_val <= 1:
        return 1
    acc_product = x_val * compute_fact(x_val - 1)
    return acc_product

def handle_values(collection):
    output = []
    for entry in collection:
        computed = compute_fact(entry)
        output.append(computed)
    return output
`,
  },
  {
    name: 'Function reordering',
    disguise: 'the two functions swapped order',
    requiredBySyllabus: true,
    original: `
def read_input(path):
    with open(path) as handle:
        return handle.read().split()

def summarise(tokens):
    total = 0
    for token in tokens:
        total += int(token)
    return total
`,
    disguised: `
def summarise(tokens):
    total = 0
    for token in tokens:
        total += int(token)
    return total

def read_input(path):
    with open(path) as handle:
        return handle.read().split()
`,
  },
  {
    name: 'Comment rewriting and reformatting',
    disguise: 'comments replaced, blank lines changed',
    requiredBySyllabus: true,
    original: `
# Calculate the factorial of a number
def fact(n):
    if n <= 1:
        return 1
    return n * fact(n - 1)
`,
    disguised: `
# Computes the factorial value for the given input
def fact(n):
    if n <= 1:
        return 1

    return n * fact(n - 1)
`,
  },
  {
    name: 'Alias renaming with same structure',
    disguise: 'imports aliased, loop variable renamed',
    requiredBySyllabus: true,
    original: `
import sys

def main():
    data = sys.stdin.read().split()
    values = [int(x) for x in data]
    print(sum(values))

main()
`,
    disguised: `
import sys as system

def start():
    payload = system.stdin.read().split()
    numbers = [int(n) for n in payload]
    print(sum(numbers))

start()
`,
  },
  {
    name: 'Loop form rewritten (for -> while)',
    disguise: 'a for loop replaced by an equivalent while loop',
    requiredBySyllabus: false,
    original: `
def total_of(items):
    result = 0
    for value in items:
        result = result + value
    return result
`,
    disguised: `
def identify(items):
    accumulator = 0
    index = 0
    while index < len(items):
        accumulator = accumulator + items[index]
        index = index + 1
    return accumulator
`,
  },
  {
    name: 'Genuine control: unrelated program',
    disguise: 'NOT a disguise — a different program must score low',
    requiredBySyllabus: false,
    original: `
def total_of(items):
    result = 0
    for value in items:
        result = result + value
    return result
`,
    disguised: `
class BinarySearchTree:
    def __init__(self):
        self.root = None

    def insert(self, key):
        if self.root is None:
            self.root = {"key": key, "left": None, "right": None}
            return self.root
        node = self.root
        while True:
            if key < node["key"]:
                if node["left"] is None:
                    node["left"] = {"key": key, "left": None, "right": None}
                    return node["left"]
                node = node["left"]
            else:
                if node["right"] is None:
                    node["right"] = {"key": key, "left": None, "right": None}
                    return node["right"]
                node = node["right"]
`,
  },
];

function bar(value: number): string {
  const filled = Math.max(0, Math.min(20, Math.round(value / 5)));
  return '#'.repeat(filled).padEnd(20, '.');
}

async function main(): Promise<void> {
  const pythonAvailable = await isRealAstAvailable();

  console.log('='.repeat(78));
  console.log('REAL AST PARSER vs REGEX TOKENISER — DISGUISED CODE DETECTION');
  console.log('='.repeat(78));
  console.log(`  Python interpreter available : ${pythonAvailable ? 'YES' : 'NO'}`);
  console.log('  Threshold for FLAGGED        : 70%');
  console.log('  Milestone 2 requirement      : detect a GenAI disguise at > 80%');
  console.log();

  if (!pythonAvailable) {
    console.log('  SKIPPING: no Python interpreter, so the real-AST path cannot run.');
    console.log('  The regex fallback is what the system would use in that state.');
    process.exitCode = 1;
    return;
  }

  console.log('Pair                                  | REAL AST | REGEX    | Delta  | Bar (AST)');
  console.log('-'.repeat(78));

  // The syllabus specifies three transformations: rename every variable and function, rewrite
  // comments, reorder some functions. The >80% requirement applies to those. The for->while
  // rewrite is a strictly harder case added on purpose, reported separately so it can neither
  // fail the requirement nor flatter the result.
  let requiredAstTotal = 0;
  let requiredRegexTotal = 0;
  let requiredCount = 0;
  let requiredAstMin = 100;
  let requiredRegexMin = 100;

  let extraAstTotal = 0;
  let extraRegexTotal = 0;
  let extraCount = 0;

  let controlAst = 0;
  let controlRegex = 0;

  for (const pair of PAIRS) {
    const real = await ASTPlagiarismEngine.compareSubmissionsWithRealAst(
      mk('A', pair.original),
      mk('B', pair.disguised),
    );
    const regex = ASTPlagiarismEngine.compareSubmissions(
      mk('A', pair.original),
      mk('B', pair.disguised),
    );

    const isControl = pair.name.startsWith('Genuine control');
    if (isControl) {
      controlAst = real.similarityRate;
      controlRegex = regex.similarityRate;
    } else if (pair.requiredBySyllabus) {
      requiredAstTotal += real.similarityRate;
      requiredRegexTotal += regex.similarityRate;
      requiredCount++;
      requiredAstMin = Math.min(requiredAstMin, real.similarityRate);
      requiredRegexMin = Math.min(requiredRegexMin, regex.similarityRate);
    } else {
      extraAstTotal += real.similarityRate;
      extraRegexTotal += regex.similarityRate;
      extraCount++;
    }

    const delta = real.similarityRate - regex.similarityRate;
    const tag = isControl ? ' (control)' : pair.requiredBySyllabus ? '' : ' (extra)';
    console.log(
      `${(pair.name + tag).padEnd(37)} | ${real.similarityRate.toFixed(2).padStart(7)}% | ` +
        `${regex.similarityRate.toFixed(2).padStart(7)}% | ` +
        `${(delta >= 0 ? '+' : '') + delta.toFixed(2)}`.padStart(6) +
        ` | ${bar(real.similarityRate)}`,
    );
    console.log(`    engine used: ${real.astSource}`);
  }

  const requiredAstAvg = requiredCount ? requiredAstTotal / requiredCount : 0;
  const requiredRegexAvg = requiredCount ? requiredRegexTotal / requiredCount : 0;
  const extraAstAvg = extraCount ? extraAstTotal / extraCount : 0;
  const extraRegexAvg = extraCount ? extraRegexTotal / extraCount : 0;

  console.log();
  console.log('='.repeat(78));
  console.log('SUMMARY');
  console.log('='.repeat(78));
  console.log(`  A) Disguises the syllabus specifies (${requiredCount} pairs, target > 80%)`);
  console.log(`     REAL AST  average : ${requiredAstAvg.toFixed(2)}%   lowest ${requiredAstMin.toFixed(2)}%`);
  console.log(`     REGEX     average : ${requiredRegexAvg.toFixed(2)}%   lowest ${requiredRegexMin.toFixed(2)}%`);
  console.log(
    `     Improvement       : ${(requiredAstAvg - requiredRegexAvg >= 0 ? '+' : '') + (requiredAstAvg - requiredRegexAvg).toFixed(2)} points`,
  );
  if (extraCount) {
    console.log();
    console.log(`  B) Harder case beyond the requirement (${extraCount} pair, reported, not required)`);
    console.log(`     REAL AST  average : ${extraAstAvg.toFixed(2)}%`);
    console.log(`     REGEX     average : ${extraRegexAvg.toFixed(2)}%`);
    console.log(
      `     Improvement       : ${(extraAstAvg - extraRegexAvg >= 0 ? '+' : '') + (extraAstAvg - extraRegexAvg).toFixed(2)} points`,
    );
  }
  console.log();
  console.log('  C) Control — an unrelated program must stay below the 70% flag');
  console.log(`     REAL AST : ${controlAst.toFixed(2)}%  -> ${controlAst >= 70 ? 'FALSE POSITIVE' : 'correctly below threshold'}`);
  console.log(`     REGEX    : ${controlRegex.toFixed(2)}%  -> ${controlRegex >= 70 ? 'FALSE POSITIVE' : 'correctly below threshold'}`);

  const failures: string[] = [];
  if (requiredAstMin < 80) {
    failures.push(
      `REAL AST dropped to ${requiredAstMin.toFixed(2)}% on a syllabus-specified disguise, below the 80% requirement`,
    );
  }
  if (controlAst >= 70) {
    failures.push(`REAL AST flagged an unrelated program at ${controlAst.toFixed(2)}% (false positive)`);
  }

  console.log();
  if (failures.length === 0) {
    console.log('  RESULT: PASS');
    console.log(`    - every syllabus-specified disguise scored >= 80% (lowest ${requiredAstMin.toFixed(2)}%)`);
    console.log('    - no false positive on the unrelated control');
    console.log('    The Milestone 2 "AST Plagiarism Bypass" exercise is satisfied by the real parser.');
  } else {
    console.log('  RESULT: FAIL');
    for (const f of failures) console.log(`    - ${f}`);
    process.exitCode = 1;
  }
  console.log('='.repeat(78));
}

main().catch((err) => {
  console.error('Benchmark crashed:', err);
  process.exitCode = 1;
});
