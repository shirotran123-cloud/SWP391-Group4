import { Injectable, Logger } from '@nestjs/common';
import { GenerateExamDto } from './dto/generate-exam.dto';
import {
  ExamGenerationResult,
  GeneratedExamShape,
  TestCaseSpec,
  RubricLevel,
  GradingRubricItem,
} from './exam.types';

const HUB_BASE_URL = process.env.GENAI_HUB_URL || 'http://localhost:3001';
const HUB_EXAM_ENDPOINT = `${HUB_BASE_URL}/api/v1/ai/generate-exam`;
const HUB_HEALTH_ENDPOINT = `${HUB_BASE_URL}/health`;

interface HubExamRaw {
  title?: string;
  courseCode?: string;
  difficulty?: string;
  language?: string;
  description?: string;
  problemStatement?: string;
  constraints?: string[];
  inputFormat?: string;
  outputFormat?: string;
  sampleTestCases?: TestCaseSpec[];
  hiddenTestCases?: TestCaseSpec[];
  rubric?: GradingRubricItem[];
  starterCode?: string;
  referenceSolution?: string;
}

/**
 * HTTP client for the GenAI Hub exam generator (UC-08).
 *
 * Follows the established gateway idiom (see queue/grading-worker.consumer.ts):
 * try the real hub with a hard timeout, and on any failure log a warning and
 * degrade to a local deterministic generator so the platform still works with
 * zero external services (no LLM key, no network, CI/demo machines).
 */
@Injectable()
export class ExamGeneratorClient {
  private readonly logger = new Logger(ExamGeneratorClient.name);

