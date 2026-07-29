import { Router } from 'express';
import { rateLimiter } from '../middleware/rateLimiter.middleware';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.post('/gemini', requireAuth, rateLimiter, async (req, res) => {
  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return res.status(503).json({ error: 'GEMINI_API_KEY not configured' });
    }
    const { prompt, expectJson } = req.body as { prompt?: string; expectJson?: boolean };
    if (!prompt) return res.status(400).json({ error: 'prompt required' });

    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: expectJson
          ? { responseMimeType: 'application/json', temperature: 0.9 }
          : { temperature: 0.8 },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: `Gemini error: ${errText}` });
    }

    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
    let parsed: unknown;
    if (expectJson) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = undefined;
      }
    }
    res.json({ text, parsed });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Gemini failed' });
  }
});

export default router;
