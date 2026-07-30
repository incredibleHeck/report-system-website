import { GRADING_LEGEND } from '../../lib/grading';
import {
  getReportOutOf,
  getSubjectsForTerm,
  PROGRAMME_SCHEMAS,
} from '../../lib/programmeSchemas';
import { parseYearTerm, shouldIncludeProjectWork, formatDateLong, formatSignatureName } from '../../lib/term';
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

const THEME_RED = '#c41e3a';

function fmt(n: number | undefined | null) {
  if (n === undefined || n === null || Number.isNaN(n)) return '';
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

export default function EotReportCard({
  school,
  classStream,
  student,
  scores,
  summary,
  classAverages,
  rollCount,
}: EotReportCardProps) {
  const effectiveTermInfo = summary?.termKey || scores[0]?.termKey || classStream.settings.termYearInfo;
  const includeProject = shouldIncludeProjectWork(effectiveTermInfo);
  const subjects = getSubjectsForTerm(classStream.programme, effectiveTermInfo).filter(
    (s) => !(s.code === 'MUSIC' && !PROGRAMME_SCHEMAS[classStream.programme].hasMusic)
  );

  const scoreMap = Object.fromEntries(scores.map((s) => [s.subjectCode, s]));
  const outOf = getReportOutOf(classStream.programme);
  const { year, term, termNumber } = parseYearTerm(effectiveTermInfo);
  const teacherName = summary.teacherName || classStream.settings.teacherName || '—';

  const name = school.name || SAIS_DEFAULTS.name;
  const address = school.address || SAIS_DEFAULTS.address;
  const website = school.website || SAIS_DEFAULTS.website;
  const email = school.email || SAIS_DEFAULTS.email;
  const tel = school.tel || SAIS_DEFAULTS.tel;
  const onRoll = rollCount ?? (Number(student.index) || student.index);

  return (
    <div
      className="eot-report bg-white text-black"
      data-term={termNumber ?? ''}
      data-project-work={includeProject ? '1' : '0'}
      style={{
        width: '1100px',
        maxWidth: '1100px',
        padding: '16px 20px 14px',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '13px',
        color: '#000',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div className="flex items-start gap-4 mb-3">
        <img
          src="/sais-logo.png"
          alt="St. Adelaide International Schools"
          width={84}
          height={84}
          style={{ width: 84, height: 84, objectFit: 'contain', flexShrink: 0 }}
        />
        <div className="flex-1 min-w-0 pt-0.5">
          <h1
            style={{
              fontSize: '24px',
              fontWeight: 800,
              lineHeight: 1.15,
              margin: 0,
            }}
          >
            {name}
          </h1>
          <div style={{ marginTop: 3, fontSize: '12px', lineHeight: 1.4 }}>
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
            background: THEME_RED,
            color: '#fff',
            fontWeight: 800,
            fontSize: '14px',
            padding: '10px 14px',
            alignSelf: 'center',
            textAlign: 'center',
            lineHeight: 1.25,
            minWidth: 128,
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
        className="avoid-break"
        style={{
          borderTop: `3px solid ${THEME_RED}`,
          borderBottom: `3px solid ${THEME_RED}`,
          padding: '6px 4px',
          marginBottom: 8,
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
          <tbody>
            <tr>
              <td style={{ width: '34%', padding: '4px 4px', verticalAlign: 'middle' }}>
                <strong>Student Name:</strong> {student.name}
              </td>
              <td style={{ width: '33%', padding: '4px 4px', verticalAlign: 'middle' }}>
                <strong>Student ID:</strong> {student.studentId}
              </td>
              <td style={{ width: '33%', padding: '4px 4px', verticalAlign: 'middle' }}>
                <strong>No. on Roll:</strong> {onRoll}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '4px 4px', verticalAlign: 'middle' }}>
                <strong>Class:</strong> {classStream.name}
              </td>
              <td style={{ padding: '4px 4px', verticalAlign: 'middle' }}>
                <strong>Attendance:</strong> {student.attendance} /{' '}
                {classStream.settings.attendanceTotal}
              </td>
              <td style={{ padding: '4px 4px', verticalAlign: 'middle' }}>
                <strong>Year:</strong> {year} <strong>Term:</strong> {term}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '4px 4px', verticalAlign: 'middle' }}>
                <strong>Programme:</strong> {classStream.programme}
              </td>
              <td style={{ padding: '4px 4px', verticalAlign: 'middle' }}>
                <strong>Vacation Date:</strong>{' '}
                {formatDateLong(classStream.settings.reportDate)}
              </td>
              <td style={{ padding: '4px 4px', verticalAlign: 'middle' }}>
                <strong>Next Term Begins:</strong>{' '}
                {formatDateLong(classStream.settings.nextTermBegins)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Marks table */}
      <table
        className="w-full border-collapse"
        style={{ fontSize: '13px', marginBottom: 8, tableLayout: 'fixed' }}
      >
        <colgroup>
          <col style={{ width: '12%' }} />
          <col style={{ width: '5.5%' }} />
          <col style={{ width: '5.5%' }} />
          <col style={{ width: '6.5%' }} />
          <col style={{ width: '5.5%' }} />
          <col style={{ width: '5.5%' }} />
          <col style={{ width: '4.5%' }} />
          <col style={{ width: '55%' }} />
        </colgroup>
        <thead>
          <tr style={{ background: '#6b6b6b', color: '#ffffff' }}>
            <th className="border border-black font-bold" style={{ verticalAlign: 'middle', padding: 0 }}>
              <div style={{ padding: '10px 8px', fontSize: '13px', lineHeight: '18px', textAlign: 'left', color: '#ffffff' }}>
                Subject
              </div>
            </th>
            <th className="border border-black text-center font-bold" style={{ verticalAlign: 'middle', padding: 0 }}>
              <div style={{ padding: '10px 3px', fontSize: '11px', lineHeight: '14px', color: '#ffffff' }}>
                Class Score (20)
              </div>
            </th>
            <th className="border border-black text-center font-bold" style={{ verticalAlign: 'middle', padding: 0 }}>
              <div style={{ padding: '10px 3px', fontSize: '11px', lineHeight: '14px', color: '#ffffff' }}>
                Mid Term Score (20)
              </div>
            </th>
            <th className="border border-black text-center font-bold" style={{ verticalAlign: 'middle', padding: 0 }}>
              <div style={{ padding: '10px 3px', fontSize: '11px', lineHeight: '14px', color: '#ffffff' }}>
                End of Term Exams Score (60)
              </div>
            </th>
            <th className="border border-black text-center font-bold" style={{ verticalAlign: 'middle', padding: 0 }}>
              <div style={{ padding: '10px 3px', fontSize: '11px', lineHeight: '14px', color: '#ffffff' }}>
                Total Score (100)
              </div>
            </th>
            <th className="border border-black text-center font-bold" style={{ verticalAlign: 'middle', padding: 0 }}>
              <div style={{ padding: '10px 3px', fontSize: '11px', lineHeight: '14px', color: '#ffffff' }}>
                Class Average
              </div>
            </th>
            <th className="border border-black text-center font-bold" style={{ verticalAlign: 'middle', padding: 0 }}>
              <div style={{ padding: '10px 3px', fontSize: '12px', lineHeight: '16px', color: '#ffffff' }}>
                Grade
              </div>
            </th>
            <th className="border border-black text-center font-bold" style={{ verticalAlign: 'middle', padding: 0 }}>
              <div style={{ padding: '10px 8px', fontSize: '13px', lineHeight: '18px', color: '#ffffff' }}>
                Subject Teacher&apos;s Comment
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {subjects.map((sub) => {
            const sc = scoreMap[sub.code];
            const rawComment = (
              sub.code === 'PE'
                ? summary.peComment || sc?.comment || ''
                : sub.code === 'CLUB'
                  ? summary.clubComment || sc?.comment || ''
                  : sc?.comment || ''
            ).trim();

            const commentNodes = rawComment.split('\n').map((line, i, arr) => (
              <span key={i}>
                {line}
                {i < arr.length - 1 && <br />}
              </span>
            ));

            if (sub.kind === 'commentOnly') {
              return (
                <tr key={sub.code}>
                  <td className="border border-black font-bold" style={{ verticalAlign: 'middle', padding: 0 }}>
                    <div style={{ padding: '8px', fontSize: '13px', lineHeight: '18px', textAlign: 'left' }}>
                      {sub.name}
                    </div>
                  </td>
                  <td className="border border-black bg-[#8a8a8a]" style={{ verticalAlign: 'middle', padding: 0 }} />
                  <td className="border border-black bg-[#8a8a8a]" style={{ verticalAlign: 'middle', padding: 0 }} />
                  <td className="border border-black bg-[#8a8a8a]" style={{ verticalAlign: 'middle', padding: 0 }} />
                  <td className="border border-black bg-[#8a8a8a]" style={{ verticalAlign: 'middle', padding: 0 }} />
                  <td className="border border-black bg-[#8a8a8a]" style={{ verticalAlign: 'middle', padding: 0 }} />
                  <td className="border border-black bg-[#8a8a8a]" style={{ verticalAlign: 'middle', padding: 0 }} />
                  <td className="border border-black text-left" style={{ verticalAlign: 'middle', padding: 0 }}>
                    <div
                      style={{
                        padding: '2px 8px 3px 8px',
                        fontSize: '11.5px',
                        lineHeight: '15px',
                        maxHeight: '38px',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {commentNodes}
                    </div>
                  </td>
                </tr>
              );
            }

            if (sub.kind === 'scoreOnly') {
              return (
                <tr key={sub.code}>
                  <td className="border border-black font-bold" style={{ verticalAlign: 'middle', padding: 0 }}>
                    <div style={{ padding: '8px', fontSize: '13px', lineHeight: '18px', textAlign: 'left' }}>
                      {sub.name}
                    </div>
                  </td>
                  <td className="border border-black bg-[#8a8a8a]" style={{ verticalAlign: 'middle', padding: 0 }} />
                  <td className="border border-black bg-[#8a8a8a]" style={{ verticalAlign: 'middle', padding: 0 }} />
                  <td className="border border-black bg-[#8a8a8a]" style={{ verticalAlign: 'middle', padding: 0 }} />
                  <td className="border border-black text-center" style={{ verticalAlign: 'middle', padding: 0 }}>
                    <div style={{ padding: '8px 4px', fontSize: '13px', lineHeight: '18px' }}>
                      {fmt(sc?.totalScore)}
                    </div>
                  </td>
                  <td className="border border-black text-center" style={{ verticalAlign: 'middle', padding: 0 }}>
                    <div style={{ padding: '8px 4px', fontSize: '13px', lineHeight: '18px' }}>
                      {fmt(classAverages[sub.code] ?? sc?.classAverage)}
                    </div>
                  </td>
                  <td className="border border-black text-center font-bold" style={{ verticalAlign: 'middle', padding: 0 }}>
                    <div style={{ padding: '8px 4px', fontSize: '13.5px', lineHeight: '18px' }}>
                      {sc?.grade ?? ''}
                    </div>
                  </td>
                  <td className="border border-black text-left" style={{ verticalAlign: 'middle', padding: 0 }}>
                    <div
                      style={{
                        padding: '2px 8px 3px 8px',
                        fontSize: '11.5px',
                        lineHeight: '15px',
                        maxHeight: '38px',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {commentNodes}
                    </div>
                  </td>
                </tr>
              );
            }

            return (
              <tr key={sub.code}>
                <td className="border border-black font-bold" style={{ verticalAlign: 'middle', padding: 0 }}>
                  <div style={{ padding: '8px', fontSize: '13px', lineHeight: '18px', textAlign: 'left' }}>
                    {sub.name}
                  </div>
                </td>
                <td className="border border-black text-center" style={{ verticalAlign: 'middle', padding: 0 }}>
                  <div style={{ padding: '8px 4px', fontSize: '13px', lineHeight: '18px' }}>
                    {fmt(sc?.cwScore)}
                  </div>
                </td>
                <td className="border border-black text-center" style={{ verticalAlign: 'middle', padding: 0 }}>
                  <div style={{ padding: '8px 4px', fontSize: '13px', lineHeight: '18px' }}>
                    {fmt(sc?.mtScore)}
                  </div>
                </td>
                <td className="border border-black text-center" style={{ verticalAlign: 'middle', padding: 0 }}>
                  <div style={{ padding: '8px 4px', fontSize: '13px', lineHeight: '18px' }}>
                    {fmt(sc?.eotScore)}
                  </div>
                </td>
                <td className="border border-black text-center" style={{ verticalAlign: 'middle', padding: 0 }}>
                  <div style={{ padding: '8px 4px', fontSize: '13px', lineHeight: '18px' }}>
                    {fmt(sc?.totalScore)}
                  </div>
                </td>
                <td className="border border-black text-center" style={{ verticalAlign: 'middle', padding: 0 }}>
                  <div style={{ padding: '8px 4px', fontSize: '13px', lineHeight: '18px' }}>
                    {fmt(classAverages[sub.code] ?? sc?.classAverage)}
                  </div>
                </td>
                <td className="border border-black text-center font-bold" style={{ verticalAlign: 'middle', padding: 0 }}>
                  <div style={{ padding: '8px 4px', fontSize: '13.5px', lineHeight: '18px' }}>
                    {sc?.grade ?? ''}
                  </div>
                </td>
                <td className="border border-black text-left" style={{ verticalAlign: 'middle', padding: 0 }}>
                  <div
                    style={{
                      padding: '2px 8px 3px 8px',
                      fontSize: '11.5px',
                      lineHeight: '15px',
                      maxHeight: '38px',
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {commentNodes}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ borderTop: `3px solid ${THEME_RED}`, margin: '6px 0 8px' }} />

      {/* Footer */}
      <div className="flex gap-2 items-stretch avoid-break" style={{ minHeight: 140 }}>
        <div style={{ width: '26.5%' }}>
          <div
            style={{
              background: '#6b6b6b',
              color: '#fff',
              fontWeight: 700,
              textAlign: 'center',
              padding: '4px 6px',
              border: '1px solid #000',
              borderBottom: 'none',
              fontSize: '11.5px',
            }}
          >
            GRADING SYSTEM
          </div>
          <table className="w-full border-collapse" style={{ fontSize: '11.5px' }}>
            <tbody>
              {GRADING_LEGEND.map((g) => (
                <tr key={g.grade}>
                  <td className="border border-black" style={{ verticalAlign: 'middle', padding: '4px 6px', fontSize: '11.5px', lineHeight: 1.35, whiteSpace: 'nowrap' }}>
                    {g.range} : <strong>{g.grade}</strong> : ({g.label})
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ width: '57.5%', display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              background: '#6b6b6b',
              color: '#fff',
              fontWeight: 700,
              textAlign: 'center',
              padding: '4px 6px',
              border: '1px solid #000',
              borderBottom: 'none',
              fontSize: '11.5px',
            }}
          >
            PERFORMANCE ANALYSIS
          </div>
          <table className="w-full border-collapse" style={{ fontSize: '13px' }}>
            <tbody>
              <tr>
                <td className="border border-black" style={{ verticalAlign: 'middle', padding: '7px 8px', fontSize: '13px', lineHeight: 1.35 }}>
                  Raw Score: <strong>{fmt(summary.rawScore)}</strong>
                </td>
                <td className="border border-black" style={{ verticalAlign: 'middle', padding: '7px 8px', fontSize: '13px', lineHeight: 1.35 }}>
                  Out of: <strong>{outOf}</strong>
                </td>
                <td className="border border-black" style={{ verticalAlign: 'middle', padding: '7px 8px', fontSize: '13px', lineHeight: 1.35 }}>
                  Average Mark: <strong>{fmt(summary.averageScore)}</strong>
                </td>
              </tr>
              <tr>
                <td className="border border-black" style={{ verticalAlign: 'middle', padding: '7px 8px', fontSize: '13px', lineHeight: 1.35 }}>
                  Average Grade: <strong>{summary.aveGrade}</strong>
                </td>
                <td className="border border-black" style={{ verticalAlign: 'middle', padding: '7px 8px', fontSize: '13px', lineHeight: 1.35 }}>
                  Best Grade: <strong>{summary.bestGrade}</strong>
                </td>
                <td className="border border-black" style={{ verticalAlign: 'middle', padding: '7px 8px', fontSize: '13px', lineHeight: 1.35 }}>
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
              padding: '3px 6px',
              border: '1px solid #000',
              borderBottom: 'none',
              borderTop: 'none',
              fontSize: '11px',
              marginTop: 3,
            }}
          >
            CLASS TEACHER&apos;S COMMENT
          </div>
          <div
            className="border border-black flex-1"
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              lineHeight: 1.35,
              maxHeight: '75px',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              boxSizing: 'border-box',
            }}
          >
            {summary.generalComment}
          </div>
        </div>

        <div style={{ width: '16%', display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              background: '#6b6b6b',
              color: '#fff',
              fontWeight: 700,
              textAlign: 'center',
              padding: '3px 4px',
              border: '1px solid #000',
              borderBottom: 'none',
              fontSize: '10.5px',
            }}
          >
            FORM TEACHER
          </div>
          <div
            className="border border-black flex-1 flex flex-col items-center justify-center text-center"
            style={{ padding: '4px 2px', minHeight: 70 }}
          >
            <div
              style={{
                fontSize: '12px',
                fontWeight: 700,
                textAlign: 'center',
                letterSpacing: '0.01em',
                lineHeight: 1.25,
              }}
            >
              {formatSignatureName(teacherName).map((part, idx) => (
                <div key={idx}>{part.toUpperCase()}</div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ borderTop: `3px solid ${THEME_RED}`, marginTop: 8 }} />
    </div>
  );
}
