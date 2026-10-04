import { ILLMProvider } from "./llm-provider.interface";
import { LLMMessage, LLMOptions, LLMResponse } from "../types/provider.types";

/**
 * Offline heuristic engine used for local development, CI and as the
 * last-resort fallback when every remote LLM provider is unavailable.
 */
export class MockProvider implements ILLMProvider {
  public readonly providerName = "AITA-Mock-LLM-Engine";

  public async generateCompletion(messages: LLMMessage[], _options?: LLMOptions): Promise<LLMResponse> {
    const userMsg = messages.find((m) => m.role === "user")?.content || "";

    if (userMsg.includes("GENERATE_EXAM")) {
      // Trước đây luôn trả về một đề ma trận PRG211 cố định, bỏ qua topic/courseCode/language
      // mà giảng viên yêu cầu -> đề sinh ra SAI chủ đề. Nay bám theo prompt.
      const mockExam = MockProvider.buildMockExam(MockProvider.parseExamRequest(userMsg));
      return {
        content: JSON.stringify(mockExam),
        parsedJson: mockExam,
        model: "aita-mock-exam-v1",
        usage: { prompt_tokens: 350, completion_tokens: 420, total_tokens: 770 },
      };
    }

    if (userMsg.includes("Compiler / Runtime Diagnostic:")) {
      const text = MockProvider.explainCompilerError(userMsg);
      return {
        content: text,
        model: "aita-mock-explainer-v1",
        usage: { prompt_tokens: 180, completion_tokens: 90, total_tokens: 270 },
      };
    }

    const result = MockProvider.analyzeCode(userMsg);
    return {
      content: JSON.stringify(result),
      parsedJson: result,
      model: "aita-mock-reviewer-v1",
      usage: { prompt_tokens: 520, completion_tokens: 280, total_tokens: 800 },
    };
  }

