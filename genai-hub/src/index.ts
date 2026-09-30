import { aiConfig } from "./config/ai.config";
import { KeyRotatorService } from "./services/key-rotator.service";
import { OpenAIProvider } from "./providers/openai.provider";
import { GeminiProvider } from "./providers/gemini.provider";
import { MockProvider } from "./providers/mock.provider";
import { ILLMProvider } from "./providers/llm-provider.interface";
import { CodeReviewerService } from "./services/code-reviewer.service";
import { ExamGeneratorService } from "./services/exam-generator.service";
import { CompilerExplainerService } from "./services/compiler-explainer.service";
import { PromptSanitizer } from "./security/prompt-sanitizer";

export * from "./types/review.types";
export * from "./types/exam.types";
export * from "./types/provider.types";
export * from "./schemas/code-review.schema";
export * from "./security/prompt-sanitizer";
export * from "./services/key-rotator.service";
export * from "./services/code-reviewer.service";
export * from "./services/exam-generator.service";
export * from "./services/compiler-explainer.service";

/**
 * Factory creating an initialized GenAI Hub container with configured providers.
 */
export function createGenAIHub(providerOverride?: "gemini" | "openai" | "mock") {
  const chosenProvider = providerOverride || aiConfig.defaultProvider;
  const keyRotator = new KeyRotatorService(aiConfig.openai.keys, aiConfig.gemini.keys);

  let provider: ILLMProvider;

  if (chosenProvider === "openai" && aiConfig.openai.keys.length > 0) {
    provider = new OpenAIProvider(keyRotator, aiConfig.openai.model);
  } else if (chosenProvider === "gemini" && aiConfig.gemini.keys.length > 0) {
    provider = new GeminiProvider(keyRotator, aiConfig.gemini.model);
  } else {
    // Default to high-fidelity mock engine if keys are absent or mock selected
    provider = new MockProvider();
  }

  const codeReviewer = new CodeReviewerService(provider);
  const examGenerator = new ExamGeneratorService(provider);
  const compilerExplainer = new CompilerExplainerService(provider);

  return {
    provider,
    keyRotator,
    codeReviewer,
    examGenerator,
    compilerExplainer,
    promptSanitizer: PromptSanitizer,
  };
}

// Default export
export default createGenAIHub();
