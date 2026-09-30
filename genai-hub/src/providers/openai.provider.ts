import { ILLMProvider } from "./llm-provider.interface";
import { LLMMessage, LLMOptions, LLMResponse } from "../types/provider.types";
import { KeyRotatorService } from "../services/key-rotator.service";

export class OpenAIProvider implements ILLMProvider {
  public readonly providerName = "OpenAI";
  private model: string;
  private keyRotator: KeyRotatorService;

  constructor(keyRotator: KeyRotatorService, model = "gpt-4o") {
    this.keyRotator = keyRotator;
    this.model = model;
  }

  public async generateCompletion(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse> {
    const temperature = options?.temperature ?? 0.2;
    const maxRetries = 2;
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= maxRetries) {
      const apiKey = this.keyRotator.getNextKey("openai");
      if (!apiKey) {
        throw new Error("OpenAIProvider: No valid API keys available in rotation pool.");
      }

      try {
        const body: Record<string, unknown> = {
          model: this.model,
          messages,
          temperature,
        };

        if (options?.jsonSchema) {
          body.response_format = {
            type: "json_schema",
            json_schema: {
              name: options.schemaName || "structured_output",
              strict: true,
              schema: options.jsonSchema,
            },
          };
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), options?.timeoutMs || 30000);

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          this.keyRotator.reportError("openai", apiKey, response.status);
          const errText = await response.text();
          throw new Error(`OpenAI HTTP ${response.status}: ${errText}`);
        }

        this.keyRotator.reportSuccess("openai", apiKey);
        const data = (await response.json()) as any;
        const content = data.choices[0]?.message?.content || "";

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
          model: data.model || this.model,
          usage: data.usage
            ? {
                prompt_tokens: data.usage.prompt_tokens,
                completion_tokens: data.usage.completion_tokens,
                total_tokens: data.usage.total_tokens,
              }
            : undefined,
        };
      } catch (err: any) {
        lastError = err;
        attempt++;
        if (attempt <= maxRetries) {
          // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw new Error(`OpenAIProvider failed after ${maxRetries} retries: ${lastError?.message}`);
  }
}
