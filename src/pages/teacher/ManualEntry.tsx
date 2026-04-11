import { useState } from "react";
import { useData } from "../../context/DataContext";
import { calculateGhanaianGrade } from "../../lib/grading";
import { CheckCircle2, Calculator, AlertCircle } from "lucide-react";

export default function ManualEntry() {
  const { students, subjects, addResult } = useData();

  // Form State
  const [studentId, setStudentId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [term, setTerm] = useState("Term 1");
  const [academicYear, setAcademicYear] = useState("2025/2026");
  const [caScore, setCaScore] = useState<string>("");
  const [examScore, setExamScore] = useState<string>("");
  
  // UI State
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Derived State for Real-time Preview
  const parsedCa = Math.min(Math.max(Number(caScore) || 0, 0), 30);
  const parsedExam = Math.min(Math.max(Number(examScore) || 0, 0), 70);
  const preview = calculateGhanaianGrade(parsedCa, parsedExam);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!studentId || !subjectId) {
      setError("Please select both a student and a subject.");
      return;
    }

    if (caScore === "" || examScore === "") {
      setError("Please enter both CA and Exam scores.");
      return;
    }

    if (parsedCa > 30 || parsedExam > 70) {
      setError("Scores exceed maximum allowed values (CA: 30, Exam: 70).");
      return;
    }

    // Save to context
    addResult({
      studentId,
      subjectId,
      term,
      academicYear,
      caScore: parsedCa,
      examScore: parsedExam,
    });

    // Show success and reset scores
    const student = students.find(s => s.id === studentId);
    const subject = subjects.find(s => s.id === subjectId);
    setSuccessMessage(`Successfully saved ${subject?.name} result for ${student?.firstName} ${student?.lastName}.`);
    
    setCaScore("");
    setExamScore("");
    
    // Clear success message after 3 seconds
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Helper to determine grade color
  const getGradeColor = (grade: string) => {
    if (["A1", "B2", "B3"].includes(grade)) return "text-green-600 bg-green-50 border-green-200";
    if (["C4", "C5", "C6"].includes(grade)) return "text-blue-600 bg-blue-50 border-blue-200";
    if (["D7", "E8"].includes(grade)) return "text-orange-600 bg-orange-50 border-orange-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Manual Results Entry</h1>
        <p className="mt-2 text-sm text-gray-500">
          Enter student grades and assessments manually. The system will automatically calculate the final grade.
        </p>
      </div>
      
      {successMessage && (
        <div className="flex items-center gap-3 rounded-lg bg-green-50 p-4 text-green-800 border border-green-200 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          <p className="text-sm font-medium">{successMessage}</p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 rounded-lg bg-red-50 p-4 text-red-800 border border-red-200 animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-8">
          
          {/* Student & Subject Selection */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="student" className="block text-sm font-medium text-gray-700">
                Student
              </label>
              <select
                id="student"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Select a student...</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.indexNumber} - {student.firstName} {student.lastName}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="subject" className="block text-sm font-medium text-gray-700">
                Subject
              </label>
              <select
                id="subject"
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Select a subject...</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name} ({subject.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="term" className="block text-sm font-medium text-gray-700">
                Term
              </label>
              <select
                id="term"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="Term 1">Term 1</option>
                <option value="Term 2">Term 2</option>
                <option value="Term 3">Term 3</option>
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="academicYear" className="block text-sm font-medium text-gray-700">
                Academic Year
              </label>
              <select
                id="academicYear"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="2025/2026">2025/2026</option>
                <option value="2024/2025">2024/2025</option>
              </select>
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Scores Input */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="caScore" className="block text-sm font-medium text-gray-700">
                Continuous Assessment (CA)
              </label>
              <div className="relative">
                <input
                  type="number"
                  id="caScore"
                  min="0"
                  max="30"
                  value={caScore}
                  onChange={(e) => setCaScore(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 pr-12 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="0"
                />
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <span className="text-gray-500 sm:text-sm">/ 30</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="examScore" className="block text-sm font-medium text-gray-700">
                Exam Score
              </label>
              <div className="relative">
                <input
                  type="number"
                  id="examScore"
                  min="0"
                  max="70"
                  value={examScore}
                  onChange={(e) => setExamScore(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 pr-12 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="0"
                />
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <span className="text-gray-500 sm:text-sm">/ 70</span>
                </div>
              </div>
            </div>
          </div>

          {/* Real-time Preview */}
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-5">
            <div className="flex items-center gap-2 mb-4 text-sm font-medium text-gray-700">
              <Calculator className="h-4 w-4 text-gray-500" />
              Real-time Grade Preview
            </div>
            
            <div className="grid grid-cols-3 gap-4 divide-x divide-gray-200">
              <div className="flex flex-col items-center justify-center text-center">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Score</span>
                <span className="mt-1 text-3xl font-bold text-gray-900">{preview.totalScore}</span>
                <span className="text-xs text-gray-400">out of 100</span>
              </div>
              
              <div className="flex flex-col items-center justify-center text-center">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Grade</span>
                <div className={`mt-2 flex h-12 w-12 items-center justify-center rounded-full border-2 ${getGradeColor(preview.grade)}`}>
                  <span className="text-xl font-bold">{preview.grade}</span>
                </div>
              </div>
              
              <div className="flex flex-col items-center justify-center text-center">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Remark</span>
                <span className={`mt-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${getGradeColor(preview.grade)}`}>
                  {preview.remark}
                </span>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
            >
              Save Result
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
