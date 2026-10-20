/**
 * ASTNormalizer – Chuẩn hóa mã nguồn thành chuỗi token chuẩn hóa
 *
 * Mục tiêu: loại bỏ mọi yếu tố bề ngoài (tên biến, comment, khoảng trắng,
 * thứ tự khai báo import) để giữ lại cấu trúc thuật toán cốt lõi.
 * Kết quả: hai đoạn code giống nhau về cấu trúc dù đổi tên biến đều cho
 * cùng một chuỗi token → dễ phát hiện đạo văn có obfuscation.
 */

export interface NormalizedToken {
  token: string;     // token đã chuẩn hóa (VAR_0, FUNC_1, ...)
  line: number;      // dòng gốc trong mã nguồn
  col: number;       // cột gốc
}

export interface NormalizationResult {
  tokens: NormalizedToken[];
  tokenString: string;   // chuỗi token ghép bằng space để hash nhanh
  lineCount: number;
}

export class ASTNormalizer {
  /**
   * Chuẩn hóa mã nguồn thành danh sách token.
   * @param sourceCode  mã nguồn gốc
   * @param language    'java' | 'python' | 'cpp' | 'dotnet'
   */
  public static normalize(sourceCode: string, language = 'java'): NormalizationResult {
    const lang = language.toLowerCase();
    if (lang === 'python') return this.normalizePython(sourceCode);
    if (lang === 'cpp' || lang === 'c') return this.normalizeCpp(sourceCode);
    if (lang === 'dotnet' || lang === 'csharp' || lang === 'cs') return this.normalizeCSharp(sourceCode);
    return this.normalizeJava(sourceCode);   // default: Java
  }

  // ─────────────────────────────────────────────────────────
  // JAVA normalizer
  // ─────────────────────────────────────────────────────────
  private static normalizeJava(src: string): NormalizationResult {
    // 1. Strip comments
    let code = src
      .replace(/\/\*[\s\S]*?\*\//g, ' ')   // block comments
      .replace(/\/\/[^\n]*/g, ' ');          // line comments

    // 2. Strip string & char literals
    code = code
      .replace(/"(?:[^"\\]|\\.)*"/g, 'STR_LIT')
      .replace(/'(?:[^'\\]|\\.)*'/g, 'CHAR_LIT');

    // 3. Normalize numeric literals
    code = code.replace(/\b\d+(\.\d+)?\b/g, 'NUM_LIT');

    // 4. Collect tokens with line info
    const tokens: NormalizedToken[] = [];
    const identifierMap = new Map<string, string>();
    let varCounter = 0;
    let funcCounter = 0;
    let typeCounter = 0;

    const JAVA_KEYWORDS = new Set([
      'abstract','assert','boolean','break','byte','case','catch','char','class',
      'const','continue','default','do','double','else','enum','extends','final',
      'finally','float','for','goto','if','implements','import','instanceof','int',
      'interface','long','native','new','package','private','protected','public',
      'return','short','static','strictfp','super','switch','synchronized','this',
      'throw','throws','transient','try','void','volatile','while','true','false','null',
      // Java standard types kept as-is
      'String','Integer','Long','Double','Float','Boolean','Object','List','Map',
      'Set','ArrayList','HashMap','Scanner','System','Math','Arrays','Collections',
    ]);

    const OPERATORS = /^(==|!=|<=|>=|&&|\|\||<<|>>|>>>|\+\+|--|[+\-*/%&|^~<>!=;,.\[\](){}])/;

