import { useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useActiveClass, useDatabase, termKeyFromSettings } from '../../context/DatabaseContext';
import { buildSummaries, computeClassAverages, scoresForClass } from '../../lib/reportMath';
import { getSubjectsForTerm } from '../../lib/programmeSchemas';
import { downloadBlob, elementToPdfBase64 } from '../../lib/pdf';
import EotReportCard from '../../components/reports/EotReportCard';
import MidtermReportCard from '../../components/reports/MidtermReportCard';
import type { ReportMode, ReportSummary } from '../../types';

export default function ReportsPage() {
  const { activeClass, classStudents } = useActiveClass();
  const { schools, students, scores, summaries, updateContactStatus, saveSummaries } =
    useDatabase();
  const [mode, setMode] = useState<ReportMode>('EOT');
  const [progress, setProgress] = useState('');
  const [busy, setBusy] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const school = schools.find((s) => s.id === activeClass?.schoolId) || schools[0];
  const termKey = activeClass ? termKeyFromSettings(activeClass.settings) : '';
  const classScores = useMemo(() => {
    if (!activeClass) return [];
    return scoresForClass(scores, activeClass.id, mode, termKey);
  }, [scores, activeClass, mode, termKey]);

  const avgs = useMemo(() => {
    if (!activeClass) return {};
    return computeClassAverages(
      classScores,
      getSubjectsForTerm(activeClass.programme, activeClass.settings.termYearInfo).map((s) => s.code)
    );
  }, [classScores, activeClass]);

  const reportRows = useMemo(() => {
    if (!activeClass) return [] as ReportSummary[];
    const built = buildSummaries({
      classStream: activeClass,
      students: classStudents,
      scores,
      mode,
      termKey,
    });
    return built.map((b) => {
      const existing = summaries.find(
        (s) =>
          s.studentId === b.studentId &&
          s.classId === activeClass.id &&
          s.mode === mode &&
          s.termKey === termKey
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
  }, [activeClass, classStudents, scores, mode, termKey, summaries]);

  if (!activeClass || !school) {
    return <p className="text-slate-500">No active class / school.</p>;
  }

  const renderOffscreen = async (studentId: string) => {
    const student = classStudents.find((s) => s.id === studentId)!;
    const summary = reportRows.find((r) => r.studentId === studentId)!;
    const studentScores = classScores.filter((s) => s.studentId === studentId);

    const host = document.createElement('div');
    host.style.position = 'fixed';
    host.style.left = '-10000px';
    host.style.top = '0';
    document.body.appendChild(host);
    const root = createRoot(host);

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
      // Allow logo/images to paint before capture
      setTimeout(resolve, 250);
    });

    const el = host.querySelector('.eot-report, .midterm-report') as HTMLElement;
    const fileName = `${student.studentId}_${mode}_Report.pdf`;
    const pdf = await elementToPdfBase64(el, fileName);
    root.unmount();
    document.body.removeChild(host);
    return { pdf, student, summary };
  };

  const runBatch = async (limit?: number) => {
    setBusy(true);
    const targets = classStudents.slice(0, limit ?? classStudents.length);
    for (let i = 0; i < targets.length; i++) {
      const st = targets[i];
      setProgress(`Generating ${i + 1}/${targets.length}: ${st.name}`);
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
    }
    // Ensure summaries exist for cards
    saveSummaries(reportRows.map(({ id: _id, ...rest }) => ({ ...rest, finalized: true })));
    setProgress('Done');
    setBusy(false);
  };

  const previewStudent = classStudents[0];
  const previewSummary = previewStudent
    ? reportRows.find((r) => r.studentId === previewStudent.id)
    : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reports / PDF</h1>
          <p className="text-sm text-slate-500">
            A4 landscape PDFs (max 2 pages). Project Work row appears only in Term 3.
          </p>
        </div>
        <div className="flex gap-2">
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={mode}
            onChange={(e) => setMode(e.target.value as ReportMode)}
            disabled={busy}
          >
            <option value="EOT">EOT</option>
            <option value="MIDTERM">Midterm</option>
          </select>
          <button
            disabled={busy || classStudents.length === 0}
            onClick={() => runBatch(2)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
          >
            Preview Batch (2)
          </button>
          <button
            disabled={busy || classStudents.length === 0}
            onClick={() => runBatch()}
            className="rounded-lg bg-sais-red text-white px-4 py-2 text-sm disabled:opacity-50"
          >
            Generate Full Batch
          </button>
        </div>
      </div>

      {progress && (
        <div className="rounded-lg bg-slate-900 text-sais-brown-light px-4 py-2 text-sm font-mono">
          {progress}
        </div>
      )}

      {previewStudent && previewSummary && (
        <div className="overflow-auto border border-slate-200 rounded-xl bg-slate-100 p-4">
          <div ref={previewRef} className="inline-block shadow-sm">
            {mode === 'EOT' ? (
              <EotReportCard
                school={school}
                classStream={activeClass}
                student={previewStudent}
                scores={classScores.filter((s) => s.studentId === previewStudent.id)}
                summary={previewSummary}
                classAverages={avgs}
                rollCount={classStudents.length}
              />
            ) : (
              <MidtermReportCard
                school={school}
                classStream={activeClass}
                student={previewStudent}
                scores={classScores.filter((s) => s.studentId === previewStudent.id)}
                classAverages={avgs}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
