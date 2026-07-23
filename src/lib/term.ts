/**
 * Parse SAIS term/year strings from Class Settings.
 * Examples: "2025/2026 — Term 3", "Term: TWO (2)", "Term THREE (3)"
 */
export function detectTermNumber(termYearInfo: string): 1 | 2 | 3 | null {
  const s = (termYearInfo || '').toUpperCase();

  if (/\b(TERM\s*)?3\b/.test(s) || /\bTHREE\b/.test(s) || /\(3\)/.test(s)) return 3;
  if (/\b(TERM\s*)?2\b/.test(s) || /\bTWO\b/.test(s) || /\(2\)/.test(s)) return 2;
  if (/\b(TERM\s*)?1\b/.test(s) || /\bONE\b/.test(s) || /\(1\)/.test(s)) return 1;

  const m = s.match(/TERM[:\s—-]*([123])/);
  if (m) return Number(m[1]) as 1 | 2 | 3;

  return null;
}

/** Project Work appears on EOT reports only in Term 3 */
export function shouldIncludeProjectWork(termYearInfo: string): boolean {
  return detectTermNumber(termYearInfo) === 3;
}

export function parseYearTerm(termYearInfo: string) {
  const yearMatch = termYearInfo.match(/(\d{4}\s*\/\s*\d{4})/);
  const termMatch = termYearInfo.match(/Term[:\s—-]+(.+)/i);
  const termNum = detectTermNumber(termYearInfo);
  const termLabel =
    termMatch?.[1]?.trim() ||
    (termNum === 1 ? 'ONE (1)' : termNum === 2 ? 'TWO (2)' : termNum === 3 ? 'THREE (3)' : termYearInfo);

  return {
    year: yearMatch?.[1]?.replace(/\s+/g, ' / ') || termYearInfo,
    term: termLabel,
    termNumber: termNum,
  };
}
