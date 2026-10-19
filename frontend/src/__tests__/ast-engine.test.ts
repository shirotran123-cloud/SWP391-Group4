import { describe, it, expect } from 'vitest';
import { ASTNormalizer } from '../services/ast-engine/ast-normalizer';
import { ASTPlagiarismEngine, type CodeSubmission } from '../services/ast-engine/plagiarism-engine';

/**
 * The AST normalizer feeds the client-side plagiarism engine, so its contract matters: two
 * submissions that differ only in formatting, comments or identifier names must normalize to
 * the SAME token stream. That is what makes the check robust against cosmetic disguise.
 */
describe('ASTNormalizer', () => {
  it('returns a normalised string and a token list', () => {
    const result = ASTNormalizer.normalize('int a = 1;', 'cpp');
    expect(typeof result.normalizedString).toBe('string');
    expect(Array.isArray(result.tokens)).toBe(true);
  });

  it('strips line comments', () => {
    const result = ASTNormalizer.normalize('int a = 1; // this is a comment', 'cpp');
    // `normalizedString` is the token-type stream, so a comment can never contribute a token.
    expect(result.normalizedString).not.toContain('comment');
    expect(result.normalizedString.length).toBeGreaterThan(0);
  });

  it('strips block comments', () => {
    const result = ASTNormalizer.normalize('int a = 1; /* block comment here */ int b = 2;', 'cpp');
    expect(result.normalizedString).not.toContain('block comment');
  });

  it('strips a Python docstring', () => {
    const code = 'def f():\n    """This is a docstring."""\n    return 1\n';
    const result = ASTNormalizer.normalize(code, 'python');
    expect(result.normalizedString).not.toContain('docstring');
    // The function body still contributes a return statement, proving the code survived.
    expect(result.normalizedString).toContain('RETURN_STMT');
  });

  it('strips a Python hash comment', () => {
    const result = ASTNormalizer.normalize('x = 1  # hash comment\n', 'python');
    expect(result.normalizedString).not.toContain('hash comment');
  });

  it('removes a function name so renaming cannot hide a copy', () => {
    const result = ASTNormalizer.normalize('def add_numbers(a, b):\n    return a + b\n', 'python');
    expect(result.normalizedString).not.toContain('add_numbers');
  });

  it('normalizes two cosmetically different functions to the same string', () => {
    const a = ASTNormalizer.normalize('def f(a,b):\n    return a+b\n', 'python');
    const b = ASTNormalizer.normalize('def g(x, y):\n    return x + y\n', 'python');
    // Identifiers and punctuation spacing are normalised away, so the streams should agree.
    expect(a.normalizedString.replace(/\s+/g, '')).toBe(b.normalizedString.replace(/\s+/g, ''));
  });

  it('works for every supported language', () => {
    for (const lang of ['cpp', 'c', 'java', 'python', 'dotnet']) {
      const result = ASTNormalizer.normalize('int main() { return 0; }', lang);
      expect(typeof result.normalizedString).toBe('string');
    }
  });

  it('does not throw on empty input', () => {
    expect(() => ASTNormalizer.normalize('', 'python')).not.toThrow();
  });

  it('returns no tokens for empty source', () => {
    expect(ASTNormalizer.normalize('', 'python').tokens).toEqual([]);
  });

  it('tags each token with a type and a line number', () => {
    const result = ASTNormalizer.normalize('int a = 1;\nint b = 2;', 'cpp');
    expect(result.tokens.length).toBeGreaterThan(0);
    for (const t of result.tokens) {
      expect(typeof t.token).toBe('string');
      expect(typeof t.lineStart).toBe('number');
      expect(t.lineStart).toBeGreaterThan(0);
    }
  });

  it('records more than one line when the source spans several', () => {
    const result = ASTNormalizer.normalize('int a = 1;\nint b = 2;\nint c = 3;', 'cpp');
    const lines = new Set(result.tokens.map((t) => t.lineStart));
    expect(lines.size).toBeGreaterThan(1);
  });

  it('defaults to Python when no language is given', () => {
    const result = ASTNormalizer.normalize('x = 1\n');
    expect(Array.isArray(result.tokens)).toBe(true);
  });
});

