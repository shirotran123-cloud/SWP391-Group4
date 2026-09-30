# AITA GenAI Core & Review Hub (Phân hệ 3)

Phân hệ 3 chịu trách nhiệm xử lý toàn bộ các tác vụ liên quan đến trí tuệ nhân tạo (GenAI) trong nền tảng chấm điểm tự động thông minh **AITA**, bao gồm đánh giá ngữ nghĩa Clean Code & SOLID (UC-09), phòng thủ tấn công Prompt Injection (Rule R03), phân tích và giải thích lỗi biên dịch/runtime bằng ngôn ngữ tự nhiên, sinh đề thi & rubric chấm điểm cho giảng viên (UC-08), cùng cơ chế xoay vòng Multi-key Pool chống nghẽn rate-limit 429 (DEP-02, R01).

---

## 1. Kiến Trúc & Luồng Xử Lý (Architecture Pipeline)

```
       [ Student Submission / Lecturer Request ]
                          │
                          ▼
            ┌───────────────────────────┐
            │   PromptSanitizer (R03)   │
            │  - Strip zero-width chars │
            │  - Neutralize malicious   │
            │    injection in comments  │
            │  - Sliding Window (8K tok)│
            └─────────────┬─────────────┘
                          │ (Safe Wrapped CDATA)
                          ▼
            ┌───────────────────────────┐
            │  KeyRotatorService (R01)  │
            │  - Multi-Key Round-Robin  │
            │  - 429 Rate-Limit Cooldown│
            │  - Exponential Backoff    │
            └─────────────┬─────────────┘
                          │ (Active Healthy API Key)
                          ▼
      ┌───────────────────┴───────────────────┐
      ▼                                       ▼
┌───────────────┐                       ┌───────────────┐
│ Google Gemini │                       │  OpenAI GPT-4o│
│  (1.5-flash)  │                       │               │
└───────┬───────┘                       └───────┬───────┘
        │                                       │
        └───────────────────┬───────────────────┘
                            │ (Deterministic temperature = 0.2)
                            ▼
            ┌───────────────────────────┐
            │ JSON Schema Output Enforcer│
            │ - clean_code_score [0..10]│
            │ - solid_score      [0..10]│
            │ - feedback_json[] (smells)│
            │ - compiler_explanation    │
            └─────────────┬─────────────┘
                          │
                          ▼
             [ AI_REVIEW_RESULTS (DB) ]
```

---

## 2. Các Tính Năng Trọng Tâm

### 2.1. Đánh giá tất định Clean Code & SOLID (UC-09)
- **Deterministic Temperature:** Khóa chặt `temperature = 0.2` để đảm bảo tính nhất quán (deterministic) khi chấm bài thi học thuật; cùng một đoạn code nộp nhiều lần sẽ cho ra phổ điểm đồng nhất.
- **Strict JSON Schema Mode:** Bắt buộc LLM sinh dữ liệu đúng theo cấu trúc `CODE_REVIEW_JSON_SCHEMA`, ngăn chặn lỗi parsing JSON tự do.
- **Quy chuẩn chuyên sâu theo từng ngôn ngữ (C++, Java, C, Python):**
  - **C++:** Đánh giá an toàn bộ nhớ RAII, con trỏ thông minh, const-correctness, header hygiene.
  - **Java:** Tính bao đóng (encapsulation), try-with-resources, cấm khối catch rỗng.
  - **C:** Tránh hàm nguy hiểm (gets, strcpy), an toàn con trỏ và giải phóng bộ nhớ đối xứng.
  - **Python:** Tuân thủ PEP 8, list comprehensions, xử lý ngoại lệ tường minh.
- **Chi tiết vi phạm theo dòng (Fine-grained Line Code):** Mỗi code smell được gán chính xác `file`, `line_start`, `line_end`, `severity` (INFO/WARNING/CRITICAL), `rule`, và `suggestion` khắc phục.

