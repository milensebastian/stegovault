import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getGeminiClient, sanitizeInputString, sanitizeNumber, checkRateLimit } from '../_utils.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || '127.0.0.1';
  const rateLimit = checkRateLimit(clientIp);
  if (!rateLimit.allowed) {
    return res.status(429).json({
      success: false,
      error: 'Too many requests. Rate limit exceeded (max 30 requests/minute). Please try again shortly.',
    });
  }

  try {
    const body = req.body || {};
    const topic = sanitizeInputString(body.topic, 200) || 'General corporate project sync';
    const style = sanitizeInputString(body.style, 50) || 'professional';
    const language = sanitizeInputString(body.language, 30) || 'English';
    const targetLength = sanitizeNumber(body.targetLength, 100, 2000, 300);

    const ai = getGeminiClient();

    if (!ai) {
      return res.status(200).json({
        success: true,
        coverText: `Subject: Project Sync & Documentation Update\n\nHi team,\n\nI have completed reviewing the latest modular components for our upcoming launch. Everything looks well aligned with our architectural guidelines. Please review the updated documentation when you get a chance.\n\nBest regards,`,
        source: 'fallback',
      });
    }

    const prompt = `You are a stealth security writer. Generate a completely innocent, realistic, natural-sounding cover text snippet (topic: ${topic}, tone/style: ${style}, language: ${language}, approximate length: ${targetLength} characters).
Do NOT mention security, steganography, passwords, or encryption. The output must blend in seamlessly as a normal email, article, recipe, or note. Return ONLY the plain generated cover text without commentary or quotation marks.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
    });

    const coverText = response.text ? response.text.trim() : '';

    return res.status(200).json({
      success: true,
      coverText,
      source: 'gemini',
    });
  } catch (error: any) {
    console.error('Gemini Cover Generation Error:', error?.message || error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate cover text. Please try again.',
    });
  }
}
