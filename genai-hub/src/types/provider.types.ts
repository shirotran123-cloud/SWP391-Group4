export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  jsonSchema?: Record<string, unknown>;
  schemaName?: string;
  timeoutMs?: number;
}

export interface LLMResponse {
  content: string;
  parsedJson?: unknown;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface KeyPoolItem {
  key: string;
  provider: "openai" | "gemini";
  errorCount: number;
  lastUsedAt: number;
  isCoolingDown: boolean;
  cooldownUntil: number;
}