### 2.2. Phòng vệ tấn công Prompt Injection (Rule R03 & CON-03)
- **PromptSanitizer** quét đa tầng regex để phát hiện các mẫu:
  - `IGNORE_PREVIOUS_INSTRUCTIONS`
  - `SCORE_FORCING`
  - `SYSTEM_ROLE_HIJACK`
  - `RAW_JSON_INJECTION`
  - Ký tự ẩn / Zero-width spaces (`\u200B`, `\uFEFF`, ANSI escapes)
- Khi phát hiện, chỉ thị độc hại được trung hòa thành `/* [AITA_SECURITY_DEFENSE: ... neutralized] */` đồng thời ghi log kiểm toán vào danh sách code smells của bài nộp.
- **Context Sliding Window (CON-03):** Giới hạn tối đa 8.192 tokens (~32.000 ký tự) chống tràn ngữ cảnh và cạn kiệt ngân sách token.

### 2.3. Bể xoay vòng Multi-Key Pool & Khôi phục sự cố (DEP-02, R01)
- Cho phép nạp danh sách nhiều API Key (OpenAI / Gemini) phân cách bởi dấu phẩy.
- Thuật toán Round-Robin phân phối đều tải lượng request.
- Tự động kích hoạt trạng thái **Cooldown (60s)** khi phát hiện mã lỗi `HTTP 429 Too Many Requests` hoặc lỗi máy chủ `5xx`, và tự động chuyển sang Key tiếp theo.
- Cơ chế Exponential Backoff retry tối đa 2 lần.

### 2.4. Trợ lý giải thích lỗi biên dịch Socratic (Compiler Explainer)
- Khi sinh viên gặp các lỗi runtime/biên dịch khó hiểu (ví dụ `Segmentation fault (core dumped)`, `SIGSEGV`, `undefined reference to vtable`), hệ thống dịch sang giải thích sư phạm thân thiện bằng tiếng Việt.
- Đưa ra nguyên nhân cốt lõi và 2-3 gợi ý sửa lỗi từng bước mà không tiết lộ trực tiếp đáp án gian lận.

### 2.5. Sinh đề thi và Rubric tự động (UC-08)
- Giảng viên chỉ cần cung cấp `topic`, `difficulty` (EASY/MEDIUM/HARD), `language`, và danh sách Chuẩn đầu ra (LO).
- Hệ thống tự động thiết kế: đề bài, ràng buộc, test cases (sample/hidden) kèm trọng số, rubric chấm điểm đa mức, mã khung (starter code) và lời giải mẫu.

### 2.6. Tích hợp Queue Worker (Phân hệ 2 Sandbox & Phân hệ 5 Redis Queue)
- Module [`src/workers/submission-consumer.ts`](src/workers/submission-consumer.ts) tiếp nhận kết quả chấm từ Docker Sandbox (exit code, stdout, compiler errors) và kết hợp với GenAI Review Hub để xuất ra phong bì kết quả hoàn chỉnh (`ProcessedReviewEnvelope`) sẵn sàng ghi vào CSDL.

### 2.7. REST API Microservice Server
- Cung cấp web server độc lập [`src/server.ts`](src/server.ts) lắng nghe tại port 3001, hỗ trợ CORS đầy đủ cho Frontend và Backend Portal gọi trực tiếp.

---

## 3. Cấu Trúc Thư Mục

