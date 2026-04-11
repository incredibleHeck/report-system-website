import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDatabase } from '../../context/DatabaseContext';
import { CheckCircle2, AlertCircle, ClipboardList, Save } from 'lucide-react';

function getOrdinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function MasterScoreSheet() {
  const { currentUser } = useAuth();
  const { classes, students, results, finalReports, saveFinalReports } = useDatabase();

  const [comments, setComments] = useState<Record<string, string>>({});
  const [successMsg, setSuccessMsg] = useState('');

  // Find the class assigned to this teacher
  const teacherClass = classes.find(c => c.teacherId === currentUser?.id);
  
  // Get students for this class
  const classStudents = students.filter(s => s.classId === teacherClass?.id);

  // Calculate stats and ranks
  const rankedStudents = useMemo(() => {
    if (!teacherClass) return [];

    const stats = classStudents.map(student => {
      const studentResults = results.filter(r => r.studentId === student.id);
      const rawScore = studentResults.reduce((sum, r) => sum + r.totalScore, 0);
      const numSubjects = studentResults.length;
      const averageScore = numSubjects > 0 ? Number((rawScore / numSubjects).toFixed(2)) : 0;
      
      return {
        student,
        rawScore,
        averageScore,
        numSubjects
      };
    });

    // Sort by average descending to determine rank
    const sortedStats = [...stats].sort((a, b) => b.averageScore - a.averageScore);

    let currentRank = 1;
    const ranked = sortedStats.map((stat, index) => {
      if (index > 0 && stat.averageScore < sortedStats[index - 1].averageScore) {
        currentRank = index + 1;
      }
      return { ...stat, rank: currentRank };
    });

    // Sort alphabetically for display
    return ranked.sort((a, b) => a.student.name.localeCompare(b.student.name));
  }, [classStudents, results, teacherClass]);

  // Initialize comments from existing final reports
  useEffect(() => {
    const initialComments: Record<string, string> = {};
    rankedStudents.forEach(({ student }) => {
      const existingReport = finalReports.find(r => r.studentId === student.id);
      if (existingReport) {
        initialComments[student.id] = existingReport.generalComment;
      }
    });
    setComments(initialComments);
  }, [rankedStudents, finalReports]);

  const handleCommentChange = (studentId: string, value: string) => {
    setComments(prev => ({ ...prev, [studentId]: value }));
  };

  const handleFinalize = () => {
    if (!teacherClass) return;

    const reportsToSave = rankedStudents.map(({ student, rawScore, averageScore, rank }) => ({
      studentId: student.id,
      classId: teacherClass.id,
      rawScore,
      averageScore,
      rank,
      generalComment: comments[student.id] || ''
    }));

    saveFinalReports(reportsToSave);
    setSuccessMsg('Report cards finalized successfully!');
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  if (!teacherClass) {
    return (
      <div className="max-w-2xl mx-auto mt-10">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100 mb-6">
            <AlertCircle className="h-8 w-8 text-yellow-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Class Assigned</h2>
          <p className="text-gray-500">You must be assigned to a class to view the master score sheet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-indigo-600" />
            Master Score Sheet
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Class: <span className="font-semibold text-gray-700">{teacherClass.name}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleFinalize}
            disabled={rankedStudents.length === 0}
            className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="h-4 w-4 mr-2" />
            Finalize Report Cards
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="flex items-center gap-3 rounded-lg bg-green-50 p-4 text-green-800 border border-green-200">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          <p className="text-sm font-medium">{successMsg}</p>
        </div>
      )}

      {/* Master Grid */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300">
                <th className="border-r border-gray-300 px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-32">
                  Student ID
                </th>
                <th className="border-r border-gray-300 px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[150px]">
                  Student Name
                </th>
                <th className="border-r border-gray-300 px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider w-24">
                  Subjects
                </th>
                <th className="border-r border-gray-300 px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider w-24">
                  Raw Score
                </th>
                <th className="border-r border-gray-300 px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider w-24 bg-indigo-50">
                  Average
                </th>
                <th className="border-r border-gray-300 px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider w-24 bg-indigo-50">
                  Rank
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Class Teacher's General Comment
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rankedStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">
                    No students found in this class.
                  </td>
                </tr>
              ) : (
                rankedStudents.map(({ student, rawScore, averageScore, rank, numSubjects }) => (
                  <tr key={student.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="border-r border-gray-200 px-4 py-2 text-sm text-gray-900 bg-gray-50">
                      {student.studentId}
                    </td>
                    <td className="border-r border-gray-200 px-4 py-2 text-sm font-medium text-gray-900 bg-gray-50">
                      {student.name}
                    </td>
                    <td className="border-r border-gray-200 px-4 py-2 text-center text-sm text-gray-600">
                      {numSubjects}
                    </td>
                    <td className="border-r border-gray-200 px-4 py-2 text-center text-sm font-semibold text-gray-900">
                      {rawScore}
                    </td>
                    <td className="border-r border-gray-200 px-4 py-2 text-center text-sm font-bold text-indigo-700 bg-indigo-50/30">
                      {averageScore.toFixed(2)}
                    </td>
                    <td className="border-r border-gray-200 px-4 py-2 text-center text-sm font-bold text-indigo-700 bg-indigo-50/30">
                      {getOrdinal(rank)}
                    </td>
                    <td className="p-0">
                      <input
                        type="text"
                        value={comments[student.id] || ''}
                        onChange={(e) => handleCommentChange(student.id, e.target.value)}
                        placeholder="e.g., A brilliant term, keep it up!"
                        className="w-full h-full border-0 bg-transparent px-4 py-3 text-sm focus:ring-2 focus:ring-inset focus:ring-indigo-600 outline-none"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
