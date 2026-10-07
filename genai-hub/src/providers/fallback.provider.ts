import { ILLMProvider } from "./llm-provider.interface";
import { LLMMessage, LLMOptions, LLMResponse } from "../types/provider.types";
import { MockProvider } from "./mock.provider";

/**
 * Resilient Multi-Provider Fallback (DEP-02, R01).
 * Cascades across providers (e.g. Gemini -> OpenAI -> Mock Engine)
 * so that rate-limit outages or network partitions never drop grading jobs.
 */
export class FallbackProvider implements ILLMProvider {
  public readonly providerName: string;
  private providers: ILLMProvider[];
  private offlineFallback: MockProvider | null;

  constructor(providers: ILLMProvider[], enableOfflineFallback = true) {
    this.providers = providers.filter((p) => !!p);
    this.offlineFallback = enableOfflineFallback ? new MockProvider() : null;
    this.providerName = `FallbackChain[${this.providers.map((p) => p.providerName).join(" -> ")}]`;
  }

  public async generateCompletion(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse> {
    const errors: string[] = [];

    for (const provider of this.providers) {
      try {
        const response = await provider.generateCompletion(messages, options);
        return {
          ...response,
          model: `${response.model} (via ${provider.providerName})`,
        };
      } catch (err: any) {
        errors.push(`${provider.providerName}: ${err.message || String(err)}`);
      }
    }

    // If all configured upstream providers fail, activate zero-downtime offline heuristic
    if (this.offlineFallback) {
      const offlineResponse = await this.offlineFallback.generateCompletion(messages, options);
      return {
        ...offlineResponse,
        model: `${offlineResponse.model} (Emergency Offline Fallback)`,
      };
    }

    throw new Error(`All providers in fallback chain exhausted: ${errors.join(" | ")}`);
  }
}
