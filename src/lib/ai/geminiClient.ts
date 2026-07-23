async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
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
  const cleaned = text.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('No JSON array in model response');
  return JSON.parse(cleaned.slice(start, end + 1)) as T[];
}
