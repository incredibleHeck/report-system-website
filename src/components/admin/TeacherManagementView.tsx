import React, { useState, useMemo } from 'react';
import { UserCheck, UserPlus, Shield, Edit2, Trash2, CheckCircle2, XCircle, BookOpen } from 'lucide-react';
import { useDatabase } from '../../context/DatabaseContext';
import { getAllUniqueSubjects } from '../../lib/programmeSchemas';
import Modal from '../ui/Modal';
import type { User } from '../../types';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '../../lib/firebase';

export default function TeacherManagementView() {
  const { users, classes, enrollments, addTeacher, updateUser, schools } = useDatabase();
  const schoolId = schools[0]?.id || 'SAIS-SCHOOL-MAIN';

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);

  // New Teacher Form state
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newSubjects, setNewSubjects] = useState<string[]>([]);
  const [newStatus, setNewStatus] = useState<'active' | 'inactive'>('active');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Edit Teacher Specializations state
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editSubjects, setEditSubjects] = useState<string[]>([]);
  const [editStatus, setEditStatus] = useState<'active' | 'inactive'>('active');

  const masterSubjects = getAllUniqueSubjects();

  // All teachers (role = 'teacher' or 'headteacher')
  const teacherList = useMemo(() => {
    return users
      .filter((u) => u.role === 'teacher' || u.role === 'headteacher')
      .sort((a, b) => (a.name || a.email || '').localeCompare(b.name || b.email || ''));
  }, [users]);

  // Compute Workload Metrics per teacher (Pre-indexed for O(1) student lookups)
  const teacherWorkloads = useMemo(() => {
    const map = new Map<
      string,
      { formClasses: string[]; subjectClassesCount: number; totalStudentsTaught: number }
    >();

    // Pre-index student counts per class stream (O(E))
    const studentCountMap = new Map<string, number>();
    enrollments.forEach((e) => {
      studentCountMap.set(e.classId, (studentCountMap.get(e.classId) || 0) + 1);
    });

    teacherList.forEach((t) => {
      const formClasses = classes.filter((c) => c.teacherId === t.id).map((c) => c.name);
      let subjectClassesCount = 0;
      const taughtClassIds = new Set<string>();

      classes.forEach((c) => {
        const isFormTeacher = c.teacherId === t.id;
        const isSubjectTeacher = c.subjectTeachers?.some((st) => st.teacherId === t.id);
        if (isSubjectTeacher) {
          subjectClassesCount++;
        }
        if (isFormTeacher || isSubjectTeacher) {
          taughtClassIds.add(c.id);
        }
      });

      let totalStudentsTaught = 0;
      taughtClassIds.forEach((cId) => {
        totalStudentsTaught += studentCountMap.get(cId) || 0;
      });

      map.set(t.id, {
        formClasses,
        subjectClassesCount,
        totalStudentsTaught,
      });
    });

    return map;
  }, [teacherList, classes, enrollments]);

  const toggleSubjectInList = (list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>, subName: string) => {
    setList(
      list.includes(subName)
        ? list.filter((s) => s !== subName)
        : [...list, subName].sort((a, b) => a.localeCompare(b))
    );
  };

  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFullName.trim() || !newEmail.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setAuthError(null);
    const email = newEmail.trim().toLowerCase();
    const password = newPassword.trim() || 'sais1234';

    let firebaseAuthUid: string | undefined = undefined;

    try {
      // Create Firebase Auth user via secondary app instance to preserve current admin session
      if (firebaseConfig && firebaseConfig.apiKey) {
        const appName = `SecondaryAuthApp_${Date.now()}`;
        let secondaryApp;
        try {
          secondaryApp = initializeApp(firebaseConfig, appName);
          const secondaryAuth = getAuth(secondaryApp);
          const userCred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
          firebaseAuthUid = userCred.user.uid;
        } catch (err: any) {
          console.warn('Secondary Firebase Auth creation note:', err?.message || err);
          const code = err?.code || '';
          let msg = 'Failed to register authentication credentials.';
          if (code === 'auth/email-already-in-use') {
            msg = 'This email address is already in use by another account.';
          } else if (code === 'auth/weak-password') {
            msg = 'Password is too weak. Please use at least 6 characters.';
          } else if (code === 'auth/invalid-email') {
            msg = 'Invalid email address format.';
          } else if (err?.message) {
            msg = err.message;
          }
          setAuthError(msg);
          return; // ABORT creation: do NOT proceed to addTeacher if Firebase Auth fails
        } finally {
          if (secondaryApp) {
            try {
              await deleteApp(secondaryApp);
            } catch (e) {
              // Ignore cleanup error
            }
          }
        }
      }

      addTeacher({
        name: newFullName.trim(),
        email,
        phone: newPhone.trim(),
        password,
        status: newStatus,
        schoolId,
        subjects: newSubjects.sort((a, b) => a.localeCompare(b)),
        ...(firebaseAuthUid ? { id: firebaseAuthUid } : {}),
      });

      setIsAddModalOpen(false);
      setNewFullName('');
      setNewEmail('');
      setNewPhone('');
      setNewPassword('');
      setNewSubjects([]);
      setNewStatus('active');
      setAuthError(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEdit = (t: User) => {
    setEditingTeacherId(t.id);
    setEditName(t.name || '');
    setEditPhone(t.phone || '');
    setEditSubjects(t.subjects || []);
    setEditStatus(t.status || 'active');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeacherId) return;

    updateUser(editingTeacherId, {
      name: editName.trim(),
      phone: editPhone.trim(),
      subjects: editSubjects.sort((a, b) => a.localeCompare(b)),
      status: editStatus,
    });

    setEditingTeacherId(null);
  };

  const handleToggleStatus = (t: User) => {
    const nextStatus = t.status === 'inactive' ? 'active' : 'inactive';
    updateUser(t.id, { status: nextStatus });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-sais-black font-display flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-sais-red" />
            Staff & Teacher Management Roster
          </h2>
          <p className="text-xs text-sais-muted mt-1">
            Register new staff accounts, set specializations, manage active status, and monitor workload metrics ({teacherList.length} total staff)
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="rounded-xl bg-sais-red text-white px-4 py-2.5 text-xs font-semibold hover:bg-sais-red-dark active:scale-[0.98] transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          + Add New Teacher
        </button>
      </div>

      {/* Roster Cards / Table */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teacherList.map((teacher) => {
          const workload = teacherWorkloads.get(teacher.id) || {
            formClasses: [],
            subjectClassesCount: 0,
            totalStudentsTaught: 0,
          };
          const isActive = teacher.status !== 'inactive';

          return (
            <div
              key={teacher.id}
              className={`rounded-2xl border p-5 transition-all space-y-3 relative overflow-hidden flex flex-col justify-between ${
                isActive
                  ? 'bg-white border-slate-200 hover:shadow-md'
                  : 'bg-slate-50 border-slate-200/60 opacity-75'
              }`}
            >
              <div className="space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-sais-red text-white font-bold text-sm flex items-center justify-center shadow-xs">
                      {(teacher.name || teacher.email || 'T').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{teacher.name || 'Unnamed Teacher'}</h3>
                      <p className="text-xs text-slate-500 font-mono">{teacher.email || 'No email'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleStatus(teacher)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border cursor-pointer ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    {isActive ? 'Active' : 'Inactive'}
                  </button>
                </div>

                {/* Workload Metric Counters */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs space-y-1">
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Form Teacher Class:</span>
                    <strong className="text-slate-900 font-bold">
                      {workload.formClasses.length > 0 ? workload.formClasses.join(', ') : 'None'}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Subject Classes Taught:</span>
                    <strong className="text-sais-red font-mono font-bold">{workload.subjectClassesCount} streams</strong>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Total Students Taught:</span>
                    <strong className="text-emerald-700 font-mono font-bold">{workload.totalStudentsTaught} students</strong>
                  </div>
                </div>

                {/* Subject Specializations */}
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    Specializations:
                  </span>
                  {teacher.subjects && teacher.subjects.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {teacher.subjects.map((s) => (
                        <span
                          key={s}
                          className="bg-slate-100 text-slate-700 border border-slate-200 rounded-md px-2 py-0.5 text-[11px] font-medium"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 italic">No specializations set</span>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end items-center gap-2">
                <button
                  onClick={() => handleOpenEdit(teacher)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all inline-flex items-center gap-1 shadow-2xs"
                >
                  <Edit2 className="w-3.5 h-3.5 text-sais-red" />
                  Edit Staff
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Direct Staff Registration Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Direct Staff Account Registration"
        subtitle="Register new teacher account strictly within the SAIS Admin Portal"
      >
        <form onSubmit={handleCreateTeacher} className="space-y-4">
          {authError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800 flex items-center gap-2">
              <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{authError}</span>
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Full Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Akosua Mensah"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-sais-black focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:outline-none"
              value={newFullName}
              onChange={(e) => setNewFullName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Email Address *
              </label>
              <input
                type="email"
                required
                placeholder="teacher@saintadelaide.org"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-sais-black focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:outline-none"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                placeholder="024 123 4567"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-sais-black focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:outline-none"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Initial Password
              </label>
              <input
                type="text"
                placeholder="Default: sais1234"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-sais-black focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:outline-none font-mono"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Status
              </label>
              <select
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-sais-black focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:outline-none"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as any)}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Select Subject Specializations
            </label>
            <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 border border-slate-200 rounded-xl max-h-40 overflow-y-auto">
              {masterSubjects.map((sub) => {
                const isSelected = newSubjects.includes(sub.name);
                return (
                  <button
                    type="button"
                    key={sub.code}
                    onClick={() => toggleSubjectInList(newSubjects, setNewSubjects, sub.name)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-sais-red text-white border-sais-red shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {isSelected ? '✓ ' : '+ '}
                    {sub.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-sais-red text-white px-4 py-2 text-xs font-semibold hover:bg-sais-red-dark shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 min-h-[44px] cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                  <span>Registering...</span>
                </>
              ) : (
                <span>Register Staff Account</span>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Staff Specializations Modal */}
      <Modal
        isOpen={Boolean(editingTeacherId)}
        onClose={() => setEditingTeacherId(null)}
        title="Edit Staff Specializations & Status"
        subtitle="Update subject specializations and phone number"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Full Name
            </label>
            <input
              type="text"
              required
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-sais-black focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:outline-none"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-sais-black focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:outline-none"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Account Status
              </label>
              <select
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-sais-black focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:outline-none"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as any)}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Teacher Specializations (Subject Pills)
            </label>
            <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 border border-slate-200 rounded-xl max-h-48 overflow-y-auto">
              {masterSubjects.map((sub) => {
                const isSelected = editSubjects.includes(sub.name);
                return (
                  <button
                    type="button"
                    key={sub.code}
                    onClick={() => toggleSubjectInList(editSubjects, setEditSubjects, sub.name)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-sais-red text-white border-sais-red shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {isSelected ? '✓ ' : '+ '}
                    {sub.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setEditingTeacherId(null)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-sais-red text-white px-4 py-2 text-xs font-semibold hover:bg-sais-red-dark shadow-xs"
            >
              Save Staff Changes
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
