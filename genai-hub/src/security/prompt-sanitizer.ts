/**
 * Prompt Injection Sanitizer (Rule R03, CON-03)
 * Protects GenAI review pipeline from adversarial student submissions.
 */

export interface SanitizationResult {
  sanitizedContent: string;
  isFlagged: boolean;
  flaggedPatterns: string[];
  originalLength: number;
  sanitizedLength: number;
  truncated: boolean;
  estimatedTokens: number;
}

export class PromptSanitizer {
  // Common adversarial injection patterns targeted at LLM evaluators
  private static readonly INJECTION_PATTERNS: Array<{ regex: RegExp; name: string }> = [
    {
      regex: /(ignore|disregard|forget)\s+(all\s+)?(previous\s+|prior\s+|above\s+)?(instructions|directives|prompts|rules|guidelines)/i,
      name: "IGNORE_PREVIOUS_INSTRUCTIONS",
    },
    {
      regex: /(system\s*prompt|system\s*override|act\s+as\s+a\s+system|you\s+are\s+now\s+a)/i,
      name: "SYSTEM_ROLE_HIJACK",
    },
    {
      regex: /(give\s+me|assign|award|rate|grade|score)\s+(me\s+)?(a\s+)?(10|10\.0|100|max\s+score|perfect\s+score)/i,
      name: "SCORE_FORCING",
    },
    {
      regex: /(output|return)\s+(only\s+)?json\s*[:=]\s*\{.*clean_code_score.*10/is,
      name: "RAW_JSON_INJECTION",
    },
    {
      regex: /(jailbreak|dan\s+mode|developer\s+mode|unrestricted\s+mode)/i,
      name: "JAILBREAK_KEYWORD",
    },
    {
      regex: /(do\s+not\s+check|skip\s+(clean\s+code|solid|review|evaluation))/i,
      name: "SKIP_EVALUATION_DIRECTIVE",
    },
    {
      regex: /(assistant|chatgpt|gpt-4|claude|gemini)\s*:\s*\{/i,
      name: "ASSISTANT_TURN_MIMIC",
    },
  ];

  /**
   * Sanitizes source code to neutralize adversarial prompt injections and prevent token flooding.
   *
   * @param code Raw student source code
   * @param maxChars Maximum allowed characters before sliding window truncation (default ~32,000 chars ~= 8K tokens)
   */
  public static sanitize(code: string, maxChars = 32000): SanitizationResult {
    const originalLength = code.length;
    let text = code;
    const flaggedPatterns: string[] = [];

    // 1. Strip zero-width & invisible spoofing characters
    text = text.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, " ");

    // 2. Strip dangerous ANSI escape sequences
    text = text.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, "");

    // 3. Scan comments specifically (where students attempt injections)
    // Supports C/C++/Java (// and /* */), Python (# and """)
    const commentRegexes = [
      /\/\*[\s\S]*?\*\//g, // /* multi-line */
      /\/\/[^\n\r]*/g,     // // single-line
      /"""[\s\S]*?"""/g,   // Python triple quotes
      /'''[\s\S]*?'''/g,   // Python triple single quotes
      /#[^\n\r]*/g,        // Python single-line comment
    ];

    for (const cRegex of commentRegexes) {
      text = text.replace(cRegex, (comment) => {
        let isCommentSuspicious = false;
        for (const pattern of PromptSanitizer.INJECTION_PATTERNS) {
          if (pattern.regex.test(comment)) {
            if (!flaggedPatterns.includes(pattern.name)) {
              flaggedPatterns.push(pattern.name);
            }
            isCommentSuspicious = true;
          }
        }

        if (isCommentSuspicious) {
          // Neutralize the comment while maintaining code line structure
          return `/* [AITA_SECURITY_DEFENSE: Adversarial prompt injection comment neutralized] */`;
        }
        return comment;
      });
    }

    // 4. Token Sliding Window / Truncation check (CON-03: Max 8K tokens ~ 32K chars)
    let truncated = false;
    if (text.length > maxChars) {
      truncated = true;
      const headTarget = Math.floor(maxChars * 0.7);
      const tailTarget = Math.floor(maxChars * 0.25);

      // Snap to nearest newline boundary to keep source code lines intact
      const headBoundary = text.lastIndexOf("\n", headTarget);
      const headEnd = headBoundary > 0 ? headBoundary : headTarget;

      const tailBoundary = text.indexOf("\n", text.length - tailTarget);
      const tailStart = tailBoundary > 0 ? tailBoundary + 1 : text.length - tailTarget;

      const head = text.substring(0, headEnd);
      const tail = text.substring(tailStart);
      text = `${head}\n\n// --- [AITA NOTICE: Middle content truncated at line boundaries to fit 8K token window] ---\n\n${tail}`;
    }

    return {
      sanitizedContent: text,
      isFlagged: flaggedPatterns.length > 0,
      flaggedPatterns,
      originalLength,
      sanitizedLength: text.length,
      truncated,
      estimatedTokens: PromptSanitizer.estimateTokens(text),
    };
  }

  /**
   * Prepares code safely inside an XML-wrapped isolation block
   * so the LLM treats it purely as untrusted passive data.
   */
  /**
   * Fast BPE token count estimation (~4 characters per token for source code).
   */
  public static estimateTokens(text: string): number {
    if (!text) return 0;
    // Compress repeated whitespace for better subword estimation
    const normalized = text.replace(/[ \t]+/g, " ");
    return Math.ceil(normalized.length / 3.8);
  }

  public static wrapInIsolationBoundary(filename: string, sanitizedCode: string): string {
    return `<student_submission_file name="${filename}">\n<![CDATA[\n${sanitizedCode}\n]]>\n</student_submission_file>`;
  }
}