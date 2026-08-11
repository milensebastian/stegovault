import { GoogleGenAI } from '@google/genai';

// Helper sanitizers
export function sanitizeInputString(val: unknown, maxLen = 300): string {
  if (typeof val !== 'string') return '';
  return val.slice(0, maxLen).trim();
}

export function sanitizeNumber(val: unknown, min: number, max: number, defaultVal: number): number {
  const num = Number(val);
  if (isNaN(num)) return defaultVal;
  return Math.min(max, Math.max(min, num));
}

// Lazy Gemini client initialization
let aiClient: GoogleGenAI | null = null;
export function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
      aiClient = new GoogleGenAI({ apiKey });
    }
  }
  return aiClient;
}

// Lightweight best-effort in-memory rate limiter for serverless instance
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
export function checkRateLimit(ip: string, maxRequests = 30, windowMs = 60 * 1000): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  record.count++;
  return { allowed: true, remaining: maxRequests - record.count };
}
