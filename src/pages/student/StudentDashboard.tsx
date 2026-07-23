import { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDatabase, termKeyFromSettings } from '../../context/DatabaseContext';
import { scoresForClass, computeClassAverages } from '../../lib/reportMath';
import { getSubjectsForTerm } from '../../lib/programmeSchemas';
import EotReportCard from '../../components/reports/EotReportCard';
import MidtermReportCard from '../../components/reports/MidtermReportCard';

export default function StudentDashboard() {
  const { currentUser } = useAuth();
  const { students, classes, schools, scores, summaries } = useDatabase();

  const student =
    (currentUser?.studentKey
      ? students
          .filter((s) => s.studentKey === currentUser.studentKey)
          .sort((a, b) => (b.academicYear || '').localeCompare(a.academicYear || ''))[0]
      : undefined) ||
    students.find((s) => s.id === currentUser?.id || s.id === currentUser?.linkedStudentId) ||
    students.find((s) => s.name === currentUser?.name);

  const classStream = classes.find((c) => c.id === student?.classId);
  const school = schools.find((s) => s.id === student?.schoolId) || schools[0];

  const termKey = classStream ? termKeyFromSettings(classStream.settings) : '';

  const eotSummary = summaries.find(
    (s) =>
      s.studentId === student?.id &&
      s.classId === classStream?.id &&
      s.mode === 'EOT' &&
      s.termKey === termKey
  );

  const midSummary = summaries.find(
    (s) =>
      s.studentId === student?.id &&
      s.classId === classStream?.id &&
      s.mode === 'MIDTERM' &&
      s.termKey === termKey
  );

  const eotScores = useMemo(() => {
    if (!classStream || !student) return [];
    return scoresForClass(scores, classStream.id, 'EOT', termKey).filter(
      (s) => s.studentId === student.id
    );
  }, [scores, classStream, student, termKey]);

  const midScores = useMemo(() => {
    if (!classStream || !student) return [];
    return scoresForClass(scores, classStream.id, 'MIDTERM', termKey).filter(
      (s) => s.studentId === student.id
    );
  }, [scores, classStream, student, termKey]);

  const eotAvgs = useMemo(() => {
    if (!classStream) return {};
    return computeClassAverages(
      scoresForClass(scores, classStream.id, 'EOT', termKey),
      getSubjectsForTerm(classStream.programme, classStream.settings.termYearInfo).map((s) => s.code)
    );
  }, [scores, classStream, termKey]);

  const midAvgs = useMemo(() => {
    if (!classStream) return {};
    return computeClassAverages(
      scoresForClass(scores, classStream.id, 'MIDTERM', termKey),
      getSubjectsForTerm(classStream.programme, classStream.settings.termYearInfo).map((s) => s.code)
    );
  }, [scores, classStream, termKey]);

  if (!student || !classStream || !school) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
        <h1 className="text-xl font-bold">No student record</h1>
        <p className="text-sm text-slate-500 mt-2">
          Load demo data and open the student portal again.
        </p>
      </div>
    );
  }

  const fallbackSummary = {
    id: 'tmp',
    studentId: student.id,
    classId: classStream.id,
    mode: 'EOT' as const,
    termKey,
    academicYear: student.academicYear || '2025_2026',
    rawScore: eotScores.reduce((a, b) => a + b.totalScore, 0),
    averageScore:
      eotScores.length > 0
        ? Math.round(
            (eotScores.reduce((a, b) => a + b.totalScore, 0) / eotScores.length) * 100
          ) / 100
        : 0,
    aveGrade: '—',
    bestMark: 0,
    bestGrade: '—',
    leastMark: 0,
    leastGrade: '—',
    rank: 0,
    peComment: '',
    clubComment: '',
    generalComment: 'Report not yet finalized by class teacher.',
    teacherName: classStream.settings.teacherName,
    className: classStream.name,
    programme: classStream.programme,
    finalized: false,
    subjectLines: null,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Report Cards</h1>
          <p className="text-sm text-slate-500">
            {student.name} · {classStream.name}
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-sais-red text-sais-white px-4 py-2 text-sm hover:bg-sais-red-dark print:hidden"
        >
          Print
        </button>
      </div>

      <div className="overflow-auto print:overflow-visible">
        <EotReportCard
          school={school}
          classStream={classStream}
          student={student}
          scores={eotScores}
          summary={eotSummary || fallbackSummary}
          classAverages={eotAvgs}
          rollCount={students.filter((s) => s.classId === classStream.id).length}
        />
      </div>

      {(midSummary || midScores.length > 0) && (
        <div className="overflow-auto print:overflow-visible">
          <h2 className="text-lg font-semibold mb-2 print:hidden">Midterm</h2>
          <MidtermReportCard
            school={school}
            classStream={classStream}
            student={student}
            scores={midScores}
            classAverages={midAvgs}
          />
        </div>
      )}
    </div>
  );
}
