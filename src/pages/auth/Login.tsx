import { useAuth } from '../../context/AuthContext';
import { useDatabase } from '../../context/DatabaseContext';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Shield, Users, BookOpen } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const { users, students } = useDatabase();
  const navigate = useNavigate();

  const handleLogin = (role: 'headteacher' | 'teacher' | 'student') => {
    let userToLogin;

    if (role === 'headteacher') {
      // Use a stable ID so the registered school persists across logins
      userToLogin = {
        id: 'demo-headteacher-id',
        name: 'Demo Headteacher',
        role: 'headteacher',
        schoolId: 'demo-school-id'
      };
    } else if (role === 'teacher') {
      // Try to log in as the first created teacher, otherwise use a fallback
      const existingTeacher = users.find(u => u.role === 'teacher');
      if (existingTeacher) {
        userToLogin = existingTeacher;
      } else {
        userToLogin = {
          id: 'demo-teacher-id',
          name: 'Demo Teacher',
          role: 'teacher',
          schoolId: 'demo-school-id'
        };
      }
    } else if (role === 'student') {
      // Try to log in as the first created student, otherwise use a fallback
      const existingStudent = students[0];
      if (existingStudent) {
        userToLogin = {
          id: existingStudent.id,
          name: existingStudent.name,
          role: 'student',
          schoolId: existingStudent.schoolId
        };
      } else {
        userToLogin = {
          id: 'demo-student-id',
          name: 'Demo Student',
          role: 'student',
          schoolId: 'demo-school-id'
        };
      }
    }

    if (userToLogin) {
      login(userToLogin as any);
      navigate(`/${role}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-600 shadow-lg">
            <GraduationCap className="h-10 w-10 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
          EduManage GH
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Select your portal to continue
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 space-y-4">
          <button
            onClick={() => handleLogin('headteacher')}
            className="group relative flex w-full items-center justify-center gap-3 rounded-xl border border-transparent bg-indigo-600 px-4 py-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all"
          >
            <Shield className="h-5 w-5 text-indigo-200 group-hover:text-white transition-colors" />
            Headteacher Portal
          </button>
          
          <button
            onClick={() => handleLogin('teacher')}
            className="group relative flex w-full items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white px-4 py-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 hover:border-indigo-300 hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all"
          >
            <Users className="h-5 w-5 text-gray-400 group-hover:text-indigo-600 transition-colors" />
            Teacher Portal
          </button>
          
          <button
            onClick={() => handleLogin('student')}
            className="group relative flex w-full items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white px-4 py-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 hover:border-indigo-300 hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all"
          >
            <BookOpen className="h-5 w-5 text-gray-400 group-hover:text-indigo-600 transition-colors" />
            Student Portal
          </button>
        </div>
      </div>
    </div>
  );
}
