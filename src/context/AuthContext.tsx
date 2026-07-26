import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User } from '../types';
import { auth } from '../lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';

interface AuthContextType {
  currentUser: User | null;
  login: (user: User) => void;
  logout: () => void;
}

const AUTH_KEY = 'sais_auth_user';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authLoading, setAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    if (import.meta.env.VITE_DATA_BACKEND === 'firestore') return null;
    try {
      const raw = localStorage.getItem(AUTH_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (import.meta.env.VITE_DATA_BACKEND === 'firestore') {
      const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
        if (fbUser && fbUser.email) {
          try {
            const { getFirestore, doc, getDoc } = await import('firebase/firestore');
            const { app } = await import('../lib/firebase');
            const db = getFirestore(app);

            // 1. Check sais_users collection by UID (matches firestore.rules and data layer)
            const userDocRef = doc(db, 'sais_users', fbUser.uid);
            const userSnap = await getDoc(userDocRef);

            if (userSnap.exists()) {
              const userData = userSnap.data() as User;
              setCurrentUser({
                id: fbUser.uid,
                name: userData.name || fbUser.displayName || 'Staff Member',
                role: userData.role,
                schoolId: userData.schoolId || 'demo-school-id',
                email: fbUser.email || userData.email || '',
              });
            } else {
              // Not found in sais_users - unauthorized
              await signOut(auth);
              setCurrentUser(null);
              alert(`Unauthorized: Your account is not registered as active staff.`);
            }
          } catch (err) {
            console.error("Error resolving role:", err);
            await signOut(auth);
            setCurrentUser(null);
            alert(`Authentication error. Check console.`);
          }
        } else {
          setCurrentUser(null);
        }
        setAuthLoading(false);
      });
      return () => unsubscribe();
    } else {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    if (import.meta.env.VITE_DATA_BACKEND !== 'firestore') {
      if (currentUser) {
        localStorage.setItem(AUTH_KEY, JSON.stringify(currentUser));
      } else {
        localStorage.removeItem(AUTH_KEY);
      }
    }
  }, [currentUser]);

  const login = (user: User) => setCurrentUser(user);
  const logout = async () => {
    if (import.meta.env.VITE_DATA_BACKEND === 'firestore') {
      try {
        await signOut(auth);
      } catch (e) {
        console.error('Sign out error', e);
      }
    } else {
      setCurrentUser(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-sais-black flex flex-col justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-sais-red border-t-transparent"></div>
        <p className="mt-4 text-white/70 animate-pulse text-sm">Authenticating...</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ currentUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
