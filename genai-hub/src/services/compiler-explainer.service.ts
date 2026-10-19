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
        errorType: "Truy cập bộ nhớ không hợp lệ (Segmentation Fault)",
        simpleExplanation:
          "Chương trình của bạn đã cố gắng đọc hoặc ghi vào một vùng bộ nhớ mà nó không được phép truy cập.",
        suspectedCause:
          "Các nguyên nhân phổ biến: truy cập mảng vượt quá chỉ số, dùng con trỏ NULL hoặc con trỏ chưa được khởi tạo, hoặc giải phóng cùng một vùng nhớ hai lần.",
        actionableHints: [
          "Kiểm tra lại các vòng lặp for/while: chỉ số mảng phải bắt đầu từ 0 và dừng trước kích thước mảng.",
          "Kiểm tra con trỏ: phải gán địa chỉ hợp lệ trước khi dùng toán tử '*' hoặc '->'.",
          "Nếu có dùng malloc/new, hãy kiểm tra xem kết quả trả về có bị NULL không.",
        ],
      };
    }

    if (/undefined reference to|unresolved external symbol/i.test(compilerOutput)) {
      return {
        errorType: "Lỗi liên kết (không tìm thấy hàm)",
        simpleExplanation:
          "Trình biên dịch tìm thấy khai báo hàm nhưng không tìm thấy phần thân của hàm đó khi liên kết mã nguồn.",
        suspectedCause:
          "Có thể bạn quên định nghĩa hàm, viết sai chính tả tên hàm giữa file .h và file .cpp, hoặc quên đưa file nguồn tương ứng vào lúc biên dịch.",
        actionableHints: [
          "Kiểm tra tên hàm và kiểu dữ liệu tham số trong file hiện thực xem có khớp hoàn toàn với file header không.",
          "Đảm bảo hàm main() đã được định nghĩa đúng chuẩn.",
        ],
      };
    }

    // Otherwise invoke LLM for complex error analysis
    const systemPrompt = `Bạn là trợ giảng lập trình thân thiện và có tính sư phạm.
Hãy giải thích lỗi biên dịch hoặc lỗi khi chạy của sinh viên bằng tiếng Việt, rõ ràng và dễ hiểu.
TUYỆT ĐỐI KHÔNG đưa sẵn lời giải để sao chép. Hãy hướng dẫn sinh viên tự hiểu nguyên nhân và tự sửa lỗi.
Toàn bộ nội dung trả về phải viết bằng tiếng Việt.`;

    const userPrompt = `Ngôn ngữ lập trình: ${language}
${codeSnippet ? `Mã nguồn của sinh viên:\n${codeSnippet}\n` : ""}
Thông báo lỗi từ trình biên dịch / khi chạy:
${compilerOutput}

Hãy giải thích bằng tiếng Việt:
1. Lỗi này có nghĩa là gì.
2. Nguyên nhân nhiều khả năng gây ra lỗi.
3. Từ 2 đến 3 gợi ý từng bước để tự sửa lỗi.`;

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
        errorType: "Chẩn đoán từ trình biên dịch",
        simpleExplanation: explanation,
        suspectedCause: "Có lỗi cú pháp hoặc không khớp kiểu dữ liệu trong quá trình biên dịch.",
        actionableHints: [
          "Đọc kỹ số dòng mà trình biên dịch báo lỗi.",
          "Kiểm tra dấu chấm phẩy còn thiếu, dấu ngoặc lệch hoặc việc chuyển đổi kiểu dữ liệu quanh dòng đó.",
        ],
      };
    } catch {
      return {
        errorType: "Biên dịch thất bại",
        simpleExplanation: compilerOutput.substring(0, 300),
        suspectedCause: "Mã nguồn không biên dịch được dưới các thiết lập kiểm tra nghiêm ngặt của môi trường cách ly.",
        actionableHints: ["Đọc lại thông báo lỗi của trình biên dịch và sửa các lỗi cú pháp."],
      };
    }
  }
}
