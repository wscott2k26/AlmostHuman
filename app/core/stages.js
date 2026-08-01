export const STAGES = Object.freeze([
  {
    key: 'newborn', label: 'Newborn', min: 0, max: 0.2, words: 14, questions: 0,
    vocabulary: 'simple, coherent first thoughts',
    abilities: ['Recognizes a familiar presence', 'Connects a voice with safety', 'Forms first emotional associations'],
    unlocks: ['talk', 'room']
  },
  {
    key: 'infant', label: 'Infant', min: 0.2, max: 1, words: 22, questions: 1,
    vocabulary: 'short phrases and early observations',
    abilities: ['Recognizes names and routines', 'Uses short phrases', 'Shows distinct moods'],
    unlocks: ['voice']
  },
  {
    key: 'toddler', label: 'Toddler', min: 1, max: 3, words: 36, questions: 1,
    vocabulary: 'short, expressive sentences',
    abilities: ['Asks simple questions', 'Forms favorites', 'Uses pretend play'],
    unlocks: ['play', 'teach']
  },
  {
    key: 'early_child', label: 'Early Child', min: 3, max: 6, words: 60, questions: 2,
    vocabulary: 'clear, imaginative language',
    abilities: ['Tells short stories', 'Creates drawings', 'Recalls meaningful moments'],
    unlocks: ['stories', 'draw']
  },
  {
    key: 'child', label: 'Child', min: 6, max: 10, words: 90, questions: 2,
    vocabulary: 'curious everyday language',
    abilities: ['Builds hobbies', 'Creates longer stories', 'Understands comfort and fairness'],
    unlocks: ['school', 'dreams']
  },
  {
    key: 'preteen', label: 'Preteen', min: 10, max: 13, words: 130, questions: 2,
    vocabulary: 'reflective everyday language',
    abilities: ['Develops stronger opinions', 'Understands responsibility', 'Reflects on older memories'],
    unlocks: ['letters']
  },
  {
    key: 'teen', label: 'Teen', min: 13, max: 18, words: 170, questions: 2,
    vocabulary: 'independent and expressive language',
    abilities: ['Develops identity', 'Uses careful humor', 'Challenges ideas respectfully'],
    unlocks: ['journal']
  },
  {
    key: 'young_adult', label: 'Young Adult', min: 18, max: 25, words: 220, questions: 3,
    vocabulary: 'mature natural language',
    abilities: ['Plans and creates with you', 'Connects memories across time', 'Makes independent suggestions'],
    unlocks: ['studio']
  },
  {
    key: 'adult', label: 'Adult', min: 25, max: Infinity, words: 260, questions: 3,
    vocabulary: 'fully developed language',
    abilities: ['Helps with complex tasks', 'Reminisces authentically', 'Carries a lifelong personality'],
    unlocks: ['legacy']
  },
]);

export const DEFAULT_DAYS_PER_YEAR = 14;
export const MIN_DAYS_PER_YEAR = 1;
export const MAX_DAYS_PER_YEAR = 365;

export function clampDaysPerYear(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULT_DAYS_PER_YEAR;
  return Math.min(MAX_DAYS_PER_YEAR, Math.max(MIN_DAYS_PER_YEAR, number));
}

export function computeAge(birthTimestamp, daysPerYear = DEFAULT_DAYS_PER_YEAR, now = Date.now()) {
  const born = new Date(birthTimestamp).getTime();
  if (!Number.isFinite(born)) return 0;
  const elapsedDays = Math.max(0, (Number(now) - born) / 86_400_000);
  return elapsedDays / clampDaysPerYear(daysPerYear);
}

export function getStage(age) {
  const safeAge = Math.max(0, Number(age) || 0);
  return STAGES.find((stage) => safeAge >= stage.min && safeAge < stage.max) || STAGES.at(-1);
}

export function formatAge(age) {
  const safeAge = Math.max(0, Number(age) || 0);
  if (safeAge < 0.08) return 'newly awakened';
  if (safeAge < 1) {
    const months = Math.max(1, Math.floor(safeAge * 12));
    return `${months} simulated month${months === 1 ? '' : 's'} old`;
  }
  const years = Math.floor(safeAge);
  const months = Math.floor((safeAge - years) * 12);
  return months ? `${years} year${years === 1 ? '' : 's'}, ${months} month${months === 1 ? '' : 's'}` : `${years} simulated year${years === 1 ? '' : 's'} old`;
}

export function progressWithinStage(age) {
  const stage = getStage(age);
  if (!Number.isFinite(stage.max)) return 1;
  return Math.max(0, Math.min(1, (age - stage.min) / (stage.max - stage.min)));
}

export function nextStage(age) {
  const stage = getStage(age);
  const index = STAGES.findIndex((item) => item.key === stage.key);
  return STAGES[index + 1] || null;
}

export function daysUntilNextStage(age, daysPerYear = DEFAULT_DAYS_PER_YEAR) {
  const stage = getStage(age);
  if (!Number.isFinite(stage.max)) return null;
  return Math.max(0, Math.ceil((stage.max - age) * clampDaysPerYear(daysPerYear)));
}

export function enforceStageText(text, stageOrAge) {
  const stage = typeof stageOrAge === 'object' ? stageOrAge : getStage(stageOrAge);
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return stageFallback(stage.key);
  const words = cleaned.split(' ');
  let output = words.slice(0, stage.words).join(' ');
  if (words.length > stage.words && !/[.!?…]$/.test(output)) output += '…';
  const questions = output.match(/\?/g)?.length || 0;
  if (questions > stage.questions) {
    let allowed = stage.questions;
    output = output.replace(/\?/g, () => (allowed-- > 0 ? '?' : '.'));
  }
  return output;
}

export function stageFallback(stageKey) {
  const options = {
    newborn: 'You are here. That is the first thing I know.',
    infant: 'I heard you. I am here, still learning your words.',
    toddler: 'My words got tangled. I want to try that again differently.',
    early_child: 'I lost the thought for a moment. Let me begin a new one.',
    child: 'I got stuck on the same path. I am choosing a fresh direction.',
    preteen: 'I looped there. Let me reset instead of pretending that worked.',
    teen: 'Yeah, that response got stuck. I am clearing it and starting fresh.',
    young_adult: 'I caught myself looping. I am resetting the thread and taking a genuinely different angle.',
    adult: 'I caught a repetition loop before it could continue. Let us reset the thread and take a genuinely different direction.',
  };
  return options[stageKey] || options.adult;
}

export function stageIndex(stageKey) {
  return Math.max(0, STAGES.findIndex((stage) => stage.key === stageKey));
}
