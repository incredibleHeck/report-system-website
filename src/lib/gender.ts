export function normalizeGender(gender: unknown, fallback: 'Male' | 'Female' | 'Unknown' = 'Unknown') {
  if (!gender) return fallback;
  const normalized = String(gender).trim().toUpperCase();
  if (normalized.startsWith('M')) return 'Male' as const;
  if (normalized.startsWith('F')) return 'Female' as const;
  return fallback;
}

export function pronounsFor(gender: string) {
  const g = normalizeGender(gender);
  if (g === 'Male') return { subject: 'he', object: 'him', possessive: 'his', reflexive: 'himself' };
  if (g === 'Female') return { subject: 'she', object: 'her', possessive: 'her', reflexive: 'herself' };
  return { subject: 'they', object: 'them', possessive: 'their', reflexive: 'themselves' };
}

/** Extract display first name respecting LAST_FIRST default */
export function firstName(fullName: string, format: 'LAST_FIRST' | 'FIRST_LAST' = 'LAST_FIRST') {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fullName;
  if (format === 'FIRST_LAST') return parts[0];
  // LAST FIRST ... → last token often first name in SAIS samples; prefer second token if present
  if (parts.length === 1) return parts[0];
  return parts[parts.length - 1];
}
