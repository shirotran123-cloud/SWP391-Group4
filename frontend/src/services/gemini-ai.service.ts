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

/**
 * Danh mục đa dạng các lĩnh vực đời sống & công nghệ thực tế.
 * Mỗi lần tạo đề sẽ được random ngẫu nhiên một bối cảnh độc đáo để tránh tình trạng lặp lại mô-típ.
 */
export const DIVERSE_REAL_WORLD_DOMAINS = [
  'Fintech & Sàn Khớp Lệnh Chứng Khoán: Sổ lệnh (Order Book) thời gian thực, thuật toán khớp lệnh mua bán nano-giây, tính độ sâu thị trường và phát hiện thao túng giá.',
  'Logistics Kho Vận & Thương Mại Điện Tử: Điều phối robot kho tự hành phân loại kiện hàng, thuật toán đóng gói thùng hàng 3D, tối ưu hóa đường đi giao hàng chặng cuối.',
  'Hàng Không & Quản Lý Không Lưu: Phân bổ cổng đỗ máy bay tại sân bay quốc tế, giải quyết xung đột hành lang bay radar thời gian thực, tối ưu lịch bay phi hành đoàn.',
  'Tin Sinh Học & Y Tế Số: Phân tích chuỗi giải trình tự gen ADN, tìm kiếm mẫu đột biến di truyền (k-mer pattern), xếp dóng cấu trúc chuỗi protein.',
  'Mạng Xã Hội & Đồ Thị Tri Thức: Phát hiện mạng lưới tài khoản bot / tin giả, thuật toán phân cụm cộng đồng đồ thị, tính độ gắn kết và xếp hạng dòng thời gian tin tức.',
  'Thành Phố Thông Minh & Giao Thông: Điều tiết chu kỳ đèn tín hiệu giao thông thông minh theo camera AI, cân bằng tải mạng lưới trạm sạc xe điện EV toàn thành phố.',
  'Hạ Tầng Cloud & CDN Streaming: Thuật toán dọn dẹp bộ nhớ đệm (LRU/LFU cache eviction), phân phối luồng video bitrate thích ứng đa vùng cho hàng triệu người xem.',
  'Động Cơ Game 3D & Mô Phỏng Vật Lý: Cấu trúc phân vùng không gian Octree / BVH phát hiện va chạm đa đối tượng, tính toán tầm nhìn sương mù (Fog of War) thời gian thực.',
  'An Ninh Mạng & Phân Tích Gói Tin: Hệ thống phát hiện xâm nhập (IDS) phân tích gói tin mạng tốc độ cao 10Gbps, lọc địa chỉ IP độc hại bằng Bloom Filter và Trie.',
  'Lưới Điện Thông Minh & Năng Lượng Tái Tạo: Cân bằng tải phân phối điện năng lượng mặt trời và gió, dự báo điểm nghẽn đường dây và tối ưu lịch ngắt điện bảo trì.',
  'Hệ Thống Đặt Vé Sự Kiện & Flash-Sale: Xử lý tranh chấp đặt chỗ ngồi đồng thời cho concert quy mô triệu người, thuật toán hàng đợi công bằng và giữ chỗ có timeout.',
  'Công Cụ Tìm Kiếm & Xử Lý Văn Bản: Chỉ mục đảo (Inverted Index) tìm kiếm toàn văn, tính điểm liên quan TF-IDF / BM25 cho hàng triệu tài liệu pháp lý và học thuật.',
  'Cảng Biển & Vận Tải Biển Quốc Tế: Tối ưu bốc xếp container lên tàu mẹ, lập lịch cần cẩu cảng biển tránh kẹt bến neo đậu.',
  'Viễn Thông 5G & Định Tuyến Vệ Tinh: Thuật toán định tuyến luồng dữ liệu mạng vệ tinh LEO quỹ đạo thấp, giảm thiểu độ trễ truyền gói tin xuyên lục địa.'
];

/**
 * Kiểm tra xem một model có phải là model sinh văn bản thuần (Text/JSON generation) hay không.
 * Loại trừ triệt để:
 * - Model TTS / Audio (chỉ trả về âm thanh, gây lỗi 400 response modalities: * AUDIO)
 * - Model Embedding
 * - Model Imagen (sinh ảnh)
 * - Model Realtime / Live voice stream
 */
