import { useAuth } from '../../context/AuthContext';
import { useDatabase } from '../../context/DatabaseContext';
import { useNavigate } from 'react-router-dom';
import { Shield, BookOpen, Users, Database, Mail, Eye, EyeOff } from 'lucide-react';
import React, { useState } from 'react';

export default function Login() {
  const { login, currentUser } = useAuth();
  const { users, students, schools, seedDemoData } = useDatabase();
  const navigate = useNavigate();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Email/password state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'headteacher' | 'teacher'>('headteacher');

  React.useEffect(() => {
    if (currentUser) {
      if (selectedRole === 'headteacher') {
        if (currentUser.role === 'teacher') {
          alert('Unauthorized Admin Access: Your account does not have Headteacher/Admin permissions.');
          navigate('/teacher');
        } else {
          navigate('/headteacher');
        }
      } else {
        navigate('/teacher');
      }
    }
  }, [currentUser, navigate, selectedRole]);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setLoginError('');
    try {
      const { signInWithGoogle } = await import('../../lib/firebase');
      await signInWithGoogle();
      // Navigation is handled by the useEffect watching currentUser
    } catch (e: any) {
      setLoginError(e.message || 'Sign-in failed. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setLoginError('Please enter both email and password.');
      return;
    }
    setIsLoggingIn(true);
    setLoginError('');
    try {
      const { signInWithEmail } = await import('../../lib/firebase');
      await signInWithEmail(email, password);
      // Navigation is handled by the useEffect watching currentUser
    } catch (e: any) {
      setLoginError(e.message || 'Sign-in failed. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogin = (role: 'headteacher' | 'teacher' | 'student') => {
    let userToLogin;

    if (role === 'headteacher') {
      const existing = users.find((u) => u.role === 'headteacher');
      userToLogin = existing || {
        id: 'demo-headteacher-id',
        name: 'Demo Headteacher',
        role: 'headteacher' as const,
        schoolId: schools[0]?.id || 'demo-school-id',
      };
    } else if (role === 'teacher') {
      const existingTeacher = users.find((u) => u.role === 'teacher');
      userToLogin = existingTeacher || {
        id: 'demo-teacher-id',
        name: 'Demo Teacher',
        role: 'teacher' as const,
        schoolId: schools[0]?.id || 'demo-school-id',
      };
    } else {
      const existingStudent =
        students.find((s) => s.studentKey === 'SAIS-2023-0042') || students[0];
      userToLogin = existingStudent
        ? {
            id: existingStudent.id,
            name: existingStudent.name,
            role: 'student' as const,
            schoolId: existingStudent.schoolId,
            linkedStudentId: existingStudent.id,
            studentKey: existingStudent.studentKey,
          }
        : {
            id: 'demo-student-id',
            name: 'Demo Student',
            role: 'student' as const,
            schoolId: 'demo-school-id',
          };
    }

    login(userToLogin);
    navigate(`/${role}`);
  };

  const isFirestore = import.meta.env.VITE_DATA_BACKEND === 'firestore';

  return (
    <div className="min-h-screen bg-sais-black flex flex-col justify-center py-12 px-4 relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, #d82227 0%, transparent 45%), radial-gradient(circle at 80% 80%, #713f29 0%, transparent 40%)',
        }}
      />

      <div className="relative sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center">
          <img
            src="/sais-logo.png"
            alt="St. Adelaide International Schools"
            className="h-28 w-28 object-contain drop-shadow-lg"
          />
        </div>
        <h1 className="mt-5 text-3xl font-bold tracking-tight text-white font-display">
          SAIS HecTech
        </h1>
        <p className="mt-2 text-sm text-white/60">
          St. Adelaide International Schools — Report Card System
        </p>
        <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-sais-brown-light">
          May we be a shining light to the nations
        </p>
      </div>

      <div className="relative mt-8 sm:mx-auto sm:w-full sm:max-w-md space-y-3">
        {isFirestore ? (
          <div className="bg-white p-8 rounded-lg shadow-xl space-y-6">
            <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200 mb-2">
              <button
                type="button"
                onClick={() => setSelectedRole('headteacher')}
                className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${
                  selectedRole === 'headteacher'
                    ? 'bg-sais-red text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Headteacher / Admin
              </button>
              <button
                type="button"
                onClick={() => setSelectedRole('teacher')}
                className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${
                  selectedRole === 'teacher'
                    ? 'bg-sais-red text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Teacher
              </button>
            </div>

            <form onSubmit={handleEmailLogin} className="space-y-4">
              {loginError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 text-left">
                  {loginError}
                </div>
              )}
              
              <div>
                <label htmlFor="login-email" className="block text-sm font-medium text-slate-700 mb-1.5 text-left">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="w-full rounded-lg bg-white border border-slate-300 pl-10 pr-4 py-3 text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sais-red transition text-sm shadow-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="login-password" className="block text-sm font-medium text-slate-700 mb-1.5 text-left">
                  Password
                </label>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className="w-full rounded-lg bg-white border border-slate-300 pl-10 pr-11 py-3 text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sais-red transition text-sm shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-sais-red hover:bg-red-700 px-4 py-3 font-semibold text-white transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:ring-offset-2"
              >
                {isLoggingIn ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                    Signing in…
                  </>
                ) : (
                  'Sign In with Email'
                )}
              </button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-slate-500 font-medium">OR</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center gap-3 rounded-lg bg-white border border-slate-300 px-4 py-3 font-medium text-slate-700 hover:bg-slate-50 transition shadow-sm disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:ring-offset-2"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="h-5 w-5" />
              Sign in with Google Workspace
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={() => handleLogin('headteacher')}
              className="w-full flex items-center gap-3 rounded-xl bg-sais-ink border border-white/10 px-4 py-4 text-left hover:border-sais-red/60 transition"
            >
              <Shield className="h-6 w-6 text-sais-red" />
              <div>
                <p className="font-semibold text-white">Headteacher Portal</p>
                <p className="text-xs text-white/45">Campuses, teachers, Primary/Secondary classes</p>
              </div>
            </button>

            <button
              onClick={() => handleLogin('teacher')}
              className="w-full flex items-center gap-3 rounded-xl bg-sais-ink border border-white/10 px-4 py-4 text-left hover:border-sais-brown/60 transition"
            >
              <BookOpen className="h-6 w-6 text-sais-brown-light" />
              <div>
                <p className="font-semibold text-white">Teacher Portal</p>
                <p className="text-xs text-white/45">Marks, AI comments, PDFs, delivery</p>
              </div>
            </button>

            <button
              onClick={() => handleLogin('student')}
              className="w-full flex items-center gap-3 rounded-xl bg-sais-ink border border-white/10 px-4 py-4 text-left hover:border-sais-red/40 transition"
            >
              <Users className="h-6 w-6 text-sais-red" />
              <div>
                <p className="font-semibold text-white">Student Portal</p>
                <p className="text-xs text-white/45">View finalized report cards & transcript</p>
              </div>
            </button>

            <button
              onClick={() => {
                seedDemoData();
                alert('Demo Primary + Secondary classes seeded. Log in as Teacher.');
              }}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-sais-brown/40 px-4 py-3 text-sm text-sais-brown-light hover:border-sais-red/50 hover:text-sais-red transition"
            >
              <Database className="h-4 w-4" />
              Load SAIS Demo Data
            </button>
          </>
        )}
      </div>
    </div>
  );
}
