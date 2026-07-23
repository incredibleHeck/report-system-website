/**
 * Flat collection keys mirroring future Firestore collection paths.
 * Prefer these over nested student→scores trees.
 */
export const STORAGE_KEYS = {
  schools: 'sais_schools',
  users: 'sais_users',
  classes: 'sais_classes',
  lifelongStudents: 'sais_lifelongStudents',
  classEnrollments: 'sais_classEnrollments',
  scores: 'sais_scores',
  reportSummaries: 'sais_reportSummaries',
  contacts: 'sais_contacts',
  subjectContexts: 'sais_subject_contexts',
  bannedTokens: 'sais_banned_tokens',
  activeClass: 'sais_active_class',
  keySeq: 'sais_key_seq',
  legacyStudents: 'sais_students',
} as const;

/** Pre-Phase-0 key names — read once, then rewrite to STORAGE_KEYS */
export const LEGACY_STORAGE_KEYS: Partial<Record<string, string>> = {
  [STORAGE_KEYS.lifelongStudents]: 'sais_lifelong',
  [STORAGE_KEYS.classEnrollments]: 'sais_enrollments',
  [STORAGE_KEYS.reportSummaries]: 'sais_summaries',
};

/**
 * Alias used by DatabaseContext today.
 * Values already point at Firestore-shaped keys.
 */
export const KEYS = {
  schools: STORAGE_KEYS.schools,
  users: STORAGE_KEYS.users,
  classes: STORAGE_KEYS.classes,
  lifelong: STORAGE_KEYS.lifelongStudents,
  enrollments: STORAGE_KEYS.classEnrollments,
  scores: STORAGE_KEYS.scores,
  summaries: STORAGE_KEYS.reportSummaries,
  contacts: STORAGE_KEYS.contacts,
  subjectContexts: STORAGE_KEYS.subjectContexts,
  bannedTokens: STORAGE_KEYS.bannedTokens,
  activeClass: STORAGE_KEYS.activeClass,
  keySeq: STORAGE_KEYS.keySeq,
  legacyStudents: STORAGE_KEYS.legacyStudents,
} as const;
