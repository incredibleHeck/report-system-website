import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDatabase } from '../../context/DatabaseContext';
import { Printer, GraduationCap, Award, BookOpen, User as UserIcon, Calendar, CheckCircle, Info } from 'lucide-react';

function getOrdinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function StudentDashboard() {
  const { currentUser } = useAuth();
  const { schools, classes, students, results, finalReports, users } = useDatabase();

  // 1. Identify the student profile
  const schoolStudents = useMemo(() => 
    students.filter(s => s.schoolId === currentUser?.schoolId),
    [students, currentUser]
  );

  // For students, they see only their own. For headteachers/teachers, allow selection.
  const [selectedStudentId, setSelectedStudentId] = useState<string>(() => {
    const matched = schoolStudents.find(s => s.name.toLowerCase() === currentUser?.name.toLowerCase());
    return matched?.id || schoolStudents[0]?.id || '';
  });

  const student = useMemo(() => schoolStudents.find(s => s.id === selectedStudentId), [schoolStudents, selectedStudentId]);
  const school = useMemo(() => schools.find(s => s.id === student?.schoolId), [schools, student]);
  const studentClass = useMemo(() => classes.find(c => c.id === student?.classId), [classes, student]);
  const studentResults = useMemo(() => results.filter(r => r.studentId === student?.id), [results, student]);
  const finalReport = useMemo(() => finalReports.find(r => r.studentId === student?.id), [finalReports, student]);
  const formTeacher = useMemo(() => users.find(u => u.id === studentClass?.teacherId), [users, studentClass]);

  const handlePrint = () => {
    window.print();
  };

  if (!currentUser) return null;

  if (schoolStudents.length === 0) {
    return (
      <div className="max-w-2xl mx-auto mt-12 bg-white p-12 rounded-[2.5rem] border border-gray-100 text-center shadow-xl">
        <div className="bg-amber-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-amber-500">
          <Info className="h-10 w-10" />
        </div>
        <h2 className="text-3xl font-black text-gray-900 mb-2">Profile Not Found</h2>
        <p className="text-gray-500 text-lg">We couldn't find a student profile matching your account in this school's database.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      {/* Dynamic Header for Web View */}
      <style>
        {`
          @media print {
            .no-print { display: none !important; }
            body { background: white !important; margin: 0 !important; padding: 0 !important; }
            .report-card { border: none !important; box-shadow: none !important; margin: 0 !important; padding: 0 !important; width: 100% !important; }
            @page { size: auto; margin: 15mm; }
          }
        `}
      </style>

      <div className="no-print bg-white p-6 rounded-3xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100">
            <GraduationCap className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Student Portal</h1>
            <p className="text-gray-500 font-medium text-sm">Official Academic Performance Dashboard</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {currentUser.role !== 'student' && (
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="rounded-xl border-gray-200 text-sm font-bold focus:ring-2 focus:ring-indigo-500 h-11 px-4 border bg-gray-50 min-w-[200px]"
            >
              {schoolStudents.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-2 bg-gray-900 text-white font-black px-6 py-3 rounded-xl hover:bg-indigo-600 transition-all active:scale-95 shadow-md"
          >
            <Printer className="h-4 w-4" />
            Print Report Card
          </button>
        </div>
      </div>

      {/* Formal Report Card UI */}
      {student ? (
        <div className="report-card bg-white rounded-[2.5rem] border border-gray-200 shadow-2xl p-12 mx-auto relative overflow-hidden">
          {/* Subtle Decorative Elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-50"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-50 rounded-full blur-3xl -ml-32 -mb-32 opacity-50"></div>

          {/* School Header */}
          <div className="text-center border-b-2 border-gray-900 pb-10 mb-10 relative z-10">
            <div className="flex justify-center mb-6">
              <div className="p-5 border-4 border-gray-900 rounded-full bg-white shadow-xl">
                <GraduationCap className="h-12 w-12 text-gray-900" />
              </div>
            </div>
            <h1 className="text-4xl font-black uppercase tracking-tighter text-gray-900 font-serif mb-2">
              {school?.name || 'Academic Institution'}
            </h1>
            <div className="flex items-center justify-center gap-4 text-xs font-black uppercase tracking-[0.3em] text-gray-400">
              <span>Terminal Performance Report</span>
              <div className="w-1.5 h-1.5 rounded-full bg-gray-300"></div>
              <span>Academic Year 2025/2026</span>
            </div>
          </div>

          {/* Student Dossier */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12 relative z-10">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                <UserIcon className="h-3 w-3" /> Full Student Name
              </p>
              <p className="text-lg font-black text-gray-900 uppercase">{student.name}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                <Award className="h-3 w-3" /> Student ID Number
              </p>
              <p className="text-lg font-mono font-bold text-indigo-600">{student.studentId}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                <BookOpen className="h-3 w-3" /> Assigned Class
              </p>
              <p className="text-lg font-black text-gray-900">{studentClass?.name || 'N/A'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Report Date
              </p>
              <p className="text-lg font-black text-gray-900">{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
          </div>

          {/* Results Table */}
          <div className="mb-12 relative z-10">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-900 text-white">
                  <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest rounded-tl-xl">Academic Subject</th>
                  <th className="px-3 py-4 text-center text-[10px] font-black uppercase tracking-widest w-20">CW<br/><span className="text-[8px] text-gray-400">20</span></th>
                  <th className="px-3 py-4 text-center text-[10px] font-black uppercase tracking-widest w-20">MT<br/><span className="text-[8px] text-gray-400">20</span></th>
                  <th className="px-3 py-4 text-center text-[10px] font-black uppercase tracking-widest w-20">EOT<br/><span className="text-[8px] text-gray-400">60</span></th>
                  <th className="px-3 py-4 text-center text-[10px] font-black uppercase tracking-widest w-24 bg-indigo-800">Total<br/><span className="text-[8px] text-indigo-300">100</span></th>
                  <th className="px-3 py-4 text-center text-[10px] font-black uppercase tracking-widest w-20 bg-indigo-800">Grade</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest rounded-tr-xl">Subject Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-gray-100">
                {studentResults.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center text-gray-400 italic font-medium">
                      No subject results have been published for this student yet.
                    </td>
                  </tr>
                ) : (
                  studentResults.map((res) => (
                    <tr key={res.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-black text-gray-900">{res.subjectName}</td>
                      <td className="px-3 py-4 text-center text-sm font-bold text-gray-500">{res.cwScore}</td>
                      <td className="px-3 py-4 text-center text-sm font-bold text-gray-500">{res.mtScore}</td>
                      <td className="px-3 py-4 text-center text-sm font-bold text-gray-500">{res.eotScore}</td>
                      <td className="px-3 py-4 text-center text-sm font-black text-indigo-700 bg-indigo-50/30">{res.totalScore}</td>
                      <td className="px-3 py-4 text-center text-sm font-black text-indigo-700 bg-indigo-50/30">{res.grade}</td>
                      <td className="px-6 py-4 text-sm font-medium italic text-gray-500 leading-tight">{res.comment}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Performance Summary Blocks */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-16 relative z-10">
            <div className="bg-gray-50 rounded-3xl p-8 border-2 border-dashed border-gray-200">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                <Award className="h-4 w-4 text-indigo-600" /> Master Aggregates
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                  <span className="text-sm font-bold text-gray-500">Cumulative Raw Score</span>
                  <span className="text-xl font-black text-gray-900">{finalReport?.rawScore || '0'}</span>
                </div>
                <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                  <span className="text-sm font-bold text-gray-500">Weighted Average (%)</span>
                  <span className="text-xl font-black text-indigo-600">{finalReport?.averageScore.toFixed(2) || '0.00'}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-gray-500">Overall Class Position</span>
                  <span className="text-xl font-black text-emerald-600">{finalReport ? getOrdinal(finalReport.rank) : 'N/A'}</span>
                </div>
              </div>
            </div>

            <div className="bg-indigo-50 rounded-3xl p-8 border-2 border-indigo-100 flex flex-col">
              <h3 className="text-sm font-black text-indigo-900 uppercase tracking-widest mb-4">Class Teacher's Final Remarks</h3>
              <div className="flex-1 italic text-gray-700 font-medium leading-relaxed">
                "{finalReport?.generalComment || 'No general comment has been provided by the Form Teacher.'}"
              </div>
              <div className="mt-6 flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center font-black text-indigo-600 border border-indigo-200">
                    {formTeacher?.name.charAt(0).toUpperCase() || 'T'}
                 </div>
                 <div>
                    <p className="text-xs font-black text-indigo-900">{formTeacher?.name || 'Form Teacher'}</p>
                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Class Supervisor</p>
                 </div>
              </div>
            </div>
          </div>

          {/* Official Signatures */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-20 pt-10 relative z-10">
            <div className="text-center space-y-4">
              <div className="h-20 flex items-end justify-center">
                 {/* Placeholder for Signature */}
              </div>
              <div className="border-t-2 border-gray-900 pt-3">
                <p className="text-xs font-black text-gray-900 uppercase tracking-widest">Class Teacher's Signature</p>
              </div>
            </div>
            <div className="text-center space-y-4">
              <div className="h-20 flex items-end justify-center">
                 {/* Placeholder for Signature */}
              </div>
              <div className="border-t-2 border-gray-900 pt-3">
                <p className="text-xs font-black text-gray-900 uppercase tracking-widest">Headteacher's / Principal's Stamp</p>
              </div>
            </div>
          </div>

          {/* Footer Branding */}
          <div className="mt-20 text-center text-[10px] font-bold text-gray-300 uppercase tracking-[0.5em]">
            Generated via EduManage GH Academic Intelligence System
          </div>
        </div>
      ) : null}
    </div>
  );
}
