// Temporary script to enable Email/Password auth and create a user
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./service-account.json', 'utf8'));

const app = initializeApp({
  credential: cert(serviceAccount)
});

const auth = getAuth(app);

async function setupEmailAuth() {
  const email = 'hectoraryiku@stadelaideschool.com';
  const password = 'Forseekingzer0.';

  try {
    // Check if user already exists
    const existing = await auth.getUserByEmail(email);
    console.log(`✅ User already exists: ${existing.uid}`);
    console.log(`   Email: ${existing.email}`);
    console.log(`   Display Name: ${existing.displayName || '(not set)'}`);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      // Create the user
      const user = await auth.createUser({
        email,
        password,
        displayName: 'Hector Aryiku',
        emailVerified: true,
      });
      console.log(`✅ User created: ${user.uid}`);
      console.log(`   Email: ${user.email}`);
    } else {
      console.error('❌ Error checking user:', err.message);
    }
  }

  process.exit(0);
}

setupEmailAuth();
