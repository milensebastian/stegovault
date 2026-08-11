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
    const mode = sanitizeInputString(body.mode, 50) || 'image-lsb';
    const isGeneralOverview = Boolean(body.isGeneralOverview || mode === 'educational-security-overview');

    const ai = getGeminiClient();

    if (isGeneralOverview) {
      if (!ai) {
        return res.status(200).json({
          success: true,
          analysis: `### Steganographic Security Overview\n- **Confidentiality vs. Detectability**: AES-256-GCM protects the confidentiality and integrity of the hidden payload. It does not guarantee statistical undetectability of the steganographic embedding.\n- **Resilience**: LSB embedding is highly vulnerable to lossy image/audio compression (e.g. JPEG conversion or MP3 re-encoding).\n- **Stealth Assessment**: Statistical steganalysis (such as Chi-Square testing) evaluates bitplane distribution anomalies regardless of payload encryption.`,
          source: 'fallback',
        });
      }

      const overviewPrompt = `You are a world-class cryptographic & steganalysis expert. Provide an educational security assessment of Least-Significant-Bit (LSB) steganography and text steganography.

CRITICAL DIRECTIVES:
- Clearly state that this is a general principles security assessment, not an analysis of a specific image.
- Include this exact concept: "AES-256-GCM protects the confidentiality and integrity of the hidden payload. It does not guarantee statistical undetectability of the steganographic embedding."
- Treat all steganographic detection probabilistically without absolute claims or guarantees.

Provide a concise, highly professional 3-bullet security report covering:
1. Confidentiality vs. Statistical Detectability
2. Resilience against lossy compression
3. Best practices for steganographic hygiene. Use clean Markdown formatting.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: overviewPrompt,
      });

      return res.status(200).json({
        success: true,
        analysis: response.text ? response.text.trim() : 'Overview complete.',
        source: 'gemini',
      });
    }

    let payloadSizeStr = 'Unknown (Passive Statistical Scan)';
    if (typeof body.payloadSize === 'number' && body.payloadSize > 0) {
      payloadSizeStr = `${body.payloadSize} bytes`;
    } else if (typeof body.payloadSize === 'string' && body.payloadSize.trim().length > 0) {
      payloadSizeStr = sanitizeInputString(body.payloadSize, 100);
    }

    const chiSquarePValue = sanitizeNumber(body.chiSquarePValue, 0, 1, 0.5);
    const lsbNoiseRatio = sanitizeNumber(body.lsbNoiseRatio, 0, 1, 0.5);
    const entropy = sanitizeNumber(body.entropy, 0, 8, 1.0);

    if (!ai) {
      return res.status(200).json({
        success: true,
        analysis: `### Forensic Assessment\n- **LSB Noise Ratio**: ${(lsbNoiseRatio * 100).toFixed(2)}%\n- **Chi-Square P-Value**: ${chiSquarePValue.toFixed(4)}\n- **Entropy**: ${entropy.toFixed(3)} bits/bit\n\n**Assessment**: Statistical chi-square testing indicates ${chiSquarePValue > 0.9 ? 'probable artificial LSB uniformity (high statistical anomaly)' : 'distribution consistent with natural photograph variance'}. Note: AES-256-GCM protects the confidentiality and integrity of the hidden payload. It does not guarantee statistical undetectability of the steganographic embedding.`,
        source: 'fallback',
      });
    }

    const prompt = `You are a world-class cryptographic & steganalysis expert. Analyze the following steganography inspection metrics from a passive image inspection:
- Mode: ${mode}
- Payload size: ${payloadSizeStr}
- Chi-Square P-Value metric: ${chiSquarePValue}
- LSB Noise Ratio: ${lsbNoiseRatio}
- Shannon Entropy: ${entropy}

CRITICAL DIRECTIVES:
- Treat all forensic assessments probabilistically. Do NOT make absolute guarantees or claim impossible/100% certainty.
- Explicitly emphasize: "AES-256-GCM protects the confidentiality and integrity of the hidden payload. It does not guarantee statistical undetectability of the steganographic embedding."
- Do NOT use absolute words like "undetectable" or "bulletproof". Use "visually imperceptible", "low likelihood of detection", "statistically resistant".
- If payload size is unknown, explicitly state that payload size is not determined during passive analysis.

Provide a concise, highly professional 3-bullet forensic report covering:
1. Statistical Anomaly & Likelihood Assessment
2. Resilience against lossy compression (JPEG/MP3/social media re-encoding)
3. Recommendations for steganographic hygiene. Use clean Markdown formatting.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
    });

    return res.status(200).json({
      success: true,
      analysis: response.text ? response.text.trim() : 'Analysis complete.',
      source: 'gemini',
    });
  } catch (error: any) {
    console.error('Gemini Stego Analysis Error:', error?.message || error);
    return res.status(500).json({ success: false, error: 'Failed to perform AI analysis.' });
  }
}
