import React, { useState, useMemo } from 'react';
import { Search, UserCheck, Clock, Edit2 } from 'lucide-react';
import { useDatabase } from '../../context/DatabaseContext';
import Modal from '../ui/Modal';
import type { LifelongStudent, StudentStatus } from '../../types';

export default function StudentRegistryView() {
  const { lifelongStudents, enrollments, classes, updateStudent } = useDatabase();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | StudentStatus>('all');
  const [selectedStudent, setSelectedStudent] = useState<LifelongStudent | null>(null);

  // Edit Demographics state
  const [editingStudent, setEditingStudent] = useState<LifelongStudent | null>(null);
  const [editName, setEditName] = useState('');
  const [editGender, setEditGender] = useState<'Male' | 'Female' | 'Unknown'>('Male');
  const [editStatus, setEditStatus] = useState<StudentStatus>('active');

  const filteredStudents = useMemo(() => {
    return lifelongStudents.filter((student) => {
      const matchSearch =
        search.trim() === '' ||
        student.name.toLowerCase().includes(search.toLowerCase()) ||
        student.studentKey.toLowerCase().includes(search.toLowerCase());

      const matchStatus = statusFilter === 'all' || student.status === statusFilter;

      return matchSearch && matchStatus;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [lifelongStudents, search, statusFilter]);

  const handleOpenEdit = (student: LifelongStudent) => {
    setEditingStudent(student);
    setEditName(student.name);
    setEditGender(student.gender);
    setEditStatus(student.status);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    updateStudent(editingStudent.id, {
      name: editName.trim().toUpperCase(),
      gender: editGender,
      status: editStatus,
    });
    setEditingStudent(null);
  };

  // Build enrollment timeline for selected student
  const studentTimeline = useMemo(() => {
    if (!selectedStudent) return [];
    const studentEnrs = enrollments
      .filter((e) => e.studentKey === selectedStudent.studentKey || e.studentId === selectedStudent.id)
      .sort((a, b) => b.academicYear.localeCompare(a.academicYear));

    return studentEnrs.map((en) => {
      const cls = classes.find((c) => c.id === en.classId);
      return {
        ...en,
        className: cls?.name || en.className || 'Class Stream',
      };
    });
  }, [selectedStudent, enrollments, classes]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-200 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-sais-black font-display flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-sais-red" />
            Centralized Student Directory & Registry
          </h2>
          <p className="text-xs text-sais-muted mt-1">
            Global roster of lifelong students across all academic years ({lifelongStudents.length} total)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search name or SAIS-STU-XXXX..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-1.5 text-xs rounded-xl border border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:border-sais-red w-64 shadow-xs"
            />
          </div>

          {/* Status filters */}
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs gap-1">
            {(['all', 'active', 'transferred', 'alumni'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-lg font-medium capitalize transition-all ${
                  statusFilter === st
                    ? 'bg-white text-sais-black shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-sais-black'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Roster Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200/70">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-sais-muted border-b border-slate-200 bg-slate-50/70">
              <th className="py-3 px-4 font-semibold text-xs uppercase tracking-wider">Lifelong Key</th>
              <th className="py-3 px-4 font-semibold text-xs uppercase tracking-wider">Full Name</th>
              <th className="py-3 px-4 font-semibold text-xs uppercase tracking-wider">Gender</th>
              <th className="py-3 px-4 font-semibold text-xs uppercase tracking-wider">Joined Year</th>
              <th className="py-3 px-4 font-semibold text-xs uppercase tracking-wider">Status</th>
              <th className="py-3 px-4 font-semibold text-xs uppercase tracking-wider">Current / Latest Class</th>
              <th className="py-3 px-4 font-semibold text-xs uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-sais-muted text-sm italic">
                  No students found matching search filters.
                </td>
              </tr>
            ) : (
              filteredStudents.map((st) => {
                const latestEnr = enrollments
                  .filter((e) => e.studentKey === st.studentKey || e.studentId === st.id)
                  .sort((a, b) => b.academicYear.localeCompare(a.academicYear))[0];

                return (
                  <tr
                    key={st.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono text-xs font-bold text-sais-red">
                      {st.studentKey}
                    </td>
                    <td className="py-3 px-4 font-semibold text-sais-black">
                      {st.name}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {st.gender}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600">
                      {st.yearJoined || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider border ${
                          st.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : st.status === 'transferred'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {st.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-slate-700">
                      {latestEnr ? (
                        <span>
                          {latestEnr.className} ({latestEnr.academicYear.replace('_', '/')})
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Unenrolled</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => setSelectedStudent(st)}
                        className="text-xs text-sais-red hover:text-sais-red-dark font-semibold inline-flex items-center gap-1 hover:underline"
                      >
                        <Clock className="w-3 h-3" />
                        Timeline
                      </button>
                      <button
                        onClick={() => handleOpenEdit(st)}
                        className="text-xs text-slate-500 hover:text-slate-800 font-medium inline-flex items-center gap-1 hover:underline"
                      >
                        <Edit2 className="w-3 h-3" />
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Student Enrollment History Timeline Modal */}
      <Modal
        isOpen={Boolean(selectedStudent)}
        onClose={() => setSelectedStudent(null)}
        title="Lifelong Student Academic History"
        subtitle={`${selectedStudent?.name} (${selectedStudent?.studentKey})`}
      >
        <div className="space-y-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between text-xs">
            <div>
              <p className="text-slate-500 font-medium">Lifelong Key</p>
              <p className="font-bold font-mono text-sais-red text-sm mt-0.5">{selectedStudent?.studentKey}</p>
            </div>
            <div>
              <p className="text-slate-500 font-medium">Gender</p>
              <p className="font-semibold text-slate-800 text-sm mt-0.5">{selectedStudent?.gender}</p>
            </div>
            <div>
              <p className="text-slate-500 font-medium">Year Joined SAIS</p>
              <p className="font-semibold text-slate-800 text-sm mt-0.5">{selectedStudent?.yearJoined}</p>
            </div>
            <div>
              <p className="text-slate-500 font-medium">Current Status</p>
              <span className="inline-block font-semibold uppercase text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded text-[10px] mt-0.5">
                {selectedStudent?.status}
              </span>
            </div>
          </div>

          <h4 className="font-bold text-slate-800 text-sm font-display pt-2">Multi-Year Class Enrollment Timeline</h4>

          {studentTimeline.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-4 text-center">No academic year class enrollments recorded yet.</p>
          ) : (
            <div className="relative pl-6 border-l-2 border-slate-200 space-y-4">
              {studentTimeline.map((enr) => (
                <div key={enr.id} className="relative bg-white p-3.5 rounded-xl border border-slate-200 text-xs space-y-1 shadow-2xs">
                  <div className="absolute -left-[31px] top-4 w-3.5 h-3.5 rounded-full bg-sais-red border-2 border-white" />
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-sm text-sais-black">{enr.className}</span>
                    <span className="font-mono font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      {enr.academicYear.replace('_', '/')}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600 text-[11px] pt-1">
                    <span>Roll Number: <strong className="font-mono text-slate-800">{enr.rollNumber}</strong></span>
                    <span>Index: <strong className="font-mono text-slate-800">{enr.index}</strong></span>
                    <span>Enrolled Terms: <strong className="text-sais-red font-mono">{(enr.enrolledTerms || []).join(', ')}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-slate-100">
            <button
              onClick={() => setSelectedStudent(null)}
              className="rounded-lg bg-slate-800 text-white px-4 py-2 text-xs font-semibold hover:bg-black transition-all"
            >
              Close Timeline
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Student Demographics Modal */}
      <Modal
        isOpen={Boolean(editingStudent)}
        onClose={() => setEditingStudent(null)}
        title="Edit Student Demographics"
        subtitle={`Update global record for ${editingStudent?.studentKey}`}
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Gender
              </label>
              <select
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-sais-black focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:outline-none"
                value={editGender}
                onChange={(e) => setEditGender(e.target.value as any)}
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Unknown">Unknown</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Status
              </label>
              <select
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-sais-black focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:outline-none"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as StudentStatus)}
              >
                <option value="active">Active</option>
                <option value="transferred">Transferred</option>
                <option value="alumni">Alumni</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setEditingStudent(null)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-sais-red text-white px-4 py-2 text-xs font-semibold hover:bg-sais-red-dark shadow-xs"
            >
              Save Changes
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
