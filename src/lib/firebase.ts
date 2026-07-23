import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signOut } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with Offline Persistence
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

// Auth
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
// Lock to school domain
provider.setCustomParameters({ hd: 'stadelaideschool.com' });

export { app };

export const signInWithGoogle = async () => {
  const { signInWithPopup } = await import('firebase/auth');
  try {
    const result = await signInWithPopup(auth, provider);
    return result;
  } catch (error) {
    throw error;
  }
};

export const signInWithEmail = async (email: string, password: string) => {
  const { signInWithEmailAndPassword } = await import('firebase/auth');

  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result;
  } catch (error: any) {
    // Provide user-friendly error messages
    const code = error?.code;
    if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
      throw new Error('Invalid email or password. Please check your credentials.');
    } else if (code === 'auth/wrong-password') {
      throw new Error('Incorrect password. Please try again.');
    } else if (code === 'auth/too-many-requests') {
      throw new Error('Too many failed attempts. Please try again later.');
    }
    throw error;
  }
};
