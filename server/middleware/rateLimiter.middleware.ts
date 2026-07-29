import type { Request, Response, NextFunction } from 'express';

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;

export function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  let entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitMap.set(ip, entry);
  }
  entry.count++;
  
  const staffDoc = (req as any).staffDoc;
  const isHeadteacher = staffDoc?.role === 'headteacher';
  const limit = isHeadteacher ? 500 : RATE_LIMIT_MAX;
  
  if (entry.count > limit) {
    return res.status(429).json({ error: 'Too many requests. Try again later.' });
  }
  next();
}
