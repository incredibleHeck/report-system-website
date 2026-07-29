import { getAuth } from 'firebase/auth';

async function getAuthToken(): Promise<string | null> {
  try {
    const user = getAuth().currentUser;
    if (user) {
      return await user.getIdToken();
    }
  } catch {
    // Auth not available — skip
  }
  return null;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = await getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(path, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err || `Request failed (${res.status})`);
    }
    return (await res.json()) as T;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('AI Proxy request timed out (15s limit). Please check network or try again.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export type GeminiGenerateResult = {
  text: string;
  parsed?: unknown;
};

export async function generateWithGemini(prompt: string, expectJson = true) {
  return postJson<GeminiGenerateResult>('/api/gemini', { prompt, expectJson });
}

export async function sendWhatsAppPdf(payload: {
  phone: string;
  studentName: string;
  pdfBase64: string;
  fileName: string;
}) {
  return postJson<{ ok: boolean; status: string; fallback?: boolean; attempts?: number }>(
    '/api/whatsapp',
    payload
  );
}

export async function sendEmailPdf(payload: {
  to: string;
  studentName: string;
  subject: string;
  pdfBase64: string;
  fileName: string;
}) {
  return postJson<{ ok: boolean; status: string; fallback?: boolean }>('/api/email', payload);
}

export function extractJsonArray<T = unknown>(text: string): T[] {
  try {
    const cleaned = text.replace(/```json|```/g, '').trim();
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start === -1 || end === -1) throw new Error('No JSON array found in model response');
    return JSON.parse(cleaned.slice(start, end + 1)) as T[];
  } catch (e) {
    console.error('[GeminiClient] JSON Extraction Failed:', e, 'Raw Text:', text);
    throw new Error('AI output format error: Unable to parse JSON array from model output.');
  }
}
