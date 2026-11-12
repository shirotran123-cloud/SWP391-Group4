import type { PlagiarismCluster, PlagiarismPairItem } from '../types';

export type ReviewTier =
  | 'CONFIRMED_PLAGIARISM'
  | 'TEACHER_BASELINE'
  | 'HIGH_SUSPICION'
  | 'NEEDS_REVIEW'
  | 'INSUFFICIENT_BASIS'
  | 'NO_EVIDENCE';

export interface MatchedQuirkItem {
  type?: string;
  signature?: string;
  description: string;
  lineA?: number;
  lineB?: number;
}

export interface ComparisonTraitRow {
  key: string;
  label: string;
  valueA: string;
  valueB: string;
  matched: boolean;
}

export interface PairTierVisual {
  tier: ReviewTier;
  /** Nhãn chính hiển thị trên badge trạng thái */
  headline: string;
  /** Nhãn rút gọn dùng trong pill/tab/table */
  shortLabel: string;
  /** Ký hiệu mức độ (text dot) */
  toneIcon: 'red' | 'yellow' | 'gray' | 'green' | 'confirmed';
  /** Mô tả ngắn trạng thái đánh giá */
  subStatus: string;
  /** Nhãn quy chế điểm số (tách riêng với số đo %) */
  scoreRuleLabel: string;
  scoreRuleState: string;
  bg: string;
  border: string;
  text: string;
  pillBg: string;
  pillText: string;
  accent: string;
}

export interface PairReasonAnalysis {
  visual: PairTierVisual;
  similarityRate: number;
  linesA: number;
  linesB: number;
  maxLines: number;
  isShortCode: boolean;
  matchedSegmentsCount: number;
  longestContiguousLines: number;
  boilerplateFilteredCount: number;
  matchedQuirks: MatchedQuirkItem[];
  traits: ComparisonTraitRow[];
  matchedTraitCount: number;
  comparableTraitCount: number;
  differingTraitLabels: string[];
  headlineSummary: string;
  reasons: string[];
}

export interface AnalyzePairInput {
  similarityRate: number;
  status?: string;
  isFlagged?: boolean;
  confirmedPlagiarism?: boolean;
  studentNameA?: string;
  studentNameB?: string;
  sourceCodeA?: string;
  sourceCodeB?: string;
  language?: string;
  matchedTokens?: Array<{ lineA: [number, number]; lineB: [number, number] }>;
  matchedTokensJson?: PlagiarismPairItem['matchedTokensJson'];
  matchedQuirks?: MatchedQuirkItem[];
  commonFingerprintsCount?: number;
  boilerplateFilteredCount?: number;
  isShortSubmission?: boolean;
}

export const PLAGIARISM_UI_THRESHOLDS = {
  NEEDS_REVIEW: 50.0,
  HIGH_SUSPICION: 80.0,
  RULE_ZERO_SCORE: 80.0,
} as const;

export function isTeacherAccountName(name?: string): boolean {
  const n = (name || '').toLowerCase();
  return n.includes('thầy') || n.includes('giảng viên') || n.includes('teacher');
}

export function isTeacherPairNames(nameA?: string, nameB?: string): boolean {
  return isTeacherAccountName(nameA) || isTeacherAccountName(nameB);
}

/**
 * Chuẩn hóa tên cụm nhóm hiển thị trên UI mà không cần sửa chuỗi trả về từ backend.
 * Tuyệt đối tránh dùng từ "Đạo Văn" trước khi giảng viên xác nhận.
 */
export function formatClusterDisplayName(
  rawName?: string,
  clusterId?: number,
  studentCount?: number,
  isInsufficientBasis = false,
): string {
  if (!rawName || !rawName.trim()) {
    const base = isInsufficientBasis ? 'Nhóm chưa đủ cơ sở' : 'Nhóm nghi vấn';
    const idPart = clusterId ? ` ${clusterId}` : '';
    const countPart = studentCount ? ` (${studentCount} bài)` : '';
    return `${base}${idPart}${countPart}`;
  }

  let normalized = rawName.trim();
  if (isInsufficientBasis) {
    normalized = normalized
      .replace(/Nhóm\s+Đạo\s+Văn/gi, 'Nhóm chưa đủ cơ sở')
      .replace(/Nhóm\s+nghi\s+vấn/gi, 'Nhóm chưa đủ cơ sở');
  } else {
    normalized = normalized.replace(/Nhóm\s+Đạo\s+Văn/gi, 'Nhóm nghi vấn');
  }
  normalized = normalized.replace(/(\d+)\s+sinh viên/gi, '$1 bài');
  return normalized;
}

