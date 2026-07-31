
const VOCAL_PRAISE_PATTERNS = [
  /\byour (?:voice|tone|sound) (?:is|feels|sounds|seems) (?:so )?(?:warm|gentle|soft|beautiful|comforting|calm|lovely|sweet)\b/gi,
  /\bi (?:love|like) (?:hearing|the sound of) your voice\b/gi,
  /\byou sound (?:so )?(?:warm|gentle|soft|beautiful|comforting|calm|lovely|sweet)\b/gi,
  /\bthe (?:warmth|gentleness|softness) in your voice\b/gi,
];

export function vocalPraiseCount(value) {
  const text = String(value || '');
  let count = 0;
  for (const pattern of VOCAL_PRAISE_PATTERNS) {
    count += (text.match(pattern) || []).length;
    pattern.lastIndex = 0;
  }
  return count;
}

export function containsVocalPraise(value) {
  return vocalPraiseCount(value) > 0;
}

export function sanitizeVocalPraise(value) {
  const sentences = String(value || '').match(/[^.!?]+[.!?]?/g) || [];
  const kept = sentences.filter((sentence) => !containsVocalPraise(sentence)).map((sentence) => sentence.trim()).filter(Boolean);
  return kept.join(' ').replace(/\s+/g, ' ').trim();
}

const STOP_WORDS = new Set(['a','an','and','are','as','at','be','but','by','for','from','had','has','have','he','her','his','i','in','is','it','me','my','of','on','or','our','she','so','that','the','their','them','there','they','this','to','was','we','were','what','when','where','who','why','will','with','you','your']);

export function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9?\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function fingerprint(value) {
  return [...new Set(normalizeText(value).split(' ').filter((token) => token.length > 1 && !STOP_WORDS.has(token)))];
}

export function similarity(a, b) {
  const left = new Set(fingerprint(a));
  const right = new Set(fingerprint(b));
  if (!left.size && !right.size) return normalizeText(a) === normalizeText(b) ? 1 : 0;
  const intersection = [...left].filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  return union ? intersection / union : 0;
}

export function extractQuestions(value) {
  const text = String(value || '');
  const matches = text.match(/[^.!?]*\?/g) || [];
  return matches.map((question) => normalizeText(question)).filter(Boolean);
}

export function isConfusionSignal(value) {
  const text = normalizeText(value).replace(/\?/g, '');
  return ['huh','what','what do you mean','i dont get it','confused','say that again','come again'].includes(text);
}

export function isBoundarySignal(value) {
  const text = normalizeText(value).replace(/\?/g, '');
  return /^(stop|enough|change the subject|new topic|dont ask|do not ask|leave it|drop it|move on)/.test(text);
}

export function isRepetitionComplaint(value) {
  const text = normalizeText(value);
  return /(repeat|same question|already told|asked me that|stuck|loop|keep asking)/.test(text);
}

export function inspectCandidate(candidate, history = [], options = {}) {
  const recent = history.slice(-30).filter(Boolean);
  const normalized = normalizeText(candidate);
  if (containsVocalPraise(candidate) && (vocalPraiseCount(candidate) > 1 || recent.some(containsVocalPraise))) return { ok: false, score: 0.9, reason: 'repeated_vocal_praise' };
  if (!normalized) return { ok: false, score: 1, reason: 'empty' };
  let highest = 0;
  let reason = null;
  for (const prior of recent) {
    if (normalizeText(prior) === normalized) return { ok: false, score: 1, reason: 'exact_duplicate' };
    const score = similarity(candidate, prior);
    if (score > highest) highest = score;
    if (score >= (options.threshold ?? 0.72)) reason = 'semantic_duplicate';
  }
  const priorQuestions = new Set(recent.flatMap(extractQuestions));
  const candidateQuestions = extractQuestions(candidate);
  if (candidateQuestions.some((question) => priorQuestions.has(question))) {
    return { ok: false, score: Math.max(highest, 0.92), reason: 'repeated_question' };
  }
  const opener = normalized.split(' ').slice(0, 5).join(' ');
  const repeatedOpeners = recent.filter((item) => normalizeText(item).startsWith(opener)).length;
  if (opener.split(' ').length >= 3 && repeatedOpeners >= 2) return { ok: false, score: Math.max(highest, 0.8), reason: 'repeated_opener' };
  return { ok: !reason, score: highest, reason };
}

export function chooseNonRepeating(candidates, history, seed = 0) {
  if (!Array.isArray(candidates) || !candidates.length) return '';
  const ordered = candidates.map((candidate, index) => ({ candidate, rank: Math.abs(hash(`${seed}:${candidate}:${index}`)) }))
    .sort((a, b) => a.rank - b.rank);
  for (const { candidate } of ordered) {
    if (inspectCandidate(candidate, history).ok) return candidate;
  }
  return ordered[0].candidate;
}

export function hash(value) {
  let result = 2166136261;
  for (const character of String(value)) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}
