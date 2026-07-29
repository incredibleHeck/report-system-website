import React from 'react';
import { CheckCircle, Lock } from 'lucide-react';

interface MasterSheetHeaderProps {
  activeClass: any;
  selectedAcademicYearId: string;
  selectedTermView: string;
  setSelectedTermView: (view: 'T1' | 'T2' | 'T3' | 'ANNUAL') => void;
  mode: 'EOT' | 'MIDTERM';
  setMode: (mode: 'EOT' | 'MIDTERM') => void;
  isReadOnlyMode: boolean;
  isHeadteacher: boolean;
  isFormTeacher: boolean;
  adminEditOverride: boolean;
  setAdminEditOverride: (override: boolean) => void;
  handleFinalize: () => void;
}

export function MasterSheetHeader({
  activeClass,
  selectedAcademicYearId,
  selectedTermView,
  setSelectedTermView,
  mode,
  setMode,
  isReadOnlyMode,
  isHeadteacher,
  isFormTeacher,
  adminEditOverride,
  setAdminEditOverride,
  handleFinalize,
}: MasterSheetHeaderProps) {
  if (!activeClass) return null;

  return (
    <div className="space-y-4 max-w-full">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Master Sheet</h1>
            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold uppercase bg-red-100 text-red-900">
              {selectedTermView === 'ANNUAL' ? 'Annual Cumulative Overview' : `Term ${selectedTermView.slice(1)} Overview`}
            </span>
            {isReadOnlyMode && (
              <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                <Lock className="w-3 h-3" />
                Read-Only Term Lock
              </span>
            )}
          </div>
          <p className="text-xs font-semibold text-slate-600 mt-1">
            {activeClass.name} · Academic Year: {selectedAcademicYearId} · Form Teacher:{' '}
            {activeClass.settings.teacherName || 'Assigned Form Teacher'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5 items-center">
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
            {(['T1', 'T2', 'T3', 'ANNUAL'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setSelectedTermView(v)}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                  selectedTermView === v
                    ? v === 'ANNUAL' ? 'bg-amber-600 text-white shadow-2xs' : 'bg-red-800 text-white shadow-2xs'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                {v === 'ANNUAL' ? 'Annual Cumulative' : `Term ${v.slice(1)}`}
              </button>
            ))}
          </div>

          <select
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600 transition-all"
            value={mode}
            onChange={(e) => setMode(e.target.value as 'EOT' | 'MIDTERM')}
          >
            <option value="EOT">EOT Report Mode</option>
            <option value="MIDTERM">Midterm Report Mode</option>
          </select>

          {isHeadteacher && selectedTermView !== 'ANNUAL' && (
            <button
              onClick={() => setAdminEditOverride(!adminEditOverride)}
              className={`rounded-lg px-3 py-2 text-xs font-bold transition-all shadow-2xs border ${
                adminEditOverride
                  ? 'bg-emerald-700 text-white border-emerald-800 hover:bg-emerald-800'
                  : 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
              }`}
            >
              {adminEditOverride ? 'Admin Edit Mode Enabled' : 'Enable Edit Mode (Admin)'}
            </button>
          )}

          <button
            onClick={handleFinalize}
            disabled={!isFormTeacher || isReadOnlyMode}
            className="rounded-lg bg-red-800 text-white px-4 py-2 text-xs font-bold hover:bg-red-900 focus:outline-none focus:ring-2 focus:ring-red-600 transition-all shadow-2xs disabled:opacity-50 flex items-center gap-2"
          >
            <CheckCircle className="h-4 w-4" />
            <span>Finalize Stream Reports</span>
          </button>
        </div>
      </div>

      {isReadOnlyMode && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-900 font-semibold flex items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-amber-700 flex-shrink-0" />
            <span>
              {selectedTermView === 'ANNUAL'
                ? 'Annual Cumulative Sheet is a read-only combined view calculated across published terms.'
                : `Historical Term Read-Only Lock: Viewing ${selectedAcademicYearId} ${selectedTermView}. Score inputs and remarks are locked for teachers.`}
            </span>
          </div>
          {isHeadteacher && (
            <span className="text-[11px] font-bold text-amber-800 bg-amber-200/60 px-2 py-0.5 rounded">
              Headteacher Override Available
            </span>
          )}
        </div>
      )}
    </div>
  );
}
