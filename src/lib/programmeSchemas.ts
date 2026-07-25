import type { Programme, SubjectDefinition } from '../types';
import { shouldIncludeProjectWork } from './term';

const primarySubjects: SubjectDefinition[] = [
  { code: 'ENG', name: 'English', kind: 'scored', abbr: 'ENG' },
  { code: 'MATH', name: 'Mathematics', kind: 'scored', abbr: 'MATH' },
  { code: 'SCI', name: 'Science', kind: 'scored', abbr: 'SCI' },
  { code: 'BK', name: 'Bible Knowledge', kind: 'scored', abbr: 'BK' },
  { code: 'FRE', name: 'French', kind: 'scored', abbr: 'FRE' },
  { code: 'HUM', name: 'Humanities', kind: 'scored', abbr: 'HUM.' },
  { code: 'ICT', name: 'Computing', kind: 'scored', abbr: 'ICT' },
  { code: 'MUSIC', name: 'Music', kind: 'scoreOnly', abbr: 'MUSIC' },
  { code: 'PROJ', name: 'Project Work', kind: 'scoreOnly', abbr: 'PROJ' },
  { code: 'PE', name: 'Physical Education', kind: 'commentOnly', abbr: 'PE' },
];

const lowerSecondarySubjects: SubjectDefinition[] = [
  { code: 'BIO', name: 'Biology', kind: 'scored', abbr: 'BIO' },
  { code: 'CHEM', name: 'Chemistry', kind: 'scored', abbr: 'CHEM' },
  { code: 'ICT', name: 'Computing', kind: 'scored', abbr: 'ICT' },
  { code: 'ENG', name: 'English', kind: 'scored', abbr: 'ENG' },
  { code: 'FRE', name: 'French', kind: 'scored', abbr: 'FRE' },
  { code: 'GEO', name: 'Geography', kind: 'scored', abbr: 'GEO' },
  { code: 'HIST', name: 'History', kind: 'scored', abbr: 'HIST' },
  { code: 'LIT', name: 'Literature', kind: 'scored', abbr: 'LIT' },
  { code: 'MATH', name: 'Mathematics', kind: 'scored', abbr: 'MATH' },
  { code: 'PHY', name: 'Physics', kind: 'scored', abbr: 'PHY' },
  { code: 'PROJ', name: 'Project Work', kind: 'scoreOnly', abbr: 'PROJ' },
  { code: 'PE', name: 'Physical Education', kind: 'commentOnly', abbr: 'PE' },
  { code: 'CLUB', name: 'Clubs', kind: 'commentOnly', abbr: 'CLUB' },
];

const upperSecondarySubjects: SubjectDefinition[] = [];

export const PROGRAMME_SCHEMAS: Record<
  Programme,
  {
    subjects: SubjectDefinition[];
    hasMusic: boolean;
    reportOutOf: number;
  }
> = {
  PRIMARY: {
    subjects: primarySubjects,
    hasMusic: true,
    reportOutOf: 700,
  },
  LOWER_SECONDARY: {
    subjects: lowerSecondarySubjects,
    hasMusic: false,
    reportOutOf: 1000,
  },
  UPPER_SECONDARY: {
    subjects: upperSecondarySubjects,
    hasMusic: false,
    reportOutOf: 0,
  },
};

export function getSubjectsForProgramme(
  programme: Programme,
  showProjectWork = true
): SubjectDefinition[] {
  const subjects = PROGRAMME_SCHEMAS[programme].subjects;
  if (showProjectWork) return subjects;
  return subjects.filter((s) => s.code !== 'PROJ');
}

/** Subjects for a class report — Project Work only when Term 3 */
export function getSubjectsForTerm(programme: Programme, termYearInfo: string) {
  return getSubjectsForProgramme(programme, shouldIncludeProjectWork(termYearInfo));
}

/** Core academic subjects that contribute to Raw Score / Out of (excludes Music, Project, PE, Club) */
export function getCoreScoredSubjects(programme: Programme) {
  return PROGRAMME_SCHEMAS[programme].subjects.filter((s) => s.kind === 'scored');
}

export function getReportOutOf(programme: Programme) {
  return getCoreScoredSubjects(programme).length * 100;
}

export function getScoredSubjects(programme: Programme, showProjectWork = true) {
  return getSubjectsForProgramme(programme, showProjectWork).filter(
    (s) => s.kind === 'scored' || s.kind === 'scoreOnly'
  );
}

export function getSubjectByCode(programme: Programme, code: string) {
  return PROGRAMME_SCHEMAS[programme].subjects.find((s) => s.code === code);
}

/** Master list of predefined clubs */
export const AVAILABLE_CLUBS = [
  'Arts',
  'Beading',
  'Bible',
  'Cadet',
  'Coding',
  'Dancing',
  'Drama',
  'Engineering',
  'French',
  'Girls Guide',
  'Reading',
  'Regimental',
  'Taekwondo',
  'Photography',
  'Table Tennis',
];

export function isClubSubject(code: string): boolean {
  const normalized = (code || '').toUpperCase();
  return normalized === 'CLUB' || normalized === 'CLUBS';
}

export function isNonAcademicSubject(code: string, kind?: SubjectKind): boolean {
  if (isClubSubject(code)) return false;
  const normalized = (code || '').toUpperCase();
  return (
    normalized === 'PE' ||
    normalized === 'MUSIC' ||
    normalized === 'PROJ' ||
    kind === 'scoreOnly' ||
    kind === 'commentOnly'
  );
}

export function isAcademicSubject(code: string, kind?: SubjectKind): boolean {
  return !isClubSubject(code) && !isNonAcademicSubject(code, kind);
}

/** Master list of deduplicated, normalized subjects across all programmes */
export function getAllUniqueSubjects(): { code: string; name: string }[] {
  const map = new Map<string, { code: string; name: string }>();
  const allDefs = [...primarySubjects, ...lowerSecondarySubjects];

  for (const s of allDefs) {
    let normalizedName = s.name;
    let normalizedCode = s.code;

    if (normalizedName === 'Computing (ICT)') {
      normalizedName = 'Computing';
      normalizedCode = 'ICT';
    } else if (normalizedName === 'Project (PROJ)' || normalizedName === 'Project Work') {
      normalizedName = 'Project Work';
      normalizedCode = 'PROJ';
    } else if (normalizedName === 'Club' || normalizedName === 'Clubs') {
      normalizedName = 'Clubs';
      normalizedCode = 'CLUB';
    }

    if (!map.has(normalizedName)) {
      map.set(normalizedName, { code: normalizedCode, name: normalizedName });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}
