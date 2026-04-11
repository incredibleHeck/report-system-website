import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDatabase } from '../../context/DatabaseContext';
import { Printer, GraduationCap, AlertCircle } from 'lucide-react';

function getOrdinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function StudentDashboard() {
  const { currentUser } = useAuth();
  const { schools, classes, students, results, finalReports } = useDatabase();

  // For demo purposes, if the logged-in user's name matches a student, default to them.
  // Otherwise, allow selecting from a dropdown of students in the same school.
  const schoolStudents = students.filter(s => s.schoolId === currentUser?.schoolId);
  const matchedStudent = schoolStudents.find(s => s.name.toLowerCase() === currentUser?.name.toLowerCase());
  
  const [selectedStudentId, setSelectedStudentId] = useState<string>(matchedStudent?.id || schoolStudents[0]?.id || '');

  const student = schoolStudents.find(s => s.id === selectedStudentId);
  const school = schools.find(s => s.id === student?.schoolId);
  const studentClass = classes.find(c => c.id === student?.classId);
  const studentResults = results.filter(r => r.studentId === student?.id);
  const finalReport = finalReports.find(r => r.studentId === student?.id);

  const handlePrint = () => {
    window.print();
  };

  if (schoolStudents.length === 0) {
    return (
      <div className="max-w-2xl mx-auto mt-10">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100 mb-6">
            <AlertCircle className="h-8 w-8 text-yellow-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Students Found</h2>
          <p className="text-gray-500">There are no students registered in your school yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto print:m-0 print:p-0">
      {/* Controls - Hidden when printing */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm print:hidden">
        <div className="flex items-center gap-3">
          <label htmlFor="student-select" className="text-sm font-medium text-gray-700">Viewing Report For:</label>
          <select
            id="student-select"
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            className="block w-64 rounded-md border border-gray-300 py-2 pl-3 pr-8 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {schoolStudents.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.studentId})</option>
            ))}
          </select>
        </div>
        <button
          onClick={handlePrint}
          className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
        >
          <Printer className="h-4 w-4 mr-2" />
          Print / Save PDF
        </button>
      </div>

      {/* Report Card */}
      {student ? (
        <div className="bg-white p-10 shadow-lg border border-gray-200 mx-auto print:shadow-none print:border-none print:p-0" style={{ minHeight: '297mm' }}>
          {/* Header */}
          <div className="text-center border-b-4 border-double border-gray-800 pb-6 mb-6">
            <div className="flex justify-center mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-gray-800 bg-gray-50">
                <GraduationCap className="h-8 w-8 text-gray-800" />
              </div>
            </div>
            <h1 className="text-3xl font-bold uppercase tracking-widest text-gray-900 font-serif">
              {school?.name || 'School Name'}
            </h1>
            <h2 className="text-xl font-semibold mt-2 text-gray-700 uppercase tracking-wider">
              Terminal Report Card
            </h2>
            <p className="text-sm text-gray-500 mt-1">Excellence in Education</p>
          </div>

          {/* Student Details */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 mb-8 text-sm">
            <div className="flex border-b border-gray-200 pb-1">
              <span className="font-semibold w-32 text-gray-700">Student Name:</span>
              <span className="font-bold text-gray-900 uppercase">{student.name}</span>
            </div>
            <div className="flex border-b border-gray-200 pb-1">
              <span className="font-semibold w-32 text-gray-700">Student ID:</span>
              <span className="text-gray-900">{student.studentId}</span>
            </div>
            <div className="flex border-b border-gray-200 pb-1">
              <span className="font-semibold w-32 text-gray-700">Class:</span>
              <span className="text-gray-900">{studentClass?.name || 'N/A'}</span>
            </div>
            <div className="flex border-b border-gray-200 pb-1">
              <span className="font-semibold w-32 text-gray-700">Academic Year:</span>
              <span className="text-gray-900">2025/2026</span>
            </div>
          </div>

          {/* Results Table */}
          <table className="w-full border-collapse border border-gray-800 mb-8">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-800 px-4 py-2 text-left text-sm font-bold text-gray-900">Subject</th>
                <th className="border border-gray-800 px-4 py-2 text-center text-sm font-bold text-gray-900">CW<br/><span className="text-xs font-normal">(20)</span></th>
                <th className="border border-gray-800 px-4 py-2 text-center text-sm font-bold text-gray-900">MT<br/><span className="text-xs font-normal">(20)</span></th>
                <th className="border border-gray-800 px-4 py-2 text-center text-sm font-bold text-gray-900">EOT<br/><span className="text-xs font-normal">(60)</span></th>
                <th className="border border-gray-800 px-4 py-2 text-center text-sm font-bold text-gray-900">Total<br/><span className="text-xs font-normal">(100)</span></th>
                <th className="border border-gray-800 px-4 py-2 text-center text-sm font-bold text-gray-900">Grade</th>
                <th className="border border-gray-800 px-4 py-2 text-left text-sm font-bold text-gray-900">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {studentResults.length === 0 ? (
                <tr>
                  <td colSpan={7} className="border border-gray-800 px-4 py-8 text-center text-sm text-gray-500">
                    No results published yet.
                  </td>
                </tr>
              ) : (
                studentResults.map((result) => (
                  <tr key={result.id}>
                    <td className="border border-gray-800 px-4 py-2 text-sm font-medium text-gray-900">{result.subjectName}</td>
                    <td className="border border-gray-800 px-4 py-2 text-sm text-center text-gray-700">{result.cwScore}</td>
                    <td className="border border-gray-800 px-4 py-2 text-sm text-center text-gray-700">{result.mtScore}</td>
                    <td className="border border-gray-800 px-4 py-2 text-sm text-center text-gray-700">{result.eotScore}</td>
                    <td className="border border-gray-800 px-4 py-2 text-sm text-center font-bold text-gray-900">{result.totalScore}</td>
                    <td className="border border-gray-800 px-4 py-2 text-sm text-center font-bold text-gray-900">{result.grade}</td>
                    <td className="border border-gray-800 px-4 py-2 text-sm text-gray-700">{result.comment}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Master Aggregates */}
          {finalReport && (
            <div className="grid grid-cols-2 gap-8 mb-12">
              <div className="border border-gray-800 p-4">
                <h3 className="font-bold text-gray-900 mb-2 border-b border-gray-300 pb-1">Performance Summary</h3>
                <div className="flex justify-between py-1">
                  <span className="text-sm text-gray-700">Total Raw Score:</span>
                  <span className="text-sm font-bold text-gray-900">{finalReport.rawScore}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-sm text-gray-700">Average Score:</span>
                  <span className="text-sm font-bold text-gray-900">{finalReport.averageScore.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-sm text-gray-700">Position in Class:</span>
                  <span className="text-sm font-bold text-gray-900">{getOrdinal(finalReport.rank)}</span>
                </div>
              </div>

              <div className="border border-gray-800 p-4">
                <h3 className="font-bold text-gray-900 mb-2 border-b border-gray-300 pb-1">Class Teacher's Remarks</h3>
                <p className="text-sm text-gray-800 italic mt-2">
                  "{finalReport.generalComment || 'No general comment provided.'}"
                </p>
              </div>
            </div>
          )}

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-16 mt-16 pt-8">
            <div className="text-center">
              <div className="border-b border-gray-800 h-8 mb-2"></div>
              <span className="text-sm font-semibold text-gray-700 uppercase">Class Teacher's Signature</span>
            </div>
            <div className="text-center">
              <div className="border-b border-gray-800 h-8 mb-2"></div>
              <span className="text-sm font-semibold text-gray-700 uppercase">Headteacher's Signature</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
