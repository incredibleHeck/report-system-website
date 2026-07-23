/** Normalize Ghana phone numbers to Meta Graph format (233…) */
export function normalizeGhanaPhone(raw: string): { ok: boolean; e164: string; reason?: string } {
  if (!raw || !String(raw).trim()) {
    return { ok: false, e164: '', reason: 'INVALID FORMAT' };
  }
  let digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0') && digits.length === 10) {
    digits = `233${digits.slice(1)}`;
  }
  if (digits.startsWith('233') && digits.length === 12) {
    return { ok: true, e164: digits };
  }
  if (digits.length >= 10 && digits.length <= 15) {
    return { ok: true, e164: digits };
  }
  return { ok: false, e164: digits, reason: 'INVALID FORMAT' };
}
