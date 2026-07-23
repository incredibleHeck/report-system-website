import { useAuth } from '../../context/AuthContext';
import { useDatabase } from '../../context/DatabaseContext';
import { useNavigate } from 'react-router-dom';
import { Shield, Users, BookOpen, Database } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const { users, students, schools, seedDemoData } = useDatabase();
  const navigate = useNavigate();

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
      </div>
    </div>
  );
}
