import { ILLMProvider } from "../providers/llm-provider.interface";
import { ExamGenerateRequest, GeneratedExam } from "../types/exam.types";
import { EXAM_GENERATION_JSON_SCHEMA } from "../schemas/code-review.schema";

export class ExamGeneratorService {
  private provider: ILLMProvider;

  constructor(provider: ILLMProvider) {
    this.provider = provider;
  }

  public setProvider(provider: ILLMProvider): void {
    this.provider = provider;
  }

  /**
   * Generates a complete exam problem with test cases, grading rubrics, and starter code (UC-08).
   */
  public async generateExam(request: ExamGenerateRequest): Promise<GeneratedExam> {
    const { topic, courseCode, difficulty, language, learningOutcomes, numTestCases = 5 } = request;

    const systemPrompt = `Bạn là giảng viên Khoa học Máy tính giàu kinh nghiệm và là chuyên gia thiết kế chương trình cho Hệ thống AITA.
Nhiệm vụ của bạn là tạo ra các đề bài lập trình chặt chẽ, có giá trị học thuật.
Bạn phải tạo đầy đủ:
1. Đề bài rõ ràng kèm bối cảnh thực tế.
2. Quy định chính xác về định dạng dữ liệu vào/ra và các ràng buộc.
3. Bộ test case (cả công khai và ẩn) bao phủ các trường hợp biên (dữ liệu rỗng, số lớn, giá trị biên).
4. Thang điểm nhiều mức dùng cho cả chấm tự động lẫn chấm thủ công.
5. Mã khung tối thiểu cho sinh viên và lời giải tham khảo hoàn chỉnh.

QUAN TRỌNG: Toàn bộ nội dung văn bản (đề bài, mô tả, tiêu chí chấm, gợi ý) PHẢI viết bằng TIẾNG VIỆT.
Tên các trường JSON thì giữ nguyên theo đúng schema.`;

    const userPrompt = `GENERATE_EXAM
Môn học: ${courseCode}
Chủ đề: ${topic}
Độ khó mong muốn: ${difficulty}
Ngôn ngữ lập trình: ${language}
Mục tiêu học tập: ${learningOutcomes.join(", ")}
Số lượng test case yêu cầu: ${numTestCases}

Hãy đảm bảo kết quả trả về đúng theo JSON schema đã cho, và viết toàn bộ phần chữ bằng tiếng Việt.`;

    const response = await this.provider.generateCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      {
        temperature: 0.3, // Slight creativity for variety while maintaining structure
        jsonSchema: EXAM_GENERATION_JSON_SCHEMA,
        schemaName: "AITA_ExamSpecification",
      }
    );

    let parsed: any = response.parsedJson;
    if (!parsed) {
      try {
        parsed = JSON.parse(response.content);
      } catch {
        throw new Error("ExamGeneratorService: Failed to parse LLM structured output into exam format.");
      }
    }

    return parsed as GeneratedExam;
  }
}
