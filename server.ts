import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: '.env.local' });
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '25mb' }));

const PORT = Number(process.env.PORT || 3001);

// --- Firebase Admin SDK for auth verification ---
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

let adminInitialized = false;
try {
  if (getApps().length === 0) {
    const fs = await import('fs');
    const saPath = path.join(__dirname, 'service-account.json');
    if (fs.existsSync(saPath)) {
      const sa = JSON.parse(fs.readFileSync(saPath, 'utf-8'));
      initializeApp({ credential: cert(sa) });
      adminInitialized = true;
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      initializeApp();
      adminInitialized = true;
    } else {
      console.warn('[AUTH] No service-account.json or GOOGLE_APPLICATION_CREDENTIALS found. Auth middleware disabled.');
    }
  } else {
    adminInitialized = true;
  }
} catch (err) {
  console.warn('[AUTH] Firebase Admin init failed:', err);
}

// --- Rate limiting (in-memory, per IP) ---
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 60; // max requests per window

function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  let entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitMap.set(ip, entry);
  }
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return res.status(429).json({ error: 'Too many requests. Try again later.' });
  }
  next();
}

// --- Auth middleware: verify Firebase ID token + whitelist check ---
async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!adminInitialized) {
    // If admin SDK isn't available, skip auth (dev mode)
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const idToken = authHeader.slice(7);
  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    const uid = decoded.uid;

    // Check the sais_users whitelist
    const userDoc = await getFirestore().collection('sais_users').doc(uid).get();
    if (!userDoc.exists) {
      return res.status(403).json({ error: 'User not in staff whitelist' });
    }

    // Attach user info for downstream handlers
    (req as any).firebaseUser = decoded;
    (req as any).staffDoc = userDoc.data();
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Apply rate limiting and auth to all /api routes except /health
app.use('/api', rateLimiter);


app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    gemini: Boolean(process.env.GEMINI_API_KEY),
    whatsapp: Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
    smtp: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER),
  });
});

app.post('/api/gemini', requireAuth, async (req, res) => {
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

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function explainWhatsAppError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('24') && lower.includes('hour')) {
    return 'Outside 24h messaging window — use an approved template or wait for parent reply';
  }
  if (lower.includes('not a whatsapp user') || lower.includes('not on whatsapp')) {
    return 'Number not on WhatsApp';
  }
  if (lower.includes('template') && (lower.includes('not found') || lower.includes('does not exist'))) {
    return 'Template not approved / not found — check WHATSAPP_TEMPLATE_NAME';
  }
  if (lower.includes('rate') || lower.includes('throttle')) {
    return 'Rate limited by Meta — retry shortly';
  }
  if (lower.includes('invalid parameter') || lower.includes('(#100)')) {
    return 'Invalid phone or template parameters';
  }
  const trimmed = raw.replace(/\s+/g, ' ').trim();
  return trimmed.length > 160 ? `${trimmed.slice(0, 160)}…` : trimmed || 'WhatsApp send failed';
}

async function uploadWhatsAppMedia(
  token: string,
  phoneId: string,
  pdfBase64: string,
  fileName: string
): Promise<{ ok: true; mediaId: string } | { ok: false; status: string }> {
  const buffer = Buffer.from(pdfBase64, 'base64');
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('type', 'application/pdf');
  form.append(
    'file',
    new Blob([new Uint8Array(buffer)], { type: 'application/pdf' }),
    fileName
  );

  const uploadRes = await fetch(`https://graph.facebook.com/v25.0/${phoneId}/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  const uploadText = await uploadRes.text();
  if (!uploadRes.ok) {
    return { ok: false, status: `UPLOAD FAIL: ${explainWhatsAppError(uploadText)}` };
  }

  let uploadData: { id?: string };
  try {
    uploadData = JSON.parse(uploadText) as { id?: string };
  } catch {
    return { ok: false, status: 'UPLOAD FAIL: invalid JSON from Meta media API' };
  }

  if (!uploadData.id) {
    return { ok: false, status: 'UPLOAD FAIL: no media id' };
  }
  return { ok: true, mediaId: uploadData.id };
}

async function sendWhatsAppTemplate(params: {
  token: string;
  phoneId: string;
  phone: string;
  studentName: string;
  mediaId: string;
  fileName: string;
  template: string;
  lang: string;
}): Promise<{ ok: true } | { ok: false; status: string }> {
  const sendRes = await fetch(`https://graph.facebook.com/v25.0/${params.phoneId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: params.phone,
      type: 'template',
      template: {
        name: params.template,
        language: { code: params.lang },
        components: [
          {
            type: 'header',
            parameters: [
              {
                type: 'document',
                document: { id: params.mediaId, filename: params.fileName },
              },
            ],
          },
          {
            type: 'body',
            parameters: [{ type: 'text', text: params.studentName }],
          },
        ],
      },
    }),
  });

  const sendText = await sendRes.text();
  if (!sendRes.ok) {
    return { ok: false, status: `SEND FAIL: ${explainWhatsAppError(sendText)}` };
  }
  return { ok: true };
}

