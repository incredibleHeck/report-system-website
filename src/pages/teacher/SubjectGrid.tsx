import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDatabase } from '../../context/DatabaseContext';
import { calculateGrade } from '../../lib/grading';
import { Save, CheckCircle2, AlertCircle, TableProperties } from 'lucide-react';

const SUBJECTS = ['English', 'Math', 'French', 'Science', 'ICT'];

type StudentMarks = {
  cw: string;
  mt: string;
  eot: string;
  comment: string;
};

export default function SubjectGrid() {
  const { currentUser } = useAuth();
  const { classes, students, saveSubjectResults } = useDatabase();

  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [marks, setMarks] = useState<Record<string, StudentMarks>>({});
  const [successMsg, setSuccessMsg] = useState('');

  // Find the class assigned to this teacher
  const teacherClass = classes.find(c => c.teacherId === currentUser?.id);
  
  // Get students for this class
  const classStudents = students.filter(s => s.classId === teacherClass?.id);

  const handleMarkChange = (studentId: string, field: keyof StudentMarks, value: string) => {
    setMarks(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { cw: '', mt: '', eot: '', comment: '' }),
        [field]: value
      }
    }));
  };

  const handleSave = () => {
    if (!teacherClass) return;

    let savedCount = 0;
    classStudents.forEach(student => {
      const studentMark = marks[student.id];
      if (studentMark && (studentMark.cw || studentMark.mt || studentMark.eot || studentMark.comment)) {
        const cwScore = Number(studentMark.cw) || 0;
        const mtScore = Number(studentMark.mt) || 0;
        const eotScore = Number(studentMark.eot) || 0;
        
        const { totalScore, grade, comment: autoComment } = calculateGrade(cwScore, mtScore, eotScore);
        
        saveSubjectResults({
          studentId: student.id,
          subjectName: subject,
          cwScore,
          mtScore,
          eotScore,
          totalScore,
          grade,
          comment: studentMark.comment || autoComment
        });
        savedCount++;
      }
    });

    if (savedCount > 0) {
      setSuccessMsg(`Successfully saved results for ${savedCount} students in ${subject}.`);
      setTimeout(() => setSuccessMsg(''), 4000);
      // Optionally clear marks after save:
      // setMarks({});
    } else {
      alert('No marks entered to save.');
    }
  };

  if (!teacherClass) {
    return (
      <div className="max-w-2xl mx-auto mt-10">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100 mb-6">
            <AlertCircle className="h-8 w-8 text-yellow-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Class Assigned</h2>
          <p className="text-gray-500">You must be assigned to a class to enter subject results.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header & Subject Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <TableProperties className="h-6 w-6 text-indigo-600" />
            Subject Grid Entry
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Class: <span className="font-semibold text-gray-700">{teacherClass.name}</span>
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <label htmlFor="subject" className="text-sm font-medium text-gray-700">Subject:</label>
          <select
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="block w-48 rounded-md border border-gray-300 py-2 pl-3 pr-8 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {SUBJECTS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {successMsg && (
        <div className="flex items-center gap-3 rounded-lg bg-green-50 p-4 text-green-800 border border-green-200">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          <p className="text-sm font-medium">{successMsg}</p>
        </div>
      )}

      {/* Spreadsheet Grid */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300">
                <th className="border-r border-gray-300 px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-32">
                  Student ID
                </th>
                <th className="border-r border-gray-300 px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[150px]">
                  Student Name
                </th>
                <th className="border-r border-gray-300 px-2 py-2 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider w-20 bg-blue-50">
                  CW (20)
                </th>
                <th className="border-r border-gray-300 px-2 py-2 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider w-20 bg-blue-50">
                  MT (20)
                </th>
                <th className="border-r border-gray-300 px-2 py-2 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider w-20 bg-blue-50">
                  EOT (60)
                </th>
                <th className="border-r border-gray-300 px-2 py-2 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider w-20 bg-gray-200">
                  Total
                </th>
                <th className="border-r border-gray-300 px-2 py-2 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider w-20 bg-gray-200">
                  Grade
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Comment
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {classStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-sm text-gray-500">
                    No students found in this class. Please add students from the dashboard first.
                  </td>
                </tr>
              ) : (
                classStudents.map((student) => {
                  const studentMark = marks[student.id] || { cw: '', mt: '', eot: '', comment: '' };
                  const cwNum = Number(studentMark.cw) || 0;
                  const mtNum = Number(studentMark.mt) || 0;
                  const eotNum = Number(studentMark.eot) || 0;
                  const { totalScore, grade } = calculateGrade(cwNum, mtNum, eotNum);

                  return (
                    <tr key={student.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="border-r border-gray-200 px-3 py-1 text-sm text-gray-900 bg-gray-50">
                        {student.studentId}
                      </td>
                      <td className="border-r border-gray-200 px-3 py-1 text-sm font-medium text-gray-900 bg-gray-50">
                        {student.name}
                      </td>
                      <td className="border-r border-gray-200 p-0">
                        <input
                          type="number"
                          min="0"
                          max="20"
                          value={studentMark.cw}
                          onChange={(e) => handleMarkChange(student.id, 'cw', e.target.value)}
                          className="w-full h-full border-0 bg-transparent px-2 py-2 text-center text-sm focus:ring-2 focus:ring-inset focus:ring-indigo-600 outline-none"
                        />
                      </td>
                      <td className="border-r border-gray-200 p-0">
                        <input
                          type="number"
                          min="0"
                          max="20"
                          value={studentMark.mt}
                          onChange={(e) => handleMarkChange(student.id, 'mt', e.target.value)}
                          className="w-full h-full border-0 bg-transparent px-2 py-2 text-center text-sm focus:ring-2 focus:ring-inset focus:ring-indigo-600 outline-none"
                        />
                      </td>
                      <td className="border-r border-gray-200 p-0">
                        <input
                          type="number"
                          min="0"
                          max="60"
                          value={studentMark.eot}
                          onChange={(e) => handleMarkChange(student.id, 'eot', e.target.value)}
                          className="w-full h-full border-0 bg-transparent px-2 py-2 text-center text-sm focus:ring-2 focus:ring-inset focus:ring-indigo-600 outline-none"
                        />
                      </td>
                      <td className="border-r border-gray-200 px-2 py-2 text-center text-sm font-bold text-gray-900 bg-gray-100">
                        {totalScore}
                      </td>
                      <td className="border-r border-gray-200 px-2 py-2 text-center text-sm font-bold text-indigo-700 bg-gray-100">
                        {grade}
                      </td>
                      <td className="p-0">
                        <input
                          type="text"
                          value={studentMark.comment}
                          onChange={(e) => handleMarkChange(student.id, 'comment', e.target.value)}
                          placeholder="Optional comment..."
                          className="w-full h-full border-0 bg-transparent px-3 py-2 text-sm focus:ring-2 focus:ring-inset focus:ring-indigo-600 outline-none"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer Actions */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={handleSave}
            disabled={classStudents.length === 0}
            className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Subject Results
          </button>
        </div>
      </div>
    </div>
  );
}
