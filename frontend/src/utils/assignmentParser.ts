export interface ParsedAssignmentSpec {
  overview: string;
  shortSummary: string;
  technicalRequirements: string[];
  inputFormat: string[];
  outputFormat: string[];
  constraints: string[];
  tags: string[];
}

export function parseAssignmentDescription(rawText: string): ParsedAssignmentSpec {
  if (!rawText || !rawText.trim()) {
    return {
      overview: 'Chưa có mô tả chi tiết cho bài tập này.',
      shortSummary: 'Chưa có mô tả chi tiết.',
      technicalRequirements: [],
      inputFormat: [],
      outputFormat: [],
      constraints: [],
      tags: [],
    };
  }

  const raw = rawText.trim();
  const techPattern = /(?:Yêu cầu kỹ thuật|Technical Requirements?|Yêu cầu thuật toán)\s*:/i;
  const inputPattern = /(?:Định dạng Đầu vào(?:\s*\(StdIn\))?|Input Format|Dữ liệu vào|Đầu vào(?:\s*\(StdIn\))?)\s*:/i;
  const outputPattern = /(?:Định dạng Đầu ra(?:\s*\(StdOut\))?|Output Format|Dữ liệu ra|Đầu ra(?:\s*\(StdOut\))?)\s*:/i;
  const constraintPattern = /(?:Ràng buộc(?:\s*kỹ thuật)?|Constraints?|Giới hạn)\s*:/i;

  let overview = '';
  let technicalRequirements: string[] = [];
  let inputFormat: string[] = [];
  let outputFormat: string[] = [];
  let constraints: string[] = [];
  const tags: string[] = [];

  // 1. Phân tách overview
  const techMatch = raw.match(techPattern);
  const inputMatch = raw.match(inputPattern);
  const firstMarkerIndex = Math.min(
    techMatch?.index ?? Infinity,
    inputMatch?.index ?? Infinity
  );

  let rest = raw;
  if (firstMarkerIndex !== Infinity && firstMarkerIndex > 0) {
    overview = raw.substring(0, firstMarkerIndex).trim();
    rest = raw.substring(firstMarkerIndex);
  } else {
    overview = raw;
  }

  // 2. Trích xuất Technical Requirements
  const techStart = rest.search(techPattern);
  if (techStart !== -1) {
    const afterTech = rest.substring(techStart).replace(techPattern, '').trim();
    const nextMarker = afterTech.search(new RegExp(`${inputPattern.source}|${outputPattern.source}|${constraintPattern.source}`, 'i'));
    const techText = nextMarker !== -1 ? afterTech.substring(0, nextMarker).trim() : afterTech.trim();
    
    // Tách theo các số thứ tự: 1. 2. 3. hoặc dấu gạch đầu dòng - *
    const items = techText
      .split(/(?:(?:\r?\n|^)\s*(?:\d+[\.\)]|\-|\*)\s+|(?:^|\s)(?=\d+[\.\)]\s+))/)
      .map(s => s.trim().replace(/^[\d\.\-\*\)\s]+/, ''))
      .filter(s => s.length > 5);
    // Regression: the `items.length > 0 ? items : [text]` fallback produced `['']` when the
    // heading had no body, and the view renders one row per entry — so "Định dạng Đầu ra:" with
    // nothing under it showed a blank bullet instead of the explanatory default text, which is
    // what an empty array selects.
    technicalRequirements = items.length > 0 ? items : (techText ? [techText] : []);
  }

  // 3. Trích xuất Input Format
  const inputStart = rest.search(inputPattern);
  if (inputStart !== -1) {
    const afterInput = rest.substring(inputStart).replace(inputPattern, '').trim();
    const nextMarker = afterInput.search(new RegExp(`${outputPattern.source}|${constraintPattern.source}`, 'i'));
    const inputText = nextMarker !== -1 ? afterInput.substring(0, nextMarker).trim() : afterInput.trim();
    const items = inputText
      .split(/(?:(?:\r?\n|^)\s*[\-\*\•]\s*|\s*-\s*(?=[A-ZĐd0-9]))/)
      .map(s => s.trim().replace(/^[\-\*\•\s]+/, ''))
      .filter(s => s.length > 3);
    inputFormat = items.length > 0 ? items : (inputText ? [inputText] : []);
  }

  // 4. Trích xuất Output Format
  const outputStart = rest.search(outputPattern);
  if (outputStart !== -1) {
    const afterOutput = rest.substring(outputStart).replace(outputPattern, '').trim();
    const nextMarker = afterOutput.search(constraintPattern);
    const outputText = nextMarker !== -1 ? afterOutput.substring(0, nextMarker).trim() : afterOutput.trim();
    const items = outputText
      .split(/(?:(?:\r?\n|^)\s*[\-\*\•]\s*|\s*-\s*(?=[A-ZĐd0-9]))/)
      .map(s => s.trim().replace(/^[\-\*\•\s]+/, ''))
      .filter(s => s.length > 3);
    outputFormat = items.length > 0 ? items : (outputText ? [outputText] : []);
  }

  // 5. Trích xuất Constraints
  const constrStart = rest.search(constraintPattern);
  if (constrStart !== -1) {
    const constrText = rest.substring(constrStart).replace(constraintPattern, '').trim();
    const items = constrText
      .split(/(?:(?:\r?\n|^)\s*[\-\*\•]\s*|\s*-\s*(?=[0-9A-Za-z<]))/)
      .map(s => s.trim().replace(/^[\-\*\•\s]+/, ''))
      .filter(s => s.length > 1);
    constraints = items.length > 0 ? items : (constrText ? [constrText] : []);
  }

  // 6. Phát hiện các tags công nghệ tự động để gắn chip nổi bật
  const fullTextLower = raw.toLowerCase();
  if (fullTextLower.includes('dijkstra')) tags.push('Thuật toán Dijkstra');
  if (fullTextLower.includes('priorityqueue') || fullTextLower.includes('heap')) tags.push('Min-Heap / PriorityQueue');
  if (fullTextLower.includes('quicksort') || fullTextLower.includes('partitioning')) tags.push('QuickSort 3-Way');
  if (fullTextLower.includes('avl')) tags.push('Cây Cân Bằng AVL');
  if (fullTextLower.includes('bst') || fullTextLower.includes('binary search tree')) tags.push('Binary Search Tree (BST)');
  if (fullTextLower.includes('solid') || fullTextLower.includes('srp')) tags.push('SOLID Principle (SRP)');
  if (fullTextLower.includes('o((m + n) log n)') || fullTextLower.includes('o(n log n)') || fullTextLower.includes('o(log n)')) {
    if (fullTextLower.includes('o((m + n) log n)')) tags.push('Độ phức tạp O((M+N) log N)');
    else if (fullTextLower.includes('o(n log n)')) tags.push('Độ phức tạp O(N log N)');
    else if (fullTextLower.includes('o(log n)')) tags.push('Độ phức tạp O(log N)');
  }
  if (fullTextLower.includes('64-bit') || fullTextLower.includes('long trong java') || fullTextLower.includes('tràn số')) {
    tags.push('Kiểu dữ liệu 64-bit (long/int)');
  }
  if (fullTextLower.includes('cdn') || fullTextLower.includes('streaming') || fullTextLower.includes('bitrate')) {
    tags.push('Hạ tầng CDN & Streaming');
  }

  // Tóm tắt ngắn gọn: Lấy 1-2 câu đầu tiên của overview
  const sentences = overview.split(/(?<=[.!?])\s+/);
  const shortSummary = sentences.slice(0, 2).join(' ') || overview;

  return {
    overview,
    shortSummary,
    technicalRequirements,
    inputFormat,
    outputFormat,
    constraints,
    tags,
  };
}