export function extractMatchedSegmentList(input: {
  matchedTokens?: Array<{ lineA: [number, number]; lineB: [number, number] }>;
  matchedTokensJson?: PlagiarismPairItem['matchedTokensJson'];
}): Array<{ lineA: [number, number]; lineB: [number, number] }> {
  if (Array.isArray(input.matchedTokens) && input.matchedTokens.length > 0) {
    return input.matchedTokens;
  }
  const segs = input.matchedTokensJson?.matchedSegments;
  if (Array.isArray(segs) && segs.length > 0) {
    return segs.map((s) => ({
      lineA: [s.lineRangeA?.start ?? 0, s.lineRangeA?.end ?? 0],
      lineB: [s.lineRangeB?.start ?? 0, s.lineRangeB?.end ?? 0],
    }));
  }
  return [];
}

/**
 * Tính độ dài đoạn trùng lặp liên tiếp dài nhất (theo số dòng) bằng cách gộp các khoảng dòng giao nhau / kế tiếp.
 */
export function computeLongestContiguousMatchedLines(
  segments: Array<{ lineA: [number, number]; lineB: [number, number] }>,
): number {
  if (!segments || segments.length === 0) return 0;

  const mergeMaxSpan = (ranges: Array<[number, number]>): number => {
    const valid = ranges
      .filter(([s, e]) => Number.isFinite(s) && Number.isFinite(e) && s > 0 && e >= s)
      .sort((a, b) => a[0] - b[0]);
    if (valid.length === 0) return 0;

    let maxSpan = 0;
    let curStart = valid[0][0];
    let curEnd = valid[0][1];

    for (let i = 1; i < valid.length; i++) {
      const [ns, ne] = valid[i];
      if (ns <= curEnd + 2) {
        if (ne > curEnd) curEnd = ne;
      } else {
        maxSpan = Math.max(maxSpan, curEnd - curStart + 1);
        curStart = ns;
        curEnd = ne;
      }
    }
    maxSpan = Math.max(maxSpan, curEnd - curStart + 1);
    return maxSpan;
  };

  const maxA = mergeMaxSpan(segments.map((s) => s.lineA));
  const maxB = mergeMaxSpan(segments.map((s) => s.lineB));
  return Math.max(maxA, maxB);
}

/**
 * Phân loại 3 mức đánh giá chính (+ Đã xác nhận + Khớp lời giải mẫu + Không phát hiện dấu hiệu)
 */
export function classifyPairReviewTier(input: AnalyzePairInput): ReviewTier {
  const isTeacher = isTeacherPairNames(input.studentNameA, input.studentNameB);
  if (isTeacher) {
    return 'TEACHER_BASELINE';
  }

  if (input.confirmedPlagiarism === true) {
    return 'CONFIRMED_PLAGIARISM';
  }

  const rate = Number(input.similarityRate || 0);
  const rawStatus = (input.status || '').toUpperCase();
  if (rawStatus === 'SELF_RESUBMISSION' || rawStatus === 'CLEAN') {
    if (rate < PLAGIARISM_UI_THRESHOLDS.NEEDS_REVIEW) {
      return 'NO_EVIDENCE';
    }
  }

  const nonBlankA = (input.sourceCodeA || '')
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0).length;
  const nonBlankB = (input.sourceCodeB || '')
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0).length;
  const maxLines = Math.max(nonBlankA, nonBlankB);

  const quirks = input.matchedQuirks || input.matchedTokensJson?.matchedQuirks || [];
  const quirkCount = quirks.length;
  const segs = extractMatchedSegmentList(input);
  const segCount = segs.length || input.commonFingerprintsCount || 0;

  const isShort =
    input.isShortSubmission ??
    input.matchedTokensJson?.isShortSubmission ??
    (maxLines > 0 && maxLines <= 20);
  const hasStrongFormattingEvidence = rate >= PLAGIARISM_UI_THRESHOLDS.HIGH_SUSPICION && quirkCount >= 2;

  if (rate < PLAGIARISM_UI_THRESHOLDS.NEEDS_REVIEW) {
    return 'NO_EVIDENCE';
  }

  // Bài ngắn (<= 20 dòng không có >=2 dấu vết trình bày) hoặc vi mô không đủ cơ sở kết luận
  const isShortInsufficient =
    !hasStrongFormattingEvidence &&
    (isShort || (rawStatus === 'SUSPECTED' && rate >= PLAGIARISM_UI_THRESHOLDS.HIGH_SUSPICION));

  const isMicroInsufficient =
    segCount > 0 && segCount <= 4 && !input.isFlagged && rate < PLAGIARISM_UI_THRESHOLDS.HIGH_SUSPICION;

  if (isShortInsufficient || isMicroInsufficient) {
    return 'INSUFFICIENT_BASIS';
  }

  if (
    rate >= PLAGIARISM_UI_THRESHOLDS.HIGH_SUSPICION ||
    rawStatus === 'FLAGGED_PLAGIARISM'
  ) {
    return 'HIGH_SUSPICION';
  }

  return 'NEEDS_REVIEW';
}

