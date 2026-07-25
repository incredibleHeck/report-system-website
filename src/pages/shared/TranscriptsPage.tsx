import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useDatabase } from '../../context/DatabaseContext';
import TranscriptDocument from '../../components/reports/TranscriptDocument';
import {
  assertTranscriptAccess,
  buildTranscript,
  searchStudentsByName,
  type TranscriptDocumentModel,
  type TranscriptSearchHit,
} from '../../lib/transcript';

type Props = {
  /** When set, ignore search/URL and build from this key only (student portal). */
  sessionStudentKey?: string;
};

export default function TranscriptsPage({ sessionStudentKey }: Props) {
  const { currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const urlKey = searchParams.get('studentKey');

  const { lifelongStudents, enrollments, summaries, schools } = useDatabase();
  const source = useMemo(
    () => ({ lifelongStudents, enrollments, summaries }),
    [lifelongStudents, enrollments, summaries]
  );

  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<TranscriptSearchHit[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(sessionStudentKey ?? urlKey ?? null);
  const [model, setModel] = useState<TranscriptDocumentModel | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const schoolName = schools[0]?.name;

  useEffect(() => {
    const targetKey = sessionStudentKey || urlKey;
    if (!targetKey) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      const doc = await buildTranscript(targetKey, source);
      if (cancelled) return;
      if (!doc) {
        setError('No transcript found for specified student key.');
        setModel(null);
      } else {
        setModel(doc);
        setSelectedKey(targetKey);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionStudentKey, urlKey, source]);

  const runSearch = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!currentUser || sessionStudentKey) return;
    setError('');
    setLoading(true);
    const results = await searchStudentsByName(query, source, {
      role: currentUser.role,
      userId: currentUser.id,
      schoolId: currentUser.schoolId,
    });
    setHits(results);
    setLoading(false);
    if (results.length === 0) setError('No matching students in your access scope.');
  };

  const openTranscript = async (studentKey: string) => {
    if (!currentUser) return;
    setError('');
    setLoading(true);
    if (!sessionStudentKey) {
      const allowed = await assertTranscriptAccess(studentKey, source, {
        role: currentUser.role,
        userId: currentUser.id,
        schoolId: currentUser.schoolId,
      });
      if (!allowed) {
        setError('You do not have access to this student transcript.');
        setLoading(false);
        return;
      }
    }
    const doc = await buildTranscript(studentKey, source);
    setSelectedKey(studentKey);
    setModel(doc);
    if (!doc) setError('Transcript could not be built.');
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 no-print">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {sessionStudentKey ? 'My Transcript' : 'Student Transcripts'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {sessionStudentKey
              ? 'Compiled from your enrolled terms across academic years.'
              : 'Search by name, confirm the lifelong key, then print.'}
          </p>
        </div>
        {model && (
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg bg-sais-red text-sais-white px-4 py-2 text-sm hover:bg-sais-red-dark"
          >
            Print transcript
          </button>
        )}
      </div>

      {!sessionStudentKey && (
        <form
          onSubmit={runSearch}
          className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-wrap gap-3 no-print"
        >
          <input
            className="flex-1 min-w-[220px] rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-sais-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:border-sais-red transition-all shadow-xs"
            placeholder="Search name or SAIS-YYYY-NNNN"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            type="submit"
            className="rounded-lg bg-sais-red text-white font-semibold px-5 py-2.5 text-sm hover:bg-sais-red-dark active:scale-[0.98] transition-all shadow-xs disabled:opacity-50"
            disabled={loading}
          >
            Search
          </button>
        </form>
      )}

      {error && (
        <p className="text-sm text-rose-600 no-print">{error}</p>
      )}

      {!sessionStudentKey && hits.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden no-print">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Student Key</th>
                <th className="px-4 py-2">Class</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {hits.map((h) => (
                <tr key={h.studentKey} className="border-b border-slate-100">
                  <td className="px-4 py-2 font-medium">{h.name}</td>
                  <td className="px-4 py-2 font-mono text-xs">{h.studentKey}</td>
                  <td className="px-4 py-2 text-slate-500">{h.recentClassName || '—'}</td>
                  <td className="px-4 py-2 capitalize">{h.status}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      className="text-sais-red text-xs font-semibold"
                      onClick={() => openTranscript(h.studentKey)}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {model && (
        <>
          <div className="rounded-lg border border-sais-brown/30 bg-sais-brown-soft px-4 py-3 text-sm text-sais-ink no-print PrintInstructions">
            For a clean PDF: Print Settings → More settings → Margins <strong>None</strong> →
            Uncheck <strong>Headers and footers</strong>.
          </div>
          {selectedKey && (
            <p className="text-xs text-slate-500 no-print font-mono">{selectedKey}</p>
          )}
          <TranscriptDocument model={model} schoolName={schoolName} />
        </>
      )}

      {loading && !model && (
        <p className="text-sm text-slate-500 no-print">Loading…</p>
      )}
    </div>
  );
}
