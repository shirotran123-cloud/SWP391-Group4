/**
 * AST Plagiarism Engine (Gateway mirror) - RBL Research Core (AITA Autograding Engine)
 *
 * ⚠️ SINGLE ALGORITHM, TWO DEPLOYMENT TARGETS:
 * This file is a byte-for-byte behavioural MIRROR of the canonical GenAI Hub AST engine so the
 * gateway can perform REAL AST/Winnowing plagiarism detection offline (no HTTP dependency on the
 * hub, no Docker/Redis/Postgres required). Keep both copies in sync.
 *
 * Canonical source files (do NOT diverge without editing all three):
 *   genai-hub/src/ast-engine/ast-normalizer.ts   -> ASTNormalizer
 *   genai-hub/src/ast-engine/winnowing.ts        -> WinnowingEngine
 *   genai-hub/src/ast-engine/plagiarism-engine.ts-> ASTPlagiarismEngine
 *
 * Public function names/shapes are intentionally identical (`ASTNormalizer.normalize`,
 * `WinnowingEngine.computeFingerprints`, `ASTPlagiarismEngine.compareSubmissions`,
 * `ASTPlagiarismEngine.computeClassSimilarityMatrix`) so results match the hub exactly.
 *
 * Algorithm: structural AST token normalization (strips identifiers, literals, comments, blanks)
 * + Schleimer/Wilkerson/Aiken Winnowing (k-gram FNV-1a min-hash over a sliding window w)
 * + ensemble similarity (65% winnowing containment + 35% AST structural cosine), flag >= 70%.
 */

export type NormalizedTokenType =
  | 'FUNC_DEF'
  | 'PARAM_DECL'
  | 'VAR_DECL'
  | 'CLASS_DECL'
  | 'COND_STMT'
  | 'LOOP_STMT'
  | 'TRY_CATCH'
  | 'RETURN_STMT'
  | 'JUMP_STMT'
  | 'BIN_OP'
  | 'UN_OP'
  | 'ASSIGN_OP'
  | 'CALL_EXPR'
  | 'LITERAL'
  | 'BLOCK_OPEN'
  | 'BLOCK_CLOSE';

export interface NormalizedToken {
  token: NormalizedTokenType;
  lineStart: number;
  lineEnd: number;
  colStart: number;
  colEnd: number;
  originalSnippet?: string;
}

export interface NormalizationResult {
  tokens: NormalizedToken[];
  normalizedString: string;
  totalLines: number;
  totalOriginalTokensCount: number;
}

export class ASTNormalizer {
  /**
   * Main entrypoint to normalize source code into structural AST tokens.
   */
  public static normalize(code: string, language: string = 'python'): NormalizationResult {
    const langLower = (language || 'python').toLowerCase();

    if (langLower.includes('py')) {
      return this.normalizePython(code);
    } else if (langLower.includes('js') || langLower.includes('ts') || langLower.includes('script')) {
      return this.normalizeCStyle(code, true);
    } else {
      return this.normalizeCStyle(code, false);
    }
  }