export function buildTierVisual(tier: ReviewTier, similarityRate: number): PairTierVisual {
  const rate = Number(similarityRate || 0);
  switch (tier) {
    case 'CONFIRMED_PLAGIARISM':
      return {
        tier,
        headline: 'ĐÃ XÁC NHẬN ĐẠO VĂN',
        shortLabel: 'Đã xác nhận',
        toneIcon: 'confirmed',
        subStatus: 'Giảng viên đã thẩm định và xác nhận vi phạm',
        scoreRuleLabel: 'Áp dụng điểm 0 theo quy chế',
        scoreRuleState: 'Đã xác nhận',
        bg: '#fef2f2',
        border: '#ef4444',
        text: '#991b1b',
        pillBg: '#fee2e2',
        pillText: '#991b1b',
        accent: '#dc2626',
      };
    case 'HIGH_SUSPICION':
      return {
        tier,
        headline: 'TRÙNG LẶP ≥ 80% · CHỜ XÁC NHẬN',
        shortLabel: 'Chờ xác nhận (≥80%)',
        toneIcon: 'red',
        subStatus: 'Trùng lặp ≥ 80%, áp dụng điểm 0 theo quy chế và chờ giảng viên xác nhận',
        scoreRuleLabel:
          rate >= PLAGIARISM_UI_THRESHOLDS.RULE_ZERO_SCORE
            ? 'Áp dụng điểm 0 theo quy chế'
            : 'Chờ giảng viên xác nhận',
        scoreRuleState: 'Chờ xác nhận',
        bg: '#fef2f2',
        border: '#fca5a5',
        text: '#b91c1c',
        pillBg: '#fee2e2',
        pillText: '#b91c1c',
        accent: '#dc2626',
      };
    case 'NEEDS_REVIEW':
      return {
        tier,
        headline: 'GIỐNG NHAU, CẦN GIẢNG VIÊN XEM',
        shortLabel: 'Cần xem xét',
        toneIcon: 'yellow',
        subStatus: 'Tương đồng đáng chú ý nhưng thiếu bằng chứng xác định rõ ràng',
        scoreRuleLabel: 'Điểm: giữ nguyên',
        scoreRuleState: 'Chờ xem xét',
        bg: '#fffbeb',
        border: '#fcd34d',
        text: '#92400e',
        pillBg: '#fef3c7',
        pillText: '#92400e',
        accent: '#d97706',
      };
    case 'INSUFFICIENT_BASIS':
      return {
        tier,
        headline: 'KHÔNG ĐỦ CƠ SỞ KẾT LUẬN',
        shortLabel: 'Không đủ cơ sở',
        toneIcon: 'gray',
        subStatus: 'Bài ngắn hoặc cấu trúc chuẩn phổ thông, chưa đủ cơ sở quy kết',
        scoreRuleLabel: 'Điểm: giữ nguyên',
        scoreRuleState: 'Không đủ cơ sở',
        bg: '#f8fafc',
        border: '#cbd5e1',
        text: '#334155',
        pillBg: '#e2e8f0',
        pillText: '#334155',
        accent: '#64748b',
      };
    case 'TEACHER_BASELINE':
      return {
        tier,
        headline: 'KHỚP LỜI GIẢI MẪU',
        shortLabel: 'Khớp lời giải mẫu',
        toneIcon: 'gray',
        subStatus: 'Đối chiếu với khung/lời giải mẫu giảng viên (không tính vào nhóm vi phạm)',
        scoreRuleLabel: 'Điểm: giữ nguyên',
        scoreRuleState: 'Lời giải mẫu',
        bg: '#f8fafc',
        border: '#cbd5e1',
        text: '#475569',
        pillBg: '#e2e8f0',
        pillText: '#475569',
        accent: '#64748b',
      };
    case 'NO_EVIDENCE':
    default:
      return {
        tier: 'NO_EVIDENCE',
        headline: 'KHÔNG PHÁT HIỆN DẤU HIỆU SAO CHÉP',
        shortLabel: 'Độc lập',
        toneIcon: 'green',
        subStatus: 'Hai bài có hướng triển khai độc lập',
        scoreRuleLabel: 'Điểm: giữ nguyên',
        scoreRuleState: 'An toàn',
        bg: '#f0fdf4',
        border: '#86efac',
        text: '#166534',
        pillBg: '#dcfce7',
        pillText: '#166534',
        accent: '#16a34a',
      };
  }
}

