import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDatabase } from '../../context/DatabaseContext';
import { School as SchoolIcon, Users, BookOpen, Plus, CheckCircle2 } from 'lucide-react';

export default function HeadteacherDashboard() {
  const { currentUser } = useAuth();
  const { schools, users, classes, registerSchool, addTeacher, createClass } = useDatabase();

  // Find the school associated with this headteacher
  const school = schools.find(s => s.headteacherId === currentUser?.id);
  
  // Derived data
  const schoolTeachers = users.filter(u => u.role === 'teacher' && u.schoolId === school?.id);
  const schoolClasses = classes.filter(c => c.schoolId === school?.id);

  // Form States
  const [schoolName, setSchoolName] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [className, setClassName] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleRegisterSchool = (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolName.trim() || !currentUser) return;
    registerSchool({ name: schoolName, headteacherId: currentUser.id });
    showSuccess('School registered successfully!');
  };

  const handleAddTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherName.trim() || !school) return;
    addTeacher({ name: teacherName, schoolId: school.id });
    setTeacherName('');
    showSuccess('Teacher added successfully!');
  };

  const handleCreateClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!className.trim() || !selectedTeacherId || !school) return;
    createClass({ name: className, teacherId: selectedTeacherId, schoolId: school.id });
    setClassName('');
    setSelectedTeacherId('');
    showSuccess('Class created successfully!');
  };

  // 1. School Setup View
  if (!school) {
    return (
      <div className="max-w-2xl mx-auto mt-10">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 mb-6">
            <SchoolIcon className="h-8 w-8 text-indigo-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome, {currentUser?.name}!</h2>
          <p className="text-gray-500 mb-8">To get started, please register your school's name.</p>
          
          <form onSubmit={handleRegisterSchool} className="max-w-md mx-auto space-y-4">
            <div>
              <input
                type="text"
                required
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="e.g. Accra Academy"
                className="block w-full rounded-md border border-gray-300 px-4 py-3 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
            <button
              type="submit"
              className="w-full flex justify-center items-center rounded-md bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              Register School
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2. Main Dashboard View
  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">{school.name} Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your teachers and classes.</p>
      </div>

      {successMsg && (
        <div className="flex items-center gap-3 rounded-lg bg-green-50 p-4 text-green-800 border border-green-200">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          <p className="text-sm font-medium">{successMsg}</p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="overflow-hidden rounded-xl bg-white px-4 py-5 shadow-sm border border-gray-200 sm:p-6 flex items-center gap-4">
          <div className="rounded-md bg-blue-50 p-3">
            <Users className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <dt className="truncate text-sm font-medium text-gray-500">Total Teachers</dt>
            <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">{schoolTeachers.length}</dd>
          </div>
        </div>
        <div className="overflow-hidden rounded-xl bg-white px-4 py-5 shadow-sm border border-gray-200 sm:p-6 flex items-center gap-4">
          <div className="rounded-md bg-purple-50 p-3">
            <BookOpen className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <dt className="truncate text-sm font-medium text-gray-500">Total Classes</dt>
            <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">{schoolClasses.length}</dd>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Teacher Management */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
            <h3 className="text-base font-semibold leading-6 text-gray-900">Teacher Management</h3>
          </div>
          <div className="p-6">
            <form onSubmit={handleAddTeacher} className="flex gap-3 mb-6">
              <input
                type="text"
                required
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                placeholder="Teacher's Full Name"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
              >
                <Plus className="h-4 w-4 mr-1" /> Add
              </button>
            </form>

            <div className="mt-4 border rounded-lg overflow-hidden">
              <ul className="divide-y divide-gray-200 max-h-60 overflow-y-auto">
                {schoolTeachers.length === 0 ? (
                  <li className="p-4 text-sm text-gray-500 text-center">No teachers added yet.</li>
                ) : (
                  schoolTeachers.map(teacher => (
                    <li key={teacher.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                          {teacher.name.charAt(0)}
                        </div>
                        <span className="text-sm font-medium text-gray-900">{teacher.name}</span>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </div>

        {/* Class Management */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
            <h3 className="text-base font-semibold leading-6 text-gray-900">Class Management</h3>
          </div>
          <div className="p-6">
            <form onSubmit={handleCreateClass} className="space-y-4 mb-6">
              <div>
                <input
                  type="text"
                  required
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="Class Name (e.g. Year 5A)"
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
              <div className="flex gap-3">
                <select
                  required
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                >
                  <option value="">Assign a Form Teacher...</option>
                  {schoolTeachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={schoolTeachers.length === 0}
                  className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="h-4 w-4 mr-1" /> Create
                </button>
              </div>
            </form>

            <div className="mt-4 border rounded-lg overflow-hidden">
              <ul className="divide-y divide-gray-200 max-h-60 overflow-y-auto">
                {schoolClasses.length === 0 ? (
                  <li className="p-4 text-sm text-gray-500 text-center">No classes created yet.</li>
                ) : (
                  schoolClasses.map(cls => {
                    const assignedTeacher = schoolTeachers.find(t => t.id === cls.teacherId);
                    return (
                      <li key={cls.id} className="flex flex-col p-4 hover:bg-gray-50">
                        <span className="text-sm font-medium text-gray-900">{cls.name}</span>
                        <span className="text-xs text-gray-500 mt-1">Form Teacher: {assignedTeacher?.name || 'Unknown'}</span>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
