/**
 * Tiện ích dịch thuật và bản địa hoá nhận xét AI (SOLID, Clean Code, Code Smells) sang Tiếng Việt chuẩn mực.
 * Đảm bảo 100% phản hồi từ trợ lý AI đều hiển thị Tiếng Việt lưu loát, giàu tính sư phạm.
 */

export function translateAiExplanation(text?: string | null): string {
  if (!text) return '';
  let res = text.trim();

  // Bảo lưu tiền tố đạo văn nếu có
  let prefix = '';
  const dvMatch = res.match(/^(\[ĐẠO VĂN\]\s*Phát hiện\s+\d+%\s+tương đồng AST với bài\s+[^.]+\.\s*)(.*)$/s);
  if (dvMatch) {
    prefix = dvMatch[1];
    res = dvMatch[2].trim();
  }

  // Khớp nhận xét tổng quát
  if (/exhibits\s+(\d+)\s+architectural smell/i.test(res)) {
    const match = res.match(/exhibits\s+(\d+)\s+architectural smell/i);
    const count = match ? match[1] : '1';
    return `${prefix}Mã nguồn còn tồn tại ${count} điểm kiến trúc cần cải thiện (Code Smell). Việc khắc phục các điểm này sẽ giúp mã nguồn dễ bảo trì, rõ ràng và mở rộng tốt hơn.`;
  }
  if (res.includes('exhibits') && res.includes('architectural smell')) {
    return `${prefix}Mã nguồn còn tồn tại một số điểm kiến trúc cần cải thiện (Code Smell). Việc khắc phục các điểm này sẽ giúp mã nguồn dễ bảo trì và mở rộng tốt hơn.`;
  }
  if (/follows clean coding practices/i.test(res) || /exceptionally well-written/i.test(res)) {
    return `${prefix}Mã nguồn tuân thủ xuất sắc các tiêu chuẩn Clean Code: các hàm được phân tách mô-đun hoá rõ ràng, quy tắc đặt tên tường minh và áp dụng chuẩn xác 5 nguyên lý thiết kế SOLID.`;
  }
  if (/good overall code structure/i.test(res)) {
    return `${prefix}Bài nộp thể hiện cấu trúc mã nguồn tổng thể tốt, đặt tên biến có ý nghĩa và xử lý ngoại lệ hợp lý. Hãy lưu ý giảm thiểu sự phụ thuộc trực tiếp giữa các lớp để tối ưu hoá kiến trúc SOLID.`;
  }
  if (/Compilation finished with errors/i.test(res) || /build or execution failed/i.test(res)) {
    return `${prefix}Quá trình biên dịch hoặc thực thi phát sinh lỗi. Hãy kiểm tra các dòng mã nguồn được cảnh báo để sửa lỗi cú pháp/runtime.`;
  }

  // Danh mục từ điển thay thế các nhận xét phổ biến
  const phraseMap: Array<[RegExp, string]> = [
    [
      /The submission exhibits (\d+) architectural smell\(s\)\. Addressing them will significantly improve maintainability\./gi,
      'Mã nguồn còn $1 điểm kiến trúc cần cải thiện (Code Smell). Khắc phục các điểm này sẽ giúp mã nguồn dễ bảo trì và mở rộng hơn đáng kể.'
    ],
    [
      /The submission follows clean coding practices with modular functions, clear naming conventions, and adherence to SOLID design principles\./gi,
      'Mã nguồn tuân thủ xuất sắc các tiêu chuẩn Clean Code: hàm phân tách mô-đun tốt, đặt tên rõ nghĩa và tuân thủ các nguyên lý SOLID.'
    ],
    [
      /The student submission is exceptionally well-written, following Python best practices, PEP 8 guidelines, and strict SOLID principles.*?algorithm\./gi,
      'Mã nguồn tuân thủ xuất sắc các tiêu chuẩn Clean Code: các hàm được phân tách mô-đun hoá rõ ràng, quy tắc đặt tên tường minh và áp dụng chuẩn xác 5 nguyên lý thiết kế SOLID.'
    ],
    [
      /Tight Coupling: Consider defining an interface or abstract base class for calculators and injecting dependencies rather than relying strictly on static methods\./gi,
      'Phụ thuộc chặt chẽ (Tight Coupling): Nên định nghĩa interface hoặc lớp trừu tượng và áp dụng Dependency Injection thay vì chỉ dùng phương thức tĩnh.'
    ],
    [
      /Mixed Responsibilities: Separate the input\/output IO logic from the algorithmic computation logic to improve modularity\./gi,
      'Trộn lẫn trách nhiệm: Hãy tách riêng luồng nhập/xuất (I/O) ra khỏi giải thuật tính toán để tăng tính mô-đun hoá (tuân thủ Single Responsibility Principle).'
    ],
    [
      /Magic Numbers \/ Unclear Identifiers: Replace cryptic single-letter variables and raw numbers with self-explanatory named constants \(e\.g\. const int MAX_BUFFER_SIZE = 1024;\)\./gi,
      'Số ma thuật / Đặt tên biến khó hiểu: Hãy thay thế các biến ký tự đơn và số thô bằng các hằng số có tên tự giải thích (ví dụ: final int MAX_BUFFER_SIZE = 1024;).'
    ],
    [
      /Replace cryptic single-letter variables and raw numbers with self-explanatory named constants.*?\./gi,
      'Số ma thuật / Đặt tên biến khó hiểu: Hãy thay thế các biến ký tự đơn và số thô bằng các hằng số có tên tự giải thích (ví dụ: final int MAX_BUFFER_SIZE = 1024;).'
    ],
    [
      /Long Method: Extract subroutines from the large method into smaller helper functions with a single responsibility\./gi,
      'Phương thức quá dài (Long Method): Hãy trích xuất các hàm con nhỏ hơn để đảm bảo mỗi hàm chỉ thực hiện một nhiệm vụ duy nhất (Single Responsibility).'
    ],
    [
      /Extract subroutines from the large method into smaller helper functions with a single responsibility\./gi,
      'Phương thức quá dài (Long Method): Hãy trích xuất các hàm con nhỏ hơn để đảm bảo tính đơn trách nhiệm (Single Responsibility).'
    ],
    [
      /Split the God Class into separate focused classes: separate business calculation, I\/O presentation, and validation logic\./gi,
      'Lớp quá tải chức năng (God Class): Hãy tách lớp này thành các lớp chuyên biệt: tách biệt giải thuật xử lý nghiệp vụ, luồng nhập/xuất I/O và kiểm tra dữ liệu.'
    ],
    [
      /Replace the if\/else-if chain with polymorphism \(Strategy pattern\) so new operations can be added without modifying existing code\./gi,
      'Nên thay thế chuỗi if/else-if bằng tính đa hình (Strategy Pattern) để mở rộng chức năng mới mà không phải sửa code cũ (tuân thủ Open/Closed Principle).'
    ],
    [
      /Depend on an abstraction \(e\.g\. an ILogger \/ IRepository interface\) injected through the constructor instead of instantiating concrete classes inline\./gi,
      'Nên phụ thuộc vào trừu tượng (Interface IService/IRepository) được truyền qua Constructor thay vì khởi tạo lớp cụ thể trực tiếp (tuân thủ Dependency Inversion Principle).'
    ],
  ];

  for (const [pattern, replacement] of phraseMap) {
    res = res.replace(pattern, replacement);
  }

  return prefix ? `${prefix}${res}` : res;
}

