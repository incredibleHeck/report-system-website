import { getScoredSubjects } from '../../lib/programmeSchemas';
import { shouldIncludeProjectWork, formatDateLong } from '../../lib/term';
import type {
  AssessmentScore,
  ClassStream,
  School,
  Student,
} from '../../types';

export type MidtermReportCardProps = {
  school: School;
  classStream: ClassStream;
  student: Student;
  scores: AssessmentScore[];
  classAverages: Record<string, number>;
};

export default function MidtermReportCard({
  school,
  classStream,
  student,
  scores,
  classAverages,
}: MidtermReportCardProps) {
  const effectiveTermInfo = scores[0]?.termKey || classStream.settings.termYearInfo;
  const subjects = getScoredSubjects(
    classStream.programme,
    shouldIncludeProjectWork(effectiveTermInfo)
  );
  const scoreMap = Object.fromEntries(scores.map((s) => [s.subjectCode, s]));

  return (
    <div
      className="midterm-report bg-white text-black p-6"
      style={{
        width: '1100px',
        maxWidth: '1100px',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '13px',
        boxSizing: 'border-box',
      }}
    >
      <div className="text-center border-b-2 border-black pb-3 mb-3">
        <h1 className="text-2xl font-bold uppercase">{school.name}</h1>
        <h2 className="text-lg font-bold mt-2 underline">Midterm Progress Report</h2>
      </div>

      <div
        className="grid grid-cols-3 gap-2 text-sm mb-3 avoid-break"
        style={{
          borderTop: '3px solid #c41e3a',
          borderBottom: '3px solid #c41e3a',
          padding: '6px 4px',
        }}
      >
        <div><strong>Name:</strong> {student.name}</div>
        <div><strong>ID:</strong> {student.studentId}</div>
        <div><strong>Class:</strong> {classStream.name}</div>
        <div><strong>Programme:</strong> {classStream.programme}</div>
        <div><strong>Breaks:</strong> {formatDateLong(classStream.settings.schoolBreaks)}</div>
        <div><strong>Resumes:</strong> {formatDateLong(classStream.settings.schoolResumes)}</div>
      </div>

      <table className="w-full border-collapse" style={{ fontSize: '13px' }}>
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-black text-left font-bold" style={{ verticalAlign: 'middle', padding: '8px', fontSize: '13px' }}>
              Subject
            </th>
            <th className="border border-black text-center font-bold" style={{ verticalAlign: 'middle', padding: '8px', fontSize: '13px' }}>
              Score (100)
            </th>
            <th className="border border-black text-center font-bold" style={{ verticalAlign: 'middle', padding: '8px', fontSize: '13px' }}>
              Class Avg
            </th>
            <th className="border border-black text-center font-bold" style={{ verticalAlign: 'middle', padding: '8px', fontSize: '13px' }}>
              Grade
            </th>
            <th className="border border-black text-left font-bold" style={{ verticalAlign: 'middle', padding: '8px', fontSize: '13px' }}>
              Comment
            </th>
          </tr>
        </thead>
        <tbody>
          {subjects.map((sub) => {
            const sc = scoreMap[sub.code];
            return (
              <tr key={sub.code}>
                <td className="border border-black font-bold" style={{ verticalAlign: 'middle', padding: 0 }}>
                  <div style={{ padding: '8px', fontSize: '13px', textAlign: 'left' }}>
                    {sub.name}
                  </div>
                </td>
                <td className="border border-black text-center" style={{ verticalAlign: 'middle', padding: 0 }}>
                  <div style={{ padding: '8px', fontSize: '13px' }}>
                    {sc?.totalScore ?? ''}
                  </div>
                </td>
                <td className="border border-black text-center" style={{ verticalAlign: 'middle', padding: 0 }}>
                  <div style={{ padding: '8px', fontSize: '13px' }}>
                    {classAverages[sub.code] ?? ''}
                  </div>
                </td>
                <td className="border border-black text-center font-bold" style={{ verticalAlign: 'middle', padding: 0 }}>
                  <div style={{ padding: '8px', fontSize: '13.5px' }}>
                    {sc?.grade ?? ''}
                  </div>
                </td>
                <td className="border border-black text-left" style={{ verticalAlign: 'middle', padding: 0 }}>
                  <div style={{ padding: '8px 10px', fontSize: '12.5px', lineHeight: 1.45 }}>
                    {(sc?.comment ?? '').trim().split('\n').map((line, i, arr) => (
                      <span key={i}>
                        {line}
                        {i < arr.length - 1 && <br />}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="text-sm mt-4">
        <strong>Class Teacher:</strong> {classStream.settings.teacherName || '—'}
      </p>
    </div>
  );
}
