/**
 * Parse SAIS term/year strings from Class Settings.
 * Examples: "2025/2026 — Term 3", "Term: TWO (2)", "Term THREE (3)", "2025-2026-T1"
 */
export function detectTermNumber(termYearInfo: string): 1 | 2 | 3 | null {
  const s = (termYearInfo || '').toUpperCase();

  if (s.includes('T3') || /\bTERM\s*3\b|\bTHREE\b|\(3\)/.test(s)) return 3;
  if (s.includes('T2') || /\bTERM\s*2\b|\bTWO\b|\(2\)/.test(s)) return 2;
  if (s.includes('T1') || /\bTERM\s*1\b|\bONE\b|\(1\)/.test(s)) return 1;

  const m = s.match(/TERM[:\s—-]*([123])/);
  if (m) return Number(m[1]) as 1 | 2 | 3;

  return null;
}

/** Project Work appears on EOT reports only in Term 3 */
export function shouldIncludeProjectWork(termYearInfo: string): boolean {
  return detectTermNumber(termYearInfo) === 3;
}

export function parseYearTerm(termYearInfo: string) {
  const yearMatch = termYearInfo.match(/(\d{4}\s*[\/\-_]\s*\d{4})/);
  const termMatch = termYearInfo.match(/Term[:\s—-]+(.+)/i);
  const termNum = detectTermNumber(termYearInfo);
  const termLabel =
    termMatch?.[1]?.trim() ||
    (termNum === 1 ? 'ONE (1)' : termNum === 2 ? 'TWO (2)' : termNum === 3 ? 'THREE (3)' : termYearInfo);

  return {
    year: yearMatch?.[1]?.replace(/[\-_]/g, ' / ') || termYearInfo,
    term: termLabel,
    termNumber: termNum,
  };
}

/**
 * Format raw date strings (e.g. "2026-07-02", "2025-09-13") into ordinal long format
 * Examples: "2nd July 2026", "13th September 2025", "1st December 2021"
 */
export function formatDateLong(dateStr?: string | null): string {
  if (!dateStr || !dateStr.trim() || dateStr === '—') return '—';
  const str = dateStr.trim();

  // If already formatted with ordinal suffix (e.g. "13th September 2025"), return as is
  if (/^\d{1,2}(st|nd|rd|th)\s+[A-Za-z]+\s+\d{4}$/i.test(str)) {
    return str;
  }

  let year: number;
  let monthIndex: number;
  let day: number;

  const ymdMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (ymdMatch) {
    year = parseInt(ymdMatch[1], 10);
    monthIndex = parseInt(ymdMatch[2], 10) - 1;
    day = parseInt(ymdMatch[3], 10);
  } else {
    const dmyMatch = str.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
    if (dmyMatch) {
      day = parseInt(dmyMatch[1], 10);
      const mName = dmyMatch[2].toLowerCase();
      year = parseInt(dmyMatch[3], 10);
      const monthNames = [
        'january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december'
      ];
      monthIndex = monthNames.findIndex((m) => m.startsWith(mName.slice(0, 3)));
      if (monthIndex === -1) monthIndex = 0;
    } else {
      const d = new Date(str);
      if (isNaN(d.getTime())) return str;
      year = d.getFullYear();
      monthIndex = d.getMonth();
      day = d.getDate();
    }
  }

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthName = months[monthIndex] || '';

  const getOrdinal = (n: number) => {
    if (n >= 11 && n <= 13) return `${n}th`;
    switch (n % 10) {
      case 1: return `${n}st`;
      case 2: return `${n}nd`;
      case 3: return `${n}rd`;
      default: return `${n}th`;
    }
  };

  return `${getOrdinal(day)} ${monthName} ${year}`;
}

/**
 * Format teacher signature name into structured vertical lines (title, first name, last name)
 * Example: "MR. HECTOR ARYIKU" -> ["MR.", "HECTOR", "ARYIKU"]
 */
export function formatSignatureName(name: string): string[] {
  if (!name || !name.trim()) return ['—'];
  const raw = name.trim();
  const tokens = raw.split(/\s+/);
  
  if (tokens.length === 1) {
    return [tokens[0]];
  }

  const titles = ['MR', 'MR.', 'MRS', 'MRS.', 'MS', 'MS.', 'DR', 'DR.', 'PROF', 'PROF.', 'REV', 'REV.', 'MADAM', 'MADAM.'];
  const firstUpper = tokens[0].toUpperCase();

  if (titles.includes(firstUpper)) {
    const title = tokens[0];
    const rest = tokens.slice(1);
    return [title, ...rest];
  }

  return tokens;
}

