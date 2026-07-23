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
  { code: 'CLUB', name: 'Club', kind: 'commentOnly', abbr: 'CLUB' },
];

const secondarySubjects: SubjectDefinition[] = [
  { code: 'ENG', name: 'English', kind: 'scored', abbr: 'ENG' },
  { code: 'LIT', name: 'Literature', kind: 'scored', abbr: 'LIT' },
  { code: 'MATH', name: 'Mathematics', kind: 'scored', abbr: 'MATH' },
  { code: 'BIO', name: 'Biology', kind: 'scored', abbr: 'BIO' },
  { code: 'CHEM', name: 'Chemistry', kind: 'scored', abbr: 'CHEM' },
  { code: 'PHY', name: 'Physics', kind: 'scored', abbr: 'PHY' },
  { code: 'ICT', name: 'Computing', kind: 'scored', abbr: 'ICT' },
  { code: 'GEO', name: 'Geography', kind: 'scored', abbr: 'GEO' },
  { code: 'HIST', name: 'History', kind: 'scored', abbr: 'HIST' },
  { code: 'FRE', name: 'French', kind: 'scored', abbr: 'FRE' },
  { code: 'PROJ', name: 'Project Work', kind: 'scoreOnly', abbr: 'PROJ' },
  { code: 'PE', name: 'Physical Education', kind: 'commentOnly', abbr: 'PE' },
  { code: 'CLUB', name: 'Club', kind: 'commentOnly', abbr: 'CLUB' },
];

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
  SECONDARY: {
    subjects: secondarySubjects,
    hasMusic: false,
    reportOutOf: 1000,
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