  /**
   * Normalizer implementation for Python code structures
   */
  private static normalizePython(code: string): NormalizationResult {
    const safeCode = typeof code === 'string' ? code : '';
    const lines = safeCode.split(/\r?\n/);
    const tokens: NormalizedToken[] = [];

    let insideDocstring = false;

    for (let lIndex = 0; lIndex < lines.length; lIndex++) {
      let line = lines[lIndex];
      const lineNumber = lIndex + 1;

      // Handle multiline docstrings (''' or """)
      if (line.includes('"""') || line.includes("'''")) {
        const count = (line.match(/"""|'''/g) || []).length;
        if (count % 2 !== 0) {
          insideDocstring = !insideDocstring;
        }
        if (insideDocstring) continue;
      }
      if (insideDocstring) continue;

      // Strip single-line comments (# or //)
      const hashIdx = line.indexOf('#');
      if (hashIdx !== -1) {
        line = line.substring(0, hashIdx);
      }
      const doubleSlashIdx = line.indexOf('//');
      if (doubleSlashIdx !== -1) {
        line = line.substring(0, doubleSlashIdx);
      }

      if (!line.trim()) continue;

      this.tokenizePythonLine(line, lineNumber, tokens);
    }

    const normalizedString = tokens.map((t) => t.token).join(' ');
    return {
      tokens,
      normalizedString,
      totalLines: lines.length,
      totalOriginalTokensCount: tokens.length,
    };
  }

  /**
   * Tokenizes a single line of Python code into canonical AST tokens
   */
  private static tokenizePythonLine(line: string, lineNum: number, outTokens: NormalizedToken[]) {
    const regex = /\b(def|class|if|elif|else|for|while|return|break|continue|try|except|finally|import|from|as|in|is|and|or|not|with|yield|pass|raise|lambda)\b|([0-9]+\.?[0-9]*|"[^"]*"|'[^']*')|([a-zA-Z_][a-zA-Z0-9_]*)|(\+=|-=|\*=|\/=|==|!=|<=|>=|\|\||&&|=|\+|\-|\*|\/|%|<|>|\(|\)|\[\]|\{|\}|:|,)/g;

    let match: RegExpExecArray | null;
    let expectingFuncName = false;

    while ((match = regex.exec(line)) !== null) {
      const matchedText = match[0];
      const colStart = match.index + 1;
      const colEnd = colStart + matchedText.length;

      const keyword = match[1];
      const literal = match[2];
      const identifier = match[3];
      const symbol = match[4];

      if (keyword) {
        let tokenType: NormalizedTokenType = 'VAR_DECL';
        switch (keyword) {
          case 'def':
            tokenType = 'FUNC_DEF';
            expectingFuncName = true;
            break;
          case 'class':
            tokenType = 'CLASS_DECL';
            break;
          case 'if':
          case 'elif':
          case 'else':
            tokenType = 'COND_STMT';
            break;
          case 'for':
          case 'while':
            tokenType = 'LOOP_STMT';
            break;
          case 'return':
          case 'yield':
            tokenType = 'RETURN_STMT';
            break;
          case 'break':
          case 'continue':
          case 'pass':
            tokenType = 'JUMP_STMT';
            break;
          case 'try':
          case 'except':
          case 'finally':
            tokenType = 'TRY_CATCH';
            break;
          case 'and':
          case 'or':
          case 'not':
          case 'is':
          case 'in':
            tokenType = 'BIN_OP';
            break;
          default:
            tokenType = 'VAR_DECL';
        }
        outTokens.push({ token: tokenType, lineStart: lineNum, lineEnd: lineNum, colStart, colEnd, originalSnippet: matchedText });
      } else if (literal) {
        outTokens.push({ token: 'LITERAL', lineStart: lineNum, lineEnd: lineNum, colStart, colEnd, originalSnippet: matchedText });
      } else if (identifier) {
        if (expectingFuncName) {
          outTokens.push({ token: 'VAR_DECL', lineStart: lineNum, lineEnd: lineNum, colStart, colEnd, originalSnippet: matchedText });
          expectingFuncName = false;
        } else {
          const remaining = line.substring(match.index + matchedText.length).trimStart();
          if (remaining.startsWith('(')) {
            outTokens.push({ token: 'CALL_EXPR', lineStart: lineNum, lineEnd: lineNum, colStart, colEnd, originalSnippet: matchedText });
          } else {
            outTokens.push({ token: 'VAR_DECL', lineStart: lineNum, lineEnd: lineNum, colStart, colEnd, originalSnippet: matchedText });
          }
        }
      } else if (symbol) {
        if (['=', '+=', '-=', '*=', '/='].includes(symbol)) {
          outTokens.push({ token: 'ASSIGN_OP', lineStart: lineNum, lineEnd: lineNum, colStart, colEnd, originalSnippet: symbol });
        } else if (['==', '!=', '<=', '>=', '+', '-', '*', '/', '%', '<', '>'].includes(symbol)) {
          outTokens.push({ token: 'BIN_OP', lineStart: lineNum, lineEnd: lineNum, colStart, colEnd, originalSnippet: symbol });
        } else if (symbol === '{') {
          outTokens.push({ token: 'BLOCK_OPEN', lineStart: lineNum, lineEnd: lineNum, colStart, colEnd });
        } else if (symbol === '}') {
          outTokens.push({ token: 'BLOCK_CLOSE', lineStart: lineNum, lineEnd: lineNum, colStart, colEnd });
        }
      }
    }
  }

  /**
   * Normalizer implementation for C-Style (C/C++, Java, JS/TS) code structures
   */
  private static normalizeCStyle(code: string, isJsTs: boolean): NormalizationResult {
    const safeCode = typeof code === 'string' ? code : '';
    const lines = safeCode.split(/\r?\n/);
    const tokens: NormalizedToken[] = [];

    let insideBlockComment = false;

    for (let lIndex = 0; lIndex < lines.length; lIndex++) {
      let line = lines[lIndex];
      const lineNumber = lIndex + 1;

      if (line.includes('/*')) {
        insideBlockComment = true;
      }
      if (insideBlockComment) {
        if (line.includes('*/')) {
          insideBlockComment = false;
        }
        continue;
      }

      const doubleSlash = line.indexOf('//');
      if (doubleSlash !== -1) {
        line = line.substring(0, doubleSlash);
      }

      if (!line.trim()) continue;

      this.tokenizeCStyleLine(line, lineNumber, tokens);
    }

    const normalizedString = tokens.map((t) => t.token).join(' ');
    return {
      tokens,
      normalizedString,
      totalLines: lines.length,
      totalOriginalTokensCount: tokens.length,
    };
  }

  private static tokenizeCStyleLine(line: string, lineNum: number, outTokens: NormalizedToken[]) {
    const regex = /\b(function|def|class|public|private|protected|static|void|int|double|float|char|boolean|let|var|const|if|else|for|while|do|return|break|continue|try|catch|finally)\b|([0-9]+\.?[0-9]*|"[^"]*"|'[^']*')|([a-zA-Z_][a-zA-Z0-9_]*)|(\+=|-=|\*=|\/=|==|!=|<=|>=|&&|\|\||=|\+|\-|\*|\/|%|<|>|\{|\}|\(|\)|\[\]|;)/g;

    let match: RegExpExecArray | null;
    let expectingFuncName = false;

    while ((match = regex.exec(line)) !== null) {
      const matchedText = match[0];
      const colStart = match.index + 1;
      const colEnd = colStart + matchedText.length;

      const keyword = match[1];
      const literal = match[2];
      const identifier = match[3];
      const symbol = match[4];

      if (keyword) {
        let tokenType: NormalizedTokenType = 'VAR_DECL';
        switch (keyword) {
          case 'function':
          case 'void':
            tokenType = 'FUNC_DEF';
            expectingFuncName = true;
            break;
          case 'class':
            tokenType = 'CLASS_DECL';
            break;
          case 'if':
          case 'else':
            tokenType = 'COND_STMT';
            break;
          case 'for':
          case 'while':
          case 'do':
            tokenType = 'LOOP_STMT';
            break;
          case 'return':
            tokenType = 'RETURN_STMT';
            break;
          case 'break':
          case 'continue':
            tokenType = 'JUMP_STMT';
            break;
          case 'try':
          case 'catch':
          case 'finally':
            tokenType = 'TRY_CATCH';
            break;
          default:
            tokenType = 'VAR_DECL';
        }
        outTokens.push({ token: tokenType, lineStart: lineNum, lineEnd: lineNum, colStart, colEnd, originalSnippet: matchedText });
      } else if (literal) {
        outTokens.push({ token: 'LITERAL', lineStart: lineNum, lineEnd: lineNum, colStart, colEnd, originalSnippet: matchedText });
      } else if (identifier) {
        if (expectingFuncName) {
          outTokens.push({ token: 'VAR_DECL', lineStart: lineNum, lineEnd: lineNum, colStart, colEnd, originalSnippet: matchedText });
          expectingFuncName = false;
        } else {
          const remaining = line.substring(match.index + matchedText.length).trimStart();
          if (remaining.startsWith('(')) {
            outTokens.push({ token: 'CALL_EXPR', lineStart: lineNum, lineEnd: lineNum, colStart, colEnd, originalSnippet: matchedText });
          } else {
            outTokens.push({ token: 'VAR_DECL', lineStart: lineNum, lineEnd: lineNum, colStart, colEnd, originalSnippet: matchedText });
          }
        }
      } else if (symbol) {
        if (['=', '+=', '-=', '*=', '/='].includes(symbol)) {
          outTokens.push({ token: 'ASSIGN_OP', lineStart: lineNum, lineEnd: lineNum, colStart, colEnd, originalSnippet: symbol });
        } else if (['==', '!=', '<=', '>=', '&&', '||', '+', '-', '*', '/', '%', '<', '>'].includes(symbol)) {
          outTokens.push({ token: 'BIN_OP', lineStart: lineNum, lineEnd: lineNum, colStart, colEnd, originalSnippet: symbol });
        } else if (symbol === '{') {
          outTokens.push({ token: 'BLOCK_OPEN', lineStart: lineNum, lineEnd: lineNum, colStart, colEnd });
        } else if (symbol === '}') {
          outTokens.push({ token: 'BLOCK_CLOSE', lineStart: lineNum, lineEnd: lineNum, colStart, colEnd });
        }
      }
    }
  }
}

export interface Fingerprint {
  hashValue: string;
  hashNumeric: bigint;
  lineStart: number;
  lineEnd: number;
  tokenStart: number;
  tokenEnd: number;
  tokenCount: number;
}

export interface WinnowingOptions {
  kGramSize?: number; // k = 5 default
  windowSize?: number; // w = 3 default
}

export class WinnowingEngine {
  public static readonly DEFAULT_K = 5;
  public static readonly DEFAULT_W = 3;

  /**
   * Generates Winnowing digital fingerprints from normalized AST tokens.
   */
  public static computeFingerprints(tokens: NormalizedToken[], options?: WinnowingOptions): Fingerprint[] {
    const k = options?.kGramSize ?? this.DEFAULT_K;
    const w = options?.windowSize ?? this.DEFAULT_W;

    if (!tokens || tokens.length === 0) return [];

    if (tokens.length < k) {
      const hashStr = tokens.map((t) => t.token).join('_');
      const hashNum = this.fnv1a64(hashStr);
      return [
        {
          hashValue: hashNum.toString(16).padStart(16, '0'),
          hashNumeric: hashNum,
          lineStart: tokens[0].lineStart,
          lineEnd: tokens[tokens.length - 1].lineEnd,
          tokenStart: 0,
          tokenEnd: tokens.length - 1,
          tokenCount: tokens.length,
        },
      ];
    }

    // 1. Generate k-grams and their corresponding hash values & line bounds
    const kGrams: {
      hashValue: string;
      hashNumeric: bigint;
      lineStart: number;
      lineEnd: number;
      tokenStart: number;
      tokenEnd: number;
    }[] = [];

    for (let i = 0; i <= tokens.length - k; i++) {
      const windowTokens = tokens.slice(i, i + k);
      const tokenSequenceStr = windowTokens.map((t) => t.token).join(' ');
      const hashNumeric = this.fnv1a64(tokenSequenceStr);
      const hashValue = hashNumeric.toString(16).padStart(16, '0');

      kGrams.push({
        hashValue,
        hashNumeric,
        lineStart: windowTokens[0].lineStart,
        lineEnd: windowTokens[windowTokens.length - 1].lineEnd,
        tokenStart: i,
        tokenEnd: i + k - 1,
      });
    }

    // 2. Sliding window of size w over k-grams hash sequence
    const fingerprintsMap = new Map<string, Fingerprint>();
    const effectiveWindow = Math.min(w, kGrams.length);

    let minIndex = -1;

    for (let i = 0; i <= kGrams.length - effectiveWindow; i++) {
      let windowMinIndex = i;
      let minHash = kGrams[i].hashNumeric;

      for (let j = 1; j < effectiveWindow; j++) {
        const idx = i + j;
        if (kGrams[idx].hashNumeric <= minHash) {
          minHash = kGrams[idx].hashNumeric;
          windowMinIndex = idx;
        }
      }

      if (windowMinIndex !== minIndex) {
        minIndex = windowMinIndex;
        const selected = kGrams[minIndex];
        const key = `${selected.hashValue}_${selected.tokenStart}_${selected.tokenEnd}`;

        if (!fingerprintsMap.has(key)) {
          fingerprintsMap.set(key, {
            hashValue: selected.hashValue,
            hashNumeric: selected.hashNumeric,
            lineStart: selected.lineStart,
            lineEnd: selected.lineEnd,
            tokenStart: selected.tokenStart,
            tokenEnd: selected.tokenEnd,
            tokenCount: k,
          });
        }
      }
    }

    return Array.from(fingerprintsMap.values());
  }

  /**
   * Fast 64-bit FNV-1a non-cryptographic hash algorithm for k-grams
   */
  private static fnv1a64(str: string): bigint {
    let hash = 14695981039346656037n;
    const FNV_PRIME = 1099511628211n;

    for (let i = 0; i < str.length; i++) {
      hash ^= BigInt(str.charCodeAt(i));
      hash = (hash * FNV_PRIME) & 0xffffffffffffffffn;
    }

    return hash;
  }
}

export interface CodeSubmission {
  submissionId: string;
  studentName?: string;
  studentId?: string;
  sourceCode: string;
  filePath?: string;
  language?: string;
}

export interface MatchedSegment {
  hashValue: string;
  lineRangeA: { start: number; end: number };
  lineRangeB: { start: number; end: number };
  tokenRangeA: { start: number; end: number };
  tokenRangeB: { start: number; end: number };
  tokenCount: number;
}

export interface MatchedTokensJson {
  submissionAId: string;
  submissionBId: string;
  similarityRate: number;
  jaccardSimilarity: number;
  winnowingContainment: number;
  astStructuralSimilarity: number;
  totalUniqueFingerprintsA: number;
  totalUniqueFingerprintsB: number;
  commonFingerprintsCount: number;
  matchedSegments: MatchedSegment[];
}

export interface PairwisePlagiarismResult {
  submissionAId: string;
  submissionBId: string;
  similarityRate: number; // Ensemble similarity score
  commonFingerprintsCount: number;
  totalUniqueFingerprints: number;
  isFlagged: boolean; // >= 70% threshold
  status: 'CLEAN' | 'SUSPECTED' | 'FLAGGED_HIGH' | 'FLAGGED_PLAGIARISM';
  matchedTokensJson: MatchedTokensJson;
  executionTimeMs: number;
}

export interface ClassPlagiarismMatrixReport {
  assignmentId?: string;
  totalSubmissions: number;
  totalPairsCompared: number;
  flaggedPairsCount: number; // Pairs >= 70%
  submissionsList: { id: string; name?: string }[];
  similarityMatrix: number[][]; // N x N matrix (percentage values)
  flaggedReports: PairwisePlagiarismResult[];
  totalExecutionTimeMs: number;
}

export class ASTPlagiarismEngine {
  public static readonly PLAGIARISM_THRESHOLD = 70.0; // 70% by task spec

  /**
   * Compares two single submissions and computes Jaccard + Winnowing Containment + AST Structural Cosine Similarity
   */
  public static compareSubmissions(
    subA: CodeSubmission,
    subB: CodeSubmission,
    options?: WinnowingOptions,
  ): PairwisePlagiarismResult {
    const startTime = Date.now();

    // 1. AST Normalize
    const normA = ASTNormalizer.normalize(subA.sourceCode, subA.language || 'python');
    const normB = ASTNormalizer.normalize(subB.sourceCode, subB.language || 'python');

    // 2. Compute Winnowing Fingerprints
    const fingerprintsA = WinnowingEngine.computeFingerprints(normA.tokens, options);
    const fingerprintsB = WinnowingEngine.computeFingerprints(normB.tokens, options);

    // 3. Winnowing Containment & Jaccard Calculation
    const setAHashes = new Set(fingerprintsA.map((f) => f.hashValue));
    const setBHashes = new Set(fingerprintsB.map((f) => f.hashValue));

    const mapB = new Map<string, Fingerprint[]>();
    for (const f of fingerprintsB) {
      if (!mapB.has(f.hashValue)) mapB.set(f.hashValue, []);
      mapB.get(f.hashValue)!.push(f);
    }

    const matchedSegments: MatchedSegment[] = [];

    for (const fA of fingerprintsA) {
      if (setBHashes.has(fA.hashValue)) {
        const matchesInB = mapB.get(fA.hashValue) || [];
        for (const fB of matchesInB) {
          matchedSegments.push({
            hashValue: fA.hashValue,
            lineRangeA: { start: fA.lineStart, end: fA.lineEnd },
            lineRangeB: { start: fB.lineStart, end: fB.lineEnd },
            tokenRangeA: { start: fA.tokenStart, end: fA.tokenEnd },
            tokenRangeB: { start: fB.tokenStart, end: fB.tokenEnd },
            tokenCount: fA.tokenCount,
          });
        }
      }
    }

    const unionSet = new Set([...setAHashes, ...setBHashes]);
    const unionSize = unionSet.size === 0 ? 1 : unionSet.size;

    const commonHashesSet = new Set([...setAHashes].filter((h) => setBHashes.has(h)));
    const commonCount = commonHashesSet.size;

    const jaccardSimilarity = Number(((commonCount / unionSize) * 100).toFixed(2));
    const minSetSize = Math.min(setAHashes.size, setBHashes.size);
    const winnowingContainment = minSetSize > 0 ? Number(((commonCount / minSetSize) * 100).toFixed(2)) : 0.0;

    // 4. AST Structural Vector Cosine Similarity
    const astStructuralSimilarity = this.computeASTTokenCosineSimilarity(normA.tokens, normB.tokens);

    // 5. Ensemble Similarity Rate (65% Winnowing + 35% AST Structural Profile)
    // If winnowing containment is 100% (exact match), similarity is 100%
    let similarityRate = 0.0;
    if (winnowingContainment >= 99.0) {
      similarityRate = 100.0;
    } else {
      similarityRate = Number((0.65 * winnowingContainment + 0.35 * astStructuralSimilarity).toFixed(2));
    }

    const isFlagged = similarityRate >= this.PLAGIARISM_THRESHOLD;
    const status = isFlagged ? 'FLAGGED_PLAGIARISM' : similarityRate >= 40.0 ? 'SUSPECTED' : 'CLEAN';

    const matchedTokensJson: MatchedTokensJson = {
      submissionAId: subA.submissionId,
      submissionBId: subB.submissionId,
      similarityRate,
      jaccardSimilarity,
      winnowingContainment,
      astStructuralSimilarity,
      totalUniqueFingerprintsA: setAHashes.size,
      totalUniqueFingerprintsB: setBHashes.size,
      commonFingerprintsCount: commonCount,
      matchedSegments,
    };

    const executionTimeMs = Date.now() - startTime;

    return {
      submissionAId: subA.submissionId,
      submissionBId: subB.submissionId,
      similarityRate,
      commonFingerprintsCount: commonCount,
      totalUniqueFingerprints: unionSize,
      isFlagged,
      status,
      matchedTokensJson,
      executionTimeMs,
    };
  }

  /**
   * Computes Cosine Similarity between AST Token Frequency Distributions
   */
  private static computeASTTokenCosineSimilarity(tokensA: NormalizedToken[], tokensB: NormalizedToken[]): number {
    const freqA = new Map<string, number>();
    const freqB = new Map<string, number>();

    for (const t of tokensA) freqA.set(t.token, (freqA.get(t.token) || 0) + 1);
    for (const t of tokensB) freqB.set(t.token, (freqB.get(t.token) || 0) + 1);

    const allKeys = new Set([...freqA.keys(), ...freqB.keys()]);
    if (allKeys.size === 0) return 100.0;

    let dotProduct = 0;
    let magA = 0;
    let magB = 0;

    for (const key of allKeys) {
      const valA = freqA.get(key) || 0;
      const valB = freqB.get(key) || 0;
      dotProduct += valA * valB;
      magA += valA * valA;
      magB += valB * valB;
    }

    if (magA === 0 || magB === 0) return 0.0;

    const cosine = dotProduct / (Math.sqrt(magA) * Math.sqrt(magB));
    return Number((cosine * 100).toFixed(2));
  }

  /**
   * Computes full pairwise class Similarity Matrix across all submissions in a class/assignment.
   * Automatically extracts and flags pairs with similarity >= 70%.
   */
  public static computeClassSimilarityMatrix(
    submissions: CodeSubmission[],
    assignmentId?: string,
    options?: WinnowingOptions,
  ): ClassPlagiarismMatrixReport {
    const startTime = Date.now();
    const list = Array.isArray(submissions) ? submissions : [];
    const N = list.length;
    const similarityMatrix: number[][] = Array.from({ length: N }, () => Array(N).fill(100.0));
    const flaggedReports: PairwisePlagiarismResult[] = [];
    let pairsCount = 0;

    for (let i = 0; i < N; i++) {
      similarityMatrix[i][i] = 100.0;
      for (let j = i + 1; j < N; j++) {
        pairsCount++;
        const result = this.compareSubmissions(list[i], list[j], options);

        similarityMatrix[i][j] = result.similarityRate;
        similarityMatrix[j][i] = result.similarityRate;

        if (result.isFlagged) {
          flaggedReports.push(result);
        }
      }
    }

    const totalExecutionTimeMs = Date.now() - startTime;

    return {
      assignmentId,
      totalSubmissions: N,
      totalPairsCompared: pairsCount,
      flaggedPairsCount: flaggedReports.length,
      submissionsList: list.map((s) => ({
        id: s.submissionId,
        name: s.studentName || s.submissionId,
      })),
      similarityMatrix,
      flaggedReports: flaggedReports.sort((a, b) => b.similarityRate - a.similarityRate),
      totalExecutionTimeMs,
    };
  }
}
