import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Initialize Firebase Admin with the service account
const serviceAccountPath = path.join(__dirname, '..', 'service-account.json');
try {
  const serviceAccount = require(serviceAccountPath);
  initializeApp({
    credential: cert(serviceAccount)
  });
} catch (error) {
  console.error(`\n[ERROR] Could not find or load service-account.json at ${serviceAccountPath}`);
  console.error('Make sure you have downloaded your Firebase Admin service account key and saved it to the root of your project as service-account.json.\n');
  process.exit(1);
}

const auth = getAuth();
const db = getFirestore();

const DEFAULT_PASSWORD = 'SaisWelcome2026!';

const ROSTER = [
  // Admins (Role: headteacher)
  { email: 'hectoraryiku@stadelaideschool.com', role: 'headteacher' },
  { email: 'princedunyoh@stadelaideschool.com', role: 'headteacher' },
  { email: 'bertinusbaalu@stadelaideschool.com', role: 'headteacher' },
  { email: 'theodorahammond@stadelaideschool.com', role: 'headteacher' },
  
  // Teachers (Role: teacher)
  { email: 'ericaabban@stadelaideschool.com', role: 'teacher' },
  { email: 'ericdzidzornu@stadelaideschool.com', role: 'teacher' },
  { email: 'dorcaslivingstone@stadelaideschool.com', role: 'teacher' },
  { email: 'dorcasegbeta@stadelaideschool.com', role: 'teacher' },
  { email: 'derrickthompson@stadelaideschool.com', role: 'teacher' },
  { email: 'anitabilekyi@stadelaideschool.com', role: 'teacher' },
  { email: 'amaoppong-yarko@stadelaideschool.com', role: 'teacher' },
  { email: 'abigailsackey@stadelaideschool.com', role: 'teacher' },
  { email: 'josephliman@stadelaideschool.com', role: 'teacher' },
  { email: 'jamoh-barimah@stadelaideschool.com', role: 'teacher' },
  { email: 'jamestettey@stadelaideschool.com', role: 'teacher' },
  { email: 'gloriacoffie@stadelaideschool.com', role: 'teacher' },
  { email: 'fredericathompson@stadelaideschool.com', role: 'teacher' },
  { email: 'franciscaforkuo@stadelaideschool.com', role: 'teacher' },
  { email: 'evelynbonnie@stadelaideschool.com', role: 'teacher' },
  { email: 'williamsamsondickson@stadelaideschool.com', role: 'teacher' },
  { email: 'vidadarkomensah@stadelaideschool.com', role: 'teacher' },
  { email: 'victoriavioletbaiden@stadelaideschool.com', role: 'teacher' },
  { email: 'sebastiankyeremanteng@stadelaideschool.com', role: 'teacher' },
  { email: 'samuelmireku@stadelaideschool.com', role: 'teacher' },
  { email: 'ruthlartey@stadelaideschool.com', role: 'teacher' },
  { email: 'promisearyee@stadelaideschool.com', role: 'teacher' },
  { email: 'paulineasantenti@stadelaideschool.com', role: 'teacher' },
  { email: 'patiencesampson@stadelaideschool.com', role: 'teacher' },
  { email: 'patienceedoh@stadelaideschool.com', role: 'teacher' },
  { email: 'lisaeyram@stadelaideschool.com', role: 'teacher' },
  { email: 'marysekafa@stadelaideschool.com', role: 'teacher' }
];

async function seedStaff() {
  console.log(`Starting staff provisioning for ${ROSTER.length} users...`);

  for (const staff of ROSTER) {
    let uid;
    
    try {
      // 1. Try to create the user in Firebase Auth
      const userRecord = await auth.createUser({
        email: staff.email,
        password: DEFAULT_PASSWORD,
      });
      uid = userRecord.uid;
      console.log(`[AUTH] Created user: ${staff.email} (UID: ${uid})`);
    } catch (error) {
      if (error.code === 'auth/email-already-exists') {
        // User already exists, fetch their existing UID
        const existingUser = await auth.getUserByEmail(staff.email);
        uid = existingUser.uid;
        console.log(`[AUTH] User already exists: ${staff.email} (UID: ${uid}). Will update their profile.`);
      } else {
        console.error(`[AUTH ERROR] Failed to process ${staff.email}:`, error.message);
        continue; // Skip to next user
      }
    }

    // 2. Create or update profile in Firestore
    if (uid) {
      try {
        const userRef = db.collection('sais_users').doc(uid);
        await userRef.set({
          email: staff.email,
          role: staff.role,
          createdAt: FieldValue.serverTimestamp()
        }, { merge: true }); // Use merge to keep any existing fields intact
        
        console.log(`[FIRESTORE] Whitelisted user: ${staff.email} with role: ${staff.role}`);
      } catch (error) {
        console.error(`[FIRESTORE ERROR] Failed to whitelist ${staff.email}:`, error.message);
      }
    }
  }

  console.log('\n✅ Staff provisioning complete.');
  process.exit(0);
}

seedStaff();
