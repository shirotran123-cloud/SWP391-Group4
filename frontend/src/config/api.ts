/**
 * Centralized API Gateway Configuration for AITA Frontend.
 * Allows overriding the API Gateway address via VITE_API_URL environment variable.
 * Fallback to 'http://localhost:3000' for local dev.
 */
export const API_BASE_URL: string =
  (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000';