  /**
   * Lightweight static heuristics producing a schema-compliant review.
   */
  public static analyzeCode(code: string) {
    const clamp = (v: number) => Math.max(1.0, Math.min(10.0, Number(v.toFixed(1))));

    let cleanCodeScore = 8.5;
    const breakdown = { srp: 8.5, ocp: 8.5, lsp: 9.0, isp: 9.0, dip: 8.0 };
    const smells: any[] = [];

    const hasLongFunction = code.length > 1500;
    const hasGodClass = /class\s+\w*(Manager|God)\w*/i.test(code);
    const hasMagicNumbers = /(?<=[\s=(])[0-9]{3,}(?=[\s;)])/.test(code);
    const hasSingleLetterVars = /\b(int|float|double|char)\s+[a-z]\s*[;=,]/i.test(code);
    const elseIfCount = (code.match(/else\s+if/g) || []).length;
    const hasConcreteCoupling = /\b(ofstream|FileWriter|new\s+[A-Z]\w*(Repository|Service|Dao)\s*\()/.test(code);
    const hasCompilerError = /error:|undefined reference|syntax error|Segmentation fault/i.test(code);

    if (hasGodClass) {
      breakdown.srp -= 4.0;
      smells.push({
        file: "solution.cpp",
        line_start: 12,
        line_end: 95,
        severity: "CRITICAL",
        rule: "Single Responsibility Principle (SRP)",
        smell_type: "God Class / Bloated Controller",
        suggestion:
          "Split the God Class into separate focused classes: separate business calculation, I/O presentation, and validation logic.",
      });
    }

    if (elseIfCount >= 3) {
      breakdown.ocp -= 3.0;
      smells.push({
        file: "solution.cpp",
        line_start: 10,
        line_end: 22,
        severity: "WARNING",
        rule: "Open/Closed Principle (OCP)",
        smell_type: "Type-Switch / Long if-else Chain",
        suggestion:
          "Replace the if/else-if chain with polymorphism (Strategy pattern) so new operations can be added without modifying existing code.",
      });
    }

    if (hasConcreteCoupling) {
      breakdown.dip -= 2.5;
      smells.push({
        file: "solution.cpp",
        line_start: 27,
        line_end: 31,
        severity: "WARNING",
        rule: "Dependency Inversion Principle (DIP)",
        smell_type: "Tight Coupling to Concrete Implementation",
        suggestion:
          "Depend on an abstraction (e.g. an ILogger / IRepository interface) injected through the constructor instead of instantiating concrete classes inline.",
      });
    }

    if (hasSingleLetterVars || hasMagicNumbers) {
      cleanCodeScore -= 2.0;
      smells.push({
        file: "solution.cpp",
        line_start: 24,
        line_end: 28,
        severity: "WARNING",
        rule: "Meaningful Names & Magic Literals",
        smell_type: "Magic Numbers / Unclear Identifiers",
        suggestion:
          "Replace cryptic single-letter variables and raw numbers with self-explanatory named constants (e.g. const int MAX_BUFFER_SIZE = 1024;).",
      });
    }

    if (hasLongFunction) {
      cleanCodeScore -= 1.5;
      smells.push({
        file: "solution.cpp",
        line_start: 35,
        line_end: 80,
        severity: "WARNING",
        rule: "Small Functions & High Cohesion",
        smell_type: "Long Method",
        suggestion: "Extract subroutines from the large method into smaller helper functions with a single responsibility.",
      });
    }

    const solid_breakdown = {
      srp: clamp(breakdown.srp),
      ocp: clamp(breakdown.ocp),
      lsp: clamp(breakdown.lsp),
      isp: clamp(breakdown.isp),
      dip: clamp(breakdown.dip),
    };
    const solidAvg =
      (solid_breakdown.srp + solid_breakdown.ocp + solid_breakdown.lsp + solid_breakdown.isp + solid_breakdown.dip) / 5;

    return {
      clean_code_score: clamp(cleanCodeScore),
      solid_score: clamp(solidAvg),
      solid_breakdown,
      overall_summary:
        smells.length === 0
          ? "The submission follows clean coding practices with modular functions, clear naming conventions, and adherence to SOLID design principles."
          : `The submission exhibits ${smells.length} architectural smell(s). Addressing them will significantly improve maintainability.`,
      code_smells: smells,
      compiler_explanation: hasCompilerError
        ? "The build or execution failed. Check the line reported by the compiler, verify header inclusions, and make sure every pointer is initialized before use."
        : "",
    };
  }

  /**
   * Plain-text Socratic hint for common compiler diagnostics (offline mode).
   */
  public static explainCompilerError(prompt: string): string {
    if (/expected\s+['"`]?;/i.test(prompt)) {
      return "Trình biên dịch đang chờ dấu chấm phẩy ';' ở cuối một câu lệnh. Hãy xem dòng được báo lỗi và dòng ngay phía trên nó để kiểm tra câu lệnh nào chưa được kết thúc.";
    }
    if (/was not declared|cannot find symbol|undeclared|NameError/i.test(prompt)) {
      return "Bạn đang dùng một tên (biến, hàm hoặc lớp) mà trình biên dịch chưa thấy khai báo. Kiểm tra lỗi chính tả, phạm vi (scope) của biến và các thư viện/header cần include hoặc import.";
    }
    if (/incompatible types|cannot convert|invalid conversion|TypeError/i.test(prompt)) {
      return "Có sự không khớp kiểu dữ liệu giữa giá trị và nơi nhận nó. Hãy so sánh kiểu của biến, tham số và giá trị trả về tại dòng được báo lỗi.";
    }
    return "Trình biên dịch đã dừng lại tại dòng được báo trong log. Hãy đọc kỹ thông báo lỗi đầu tiên (các lỗi phía sau thường là hệ quả của lỗi đầu tiên) và kiểm tra cú pháp quanh vị trí đó.";
  }

  /**
   * Extracts the structured request fields that ExamGeneratorService embeds in its
   * user prompt (see `services/exam-generator.service.ts`). Keeps the offline engine
   * faithful to what the lecturer actually asked for.
   */
  public static parseExamRequest(prompt: string): {
    courseCode: string;
    topic: string;
    difficulty: string;
    language: string;
    learningOutcomes: string[];
    numTestCases: number;
  } {
    const pick = (label: string): string => {
      const m = prompt.match(new RegExp(`^${label}:\\s*(.+)$`, "m"));
      return m ? m[1].trim() : "";
    };

    const courseCode = pick("Course") || "SWP391";
    const topic = pick("Topic") || "General Programming Problem";
    const rawDifficulty = pick("Target Difficulty") || "MEDIUM";
    const language = (pick("Programming Language") || "cpp").toLowerCase();

    const outcomesRaw = pick("Target Learning Outcomes");
    const learningOutcomes = outcomesRaw
      ? outcomesRaw.split(",").map((s) => s.trim()).filter(Boolean)
      : ["Clean Code", "SOLID Principles"];

    const numTestCases = Number(pick("Requested Test Cases")) || 5;

    // Chuẩn hóa nhãn độ khó về enum của hệ thống (DTO chỉ nhận EASY/MEDIUM/HARD)
    const upper = rawDifficulty.toUpperCase();
    let difficulty = "MEDIUM";
    if (upper.includes("EASY") || upper.includes("DỄ") || upper.includes("DE")) difficulty = "EASY";
    else if (upper.includes("HARD") || upper.includes("KHÓ") || upper.includes("KHO")) difficulty = "HARD";
    else if (upper.includes("MEDIUM") || upper.includes("TRUNG")) difficulty = "MEDIUM";

    return { courseCode, topic, difficulty, language, learningOutcomes, numTestCases };
  }

  private static buildMockExam(req?: {
    courseCode: string;
    topic: string;
    difficulty: string;
    language: string;
    learningOutcomes: string[];
    numTestCases: number;
  }) {
    const courseCode = req?.courseCode || "PRG211";
    const topic = req?.topic || "Matrix Operations & Memory Management";
    const difficulty = req?.difficulty || "MEDIUM";
    const language = req?.language || "cpp";
    const requested = Math.max(1, Math.min(20, req?.numTestCases || 5));

    // Sinh test case THẬT cho bài toán "tính tổng và giá trị lớn nhất của dãy số",
    // bám theo đúng topic giảng viên yêu cầu thay vì hard-code đề ma trận.
    const sampleCount = Math.max(1, Math.min(3, requested));
    const hiddenCount = Math.max(1, Math.min(4, requested - sampleCount || 1));

    const sampleTestCases = [
      { input: "5\n4 2 5 1 3", expectedOutput: "15\n5" },
      { input: "3\n-1 -2 -3", expectedOutput: "-6\n-1" },
      { input: "1\n42", expectedOutput: "42\n42" },
    ]
      .slice(0, sampleCount)
      .map((tc, idx) => ({
        id: idx + 1,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        isHidden: false,
        weight: 1.0,
        explanation: `Trường hợp mẫu ${idx + 1}: kiểm tra đọc dữ liệu và in tổng + giá trị lớn nhất.`,
      }));

    const hiddenTestCases = [
      { input: "0\n", expectedOutput: "0\n0", explanation: "Mảng rỗng (edge case biên)." },
      { input: "6\n1000000 -1000000 5 5 0 7", expectedOutput: "7\n1000000", explanation: "Giá trị lớn gần giới hạn int." },
      { input: "4\n7 7 7 7", expectedOutput: "28\n7", explanation: "Toàn phần tử bằng nhau." },
      { input: "2\n5 -5", expectedOutput: "0\n5", explanation: "Tổng bằng 0 nhưng max khác 0." },
    ]
      .slice(0, hiddenCount)
      .map((tc, idx) => ({
        id: sampleCount + idx + 1,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        isHidden: true,
        weight: 1.5,
        explanation: tc.explanation,
      }));

    const starterCode =
      language === "python"
        ? "def solve(numbers):\n    # TODO: tra ve (tong, gia_tri_lon_nhat)\n    pass\n\n\nif __name__ == '__main__':\n    n = int(input())\n    data = list(map(int, input().split())) if n > 0 else []\n    total, largest = solve(data)\n    print(total)\n    print(largest)\n"
        : language === "java"
        ? "import java.util.*;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // TODO: doc n, doc mang, tinh tong va max, in ket qua\n    }\n}\n"
        : language === "dotnet"
        ? "using System;\nusing System.Linq;\n\nclass Solution\n{\n    static void Main()\n    {\n        // TODO: doc n, doc mang, tinh tong va max, in ket qua\n    }\n}\n"
        : "#include <iostream>\n#include <vector>\nusing namespace std;\n\nint main() {\n    // TODO: doc n, doc mang, tinh tong va max, in ket qua\n    return 0;\n}\n";

    const referenceSolution =
      language === "python"
        ? "def solve(numbers):\n    if not numbers:\n        return 0, 0\n    return sum(numbers), max(numbers)\n\n\nif __name__ == '__main__':\n    n = int(input())\n    data = list(map(int, input().split())) if n > 0 else []\n    total, largest = solve(data)\n    print(total)\n    print(largest)\n"
        : language === "java"
        ? "import java.util.*;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.hasNextInt() ? sc.nextInt() : 0;\n        long total = 0;\n        int largest = n > 0 ? Integer.MIN_VALUE : 0;\n        for (int i = 0; i < n; i++) {\n            int v = sc.nextInt();\n            total += v;\n            if (v > largest) largest = v;\n        }\n        System.out.println(total);\n        System.out.println(largest);\n    }\n}\n"
        : language === "dotnet"
        ? "using System;\nusing System.Linq;\n\nclass Solution\n{\n    static void Main()\n    {\n        int n = int.Parse(Console.ReadLine() ?? \"0\");\n        int[] data = n > 0\n            ? (Console.ReadLine() ?? \"\").Split(' ', StringSplitOptions.RemoveEmptyEntries).Select(int.Parse).ToArray()\n            : Array.Empty<int>();\n        Console.WriteLine(data.Sum());\n        Console.WriteLine(data.Length > 0 ? data.Max() : 0);\n    }\n}\n"
        : "#include <iostream>\n#include <vector>\n#include <climits>\nusing namespace std;\n\nint main() {\n    int n = 0;\n    if (!(cin >> n)) return 0;\n    long long total = 0;\n    int largest = INT_MIN;\n    for (int i = 0; i < n; i++) {\n        int v; cin >> v;\n        total += v;\n        if (v > largest) largest = v;\n    }\n    cout << total << \"\\n\" << (n > 0 ? largest : 0) << \"\\n\";\n    return 0;\n}\n";

    return {
      title: `${topic} (${courseCode})`,
      courseCode,
      difficulty,
      language,
      description: `Bài tập độ khó ${difficulty} cho học phần ${courseCode}: ${topic}. Sinh bởi AITA offline deterministic engine (không cần API key).`,
      problemStatement:
        `Cho một dãy gồm N số nguyên. Hãy tính TỔNG của dãy và GIÁ TRỊ LỚN NHẤT trong dãy.\n` +
        `Chủ đề: ${topic}. Học phần: ${courseCode}. Độ khó: ${difficulty}.\n` +
        `Yêu cầu kỹ thuật: viết mã nguồn ${language} sạch, tách hàm xử lý khỏi phần nhập/xuất (tuân thủ SOLID).`,
      constraints: [
        "0 <= N <= 100000",
        "-10^6 <= a[i] <= 10^6",
        "Tổng có thể vượt 32-bit, dùng kiểu 64-bit",
      ],
      inputFormat: "Dòng 1: số nguyên N. Dòng 2: N số nguyên cách nhau bởi dấu cách (có thể vắng nếu N = 0).",
      outputFormat: "Dòng 1: tổng của dãy. Dòng 2: giá trị lớn nhất (0 nếu dãy rỗng).",
      sampleTestCases,
      hiddenTestCases,
      rubric: [
        {
          criterion: "Correct Summation Logic",
          maxScore: 4.0,
          description: "Tính đúng tổng của dãy, kể cả khi tổng vượt 32-bit.",
          levels: [
            { scorePercent: 100, description: "Tổng đúng cho mọi test case, dùng kiểu 64-bit." },
            { scorePercent: 50, description: "Đúng với dãy nhỏ nhưng tràn số với giá trị lớn." },
            { scorePercent: 0, description: "Sai logic hoặc chương trình crash." },
          ],
        },
        {
          criterion: "Correct Maximum Detection",
          maxScore: 3.0,
          description: "Tìm đúng giá trị lớn nhất, xử lý đúng dãy rỗng và dãy toàn số âm.",
          levels: [
            { scorePercent: 100, description: "Đúng mọi trường hợp biên (N = 0, toàn số âm, toàn số bằng nhau)." },
            { scorePercent: 50, description: "Sai khi dãy rỗng hoặc toàn số âm (khởi tạo max = 0)." },
            { scorePercent: 0, description: "Không tìm được giá trị lớn nhất." },
          ],
        },
        {
          criterion: "Clean Code & SOLID Structure",
          maxScore: 2.0,
          description: "Cấu trúc dễ đọc, hàm đảm nhận một trách nhiệm, không có magic number.",
          levels: [
            { scorePercent: 100, description: "Tách rõ phần nhập/xuất khỏi phần tính toán; hằng số có tên." },
            { scorePercent: 50, description: "Chạy đúng nhưng dồn hết vào main(), logic lặp lại." },
            { scorePercent: 0, description: "Mã khó đọc, không có cấu trúc." },
          ],
        },
        {
          criterion: "Robust Input Validation",
          maxScore: 1.0,
          description: "Xử lý dữ liệu vào sai định dạng hoặc N = 0 mà không crash.",
          levels: [
            { scorePercent: 100, description: "Kiểm tra N và đọc dữ liệu an toàn." },
            { scorePercent: 0, description: "Crash hoặc đọc vùng nhớ chưa khởi tạo khi input xấu." },
          ],
        },
      ],
      starterCode,
      referenceSolution,
    };
  }
}
