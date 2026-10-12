export interface GeneratedTestCase {
  input: string;
  output: string;
  weight: number;
  isHidden: boolean;
  explanation?: string;
}

export interface RubricLevel {
  scorePercent: number;
  description: string;
}

export interface RubricCriterion {
  criterion: string;
  maxScore: number;
  description: string;
  levels?: RubricLevel[];
}

export interface GeneratedAssignmentResult {
  title: string;
  description: string;
  timeLimitMs: number;
  memoryLimitMb: number;
  allowedLanguages?: string[];
  testCases: GeneratedTestCase[];
  rubric: RubricCriterion[];
  starterCode?: string;
  referenceSolution?: string;
  modelUsed: string;
  latencyMs: number;
}

export class GeminiAIService {
  /**
   * Kiểm tra tính hợp lệ của API Key với Google Gemini
   */
  public static async pingKey(
    apiKey: string,
    model: string = 'gemini-3.8-flash'
  ): Promise<{ success: boolean; message: string; latencyMs: number }> {
    const startTime = Date.now();
    try {
      const cleanKey = apiKey.trim();
      if (!cleanKey) {
        return { success: false, message: 'Khóa API Key không được để trống.', latencyMs: 0 };
      }

      // Sử dụng HTTP GET kiểm tra metadata mô hình thay vì gọi generateContent nặng nề
      // Giúp kiểm tra tính hợp lệ của API Key và Model trong 100 - 200ms mà không tốn quota
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}?key=${cleanKey}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      let response: Response;
      try {
        response = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const errText = await response.text();
        let errorDetail = response.statusText;
        try {
          const errObj = JSON.parse(errText);
          errorDetail = errObj.error?.message || errorDetail;
        } catch {
          // ignore
        }
        return {
          success: false,
          message: `Lỗi kết nối (${response.status}): ${errorDetail}`,
          latencyMs,
        };
      }

      const data = await response.json();
      const displayName = data.displayName || model;

      return {
        success: true,
        message: `Kết nối thành công tới ${displayName} (${model})!`,
        latencyMs,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Lỗi kết nối: ${err.name === 'AbortError' ? 'Hết thời gian chờ (Timeout)' : err.message || 'Không thể gửi yêu cầu'}`,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Gọi AI Google Gemini siêu tốc theo mô tả và yêu cầu cụ thể của Giảng viên
   */
  public static async generateAssignment(
    apiKey: string,
    options: {
      courseName: string;
      courseCode: string;
      topicPrompt: string;
      lecturerDescription?: string; // Yêu cầu mô tả cụ thể từ giảng viên
      difficulty?: string;
      allowedLanguages?: string[];
      model?: string;
    }
  ): Promise<GeneratedAssignmentResult> {
    const startTime = Date.now();
    const cleanKey = apiKey.trim();
    const model = options.model || 'gemini-3.8-flash';

    if (!cleanKey) {
      throw new Error('Chưa cấu hình Google Gemini API Key. Vui lòng nhập Key trước khi tạo đề.');
    }

    const systemPrompt = `Bạn là trợ lý AI khảo thí tạo đề bài lập trình cho Đại học FPT.
Hãy trả về DUY NHẤT một chuỗi JSON hợp lệ (không dùng markdown backticks \`\`\`json, không viết chữ gì ngoài JSON).
JSON cần ngắn gọn, xúc tích, sinh cực nhanh với cấu trúc:
{
  "title": "Tên bài tập ngắn gọn",
  "description": "Mô tả đề bài, định dạng Input/Output và yêu cầu thuật toán",
  "timeLimitMs": 2000,
  "memoryLimitMb": 512,
  "testCases": [
    { "input": "input1", "output": "output1", "weight": 3.5, "isHidden": false },
    { "input": "input2", "output": "output2", "weight": 3.5, "isHidden": false },
    { "input": "input3", "output": "output3", "weight": 3.0, "isHidden": true }
  ],
  "rubric": [
    { "criterion": "Tính đúng đắn thuật toán & Vượt qua Testcases", "maxScore": 5.0, "description": "Pass 100% testcases" },
    { "criterion": "Clean Code & Tối ưu O(N log N)", "maxScore": 2.5, "description": "Mã nguồn rõ ràng, đặt tên chuẩn" },
    { "criterion": "Thiết kế Hướng đối tượng & SOLID", "maxScore": 2.5, "description": "Tuân thủ SRP và DIP" }
  ],
  "starterCode": "// Khung mã nguồn mẫu ngắn gọn"
}`;

    // Ưu tiên yêu cầu mô tả do Giảng viên trực tiếp nhập vào
    const promptDetails = options.lecturerDescription?.trim()
      ? `YÊU CẦU & MÔ TẢ CỤ THỂ TỪ GIẢNG VIÊN: "${options.lecturerDescription}"\nChủ đề: ${options.topicPrompt}`
      : `Chủ đề: ${options.topicPrompt}`;

    const userPrompt = `Tạo đề thi cho:
- Môn học: ${options.courseCode} (${options.courseName})
- ${promptDetails}
- Ngôn ngữ: ${(options.allowedLanguages || ['java', 'python', 'cpp']).join(', ')}
- Tạo 3 testcases (2 công khai, 1 ẩn). Hãy trả về JSON ngay lập tức.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: systemPrompt + '\n\n' + userPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2, // Nhiệt độ thấp giúp phản hồi nhanh và chuẩn xác
          maxOutputTokens: 1200, // Rút gọn token để tốc độ sinh đạt 1 - 2 giây
        },
      }),
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errText = await response.text();
      let errorMsg = `Lỗi từ Google Gemini (${response.status})`;
      try {
        const errObj = JSON.parse(errText);
        errorMsg = errObj.error?.message || errorMsg;
      } catch {
        // ignore
      }
      throw new Error(errorMsg);
    }

    const data = await response.json();
    const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!rawContent) {
      throw new Error('Google Gemini không trả về nội dung.');
    }

    // Làm sạch JSON nếu bị bọc trong markdown fences
    let cleanedJson = rawContent.trim();
    if (cleanedJson.startsWith('```json')) {
      cleanedJson = cleanedJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedJson.startsWith('```')) {
      cleanedJson = cleanedJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(cleanedJson);
    } catch (err: any) {
      console.error('Lỗi phân tích JSON từ Gemini:', cleanedJson);
      throw new Error('Không thể phân tích dữ liệu JSON trả về từ Gemini: ' + err.message);
    }

    return {
      title: parsed.title || 'Bài tập Lập trình Tối ưu',
      description: parsed.description || 'Yêu cầu cài đặt giải thuật theo chuẩn học thuật.',
      timeLimitMs: Number(parsed.timeLimitMs) || 2000,
      memoryLimitMb: Number(parsed.memoryLimitMb) || 512,
      allowedLanguages: options.allowedLanguages || ['java', 'python', 'cpp'],
      testCases: Array.isArray(parsed.testCases) ? parsed.testCases : [],
      rubric: Array.isArray(parsed.rubric) ? parsed.rubric : [],
      starterCode: parsed.starterCode || '',
      referenceSolution: parsed.referenceSolution || '',
      modelUsed: model,
      latencyMs,
    };
  }
}
