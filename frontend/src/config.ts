/**
 * Centralized Configuration for AITA Frontend
 * Supports both local development and Vercel cloud deployments.
 */

export const API_BASE_URL: string =
  (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000';

export const GOOGLE_CLIENT_ID: string =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) ||
  '788798423051-4c6pqis6sjcrnit4c74omft9kqrvp623.apps.googleusercontent.com';
