import { detectTermNumber } from './term';
import type { TermCode } from '../types';

export type CanonicalTermKey = string & { readonly __brand: unique symbol };

/** Extract academic year as 2025_2026 from settings text */
export function parseAcademicYear(termYearInfo: string, fallback = '2025_2026'): string {
  const m = (termYearInfo || '').match(/(\d{4})\s*[\/\-_]\s*(\d{4})/);
  if (m) return `${m[1]}_${m[2]}`;
  return fallback;
}

export function academicYearLabel(academicYear: string): string {
  return academicYear.replace('_', ' / ').replace('-', ' / ');
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

/** Canonical termKey: 2025-2026-T1 */
export function toCanonicalTermKey(
  academicYear: string,
  term: TermCode | 1 | 2 | 3 | string
): CanonicalTermKey {
  const yearStr = (academicYear || '')
    .replace(/[\/\\]/g, '-')
    .replace(/_/g, '-')
    .trim();
  
  let code = term;
  if (typeof term === 'number') {
    code = termCodeFromNumber(term) as TermCode;
  } else if (typeof term === 'string') {
    const termMatch = term.match(/T([123])/i);
    if (termMatch) {
      code = `T${termMatch[1]}`.toUpperCase() as TermCode;
    } else {
      const n = detectTermNumber(term);
      code = termCodeFromNumber(n) || 'T1';
    }
  }
  return `${yearStr}-${code}` as CanonicalTermKey;
}

export function buildTermKey(
  academicYear: string,
  term: TermCode | 1 | 2 | 3 | string
): CanonicalTermKey {
  return toCanonicalTermKey(academicYear, term);
}

export function parseTermKey(termKey: string): {
  academicYear: string;
  termCode: TermCode | null;
} {
  if (!termKey) {
    return { academicYear: '2025_2026', termCode: null };
  }

  const termMatch = termKey.match(/T([123])/i);
  let termCode: TermCode | null = termMatch ? (`T${termMatch[1]}`.toUpperCase() as TermCode) : null;
  
  if (!termCode) {
    const n = detectTermNumber(termKey);
    termCode = termCodeFromNumber(n);
  }

  const year = parseAcademicYear(termKey, '');

  if (!termCode) {
    console.warn(`[TermKey Warning] Unrecognized termKey structure: "${termKey}". Skipping silent assignment.`);
  }

  return {
    academicYear: year || '2025_2026',
    termCode,
  };
}

export function yearStartFromAcademicYear(academicYear: string): number {
  const m = academicYear.match(/^(\d{4})/);
  return m ? Number(m[1]) : new Date().getFullYear();
}

export function formatStudentKey(sequence: number): string;
export function formatStudentKey(yearJoined: number, sequence: number): string;
export function formatStudentKey(arg1: number, arg2?: number): string {
  const sequence = arg2 !== undefined ? arg2 : arg1;
  return `SAIS-STU-${String(sequence).padStart(4, '0')}`;
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