app.post('/api/whatsapp', requireAuth, async (req, res) => {
  try {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const template = process.env.WHATSAPP_TEMPLATE_NAME || 'student_report_pdf';
    const lang = process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en';

    if (!token || !phoneId) {
      return res.json({
        ok: false,
        status: 'WHATSAPP not configured — use Download Class ZIP or set Meta credentials',
        fallback: true,
      });
    }

    const { phone, studentName, pdfBase64, fileName } = req.body as {
      phone: string;
      studentName: string;
      pdfBase64: string;
      fileName: string;
    };

    if (!phone || !pdfBase64 || !fileName) {
      return res.status(400).json({ ok: false, status: 'phone, pdfBase64, and fileName required' });
    }

    const maxAttempts = 3;
    let lastStatus = 'WhatsApp failed';

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const uploaded = await uploadWhatsAppMedia(token, phoneId, pdfBase64, fileName);
        if (!uploaded.ok) {
          lastStatus = uploaded.status;
          // Don't retry hard client/template errors
          if (
            lastStatus.includes('Template not approved') ||
            lastStatus.includes('Number not on WhatsApp') ||
            lastStatus.includes('Outside 24h')
          ) {
            break;
          }
          if (attempt < maxAttempts) {
            await sleep(500 * attempt);
            continue;
          }
          break;
        }

        const sent = await sendWhatsAppTemplate({
          token,
          phoneId,
          phone,
          studentName: studentName || 'Student',
          mediaId: uploaded.mediaId,
          fileName,
          template,
          lang,
        });

        if (sent.ok) {
          return res.json({ ok: true, status: 'SENT', attempts: attempt });
        }

        lastStatus = sent.status;
        if (
          lastStatus.includes('Template not approved') ||
          lastStatus.includes('Number not on WhatsApp') ||
          lastStatus.includes('Outside 24h') ||
          lastStatus.includes('Invalid phone')
        ) {
          break;
        }
        if (attempt < maxAttempts) {
          await sleep(700 * attempt);
          continue;
        }
      } catch (err) {
        lastStatus = err instanceof Error ? err.message : 'WhatsApp failed';
        if (attempt < maxAttempts) {
          await sleep(700 * attempt);
          continue;
        }
      }
    }

    return res.json({ ok: false, status: lastStatus });
  } catch (e) {
    res.status(500).json({
      ok: false,
      status: e instanceof Error ? e.message : 'WhatsApp failed',
    });
  }
});

app.post('/api/email', requireAuth, async (req, res) => {
  try {
    const { to, studentName, subject, pdfBase64, fileName } = req.body as {
      to: string;
      studentName: string;
      subject: string;
      pdfBase64: string;
      fileName: string;
    };

    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
      return res.json({
        ok: true,
        fallback: true,
        status: 'SENT (download fallback — SMTP not configured)',
        pdfBase64,
        fileName,
        to,
        studentName,
        subject,
      });
    }

    // Optional nodemailer — fall back to client download when unavailable
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nodemailer = (await import('nodemailer' as string)) as any;
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject: subject || `Report Card — ${studentName}`,
        html: `<p>Dear Parent/Guardian,</p><p>Please find attached the report card for <strong>${studentName}</strong>.</p><p>St. Adelaide International Schools</p>`,
        attachments: [
          {
            filename: fileName,
            content: Buffer.from(pdfBase64, 'base64'),
            contentType: 'application/pdf',
          },
        ],
      });

      return res.json({ ok: true, status: 'SENT' });
    } catch {
      return res.json({
        ok: true,
        fallback: true,
        status: 'SENT (download fallback — nodemailer not installed)',
        pdfBase64,
        fileName,
      });
    }
  } catch (e) {
    res.status(500).json({
      ok: false,
      status: e instanceof Error ? e.message : 'Email failed',
    });
  }
});

if (process.env.NODE_ENV === 'production') {
  const dist = path.join(__dirname, 'dist');
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`SAIS API proxy listening on http://localhost:${PORT}`);
});
