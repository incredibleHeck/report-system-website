import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useDatabase } from '../../context/DatabaseContext';
import { calculateGrade } from '../../lib/grading';
import { Save, AlertCircle, TableProperties, ChevronLeft, CheckCircle } from 'lucide-react';

type StudentMarks = {
  cw: string;
  mt: string;
  eot: string;
  comment: string;
};

export default function SubjectGrid() {
  const { currentUser } = useAuth();
  const { classes, students, saveSubjectResults, results } = useDatabase();
  const location = useLocation();
  const navigate = useNavigate();

  // 1. Get routing params (classId and subjectName)
  const state = location.state as { classId?: string; subjectName?: string } | null;

  const [selectedClassId, setSelectedClassId] = useState(state?.classId || '');
  const [selectedSubject, setSelectedSubject] = useState(state?.subjectName || '');
  const [marks, setMarks] = useState<Record<string, StudentMarks>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const activeClass = classes.find(c => c.id === selectedClassId);
  const classStudents = students.filter(s => s.classId === selectedClassId);

  // 2. Pre-fill if results already exist
  useEffect(() => {
    if (selectedClassId && selectedSubject) {
      const existingMarks: Record<string, StudentMarks> = {};
      classStudents.forEach(student => {
        const result = results.find(r => r.studentId === student.id && r.subjectName === selectedSubject);
        if (result) {
          existingMarks[student.id] = {
            cw: result.cwScore.toString(),
            mt: result.mtScore.toString(),
            eot: result.eotScore.toString(),
            comment: result.comment || ''
          };
        }
      });
      setMarks(existingMarks);
    }
  }, [selectedClassId, selectedSubject]);

  const handleMarkChange = (studentId: string, field: keyof StudentMarks, value: string) => {
    // Basic validation: ensure it's a number and within range (optional here, but good for UI)
    setMarks(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { cw: '', mt: '', eot: '', comment: '' }),
        [field]: value
      }
    }));
  };

  const handleSave = async () => {
    if (!selectedClassId || !selectedSubject) return;
    setIsSaving(true);

    try {
      classStudents.forEach(student => {
        const studentMark = marks[student.id];
        // Only save if some data exists
        if (studentMark && (studentMark.cw || studentMark.mt || studentMark.eot || studentMark.comment)) {
          const cwScore = Number(studentMark.cw) || 0;
          const mtScore = Number(studentMark.mt) || 0;
          const eotScore = Number(studentMark.eot) || 0;
          
          const { totalScore, grade, comment: autoComment } = calculateGrade(cwScore, mtScore, eotScore);
          
          saveSubjectResults({
            studentId: student.id,
            subjectName: selectedSubject,
            cwScore,
            mtScore,
            eotScore,
            totalScore,
            grade,
            comment: studentMark.comment || autoComment
          });
        }
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  if (!currentUser) return null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      {/* Header Area */}
      <div className="flex flex-col gap-4">
        <button 
          onClick={() => navigate('/teacher')}
          className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-indigo-600 transition-colors w-fit"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Dashboard
        </button>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <TableProperties className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900 leading-tight">Subject Mark Sheet</h1>
              <p className="text-gray-500 font-medium">
                {selectedSubject} — <span className="text-indigo-600 font-bold">{activeClass?.name || 'No Class Selected'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {success && (
              <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-100 animate-in fade-in slide-in-from-right-4">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm font-bold">Marks Saved Successfully!</span>
              </div>
            )}
            <button
              onClick={handleSave}
              disabled={isSaving || !selectedClassId || !selectedSubject}
              className="flex items-center gap-2 bg-gray-900 text-white font-bold px-6 py-3 rounded-xl hover:bg-indigo-600 transition-all active:scale-95 disabled:opacity-50 shadow-lg"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save Subject Marks'}
            </button>
          </div>
        </div>
      </div>

      {/* Excel-like Spreadsheet Grid */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
        {!selectedClassId || !selectedSubject ? (
          <div className="p-20 text-center">
            <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">Please select a class and subject to view the grid.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b-2 border-gray-300">
                  <th className="border-r border-gray-300 px-3 py-2 text-left text-[10px] font-black text-gray-500 uppercase tracking-widest w-12">#</th>
                  <th className="border-r border-gray-300 px-3 py-2 text-left text-[10px] font-black text-gray-500 uppercase tracking-widest w-32">Student ID</th>
                  <th className="border-r border-gray-300 px-4 py-2 text-left text-[10px] font-black text-gray-500 uppercase tracking-widest min-w-[200px]">Full Name</th>
                  <th className="border-r border-gray-300 px-2 py-2 text-center text-[10px] font-black text-indigo-700 uppercase tracking-widest w-20 bg-indigo-50">CW (20)</th>
                  <th className="border-r border-gray-300 px-2 py-2 text-center text-[10px] font-black text-indigo-700 uppercase tracking-widest w-20 bg-indigo-50">MT (20)</th>
                  <th className="border-r border-gray-300 px-2 py-2 text-center text-[10px] font-black text-indigo-700 uppercase tracking-widest w-20 bg-indigo-50">EOT (60)</th>
                  <th className="border-r border-gray-300 px-2 py-2 text-center text-[10px] font-black text-gray-700 uppercase tracking-widest w-24 bg-gray-200">Total (100)</th>
                  <th className="border-r border-gray-300 px-2 py-2 text-center text-[10px] font-black text-gray-700 uppercase tracking-widest w-20 bg-gray-200">Grade</th>
                  <th className="px-4 py-2 text-left text-[10px] font-black text-gray-500 uppercase tracking-widest">Comment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {classStudents.map((student, index) => {
                  const sMark = marks[student.id] || { cw: '', mt: '', eot: '', comment: '' };
                  
                  // 3. Real-time updates: calculating values inline
                  const cwVal = Number(sMark.cw) || 0;
                  const mtVal = Number(sMark.mt) || 0;
                  const eotVal = Number(sMark.eot) || 0;
                  const { totalScore, grade } = calculateGrade(cwVal, mtVal, eotVal);

                  return (
                    <tr key={student.id} className="hover:bg-indigo-50 transition-colors group">
                      <td className="border-r border-gray-200 px-3 py-1 text-xs font-bold text-gray-400 bg-gray-50 text-center">
                        {index + 1}
                      </td>
                      <td className="border-r border-gray-200 px-3 py-1 text-xs font-mono text-gray-500">
                        {student.studentId}
                      </td>
                      <td className="border-r border-gray-200 px-4 py-1 text-sm font-bold text-gray-800">
                        {student.name}
                      </td>
                      <td className="border-r border-gray-200 p-0 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-600 transition-all">
                        <input
                          type="number"
                          min="0"
                          max="20"
                          value={sMark.cw}
                          onChange={(e) => handleMarkChange(student.id, 'cw', e.target.value)}
                          className="w-full h-10 border-0 bg-transparent px-2 text-center text-sm font-bold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </td>
                      <td className="border-r border-gray-200 p-0 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-600 transition-all">
                        <input
                          type="number"
                          min="0"
                          max="20"
                          value={sMark.mt}
                          onChange={(e) => handleMarkChange(student.id, 'mt', e.target.value)}
                          className="w-full h-10 border-0 bg-transparent px-2 text-center text-sm font-bold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </td>
                      <td className="border-r border-gray-200 p-0 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-600 transition-all">
                        <input
                          type="number"
                          min="0"
                          max="60"
                          value={sMark.eot}
                          onChange={(e) => handleMarkChange(student.id, 'eot', e.target.value)}
                          className="w-full h-10 border-0 bg-transparent px-2 text-center text-sm font-bold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </td>
                      <td className="border-r border-gray-200 px-2 py-1 text-center text-sm font-black text-gray-900 bg-gray-100 group-hover:bg-indigo-50/50">
                        {totalScore}
                      </td>
                      <td className={`border-r border-gray-200 px-2 py-1 text-center text-sm font-black bg-gray-100 group-hover:bg-indigo-50/50 ${
                        grade === 'U' ? 'text-red-600' : 'text-indigo-600'
                      }`}>
                        {grade}
                      </td>
                      <td className="p-0 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-600 transition-all">
                        <input
                          type="text"
                          value={sMark.comment}
                          onChange={(e) => handleMarkChange(student.id, 'comment', e.target.value)}
                          placeholder="Add comment..."
                          className="w-full h-10 border-0 bg-transparent px-4 text-xs font-medium italic text-gray-500 outline-none"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-indigo-900 text-white p-6 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl border-4 border-white">
        <div className="text-center sm:text-left">
          <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest mb-1">Grading Summary</p>
          <p className="text-sm font-medium">Class: <span className="text-white font-bold">{activeClass?.name}</span> | Subject: <span className="text-white font-bold">{selectedSubject}</span></p>
        </div>
        <div className="flex gap-4">
          <div className="text-center">
            <p className="text-[10px] text-indigo-300 font-black uppercase">Students</p>
            <p className="text-xl font-black">{classStudents.length}</p>
          </div>
          <div className="h-10 w-[1px] bg-indigo-800"></div>
          <div className="text-center">
            <p className="text-[10px] text-indigo-300 font-black uppercase">Entered</p>
            <p className="text-xl font-black">{Object.keys(marks).length}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