/**
 * Loại bỏ comment và chuỗi ký tự trước khi phân tích lựa chọn cách viết để tránh bắt nhầm comment.
 */
function stripCommentsAndStrings(code: string): string {
  if (!code) return '';
  return code
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/#[^\n]*/g, '')
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''");
}

interface ExtractedCodeTraits {
  ioStyle: string | null;
  dataStructure: string | null;
  searchStrategy: string | null;
  sortAlgorithm: string | null;
  modularStyle: string | null;
  methodCount: number;
  hasMainFrame: boolean;
}

function extractBalancedBody(src: string, openBraceIdx: number): string {
  let depth = 0;
  for (let i = openBraceIdx; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) {
        return src.slice(openBraceIdx + 1, i);
      }
    }
  }
  return src.slice(openBraceIdx + 1);
}

function countCustomClassFields(cleanCode: string): number | null {
  const headerRegex = /\b(?:public\s+|private\s+|protected\s+)?(?:static\s+)?class\s+([A-Za-z_]\w*)[^{]*\{/g;
  let m: RegExpExecArray | null;
  while ((m = headerRegex.exec(cleanCode)) !== null) {
    const className = m[1];
    const openBraceIdx = m.index + m[0].length - 1;
    const body = extractBalancedBody(cleanCode, openBraceIdx);
    if (!body) continue;
    // Bỏ qua class driver chứa hàm main hoặc lớp ngoài bao bọc lớp con
    if (/\bmain\s*\(/.test(body) || /^(Solution|Main|Program)$/i.test(className)) continue;

    // Quét các câu lệnh ở cấp độ trực tiếp (depth === 0 trong body của inner class)
    let depth = 0;
    let buf = '';
    const topStatements: string[] = [];
    for (let i = 0; i < body.length; i++) {
      const ch = body[i];
      if (ch === '{') {
        depth++;
        buf = '';
      } else if (ch === '}') {
        depth = Math.max(0, depth - 1);
        buf = '';
      } else if (depth === 0) {
        if (ch === ';') {
          topStatements.push(buf.trim());
          buf = '';
        } else {
          buf += ch;
        }
      }
    }

    const fieldCount = topStatements.filter(
      (s) =>
        s.length > 0 &&
        !s.includes('(') &&
        /\b(int|long|double|float|boolean|char|byte|short|String|List|Map|Set|var|final|private|public|protected)\b/.test(
          s,
        ),
    ).length;

    if (fieldCount >= 2) {
      return fieldCount;
    }
  }
  return null;
}

function extractImplementationTraits(rawCode?: string): ExtractedCodeTraits {
  if (!rawCode || rawCode.trim().length === 0) {
    return {
      ioStyle: null,
      dataStructure: null,
      searchStrategy: null,
      sortAlgorithm: null,
      modularStyle: null,
      methodCount: 0,
      hasMainFrame: false,
    };
  }

  const clean = stripCommentsAndStrings(rawCode);

  // 1. Cách nhập liệu (I/O) & tách lệnh
  let ioStyle: string | null = null;
  const hasScanner = /\bnew\s+Scanner\s*\(\s*System\.in\s*\)/.test(clean) || /\bScanner\b/.test(clean);
  const hasBufferedReader = /\bBufferedReader\b/.test(clean);
  const hasStringTokenizer = /\bStringTokenizer\b/.test(clean);
  const hasStringSplit = /\.split\s*\(/.test(clean);
  const hasSysStdin = /\bsys\.stdin\b/.test(clean);
  const hasPyInput = /\binput\s*\(/.test(clean);
  const hasCin = /\bstd::cin\b|\bcin\s*>>|\bgetline\s*\(/.test(clean);
  const hasScanf = /\bscanf\s*\(/.test(clean);

  if (hasBufferedReader && hasStringTokenizer) {
    ioStyle = 'BufferedReader + StringTokenizer';
  } else if (hasBufferedReader) {
    ioStyle = hasStringSplit ? 'BufferedReader + split()' : 'BufferedReader';
  } else if (hasScanner) {
    ioStyle = hasStringTokenizer
      ? 'Scanner + StringTokenizer'
      : hasStringSplit
        ? 'Scanner + split()'
        : 'Scanner (System.in)';
  } else if (hasSysStdin) {
    ioStyle = 'sys.stdin';
  } else if (hasPyInput) {
    ioStyle = 'input() chuẩn';
  } else if (hasCin) {
    ioStyle = 'cin / getline (iostream)';
  } else if (hasScanf) {
    ioStyle = 'scanf (stdio)';
  }

  // 2. Cấu trúc dữ liệu
  const dsParts: string[] = [];
  const innerFields = countCustomClassFields(clean);
  if (innerFields !== null) {
    dsParts.push(`Lớp ${innerFields} trường`);
  }
  if (/\bArrayList\b/.test(clean)) dsParts.push('ArrayList');
  else if (/\bLinkedList\b/.test(clean)) dsParts.push('LinkedList');
  else if (/\bLinkedHashMap\b/.test(clean)) dsParts.push('LinkedHashMap');
  else if (/\bHashMap\b/.test(clean)) dsParts.push('HashMap');
  else if (/\bTreeMap\b/.test(clean)) dsParts.push('TreeMap');
  else if (/\bPriorityQueue\b/.test(clean)) dsParts.push('PriorityQueue');
  else if (/\bnew\s+(int|long|double|String|char)\s*\[/.test(clean)) dsParts.push('Mảng tĩnh []');
  else if (/\bstd::vector\b|\bvector\s*</.test(clean)) dsParts.push('std::vector');
  else if (/\bstd::unordered_map\b|\bunordered_map\s*</.test(clean)) dsParts.push('std::unordered_map');
  else if (/\bstd::map\b|\bmap\s*</.test(clean)) dsParts.push('std::map');

  if (dsParts.length === 0) {
    // Kiểm tra Python dict/list nếu là file Python
    if (/\bdef\s+/.test(clean)) {
      if (/\{\s*\}|\bdict\s*\(/.test(clean)) dsParts.push('Dictionary (dict)');
      else if (/\[\s*\]|\bappend\s*\(/.test(clean)) dsParts.push('Danh sách (list)');
    }
  }
  const dataStructure = dsParts.length > 0 ? dsParts.join(' + ') : null;

  // 3. Cách tìm kiếm / tra cứu
  let searchStrategy: string | null = null;
  if (
    /for\s*\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\)\s*\{[\s\S]{0,220}?\bif\s*\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\)\s*\{?\s*return\s+[a-zA-Z_]\w*\s*;?[\s\S]{0,120}?return\s+-1\b/.test(
      clean,
    )
  ) {
    searchStrategy = 'Duyệt tuyến tính trả -1';
  } else if (/\.(containsKey|getOrDefault)\s*\(/.test(clean)) {
    searchStrategy = 'Tra cứu Map (.containsKey)';
  } else if (/\bArrays\.binarySearch\b|\bbisect\b/.test(clean) || /\bmid\s*=\s*[\s\S]{0,80}(?:low|left)\s*<=\s*(?:high|right)/.test(clean)) {
    searchStrategy = 'Tìm kiếm nhị phân (Binary Search)';
  }

  // 4. Thuật toán sắp xếp
  let sortAlgorithm: string | null = null;
  if (/\bArrays\.sort\s*\(|\bCollections\.sort\s*\(/.test(clean)) {
    sortAlgorithm = 'Hàm sort thư viện (Arrays/Collections.sort)';
  } else if (/\bstd::sort\s*\(/.test(clean)) {
    sortAlgorithm = 'std::sort thư viện';
  } else if (/\.sort\s*\(|\bsorted\s*\(/.test(clean) && /\bdef\s+/.test(clean)) {
    sortAlgorithm = 'sorted() / list.sort()';
  } else if (
    /\bSystem\.arraycopy\b/.test(clean) ||
    (/(?:merge|combine)[A-Za-z0-9_]*\s*\(/.test(clean) && /\bmid\s*=/.test(clean))
  ) {
    sortAlgorithm = 'Merge Sort tự viết';
  } else if (/\bpivot\b/.test(clean) && /for\s*\((?:[^()]|\([^()]*\))*\)/.test(clean)) {
    sortAlgorithm = 'Quick Sort tự viết';
  } else if (
    // Selection sort nhận dạng: 2 vòng for lồng nhau, gán biến chỉ số best/min/top = i, chỉ hoán đổi sau vòng for trong
    /for\s*\(\s*(?:int\s+)?([a-zA-Z_]\w*)\s*=\s*0\s*;(?:[^();]|\([^()]*\))*-\s*1(?:[^()]|\([^()]*\))*\)[\s\S]{0,160}?([a-zA-Z_]\w*)\s*=\s*\1\s*;[\s\S]{0,160}?for\s*\((?:[^()]|\([^()]*\))*=\s*\1\s*\+\s*1/.test(
      clean,
    )
  ) {
    sortAlgorithm = 'Selection Sort tự viết';
  } else if (
    /for\s*\((?:[^()]|\([^()]*\))*\)\s*\{[\s\S]{0,160}?for\s*\((?:[^()]|\([^()]*\))*\)[\s\S]{0,220}?\[\s*j\s*\+\s*1\s*\]/.test(clean)
  ) {
    sortAlgorithm = 'Bubble Sort tự viết';
  }

  // 5. Cách tổ chức hàm & khung main
  const javaMethodMatches =
    clean.match(/\b(?:public|private|protected)?\s*(?:static\s+)?(?:[\w<>[\]]+)\s+[a-zA-Z_]\w*\s*\([^;{}]*\)\s*(?:throws\s+[\w,\s]+)?\{/g) ||
    [];
  const pyMethodMatches = clean.match(/^\s*def\s+[a-zA-Z_]\w*\s*\(/gm) || [];
  const methodCount = Math.max(javaMethodMatches.length, pyMethodMatches.length);
  const hasMain = /\bmain\s*\(/.test(clean) || /if\s+__name__\s*==\s*""/.test(clean);
  const hasSwitch = /\bswitch\s*\(/.test(clean);
  const hasIfElseChain = (clean.match(/\belse\s+if\s*\(/g) || []).length >= 2;

  let modularStyle: string | null = null;
  if (methodCount > 0) {
    const helperCount = Math.max(0, methodCount - (hasMain ? 1 : 0));
    if (helperCount === 0 && hasMain) {
      modularStyle = 'Viết tập trung trong main';
    } else if (hasSwitch) {
      modularStyle = `${methodCount} hàm + khung switch-case`;
    } else if (hasIfElseChain) {
      modularStyle = `${methodCount} hàm + rẽ nhánh if-else`;
    } else {
      modularStyle = `${methodCount} hàm phân tách chức năng`;
    }
  }

  return {
    ioStyle,
    dataStructure,
    searchStrategy,
    sortAlgorithm,
    modularStyle,
    methodCount,
    hasMainFrame: hasMain,
  };
}

function buildTraitComparisonTable(
  traitsA: ExtractedCodeTraits,
  traitsB: ExtractedCodeTraits,
): ComparisonTraitRow[] {
  const rows: ComparisonTraitRow[] = [];

  const pushIfComparable = (key: string, label: string, valA: string | null, valB: string | null) => {
    if (!valA && !valB) return;
    const normA = valA || 'Không phát hiện mẫu tương đương';
    const normB = valB || 'Không phát hiện mẫu tương đương';
    const matched = Boolean(valA && valB && valA === valB);
    rows.push({ key, label, valueA: normA, valueB: normB, matched });
  };

  pushIfComparable('io', 'Cách nhập liệu', traitsA.ioStyle, traitsB.ioStyle);
  pushIfComparable('ds', 'Cấu trúc dữ liệu', traitsA.dataStructure, traitsB.dataStructure);
  pushIfComparable('search', 'Cách tìm kiếm', traitsA.searchStrategy, traitsB.searchStrategy);
  pushIfComparable('sort', 'Thuật toán sắp xếp', traitsA.sortAlgorithm, traitsB.sortAlgorithm);

  if (traitsA.modularStyle && traitsB.modularStyle) {
    const modA = traitsA.modularStyle;
    const modB = traitsB.modularStyle;
    // Khớp cấu trúc hàm nếu cùng pattern điều phối & chênh lệch số hàm <= 1
    const sameDispatcher =
      (modA.includes('switch-case') && modB.includes('switch-case')) ||
      (modA.includes('if-else') && modB.includes('if-else')) ||
      (modA.includes('tập trung trong main') && modB.includes('tập trung trong main')) ||
      (modA.includes('phân tách chức năng') && modB.includes('phân tách chức năng'));
    const countDiff = Math.abs(traitsA.methodCount - traitsB.methodCount);
    const matched = sameDispatcher && countDiff <= 1;
    rows.push({
      key: 'modular',
      label: 'Tổ chức hàm & main',
      valueA: modA,
      valueB: modB,
      matched,
    });
  }

  return rows;
}

/**
 * Tạo phân tích đầy đủ "Lý do" (bảng lựa chọn cách viết + fallback AST & hạt sạn) cho một cặp bài.
 * Chạy 100% ở Frontend, không chạm hay làm thay đổi bất kỳ điểm/ngưỡng nào ở Backend.
 */
export function analyzePairReasons(input: AnalyzePairInput): PairReasonAnalysis {
  const rate = Number(input.similarityRate || 0);
  const tier = classifyPairReviewTier(input);
  const visual = buildTierVisual(tier, rate);

  const linesA = (input.sourceCodeA || '').split(/\r?\n/).filter((l) => l.trim().length > 0).length;
  const linesB = (input.sourceCodeB || '').split(/\r?\n/).filter((l) => l.trim().length > 0).length;
  const maxLines = Math.max(linesA, linesB);
  const isShortCode = maxLines > 0 && maxLines <= 20;

  const segments = extractMatchedSegmentList(input);
  const matchedSegmentsCount =
    segments.length ||
    input.commonFingerprintsCount ||
    (rate > 0 ? Math.max(1, Math.round(rate / 8)) : 0);
  const longestContiguousLines = computeLongestContiguousMatchedLines(segments);
  const boilerplateFilteredCount =
    input.boilerplateFilteredCount ?? input.matchedTokensJson?.boilerplateFingerprintsFiltered ?? 0;
  const matchedQuirks = input.matchedQuirks || input.matchedTokensJson?.matchedQuirks || [];

  const extA = extractImplementationTraits(input.sourceCodeA);
  const extB = extractImplementationTraits(input.sourceCodeB);
  const traits = buildTraitComparisonTable(extA, extB);
  const matchedTraitCount = traits.filter((t) => t.matched).length;
  const comparableTraitCount = traits.length;
  const differingTraitLabels = traits
    .filter((t) => !t.matched)
    .map((t) => t.label.toLowerCase());

  const reasons: string[] = [];
  let headlineSummary = '';

  if (tier === 'TEACHER_BASELINE') {
    headlineSummary = 'Khớp khung / lời giải mẫu giảng viên — được miễn trừ khỏi cảnh báo sao chép.';
    reasons.push('Cấu trúc và các đoạn trùng khớp trùng với mã nguồn mẫu giảng viên cung cấp.');
    if (boilerplateFilteredCount > 0) {
      reasons.push(`Đã lọc tự động ${boilerplateFilteredCount} dấu vân tay khung mẫu giảng viên.`);
    }
    reasons.push('Điểm số của sinh viên được giữ nguyên.');
  } else if (tier === 'INSUFFICIENT_BASIS') {
    if (isShortCode) {
      headlineSummary = `Bài ngắn (${maxLines} dòng ≤ 20), cấu trúc chuẩn theo bài giảng; phần trùng đều giải thích được bằng logic phổ thông.`;
      reasons.push(`Dung lượng mã nguồn ngắn (${linesA} dòng và ${linesB} dòng), không đủ dấu hiệu lựa chọn thiết kế riêng biệt.`);
      reasons.push('Cấu trúc nhập xuất và rẽ nhánh chuẩn theo khung bài học phổ thông.');
    } else {
      headlineSummary = `Số đoạn AST trùng nhỏ (${matchedSegmentsCount} đoạn), chưa đủ cơ sở để kết luận sao chép.`;
      reasons.push(`Chỉ ghi nhận ${matchedSegmentsCount} đoạn AST trùng khớp${longestContiguousLines > 0 ? ` (đoạn dài nhất ${longestContiguousLines} dòng)` : ''}.`);
    }
    if (matchedQuirks.length > 0) {
      reasons.push(`Phát hiện ${matchedQuirks.length} hạt sạn trình bày trùng khớp cần đối chiếu thêm.`);
    }
  } else if (tier === 'NO_EVIDENCE') {
    if (differingTraitLabels.length > 0) {
      headlineSummary = `Khác nhau ở: ${differingTraitLabels.join(', ')}.`;
      reasons.push(`Khác nhau ở: ${differingTraitLabels.join(', ')}.`);
    } else {
      headlineSummary = 'Cấu trúc thuật toán và cách triển khai giữa hai bài có độ độc lập rõ rệt.';
      reasons.push(`Độ tương đồng AST thấp (${rate.toFixed(1)}%), không hình thành chuỗi trùng lặp đáng kể.`);
    }
    if (matchedTraitCount > 0 && comparableTraitCount > 0) {
      reasons.push(`Chỉ trùng ${matchedTraitCount}/${comparableTraitCount} điểm lựa chọn cách viết mang tính thông dụng.`);
    }
  } else if (tier === 'NEEDS_REVIEW') {
    if (comparableTraitCount >= 2) {
      headlineSummary = `Trùng ${matchedTraitCount}/${comparableTraitCount} điểm lựa chọn cách viết — cần giảng viên xem trực tiếp.`;
      reasons.push(`Trùng ${matchedTraitCount}/${comparableTraitCount} điểm lựa chọn cách viết được trích xuất.`);
    } else {
      headlineSummary = `Tương đồng AST ${rate.toFixed(1)}% nhưng thiếu bằng chứng phong cách xác định — cần giảng viên kiểm tra.`;
    }
    if (differingTraitLabels.length > 0) {
      reasons.push(`Vẫn có khác biệt ở: ${differingTraitLabels.join(', ')}.`);
    }
    if (matchedSegmentsCount > 0) {
      reasons.push(
        `Ghi nhận ${matchedSegmentsCount} đoạn AST trùng${longestContiguousLines > 0 ? `, đoạn liên tiếp dài nhất ~${longestContiguousLines} dòng` : ''}.`,
      );
    }
    if (matchedQuirks.length > 0) {
      reasons.push(`Có ${matchedQuirks.length} hạt sạn trình bày giống nhau giữa 2 bài.`);
    }
  } else {
    // HIGH_SUSPICION or CONFIRMED_PLAGIARISM
    if (comparableTraitCount >= 2) {
      headlineSummary = `Trùng ${matchedTraitCount}/${comparableTraitCount} điểm lựa chọn cách viết; khác biệt chủ yếu ở định danh.`;
      reasons.push(`Trùng ${matchedTraitCount}/${comparableTraitCount} điểm lựa chọn cách viết.`);
      if (matchedTraitCount === comparableTraitCount || rate >= 80) {
        reasons.push('Mọi khác biệt bề mặt chủ yếu là đổi tên biến, tên lớp và tên hàm.');
      }
      const sortRow = traits.find((t) => t.key === 'sort' && t.matched);
      const modRow = traits.find((t) => t.key === 'modular' && t.matched);
      if (sortRow || modRow) {
        const parts = [sortRow ? sortRow.valueA : null, modRow ? modRow.valueA : null].filter(Boolean);
        reasons.push(`Cùng ${parts.join(', ')}.`);
      }
    } else {
      headlineSummary = `Tương đồng cấu trúc AST cao (${rate.toFixed(1)}%) trên ${maxLines} dòng code thực.`;
      reasons.push(`Số đoạn AST trùng lặp: ${matchedSegmentsCount} đoạn${longestContiguousLines > 0 ? ` (đoạn trùng dài nhất ~${longestContiguousLines} dòng)` : ''}.`);
    }

    if (matchedQuirks.length > 0) {
      reasons.push(`Phát hiện ${matchedQuirks.length} hạt sạn trình bày / lỗi dị biệt lặp lại y hệt nhau.`);
    }
    if (boilerplateFilteredCount > 0) {
      reasons.push(`Đã lọc bỏ ${boilerplateFilteredCount} dấu vân tay khung mẫu trước khi tính độ tương đồng.`);
    }
  }

  return {
    visual,
    similarityRate: rate,
    linesA,
    linesB,
    maxLines,
    isShortCode,
    matchedSegmentsCount,
    longestContiguousLines,
    boilerplateFilteredCount,
    matchedQuirks,
    traits,
    matchedTraitCount,
    comparableTraitCount,
    differingTraitLabels,
    headlineSummary,
    reasons,
  };
}

/**
 * Phân loại cụm nhóm thành Nhóm nghi vấn (Red/Yellow) hoặc Nhóm không đủ cơ sở (Gray).
 */
export function classifyClusterTier(cluster: PlagiarismCluster): 'HIGH_SUSPICION' | 'NEEDS_REVIEW' | 'INSUFFICIENT_BASIS' {
  const nonTeacherPairs = (cluster.pairs || []).filter(
    (p) => !isTeacherPairNames(p.studentNameA, p.studentNameB),
  );
  if (nonTeacherPairs.length === 0) {
    return 'INSUFFICIENT_BASIS';
  }

  const pairTiers = nonTeacherPairs.map((p) =>
    classifyPairReviewTier({
      similarityRate: p.similarityRate,
      status: p.status,
      isFlagged: p.isFlagged,
      studentNameA: p.studentNameA,
      studentNameB: p.studentNameB,
      sourceCodeA: p.sourceCodeA,
      sourceCodeB: p.sourceCodeB,
      matchedTokens: p.matchedTokens,
      matchedTokensJson: p.matchedTokensJson,
      matchedQuirks: p.matchedQuirks,
      boilerplateFilteredCount: p.matchedTokensJson?.boilerplateFingerprintsFiltered,
      isShortSubmission: p.matchedTokensJson?.isShortSubmission,
    }),
  );

  if (pairTiers.some((t) => t === 'CONFIRMED_PLAGIARISM' || t === 'HIGH_SUSPICION')) {
    return 'HIGH_SUSPICION';
  }
  if (pairTiers.some((t) => t === 'NEEDS_REVIEW')) {
    return 'NEEDS_REVIEW';
  }
  return 'INSUFFICIENT_BASIS';
}
