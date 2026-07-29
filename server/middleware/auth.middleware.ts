import type { Request, Response, NextFunction } from 'express';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let adminInitialized = false;

try {
  if (getApps().length === 0) {
    const saPath = path.join(__dirname, '../../service-account.json');
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

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!adminInitialized) {
    return res.status(503).json({ error: 'Service Unavailable: Firebase Admin uninitialized' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const idToken = authHeader.slice(7);
  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    const uid = decoded.uid;

    const userDoc = await getFirestore().collection('sais_users').doc(uid).get();
    if (!userDoc.exists) {
      return res.status(403).json({ error: 'User not in staff whitelist' });
    }

    (req as any).firebaseUser = decoded;
    (req as any).staffDoc = userDoc.data();
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export async function requireHeadteacher(req: Request, res: Response, next: NextFunction) {
  const staffDoc = (req as any).staffDoc;
  if (!staffDoc || staffDoc.role !== 'headteacher') {
    return res.status(403).json({ error: 'Forbidden: Requires headteacher role' });
  }
  next();
}
