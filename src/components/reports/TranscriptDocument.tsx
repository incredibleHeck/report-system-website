import type { TranscriptDocumentModel } from '../../lib/transcript';
import { termHeading } from '../../lib/transcript';

type Props = {
  model: TranscriptDocumentModel;
  schoolName?: string;
};

const SAIS_DEFAULTS = {
  name: 'St. Adelaide International Schools',
  address: 'P. O. Box DS 75, Dansoman – Accra',
  website: 'www.saintadelaideschools.org',
  email: 'info@saintadelaideschools.org, st.adelaideschools@gmail.com',
  tel: '020 798 8167 / 027 064 0112 / 024 597 0186',
};

export default function TranscriptDocument({ model, schoolName }: Props) {
  const { student, blocks } = model;
  const name = schoolName || SAIS_DEFAULTS.name;

  return (
    <article className="transcript-doc bg-sais-white text-sais-black mx-auto max-w-[210mm] px-6 py-6 print:px-0 print:py-0">
      <header className="border-b-2 border-sais-red pb-4 mb-6">
        <div className="flex items-start gap-4">
          <img
            src="/sais-logo.png"
            alt="St. Adelaide International Schools"
            className="h-24 w-auto object-contain flex-shrink-0"
          />
          <div className="min-w-0 flex-1 pt-1">
            <h1 className="text-xl sm:text-2xl font-bold font-display text-sais-black leading-tight">
              {name}
            </h1>
            <div className="mt-1.5 text-xs sm:text-sm text-sais-black leading-snug space-y-0.5">
              <p>{SAIS_DEFAULTS.address}</p>
              <p>
                website:{' '}
                <span className="text-sais-red underline">{SAIS_DEFAULTS.website}</span>
              </p>
              <p>
                email: <span className="text-sais-red">{SAIS_DEFAULTS.email}</span>
              </p>
              <p>Tel: {SAIS_DEFAULTS.tel}</p>
            </div>
          </div>
        </div>
        <h2 className="mt-4 text-center text-lg font-semibold font-display text-sais-brown tracking-wide">
          Official Student Transcript
        </h2>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4 border border-sais-brown/30 rounded-lg p-3 bg-sais-brown/5">
        <p>
          <span className="block text-xs uppercase tracking-wide text-sais-muted">Name</span>
          <span className="font-semibold text-sais-black">{student.name}</span>
        </p>
        <p>
          <span className="block text-xs uppercase tracking-wide text-sais-muted">Student Key</span>
          <span className="font-mono font-semibold text-sais-black">{student.studentKey}</span>
        </p>
        <p>
          <span className="block text-xs uppercase tracking-wide text-sais-muted">Year joined</span>
          <span className="font-semibold text-sais-black">{student.yearJoined}</span>
        </p>
        <p>
          <span className="block text-xs uppercase tracking-wide text-sais-muted">Status</span>
          <span className="font-semibold capitalize text-sais-black">{student.status}</span>
        </p>
      </section>

      {blocks.length === 0 ? (
        <p className="text-sm text-sais-muted">No enrolled terms on record.</p>
      ) : (
        <div className="space-y-6">
          {blocks.map((block) => (
            <section
              key={block.termKey + block.className}
              className="term-block border border-sais-brown/30 rounded-lg overflow-hidden print:border-sais-brown/50"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5 bg-sais-brown/10 border-b border-sais-brown/20">
                <h3 className="text-base font-semibold text-sais-black">
                  {termHeading(block.academicYear, block.termCode)}
                </h3>
                <p className="text-xs text-sais-muted">
                  {block.className} · {block.programme} · Roll {block.rollNumber}
                </p>
              </div>

              <div className="p-4">
                {block.kind === 'missing' ? (
                  <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                    Report not finalized for this enrolled term.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2 text-sm mb-3">
                      <p>
                        <span className="text-sais-muted">Average:</span>{' '}
                        <span className="font-semibold text-sais-black">
                          {block.averageScore ?? '—'} ({block.aveGrade ?? '—'})
                        </span>
                      </p>
                      <p>
                        <span className="text-sais-muted">Rank:</span>{' '}
                        <span className="font-semibold text-sais-black">
                          {block.rank ?? '—'}
                        </span>
                      </p>
                      <p>
                        <span className="text-sais-muted">Teacher:</span>{' '}
                        <span className="font-semibold text-sais-black">
                          {block.teacherName || '—'}
                        </span>
                      </p>
                    </div>
                    <table className="w-full text-sm border-collapse border border-sais-brown/30">
                      <thead>
                        <tr className="text-left bg-sais-black text-sais-white">
                          <th className="py-2 px-2 font-semibold">Subject</th>
                          <th className="py-2 px-2 w-20 font-semibold">Score</th>
                          <th className="py-2 px-2 w-16 font-semibold">Grade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {block.subjectLines.map((line) => (
                          <tr
                            key={line.code}
                            className="border-b border-sais-brown/20 last:border-b-0"
                          >
                            <td className="py-1.5 px-2 border-r border-sais-brown/15">
                              {line.name}
                            </td>
                            <td className="py-1.5 px-2 font-mono border-r border-sais-brown/15">
                              {line.totalScore}
                            </td>
                            <td className="py-1.5 px-2 font-semibold">{line.grade}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {block.generalComment ? (
                      <p className="mt-3 text-sm text-sais-black">
                        <span className="text-sais-muted">Comment:</span>{' '}
                        {block.generalComment}
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </article>
  );
}
