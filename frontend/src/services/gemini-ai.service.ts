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
  isFallback?: boolean;
}

export class GeminiAIService {
  /**
   * Trích xuất số lượng test case từ văn bản yêu cầu của Giảng viên nếu có
   * Hỗ trợ các mẫu câu: "tạo 5 test case", "5 testcases", "5 bộ test", "10 tests"...
   */
  public static extractRequestedCount(text?: string): number | null {
    if (!text) return null;
    const match = text.match(/(\d+)\s*(test\s*cases?|testcase|bộ\s*test|tests?|ca\s*kiểm\s*thử)/i);
    if (match && match[1]) {
      const parsed = parseInt(match[1], 10);
      if (parsed >= 1 && parsed <= 30) return parsed;
    }
    return null;
  }

  /**
   * Kiểm tra tính hợp lệ của API Key với Google Gemini AI THẬT bằng ModelService.ListModels
   * Trả về danh sách chính xác các mô hình mà tài khoản Google của bạn có quyền sử dụng.
   */
  public static async pingKey(
    apiKey: string,
    model?: string
  ): Promise<{ success: boolean; message: string; latencyMs: number; availableModels?: string[] }> {
    const startTime = Date.now();
    try {
      const cleanKey = apiKey.trim();
      if (!cleanKey) {
        return { success: false, message: 'Khóa API Key không được để trống.', latencyMs: 0 };
      }

      // Gọi trực tiếp ModelService.ListModels như khuyến nghị của Google để lấy danh mục model khả dụng
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`;
      const response = await fetch(url, { method: 'GET' });
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
      const validModels: string[] = (data.models || [])
        .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m: any) => (m.name || '').replace('models/', ''));

      if (validModels.length === 0) {
        return {
          success: false,
          message: 'API Key hợp lệ nhưng Google chưa cấp quyền generateContent cho mô hình nào.',
          latencyMs,
        };
      }

      const preferred = (model || '').replace('models/', '');
      const chosenModel = validModels.includes(preferred)
        ? preferred
        : (validModels.find(m => m.includes('flash')) || validModels[0]);

      return {
        success: true,
        message: `Kết nối thành công tới Google Gemini! Tìm thấy ${validModels.length} mô hình khả dụng. (Mô hình đề xuất: ${chosenModel})`,
        latencyMs,
        availableModels: validModels,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Lỗi kết nối: ${err.message || 'Không thể gửi yêu cầu tới máy chủ Google'}`,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  /**
   * GỌI 100% GOOGLE GEMINI AI THẬT ĐỂ SOẠN ĐỀ BÀI VÀ TESTCASES
   * Tự động tra cứu danh sách models khả dụng thực tế của tài khoản (ModelService.ListModels)
   * để không bao giờ bị lỗi 404 Model Not Found.
   * KHÔNG dùng bất kỳ đề mẫu hardcode nào.
   */
  public static async generateAssignment(
    apiKey: string,
    options: {
      courseName: string;
      courseCode: string;
      topicPrompt: string;
      lecturerDescription?: string;
      difficulty?: string;
      allowedLanguages?: string[];
      model?: string;
      numTestCases?: number;
    }
  ): Promise<GeneratedAssignmentResult> {
    const startTime = Date.now();
    const cleanKey = apiKey.trim();

    if (!cleanKey) {
      throw new Error('Chưa cung cấp Google Gemini API Key. Vui lòng bấm "Nhập Key Ngay" để cấu hình.');
    }

    // Trích xuất số lượng testcases từ văn bản giảng viên hoặc options
    const extractedCount = GeminiAIService.extractRequestedCount(options.lecturerDescription);
    const targetTestCount = options.numTestCases || extractedCount || 5;

    // Sinh mã hạt giống ngẫu nhiên để buộc AI luôn sinh đề mới mẻ mỗi lần bấm
    const randomSeed = Math.random().toString(36).substring(2, 8);

    // 1. TỰ ĐỘNG TRA CỨU DANH SÁCH MÔ HÌNH KHẢ DỤNG THỰC TẾ TỪ GOOGLE
    let modelsToTry: string[] = [];
    try {
      const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`);
      if (listRes.ok) {
        const listData = await listRes.json();
        const availableFromGoogle: string[] = (listData.models || [])
          .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
          .map((m: any) => m.name);

        if (availableFromGoogle.length > 0) {
          const rawRequested = options.model || '';
          const cleanedRequested = rawRequested.replace('models/', '');

          const exactMatch = availableFromGoogle.find(m => m === `models/${cleanedRequested}` || m === cleanedRequested);
          const flashModel = availableFromGoogle.find(m => m.toLowerCase().includes('flash'));
          const primaryChoice = exactMatch || flashModel || availableFromGoogle[0];

          modelsToTry = [primaryChoice, ...availableFromGoogle.filter(m => m !== primaryChoice)];
        }
      }
    } catch (listErr) {
      console.warn('Không thể tự động liệt kê models từ Google, sử dụng danh sách phổ biến:', listErr);
    }

    if (modelsToTry.length === 0) {
      const requested = options.model ? [options.model.startsWith('models/') ? options.model : `models/${options.model}`] : [];
      modelsToTry = Array.from(new Set([
        ...requested,
        'models/gemini-2.0-flash',
        'models/gemini-1.5-flash-latest',
        'models/gemini-1.5-flash',
        'models/gemini-1.5-pro',
        'models/gemini-pro'
      ]));
    }

    const systemPrompt = `Bạn là chuyên gia khảo thí AI tại Đại học FPT.
Nhiệm vụ: Soạn thảo đề thi lập trình chi tiết, sáng tạo, thực tế và độc đáo theo yêu cầu của Giảng viên.
BẮT BUỘC: Bạn PHẢI trả về duy nhất một chuỗi JSON hợp lệ (không dùng markdown backticks \`\`\`json, không viết bất kỳ văn bản nào ngoài JSON) theo đúng cấu trúc:
{
  "title": "Tên bài tập ngắn gọn, súc tích",
  "description": "Mô tả bối cảnh bài toán thực tế phong phú, yêu cầu giải thuật, định dạng Input/Output và ràng buộc kỹ thuật",
  "timeLimitMs": 2000,
  "memoryLimitMb": 512,
  "testCases": [
    // BẮT BUỘC sinh ĐỦ CHÍNH XÁC ${targetTestCount} phần tử testcase (không được thiếu)
    // Mỗi phần tử có:
    // "input": "chuỗi dữ liệu đầu vào chuẩn (StdIn)",
    // "output": "kết quả đầu ra chuẩn kỳ vọng (StdOut)",
    // "weight": trọng số điểm (number, phân bổ khác nhau theo độ khó, ví dụ: 1.5, 2.0, 2.5...),
    // "isHidden": boolean (test công khai hoặc test ẩn kiểm tra biên),
    // "explanation": "mục đích của test case này"
  ],
  "rubric": [
    { "criterion": "Tính đúng đắn thuật toán & Vượt qua Testcases", "maxScore": 5.0, "description": "Pass 100% testcases theo yêu cầu" },
    { "criterion": "Clean Code & Tối ưu O(N log N)", "maxScore": 2.5, "description": "Mã nguồn rõ ràng, đặt tên biến chuẩn, tối ưu thời gian" },
    { "criterion": "Thiết kế Hướng đối tượng & SOLID", "maxScore": 2.5, "description": "Tuân thủ nguyên lý Single Responsibility (SRP)" }
  ],
  "starterCode": "// Khung mã nguồn khởi tạo cho sinh viên",
  "referenceSolution": "// Lời giải tham chiếu chuẩn xác"
}`;

    const promptDetails = options.lecturerDescription?.trim()
      ? `YÊU CẦU & MÔ TẢ CỤ THỂ TỪ GIẢNG VIÊN: "${options.lecturerDescription}"\nChủ đề: ${options.topicPrompt}`
      : `Chủ đề: ${options.topicPrompt}`;

    const userPrompt = `Hãy sáng tạo một đề thi lập trình HOÀN TOÀN MỚI LẠ VÀ ĐỘC ĐÁO:
- Mã thế hệ đề thi: #${randomSeed}
- Môn học: ${options.courseCode} (${options.courseName})
- ${promptDetails}
- Ngôn ngữ cho phép: ${(options.allowedLanguages || ['java', 'python', 'cpp']).join(', ')}
- QUY CÁCH TESTCASES: Sinh ĐÚNG CHÍNH XÁC ${targetTestCount} bộ testcases (gồm ${Math.max(1, Math.floor(targetTestCount * 0.6))} testcases công khai và ${Math.max(1, targetTestCount - Math.floor(targetTestCount * 0.6))} testcases ẩn kiểm tra biên/TLE).
- TRỌNG SỐ ĐIỂM: Phân bổ các trọng số điểm khác nhau cho từng testcase theo độ khó (ví dụ test dễ 1.5đ, trung bình 2.0đ, ẩn/biên 2.5đ... tổng cộng khoảng 10.0đ).
- BỐI CẢNH THỰC TẾ: Hãy đưa bài toán vào ngữ cảnh kỹ thuật đời thực hấp dẫn (như mạng viễn thông, drone y tế, giao thông thông minh, tài chính, logistics, hệ thống phân tán...).`;

    let lastError: Error | null = null;
    let successfulModel = '';
    let parsedData: any = null;

    // 2. GỌI TRỰC TIẾP LÊN MÁY CHỦ GOOGLE GEMINI AI
    for (const modelToTry of modelsToTry) {
      const endpoint = modelToTry.startsWith('models/') ? modelToTry : `models/${modelToTry}`;
      const url = `https://generativelanguage.googleapis.com/v1beta/${endpoint}:generateContent?key=${cleanKey}`;

      try {
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
              responseMimeType: 'application/json',
              temperature: 0.75,
              maxOutputTokens: 4096,
            },
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          let msg = response.statusText;
          try {
            const errJson = JSON.parse(errText);
            msg = errJson.error?.message || msg;
          } catch {
            // ignore
          }
          throw new Error(`Google Gemini (${response.status}): ${msg}`);
        }

        const data = await response.json();
        const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        if (!rawContent) {
          throw new Error('Google Gemini trả về nội dung rỗng.');
        }

        let cleaned = rawContent.trim();
        if (cleaned.startsWith('```json')) {
          cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleaned.startsWith('```')) {
          cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          cleaned = jsonMatch[0];
        }

        parsedData = JSON.parse(cleaned);
        successfulModel = modelToTry.replace('models/', '');
        break; // Gọi AI thành công 100%!
      } catch (err: any) {
        lastError = err;
        console.warn(`Lỗi khi gọi model ${modelToTry}:`, err.message);
        // Nếu lỗi là 400 (API Key sai), không cần thử model khác, báo lỗi ngay
        if (err.message?.includes('400') || err.message?.includes('API_KEY_INVALID') || err.message?.includes('API key not valid')) {
          throw err;
        }
      }
    }

    // NẾU TẤT CẢ MODEL ĐỀU LỖI: QUĂNG LỖI THẬT TỪ GOOGLE, TUYỆT ĐỐI KHÔNG DÙNG ĐỀ MẪU HARDCODE
    if (!parsedData) {
      throw new Error(
        lastError?.message ||
        'Không thể kết nối tới máy chủ Google Gemini AI. Vui lòng kiểm tra lại API Key hoặc hạn mức Quota của tài khoản.'
      );
    }

    const latencyMs = Date.now() - startTime;
    const testCasesList: GeneratedTestCase[] = Array.isArray(parsedData.testCases)
      ? parsedData.testCases.map((tc: any, idx: number) => ({
          input: String(tc.input ?? ''),
          output: String(tc.output ?? ''),
          weight: Number(tc.weight) || (idx === 0 ? 1.5 : 2.0),
          isHidden: Boolean(tc.isHidden),
          explanation: tc.explanation ? String(tc.explanation) : undefined,
        }))
      : [];

    return {
      title: parsedData.title || `Bài Tập Lập Trình (${options.courseCode})`,
      description: parsedData.description || 'Đề bài được tạo bởi Google Gemini AI.',
      timeLimitMs: Number(parsedData.timeLimitMs) || 2000,
      memoryLimitMb: Number(parsedData.memoryLimitMb) || 512,
      allowedLanguages: options.allowedLanguages || ['java', 'python', 'cpp'],
      testCases: testCasesList,
      rubric: Array.isArray(parsedData.rubric) ? parsedData.rubric : [],
      starterCode: parsedData.starterCode || '',
      referenceSolution: parsedData.referenceSolution || '',
      modelUsed: successfulModel,
      latencyMs,
      isFallback: false,
    };
  }
}
