import { ILLMProvider } from "../providers/llm-provider.interface";

export interface CompilerExplanationResult {
  errorType: string;
  simpleExplanation: string;
  suspectedCause: string;
  actionableHints: string[];
}

export class CompilerExplainerService {
  private provider: ILLMProvider;

  constructor(provider: ILLMProvider) {
    this.provider = provider;
  }

  public setProvider(provider: ILLMProvider): void {
    this.provider = provider;
  }

  /**
   * Explains cryptic compiler and runtime crashes in beginner-friendly language.
   */
  public async explainError(
    compilerOutput: string,
    language: string,
    codeSnippet?: string
  ): Promise<CompilerExplanationResult> {
    // Quick heuristic diagnosis for common classical errors
    if (/segmentation fault|SIGSEGV/i.test(compilerOutput)) {
      return {
        errorType: "Memory Access Violation (Segmentation Fault / SIGSEGV)",
        simpleExplanation:
          "Chương trình của bạn đã cố gắng đọc hoặc ghi vào một vùng bộ nhớ mà nó không được phép truy cập.",
        suspectedCause:
          "Các nguyên nhân phổ biến: Truy cập mảng vượt quá chỉ số (out-of-bounds), dereference con trỏ NULL hoặc con trỏ rác chưa khởi tạo, hoặc giải phóng bộ nhớ 2 lần (double-free).",
        actionableHints: [
          "Kiểm tra lại tất cả các vòng lặp for/while: đảm bảo chỉ số mảng bắt đầu từ 0 và kết thúc trước kích thước mảng.",
          "Kiểm tra con trỏ: đảm bảo đã gán địa chỉ hợp lệ trước khi sử dụng toán tử '*' hoặc '->'.",
          "Nếu có sử dụng malloc/new, kiểm tra xem kết quả có bị NULL không.",
        ],
      };
    }

    if (/undefined reference to|unresolved external symbol/i.test(compilerOutput)) {
      return {
        errorType: "Linker Error (Undefined Reference)",
        simpleExplanation:
          "Trình biên dịch tìm thấy khai báo hàm (prototype) nhưng không tìm thấy phần thân thực thi (implementation) của hàm đó khi liên kết mã nguồn.",
        suspectedCause:
          "Bạn có thể đã quên định nghĩa hàm, viết sai chính tả tên hàm giữa file .h và file .cpp, hoặc quên include file nguồn tương ứng khi biên dịch.",
        actionableHints: [
          "Kiểm tra tên hàm và kiểu dữ liệu tham số trong file hiện thực xem có khớp 100% với file header không.",
          "Đảm bảo hàm main() đã được định nghĩa đúng chuẩn.",
        ],
      };
    }

    // Otherwise invoke LLM for complex error analysis
    const systemPrompt = `You are a supportive, pedagodical programming teaching assistant.
Explain the student's compiler or runtime error in clear, student-friendly language.
Do NOT give them full copy-paste solutions. Guide them toward understanding the cause and debugging it themselves.`;

    const userPrompt = `Language: ${language}
${codeSnippet ? `Student Code:\n${codeSnippet}\n` : ""}
Compiler / Runtime Diagnostic:
${compilerOutput}

Explain:
1. What the error means.
2. The likely cause.
3. 2-3 step-by-step debugging tips.`;

    try {
      const response = await this.provider.generateCompletion([
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ]);

      const explanation = (response.content || "").trim();
      if (!explanation || explanation.startsWith("{") || explanation.startsWith("[")) {
        throw new Error("Explainer received structured/empty output instead of natural-language text");
      }

      return {
        errorType: "Compiler Diagnostic",
        simpleExplanation: explanation,
        suspectedCause: "Syntax or type mismatch during compilation phase.",
        actionableHints: [
          "Read the line number indicated in the compiler log carefully.",
          "Check missing semicolons, parentheses, or type conversions near that line.",
        ],
      };
    } catch {
      return {
        errorType: "Compilation Failure",
        simpleExplanation: compilerOutput.substring(0, 300),
        suspectedCause: "Code failed to compile under strict sandbox build flags.",
        actionableHints: ["Review compiler log output and correct syntax errors."],
      };
    }
  }
}
