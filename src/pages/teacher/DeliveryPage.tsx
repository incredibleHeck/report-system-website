import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import JSZip from 'jszip';
import { useActiveClass, useDatabase, termKeyFromSettings } from '../../context/DatabaseContext';
import { buildSummaries, computeClassAverages, scoresForClass } from '../../lib/reportMath';
import { getSubjectsForTerm } from '../../lib/programmeSchemas';
import { elementToPdfBase64, downloadBlob } from '../../lib/pdf';
import { normalizeGhanaPhone } from '../../lib/phone';
import { sendEmailPdf, sendWhatsAppPdf } from '../../lib/ai/geminiClient';
import { yieldToBrowser } from '../../lib/asyncYield';
import EotReportCard from '../../components/reports/EotReportCard';
import MidtermReportCard from '../../components/reports/MidtermReportCard';
import type { ReportMode } from '../../types';

type ProgressState = {
  phase: 'zip' | 'email' | 'whatsapp' | null;
  current: number;
  total: number;
  label: string;
};

export default function DeliveryPage() {
  const { activeClass, classStudents } = useActiveClass();
  const { schools, scores, summaries, contacts, updateContactStatus } = useDatabase();
  const [mode, setMode] = useState<ReportMode>('EOT');
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SENT' | 'FAILED' | 'PENDING'>('ALL');
  const [progress, setProgress] = useState<ProgressState>({
    phase: null,
    current: 0,
    total: 0,
    label: '',
  });

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

  const filteredStudents = useMemo(() => {
    return classStudents.filter((st) => {
      const matchSearch =
        st.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        st.studentId.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchSearch) return false;

      if (statusFilter === 'ALL') return true;
      const c = contacts.find((x) => x.studentId === st.id && x.classId === activeClass?.id);
      const waOk = c?.whatsappStatus === 'SENT';
      const emOk = c?.emailStatus === 'SENT' || c?.emailStatus?.startsWith('SENT');
      const isSent = waOk || emOk;
      const isFailed =
        (c?.whatsappStatus && !waOk && c.whatsappStatus !== 'PDF_READY' && c.whatsappStatus !== 'MIDTERM_READY') ||
        (c?.emailStatus && !emOk && c.emailStatus !== 'PDF_READY' && c.emailStatus !== 'MIDTERM_READY');

      if (statusFilter === 'SENT') return isSent;
      if (statusFilter === 'FAILED') return isFailed;
      if (statusFilter === 'PENDING') return !isSent && !isFailed;
      return true;
    });
  }, [classStudents, searchQuery, statusFilter, contacts, activeClass]);

  if (!activeClass || !school) return <p className="text-slate-500">No active class.</p>;

  const pushLog = (line: string) => setLog((prev) => [line, ...prev].slice(0, 60));

  const makePdf = async (studentId: string) => {
    const student = classStudents.find((s) => s.id === studentId)!;
    const summaryBase = buildSummaries({
      classStream: activeClass,
      students: [student],
      scores,
      mode,
      termKey,
    })[0];
    const existing = summaries.find(
      (s) =>
        s.studentId === studentId &&
        s.classId === activeClass.id &&
        s.mode === mode &&
        s.termKey === termKey
    );
    const summary = {
      ...summaryBase,
      id: existing?.id || 'tmp',
      peComment: existing?.peComment || '',
      clubComment: existing?.clubComment || '',
      generalComment: existing?.generalComment || '',
      teacherName: existing?.teacherName || activeClass.settings.teacherName,
      finalized: true,
    };

    const host = document.createElement('div');
    host.style.position = 'fixed';
    host.style.left = '-10000px';
    document.body.appendChild(host);
    const root = createRoot(host);
    await new Promise<void>((resolve) => {
      root.render(
        mode === 'EOT' ? (
          <EotReportCard
            school={school}
            classStream={activeClass}
            student={student}
            scores={classScores.filter((s) => s.studentId === studentId)}
            summary={summary}
            classAverages={avgs}
            rollCount={classStudents.length}
          />
        ) : (
          <MidtermReportCard
            school={school}
            classStream={activeClass}
            student={student}
            scores={classScores.filter((s) => s.studentId === studentId)}
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
    root.unmount();
    document.body.removeChild(host);
    return { pdf, student };
  };

  const downloadClassZip = async () => {
    if (!classStudents.length) return;
    setBusy(true);
    setProgress({
      phase: 'zip',
      current: 0,
      total: classStudents.length,
      label: 'Building class ZIP…',
    });
    const zip = new JSZip();
    const folder = zip.folder(`${activeClass.name.replace(/[^\w\-]+/g, '_')}_${mode}`) || zip;

    try {
      for (let i = 0; i < classStudents.length; i++) {
        const st = classStudents[i];
        setProgress({
          phase: 'zip',
          current: i + 1,
          total: classStudents.length,
          label: `${i + 1} / ${classStudents.length} generated — ${st.name}`,
        });
        try {
          const { pdf, student } = await makePdf(st.id);
          folder.file(pdf.fileName, pdf.blob);
          updateContactStatus(st.id, activeClass.id, {
            pdfId: pdf.fileName,
            ...(mode === 'EOT'
              ? { whatsappStatus: 'PDF_READY', emailStatus: 'PDF_READY' }
              : { whatsappStatus: 'MIDTERM_READY', emailStatus: 'MIDTERM_READY' }),
          });
          pushLog(`${student.name}: added to ZIP`);
        } catch (e) {
          pushLog(`${st.name}: PDF failed — ${e instanceof Error ? e.message : 'error'}`);
        }
        // Yield so GC can reclaim canvas memory before next student
        await yieldToBrowser(100);
      }

      setProgress({
        phase: 'zip',
        current: classStudents.length,
        total: classStudents.length,
        label: 'Compressing ZIP…',
      });
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      const safeClass = activeClass.name.replace(/[^\w\-]+/g, '_');
      downloadBlob(blob, `${safeClass}_${mode}_Reports.zip`);
      pushLog(`ZIP ready: ${classStudents.length} PDFs`);
    } finally {
      setBusy(false);
      setProgress({ phase: null, current: 0, total: 0, label: '' });
    }
  };

  const sendEmailBatch = async (targets?: typeof classStudents) => {
    const list = targets || classStudents;
    if (!list.length) return;
    setBusy(true);
    setProgress({
      phase: 'email',
      current: 0,
      total: list.length,
      label: `Sending email batch (${list.length})…`,
    });
    try {
      for (let i = 0; i < list.length; i++) {
        const st = list[i];
        setProgress({
          phase: 'email',
          current: i + 1,
          total: list.length,
          label: `${i + 1} / ${list.length} — ${st.name}`,
        });
        const contact = contacts.find((c) => c.studentId === st.id && c.classId === activeClass.id);
        if (!contact?.email) {
          updateContactStatus(st.id, activeClass.id, { emailStatus: 'INVALID FORMAT' });
          pushLog(`${st.name}: no email`);
          await yieldToBrowser(50);
          continue;
        }
        try {
          const { pdf, student } = await makePdf(st.id);
          const res = await sendEmailPdf({
            to: contact.email,
            studentName: student.name,
            subject: `${activeClass.name} Report Card — ${student.name}`,
            pdfBase64: pdf.base64,
            fileName: pdf.fileName,
          });
          if (res.fallback) {
            downloadBlob(pdf.blob, pdf.fileName);
          }
          updateContactStatus(st.id, activeClass.id, {
            emailStatus: res.status || (res.ok ? 'SENT' : 'FAIL'),
            pdfId: pdf.fileName,
          });
          pushLog(`${st.name}: ${res.status}`);
        } catch (e) {
          updateContactStatus(st.id, activeClass.id, {
            emailStatus: e instanceof Error ? e.message : 'FAIL',
          });
          pushLog(`${st.name}: email error`);
        }
        await yieldToBrowser(100);
      }
    } finally {
      setBusy(false);
      setProgress({ phase: null, current: 0, total: 0, label: '' });
    }
  };

  const sendWhatsAppBatch = async (targets?: typeof classStudents) => {
    const list = targets || classStudents;
    if (!list.length) return;
    setBusy(true);
    setProgress({
      phase: 'whatsapp',
      current: 0,
      total: list.length,
      label: `Sending WhatsApp batch (${list.length})…`,
    });
    try {
      for (let i = 0; i < list.length; i++) {
        const st = list[i];
        setProgress({
          phase: 'whatsapp',
          current: i + 1,
          total: list.length,
          label: `${i + 1} / ${list.length} — ${st.name}`,
        });
        const contact = contacts.find((c) => c.studentId === st.id && c.classId === activeClass.id);
        const phone = contact?.phone ? normalizeGhanaPhone(contact.phone) : null;
        if (!phone?.ok) {
          updateContactStatus(st.id, activeClass.id, { whatsappStatus: 'INVALID FORMAT' });
          pushLog(`${st.name}: invalid phone`);
          await yieldToBrowser(50);
          continue;
        }
        try {
          const { pdf, student } = await makePdf(st.id);
          const res = await sendWhatsAppPdf({
            phone: phone.e164,
            studentName: student.name,
            pdfBase64: pdf.base64,
            fileName: pdf.fileName,
          });
          if (res.fallback) {
            downloadBlob(pdf.blob, pdf.fileName);
            pushLog(`${st.name}: WA not configured — PDF downloaded`);
          }
          updateContactStatus(st.id, activeClass.id, {
            whatsappStatus: res.status || (res.ok ? 'SENT' : 'FAIL'),
            pdfId: pdf.fileName,
          });
          pushLog(`${st.name}: ${res.status}`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'FAIL';
          updateContactStatus(st.id, activeClass.id, { whatsappStatus: msg });
          pushLog(`${st.name}: WhatsApp error — ${msg}`);
        }
        await yieldToBrowser(120);
      }
    } finally {
      setBusy(false);
      setProgress({ phase: null, current: 0, total: 0, label: '' });
    }
  };

  const retryFailedDispatches = (channel: 'email' | 'whatsapp') => {
    const failedTargets = classStudents.filter((st) => {
      const c = contacts.find((x) => x.studentId === st.id && x.classId === activeClass.id);
      if (channel === 'email') {
        return !c?.emailStatus || c.emailStatus !== 'SENT' && !c.emailStatus.startsWith('SENT');
      } else {
        return !c?.whatsappStatus || c.whatsappStatus !== 'SENT';
      }
    });
    if (!failedTargets.length) {
      alert(`No failed ${channel} dispatches found to retry!`);
      return;
    }
    if (channel === 'email') sendEmailBatch(failedTargets);
    else sendWhatsAppBatch(failedTargets);
  };

  const pct =
    progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display">Delivery</h1>
          <p className="text-sm text-slate-500">
            Build a class ZIP for bulk handoff, or send Email / WhatsApp. PDFs yield between students
            so the tab stays responsive.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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
            onClick={downloadClassZip}
            className="rounded-lg bg-sais-ink text-white px-4 py-2 text-sm disabled:opacity-50"
          >
            Download Class ZIP
          </button>
          <button
            disabled={busy}
            onClick={() => sendEmailBatch()}
            className="rounded-lg bg-sais-brown text-white px-3 py-2 text-sm disabled:opacity-50"
          >
            Send Email Batch
          </button>
          <button
            disabled={busy}
            onClick={() => sendWhatsAppBatch()}
            className="rounded-lg bg-sais-red text-white px-3 py-2 text-sm disabled:opacity-50"
          >
            Send WhatsApp Batch
          </button>
          <button
            disabled={busy}
            onClick={() => retryFailedDispatches('email')}
            className="rounded-lg border border-amber-600 bg-amber-50 text-amber-900 px-3 py-2 text-sm font-medium disabled:opacity-50 hover:bg-amber-100"
          >
            ↺ Retry Failed Emails
          </button>
          <button
            disabled={busy}
            onClick={() => retryFailedDispatches('whatsapp')}
            className="rounded-lg border border-rose-600 bg-rose-50 text-rose-900 px-3 py-2 text-sm font-medium disabled:opacity-50 hover:bg-rose-100"
          >
            ↺ Retry Failed WhatsApp
          </button>
        </div>
      </div>

      {progress.phase && (
        <div className="rounded-xl border border-sais-brown/30 bg-white p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium text-sais-ink">{progress.label}</span>
            <span className="text-sais-muted tabular-nums">{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-sais-cream overflow-hidden">
            <div
              className="h-full bg-sais-red transition-all duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Filter and Search controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 border border-slate-200 rounded-xl">
        <input
          type="text"
          placeholder="Search student by name or ID…"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm min-w-[240px]"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium text-slate-600">Filter Status:</span>
          <select
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs bg-slate-50"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="ALL">All ({classStudents.length})</option>
            <option value="SENT">Sent</option>
            <option value="FAILED">Failed / Issues</option>
            <option value="PENDING">Pending / Ready</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl">
        <table className="min-w-full text-sm">
          <thead className="bg-sais-cream">
            <tr>
              <th className="px-3 py-2 text-left">Student</th>
              <th className="px-3 py-2 text-left">Phone</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2">WA Status</th>
              <th className="px-3 py-2">Email Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.map((st) => {
              const c = contacts.find((x) => x.studentId === st.id && x.classId === activeClass.id);
              const waOk = c?.whatsappStatus === 'SENT';
              const emOk = c?.emailStatus === 'SENT' || c?.emailStatus?.startsWith('SENT');
              return (
                <tr key={st.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium">{st.name}</td>
                  <td className="px-3 py-2 font-mono text-xs">{c?.phone || '—'}</td>
                  <td className="px-3 py-2 text-xs">{c?.email || '—'}</td>
                  <td
                    className={`px-3 py-2 text-center text-xs max-w-[220px] truncate ${
                      waOk
                        ? 'bg-sais-brown-soft text-sais-ink'
                        : c?.whatsappStatus
                          ? 'bg-rose-50 text-rose-800'
                          : ''
                    }`}
                    title={c?.whatsappStatus || ''}
                  >
                    {c?.whatsappStatus || '—'}
                  </td>
                  <td
                    className={`px-3 py-2 text-center text-xs max-w-[220px] truncate ${
                      emOk
                        ? 'bg-sais-brown-soft text-sais-ink'
                        : c?.emailStatus
                          ? 'bg-rose-50 text-rose-800'
                          : ''
                    }`}
                    title={c?.emailStatus || ''}
                  >
                    {c?.emailStatus || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {log.length > 0 && (
        <div className="rounded-xl bg-sais-black text-slate-200 p-4 font-mono text-xs space-y-1 max-h-48 overflow-y-auto">
          {log.map((l, i) => (
            <div key={`${l}-${i}`}>{l}</div>
          ))}
        </div>
      )}
    </div>
  );
}
