const VOICE_STAGES_10 = Object.freeze([
  { maxAge: 0.2, label: 'Newborn' },
  { maxAge: 1, label: 'Infant' },
  { maxAge: 3, label: 'Toddler' },
  { maxAge: 6, label: 'Early Child' },
  { maxAge: 10, label: 'Child' },
  { maxAge: 13, label: 'Preteen' },
  { maxAge: 18, label: 'Teen' },
  { maxAge: 25, label: 'Young Adult' },
  { maxAge: Number.POSITIVE_INFINITY, label: 'Adult' },
]);

export function clampVoiceDaysPerYear10(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(1, Math.min(365, numeric)) : 14;
}

export function computeVoiceAge10(birthdayISO: unknown, daysPerYear = 14, now = Date.now()): number {
  const birthday = new Date(String(birthdayISO || '')).getTime();
  if (!Number.isFinite(birthday)) return 0;
  const elapsedDays = (Number(now) - birthday) / (1000 * 60 * 60 * 24);
  return Math.max(0, elapsedDays / clampVoiceDaysPerYear10(daysPerYear));
}

export function voiceStageLabel10(age: unknown): string {
  const numeric = Number(age);
  const safeAge = Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
  return VOICE_STAGES_10.find((stage) => safeAge < stage.maxAge)?.label || 'Adult';
}
