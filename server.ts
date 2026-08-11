import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // In-memory rate limiter for AI API routes (max 30 requests / minute)
  const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
  const aiRateLimiter = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const now = Date.now();
    const windowMs = 60 * 1000;

    const record = rateLimitMap.get(ip);
    if (!record || now > record.resetTime) {
      rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (record.count >= 30) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests. Rate limit exceeded (max 30 requests/minute). Please try again shortly.',
      });
    }

    record.count++;
    next();
  };

  // Helper sanitizers
  function sanitizeInputString(val: any, maxLen = 300): string {
    if (typeof val !== 'string') return '';
    return val.slice(0, maxLen).trim();
  }

  function sanitizeNumber(val: any, min: number, max: number, defaultVal: number): number {
    const num = Number(val);
    if (isNaN(num)) return defaultVal;
    return Math.min(max, Math.max(min, num));
  }

  // Initialize Gemini AI lazily
  let aiClient: GoogleGenAI | null = null;
  function getGeminiClient(): GoogleGenAI | null {
    if (!aiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
        aiClient = new GoogleGenAI({ apiKey });
      }
    }
    return aiClient;
  }

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // AI Cover Text Generator API
  app.post('/api/ai/generate-cover', aiRateLimiter, async (req, res) => {
    try {
      const topic = sanitizeInputString(req.body.topic, 200) || 'General corporate project sync';
      const style = sanitizeInputString(req.body.style, 50) || 'professional';
      const language = sanitizeInputString(req.body.language, 30) || 'English';
      const targetLength = sanitizeNumber(req.body.targetLength, 100, 2000, 300);

      const ai = getGeminiClient();

      if (!ai) {
        return res.json({
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

      return res.json({
        success: true,
        coverText,
        source: 'gemini',
      });
    } catch (error: any) {
      console.error('Gemini Cover Generation Error:', error?.message || error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate cover text. Please try again.',
      });
    }
  });

  // AI Steganographic Forensic Advisor API
  app.post('/api/ai/analyze-stego', aiRateLimiter, async (req, res) => {
    try {
      const mode = sanitizeInputString(req.body.mode, 50) || 'image-lsb';
      const isGeneralOverview = Boolean(req.body.isGeneralOverview || mode === 'educational-security-overview');

      const ai = getGeminiClient();

      if (isGeneralOverview) {
        if (!ai) {
          return res.json({
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

        return res.json({
          success: true,
          analysis: response.text ? response.text.trim() : 'Overview complete.',
          source: 'gemini',
        });
      }

      let payloadSizeStr = 'Unknown (Passive Statistical Scan)';
      if (typeof req.body.payloadSize === 'number' && req.body.payloadSize > 0) {
        payloadSizeStr = `${req.body.payloadSize} bytes`;
      } else if (typeof req.body.payloadSize === 'string' && req.body.payloadSize.trim().length > 0) {
        payloadSizeStr = sanitizeInputString(req.body.payloadSize, 100);
      }

      const chiSquarePValue = sanitizeNumber(req.body.chiSquarePValue, 0, 1, 0.5);
      const lsbNoiseRatio = sanitizeNumber(req.body.lsbNoiseRatio, 0, 1, 0.5);
      const entropy = sanitizeNumber(req.body.entropy, 0, 8, 1.0);

      if (!ai) {
        return res.json({
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

      return res.json({
        success: true,
        analysis: response.text ? response.text.trim() : 'Analysis complete.',
        source: 'gemini',
      });
    } catch (error: any) {
      console.error('Gemini Stego Analysis Error:', error?.message || error);
      res.status(500).json({ success: false, error: 'Failed to perform AI analysis.' });
    }
  });

  // Vite development middleware or production static serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`StegoVault server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
