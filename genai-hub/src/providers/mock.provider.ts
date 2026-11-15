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
      const mockExam = MockProvider.buildMockExam();
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
        rule: "Nguyên lý Đóng/Mở (OCP)",
        smell_type: "Type-Switch / Chuỗi if-else dài",
        suggestion:
          "Nên thay thế chuỗi if/else-if bằng tính đa hình (mẫu thiết kế Strategy Pattern) để có thể mở rộng nghiệp vụ mới mà không cần chỉnh sửa mã nguồn hiện tại.",
      });
    }

    if (hasConcreteCoupling) {
      breakdown.dip -= 2.5;
      smells.push({
        file: "solution.cpp",
        line_start: 27,
        line_end: 31,
        severity: "WARNING",
        rule: "Nguyên lý Đảo ngược Phụ thuộc (DIP)",
        smell_type: "Phụ thuộc trực tiếp vào cài đặt cụ thể",
        suggestion:
          "Nên phụ thuộc vào trừu tượng (Interface IService / IRepository) được truyền qua Constructor (Dependency Injection) thay vì khởi tạo lớp cụ thể trực tiếp.",
      });
    }

    if (hasSingleLetterVars || hasMagicNumbers) {
      cleanCodeScore -= 2.0;
      smells.push({
        file: "solution.cpp",
        line_start: 24,
        line_end: 28,
        severity: "WARNING",
        rule: "Quy chuẩn đặt tên & Hằng số (Clean Code)",
        smell_type: "Số ma thuật / Đặt tên biến khó hiểu",
        suggestion:
          "Hãy thay thế các biến ký tự đơn và số thô bằng các hằng số có tên tự giải thích (ví dụ: final int MAX_BUFFER_SIZE = 1024;).",
      });
    }

    if (hasLongFunction) {
      cleanCodeScore -= 1.5;
      smells.push({
        file: "solution.cpp",
        line_start: 35,
        line_end: 80,
        severity: "WARNING",
        rule: "Tính đơn trách nhiệm (Single Responsibility)",
        smell_type: "Phương thức quá dài (Long Method)",
        suggestion: "Hãy trích xuất các hàm con nhỏ hơn để đảm bảo mỗi hàm chỉ thực hiện một nhiệm vụ duy nhất (Single Responsibility).",
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
          ? "Mã nguồn tuân thủ xuất sắc các tiêu chuẩn Clean Code với cấu trúc hàm rõ ràng, quy tắc đặt tên tường minh và áp dụng chuẩn xác 5 nguyên lý thiết kế SOLID."
          : `Mã nguồn còn tồn tại ${smells.length} điểm kiến trúc cần cải thiện (Code Smell). Khắc phục các điểm này sẽ giúp mã nguồn dễ bảo trì, rõ ràng và mở rộng tốt hơn.`,
      code_smells: smells,
      compiler_explanation: hasCompilerError
        ? "Quá trình biên dịch hoặc thực thi phát sinh lỗi. Hãy kiểm tra các thông báo lỗi và dòng mã nguồn tương ứng."
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

  private static buildMockExam() {
    return {
      title: "Matrix Operations & Memory Management",
      courseCode: "PRG211",
      difficulty: "MEDIUM",
      language: "cpp",
      description: "Implement a dynamic 2D Matrix calculator supporting addition and transposition.",
      problemStatement:
        "Write a program that accepts a matrix dimension N x M, reads the matrix elements, and outputs both the transposed matrix and row sums.",
      constraints: ["1 <= N, M <= 100", "-10^4 <= Matrix[i][j] <= 10^4", "Memory leak free (all dynamic memory deallocated)"],
      inputFormat: "First line: N M. Next N lines: M integers per line.",
      outputFormat: "Output transposed matrix followed by line of row sums.",
      sampleTestCases: [
        {
          id: 1,
          input: "2 2\n1 2\n3 4",
          expectedOutput: "1 3\n2 4\nRow sums: 3 7",
          isHidden: false,
          weight: 1.0,
          explanation: "Basic 2x2 matrix transposition and summation.",
        },
      ],
      hiddenTestCases: [
        {
          id: 2,
          input: "3 2\n10 20\n30 40\n50 60",
          expectedOutput: "10 30 50\n20 40 60\nRow sums: 30 70 110",
          isHidden: true,
          weight: 1.0,
          explanation: "Non-square rectangular matrix bounds check.",
        },
      ],
      rubric: [
        {
          criterion: "Correct Transposition Logic",
          maxScore: 4.0,
          description: "Correctly flips rows and columns.",
          levels: [
            { scorePercent: 100, description: "All test cases pass including rectangular matrices." },
            { scorePercent: 50, description: "Works only on square matrices." },
            { scorePercent: 0, description: "Incorrect logic or crashes." },
          ],
        },
        {
          criterion: "Memory Deallocation",
          maxScore: 3.0,
          description: "Properly frees heap-allocated arrays.",
          levels: [
            { scorePercent: 100, description: "All delete[] calls invoked without double-free." },
            { scorePercent: 0, description: "Memory leak detected." },
          ],
        },
      ],
      starterCode: "#include <iostream>\nusing namespace std;\n\nint main() {\n    // TODO: implement\n    return 0;\n}",
      referenceSolution:
        "#include <iostream>\nusing namespace std;\n\nint main() {\n    int n, m;\n    if (!(cin >> n >> m)) return 0;\n    // Clean reference implementation\n    return 0;\n}",
    };
  }
}
