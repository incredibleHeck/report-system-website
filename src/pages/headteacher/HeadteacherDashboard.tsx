import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDatabase } from '../../context/DatabaseContext';
import { UserPlus, BookOpen, User as UserIcon, Plus, Trash2, Save, GraduationCap } from 'lucide-react';
import { SubjectAssignment } from '../../types';

export default function HeadteacherDashboard() {
  const { currentUser } = useAuth();
  const { users, classes, addTeacher, createClass } = useDatabase();

  // Staff Management State
  const [teacherName, setTeacherName] = useState('');

  // Class Management State
  const [className, setClassName] = useState('');
  const [formTeacherId, setFormTeacherId] = useState('');
  const [subjectAssignments, setSubjectAssignments] = useState<SubjectAssignment[]>([
    { subjectName: '', teacherId: '' }
  ]);

  if (!currentUser) return null;

  const teachers = users.filter(u => u.role === 'teacher' && u.schoolId === currentUser.schoolId);

  const handleAddTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherName.trim()) return;
    addTeacher({
      name: teacherName,
      schoolId: currentUser.schoolId,
    });
    setTeacherName('');
  };

  const handleAddSubject = () => {
    setSubjectAssignments([...subjectAssignments, { subjectName: '', teacherId: '' }]);
  };

  const handleRemoveSubject = (index: number) => {
    setSubjectAssignments(subjectAssignments.filter((_, i) => i !== index));
  };

  const handleSubjectChange = (index: number, field: keyof SubjectAssignment, value: string) => {
    const newAssignments = [...subjectAssignments];
    newAssignments[index] = { ...newAssignments[index], [field]: value };
    setSubjectAssignments(newAssignments);
  };

  const handleCreateClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!className || !formTeacherId) return;

    // Filter out incomplete assignments
    const validAssignments = subjectAssignments.filter(sa => sa.subjectName && sa.teacherId);

    createClass({
      name: className,
      teacherId: formTeacherId,
      schoolId: currentUser.schoolId,
      subjectTeachers: validAssignments
    });

    // Reset form
    setClassName('');
    setFormTeacherId('');
    setSubjectAssignments([{ subjectName: '', teacherId: '' }]);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Headteacher Dashboard</h1>
        <p className="text-gray-500">Manage your school's staff and classrooms.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Staff Management */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <UserPlus className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800">Staff Management</h2>
          </div>
          <div className="p-6 space-y-6">
            <form onSubmit={handleAddTeacher} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Teacher Name
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={teacherName}
                    onChange={(e) => setTeacherName(e.target.value)}
                    placeholder="Enter full name"
                    className="flex-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm h-10 border px-3"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>
            </form>

            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Current Staff</h3>
              <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-2">
                {teachers.length === 0 ? (
                  <p className="text-sm text-gray-400 italic py-4 text-center bg-gray-50 rounded-lg">No teachers added yet.</p>
                ) : (
                  teachers.map((teacher) => (
                    <div key={teacher.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg group hover:bg-indigo-50/50 transition-colors">
                      <div className="h-8 w-8 rounded-full bg-white flex items-center justify-center text-xs font-bold text-indigo-600 border border-gray-200">
                        {teacher.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-gray-700">{teacher.name}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Class Management */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center gap-3">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <BookOpen className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800">Class Management</h2>
          </div>
          <div className="p-6">
            <form onSubmit={handleCreateClass} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Class Name
                  </label>
                  <input
                    type="text"
                    required
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    placeholder="e.g. Year 5A"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm h-10 border px-3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Form Teacher
                  </label>
                  <select
                    required
                    value={formTeacherId}
                    onChange={(e) => setFormTeacherId(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm h-10 border px-3 bg-white"
                  >
                    <option value="">Select a teacher</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-700">Subject Teachers</h3>
                  <button
                    type="button"
                    onClick={handleAddSubject}
                    className="text-xs font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                    Add Subject
                  </button>
                </div>

                <div className="space-y-3">
                  {subjectAssignments.map((assignment, index) => (
                    <div key={index} className="flex gap-2 items-end group">
                      <div className="flex-1">
                        {index === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">Subject</label>}
                        <input
                          type="text"
                          value={assignment.subjectName}
                          onChange={(e) => handleSubjectChange(index, 'subjectName', e.target.value)}
                          placeholder="e.g. Mathematics"
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm h-10 border px-3"
                        />
                      </div>
                      <div className="flex-1">
                        {index === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">Teacher</label>}
                        <select
                          value={assignment.teacherId}
                          onChange={(e) => handleSubjectChange(index, 'teacherId', e.target.value)}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm h-10 border px-3 bg-white"
                        >
                          <option value="">Select teacher</option>
                          {teachers.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveSubject(index)}
                        disabled={subjectAssignments.length === 1}
                        className="p-2.5 text-gray-400 hover:text-red-600 disabled:opacity-0 transition-colors"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all active:scale-[0.98]"
                >
                  <Save className="h-4 w-4" />
                  Save Class Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Summary View */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center gap-3">
          <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
            <GraduationCap className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-semibold text-gray-800">Class Overview</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes.filter(c => c.schoolId === currentUser.schoolId).length === 0 ? (
              <p className="col-span-full text-center py-12 text-gray-400 italic bg-gray-50 rounded-xl">No classes configured yet.</p>
            ) : (
              classes
                .filter(c => c.schoolId === currentUser.schoolId)
                .map((cls) => {
                  const formTeacher = users.find(u => u.id === cls.teacherId);
                  return (
                    <div key={cls.id} className="group border border-gray-200 rounded-xl p-5 hover:border-amber-300 hover:shadow-md transition-all">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-bold text-gray-900 text-lg">{cls.name}</h4>
                        <span className="px-2 py-1 bg-amber-50 text-amber-700 text-[10px] font-bold uppercase tracking-wider rounded">Class</span>
                      </div>
                      <p className="text-sm text-gray-600 mb-4 flex items-center gap-2">
                        <UserIcon className="h-4 w-4 text-gray-400" />
                        <span className="font-medium">Form Teacher:</span> {formTeacher?.name || 'Unknown'}
                      </p>
                      <div className="space-y-2 border-t border-gray-100 pt-4">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Subject Assignments</p>
                        {cls.subjectTeachers?.map((st, i) => {
                          const t = users.find(u => u.id === st.teacherId);
                          return (
                            <div key={i} className="flex justify-between items-center text-xs p-2 bg-gray-50 rounded-md">
                              <span className="text-gray-500 font-medium">{st.subjectName}</span>
                              <span className="font-bold text-gray-700">{t?.name || 'Unknown'}</span>
                            </div>
                          );
                        })}
                        {(!cls.subjectTeachers || cls.subjectTeachers.length === 0) && (
                          <p className="text-xs text-gray-400 italic">No subjects assigned</p>
                        )}
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
