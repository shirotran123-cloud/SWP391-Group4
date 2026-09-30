import * as dotenv from "dotenv";

dotenv.config();

export interface AIConfig {
  defaultProvider: "gemini" | "openai" | "mock";
  gemini: {
    keys: string[];
    model: string;
  };
  openai: {
    keys: string[];
    model: string;
  };
  temperature: number;
  maxTokenWindow: number;
  maxRetries: number;
  retryBackoffMs: number;
  timeoutMs: number;
}

const parseKeys = (raw?: string): string[] => {
  if (!raw) return [];
  return raw
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0 && !k.startsWith("your_") && !k.includes("your_key"));
};

export const aiConfig: AIConfig = {
  defaultProvider: (process.env.DEFAULT_LLM_PROVIDER as "gemini" | "openai" | "mock") || "mock",
  gemini: {
    keys: parseKeys(process.env.GEMINI_API_KEYS),
    model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
  },
  openai: {
    keys: parseKeys(process.env.OPENAI_API_KEYS),
    model: process.env.OPENAI_MODEL || "gpt-4o",
  },
  temperature: Number(process.env.AI_TEMPERATURE) || 0.2, // Deterministic evaluation
  maxTokenWindow: Number(process.env.MAX_TOKEN_WINDOW) || 8192, // CON-03 limit
  maxRetries: Number(process.env.MAX_RETRIES) || 2, // Max 2 attempts
  retryBackoffMs: Number(process.env.RETRY_BACKOFF_MS) || 1000,
  timeoutMs: Number(process.env.TIMEOUT_MS) || 30000,
};
