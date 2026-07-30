import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useLocation } from 'react-router-dom';
import { useActiveClass, useDatabase, getStreamYearId, normalizeYearId } from '../../context/DatabaseContext';
import { buildSummaries, computeClassAverages, scoresForClass } from '../../lib/reportMath';
import { getSubjectsForTerm } from '../../lib/programmeSchemas';
import { downloadBlob, elementToPdfBase64 } from '../../lib/pdf';
import { yieldToBrowser } from '../../lib/asyncYield';
import { toCanonicalTermKey, parseAcademicYear } from '../../lib/academicYear';
import EotReportCard from '../../components/reports/EotReportCard';
import MidtermReportCard from '../../components/reports/MidtermReportCard';
import type { ReportMode, ReportSummary } from '../../types';

export default function ReportsPage() {
  const location = useLocation();
  const {
    activeClass,
    classStudents,
    selectedAcademicYearId,
    setSelectedAcademicYearId,
    setActiveClassId,
  } = useActiveClass();
  const {
    schools,
    students,
    scores,
    summaries,
    updateContactStatus,
    saveSummaries,
    classes,
    currentUser,
  } = useDatabase();

  const userClasses = useMemo(() => {
    const userId = currentUser?.id || (currentUser as any)?.uid;
    if (!userId) return classes || [];
    const isHT = currentUser?.role === 'headteacher';
    if (isHT) return classes || [];
    return (classes || []).filter(
      (c) =>
        c.teacherId === userId ||
        (c as any).formTeacherId === userId ||
        c.subjectTeachers?.some((st) => st.teacherId === userId)
    );
  }, [classes, currentUser]);

  const displayStreams = useMemo(() => {
    return userClasses.filter(
      (cs) => normalizeYearId(getStreamYearId(cs)) === normalizeYearId(selectedAcademicYearId)
    );
  }, [userClasses, selectedAcademicYearId]);

  const [mode, setMode] = useState<ReportMode>('EOT');
  const [selectedTermView, setSelectedTermView] = useState<'T1' | 'T2' | 'T3'>('T1');
  const [activeStudentIndex, setActiveStudentIndex] = useState(0);
  const [progress, setProgress] = useState('');
  const [busy, setBusy] = useState(false);
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [pendingLimit, setPendingLimit] = useState<number | undefined>(undefined);
  const previewRef = useRef<HTMLDivElement>(null);

  const school = schools.find((s) => s.id === activeClass?.schoolId) || schools[0];
  
  // Resolve active term key from the class's OWN year (not the global year selector).
  // This ensures archived classes (e.g. 2025-2026-YEAR-5A) generate the correct
  // term key '2025-2026-T1' instead of '2026-2027-T1'.
  const classOwnYear = useMemo(() => {
    if (!activeClass) return selectedAcademicYearId;
    const yr = parseAcademicYear(activeClass.settings.termYearInfo);
    return yr ? yr.replace('_', '-') : selectedAcademicYearId;
  }, [activeClass, selectedAcademicYearId]);

  const canonicalTermKey = useMemo(() => {
    return toCanonicalTermKey(classOwnYear, selectedTermView);
  }, [classOwnYear, selectedTermView]);

  const classScores = useMemo(() => {
    if (!activeClass) return [];
    return scoresForClass(scores, activeClass.id, mode, canonicalTermKey);
  }, [scores, activeClass, mode, canonicalTermKey]);

  const avgs = useMemo(() => {
    if (!activeClass) return {};
    return computeClassAverages(
      classScores,
      getSubjectsForTerm(activeClass.programme, canonicalTermKey).map((s) => s.code)
    );
  }, [classScores, activeClass, canonicalTermKey]);

  const reportRows = useMemo(() => {
    if (!activeClass) return [] as ReportSummary[];
    const built = buildSummaries({
      classStream: activeClass,
      students: classStudents,
      scores,
      mode,
      termKey: canonicalTermKey,
    });
    return built.map((b) => {
      const existing = summaries.find(
        (s) =>
          s.studentId === b.studentId &&
          s.classId === activeClass.id &&
          s.mode === mode &&
          s.termKey === canonicalTermKey
      );
      return {
        ...b,
        id: existing?.id || `tmp-${b.studentId}`,
        peComment: existing?.peComment || b.peComment,
        clubComment: existing?.clubComment || b.clubComment,
        generalComment: existing?.generalComment || b.generalComment,
        finalized: existing?.finalized || false,
        teacherName: existing?.teacherName || activeClass.settings.teacherName,
      } as ReportSummary;
    });
  }, [activeClass, classStudents, scores, mode, canonicalTermKey, summaries]);

  // Location state linkage for direct student navigation on mount
  useEffect(() => {
    if (location.state?.studentId && classStudents.length > 0) {
      const idx = classStudents.findIndex(
        (s) => s.id === location.state.studentId || (s as any).studentKey === location.state.studentId
      );
      if (idx >= 0) setActiveStudentIndex(idx);
    }
  }, [location.state?.studentId, classStudents]);

  // Reset active student index on scope changes
  useEffect(() => {
    setActiveStudentIndex(0);
  }, [activeClass?.id, selectedAcademicYearId, selectedTermView, mode]);

  // Keyboard shortcut listener for ArrowLeft and ArrowRight
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const tag = activeEl?.tagName || '';
      if (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) ||
        (activeEl as HTMLElement)?.isContentEditable
      ) {
        return;
      }
      if (e.key === 'ArrowLeft') {
        setActiveStudentIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowRight') {
        setActiveStudentIndex((prev) => Math.min(classStudents.length - 1, prev + 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [classStudents.length]);

  const auditIssues = useMemo(() => {
    if (!activeClass) return { missingComments: 0, missingScores: 0, missingAttendance: 0 };
    const termSubjects = getSubjectsForTerm(activeClass.programme, activeClass.settings.termYearInfo);
    let missingComments = 0;
    let missingScores = 0;
    let missingAttendance = 0;

    for (const st of classStudents) {
      if (!st.attendance || st.attendance === 0) missingAttendance++;
      const stSummary = reportRows.find((r) => r.studentId === st.id);
      if (mode === 'EOT' && (!stSummary?.generalComment || !stSummary.generalComment.trim())) {
        missingComments++;
      }
      const stScores = classScores.filter((s) => s.studentId === st.id);
      if (stScores.length < termSubjects.filter((s) => s.kind === 'scored').length) {
        missingScores++;
      }
    }
    return { missingComments, missingScores, missingAttendance };
  }, [activeClass, classStudents, reportRows, classScores, mode]);

  const currentStudent = classStudents[activeStudentIndex];
  const currentSummary = currentStudent ? reportRows.find((r) => r.studentId === currentStudent.id) : null;
  const currentStudentScores = currentStudent ? classScores.filter((s) => s.studentId === currentStudent.id) : [];

  const currentAudit = useMemo(() => {
    if (!currentStudent || !activeClass) return { isComplete: false, missingCount: 0 };
    const termSubjects = getSubjectsForTerm(activeClass.programme, activeClass.settings.termYearInfo).filter((s) => s.kind === 'scored');
    let missingCount = 0;
    if (currentStudentScores.length < termSubjects.length) {
      missingCount += (termSubjects.length - currentStudentScores.length);
    }
    if (mode === 'EOT' && (!currentSummary?.generalComment || !currentSummary.generalComment.trim())) {
      missingCount++;
    }
    return { isComplete: missingCount === 0, missingCount };
  }, [currentStudent, activeClass, currentStudentScores, currentSummary, mode]);

  if (!activeClass || !school) {
    return <p className="text-slate-500">No active class / school.</p>;
  }

  // Offscreen snapshot rendering with strict unscaled dimensions & guaranteed memory cleanup
  const renderOffscreen = async (studentId: string) => {
    const student = classStudents.find((s) => s.id === studentId)!;
    const summary = reportRows.find((r) => r.studentId === studentId)!;
    const studentScores = classScores.filter((s) => s.studentId === studentId);

    const host = document.createElement('div');
    host.style.position = 'fixed';
    host.style.left = '-10000px';
    host.style.top = '0';
    host.style.width = '1100px';
    host.style.transform = 'none';
    document.body.appendChild(host);
    const root = createRoot(host);

    try {
      await new Promise<void>((resolve) => {
        root.render(
          mode === 'EOT' ? (
            <EotReportCard
              school={school}
              classStream={activeClass}
              student={student}
              scores={studentScores}
              summary={summary}
              classAverages={avgs}
              rollCount={classStudents.length}
            />
          ) : (
            <MidtermReportCard
              school={school}
              classStream={activeClass}
              student={student}
              scores={studentScores}
              classAverages={avgs}
            />
          )
        );
        setTimeout(resolve, 250);
      });

      const el = host.querySelector('.eot-report, .midterm-report') as HTMLElement;
      const cleanStudentName = (student.name || 'Student').replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '_');
      const fileName = `${cleanStudentName}_${mode}_Report.pdf`;
      const pdf = await elementToPdfBase64(el, fileName);
      return { pdf, student, summary };
    } finally {
      try {
        root.unmount();
      } catch {}
      if (host.parentNode) {
        host.parentNode.removeChild(host);
      }
    }
  };

  const handleSingleExport = async () => {
    if (!currentStudent) return;
    setBusy(true);
    setProgress(`Generating PDF for ${currentStudent.name}...`);
    try {
      const { pdf } = await renderOffscreen(currentStudent.id);
      downloadBlob(pdf.blob, pdf.fileName);
    } catch (e) {
      console.error(e);
      alert(`Failed to export PDF: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  const handleStartBatch = (limit?: number) => {
    const totalIssues = auditIssues.missingComments + auditIssues.missingScores + auditIssues.missingAttendance;
    if (totalIssues > 0) {
      setPendingLimit(limit);
      setAuditModalOpen(true);
    } else {
      executeBatch(limit);
    }
  };

  const executeBatch = async (limit?: number) => {
    setAuditModalOpen(false);
    setBusy(true);
    const targets = classStudents.slice(0, limit ?? classStudents.length);
    for (let i = 0; i < targets.length; i++) {
      const st = targets[i];
      setProgress(`Generating PDF ${i + 1} of ${targets.length}: ${st.name}`);
      try {
        const { pdf, student } = await renderOffscreen(st.id);
        downloadBlob(pdf.blob, pdf.fileName);
        updateContactStatus(student.id, activeClass.id, {
          ...(mode === 'EOT'
            ? { pdfId: pdf.fileName, whatsappStatus: 'PDF_READY', emailStatus: 'PDF_READY' }
            : {
                midtermPdfId: pdf.fileName,
                whatsappStatus: 'MIDTERM_READY',
                emailStatus: 'MIDTERM_READY',
              }),
        });
      } catch (e) {
        console.error(e);
        updateContactStatus(st.id, activeClass.id, {
          emailStatus: `ERROR: ${e instanceof Error ? e.message : 'PDF fail'}`,
        });
      }
      await yieldToBrowser(100);
    }
    saveSummaries(reportRows.map(({ id: _id, ...rest }) => ({ ...rest, finalized: true })));
    setProgress('');
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      {/* Top Header Controls Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Student Reports & PDF Engine</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Official A4 Landscape Report Cards · Term: {selectedTermView} ({classOwnYear.replace('-', '/')}) · Class: <span className="font-semibold text-slate-800">{activeClass?.name || '—'}</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5 items-center">
          {/* Academic Year Selector */}
          <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Year:</span>
            <select
              className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
              value={selectedAcademicYearId}
              onChange={(e) => setSelectedAcademicYearId(e.target.value)}
              disabled={busy}
            >
              <option value="2026/2027">2026/2027 (Active Pointer)</option>
              <option value="2025/2026">2025/2026 (Archived)</option>
              <option value="2024/2025">2024/2025 (Archived)</option>
              <option value="2023/2024">2023/2024 (Archived)</option>
              <option value="2022/2023">2022/2023 (Archived)</option>
              <option value="2021/2022">2021/2022 (Archived)</option>
            </select>
          </div>

          {/* Active Class Selector */}
          <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Class:</span>
            <select
              className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer min-w-[120px]"
              value={activeClass?.id || ''}
              onChange={(e) => setActiveClassId(e.target.value)}
              disabled={busy}
            >
              {displayStreams.length === 0 ? (
                <option value="">No streams in {selectedAcademicYearId}</option>
              ) : (
                displayStreams.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.programme})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Term Selector */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs shadow-2xs">
            {(['T1', 'T2', 'T3'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setSelectedTermView(v)}
                disabled={busy}
                className={`px-2.5 py-1 font-bold rounded-md transition-all ${
                  selectedTermView === v
                    ? 'bg-red-800 text-white shadow-2xs'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                Term {v.slice(1)}
              </button>
            ))}
          </div>

          {/* Mode Selector */}
          <select
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-red-600 focus:outline-none shadow-2xs cursor-pointer"
            value={mode}
            onChange={(e) => setMode(e.target.value as ReportMode)}
            disabled={busy}
          >
            <option value="EOT">EOT Report Mode</option>
            <option value="MIDTERM">Midterm Report Mode</option>
          </select>

          <button
            disabled={busy || classStudents.length === 0}
            onClick={() => handleStartBatch(2)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-all"
          >
            Preview Batch (2)
          </button>
          <button
            disabled={busy || classStudents.length === 0}
            onClick={() => handleStartBatch()}
            className="rounded-lg bg-red-800 text-white px-4 py-1.5 text-xs font-bold hover:bg-red-900 disabled:opacity-50 transition-all shadow-2xs"
          >
            Generate Full Batch
          </button>
        </div>
      </div>

      {/* Visual Batch Progress Feedback Overlay */}
      {busy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4 max-w-sm w-full text-center border border-slate-700">
            <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Generating Batch Reports</h3>
              <p className="text-xs text-red-400 font-mono mt-1 font-semibold">{progress || 'Processing...'}</p>
            </div>
            <p className="text-[11px] text-slate-400">Please wait while PDFs are rendered and processed.</p>
          </div>
        </div>
      )}

      {/* Pre-Flight Audit Warnings Modal */}
      {auditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="text-amber-500">⚠️</span> Pre-Flight Data Warning
            </h2>
            <p className="text-sm text-slate-600">
              The report system detected incomplete data for some students in <strong>{activeClass.name}</strong>:
            </p>
            <ul className="text-xs space-y-1.5 bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-900">
              {auditIssues.missingScores > 0 && (
                <li>• <strong>{auditIssues.missingScores}</strong> student(s) have un-recorded subject marks.</li>
              )}
              {auditIssues.missingComments > 0 && (
                <li>• <strong>{auditIssues.missingComments}</strong> student(s) are missing general teacher comments.</li>
              )}
              {auditIssues.missingAttendance > 0 && (
                <li>• <strong>{auditIssues.missingAttendance}</strong> student(s) have un-recorded attendance.</li>
              )}
            </ul>
            <p className="text-xs text-slate-500">
              Generating report cards now will include empty fields for incomplete items.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setAuditModalOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel & Review Data
              </button>
              <button
                onClick={() => executeBatch(pendingLimit)}
                className="rounded-lg bg-red-800 text-white px-4 py-2 text-sm font-medium hover:opacity-90"
              >
                Proceed Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Interactive Student Carousel Navigation Control Bar */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <button
            disabled={busy || activeStudentIndex <= 0 || classStudents.length === 0}
            onClick={(e) => {
              setActiveStudentIndex((prev) => Math.max(0, prev - 1));
              (e.target as HTMLElement).blur();
            }}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-all"
          >
            ◀ Previous Student
          </button>
          <button
            disabled={busy || activeStudentIndex >= classStudents.length - 1 || classStudents.length === 0}
            onClick={(e) => {
              setActiveStudentIndex((prev) => Math.min(classStudents.length - 1, prev + 1));
              (e.target as HTMLElement).blur();
            }}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-all"
          >
            Next Student ▶
          </button>

          <select
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-red-600 focus:outline-none"
            value={activeStudentIndex}
            onChange={(e) => {
              setActiveStudentIndex(Number(e.target.value));
              (e.target as HTMLElement).blur();
            }}
            disabled={busy || classStudents.length === 0}
          >
            {classStudents.map((st, idx) => (
              <option key={st.id} value={idx}>
                {st.name} ({idx + 1}/{classStudents.length})
              </option>
            ))}
          </select>

          <span className="text-xs font-mono font-semibold text-slate-600 px-2 py-1 bg-slate-100 rounded-md">
            {classStudents.length > 0 ? `Student ${activeStudentIndex + 1} of ${classStudents.length}` : 'No Students'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Live Completion Audit Badge */}
          {currentStudent && (
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border ${
                currentAudit.isComplete
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-amber-50 text-amber-900 border-amber-300'
              }`}
            >
              <span>{currentAudit.isComplete ? '🟢' : '⚠️'}</span>
              <span>
                {currentAudit.isComplete
                  ? 'Complete & Ready'
                  : `Missing ${currentAudit.missingCount} Entry/Remark${currentAudit.missingCount > 1 ? 's' : ''}`}
              </span>
            </span>
          )}

          <button
            disabled={busy || !currentStudent}
            onClick={(e) => {
              handleSingleExport();
              (e.target as HTMLElement).blur();
            }}
            className="rounded-lg bg-red-800 text-white px-3.5 py-1.5 text-xs font-bold hover:bg-red-900 disabled:opacity-50 transition-all flex items-center gap-1.5 shadow-2xs"
          >
            <span>📄 Download Current Student PDF</span>
          </button>
        </div>
      </div>

      {/* Main Report Preview Canvas / Empty State */}
      {classStudents.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500 font-medium">
          No students enrolled in this class stream for the selected academic year.
        </div>
      ) : currentStudent && currentSummary ? (
        <div className="overflow-x-auto border border-slate-200 rounded-xl bg-slate-100 p-4 scrollbar-thin scrollbar-thumb-slate-300">
          <div ref={previewRef} className="inline-block shadow-sm">
            {mode === 'EOT' ? (
              <EotReportCard
                school={school}
                classStream={activeClass}
                student={currentStudent}
                scores={currentStudentScores}
                summary={currentSummary}
                classAverages={avgs}
                rollCount={classStudents.length}
              />
            ) : (
              <MidtermReportCard
                school={school}
                classStream={activeClass}
                student={currentStudent}
                scores={currentStudentScores}
                classAverages={avgs}
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