  public async generateExam(dto: GenerateExamDto): Promise<ExamGenerationResult> {
    const startedAt = Date.now();

    try {
      const response = await fetch(HUB_EXAM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: dto.topic,
          courseCode: dto.courseCode,
          difficulty: dto.difficulty,
          language: dto.language,
          learningOutcomes: dto.learningOutcomes || [],
          numTestCases: dto.numTestCases,
        }),
        signal: AbortSignal.timeout(20000),
      });

      if (!response.ok) {
        this.logger.warn(`[Workflow1] GenAI Hub tra ve HTTP ${response.status}. Fallback sang bo sinh de cuc bo.`);
      } else {
        const raw = (await response.json()) as HubExamRaw;
        const exam = this.normalizeHubExam(raw, dto);
        if (exam) {
          this.logger.log(`[Workflow1] Sinh de bang GenAI Hub THAT (${dto.courseCode}/${dto.topic}).`);
          return { exam, source: 'GENAI_HUB', latencyMs: Date.now() - startedAt };
        }
        this.logger.warn('[Workflow1] Phan hoi GenAI Hub thieu truong bat buoc. Fallback sang bo sinh de cuc bo.');
      }
    } catch (err: any) {
      this.logger.warn(`[Workflow1] GenAI Hub offline/timeout (${err.message}). Fallback sang bo sinh de cuc bo.`);
    }

    const exam = ExamGeneratorClient.buildDeterministicExam(dto);
    return { exam, source: 'LOCAL_DETERMINISTIC', latencyMs: Date.now() - startedAt };
  }

  public async isHubHealthy(): Promise<boolean> {
    try {
      const response = await fetch(HUB_HEALTH_ENDPOINT, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) return false;
      const body: any = await response.json();
      return body?.status === 'UP';
    } catch {
      return false;
    }
  }

  /** Coerces a hub payload into the gateway shape; returns null when unusable. */
  private normalizeHubExam(raw: HubExamRaw, dto: GenerateExamDto): GeneratedExamShape | null {
    if (!raw || typeof raw !== 'object' || !raw.title || !raw.problemStatement) return null;
    return {
      title: String(raw.title),
      courseCode: raw.courseCode || dto.courseCode,
      difficulty: (raw.difficulty || dto.difficulty) as GeneratedExamShape['difficulty'],
      language: raw.language || dto.language,
      description: raw.description || '',
      problemStatement: String(raw.problemStatement),
      constraints: Array.isArray(raw.constraints) ? raw.constraints : [],
      inputFormat: raw.inputFormat || '',
      outputFormat: raw.outputFormat || '',
      sampleTestCases: Array.isArray(raw.sampleTestCases) ? raw.sampleTestCases : [],
      hiddenTestCases: Array.isArray(raw.hiddenTestCases) ? raw.hiddenTestCases : [],
      rubric: Array.isArray(raw.rubric) ? raw.rubric : [],
      starterCode: raw.starterCode || '',
      referenceSolution: raw.referenceSolution || '',
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Offline deterministic fallback
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Offline deterministic fallback for demo/CI environments without an LLM key.
   *
   * Same DTO in always yields byte-identical output: the pseudo-random data is
   * derived from a stable FNV-1a hash of the DTO, never from Math.random() or
   * Date.now(), so generated assignments are reproducible and idempotent.
   */
  public static buildDeterministicExam(dto: GenerateExamDto): GeneratedExamShape {
    const difficulty = (dto.difficulty || 'MEDIUM') as GeneratedExamShape['difficulty'];
    const language = dto.language || 'python';
    const outcomes = (dto.learningOutcomes || []).filter((o) => !!o);
    const requested = Number.isFinite(dto.numTestCases as number) ? (dto.numTestCases as number) : 5;

    const hiddenCount = requested >= 5 ? 3 : requested >= 3 ? 2 : 1;
    const sampleCount = Math.max(3, Math.min(requested - hiddenCount, 5));

    const seed = ExamGeneratorClient.hashSeed(`${dto.courseCode}|${dto.topic}|${difficulty}|${language}`);
    const samples = ExamGeneratorClient.buildSampleCases(seed, sampleCount);
    const hidden = ExamGeneratorClient.buildHiddenCases(seed, hiddenCount);

    return {
      title: `[${difficulty}] ${dto.topic} - Bai kiem tra ${dto.courseCode}`,
      courseCode: dto.courseCode,
      difficulty,
      language,
      description:
        `Bai tap tu dong sinh cho mon ${dto.courseCode} voi chu de "${dto.topic}". ` +
        `Sinh vien phai phan tich yeu cau, cai dat loi giai toi uu bang ${language} va dam bao tat ca test case de bai deu vuot qua.`,
      problemStatement:
        `Cho day so nguyen gom N phan tu (chu de: ${dto.topic}). ` +
        `Hay tinh tong tich luy (prefix sum) cua day: voi moi vi tri i (0 <= i < N), ` +
        `xuat ra tong cua cac phan tu tu dau day den vi tri i. ` +
        `Chuong trinh phai chay trong gioi han thoi gian va bo nho cua he thong cham diem tu dong.`,
      constraints: [
        '0 <= N <= 100000',
        '-10^9 <= A[i] <= 10^9',
        'Ket qua co the vuot qua pham vi 32-bit, can dung 64-bit (hoac BigInt)',
        'Thoi gian chay toi da 2000ms, bo nho toi da 512MB',
      ],
      inputFormat: 'Dong dau tien: so nguyen N. Dong thu hai: N so nguyen cach nhau boi khoang trang.',
      outputFormat: 'Mot dong duy nhat gom N so nguyen la cac tong tich luy, cach nhau boi khoang trang.',
      sampleTestCases: samples,
      hiddenTestCases: hidden,
      rubric: ExamGeneratorClient.buildRubric(difficulty, outcomes),
      starterCode: ExamGeneratorClient.buildStarterCode(language, dto),
      referenceSolution: ExamGeneratorClient.buildReferenceSolution(language, dto),
    };
  }

  /** Stable FNV-1a 32-bit hash used to seed the deterministic data generator. */
  private static hashSeed(input: string): number {
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  /** LCG step; deterministic successor of a seed. */
  private static nextSeed(seed: number): number {
    return (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  }

  private static buildSampleCases(seed: number, count: number): TestCaseSpec[] {
    const sizes = [5, 4, 6, 3, 7];
    const cases: TestCaseSpec[] = [];
    let cursor = seed;
    for (let i = 0; i < count; i++) {
      const size = sizes[i % sizes.length];
      cursor = ExamGeneratorClient.nextSeed(cursor + i);
      const values: bigint[] = [];
      let inner = cursor;
      for (let k = 0; k < size; k++) {
        inner = ExamGeneratorClient.nextSeed(inner);
        const magnitude = BigInt(Number(inner % 41));
        values.push(k % 3 === 1 ? -magnitude : magnitude);
      }
      cursor = inner;
      cases.push({
        id: i + 1,
        input: `${size}\n${values.join(' ')}`,
        expectedOutput: ExamGeneratorClient.prefixSums(values),
        isHidden: false,
        weight: 1.0,
        explanation: `Vi du co ban ${i + 1}: N = ${size}, kiem tra tinh tong tich luy tren day co ca so am.`,
      });
    }
    return cases;
  }

  private static buildHiddenCases(seed: number, count: number): TestCaseSpec[] {
    const single = [BigInt(seed % 1000) - BigInt(500)];
    const zeros = [BigInt(0), BigInt(0), BigInt(0), BigInt(0)];
    const negative = [BigInt(-5), BigInt(-10), BigInt(-15), BigInt(-20), BigInt(-25), BigInt(-30)];
    const large = [BigInt(2147483647), BigInt(2147483647), BigInt(-2147483648), BigInt(1000000000)];
    const groups: { values: bigint[]; explanation: string }[] = [
      { values: single, explanation: 'Bien N = 1: truong hop toi thieu, khong duoc truy cap ngoai mang.' },
      { values: zeros, explanation: 'Mang toan so 0: kiem tra khoi tao bien tong dung gia tri ban dau.' },
      { values: negative, explanation: 'Mang toan so am: kiem tra khong dung kieu du lieu khong dau.' },
      { values: large, explanation: 'Gia tri bien 32-bit: tong vuot INT_MAX, bat buoc dung 64-bit/BigInt.' },
    ];
    const limit = Math.max(1, Math.min(count, groups.length));
    return groups.slice(0, limit).map((g, idx) => ({
      id: 100 + idx,
      input: `${g.values.length}\n${g.values.join(' ')}`,
      expectedOutput: ExamGeneratorClient.prefixSums(g.values),
      isHidden: true,
      weight: 2.0,
      explanation: g.explanation,
    }));
  }

  private static prefixSums(values: bigint[]): string {
    let running = BigInt(0);
    return values
      .map((v) => {
        running += v;
        return running.toString();
      })
      .join(' ');
  }

  /** Rubric whose maxScore values always sum to exactly 10.0. */
  private static buildRubric(difficulty: string, outcomes: string[]): GradingRubricItem[] {
    const outcomeHint = outcomes.length > 0 ? outcomes.join(', ') : 'phan tich yeu cau va cai dat thuat toan';
    const levels = (full: string, partial: string): RubricLevel[] => [
      { scorePercent: 100, description: full },
      { scorePercent: 50, description: partial },
      { scorePercent: 0, description: 'Khong dat yeu cau hoac chuong trinh bi loi bien dich.' },
    ];

    return [
      {
        criterion: 'Tinh dung dan (Correctness)',
        maxScore: 4.0,
        description: 'Chuong trinh vuot qua toan bo test case cong khai va test case an.',
        levels: levels('Tat ca test case deu PASS.', 'Chi pass cac test case co ban, sai o truong hop bien.'),
      },
      {
        criterion: 'Xu ly truong hop bien (Edge Cases)',
        maxScore: 2.0,
        description: 'Xu ly dung N = 0, N = 1, mang toan so am va tran so nguyen 32-bit.',
        levels: levels('Xu ly day du cac truong hop bien.', 'Bo sot mot vai truong hop bien.'),
      },
      {
        criterion: 'Do phuc tap thuat toan (Complexity)',
        maxScore: 1.5,
        description: `Do phuc tap mong doi O(N) voi muc do ${difficulty}.`,
        levels: levels('Dat do phuc tap O(N) va bo nho O(1).', 'Chay dung nhung do phuc tap cao hon O(N).'),
      },
      {
        criterion: 'Chat luong ma nguon & SOLID',
        maxScore: 1.5,
        description: `Ma nguon ro rang, dat chuan Clean Code: ${outcomeHint}.`,
        levels: levels('Ham ngan gon, ten bien y nghia, tach trach nhiem ro rang.', 'Ma nguon kho doc hoac lap nhieu doan.'),
      },
      {
        criterion: 'Tai lieu & giai thich (Documentation)',
        maxScore: 1.0,
        description: 'Co comment giai thich thuat toan va dinh dang input/output.',
        levels: levels('Tai lieu day du, de hieu.', 'Thieu comment o cac doan xu ly chinh.'),
      },
    ];
  }

  private static buildStarterCode(language: string, dto: GenerateExamDto): string {
    const lang = (language || 'python').toLowerCase();
    if (lang === 'java') {
      return [
        'import java.util.*;',
        '',
        `// UC-08 starter code - Topic: ${dto.topic}`,
        'public class Solution {',
        '    public static void main(String[] args) {',
        '        Scanner sc = new Scanner(System.in);',
        '        if (!sc.hasNextInt()) return;',
        '        int n = sc.nextInt();',
        '        long[] a = new long[n];',
        '        for (int i = 0; i < n; i++) a[i] = sc.nextLong();',
        '        // TODO: in ra n tong tich luy tren mot dong',
        '    }',
        '}',
      ].join('\n');
    }
    if (lang === 'cpp' || lang === 'c++') {
      return [
        '#include <iostream>',
        '#include <vector>',
        'using namespace std;',
        '',
        '// UC-08 starter code - Topic: ' + dto.topic,
        'int main() {',
        '    int n;',
        '    if (!(cin >> n)) return 0;',
        '    vector<long long> a(n);',
        '    for (int i = 0; i < n; i++) cin >> a[i];',
        '    // TODO: in ra n tong tich luy tren mot dong',
        '    return 0;',
        '}',
      ].join('\n');
    }
    if (lang === 'dotnet' || lang === 'csharp' || lang === 'c#') {
      return [
        'using System;',
        'using System.Linq;',
        '',
        `// UC-08 starter code - Topic: ${dto.topic}`,
        'public class Solution {',
        '    public static void Main() {',
        '        var n = int.Parse(Console.ReadLine().Trim());',
        '        var a = Console.ReadLine().Split(\' \').Select(long.Parse).ToArray();',
        '        // TODO: in ra n tong tich luy tren mot dong',
        '    }',
        '}',
      ].join('\n');
    }
    if (lang === 'javascript' || lang === 'js' || lang === 'nodejs') {
      return [
        'const fs = require("fs");',
        '',
        `// UC-08 starter code - Topic: ${dto.topic}`,
        'function main() {',
        '  const lines = fs.readFileSync(0, "utf-8").trim().split(/\\s+/);',
        '  const n = Number(lines[0]);',
        '  const a = lines.slice(1, 1 + n).map(BigInt);',
        '  // TODO: in ra n tong tich luy tren mot dong',
        '}',
        'main();',
      ].join('\n');
    }
    return [
      'import sys',
      '',
      `# UC-08 starter code - Topic: ${dto.topic}`,
      'def main() -> None:',
      '    data = sys.stdin.read().split()',
      '    if not data:',
      '        return',
      '    n = int(data[0])',
      '    a = [int(x) for x in data[1:1 + n]]',
      '    # TODO: in ra n tong tich luy tren mot dong',
      '',
      '',
      'if __name__ == "__main__":',
      '    main()',
    ].join('\n');
  }

  private static buildReferenceSolution(language: string, dto: GenerateExamDto): string {
    const lang = (language || 'python').toLowerCase();
    if (lang === 'java') {
      return [
        'import java.util.*;',
        '',
        `// UC-08 reference solution - Topic: ${dto.topic}`,
        'public class Solution {',
        '    public static void main(String[] args) {',
        '        Scanner sc = new Scanner(System.in);',
        '        if (!sc.hasNextInt()) return;',
        '        int n = sc.nextInt();',
        '        StringBuilder sb = new StringBuilder();',
        '        long running = 0L;',
        '        for (int i = 0; i < n; i++) {',
        '            running += sc.nextLong();',
        '            if (i > 0) sb.append(\' \');',
        '            sb.append(running);',
        '        }',
        '        System.out.println(sb.toString());',
        '    }',
        '}',
      ].join('\n');
    }
    if (lang === 'cpp' || lang === 'c++') {
      return [
        '#include <iostream>',
        'using namespace std;',
        '',
        '// UC-08 reference solution - Topic: ' + dto.topic,
        'int main() {',
        '    ios::sync_with_stdio(false);',
        '    cin.tie(nullptr);',
        '    int n;',
        '    if (!(cin >> n)) return 0;',
        '    long long running = 0;',
        '    for (int i = 0; i < n; i++) {',
        '        long long x;',
        '        cin >> x;',
        '        running += x;',
        '        if (i > 0) cout << \' \';',
        '        cout << running;',
        '    }',
        '    cout << \'\\n\';',
        '    return 0;',
        '}',
      ].join('\n');
    }
    if (lang === 'dotnet' || lang === 'csharp' || lang === 'c#') {
      return [
        'using System;',
        'using System.Linq;',
        '',
        `// UC-08 reference solution - Topic: ${dto.topic}`,
        'public class Solution {',
        '    public static void Main() {',
        '        var first = Console.ReadLine();',
        '        if (string.IsNullOrWhiteSpace(first)) return;',
        '        var n = int.Parse(first.Trim());',
        '        var a = Console.ReadLine().Split(\' \').Select(long.Parse).ToArray();',
        '        long running = 0;',
        '        var parts = new string[n];',
        '        for (int i = 0; i < n; i++) {',
        '            running += a[i];',
        '            parts[i] = running.ToString();',
        '        }',
        '        Console.WriteLine(string.Join(" ", parts));',
        '    }',
        '}',
      ].join('\n');
    }
    if (lang === 'javascript' || lang === 'js' || lang === 'nodejs') {
      return [
        'const fs = require("fs");',
        '',
        `// UC-08 reference solution - Topic: ${dto.topic}`,
        'function main() {',
        '  const tokens = fs.readFileSync(0, "utf-8").trim().split(/\\s+/);',
        '  const n = Number(tokens[0]);',
        '  let running = 0n;',
        '  const out = [];',
        '  for (let i = 0; i < n; i++) {',
        '    running += BigInt(tokens[i + 1]);',
        '    out.push(running.toString());',
        '  }',
        '  process.stdout.write(out.join(" ") + "\\n");',
        '}',
        'main();',
      ].join('\n');
    }
    return [
      'import sys',
      '',
      `# UC-08 reference solution - Topic: ${dto.topic}`,
      'def main() -> None:',
      '    data = sys.stdin.read().split()',
      '    if not data:',
      '        return',
      '    n = int(data[0])',
      '    running = 0',
      '    out = []',
      '    for i in range(n):',
      '        running += int(data[1 + i])',
      '        out.append(str(running))',
      '    print(" ".join(out))',
      '',
      '',
      'if __name__ == "__main__":',
      '    main()',
    ].join('\n');
  }
}