/**
 * The plagiarism engine turns two normalised programs into a similarity decision. The tests
 * pin the three zones the UI depends on: identical, clearly different, and the review band.
 */
describe('ASTPlagiarismEngine.compareSubmissions', () => {
  const mk = (id: string, code: string, studentId = 'SE1'): CodeSubmission => ({
    submissionId: id,
    studentName: studentId,
    studentId,
    sourceCode: code,
    language: 'python',
    filePath: 'main',
  });

  const BASE = `
def read_numbers(text):
    parts = text.split()
    if not parts:
        return []
    n = int(parts[0])
    return [int(x) for x in parts[1:1 + n]]


def solve(values):
    total = 0
    largest = None
    for value in values:
        total += value
        if largest is None or value > largest:
            largest = value
    return total, largest
`;

  it('reports a high similarity for identical code', () => {
    const result = ASTPlagiarismEngine.compareSubmissions(mk('A', BASE), mk('B', BASE, 'SE2'));
    expect(result.similarityRate).toBeGreaterThanOrEqual(80);
    expect(result.isFlagged).toBe(true);
  });

  it('reports a low similarity for unrelated code', () => {
    const other = `
class Queue:
    def __init__(self):
        self.items = []
    def push(self, item):
        self.items.append(item)
    def pop(self):
        return self.items.pop(0)
`;
    const result = ASTPlagiarismEngine.compareSubmissions(mk('A', BASE), mk('B', other, 'SE2'));
    expect(result.similarityRate).toBeLessThan(70);
    expect(result.isFlagged).toBe(false);
  });

  it('still detects a copy that only renamed identifiers and added comments', () => {
    const disguised = `
# renamed everything and reformatted
def parse_tokens(text):
    chunks = text.split()
    if not chunks:
        return []
    count = int(chunks[0])
    return [int(v) for v in chunks[1:1 + count]]


def compute(items):
    summed = 0
    biggest = None
    for item in items:
        summed = summed + item
        if biggest is None or item > biggest:
            biggest = item
    return summed, biggest
`;
    const result = ASTPlagiarismEngine.compareSubmissions(mk('A', BASE), mk('B', disguised, 'SE2'));
    expect(result.similarityRate).toBeGreaterThan(50);
  });

  it('exposes the similarity components the UI shows', () => {
    const result = ASTPlagiarismEngine.compareSubmissions(mk('A', BASE), mk('B', BASE, 'SE2'));
    expect(typeof result.matchedTokensJson.jaccardSimilarity).toBe('number');
    expect(typeof result.matchedTokensJson.winnowingContainment).toBe('number');
    expect(typeof result.matchedTokensJson.astStructuralSimilarity).toBe('number');
  });

  it('assigns a status string consistent with the flag', () => {
    const high = ASTPlagiarismEngine.compareSubmissions(mk('A', BASE), mk('B', BASE, 'SE2'));
    expect(typeof high.status).toBe('string');
    expect(high.status.length).toBeGreaterThan(0);
    if (high.isFlagged) {
      expect(high.status).toContain('FLAGGED');
    }
  });

  it('reports the compared submission ids', () => {
    const result = ASTPlagiarismEngine.compareSubmissions(mk('AAA', BASE), mk('BBB', BASE, 'SE2'));
    expect([result.submissionAId, result.submissionBId].sort()).toEqual(['AAA', 'BBB']);
  });

  it('does not throw when both inputs are empty', () => {
    expect(() => ASTPlagiarismEngine.compareSubmissions(mk('A', ''), mk('B', '', 'SE2'))).not.toThrow();
  });

  it('does not throw when one input is empty', () => {
    expect(() => ASTPlagiarismEngine.compareSubmissions(mk('A', BASE), mk('B', '', 'SE2'))).not.toThrow();
  });

  it('handles a single short snippet', () => {
    const result = ASTPlagiarismEngine.compareSubmissions(mk('A', 'print(1)'), mk('B', 'print(1)', 'SE2'));
    expect(typeof result.similarityRate).toBe('number');
  });
});
