import { ILLMProvider } from "./llm-provider.interface";
import { LLMMessage, LLMOptions, LLMResponse } from "../types/provider.types";
import { KeyRotatorService } from "../services/key-rotator.service";
import { adaptSchemaForGemini } from "../schemas/schema-adapter";

export class GeminiProvider implements ILLMProvider {
  public readonly providerName = "Google Gemini";
  private model: string;
  private keyRotator: KeyRotatorService;

  constructor(keyRotator: KeyRotatorService, model = "gemini-1.5-flash") {
    this.keyRotator = keyRotator;
    this.model = model;
  }

  public async generateCompletion(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse> {
    const temperature = options?.temperature ?? 0.2;
    const maxRetries = 2;
    let attempt = 0;
    let lastError: Error | null = null;

    // Separate system message if present
    const systemMsg = messages.find((m) => m.role === "system");
    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    while (attempt <= maxRetries) {
      const apiKey = this.keyRotator.getNextKey("gemini");
      if (!apiKey) {
        throw new Error("GeminiProvider: No valid API keys available in rotation pool.");
      }

      try {
        const generationConfig: Record<string, unknown> = {
          temperature,
        };

        if (options?.jsonSchema) {
          generationConfig.responseMimeType = "application/json";
          generationConfig.responseSchema = adaptSchemaForGemini(options.jsonSchema);
        }

        const requestBody: Record<string, unknown> = {
          contents,
          generationConfig,
        };

        if (systemMsg) {
          requestBody.systemInstruction = {
            parts: [{ text: systemMsg.content }],
          };
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${apiKey}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), options?.timeoutMs || 30000);

        let response: Response;
        try {
          response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        if (!response.ok) {
          this.keyRotator.reportError("gemini", apiKey, response.status);
          const errText = await response.text();
          throw new Error(`Gemini HTTP ${response.status}: ${errText}`);
        }

        this.keyRotator.reportSuccess("gemini", apiKey);
        const data = (await response.json()) as any;
        const candidate = data.candidates?.[0];
        const content = candidate?.content?.parts?.[0]?.text || "";

        let parsedJson: unknown;
        if (options?.jsonSchema && content) {
          try {
            parsedJson = JSON.parse(content);
          } catch {
            // Content was not valid JSON
          }
        }

        return {
          content,
          parsedJson,
          model: this.model,
          usage: data.usageMetadata
            ? {
                prompt_tokens: data.usageMetadata.promptTokenCount || 0,
                completion_tokens: data.usageMetadata.candidatesTokenCount || 0,
                total_tokens: data.usageMetadata.totalTokenCount || 0,
              }
            : undefined,
        };
      } catch (err: any) {
        lastError = err;
        attempt++;
        if (attempt <= maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw new Error(`GeminiProvider failed after ${maxRetries} retries: ${lastError?.message}`);
  }
}
