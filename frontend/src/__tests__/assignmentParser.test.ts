import { describe, it, expect } from 'vitest';
import { parseAssignmentDescription } from '../utils/assignmentParser';

/**
 * The lecturer pastes a free-form problem statement and this parser extracts the structured
 * fields the form needs. A regression here silently discards a lecturer's specification, so
 * each heading the parser recognises is pinned, and unknown text must survive as prose rather
 * than being dropped.
 */
describe('parseAssignmentDescription', () => {
  // The parser keys off these exact headings (see the patterns in assignmentParser.ts).
  const FULL = `
Cho một dãy số nguyên, hãy tính tổng của dãy.

Yêu cầu kỹ thuật:
1. Đọc dữ liệu từ stdin, không đọc từ file.
2. Tính tổng bằng vòng lặp tuyến tính.
3. In kết quả ra stdout.

Định dạng Đầu vào:
- Dòng 1: số nguyên N.
- Dòng 2: N số nguyên cách nhau bởi dấu cách.

Định dạng Đầu ra:
- In ra tổng của dãy trên một dòng.

Ràng buộc:
- 1 <= N <= 100000
- -10^6 <= a[i] <= 10^6
`;

  it('returns a complete shape for empty input', () => {
    const parsed = parseAssignmentDescription('');
    expect(parsed.overview).toBeTruthy();
    expect(Array.isArray(parsed.inputFormat)).toBe(true);
    expect(Array.isArray(parsed.outputFormat)).toBe(true);
    expect(Array.isArray(parsed.constraints)).toBe(true);
    expect(Array.isArray(parsed.technicalRequirements)).toBe(true);
    expect(Array.isArray(parsed.tags)).toBe(true);
  });

  it('extracts the overview from the text before the first heading', () => {
    const parsed = parseAssignmentDescription(FULL);
    expect(parsed.overview).toContain('dãy số');
  });

  it('extracts the technical requirements as separate items', () => {
    const parsed = parseAssignmentDescription(FULL);
    expect(parsed.technicalRequirements.length).toBeGreaterThanOrEqual(2);
    const joined = parsed.technicalRequirements.join(' ');
    expect(joined.toLowerCase()).toContain('stdin');
  });

  it('extracts the input format lines', () => {
    const parsed = parseAssignmentDescription(FULL);
    expect(parsed.inputFormat.length).toBeGreaterThanOrEqual(1);
    expect(parsed.inputFormat.join(' ')).toContain('N');
  });

  it('extracts the output format lines', () => {
    const parsed = parseAssignmentDescription(FULL);
    expect(parsed.outputFormat.length).toBeGreaterThanOrEqual(1);
    expect(parsed.outputFormat.join(' ').toLowerCase()).toContain('tổng');
  });

  it('extracts the constraints', () => {
    const parsed = parseAssignmentDescription(FULL);
    expect(parsed.constraints.length).toBeGreaterThanOrEqual(1);
    expect(parsed.constraints.join(' ')).toContain('100000');
  });

  it('does not let a constraint leak into the output format', () => {
    const parsed = parseAssignmentDescription(FULL);
    expect(parsed.outputFormat.join(' ')).not.toContain('100000');
  });

  it('produces a short summary', () => {
    const parsed = parseAssignmentDescription(FULL);
    expect(typeof parsed.shortSummary).toBe('string');
    expect(parsed.shortSummary.length).toBeGreaterThan(0);
  });

  it('does not throw on free-form text with no headings', () => {
    expect(() => parseAssignmentDescription('chỉ là một câu bình thường')).not.toThrow();
  });

  it('keeps unheaded text as the overview', () => {
    const parsed = parseAssignmentDescription('Viết chương trình in ra Hello World.');
    expect(parsed.overview).toContain('Hello World');
    expect(parsed.inputFormat).toEqual([]);
  });

  it('does not throw when only headings are present', () => {
    expect(() =>
      parseAssignmentDescription('Định dạng Đầu vào:\nRàng buộc:\nĐịnh dạng Đầu ra:'),
    ).not.toThrow();
  });

  it('tolerates CRLF line endings', () => {
    const parsed = parseAssignmentDescription(FULL.replace(/\n/g, '\r\n'));
    expect(parsed.overview).toContain('dãy số');
    expect(parsed.constraints.join(' ')).toContain('100000');
  });

  it('accepts the English headings too', () => {
    const english = `
Compute the sum of an array.

Input Format:
- First line: N.

Output Format:
- The total.

Constraints:
- 1 <= N <= 1000
`;
    const parsed = parseAssignmentDescription(english);
    expect(parsed.inputFormat.length).toBeGreaterThanOrEqual(1);
    expect(parsed.constraints.join(' ')).toContain('1000');
  });

  it('returns arrays for every list field (never undefined)', () => {
    for (const text of ['', 'x', FULL]) {
      const parsed = parseAssignmentDescription(text);
      for (const field of [
        'technicalRequirements',
        'inputFormat',
        'outputFormat',
        'constraints',
        'tags',
      ] as const) {
        expect(Array.isArray(parsed[field])).toBe(true);
      }
    }
  });
});
