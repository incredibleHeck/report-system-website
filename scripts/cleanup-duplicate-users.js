import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const serviceAccountPath = path.join(__dirname, '..', 'service-account.json');
try {
  const serviceAccount = require(serviceAccountPath);
  initializeApp({
    credential: cert(serviceAccount)
  });
} catch (error) {
  console.error(`[ERROR] Could not load service-account.json:`, error.message);
  process.exit(1);
}

const auth = getAuth();
const db = getFirestore();

async function fullUserDeduplication() {
  console.log('--- Comprehensive Firestore User Deduplication ---');
  const snapshot = await db.collection('sais_users').get();
  console.log(`Total documents in sais_users: ${snapshot.docs.length}`);

  // Delete any obvious typo emails like stadelaideshool.com or non-canonical doc IDs
  const knownNameMap = {
    'hectoraryiku@stadelaideschool.com': 'Hector Aryiku',
    'princedunyoh@stadelaideschool.com': 'Prince Dunyoh',
    'bertinusbaalu@stadelaideschool.com': 'Bertinus Baalu',
    'theodorahammond@stadelaideschool.com': 'Theodora Hammond',
  };

  // 1. First delete typo docs like stadelaideshool.com or legacy 'user-*' doc IDs
  for (const docSnap of snapshot.docs) {
    const id = docSnap.id;
    const data = docSnap.data();
    const email = (data.email || '').trim().toLowerCase();

    if (email.includes('stadelaideshool.com') || id.startsWith('user-') || id === 'unknown') {
      console.log(`Deleting legacy/typo document ID: ${id} (${email})`);
      await db.collection('sais_users').doc(id).delete();
    }
  }

  // 2. Re-fetch documents and ensure Firebase Auth UID is the document ID for each staff
  const refreshSnap = await db.collection('sais_users').get();
  const emailToDocs = new Map();

  for (const docSnap of refreshSnap.docs) {
    const id = docSnap.id;
    const data = docSnap.data();
    const email = (data.email || '').trim().toLowerCase();
    if (!email) continue;

    if (!emailToDocs.has(email)) {
      emailToDocs.set(email, []);
    }
    emailToDocs.get(email).push({ id, data });
  }

  for (const [email, docList] of emailToDocs.entries()) {
    let authUid;
    try {
      const userRecord = await auth.getUserByEmail(email);
      authUid = userRecord.uid;
    } catch {
      authUid = null;
    }

    console.log(`Processing email: ${email} (Auth UID: ${authUid}) - Found ${docList.length} doc(s)`);

    if (authUid) {
      // Find name & subjects from docList or known map
      let bestName = knownNameMap[email] || '';
      let bestSubjects = [];
      let role = email.includes('hector') || email.includes('prince') || email.includes('bertinus') || email.includes('theodora') ? 'headteacher' : 'teacher';

      for (const item of docList) {
        if (item.data.name && item.data.name.trim() !== '') {
          bestName = item.data.name.trim();
        }
        if (item.data.subjects && Array.isArray(item.data.subjects) && item.data.subjects.length > 0) {
          bestSubjects = item.data.subjects;
        }
        if (item.data.role) {
          role = item.data.role;
        }
      }

      // Write canonical doc at authUid
      const canonicalRef = db.collection('sais_users').doc(authUid);
      await canonicalRef.set({
        email,
        name: bestName,
        role,
        subjects: bestSubjects,
      }, { merge: true });
      console.log(`  ✅ Written canonical doc for ${email} at ID: ${authUid} (name: "${bestName}", role: "${role}")`);

      // Delete any doc that doesn't have id === authUid
      for (const item of docList) {
        if (item.id !== authUid) {
          console.log(`  Deleting duplicate non-auth doc ID: ${item.id}`);
          await db.collection('sais_users').doc(item.id).delete();
        }
      }
    }
  }

  console.log('\n✅ Comprehensive deduplication complete!');
  process.exit(0);
}

fullUserDeduplication();
