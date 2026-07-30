import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertTriangle, Users } from 'lucide-react';
import { useDatabase } from '../../context/DatabaseContext';
import Modal from '../ui/Modal';
import type { TermCode } from '../../types';

interface BulkStudentImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetClassId?: string;
}

interface ParsedStudent {
  rollNumber: string;
  name: string;
  gender: 'Male' | 'Female' | 'Unknown';
  joinTerm: TermCode;
}

export default function BulkStudentImportModal({
  isOpen,
  onClose,
  targetClassId: initialClassId,
}: BulkStudentImportModalProps) {
  const { classes, bulkAddStudents } = useDatabase();

  const [selectedClassId, setSelectedClassId] = useState(initialClassId || '');
  const [rawText, setRawText] = useState('');
  const [parsedItems, setParsedItems] = useState<ParsedStudent[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  React.useEffect(() => {
    if (initialClassId) setSelectedClassId(initialClassId);
    else if (classes.length > 0 && !selectedClassId) setSelectedClassId(classes[0].id);
  }, [initialClassId, classes]);

  const handleParse = (text: string) => {
    setRawText(text);
    setError('');

    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const parsed: ParsedStudent[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Ignore CSV header if present
      if (i === 0 && line.toLowerCase().includes('roll')) continue;

      const parts = line.split(/[,;\t]/).map((p) => p.trim());
      if (parts.length < 2) continue;

      const rollNumber = parts[0].toUpperCase();
      const name = parts[1].toUpperCase();
      let genderStr = (parts[2] || 'Male').toLowerCase();
      let gender: 'Male' | 'Female' | 'Unknown' = 'Male';
      if (genderStr.startsWith('f')) gender = 'Female';
      else if (genderStr.startsWith('m')) gender = 'Male';

      parsed.push({
        rollNumber,
        name,
        gender,
        joinTerm: 'T1',
      });
    }

    setParsedItems(parsed);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (text) handleParse(text);
    };
    reader.readAsText(file);
  };

  const handleSubmitImport = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedClassId) {
      setError('Please select a target class stream.');
      return;
    }
    if (parsedItems.length === 0) {
      setError('No valid student records to import.');
      return;
    }

    try {
      bulkAddStudents(selectedClassId, parsedItems);
      setSuccess(`Successfully added ${parsedItems.length} students to class stream!`);
      setTimeout(() => {
        onClose();
        setSuccess('');
        setRawText('');
        setParsedItems([]);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk import failed');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Bulk CSV Student Roster Import"
      subtitle="Ingest CSV rosters and mint SAIS-STU-XXXX keys automatically"
    >
      <form onSubmit={handleSubmitImport} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-700 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            {success}
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Target Class Stream
          </label>
          <select
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-sais-black focus-visible:ring-2 focus-visible:ring-sais-red"
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            required
          >
            {classes.map((cs) => (
              <option key={cs.id} value={cs.id}>
                {cs.name} ({cs.academicYear || cs.academicYearId || 'Active Year'})
              </option>
            ))}
          </select>
        </div>

        {/* Upload or Paste area */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Paste CSV / Tab-separated Data or Upload File
            </label>
            <label className="text-xs text-sais-red hover:underline font-semibold cursor-pointer flex items-center gap-1">
              <Upload className="w-3.5 h-3.5" />
              Upload .csv file
              <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>

          <textarea
            rows={5}
            placeholder={`Format: Roll, Full Name, Gender\nExample:\n001, ABRAHAMS JESLYN, Female\n002, ACQUAH ZOE, Female\n003, ADUAM ELNATHAN, Male`}
            value={rawText}
            onChange={(e) => handleParse(e.target.value)}
            className="w-full rounded-xl border border-slate-300 p-3 text-xs font-mono focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:outline-none"
          />
        </div>

        {/* Parsed Preview Table */}
        {parsedItems.length > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-sais-red" />
                Parsed Records Preview ({parsedItems.length} Students)
              </h4>
              <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                SAIS-STU-XXXX keys auto-minted
              </span>
            </div>

            <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-left text-slate-500">
                    <th className="py-2 px-3 font-semibold">Roll</th>
                    <th className="py-2 px-3 font-semibold">Full Name</th>
                    <th className="py-2 px-3 font-semibold">Gender</th>
                    <th className="py-2 px-3 font-semibold">Key Standard</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedItems.map((item, idx) => (
                    <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="py-1.5 px-3 font-mono font-bold text-slate-800">{item.rollNumber}</td>
                      <td className="py-1.5 px-3 font-semibold text-slate-800">{item.name}</td>
                      <td className="py-1.5 px-3 text-slate-600">{item.gender}</td>
                      <td className="py-1.5 px-3 font-mono text-sais-red font-semibold">SAIS-STU-XXXX</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={parsedItems.length === 0 || !selectedClassId}
            className="rounded-lg bg-sais-red text-white px-4 py-2 text-xs font-semibold hover:bg-sais-red-dark shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <Users className="w-3.5 h-3.5" />
            Import {parsedItems.length} Students
          </button>
        </div>
      </form>
    </Modal>
  );
}
