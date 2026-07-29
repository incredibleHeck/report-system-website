import { getScoredSubjects } from '../../lib/programmeSchemas';
import { shouldIncludeProjectWork } from '../../lib/term';
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
  const subjects = getScoredSubjects(
    classStream.programme,
    shouldIncludeProjectWork(classStream.settings.termYearInfo)
  );
  const scoreMap = Object.fromEntries(scores.map((s) => [s.subjectCode, s]));

  return (
    <div
      className="midterm-report bg-white text-black p-6"
      style={{
        width: '1100px',
        maxWidth: '1100px',
        fontFamily: 'Arial, Helvetica, sans-serif',
        boxSizing: 'border-box',
      }}
    >
      <div className="text-center border-b-2 border-black pb-3 mb-3">
        <h1 className="text-2xl font-bold uppercase">{school.name}</h1>
        <h2 className="text-lg font-bold mt-2 underline">Midterm Progress Report</h2>
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm mb-3">
        <div><strong>Name:</strong> {student.name}</div>
        <div><strong>ID:</strong> {student.studentId}</div>
        <div><strong>Class:</strong> {classStream.name}</div>
        <div><strong>Programme:</strong> {classStream.programme}</div>
        <div><strong>Breaks:</strong> {classStream.settings.schoolBreaks || '—'}</div>
        <div><strong>Resumes:</strong> {classStream.settings.schoolResumes || '—'}</div>
      </div>

      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-black px-2 py-1 text-left">Subject</th>
            <th className="border border-black px-2 py-1">Score (100)</th>
            <th className="border border-black px-2 py-1">Class Avg</th>
            <th className="border border-black px-2 py-1">Grade</th>
            <th className="border border-black px-2 py-1 text-left">Comment</th>
          </tr>
        </thead>
        <tbody>
          {subjects.map((sub) => {
            const sc = scoreMap[sub.code];
            return (
              <tr key={sub.code}>
                <td className="border border-black px-2 py-1">{sub.name}</td>
                <td className="border border-black px-2 py-1 text-center">{sc?.totalScore ?? ''}</td>
                <td className="border border-black px-2 py-1 text-center">
                  {classAverages[sub.code] ?? ''}
                </td>
                <td className="border border-black px-2 py-1 text-center">{sc?.grade ?? ''}</td>
                <td className="border border-black px-2 py-1">{sc?.comment ?? ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="text-xs mt-4">
        Class Teacher: {classStream.settings.teacherName || '—'}
      </p>
    </div>
  );
}
