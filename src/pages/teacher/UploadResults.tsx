import { useState, useRef } from "react";
import Papa from "papaparse";
import { useData } from "../../context/DataContext";
import { calculateGhanaianGrade } from "../../lib/grading";
import { UploadCloud, FileText, CheckCircle2, AlertCircle, X } from "lucide-react";

interface CSVRow {
  studentId: string;
  subject: string;
  caScore: string;
  examScore: string;
}

interface PreviewData {
  studentId: string;
  subjectId: string;
  caScore: number;
  examScore: number;
  totalScore: number;
  grade: string;
  remark: string;
}

export default function UploadResults() {
  const { students, subjects, addBulkResults } = useData();
  
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<PreviewData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Context for the upload
  const [term, setTerm] = useState("Term 1");
  const [academicYear, setAcademicYear] = useState("2025/2026");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const processFile = (selectedFile: File) => {
    setError(null);
    setSuccessMessage(null);
    
    if (selectedFile.type !== "text/csv" && !selectedFile.name.endsWith(".csv")) {
      setError("Please upload a valid CSV file.");
      return;
    }

    setFile(selectedFile);

    Papa.parse<CSVRow>(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const preview: PreviewData[] = results.data.map((row, index) => {
            // Validate required fields
            if (!row.studentId || !row.subject || !row.caScore || !row.examScore) {
              throw new Error(`Row ${index + 1} is missing required columns. Expected: studentId, subject, caScore, examScore.`);
            }

            const ca = Number(row.caScore);
            const exam = Number(row.examScore);

            if (isNaN(ca) || isNaN(exam)) {
              throw new Error(`Row ${index + 1} has invalid scores. Scores must be numbers.`);
            }

            if (ca > 30 || exam > 70) {
              throw new Error(`Row ${index + 1} has scores exceeding limits (CA max 30, Exam max 70).`);
            }

            // Optional: Validate if student and subject exist in context
            const studentExists = students.some(s => s.id === row.studentId || s.indexNumber === row.studentId);
            const subjectExists = subjects.some(s => s.id === row.subject || s.code === row.subject);

            if (!studentExists) throw new Error(`Student ID '${row.studentId}' in row ${index + 1} not found in database.`);
            if (!subjectExists) throw new Error(`Subject '${row.subject}' in row ${index + 1} not found in database.`);

            // Map subject code/id to actual subject ID
            const actualSubjectId = subjects.find(s => s.id === row.subject || s.code === row.subject)?.id || row.subject;
            const actualStudentId = students.find(s => s.id === row.studentId || s.indexNumber === row.studentId)?.id || row.studentId;

            const { totalScore, grade, remark } = calculateGhanaianGrade(ca, exam);

            return {
              studentId: actualStudentId,
              subjectId: actualSubjectId,
              caScore: ca,
              examScore: exam,
              totalScore,
              grade,
              remark
            };
          });

          setParsedData(preview);
        } catch (err: any) {
          setError(err.message);
          setFile(null);
          setParsedData([]);
        }
      },
      error: (error) => {
        setError(`Error parsing CSV: ${error.message}`);
      }
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleConfirmUpload = () => {
    if (parsedData.length === 0) return;

    const resultsToSave = parsedData.map(data => ({
      studentId: data.studentId,
      subjectId: data.subjectId,
      term,
      academicYear,
      caScore: data.caScore,
      examScore: data.examScore,
    }));

    addBulkResults(resultsToSave);
    setSuccessMessage(`Successfully uploaded ${parsedData.length} results.`);
    
    // Reset state
    setFile(null);
    setParsedData([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  const clearFile = () => {
    setFile(null);
    setParsedData([]);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Upload Results</h1>
        <p className="mt-2 text-sm text-gray-500">
          Upload student results via CSV. Ensure your file has the headers: <code className="bg-gray-100 px-1 py-0.5 rounded text-indigo-600">studentId, subject, caScore, examScore</code>.
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

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="term" className="block text-sm font-medium text-gray-700">
            Term for Upload
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

      {/* Upload Area */}
      {!file && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`mt-2 flex justify-center rounded-xl border-2 border-dashed px-6 py-16 transition-colors ${
            isDragging ? "border-indigo-500 bg-indigo-50" : "border-gray-300 bg-white hover:bg-gray-50"
          }`}
        >
          <div className="text-center">
            <UploadCloud className={`mx-auto h-12 w-12 ${isDragging ? "text-indigo-500" : "text-gray-400"}`} />
            <div className="mt-4 flex text-sm leading-6 text-gray-600 justify-center">
              <label
                htmlFor="file-upload"
                className="relative cursor-pointer rounded-md bg-transparent font-semibold text-indigo-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-600 focus-within:ring-offset-2 hover:text-indigo-500"
              >
                <span>Upload a file</span>
                <input
                  id="file-upload"
                  name="file-upload"
                  type="file"
                  accept=".csv"
                  className="sr-only"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
              </label>
              <p className="pl-1">or drag and drop</p>
            </div>
            <p className="text-xs leading-5 text-gray-500">CSV files only</p>
          </div>
        </div>
      )}

      {/* File Selected State */}
      {file && parsedData.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100">
                <FileText className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{file.name}</p>
                <p className="text-xs text-gray-500">{parsedData.length} records found</p>
              </div>
            </div>
            <button
              onClick={clearFile}
              className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Preview Table */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-gray-200 bg-gray-50 px-6 py-4 flex justify-between items-center">
              <h3 className="text-sm font-medium text-gray-900">Data Preview</h3>
              <button
                onClick={handleConfirmUpload}
                className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Confirm Upload
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-white">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">CA (30)</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Exam (70)</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                    <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {parsedData.slice(0, 5).map((row, idx) => {
                    const student = students.find(s => s.id === row.studentId);
                    const subject = subjects.find(s => s.id === row.subjectId);
                    
                    return (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                          {student ? `${student.firstName} ${student.lastName}` : row.studentId}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                          {subject ? subject.name : row.subjectId}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-right text-gray-500">{row.caScore}</td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-right text-gray-500">{row.examScore}</td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-right font-medium text-gray-900">{row.totalScore}</td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-center">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            ["A1", "B2", "B3"].includes(row.grade) ? "bg-green-100 text-green-800" :
                            ["C4", "C5", "C6"].includes(row.grade) ? "bg-blue-100 text-blue-800" :
                            ["D7", "E8"].includes(row.grade) ? "bg-orange-100 text-orange-800" :
                            "bg-red-100 text-red-800"
                          }`}>
                            {row.grade}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {parsedData.length > 5 && (
                <div className="bg-gray-50 px-6 py-3 text-center text-sm text-gray-500 border-t border-gray-200">
                  Showing 5 of {parsedData.length} records. The rest will be processed upon confirmation.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
