import { Router } from 'express';
import { rateLimiter } from '../middleware/rateLimiter.middleware';

const router = Router();

router.get('/health', rateLimiter, (_req, res) => {
  res.json({
    ok: true,
    gemini: Boolean(process.env.GEMINI_API_KEY),
    whatsapp: Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
    smtp: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER),
  });
});

export default router;
