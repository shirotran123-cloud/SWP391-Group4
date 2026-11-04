/**
 * ============================================================================
 * TRUNG TÂM CẤU HÌNH AI TOÀN HỆ THỐNG (SINGLE SOURCE OF TRUTH FOR AI)
 * ============================================================================
 * Mọi tính năng từ đây trở về sau có sử dụng AI trong toàn bộ dự án:
 * - Soạn thảo đề bài tự động & sinh barem chấm điểm
 * - Sinh bộ test cases ẩn / công khai
 * - Đánh giá chất lượng mã nguồn & tuân thủ Clean Code / SOLID
 * - Trợ lý giải thích code & hỗ trợ sinh viên giải quyết khiếu nại (Appeals)
 * - Quét và phân tích độ tương đồng đạo văn bằng AI
 *
 * TẤT CẢ ĐỀU DÙNG CHUNG DUY NHẤT API KEY ĐƯỢC NHÚNG SẴN DƯỚI ĐÂY:
 */

export const SHARED_GEMINI_API_KEY =
  (import.meta as any).env?.VITE_GEMINI_API_KEY ||
  ''; // <-- Cấu hình qua VITE_GEMINI_API_KEY trong file .env

/**
 * Lấy Google Gemini API Key dùng chung cho mọi tính năng AI trong hệ thống.
 * Thứ tự ưu tiên nạp:
 * 1. Mã nguồn nhúng sẵn (SHARED_GEMINI_API_KEY)
 * 2. Biến môi trường .env (VITE_GEMINI_API_KEY)
 * 3. Bộ nhớ trình duyệt LocalStorage (nếu người dùng nhập override tạm thời)
 */
export function getSharedGeminiApiKey(): string {
  const fromCode = typeof SHARED_GEMINI_API_KEY === 'string' ? SHARED_GEMINI_API_KEY.trim() : '';
  const fromEnv = ((import.meta as any).env?.VITE_GEMINI_API_KEY || '').trim();
  const fromStorage =
    typeof window !== 'undefined'
      ? (localStorage.getItem('aita_gemini_api_key') || '').trim()
      : '';

  return fromCode || fromEnv || fromStorage || '';
}

/**
 * Kiểm tra xem hệ thống đã sẵn sàng với API Key dùng chung hay chưa.
 */
export function hasSharedGeminiApiKey(): boolean {
  return getSharedGeminiApiKey().length > 0;
}