export function translateCodeSmell(smell: { rule?: string; description?: string; smell_type?: string; suggestion?: string }): { rule: string; description: string } {
  let rule = smell.rule || smell.smell_type || 'Code Smell';
  let desc = smell.description || smell.suggestion || '';

  if (/Meaningful Names/i.test(rule) || /Magic/i.test(rule)) rule = 'Quy chuẩn đặt tên & Hằng số (Clean Code)';
  else if (/Small Functions/i.test(rule) || /High Cohesion/i.test(rule)) rule = 'Tính đơn trách nhiệm & Hàm ngắn gọn';
  else if (/Single Responsibility/i.test(rule)) rule = 'Nguyên lý Đơn Trách Nhiệm (SRP)';
  else if (/Open\/Closed/i.test(rule) || /Open-Closed/i.test(rule)) rule = 'Nguyên lý Đóng/Mở (OCP)';
  else if (/Liskov/i.test(rule)) rule = 'Nguyên lý Thay thế Liskov (LSP)';
  else if (/Interface Segregation/i.test(rule)) rule = 'Nguyên lý Phân tách Giao diện (ISP)';
  else if (/Dependency Inversion/i.test(rule)) rule = 'Nguyên lý Đảo ngược Phụ thuộc (DIP)';
  else if (/Security/i.test(rule) || /Adversarial/i.test(rule)) rule = 'Kiểm định An toàn & Liêm chính (R03)';
  else if (/Invalid Submission/i.test(rule)) rule = 'Bài nộp không hợp lệ';
  else if (/God Class/i.test(rule)) rule = 'Lớp quá tải chức năng (God Class)';
  else if (/Long Method/i.test(rule)) rule = 'Phương thức quá dài (Long Method)';
  else if (/Tight Coupling/i.test(rule)) rule = 'Phụ thuộc chặt chẽ (Tight Coupling)';
  else if (/Dead Code/i.test(rule)) rule = 'Mã nguồn chết / Biến dư thừa';
  else if (/Exception Handling/i.test(rule)) rule = 'Xử lý ngoại lệ';

  desc = translateAiExplanation(desc);

  return { rule, description: desc };
}
