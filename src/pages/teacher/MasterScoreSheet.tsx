import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDatabase } from '../../context/DatabaseContext';
import { ClipboardList, Save, CheckCircle2, AlertCircle, TrendingUp, Award, Users } from 'lucide-react';

function getOrdinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function MasterScoreSheet() {
  const { currentUser } = useAuth();
  const { classes, students, results, finalReports, saveFinalReports } = useDatabase();

  const [selectedClassId, setSelectedClassId] = useState('');
  const [comments, setComments] = useState<Record<string, string>>({});
  const [successMsg, setSuccessMsg] = useState('');

  // 1. Find classes where current teacher is the FORM teacher
  const formClasses = useMemo(() => 
    classes.filter(c => c.teacherId === currentUser?.id),
    [classes, currentUser]
  );

  // Set default class if not set
  useEffect(() => {
    if (formClasses.length > 0 && !selectedClassId) {
      setSelectedClassId(formClasses[0].id);
    }
  }, [formClasses, selectedClassId]);

  const activeClass = useMemo(() => 
    classes.find(c => c.id === selectedClassId),
    [classes, selectedClassId]
  );

  const classStudents = useMemo(() => 
    students.filter(s => s.classId === selectedClassId),
    [students, selectedClassId]
  );

  // 2. Identify all unique subjects assigned to this class
  const classSubjects = useMemo(() => {
    if (!activeClass) return [];
    const subjectsFromAssignments = activeClass.subjectTeachers?.map(st => st.subjectName) || [];
    // Also check results in case some subjects weren't formally assigned but have marks
    const subjectsFromResults = results
      .filter(r => classStudents.some(s => s.id === r.studentId))
      .map(r => r.subjectName);
    
    return Array.from(new Set([...subjectsFromAssignments, ...subjectsFromResults])).sort();
  }, [activeClass, results, classStudents]);

  // 3. Calculate Aggregated Data and Ranking
  const masterData = useMemo(() => {
    if (!activeClass || classStudents.length === 0) return [];

    const stats = classStudents.map(student => {
      const studentResults = results.filter(r => r.studentId === student.id);
      
      // Map subject totals for easy access in the table
      const subjectTotals: Record<string, number | '-'> = {};
      classSubjects.forEach(sub => {
        const res = studentResults.find(r => r.subjectName === sub);
        subjectTotals[sub] = res ? res.totalScore : '-';
      });

      const rawScore = studentResults.reduce((sum, r) => sum + r.totalScore, 0);
      const numSubjects = studentResults.length;
      const averageScore = numSubjects > 0 ? Number((rawScore / numSubjects).toFixed(2)) : 0;

      return {
        student,
        subjectTotals,
        rawScore,
        averageScore,
        numSubjects
      };
    });

    // Determine Ranks based on average score
    const sortedByAverage = [...stats].sort((a, b) => b.averageScore - a.averageScore);
    let currentRank = 1;
    const ranked = sortedByAverage.map((stat, index) => {
      if (index > 0 && stat.averageScore < sortedByAverage[index - 1].averageScore) {
        currentRank = index + 1;
      }
      return { ...stat, rank: currentRank };
    });

    // Return sorted by name for consistent table view
    return ranked.sort((a, b) => a.student.name.localeCompare(b.student.name));
  }, [activeClass, classStudents, results, classSubjects]);

  // Load existing comments from finalReports
  useEffect(() => {
    const initialComments: Record<string, string> = {};
    classStudents.forEach(s => {
      const report = finalReports.find(r => r.studentId === s.id && r.classId === selectedClassId);
      if (report) initialComments[s.id] = report.generalComment;
    });
    setComments(initialComments);
  }, [selectedClassId, classStudents.length]);

  const handleCommentChange = (studentId: string, val: string) => {
    setComments(prev => ({ ...prev, [studentId]: val }));
  };

  const handleFinalize = () => {
    if (!selectedClassId) return;

    const reports = masterData.map(row => ({
      studentId: row.student.id,
      classId: selectedClassId,
      rawScore: row.rawScore,
      averageScore: row.averageScore,
      rank: row.rank,
      generalComment: comments[row.student.id] || ''
    }));

    saveFinalReports(reports);
    setSuccessMsg('Term reports have been finalized and saved.');
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  if (formClasses.length === 0) {
    return (
      <div className="max-w-2xl mx-auto mt-12">
        <div className="bg-white p-10 rounded-3xl shadow-xl border border-gray-100 text-center space-y-6">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-50 text-amber-500">
            <AlertCircle className="h-10 w-10" />
          </div>
          <h2 className="text-3xl font-black text-gray-900">Access Restricted</h2>
          <p className="text-gray-500 text-lg leading-relaxed">
            The Master Score Sheet is only available to <strong>Form Teachers</strong>. You are currently not assigned as a Form Teacher for any class.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-[95rem] mx-auto pb-20 animate-in fade-in duration-700">
      {/* Header & Controls */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 bg-white p-8 rounded-3xl border border-gray-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <ClipboardList className="h-40 w-40" />
        </div>
        
        <div className="space-y-4 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 text-white rounded-lg">
              <ClipboardList className="h-6 w-6" />
            </div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Master Score Sheet</h1>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-col">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Select Form Class</label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="rounded-xl border-gray-300 text-sm font-bold focus:ring-2 focus:ring-indigo-500 h-12 px-4 border bg-white min-w-[200px] shadow-sm"
              >
                {formClasses.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-4 pt-5">
               <div className="px-4 py-2 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Total Students</p>
                  <p className="text-lg font-black text-indigo-600">{classStudents.length}</p>
               </div>
               <div className="px-4 py-2 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Total Subjects</p>
                  <p className="text-lg font-black text-indigo-600">{classSubjects.length}</p>
               </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 relative z-10">
          {successMsg && (
            <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-3 rounded-xl border border-emerald-100 animate-in slide-in-from-right-4 font-bold text-sm">
              <CheckCircle2 className="h-5 w-5" />
              {successMsg}
            </div>
          )}
          <button
            onClick={handleFinalize}
            className="flex items-center justify-center gap-2 bg-indigo-600 text-white font-black px-8 py-4 rounded-2xl hover:bg-indigo-700 transition-all active:scale-95 shadow-xl shadow-indigo-200"
          >
            <Save className="h-5 w-5" />
            Finalize Term Reports
          </button>
        </div>
      </div>

      {/* Main Aggregation Table */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 border-b-2 border-gray-200">
                <th className="sticky left-0 z-20 bg-gray-50 border-r border-gray-200 px-4 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest w-12">#</th>
                <th className="sticky left-12 z-20 bg-gray-50 border-r border-gray-200 px-4 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest w-32">Student ID</th>
                <th className="sticky left-44 z-20 bg-gray-50 border-r border-gray-200 px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest min-w-[200px]">Full Name</th>
                
                {/* Dynamic Subject Columns */}
                {classSubjects.map(subject => (
                  <th key={subject} className="border-r border-gray-200 px-2 py-4 text-center text-[10px] font-black text-indigo-600 uppercase tracking-widest min-w-[80px]">
                    {subject}<br/><span className="text-[8px] text-gray-400">Total</span>
                  </th>
                ))}

                <th className="border-r border-gray-200 px-4 py-4 text-center text-[10px] font-black text-gray-700 uppercase tracking-widest w-28 bg-gray-100/50">Raw Score</th>
                <th className="border-r border-gray-200 px-4 py-4 text-center text-[10px] font-black text-indigo-700 uppercase tracking-widest w-28 bg-indigo-50/50">Average</th>
                <th className="border-r border-gray-200 px-4 py-4 text-center text-[10px] font-black text-emerald-700 uppercase tracking-widest w-24 bg-emerald-50/50">Rank</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest min-w-[300px]">General Comment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {masterData.map((row, idx) => (
                <tr key={row.student.id} className="hover:bg-indigo-50/30 transition-colors group">
                  <td className="sticky left-0 z-10 bg-white group-hover:bg-indigo-50 border-r border-gray-100 px-4 py-3 text-xs font-bold text-gray-400 text-center">
                    {idx + 1}
                  </td>
                  <td className="sticky left-12 z-10 bg-white group-hover:bg-indigo-50 border-r border-gray-100 px-4 py-3 text-xs font-mono text-gray-500">
                    {row.student.studentId}
                  </td>
                  <td className="sticky left-44 z-10 bg-white group-hover:bg-indigo-50 border-r border-gray-100 px-6 py-3 text-sm font-black text-gray-800">
                    {row.student.name}
                  </td>

                  {/* Subject Totals */}
                  {classSubjects.map(sub => (
                    <td key={sub} className="border-r border-gray-100 px-2 py-3 text-center text-sm font-bold text-gray-600">
                      {row.subjectTotals[sub]}
                    </td>
                  ))}

                  <td className="border-r border-gray-100 px-4 py-3 text-center text-sm font-black text-gray-900 bg-gray-50/30">
                    {row.rawScore}
                  </td>
                  <td className="border-r border-gray-100 px-4 py-3 text-center text-sm font-black text-indigo-700 bg-indigo-50/20">
                    {row.averageScore}
                  </td>
                  <td className="border-r border-gray-100 px-4 py-3 text-center text-sm font-black text-emerald-700 bg-emerald-50/20">
                    <div className="flex items-center justify-center gap-1">
                      <Award className={`h-3 w-3 ${row.rank <= 3 ? 'text-amber-500' : 'text-emerald-400'}`} />
                      {getOrdinal(row.rank)}
                    </div>
                  </td>
                  <td className="p-0">
                    <input
                      type="text"
                      value={comments[row.student.id] || ''}
                      onChange={(e) => handleCommentChange(row.student.id, e.target.value)}
                      placeholder="e.g. Excellent performance this term..."
                      className="w-full h-12 border-0 bg-transparent px-6 text-sm font-medium italic text-gray-500 focus:ring-2 focus:ring-inset focus:ring-indigo-600 outline-none"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-indigo-600 rounded-3xl p-8 text-white shadow-xl flex items-center justify-between">
            <div>
               <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest mb-2">Class Average</p>
               <p className="text-4xl font-black">
                  {(masterData.reduce((acc, curr) => acc + curr.averageScore, 0) / (masterData.length || 1)).toFixed(2)}%
               </p>
            </div>
            <TrendingUp className="h-12 w-12 text-indigo-400 opacity-50" />
         </div>
         <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
               <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">Highest Average</p>
               <p className="text-4xl font-black text-emerald-600">
                  {Math.max(...masterData.map(r => r.averageScore), 0)}%
               </p>
            </div>
            <Award className="h-12 w-12 text-emerald-100" />
         </div>
         <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
               <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">Report Readiness</p>
               <p className="text-4xl font-black text-gray-900">
                  {Math.round((Object.keys(comments).length / (classStudents.length || 1)) * 100)}%
               </p>
            </div>
            <Users className="h-12 w-12 text-gray-100" />
         </div>
      </div>
    </div>
  );
}
