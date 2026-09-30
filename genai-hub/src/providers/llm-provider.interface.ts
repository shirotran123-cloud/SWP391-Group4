import { LLMMessage, LLMOptions, LLMResponse } from "../types/provider.types";

export interface ILLMProvider {
  readonly providerName: string;
  generateCompletion(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse>;
}
