import { detectTermNumber } from './term';
import type { TermCode } from '../types';

/** Extract academic year as 2025_2026 from settings text */
export function parseAcademicYear(termYearInfo: string, fallback = '2025_2026'): string {
  const m = (termYearInfo || '').match(/(\d{4})\s*\/\s*(\d{4})/);
  if (m) return `${m[1]}_${m[2]}`;
  return fallback;
}

export function academicYearLabel(academicYear: string): string {
  return academicYear.replace('_', ' / ');
}

export function termCodeFromNumber(n: 1 | 2 | 3 | null): TermCode | null {
  if (n === 1) return 'T1';
  if (n === 2) return 'T2';
  if (n === 3) return 'T3';
  return null;
}

export function termNumberFromCode(code: TermCode): 1 | 2 | 3 {
  return code === 'T1' ? 1 : code === 'T2' ? 2 : 3;
}

/** Canonical termKey: 2025_2026_T1 */
export function buildTermKey(academicYear: string, term: TermCode | 1 | 2 | 3): string {
  const code =
    typeof term === 'number' ? (termCodeFromNumber(term) as TermCode) : term;
  return `${academicYear}_${code}`;
}

export function parseTermKey(termKey: string): {
  academicYear: string;
  termCode: TermCode | null;
} {
  const m = termKey.match(/^(\d{4}_\d{4})_(T[123])$/i);
  if (m) {
    return { academicYear: m[1], termCode: m[2].toUpperCase() as TermCode };
  }
  const year = parseAcademicYear(termKey, '');
  const n = detectTermNumber(termKey);
  return {
    academicYear: year || '2025_2026',
    termCode: termCodeFromNumber(n),
  };
}

export function yearStartFromAcademicYear(academicYear: string): number {
  const m = academicYear.match(/^(\d{4})/);
  return m ? Number(m[1]) : new Date().getFullYear();
}

export function formatStudentKey(yearJoined: number, sequence: number): string {
  return `SAIS-${yearJoined}-${String(sequence).padStart(4, '0')}`;
}

export const ALL_TERMS: TermCode[] = ['T1', 'T2', 'T3'];

export function termsFromJoin(start: TermCode): TermCode[] {
  const idx = ALL_TERMS.indexOf(start);
  return ALL_TERMS.slice(idx >= 0 ? idx : 0);
}

export function termsThroughLast(last: TermCode): TermCode[] {
  const idx = ALL_TERMS.indexOf(last);
  return ALL_TERMS.slice(0, (idx >= 0 ? idx : 0) + 1);
}