```
genai-hub/
├── package.json               # Dependencies & scripts (build, test, demo, server)
├── tsconfig.json              # TypeScript compilation config (ES2022 / CommonJS)
├── .env.example               # Mẫu cấu hình biến môi trường
├── README.md                  # Tài liệu phân hệ 3
├── demo.ts                    # Kịch bản chạy thử nghiệm 4 kịch bản thực tế
├── db/
│   └── 001_create_ai_review_tables.sql # Schema PostgreSQL: AI_REVIEW_RESULTS & AI_PROMPT_TEMPLATES
├── src/
│   ├── index.ts               # Container Factory & public exports
│   ├── server.ts              # REST API Microservice server (port 3001)
│   ├── config/
│   │   └── ai.config.ts       # Cấu hình model, temperature, token limits
│   ├── types/
│   │   ├── review.types.ts    # Khớp thực thể AI_REVIEW_RESULTS (Section 3.3 ERD)
│   │   ├── exam.types.ts      # Khớp thực thể UC-08 Exam & Rubric
│   │   └── provider.types.ts  # Types cho LLM Message, Options, KeyPool
│   ├── schemas/
│   │   └── code-review.schema.ts # JSON Schema chuẩn cho OpenAI & Gemini
│   ├── security/
│   │   └── prompt-sanitizer.ts   # Bộ lọc chống Prompt Injection & sliding window
│   ├── providers/
│   │   ├── llm-provider.interface.ts # Interface chuẩn trừu tượng hóa LLM
│   │   ├── openai.provider.ts        # OpenAI GPT-4o adapter
│   │   ├── gemini.provider.ts        # Google Gemini 1.5 adapter
│   │   └── mock.provider.ts          # Mock Engine chạy offline & CI/CD 0đ
│   ├── services/
│   │   ├── key-rotator.service.ts    # Multi-Key rotation & 429 cooldown pool
│   │   ├── code-reviewer.service.ts  # Reviewer Clean Code & SOLID chuyên sâu
│   │   ├── exam-generator.service.ts # Bộ sinh đề thi & rubric (UC-08)
│   │   └── compiler-explainer.service.ts # Giải thích lỗi biên dịch Socratic
│   └── workers/
│       └── submission-consumer.ts    # Queue adapter kết nối Phân hệ 2 & Phân hệ 5
├── samples/
│   ├── dirty-calc.cpp         # File mẫu vi phạm nghiêm trọng SRP & Clean Code
│   ├── clean-calc.cpp         # File mẫu tuân thủ chuẩn SOLID
│   ├── malicious-injection.java # File mẫu chứa payload hack prompt
│   └── syntax-error.cpp       # File mẫu lỗi bộ nhớ Segmentation fault
└── test/
    └── run-all-tests.ts       # Bộ kiểm thử 32 test cases tự động (7 suites)
```

---

## 4. Hướng Dẫn Cài Đặt & Chạy Thử

### Bước 1: Cài đặt Dependencies
```bash
cd genai-hub
npm install
```

### Bước 2: Chạy Test Suite (32 bài test tự động)
```bash
npm test
```
*Kết quả:* `32 PASSED, 0 FAILED`.

### Bước 3: Chạy Demo Trực Quan
```bash
npm run demo
```

### Bước 4: Khởi Chạy REST API Server
```bash
npm run server
```
Server sẽ chạy tại `http://localhost:3001` với các endpoints:
- `GET  /health`: Trạng thái máy chủ, sức khỏe pool key.
- `POST /api/v1/ai/review`: Chấm điểm Clean Code & SOLID.
- `POST /api/v1/ai/explain-error`: Chẩn đoán lỗi biên dịch/runtime.
- `POST /api/v1/ai/generate-exam`: Sinh đề thi và rubric.
- `POST /api/v1/ai/sanitize`: Kiểm tra và làm sạch mã nguồn.

### Bước 5: Build sang JavaScript
```bash
npm run build
```

---

## 5. Tích Hợp Database (PostgreSQL / Supabase)

Mã nguồn migration nằm tại [`db/001_create_ai_review_tables.sql`](db/001_create_ai_review_tables.sql), bao gồm:
1. Bảng `ai_review_results` (khóa ngoại `submission_id`, điểm `clean_code_score`, `solid_score`, `feedback_json`, `compiler_explanation`, `model_used`, `token_usage`).
2. Bảng `ai_prompt_templates` cho phép quản trị viên cập nhật prompt/template trực tiếp mà không cần deploy lại code.