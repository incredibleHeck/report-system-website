import { Router } from 'express';
import { rateLimiter } from '../middleware/rateLimiter.middleware';
import { requireAuth, requireHeadteacher } from '../middleware/auth.middleware';
import { uploadWhatsAppMedia, sendWhatsAppTemplate, sleep } from '../services/whatsapp.service';
import { sendEmail } from '../services/email.service';

const router = Router();

router.post('/whatsapp', requireAuth, rateLimiter, async (req, res) => {
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

router.post('/email', requireAuth, rateLimiter, async (req, res) => {
  try {
    const { to, studentName, subject, pdfBase64, fileName } = req.body as {
      to: string;
      studentName: string;
      subject: string;
      pdfBase64: string;
      fileName: string;
    };
    
    const result = await sendEmail({ to, studentName, subject, pdfBase64, fileName });
    return res.json(result);
  } catch (e) {
    res.status(500).json({
      ok: false,
      status: e instanceof Error ? e.message : 'Email failed',
    });
  }
});

export default router;
