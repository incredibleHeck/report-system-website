import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useDatabase } from '../../context/DatabaseContext';
import { Users, UserPlus, GraduationCap, CheckCircle2, BookOpen, PenTool } from 'lucide-react';

export default function TeacherDashboard() {
  const { currentUser } = useAuth();
  const { classes, students, addStudent } = useDatabase();
  const navigate = useNavigate();

  const [studentId, setStudentId] = useState('');
  const [fullName, setFullName] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!currentUser) return null;

  // 1. My Form Classes (formTeacherId === currentUser.id)
  const formClasses = classes.filter(c => c.teacherId === currentUser.id);

  // 2. My Subject Classes (listed in subjectTeachers array)
  const subjectClasses = classes.filter(c => 
    c.subjectTeachers?.some(st => st.teacherId === currentUser.id)
  );

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleAddStudent = (e: React.FormEvent, classId: string) => {
    e.preventDefault();
    if (!studentId.trim() || !fullName.trim()) return;
    
    addStudent({
      studentId: studentId.trim(),
      name: fullName.trim(),
      classId,
      schoolId: currentUser.schoolId
    });
    
    setStudentId('');
    setFullName('');
    showSuccess('Student added successfully!');
  };

  const handleEnterMarks = (classId: string, subjectName: string) => {
    navigate('/teacher/grid', { state: { classId, subjectName } });
  };

  return (
    <div className="space-y-10 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Teacher Dashboard</h1>
        <p className="text-gray-500 text-lg">Manage your form classes and enter marks for your subjects.</p>
      </div>

      {successMsg && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3 rounded-lg bg-green-50 p-4 text-green-800 border border-green-200 shadow-lg animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          <p className="text-sm font-medium">{successMsg}</p>
        </div>
      )}

      {/* Section: My Form Classes */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 border-b border-gray-200 pb-2">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <Users className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">My Form Classes</h2>
        </div>

        {formClasses.length === 0 ? (
          <div className="bg-gray-50 rounded-xl p-8 border border-dashed border-gray-300 text-center">
            <p className="text-gray-500 italic">You are not assigned as a Form Teacher for any class.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {formClasses.map((cls) => {
              const classStudents = students.filter(s => s.classId === cls.id);
              return (
                <div key={cls.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden transition-all hover:shadow-md">
                  <div className="bg-indigo-600 px-6 py-4 flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white">{cls.name}</h3>
                    <div className="bg-indigo-500/30 px-3 py-1 rounded-full text-indigo-50 text-xs font-bold uppercase tracking-wider">
                      {classStudents.length} Students
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
                    {/* Add Student Form */}
                    <div className="p-6 border-b lg:border-b-0 lg:border-r border-gray-100 bg-gray-50/50">
                      <div className="flex items-center gap-2 mb-4 text-gray-700">
                        <UserPlus className="h-4 w-4" />
                        <h4 className="font-semibold text-sm">Add New Student</h4>
                      </div>
                      <form onSubmit={(e) => handleAddStudent(e, cls.id)} className="space-y-4">
                        <input
                          type="text"
                          required
                          value={studentId}
                          onChange={(e) => setStudentId(e.target.value)}
                          placeholder="Student ID (e.g. STU001)"
                          className="w-full rounded-lg border-gray-300 shadow-sm focus:ring-2 focus:ring-indigo-500 h-10 px-3 text-sm border"
                        />
                        <input
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Full Name"
                          className="w-full rounded-lg border-gray-300 shadow-sm focus:ring-2 focus:ring-indigo-500 h-10 px-3 text-sm border"
                        />
                        <button
                          type="submit"
                          className="w-full bg-indigo-600 text-white font-bold py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                          Add Student
                        </button>
                      </form>
                    </div>

                    {/* Student List */}
                    <div className="lg:col-span-2 p-0 overflow-x-auto max-h-[300px] overflow-y-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                          <tr>
                            <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">ID</th>
                            <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Name</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                          {classStudents.length === 0 ? (
                            <tr>
                              <td colSpan={2} className="px-6 py-10 text-center text-sm text-gray-400 italic">No students added yet.</td>
                            </tr>
                          ) : (
                            classStudents.map((s) => (
                              <tr key={s.id} className="hover:bg-gray-50">
                                <td className="px-6 py-3 text-sm font-mono text-gray-500">{s.studentId}</td>
                                <td className="px-6 py-3 text-sm font-medium text-gray-900">{s.name}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Section: My Subject Classes */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 border-b border-gray-200 pb-2">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
            <BookOpen className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">My Subject Classes</h2>
        </div>

        {subjectClasses.length === 0 ? (
          <div className="bg-gray-50 rounded-xl p-8 border border-dashed border-gray-300 text-center">
            <p className="text-gray-500 italic">You have no subject assignments.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {subjectClasses.map((cls) => {
              // Find which subjects this teacher teaches in this class
              const assignments = cls.subjectTeachers?.filter(st => st.teacherId === currentUser.id) || [];
              return assignments.map((st, idx) => (
                <div key={`${cls.id}-${st.subjectName}-${idx}`} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all group">
                  <div className="flex flex-col h-full">
                    <div className="mb-4">
                      <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-1 rounded">Subject</span>
                      <h3 className="text-xl font-bold text-gray-900 mt-2">{st.subjectName}</h3>
                      <p className="text-gray-500 font-medium">Class: {cls.name}</p>
                    </div>
                    
                    <button
                      onClick={() => handleEnterMarks(cls.id, st.subjectName)}
                      className="mt-auto flex items-center justify-center gap-2 w-full bg-gray-900 text-white font-bold py-3 rounded-xl hover:bg-emerald-600 transition-all active:scale-[0.98]"
                    >
                      <PenTool className="h-4 w-4" />
                      Enter Marks
                    </button>
                  </div>
                </div>
              ));
            })}
          </div>
        )}
      </section>
    </div>
  );
}
