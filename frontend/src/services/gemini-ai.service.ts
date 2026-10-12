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
    model: string = 'gemini-1.5-flash'
  ): Promise<{ success: boolean; message: string; latencyMs: number }> {
    const startTime = Date.now();
    try {
      const cleanKey = apiKey.trim();
      if (!cleanKey) {
        return { success: false, message: 'Khóa API Key không được để trống.', latencyMs: 0 };
      }

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: 'Trả lời đúng 1 từ "OK" để xác nhận kết nối.' }],
            },
          ],
          generationConfig: {
            maxOutputTokens: 10,
            temperature: 0.1,
          },
        }),
      });

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

      return {
        success: true,
        message: `Kết nối thành công tới mô hình ${model}!`,
        latencyMs,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Lỗi mạng hoặc CORS: ${err.message || 'Không thể gửi yêu cầu'}`,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Gọi AI Google Gemini thật để tạo đề bài và bộ Testcases, Rubrics
   */
  public static async generateAssignment(
    apiKey: string,
    options: {
      courseName: string;
      courseCode: string;
      topicPrompt: string;
      difficulty?: string;
      allowedLanguages?: string[];
      model?: string;
    }
  ): Promise<GeneratedAssignmentResult> {
    const startTime = Date.now();
    const cleanKey = apiKey.trim();
    const model = options.model || 'gemini-1.5-flash';

    if (!cleanKey) {
      throw new Error('Chưa cấu hình Google Gemini API Key. Vui lòng nhập Key trước khi tạo đề.');
    }

    const systemPrompt = `Bạn là Giáo sư Khoa học Máy tính tại Đại học FPT kiêm chuyên gia khảo thí hệ thống chấm bài AITA.
Nhiệm vụ của bạn là soạn thảo một đề bài tập lập trình học thuật, mang tính thực tiễn cao cho sinh viên.
Đề bài cần tuân thủ cấu trúc dữ liệu, giải thuật tối ưu và các nguyên lý Mã Sạch (Clean Code) / SOLID.

YÊU CẦU ĐẶC BIỆT VỀ ĐỊNH DẠNG ĐẦU RA:
- Bạn PHẢI trả về duy nhất một chuỗi JSON hợp lệ.
- KHÔNG thêm markdown backticks (không dùng \`\`\`json hoặc \`\`\`), KHÔNG thêm lời giải thích bên ngoài JSON.
- Cấu trúc JSON bắt buộc phải có các trường sau:
{
  "title": "Tên bài tập ngắn gọn, học thuật bằng tiếng Việt",
  "description": "Mô tả bài toán chi tiết, ngữ cảnh thực tế, định dạng đầu vào (Input), định dạng đầu ra (Output), giới hạn dữ liệu (Constraints) và yêu cầu thiết kế",
  "timeLimitMs": 2000,
  "memoryLimitMb": 512,
  "testCases": [
    {
      "input": "Chuỗi dữ liệu đầu vào stdin (ví dụ: 5\\n1 2 3 4 5)",
      "output": "Chuỗi kết quả đầu ra stdout mong muốn",
      "weight": 2.5,
      "isHidden": false,
      "explanation": "Giải thích testcase mẫu"
    },
    {
      "input": "Dữ liệu trường hợp biên/lớn hơn",
      "output": "Kết quả chuẩn",
      "weight": 2.5,
      "isHidden": true,
      "explanation": "Testcase ẩn kiểm tra thời gian TLE và trường hợp biên"
    }
  ],
  "rubric": [
    {
      "criterion": "Tính đúng đắn thuật toán & Vượt qua 100% Testcases",
      "maxScore": 5.0,
      "description": "Chương trình chạy đúng kết quả trong thời gian và bộ nhớ quy định",
      "levels": [
        { "scorePercent": 100, "description": "Pass toàn bộ testcases công khai và testcases ẩn" },
        { "scorePercent": 60, "description": "Pass testcases cơ bản, bị TLE ở testcase lớn" },
        { "scorePercent": 0, "description": "Lỗi biên dịch hoặc sai toàn bộ" }
      ]
    },
    {
      "criterion": "Chất lượng mã nguồn Clean Code & Tối ưu O(N log N)",
      "maxScore": 2.5,
      "description": "Đặt tên biến rõ nghĩa, cấu trúc hàm ngắn gọn, không trùng lặp (DRY)",
      "levels": [
        { "scorePercent": 100, "description": "Mã nguồn sạch, comment giải thuật rõ ràng" },
        { "scorePercent": 50, "description": "Còn code thừa, tên biến viết tắt" }
      ]
    },
    {
      "criterion": "Thiết kế Hướng đối tượng & Nguyên lý SOLID",
      "maxScore": 2.5,
      "description": "Tuân thủ Single Responsibility (SRP) và Dependency Inversion (DIP)",
      "levels": [
        { "scorePercent": 100, "description": "Tách biệt rõ ràng các lớp dữ liệu và nghiệp vụ" }
      ]
    }
  ],
  "starterCode": "// Khung mã nguồn mẫu cho sinh viên...",
  "referenceSolution": "// Lời giải tham chiếu chuẩn xác..."
}`;

    const userPrompt = `Hãy tạo một đề bài tập cho học phần:
- Môn học: ${options.courseCode} (${options.courseName})
- Chủ đề mong muốn: ${options.topicPrompt || 'Cấu trúc dữ liệu và giải thuật nâng cao'}
- Độ khó: ${options.difficulty || 'TRUNG BÌNH'}
- Ngôn ngữ lập trình: ${(options.allowedLanguages || ['java', 'python', 'cpp']).join(', ')}
- Hãy tạo tối thiểu 4 test cases (ít nhất 2 test case công khai và 2 test case ẩn).`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: systemPrompt + '\n\n' + userPrompt }
            ],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 3000,
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

    // Clean JSON content if wrapped in markdown fences
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
