/**
 * AST Normalizer Module - RBL Research Core (AITA Autograding Engine)
 *
 * Strips all variable names, function names, parameter names, comments, and literal values
 * from raw source code (Python, TypeScript/JavaScript, C/C++, Java), replacing them with
 * standardized structural AST tokens (e.g. VAR_DECL, FUNC_DEF, LOOP_STMT, COND_STMT) to counter
 * source code obfuscation (renaming, comment injection, variable camouflage).
 */

export type NormalizedTokenType =
  | "FUNC_DEF"
  | "PARAM_DECL"
  | "VAR_DECL"
  | "CLASS_DECL"
  | "COND_STMT"
  | "LOOP_STMT"
  | "TRY_CATCH"
  | "RETURN_STMT"
  | "JUMP_STMT"
  | "BIN_OP"
  | "UN_OP"
  | "ASSIGN_OP"
  | "CALL_EXPR"
  | "LITERAL"
  | "BLOCK_OPEN"
  | "BLOCK_CLOSE";

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
  public static normalize(code: string, language: string = "python"): NormalizationResult {
    const langLower = language.toLowerCase();

    if (langLower.includes("py") || langLower.includes("python")) {
      return this.normalizePython(code);
    } else if (langLower.includes("js") || langLower.includes("ts") || langLower.includes("script")) {
      return this.normalizeCStyle(code, true);
    } else {
      return this.normalizeCStyle(code, false);
    }
  }

  /**
   * Normalizer implementation for Python code structures
   */
  private static normalizePython(code: string): NormalizationResult {
    const lines = code.split(/\r?\n/);
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
      const hashIdx = line.indexOf("#");
      if (hashIdx !== -1) {
        line = line.substring(0, hashIdx);
      }
      const doubleSlashIdx = line.indexOf("//");
      if (doubleSlashIdx !== -1) {
        line = line.substring(0, doubleSlashIdx);
      }

      if (!line.trim()) continue;

      this.tokenizePythonLine(line, lineNumber, tokens);
    }

    const normalizedString = tokens.map((t) => t.token).join(" ");
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
    const regex = /\b(def|class|if|elif|else|for|while|return|break|continue|try|except|finally|import|from|as|in|is|and|or|not|with|yield|pass|raise|lambda)\b|([0-9]+\.?[0-9]*|"[^"]*"|'[^']*')|([a-zA-Z_][a-zA-Z0-9_]*)|(\+=|-=|\*=|\/=|==|!=|<=|>=|\|\||&&|\+\+|--|=|\+|\-|\*|\/|%|<|>|!|\(|\)|\[\]|\{|\}|:|,)/g;

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
        let tokenType: NormalizedTokenType = "VAR_DECL";
        switch (keyword) {
          case "def":
            tokenType = "FUNC_DEF";
            expectingFuncName = true;
            break;
          case "class":
            tokenType = "CLASS_DECL";
            break;
          case "if":
          case "elif":
          case "else":
            tokenType = "COND_STMT";
            break;
          case "for":
          case "while":
            tokenType = "LOOP_STMT";
            break;
          case "return":
          case "yield":
            tokenType = "RETURN_STMT";
            break;
          case "break":
          case "continue":
          case "pass":
            tokenType = "JUMP_STMT";
            break;
          case "try":
          case "except":
          case "finally":
            tokenType = "TRY_CATCH";
            break;
          case "and":
          case "or":
          case "not":
          case "is":
          case "in":
            tokenType = "BIN_OP";
            break;
          default:
            tokenType = "VAR_DECL";
        }
        outTokens.push({ token: tokenType, lineStart: lineNum, lineEnd: lineNum, colStart, colEnd, originalSnippet: matchedText });
      } else if (literal) {
        outTokens.push({ token: "LITERAL", lineStart: lineNum, lineEnd: lineNum, colStart, colEnd, originalSnippet: matchedText });
      } else if (identifier) {
        if (expectingFuncName) {
          outTokens.push({ token: "VAR_DECL", lineStart: lineNum, lineEnd: lineNum, colStart, colEnd, originalSnippet: matchedText });
          expectingFuncName = false;
        } else {
          const remaining = line.substring(match.index + matchedText.length).trimStart();
          if (remaining.startsWith("(")) {
            outTokens.push({ token: "CALL_EXPR", lineStart: lineNum, lineEnd: lineNum, colStart, colEnd, originalSnippet: matchedText });
          } else {
            outTokens.push({ token: "VAR_DECL", lineStart: lineNum, lineEnd: lineNum, colStart, colEnd, originalSnippet: matchedText });
          }
        }
      } else if (symbol) {
        if (["=", "+=", "-=", "*=", "/="].includes(symbol)) {
          outTokens.push({ token: "ASSIGN_OP", lineStart: lineNum, lineEnd: lineNum, colStart, colEnd, originalSnippet: symbol });
        } else if (["++", "--", "!"].includes(symbol)) {
          outTokens.push({ token: "UN_OP", lineStart: lineNum, lineEnd: lineNum, colStart, colEnd, originalSnippet: symbol });
        } else if (["==", "!=", "<=", ">=", "+", "-", "*", "/", "%", "<", ">", "&&", "||"].includes(symbol)) {
          outTokens.push({ token: "BIN_OP", lineStart: lineNum, lineEnd: lineNum, colStart, colEnd, originalSnippet: symbol });
        } else if (symbol === "{") {
          outTokens.push({ token: "BLOCK_OPEN", lineStart: lineNum, lineEnd: lineNum, colStart, colEnd });
        } else if (symbol === "}") {
          outTokens.push({ token: "BLOCK_CLOSE", lineStart: lineNum, lineEnd: lineNum, colStart, colEnd });
        }
      }
    }
  }

  /**
   * Normalizer implementation for C-Style (C/C++, Java, JS/TS) code structures
   */
  private static normalizeCStyle(code: string, isJsTs: boolean): NormalizationResult {
    const lines = code.split(/\r?\n/);
    const tokens: NormalizedToken[] = [];

    let insideBlockComment = false;

    for (let lIndex = 0; lIndex < lines.length; lIndex++) {
      let line = lines[lIndex];
      const lineNumber = lIndex + 1;

      if (line.includes("/*")) {
        insideBlockComment = true;
      }
      if (insideBlockComment) {
        if (line.includes("*/")) {
          insideBlockComment = false;
        }
        continue;
      }

      const doubleSlash = line.indexOf("//");
      if (doubleSlash !== -1) {
        line = line.substring(0, doubleSlash);
      }

      if (!line.trim()) continue;

      this.tokenizeCStyleLine(line, lineNumber, tokens);
    }

    const normalizedString = tokens.map((t) => t.token).join(" ");
    return {
      tokens,
      normalizedString,
      totalLines: lines.length,
      totalOriginalTokensCount: tokens.length,
    };
  }

  private static tokenizeCStyleLine(line: string, lineNum: number, outTokens: NormalizedToken[]) {
    const regex = /\b(function|def|class|public|private|protected|static|void|int|double|float|char|boolean|let|var|const|if|else|for|while|do|return|break|continue|try|catch|finally)\b|([0-9]+\.?[0-9]*|"[^"]*"|'[^']*')|([a-zA-Z_][a-zA-Z0-9_]*)|(\+=|-=|\*=|\/=|==|!=|<=|>=|&&|\|\||\+\+|--|=|\+|\-|\*|\/|%|<|>|!|\{|\}|\(|\)|\[\]|;)/g;

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
        let tokenType: NormalizedTokenType = "VAR_DECL";
        switch (keyword) {
          case "function":
          case "void":
            tokenType = "FUNC_DEF";
            expectingFuncName = true;
            break;
          case "class":
            tokenType = "CLASS_DECL";
            break;
          case "if":
          case "else":
            tokenType = "COND_STMT";
            break;
          case "for":
          case "while":
          case "do":
            tokenType = "LOOP_STMT";
            break;
          case "return":
            tokenType = "RETURN_STMT";
            break;
          case "break":
          case "continue":
            tokenType = "JUMP_STMT";
            break;
          case "try":
          case "catch":
          case "finally":
            tokenType = "TRY_CATCH";
            break;
          default:
            tokenType = "VAR_DECL";
        }
        outTokens.push({ token: tokenType, lineStart: lineNum, lineEnd: lineNum, colStart, colEnd, originalSnippet: matchedText });
      } else if (literal) {
        outTokens.push({ token: "LITERAL", lineStart: lineNum, lineEnd: lineNum, colStart, colEnd, originalSnippet: matchedText });
      } else if (identifier) {
        if (expectingFuncName) {
          outTokens.push({ token: "VAR_DECL", lineStart: lineNum, lineEnd: lineNum, colStart, colEnd, originalSnippet: matchedText });
          expectingFuncName = false;
        } else {
          const remaining = line.substring(match.index + matchedText.length).trimStart();
          if (remaining.startsWith("(")) {
            outTokens.push({ token: "CALL_EXPR", lineStart: lineNum, lineEnd: lineNum, colStart, colEnd, originalSnippet: matchedText });
          } else {
            outTokens.push({ token: "VAR_DECL", lineStart: lineNum, lineEnd: lineNum, colStart, colEnd, originalSnippet: matchedText });
          }
        }
      } else if (symbol) {
        if (["=", "+=", "-=", "*=", "/="].includes(symbol)) {
          outTokens.push({ token: "ASSIGN_OP", lineStart: lineNum, lineEnd: lineNum, colStart, colEnd, originalSnippet: symbol });
        } else if (["++", "--", "!"].includes(symbol)) {
          outTokens.push({ token: "UN_OP", lineStart: lineNum, lineEnd: lineNum, colStart, colEnd, originalSnippet: symbol });
        } else if (["==", "!=", "<=", ">=", "&&", "||", "+", "-", "*", "/", "%", "<", ">"].includes(symbol)) {
          outTokens.push({ token: "BIN_OP", lineStart: lineNum, lineEnd: lineNum, colStart, colEnd, originalSnippet: symbol });
        } else if (symbol === "{") {
          outTokens.push({ token: "BLOCK_OPEN", lineStart: lineNum, lineEnd: lineNum, colStart, colEnd });
        } else if (symbol === "}") {
          outTokens.push({ token: "BLOCK_CLOSE", lineStart: lineNum, lineEnd: lineNum, colStart, colEnd });
        }
      }
    }
  }
}
