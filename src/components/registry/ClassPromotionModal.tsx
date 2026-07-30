import React, { useState, useMemo } from 'react';
import { RefreshCw, ArrowRight, CheckSquare, Square, Users, AlertCircle } from 'lucide-react';
import { useDatabase } from '../../context/DatabaseContext';
import Modal from '../ui/Modal';
import { normalizeYearId } from '../../context/DatabaseContext';
import type { TermCode } from '../../types';

interface ClassPromotionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ClassPromotionModal({ isOpen, onClose }: ClassPromotionModalProps) {
  const { classes, enrollments, lifelongStudents, bulkPromoteStudents } = useDatabase();

  const [sourceYear, setSourceYear] = useState('2025/2026');
  const [targetYear, setTargetYear] = useState('2026/2027');
  const [sourceClassId, setSourceClassId] = useState('');
  const [targetClassId, setTargetClassId] = useState('');

  const [selectedStudents, setSelectedStudents] = useState<
    Record<string, { promoted: boolean; targetClassId: string; rollNumber: string }>
  >({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Academic year streams
  const sourceStreams = useMemo(() => {
    const normYear = sourceYear.replace('/', '-');
    return classes.filter(
      (c) =>
        (c.academicYearId && normalizeYearId(c.academicYearId) === normYear) ||
        (c.academicYear && normalizeYearId(c.academicYear) === normYear) ||
        c.id.startsWith(normYear)
    );
  }, [classes, sourceYear]);

  const targetStreams = useMemo(() => {
    const normYear = targetYear.replace('/', '-');
    return classes.filter(
      (c) =>
        (c.academicYearId && normalizeYearId(c.academicYearId) === normYear) ||
        (c.academicYear && normalizeYearId(c.academicYear) === normYear) ||
        c.id.startsWith(normYear)
    );
  }, [classes, targetYear]);

  // Students in selected source class
  const sourceClassStudents = useMemo(() => {
    if (!sourceClassId) return [];
    const enrs = enrollments.filter((e) => e.classId === sourceClassId);
    return enrs.map((e) => {
      const life = lifelongStudents.find((l) => l.studentKey === e.studentKey || l.id === e.studentId);
      return {
        enrollmentId: e.id,
        studentKey: e.studentKey,
        studentId: e.studentId,
        name: life?.name || e.studentId,
        gender: life?.gender || 'Unknown',
        currentRoll: e.rollNumber,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [sourceClassId, enrollments, lifelongStudents]);

  // Initialize selection when source/target class changes
  React.useEffect(() => {
    if (!sourceClassStudents.length) return;
    const initialMap: Record<string, { promoted: boolean; targetClassId: string; rollNumber: string }> = {};
    
    sourceClassStudents.forEach((st, idx) => {
      initialMap[st.studentKey] = {
        promoted: true,
        targetClassId: targetClassId || targetStreams[0]?.id || '',
        rollNumber: String(idx + 1).padStart(3, '0'),
      };
    });
    setSelectedStudents(initialMap);
  }, [sourceClassId, targetClassId, sourceClassStudents]);

  const togglePromote = (key: string) => {
    setSelectedStudents((prev) => ({
      ...prev,
      [key]: { ...prev[key], promoted: !prev[key]?.promoted },
    }));
  };

  const setStudentTargetClass = (key: string, clsId: string) => {
    setSelectedStudents((prev) => ({
      ...prev,
      [key]: { ...prev[key], targetClassId: clsId },
    }));
  };

  const setStudentRollNumber = (key: string, roll: string) => {
    setSelectedStudents((prev) => ({
      ...prev,
      [key]: { ...prev[key], rollNumber: roll },
    }));
  };

  const handlePromoteAll = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const toPromote = (Object.entries(selectedStudents) as Array<[string, { promoted: boolean; targetClassId: string; rollNumber: string }]>)
      .filter(([_, val]) => val.promoted && val.targetClassId)
      .map(([key, val]) => ({
        studentKey: key,
        targetClassId: val.targetClassId,
        rollNumber: val.rollNumber.trim().toUpperCase(),
        index: val.rollNumber.trim().padStart(3, '0'),
        enrolledTerms: ['T1', 'T2', 'T3'] as TermCode[],
      }));

    if (toPromote.length === 0) {
      setError('Please select at least one student to promote.');
      return;
    }

    try {
      bulkPromoteStudents(toPromote);
      setSuccess(`Successfully promoted and assigned ${toPromote.length} students into their new class stream!`);
      setTimeout(() => {
        onClose();
        setSuccess('');
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Class promotion failed');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Academic Year Class Promotion & Stream Shuffling Engine"
      subtitle="Promote and reassign students across stream A/B streams for the new academic year"
    >
      <form onSubmit={handlePromoteAll} className="space-y-5">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-700">
            {success}
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
          {/* Source setup */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              1. Source Academic Year & Class
            </label>
            <div className="flex gap-2">
              <select
                className="w-1/2 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-sais-black focus-visible:ring-2 focus-visible:ring-sais-red"
                value={sourceYear}
                onChange={(e) => {
                  setSourceYear(e.target.value);
                  setSourceClassId('');
                }}
              >
                <option value="2025/2026">2025/2026 (Archived)</option>
                <option value="2024/2025">2024/2025 (Archived)</option>
                <option value="2026/2027">2026/2027 (Active)</option>
              </select>
              <select
                className="w-1/2 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-sais-black focus-visible:ring-2 focus-visible:ring-sais-red"
                value={sourceClassId}
                onChange={(e) => setSourceClassId(e.target.value)}
                required
              >
                <option value="">Select source stream...</option>
                {sourceStreams.map((cs) => (
                  <option key={cs.id} value={cs.id}>
                    {cs.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Destination setup */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              2. Target Academic Year & Primary Stream
            </label>
            <div className="flex gap-2">
              <select
                className="w-1/2 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-sais-black focus-visible:ring-2 focus-visible:ring-sais-red"
                value={targetYear}
                onChange={(e) => {
                  setTargetYear(e.target.value);
                  setTargetClassId('');
                }}
              >
                <option value="2026/2027">2026/2027 (Active Pointer)</option>
                <option value="2027/2028">2027/2028 (Upcoming)</option>
              </select>
              <select
                className="w-1/2 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-sais-black focus-visible:ring-2 focus-visible:ring-sais-red"
                value={targetClassId}
                onChange={(e) => setTargetClassId(e.target.value)}
                required
              >
                <option value="">Select target stream...</option>
                {targetStreams.map((cs) => (
                  <option key={cs.id} value={cs.id}>
                    {cs.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Student Roster Matrix for Shuffling */}
        {sourceClassId && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-sm text-sais-black font-display flex items-center gap-2">
                <Users className="w-4 h-4 text-sais-red" />
                Stream Roster Allocation ({sourceClassStudents.length} Students)
              </h4>
              <p className="text-xs text-sais-muted">
                Assign individual target streams (e.g. Stream A vs Stream B)
              </p>
            </div>

            <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
              {sourceClassStudents.map((st) => {
                const config = selectedStudents[st.studentKey] || {
                  promoted: true,
                  targetClassId,
                  rollNumber: '001',
                };

                return (
                  <div
                    key={st.studentKey}
                    className={`p-3 text-xs flex flex-wrap items-center justify-between gap-3 transition-colors ${
                      config.promoted ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/70 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                      <button
                        type="button"
                        onClick={() => togglePromote(st.studentKey)}
                        className="text-sais-red hover:scale-105 transition-transform"
                      >
                        {config.promoted ? (
                          <CheckSquare className="w-4 h-4" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                      </button>

                      <div>
                        <p className="font-bold text-slate-800">{st.name}</p>
                        <p className="font-mono text-[11px] text-sais-red">{st.studentKey}</p>
                      </div>
                    </div>

                    {config.promoted && (
                      <div className="flex items-center gap-2">
                        {/* Stream Shuffling Selector */}
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] text-slate-500 font-medium">Stream:</span>
                          <select
                            className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-800 focus-visible:ring-1 focus-visible:ring-sais-red"
                            value={config.targetClassId}
                            onChange={(e) => setStudentTargetClass(st.studentKey, e.target.value)}
                          >
                            {targetStreams.map((cs) => (
                              <option key={cs.id} value={cs.id}>
                                {cs.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Roll number */}
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] text-slate-500 font-medium">Roll:</span>
                          <input
                            type="text"
                            className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-xs font-mono font-bold text-center text-slate-800 focus-visible:ring-1 focus-visible:ring-sais-red"
                            value={config.rollNumber}
                            onChange={(e) => setStudentRollNumber(st.studentKey, e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!sourceClassId || sourceClassStudents.length === 0}
            className="rounded-lg bg-sais-red px-5 py-2 text-xs font-semibold text-white hover:bg-sais-red-dark shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Confirm Promotion & Shuffling
          </button>
        </div>
      </form>
    </Modal>
  );
}
