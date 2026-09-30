import { ILLMProvider } from "./llm-provider.interface";
import { LLMMessage, LLMOptions, LLMResponse } from "../types/provider.types";

export class MockProvider implements ILLMProvider {
  public readonly providerName = "AITA-Mock-LLM-Engine";

  public async generateCompletion(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse> {
    const userMsg = messages.find((m) => m.role === "user")?.content || "";

    // Check if this is an Exam generation request
    if (userMsg.includes("GENERATE_EXAM") || userMsg.includes("learningOutcomes")) {
      const mockExam = {
        title: "Matrix Operations & Memory Management",
        courseCode: "PRG211",
        difficulty: "MEDIUM",
        language: "cpp",
        description: "Implement a dynamic 2D Matrix calculator supporting addition and transposition.",
        problemStatement:
          "Write a program that accepts a matrix dimension N x M, reads the matrix elements, and outputs both the transposed matrix and row sums.",
        constraints: ["1 <= N, M <= 100", "-10^4 <= Matrix[i][j] <= 10^4", "Memory leak free (all dynamic memory deallocated)"],
        inputFormat: "First line: N M. Next N lines: M integers per line.",
        outputFormat: "Output transposed matrix followed by line of row sums.",
        sampleTestCases: [
          {
            id: 1,
            input: "2 2\n1 2\n3 4",
            expectedOutput: "1 3\n2 4\nRow sums: 3 7",
            isHidden: false,
            weight: 2.0,
            explanation: "Basic 2x2 matrix transposition and summation.",
          },
        ],
        hiddenTestCases: [
          {
            id: 2,
            input: "3 2\n10 20\n30 40\n50 60",
            expectedOutput: "10 30 50\n20 40 60\nRow sums: 30 70 110",
            isHidden: true,
            weight: 3.0,
            explanation: "Non-square rectangular matrix bounds check.",
          },
        ],
        rubric: [
          {
            criterion: "Correct Transposition Logic",
            maxScore: 4.0,
            description: "Correctly flips rows and columns.",
            levels: [
              { scorePercent: 100, description: "All test cases pass including rectangular matrices." },
              { scorePercent: 50, description: "Works only on square matrices." },
              { scorePercent: 0, description: "Incorrect logic or crashes." },
            ],
          },
          {
            criterion: "Memory Deallocation",
            maxScore: 3.0,
            description: "Properly frees heap-allocated arrays.",
            levels: [
              { scorePercent: 100, description: "All delete[] calls invoked without double-free." },
              { scorePercent: 0, description: "Memory leak detected." },
            ],
          },
        ],
        starterCode: "#include <iostream>\nusing namespace std;\n\nint main() {\n    // TODO: implement\n    return 0;\n}",
        referenceSolution:
          "#include <iostream>\nusing namespace std;\n\nint main() {\n    int n, m;\n    if (!(cin >> n >> m)) return 0;\n    // Clean reference implementation\n    return 0;\n}",
      };

      return {
        content: JSON.stringify(mockExam),
        parsedJson: mockExam,
        model: "aita-mock-exam-v1",
        usage: { prompt_tokens: 350, completion_tokens: 420, total_tokens: 770 },
      };
    }

    // Default: Code Review Analysis
    let cleanCodeScore = 8.5;
    let solidScore = 8.0;
    const smells: any[] = [];

    // Analyze code heuristics
    const hasLongFunction = userMsg.length > 1500;
    const hasGodClass = /class\s+\w*Manager\w*/i.test(userMsg) || /class\s+\w*God\w*/i.test(userMsg);
    const hasMagicNumbers = /(?<=\s)[0-9]{3,}(?=\s|;)/.test(userMsg);
    const hasSingleLetterVars = /\b(int|float|double|char)\s+[a-z]\s*;/i.test(userMsg);
    const hasCompilerError = /COMPILER_ERROR|error:|undefined reference|syntax error/i.test(userMsg);

    if (hasGodClass) {
      solidScore -= 3.0;
      smells.push({
        file: "solution.cpp",
        line_start: 12,
        line_end: 95,
        severity: "CRITICAL",
        rule: "Single Responsibility Principle (SRP)",
        smell_type: "God Class / Bloated Controller",
        suggestion:
          "Split the God Class into separate focused classes: separate business calculation, I/O presentation, and validation logic.",
      });
    }

    if (hasSingleLetterVars || hasMagicNumbers) {
      cleanCodeScore -= 2.0;
      smells.push({
        file: "solution.cpp",
        line_start: 24,
        line_end: 28,
        severity: "WARNING",
        rule: "Meaningful Names & Magic Literals",
        smell_type: "Magic Numbers / Unclear Identifiers",
        suggestion:
          "Replace cryptic single-letter variables and raw numbers with self-explanatory named constants (e.g. const int MAX_BUFFER_SIZE = 1024;).",
      });
    }

    if (hasLongFunction) {
      cleanCodeScore -= 1.5;
      smells.push({
        file: "solution.cpp",
        line_start: 35,
        line_end: 80,
        severity: "WARNING",
        rule: "Small Functions & High Cohesion",
        smell_type: "Long Method",
        suggestion:
          "Extract subroutines from the large method into smaller helper functions with a single responsibility.",
      });
    }

    let compilerExplanation = "";
    if (hasCompilerError) {
      compilerExplanation =
        "The compiler failed due to an unclosed block or undefined symbol. Check your header inclusions and verify every opening brace '{' has a matching closing brace '}'.";
    }

    const result = {
      clean_code_score: Math.max(1.0, Math.min(10.0, Number(cleanCodeScore.toFixed(1)))),
      solid_score: Math.max(1.0, Math.min(10.0, Number(solidScore.toFixed(1)))),
      overall_summary:
        smells.length === 0
          ? "The submission follows clean coding practices with modular functions, clear naming conventions, and adherence to SOLID design principles."
          : `The submission exhibits ${smells.length} architectural smell(s). Addressing the Single Responsibility and naming issues will significantly improve maintainability.`,
      code_smells: smells,
      compiler_explanation: compilerExplanation,
    };

    return {
      content: JSON.stringify(result),
      parsedJson: result,
      model: "aita-mock-reviewer-v1",
      usage: {
        prompt_tokens: 520,
        completion_tokens: 280,
        total_tokens: 800,
      },
    };
  }
}
