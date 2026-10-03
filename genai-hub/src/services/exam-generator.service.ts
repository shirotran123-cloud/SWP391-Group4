import { ILLMProvider } from "../providers/llm-provider.interface";
import { ExamGenerateRequest, GeneratedExam } from "../types/exam.types";
import { EXAM_GENERATION_JSON_SCHEMA } from "../schemas/code-review.schema";

export class ExamGeneratorService {
  private provider: ILLMProvider;

  constructor(provider: ILLMProvider) {
    this.provider = provider;
  }

  public setProvider(provider: ILLMProvider): void {
    this.provider = provider;
  }

  /**
   * Generates a complete exam problem with test cases, grading rubrics, and starter code (UC-08).
   */
  public async generateExam(request: ExamGenerateRequest): Promise<GeneratedExam> {
    const { topic, courseCode, difficulty, language, learningOutcomes, numTestCases = 5 } = request;

    const systemPrompt = `You are an expert Computer Science Professor and Curriculum Designer for the AITA Autograding System.
Your job is to generate rigorous, academically sound programming assignments and exams.
You must generate:
1. Clear problem statement and real-world context.
2. Exact input/output format specifications and constraints.
3. Test cases (both sample and hidden) with edge cases (empty input, large numbers, boundary conditions).
4. Multi-level rubric for automated and manual grading.
5. Minimal starter boilerplate and a full reference working solution.`;

    const userPrompt = `GENERATE_EXAM
Course: ${courseCode}
Topic: ${topic}
Target Difficulty: ${difficulty}
Programming Language: ${language}
Target Learning Outcomes: ${learningOutcomes.join(", ")}
Requested Test Cases: ${numTestCases}

Ensure output conforms strictly to the provided JSON schema.`;

    const response = await this.provider.generateCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      {
        temperature: 0.3, // Slight creativity for variety while maintaining structure
        jsonSchema: EXAM_GENERATION_JSON_SCHEMA,
        schemaName: "AITA_ExamSpecification",
      }
    );

    let parsed: any = response.parsedJson;
    if (!parsed) {
      try {
        parsed = JSON.parse(response.content);
      } catch {
        throw new Error("ExamGeneratorService: Failed to parse LLM structured output into exam format.");
      }
    }

    return parsed as GeneratedExam;
  }
}