export function isPureTextModel(modelItem: any): boolean {
  if (!modelItem) return false;
  const name = (typeof modelItem === 'string' ? modelItem : modelItem.name || '').toLowerCase();

  // 1. Loại trừ các từ khóa âm thanh / audio / tts / embedding / hình ảnh
  if (
    name.includes('tts') ||
    name.includes('audio') ||
    name.includes('embed') ||
    name.includes('imagen') ||
    name.includes('realtime') ||
    name.includes('live-') ||
    name.includes('transcription') ||
    name.includes('native-audio')
  ) {
    return false;
  }

  // 2. Nếu là object từ Google ListModels API, phải hỗ trợ generateContent
  if (typeof modelItem === 'object' && modelItem.supportedGenerationMethods) {
    if (!modelItem.supportedGenerationMethods.includes('generateContent')) {
      return false;
    }
  }

  // 3. Phải thuộc dòng họ Gemini
  return name.includes('gemini');
}

/**
 * Lựa chọn model văn bản tối ưu nhất theo thứ tự ưu tiên tốc độ và độ ổn định
 */
export function pickBestTextModel(availableModels: string[]): string {
  const cleanList = availableModels
    .map(m => m.replace('models/', ''))
    .filter(m => isPureTextModel(m));

  if (cleanList.length === 0) {
    return 'gemini-2.0-flash';
  }

  const priorityOrder = [
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash-8b',
    'gemini-2.0-flash-lite',
    'gemini-2.0-pro-exp',
    'gemini-1.5-pro',
    'gemini-1.5-pro-latest',
    'gemini-pro',
  ];

  for (const prio of priorityOrder) {
    const matched = cleanList.find(m => m.toLowerCase() === prio || m.toLowerCase().startsWith(prio));
    if (matched) return matched;
  }

  // Ưu tiên model nào có chữ "flash" mà không chứa tts
  const flashModel = cleanList.find(m => m.toLowerCase().includes('flash'));
  if (flashModel) return flashModel;

  return cleanList[0];
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
   * Chỉ lọc và trả về danh sách các mô hình sinh VĂN BẢN (loại bỏ sạch các mô hình TTS/Audio).
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

      // Gọi trực tiếp ModelService.ListModels từ Google để lấy danh mục model khả dụng
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
      // LỌC TRIỆT ĐỂ: Chỉ lấy model TEXT, loại bỏ 100% mô hình TTS âm thanh
      const validModels: string[] = (data.models || [])
        .filter((m: any) => isPureTextModel(m))
        .map((m: any) => (m.name || '').replace('models/', ''));

      if (validModels.length === 0) {
        return {
          success: false,
          message: 'API Key hợp lệ nhưng Google chưa cấp quyền mô hình văn bản (generateContent) nào.',
          latencyMs,
        };
      }

      const preferred = (model || '').replace('models/', '');
      const chosenModel = (preferred && validModels.includes(preferred) && isPureTextModel(preferred))
        ? preferred
        : pickBestTextModel(validModels);

      return {
        success: true,
        message: `Kết nối thành công tới Google Gemini! Tìm thấy ${validModels.length} mô hình văn bản khả dụng. (Mô hình đề xuất: ${chosenModel})`,
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
   * Tự động lọc mô hình văn bản chuẩn (loại bỏ tts audio), tránh triệt để lỗi 400.
   * Đa dạng hóa bối cảnh đời thực ngẫu nhiên, TUYỆT ĐỐI không lặp lại mô-típ Drone y tế.
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

    // Sinh mã ngẫu nhiên để buộc AI luôn sinh đề mới mẻ mỗi lần bấm
    const randomSeed = Math.random().toString(36).substring(2, 8);

    // CHỌN NGẪU NHIÊN 1 BỐI CẢNH ĐỜI THỰC ĐỘC ĐÁO CHO LẦN GỌI NÀY ĐỂ ĐA DẠNG HÓA
    const chosenDomain = DIVERSE_REAL_WORLD_DOMAINS[Math.floor(Math.random() * DIVERSE_REAL_WORLD_DOMAINS.length)];

    // 1. TỰ ĐỘNG TRA CỨU DANH SÁCH MÔ HÌNH VĂN BẢN KHẢ DỤNG THỰC TẾ TỪ GOOGLE
    let modelsToTry: string[] = [];
    try {
      const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`);
      if (listRes.ok) {
        const listData = await listRes.json();
        // LỌC TRIỆT ĐỂ: Chỉ giữ lại các mô hình thuần văn bản (isPureTextModel)
        const availableFromGoogle: string[] = (listData.models || [])
          .filter((m: any) => isPureTextModel(m))
          .map((m: any) => m.name as string);

        if (availableFromGoogle.length > 0) {
          const rawRequested = options.model || '';
          const cleanedRequested = rawRequested.replace('models/', '');

          let primaryChoice = '';
          if (cleanedRequested && isPureTextModel(cleanedRequested)) {
            const exactMatch = availableFromGoogle.find(m => m === `models/${cleanedRequested}` || m === cleanedRequested);
            if (exactMatch) primaryChoice = exactMatch;
          }

          if (!primaryChoice) {
            const bestName = pickBestTextModel(availableFromGoogle);
            primaryChoice = availableFromGoogle.find(m => m.replace('models/', '') === bestName) || availableFromGoogle[0];
          }

          modelsToTry = [
            primaryChoice,
            ...availableFromGoogle.filter(m => m !== primaryChoice)
          ];
        }
      }
    } catch (listErr) {
      console.warn('Không thể tự động liệt kê models từ Google, sử dụng danh sách phổ biến:', listErr);
    }

    // Danh sách dự phòng các model text phổ biến nếu ListModels không phản hồi
    const fallbackPureTextModels = [
      'models/gemini-2.0-flash',
      'models/gemini-1.5-flash-latest',
      'models/gemini-1.5-flash',
      'models/gemini-1.5-flash-8b',
      'models/gemini-1.5-pro-latest',
      'models/gemini-1.5-pro',
      'models/gemini-pro',
    ];

    if (modelsToTry.length === 0) {
      const requested = (options.model && isPureTextModel(options.model))
        ? [options.model.startsWith('models/') ? options.model : `models/${options.model}`]
        : [];
      modelsToTry = Array.from(new Set([...requested, ...fallbackPureTextModels]));
    } else {
      // Đảm bảo các model phổ biến luôn có mặt ở cuối để dự phòng
      for (const fb of fallbackPureTextModels) {
        if (!modelsToTry.includes(fb)) {
          modelsToTry.push(fb);
        }
      }
    }

    // Lọc lại một lần nữa để chắc chắn 100% không còn model TTS hay Audio nào lọt vào
    modelsToTry = modelsToTry.filter(m => isPureTextModel(m));

    const systemPrompt = `Bạn là chuyên gia khảo thí AI tại Đại học FPT.
Nhiệm vụ: Soạn thảo đề thi lập trình chi tiết, phong phú, độc đáo và gắn với các bài toán công nghệ thực tế theo yêu cầu của Giảng viên.
BẮT BUỘC: Bạn PHẢI trả về duy nhất một chuỗi JSON hợp lệ (không dùng markdown backticks \`\`\`json, không viết bất kỳ văn bản nào ngoài JSON) theo đúng cấu trúc:
{
  "title": "Tên bài tập ngắn gọn, súc tích mang tính ứng dụng cao",
  "description": "Mô tả bối cảnh bài toán thực tế sinh động, yêu cầu giải thuật, định dạng Input/Output và ràng buộc kỹ thuật rõ ràng",
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
- BỐI CẢNH THỰC TẾ BẮT BUỘC (ĐA DẠNG HÓA):
  + Lĩnh vực bài toán cho đề thi này: "${chosenDomain}".
  + ĐẶC BIỆT CẤM: TUYỆT ĐỐI KHÔNG lặp lại các mô-típ Drone y tế, máy bay cứu hộ khẩn cấp hay giao thuốc cấp cứu (trừ phi giảng viên yêu cầu đích danh từ khóa này).
  + Hãy lồng ghép nghiệp vụ thực tế của lĩnh vực "${chosenDomain}" vào cốt truyện đề bài, sử dụng thuật ngữ nghiệp vụ chân thực để bài toán lập trình sống động và hấp dẫn.`;

    let lastError: Error | null = null;
    let successfulModel = '';
    let parsedData: any = null;

    // 2. GỌI TRỰC TIẾP LÊN MÁY CHỦ GOOGLE GEMINI AI
    for (const modelToTry of modelsToTry) {
      if (!isPureTextModel(modelToTry)) continue;

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
              temperature: 0.88, // Tăng độ đa dạng sáng tạo cho AI
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

        // CHỈ dừng ngay lập tức nếu API Key không hợp lệ hoặc bị cấm
        const errMsg = (err.message || '').toLowerCase();
        if (
          errMsg.includes('api_key_invalid') ||
          errMsg.includes('api key not valid') ||
          errMsg.includes('api key expired') ||
          errMsg.includes('forbidden')
        ) {
          throw err;
        }

        // Với các lỗi model khác (như 400 modality, 404 model not found, 429 quota per model, 503...):
        // TIẾP TỤC thử model văn bản tiếp theo trong danh sách modelsToTry!
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