    const lines = code.split('\n');
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      let col = 0;
      while (col < line.length) {
        // Skip whitespace
        if (/\s/.test(line[col])) { col++; continue; }

        // Operator / punctuation
        const opMatch = line.slice(col).match(OPERATORS);
        if (opMatch) {
          tokens.push({ token: opMatch[0], line: lineIdx + 1, col });
          col += opMatch[0].length;
          continue;
        }

        // Identifier or keyword
        const idMatch = line.slice(col).match(/^[A-Za-z_$][A-Za-z0-9_$]*/);
        if (idMatch) {
          const raw = idMatch[0];
          col += raw.length;
          if (JAVA_KEYWORDS.has(raw)) {
            tokens.push({ token: raw, line: lineIdx + 1, col });
          } else {
            // Check if next non-space char is '(' → treat as function
            const rest = line.slice(col).trimStart();
            if (rest.startsWith('(')) {
              tokens.push({ token: 'FUNC', line: lineIdx + 1, col });
            } else if (/^[A-Z]/.test(raw)) {
              // PascalCase → type/class name
              tokens.push({ token: 'TYPE', line: lineIdx + 1, col });
            } else {
              tokens.push({ token: 'VAR', line: lineIdx + 1, col });
            }
          }
          continue;
        }

        // Fallback: skip single char
        col++;
      }
    }

    return {
      tokens,
      tokenString: tokens.map((t) => t.token).join(' '),
      lineCount: lines.length,
    };
  }

  // ─────────────────────────────────────────────────────────
  // PYTHON normalizer
  // ─────────────────────────────────────────────────────────
  private static normalizePython(src: string): NormalizationResult {
    let code = src
      .replace(/"""[\s\S]*?"""/g, 'STR_LIT')
      .replace(/'''[\s\S]*?'''/g, 'STR_LIT')
      .replace(/#[^\n]*/g, ' ')
      .replace(/"(?:[^"\\]|\\.)*"/g, 'STR_LIT')
      .replace(/'(?:[^'\\]|\\.)*'/g, 'STR_LIT')
      .replace(/\b\d+(\.\d+)?\b/g, 'NUM_LIT');

    const PY_KEYWORDS = new Set([
      'False','None','True','and','as','assert','async','await','break','class',
      'continue','def','del','elif','else','except','finally','for','from','global',
      'if','import','in','is','lambda','nonlocal','not','or','pass','raise','return',
      'try','while','with','yield',
      'print','range','len','int','str','float','list','dict','set','tuple','bool',
      'input','open','enumerate','zip','map','filter','sorted','reversed','sum','max','min',
    ]);

    return this._tokenizeGeneric(code, PY_KEYWORDS);
  }

  // ─────────────────────────────────────────────────────────
  // C++ normalizer
  // ─────────────────────────────────────────────────────────
  private static normalizeCpp(src: string): NormalizationResult {
    let code = src
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\/\/[^\n]*/g, ' ')
      .replace(/"(?:[^"\\]|\\.)*"/g, 'STR_LIT')
      .replace(/'(?:[^'\\]|\\.)*'/g, 'CHAR_LIT')
      .replace(/\b\d+(\.\d+)?[uUlLfF]?\b/g, 'NUM_LIT')
      .replace(/#[^\n]*/g, ' ');   // strip preprocessor directives

    const CPP_KEYWORDS = new Set([
      'auto','break','case','char','class','const','continue','default','delete','do',
      'double','else','enum','extern','float','for','friend','goto','if','inline','int',
      'long','namespace','new','nullptr','operator','private','protected','public',
      'return','short','signed','sizeof','static','struct','switch','template','this',
      'throw','try','typedef','typename','union','unsigned','using','virtual','void',
      'volatile','while','bool','true','false','string','vector','map','set','cout','cin',
      'endl','std','include','printf','scanf',
    ]);

    return this._tokenizeGeneric(code, CPP_KEYWORDS);
  }

  // ─────────────────────────────────────────────────────────
  // C# normalizer
  // ─────────────────────────────────────────────────────────
  private static normalizeCSharp(src: string): NormalizationResult {
    let code = src
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\/\/[^\n]*/g, ' ')
      .replace(/"(?:[^"\\]|\\.)*"/g, 'STR_LIT')
      .replace(/'(?:[^'\\]|\\.)*'/g, 'CHAR_LIT')
      .replace(/\b\d+(\.\d+)?[uUlLfFdDmM]?\b/g, 'NUM_LIT');

    const CS_KEYWORDS = new Set([
      'abstract','as','base','bool','break','byte','case','catch','char','checked',
      'class','const','continue','decimal','default','delegate','do','double','else',
      'enum','event','explicit','extern','false','finally','fixed','float','for',
      'foreach','goto','if','implicit','in','int','interface','internal','is','lock',
      'long','namespace','new','null','object','operator','out','override','params',
      'private','protected','public','readonly','ref','return','sbyte','sealed',
      'short','sizeof','stackalloc','static','string','struct','switch','this','throw',
      'true','try','typeof','uint','ulong','unchecked','unsafe','ushort','using',
      'var','virtual','void','volatile','while','Console','List','Dictionary','Array',
    ]);

    return this._tokenizeGeneric(code, CS_KEYWORDS);
  }

  // ─────────────────────────────────────────────────────────
  // Generic tokenizer (dùng cho Py / C++ / C#)
  // ─────────────────────────────────────────────────────────
  private static _tokenizeGeneric(code: string, keywords: Set<string>): NormalizationResult {
    const tokens: NormalizedToken[] = [];
    const identifierMap = new Map<string, string>();
    let varCounter = 0;
    let funcCounter = 0;

    const OPERATORS = /^(==|!=|<=|>=|&&|\|\||<<|>>|\+\+|--|[+\-*/%&|^~<>!=;,.\[\](){}:])/;

    const lines = code.split('\n');
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      let col = 0;
      while (col < line.length) {
        if (/\s/.test(line[col])) { col++; continue; }

        const opMatch = line.slice(col).match(OPERATORS);
        if (opMatch) {
          tokens.push({ token: opMatch[0], line: lineIdx + 1, col });
          col += opMatch[0].length;
          continue;
        }

        const idMatch = line.slice(col).match(/^[A-Za-z_][A-Za-z0-9_]*/);
        if (idMatch) {
          const raw = idMatch[0];
          col += raw.length;
          if (keywords.has(raw)) {
            tokens.push({ token: raw, line: lineIdx + 1, col });
          } else {
            const rest = line.slice(col).trimStart();
            if (rest.startsWith('(')) {
              tokens.push({ token: 'FUNC', line: lineIdx + 1, col });
            } else if (/^[A-Z]/.test(raw)) {
              tokens.push({ token: 'TYPE', line: lineIdx + 1, col });
            } else {
              tokens.push({ token: 'VAR', line: lineIdx + 1, col });
            }
          }
          continue;
        }

        col++;
      }
    }

    return {
      tokens,
      tokenString: tokens.map((t) => t.token).join(' '),
      lineCount: lines.length,
    };
  }
}
