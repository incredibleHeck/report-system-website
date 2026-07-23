import { GRADING_LEGEND } from '../../lib/grading';
import {
  getReportOutOf,
  getSubjectsForTerm,
  PROGRAMME_SCHEMAS,
} from '../../lib/programmeSchemas';
import { parseYearTerm, shouldIncludeProjectWork } from '../../lib/term';
import type {
  AssessmentScore,
  ClassStream,
  ReportSummary,
  School,
  Student,
} from '../../types';

export type EotReportCardProps = {
  school: School;
  classStream: ClassStream;
  student: Student;
  scores: AssessmentScore[];
  summary: ReportSummary;
  classAverages: Record<string, number>;
  /** Class roll size (Sheets "No. on Roll") */
  rollCount?: number;
};

const SAIS_DEFAULTS = {
  name: 'St. Adelaide International Schools',
  address: 'P. O. Box DS 75, Dansoman – Accra',
  website: 'www.saintadelaideschools.org',
  email: 'info@saintadelaideschools.org, st.adelaideschools@gmail.com',
  tel: '020 798 8167 / 027 064 0112 / 024 597 0186',
};

function fmt(n: number | undefined | null) {
  if (n === undefined || n === null || Number.isNaN(n)) return '';
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

const cell = 'border border-black px-1 py-0.5 align-middle';
const cellCenter = `${cell} text-center`;
const inactive = `${cellCenter} bg-[#8a8a8a]`;

export default function EotReportCard({
  school,
  classStream,
  student,
  scores,
  summary,
  classAverages,
  rollCount,
}: EotReportCardProps) {
  const termInfo = classStream.settings.termYearInfo;
  const includeProject = shouldIncludeProjectWork(termInfo);
  const subjects = getSubjectsForTerm(classStream.programme, termInfo).filter(
    (s) => !(s.code === 'MUSIC' && !PROGRAMME_SCHEMAS[classStream.programme].hasMusic)
  );

  const scoreMap = Object.fromEntries(scores.map((s) => [s.subjectCode, s]));
  const outOf = getReportOutOf(classStream.programme);
  const { year, term, termNumber } = parseYearTerm(termInfo);
  const teacherName = summary.teacherName || classStream.settings.teacherName || '—';

  const name = school.name || SAIS_DEFAULTS.name;
  const address = school.address || SAIS_DEFAULTS.address;
  const website = school.website || SAIS_DEFAULTS.website;
  const email = school.email || SAIS_DEFAULTS.email;
  const tel = school.tel || SAIS_DEFAULTS.tel;
  const onRoll = rollCount ?? (Number(student.index) || student.index);

  // A4 landscape target width (~297mm at 96dpi). Compact so most reports fit 1 page, max 2.
  return (
    <div
      className="eot-report bg-white text-black"
      data-term={termNumber ?? ''}
      data-project-work={includeProject ? '1' : '0'}
      style={{
        width: '1100px',
        maxWidth: '1100px',
        padding: '10px 14px 8px',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '10px',
        color: '#000',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div className="flex items-start gap-2 mb-1">
        <img
          src="/sais-logo.png"
          alt="St. Adelaide International Schools"
          width={78}
          height={78}
          style={{ width: 78, height: 78, objectFit: 'contain', flexShrink: 0 }}
        />
        <div className="flex-1 min-w-0 pt-0.5">
          <h1
            style={{
              fontSize: '22px',
              fontWeight: 800,
              lineHeight: 1.1,
              margin: 0,
            }}
          >
            {name}
          </h1>
          <div style={{ marginTop: 2, fontSize: '11px', lineHeight: 1.3 }}>
            <div>{address}</div>
            <div>
              website:{' '}
              <span style={{ color: '#0563c1', textDecoration: 'underline' }}>{website}</span>
            </div>
            <div>
              email: <span style={{ color: '#0563c1' }}>{email}</span>
            </div>
            <div>Tel: {tel}</div>
          </div>
        </div>
        <div
          style={{
            background: '#c41e3a',
            color: '#fff',
            fontWeight: 800,
            fontSize: '13px',
            padding: '8px 12px',
            alignSelf: 'center',
            textAlign: 'center',
            lineHeight: 1.2,
            minWidth: 118,
            flexShrink: 0,
          }}
        >
          End Of
          <br />
          Term Report
        </div>
      </div>

      {/* Student info */}
      <div
        style={{
          borderTop: '2.5px solid #000',
          borderBottom: '1.5px solid #000',
          padding: '4px 2px',
          marginBottom: 4,
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <tbody>
            <tr>
              <td style={{ width: '34%', padding: '1px 4px' }}>
                <strong>Student Name:</strong> {student.name}
              </td>
              <td style={{ width: '33%', padding: '1px 4px' }}>
                <strong>Student ID:</strong> {student.studentId}
              </td>
              <td style={{ width: '33%', padding: '1px 4px' }}>
                <strong>No. on Roll:</strong> {onRoll}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '1px 4px' }}>
                <strong>Class:</strong> {classStream.name}
              </td>
              <td style={{ padding: '1px 4px' }}>
                <strong>Attendance:</strong> {student.attendance} /{' '}
                {classStream.settings.attendanceTotal}
              </td>
              <td style={{ padding: '1px 4px' }}>
                <strong>Year:</strong> {year} <strong>Term:</strong> {term}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '1px 4px' }}>
                <strong>Programme:</strong> {classStream.programme}
              </td>
              <td style={{ padding: '1px 4px' }}>
                <strong>Vacation Date:</strong>{' '}
                {(classStream.settings.reportDate || '—').toUpperCase()}
              </td>
              <td style={{ padding: '1px 4px' }}>
                <strong>Next Term Begins:</strong>{' '}
                {(classStream.settings.nextTermBegins || '—').toUpperCase()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Marks table */}
      <table
        className="w-full border-collapse"
        style={{ fontSize: '9.5px', marginBottom: 4, tableLayout: 'fixed' }}
      >
        <colgroup>
          <col style={{ width: '11%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '2%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '5%' }} />
          <col style={{ width: '44%' }} />
        </colgroup>
        <thead>
          <tr style={{ background: '#5a5a5a', color: '#fff' }}>
            <th className={`${cell} text-left font-bold`} style={{ color: '#fff' }}>
              Subject
            </th>
            <th className={`${cellCenter} font-bold`} style={{ color: '#fff', fontSize: '8px' }}>
              Class Score (20)
            </th>
            <th className={`${cellCenter} font-bold`} style={{ color: '#fff', fontSize: '8px' }}>
              Mid Term Score (20)
            </th>
            <th className={cell} style={{ background: '#5a5a5a' }} />
            <th className={`${cellCenter} font-bold`} style={{ color: '#fff', fontSize: '8px' }}>
              End of Term Exams Score (60)
            </th>
            <th className={`${cellCenter} font-bold`} style={{ color: '#fff', fontSize: '8px' }}>
              Total Score (100)
            </th>
            <th className={`${cellCenter} font-bold`} style={{ color: '#fff' }}>
              Class Average
            </th>
            <th className={`${cellCenter} font-bold`} style={{ color: '#fff' }}>
              Grade
            </th>
            <th className={`${cell} text-center font-bold`} style={{ color: '#fff' }}>
              Subject Teacher&apos;s Comment
            </th>
          </tr>
        </thead>
        <tbody>
          {subjects.map((sub) => {
            const sc = scoreMap[sub.code];
            const comment =
              sub.code === 'PE'
                ? summary.peComment || sc?.comment || ''
                : sub.code === 'CLUB'
                  ? summary.clubComment || sc?.comment || ''
                  : sc?.comment || '';

            if (sub.kind === 'commentOnly') {
              return (
                <tr key={sub.code}>
                  <td className={`${cell} font-bold`}>{sub.name}</td>
                  <td className={inactive} />
                  <td className={inactive} />
                  <td className={inactive} />
                  <td className={inactive} />
                  <td className={inactive} />
                  <td className={inactive} />
                  <td className={inactive} />
                  <td className={`${cell} text-left align-top`} style={{ lineHeight: 1.25 }}>
                    {comment}
                  </td>
                </tr>
              );
            }

            if (sub.kind === 'scoreOnly') {
              return (
                <tr key={sub.code}>
                  <td className={`${cell} font-bold`}>{sub.name}</td>
                  <td className={inactive} />
                  <td className={inactive} />
                  <td className={inactive} />
                  <td className={inactive} />
                  <td className={cellCenter}>{fmt(sc?.totalScore)}</td>
                  <td className={cellCenter}>
                    {fmt(classAverages[sub.code] ?? sc?.classAverage)}
                  </td>
                  <td className={`${cellCenter} font-bold`}>{sc?.grade ?? ''}</td>
                  <td className={`${cell} text-left align-top`} style={{ lineHeight: 1.25 }}>
                    {comment}
                  </td>
                </tr>
              );
            }

            return (
              <tr key={sub.code}>
                <td className={`${cell} font-bold`}>{sub.name}</td>
                <td className={cellCenter}>{fmt(sc?.cwScore)}</td>
                <td className={cellCenter}>{fmt(sc?.mtScore)}</td>
                <td className={cell} />
                <td className={cellCenter}>{fmt(sc?.eotScore)}</td>
                <td className={cellCenter}>{fmt(sc?.totalScore)}</td>
                <td className={cellCenter}>
                  {fmt(classAverages[sub.code] ?? sc?.classAverage)}
                </td>
                <td className={`${cellCenter} font-bold`}>{sc?.grade ?? ''}</td>
                <td className={`${cell} text-left align-top`} style={{ lineHeight: 1.25 }}>
                  {comment}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ borderTop: '2px solid #c41e3a', margin: '2px 0 4px' }} />

      {/* Footer */}
      <div className="flex gap-1.5 items-stretch" style={{ minHeight: 132 }}>
        <div style={{ width: '27%' }}>
          <div
            style={{
              background: '#6b6b6b',
              color: '#fff',
              fontWeight: 700,
              textAlign: 'center',
              padding: '2px 4px',
              border: '1px solid #000',
              borderBottom: 'none',
              fontSize: '10px',
            }}
          >
            GRADING SYSTEM
          </div>
          <table className="w-full border-collapse" style={{ fontSize: '9px' }}>
            <tbody>
              {GRADING_LEGEND.map((g) => (
                <tr key={g.grade}>
                  <td className={cell} style={{ whiteSpace: 'nowrap', padding: '1px 4px' }}>
                    {g.range} : <strong>{g.grade}</strong> : ({g.label})
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ width: '49%', display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              background: '#6b6b6b',
              color: '#fff',
              fontWeight: 700,
              textAlign: 'center',
              padding: '2px 4px',
              border: '1px solid #000',
              borderBottom: 'none',
              fontSize: '10px',
            }}
          >
            PERFORMANCE ANALYSIS
          </div>
          <table className="w-full border-collapse" style={{ fontSize: '10px' }}>
            <tbody>
              <tr>
                <td className={cell}>
                  Raw Score: <strong>{fmt(summary.rawScore)}</strong>
                </td>
                <td className={cell}>
                  Out of: <strong>{outOf}</strong>
                </td>
                <td className={cell}>
                  Average Mark: <strong>{fmt(summary.averageScore)}</strong>
                </td>
              </tr>
              <tr>
                <td className={cell}>
                  Average Grade: <strong>{summary.aveGrade}</strong>
                </td>
                <td className={cell}>
                  Best Grade: <strong>{summary.bestGrade}</strong>
                </td>
                <td className={cell}>
                  Worst Grade: <strong>{summary.leastGrade}</strong>
                </td>
              </tr>
            </tbody>
          </table>

          <div
            style={{
              background: '#6b6b6b',
              color: '#fff',
              fontWeight: 700,
              textAlign: 'center',
              padding: '2px 4px',
              border: '1px solid #000',
              borderBottom: 'none',
              borderTop: 'none',
              fontSize: '10px',
              marginTop: 3,
            }}
          >
            CLASS TEACHER&apos;S COMMENT
          </div>
          <div
            className="border border-black flex-1"
            style={{
              padding: '4px 6px',
              fontSize: '10px',
              lineHeight: 1.3,
              minHeight: 56,
            }}
          >
            {summary.generalComment}
          </div>
        </div>

        <div style={{ width: '24%', display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              background: '#6b6b6b',
              color: '#fff',
              fontWeight: 700,
              textAlign: 'center',
              padding: '2px 4px',
              border: '1px solid #000',
              borderBottom: 'none',
              fontSize: '10px',
            }}
          >
            SIGNATURE
          </div>
          <div
            className="border border-black flex-1 flex flex-col items-center justify-center"
            style={{ padding: '8px 6px', minHeight: 110 }}
          >
            <div
              style={{
                fontSize: '16px',
                fontWeight: 700,
                textAlign: 'center',
                letterSpacing: '0.02em',
              }}
            >
              {teacherName.toUpperCase()}
            </div>
            <div style={{ marginTop: 8, fontSize: '9px', color: '#333' }}>Class Teacher</div>
          </div>
        </div>
      </div>

      <div style={{ borderTop: '2px solid #c41e3a', marginTop: 6 }} />
    </div>
  );
}
