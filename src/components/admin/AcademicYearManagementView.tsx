import React, { useState } from 'react';
import { Calendar, Plus, Lock, Unlock, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useDatabase } from '../../context/DatabaseContext';

export default function AcademicYearManagementView() {
  const {
    selectedAcademicYearId,
    setSelectedAcademicYearId,
    createAcademicYear,
    toggleTermLock,
    systemSettings,
  } = useDatabase();

  const [newYearInput, setNewYearInput] = useState('');
  const [creatingYear, setCreatingYear] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleCreateAcademicYear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newYearInput.trim()) return;
    setCreatingYear(true);
    try {
      const yearStr = newYearInput.trim();
      await createAcademicYear(yearStr, 'upcoming');
      setSuccessMessage(`Academic Year "${yearStr}" and its 3 child terms created successfully!`);
      setNewYearInput('');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      alert(`Error creating Academic Year: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCreatingYear(false);
    }
  };

  const yearsList = [
    { id: '2026/2027', name: '2026/2027', status: 'active', label: 'Active Pointer' },
    { id: '2025/2026', name: '2025/2026', status: 'archived', label: 'Archived' },
    { id: '2024/2025', name: '2024/2025', status: 'archived', label: 'Archived' },
    { id: '2023/2024', name: '2023/2024', status: 'archived', label: 'Archived' },
    { id: '2022/2023', name: '2022/2023', status: 'archived', label: 'Archived' },
    { id: '2021/2022', name: '2021/2022', status: 'archived', label: 'Archived' },
  ];

  const termsList: Array<'T1' | 'T2' | 'T3'> = ['T1', 'T2', 'T3'];

  const getTermLockState = (yearStr: string, termCode: string): boolean => {
    const normKey = yearStr.replace('/', '-').trim();
    const key = `${normKey}_${termCode}`;
    return Boolean(systemSettings?.lockedTerms?.[key]);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-sais-black font-display flex items-center gap-2">
            <Calendar className="w-5 h-5 text-sais-red" />
            Academic Year Lifecycle & Term Edit Lock Engine
          </h2>
          <p className="text-xs text-sais-muted mt-1">
            Manage active academic year pointer, provision new years, and enforce strict term edit locking across teacher accounts
          </p>
        </div>
      </div>

      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          {successMessage}
        </div>
      )}

      {/* Top 2-Column Controls */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Active Academic Year Selection */}
        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-display">
            Active System Pointer Selection
          </h3>
          <div className="flex items-center gap-3">
            <select
              className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-bold text-sais-black focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:outline-none"
              value={selectedAcademicYearId || '2026/2027'}
              onChange={(e) => setSelectedAcademicYearId(e.target.value)}
            >
              {yearsList.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name} ({y.label})
                </option>
              ))}
            </select>
          </div>
          <p className="text-[11px] text-slate-500">
            Currently active academic year pointer for grade entry and active class stream filtering.
          </p>
        </div>

        {/* Create New Academic Year */}
        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-display">
            + Provision New Academic Year & 3 Terms
          </h3>
          <form onSubmit={handleCreateAcademicYear} className="flex gap-2">
            <input
              type="text"
              required
              placeholder="e.g. 2027/2028"
              className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-mono text-sais-black focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:outline-none"
              value={newYearInput}
              onChange={(e) => setNewYearInput(e.target.value)}
            />
            <button
              type="submit"
              disabled={creatingYear || !newYearInput.trim()}
              className="rounded-xl bg-sais-red text-white px-4 py-2 text-xs font-semibold hover:bg-sais-red-dark shadow-xs disabled:opacity-50 flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {creatingYear ? 'Creating...' : 'Add Year'}
            </button>
          </form>
          <p className="text-[11px] text-slate-500">
            Automatically provisions 3 child terms (Term 1, Term 2, Term 3).
          </p>
        </div>
      </div>

      {/* Term Grade Lock Engine Matrix */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between border-b pb-2">
          <div>
            <h3 className="text-base font-bold text-sais-black font-display flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-sais-red" />
              Term Grade Edit Lock Matrix (`isTermLocked`)
            </h3>
            <p className="text-xs text-sais-muted">
              Toggle locks per term. When active, all MasterSheet cells convert to <code className="font-mono bg-slate-100 px-1 rounded">readOnly={`{true}`}</code> for teacher accounts, preserving administrative overrides for Headteachers.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {yearsList.map((y) => (
            <div
              key={y.id}
              className={`rounded-2xl border p-4 space-y-3 transition-all ${
                selectedAcademicYearId === y.id
                  ? 'bg-red-50/30 border-red-200 ring-2 ring-sais-red/20'
                  : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="font-bold text-sm text-sais-black font-mono">{y.name}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                    y.status === 'active'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {y.label}
                </span>
              </div>

              <div className="space-y-2 pt-1">
                {termsList.map((tCode) => {
                  const isLocked = getTermLockState(y.name, tCode);
                  const termLabel = tCode === 'T1' ? 'Term 1' : tCode === 'T2' ? 'Term 2' : 'Term 3';

                  return (
                    <div
                      key={tCode}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200/80 bg-slate-50 text-xs"
                    >
                      <span className="font-semibold text-slate-800">{termLabel}</span>
                      <button
                        type="button"
                        onClick={() => toggleTermLock(y.name, tCode)}
                        className={`rounded-lg px-3 py-1 text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-2xs ${
                          isLocked
                            ? 'bg-rose-100 text-rose-900 border border-rose-300 hover:bg-rose-200'
                            : 'bg-emerald-100 text-emerald-900 border border-emerald-300 hover:bg-emerald-200'
                        }`}
                      >
                        {isLocked ? (
                          <>
                            <Lock className="w-3.5 h-3.5 text-rose-700" />
                            LOCKED
                          </>
                        ) : (
                          <>
                            <Unlock className="w-3.5 h-3.5 text-emerald-700" />
                            UNLOCKED
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
