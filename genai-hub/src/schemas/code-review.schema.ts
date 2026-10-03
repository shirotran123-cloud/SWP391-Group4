/**
 * Strict JSON Schema definition for LLM structured outputs.
 * Compatible with OpenAI JSON Schema mode and Google Gemini responseSchema
 * (provider-specific adaptation is handled by schema-adapter.ts).
 */

const SOLID_AXIS = (description: string) => ({
  type: "number",
  description,
  minimum: 0.0,
  maximum: 10.0,
});

export const CODE_REVIEW_JSON_SCHEMA = {
  type: "object",
  properties: {
    clean_code_score: {
      type: "number",
      description: "Clean code rating from 0.0 to 10.0 assessing readability, naming, function length, DRY.",
      minimum: 0.0,
      maximum: 10.0,
    },
    solid_score: {
      type: "number",
      description: "Aggregate SOLID rating from 0.0 to 10.0 (average of the five principle scores).",
      minimum: 0.0,
      maximum: 10.0,
    },
    solid_breakdown: {
      type: "object",
      description: "Per-principle SOLID scores used to render the 5-axis radar chart.",
      properties: {
        srp: SOLID_AXIS("Single Responsibility Principle score (0.0 - 10.0)."),
        ocp: SOLID_AXIS("Open/Closed Principle score (0.0 - 10.0)."),
        lsp: SOLID_AXIS("Liskov Substitution Principle score (0.0 - 10.0)."),
        isp: SOLID_AXIS("Interface Segregation Principle score (0.0 - 10.0)."),
        dip: SOLID_AXIS("Dependency Inversion Principle score (0.0 - 10.0)."),
      },
      required: ["srp", "ocp", "lsp", "isp", "dip"],
      additionalProperties: false,
    },
    overall_summary: {
      type: "string",
      description: "Executive summary of code quality, strengths, and primary areas for refactoring.",
    },
    code_smells: {
      type: "array",
      description: "List of specific code smells or SOLID violations identified in the source files.",
      items: {
        type: "object",
        properties: {
          file: {
            type: "string",
            description: "Source code filename where the issue occurs.",
          },
          line_start: {
            type: "integer",
            description: "Starting line number (1-indexed).",
          },
          line_end: {
            type: "integer",
            description: "Ending line number (1-indexed).",
          },
          severity: {
            type: "string",
            enum: ["INFO", "WARNING", "CRITICAL"],
            description: "Severity level of the code smell.",
          },
          rule: {
            type: "string",
            description: "The Clean Code or SOLID rule violated (e.g. 'Single Responsibility Principle', 'DRY').",
          },
          smell_type: {
            type: "string",
            description: "Category of code smell (e.g. 'God Class', 'Long Method', 'Magic Numbers', 'Tight Coupling').",
          },
          suggestion: {
            type: "string",
            description: "Constructive and actionable refactoring advice.",
          },
        },
        required: ["file", "line_start", "line_end", "severity", "rule", "smell_type", "suggestion"],
        additionalProperties: false,
      },
    },
    compiler_explanation: {
      type: "string",
      description: "Student-friendly explanation of any compiler/runtime errors, or empty string if code compiles cleanly.",
    },
  },
  required: [
    "clean_code_score",
    "solid_score",
    "solid_breakdown",
    "overall_summary",
    "code_smells",
    "compiler_explanation",
  ],
  additionalProperties: false,
};

export const EXAM_GENERATION_JSON_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    courseCode: { type: "string" },
    difficulty: { type: "string", enum: ["EASY", "MEDIUM", "HARD"] },
    language: { type: "string" },
    description: { type: "string" },
    problemStatement: { type: "string" },
    constraints: {
      type: "array",
      items: { type: "string" },
    },
    inputFormat: { type: "string" },
    outputFormat: { type: "string" },
    sampleTestCases: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "integer" },
          input: { type: "string" },
          expectedOutput: { type: "string" },
          isHidden: { type: "boolean" },
          weight: { type: "number" },
          explanation: { type: "string" },
        },
        required: ["id", "input", "expectedOutput", "isHidden", "weight", "explanation"],
        additionalProperties: false,
      },
    },
    hiddenTestCases: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "integer" },
          input: { type: "string" },
          expectedOutput: { type: "string" },
          isHidden: { type: "boolean" },
          weight: { type: "number" },
          explanation: { type: "string" },
        },
        required: ["id", "input", "expectedOutput", "isHidden", "weight", "explanation"],
        additionalProperties: false,
      },
    },
    rubric: {
      type: "array",
      items: {
        type: "object",
        properties: {
          criterion: { type: "string" },
          maxScore: { type: "number" },
          description: { type: "string" },
          levels: {
            type: "array",
            items: {
              type: "object",
              properties: {
                scorePercent: { type: "number" },
                description: { type: "string" },
              },
              required: ["scorePercent", "description"],
              additionalProperties: false,
            },
          },
        },
        required: ["criterion", "maxScore", "description", "levels"],
        additionalProperties: false,
      },
    },
    starterCode: { type: "string" },
    referenceSolution: { type: "string" },
  },
  required: [
    "title",
    "courseCode",
    "difficulty",
    "language",
    "description",
    "problemStatement",
    "constraints",
    "inputFormat",
    "outputFormat",
    "sampleTestCases",
    "hiddenTestCases",
    "rubric",
    "starterCode",
    "referenceSolution",
  ],
  additionalProperties: false,
};
