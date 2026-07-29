export async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function explainWhatsAppError(raw: string): string {
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

export async function uploadWhatsAppMedia(
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

export async function sendWhatsAppTemplate(params: {
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
