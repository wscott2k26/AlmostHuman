import { AlmostHumanEngine } from '../core/engine.js';
import {
  APPEARANCE_OPTIONS_10,
  appearancePreset10,
  normalizeAppearance10,
} from '../core/appearance10.js';
import { normalizeOrigin10 } from '../core/origin10.js';
import { normalizeVoiceProfile10 } from '../core/voiceProfile10.js';

export const CREATOR_STEPS_10 = Object.freeze([
  'origin', 'identity', 'naming', 'appearance', 'style', 'voice', 'first-light',
]);

const PRESENTATIONS = Object.freeze(['masculine', 'feminine', 'neutral']);
const PRONOUNS = Object.freeze(['they/them', 'she/her', 'he/him']);

export function createCreatorState10(seed = {}) {
  const input = seed && typeof seed === 'object' ? seed : {};
  return {
    stepIndex: clampStep(input.stepIndex),
    caregiverName: clean(input.caregiverName, 40),
    name: clean(input.name, 28),
    nickname: clean(input.nickname, 28),
    presentation: PRESENTATIONS.includes(input.presentation) ? input.presentation : 'neutral',
    pronouns: PRONOUNS.includes(input.pronouns) ? input.pronouns : 'they/them',
    originProfile: normalizeOrigin10(input.originProfile),
    appearanceProfile: normalizeAppearance10(input.appearanceProfile || input.appearance),
    voiceProfile: normalizeVoiceProfile10(input.voiceProfile, input.voiceId),
    relationshipStyle: clean(input.relationshipStyle || 'lifelong_friend', 40) || 'lifelong_friend',
    acceptedSafety: Boolean(input.acceptedSafety),
    categoryHistory: normalizeHistory(input.categoryHistory),
    compareProfile: input.compareProfile ? normalizeAppearance10(input.compareProfile) : null,
  };
}

export function createCreatorModel10(state = {}, ui = {}) {
  const ai = state?.ai && !state.ai.archived ? state.ai : null;
  const creator = createCreatorState10(ui.creator || {});
  const stepIndex = clampStep(creator.stepIndex);
  return Object.freeze({
    bypass: Boolean(ai),
    ai,
    creator,
    steps: CREATOR_STEPS_10,
    stepIndex,
    stepKey: CREATOR_STEPS_10[stepIndex],
    progress: (stepIndex + 1) / CREATOR_STEPS_10.length,
    canAdvance: creatorCanAdvance10(creator, CREATOR_STEPS_10[stepIndex]),
  });
}

export function creatorCanAdvance10(value, stepKey = null) {
  const creator = createCreatorState10(value);
  const step = stepKey || CREATOR_STEPS_10[creator.stepIndex] || 'origin';
  if (step === 'naming') return Boolean(creator.name.trim());
  if (step === 'first-light') return Boolean(creator.name.trim() && creator.acceptedSafety);
  return CREATOR_STEPS_10.includes(step);
}

export function applyCreatorAction10(value, action = {}) {
  const creator = createCreatorState10(value);
  const type = String(action.type || '');

  if (type === 'set-field') {
    const field = String(action.field || '');
    if (field === 'presentation') return { ...creator, presentation: PRESENTATIONS.includes(action.value) ? action.value : creator.presentation };
    if (field === 'pronouns') return { ...creator, pronouns: PRONOUNS.includes(action.value) ? action.value : creator.pronouns };
    if (field === 'acceptedSafety') return { ...creator, acceptedSafety: Boolean(action.value) };
    if (['caregiverName', 'name', 'nickname', 'relationshipStyle'].includes(field)) {
      const max = field === 'relationshipStyle' ? 40 : field === 'caregiverName' ? 40 : 28;
      return { ...creator, [field]: clean(action.value, max) };
    }
    return creator;
  }

  if (type === 'set-origin') {
    return { ...creator, originProfile: normalizeOrigin10({ ...creator.originProfile, ...(action.value || {}) }) };
  }

  if (type === 'set-voice') {
    return { ...creator, voiceProfile: normalizeVoiceProfile10({ ...creator.voiceProfile, ...(action.value || {}) }, creator.voiceProfile.voiceId) };
  }

  if (type === 'choose-preset') {
    const preset = appearancePreset10(action.value);
    return {
      ...creator,
      appearanceProfile: preset.profile,
      categoryHistory: {},
      compareProfile: creator.appearanceProfile,
    };
  }

  if (type === 'select-appearance') return changeAppearanceField(creator, action.field, action.value);
  if (type === 'undo-category') return undoAppearanceField(creator, action.field);
  if (type === 'reset-category') return resetAppearanceField(creator, action.field);
  if (type === 'randomize-category') return randomizeAppearanceField(creator, action.field, action.seed);
  if (type === 'compare-start') return { ...creator, compareProfile: normalizeAppearance10(creator.appearanceProfile) };
  if (type === 'compare-end') return { ...creator, compareProfile: null };

  if (type === 'step-next') {
    const key = CREATOR_STEPS_10[creator.stepIndex];
    return creatorCanAdvance10(creator, key) ? { ...creator, stepIndex: clampStep(creator.stepIndex + 1) } : creator;
  }
  if (type === 'step-back') return { ...creator, stepIndex: clampStep(creator.stepIndex - 1) };
  if (type === 'set-step') return { ...creator, stepIndex: clampStep(action.value) };

  return creator;
}

export function finalizeCompanion10(draft, value, now = Date.now()) {
  if (!draft || typeof draft !== 'object') throw new Error('A writable state is required.');
  if (draft.ai && !draft.ai.archived) return { created: false, ai: draft.ai, conversation: draft.conversations?.[0] || null };
  const creator = createCreatorState10(value);
  if (!creator.name.trim()) throw new Error('Choose a companion name.');
  if (!creator.acceptedSafety) throw new Error('Confirm the AI experience before First Light.');

  const engine = new AlmostHumanEngine(draft);
  const completedAt = new Date(Number(now) || Date.now()).toISOString();
  const result = engine.awaken({
    name: creator.name,
    caregiverName: creator.caregiverName,
    pronouns: creator.pronouns,
    presentation: creator.presentation,
    appearanceProfile: creator.appearanceProfile,
    originProfile: { ...creator.originProfile, firstLightCompletedAt: completedAt },
    voiceProfile: creator.voiceProfile,
    relationshipStyle: creator.relationshipStyle,
    rendererVersion: 10,
  }, now);
  result.ai.nickname = creator.nickname || null;
  result.ai.rendererVersion = 10;
  result.ai.updatedAt = completedAt;
  draft.settings ||= {};
  draft.settings.tenUpgradeMomentDismissed = true;
  draft.settings.tenUpgradeMomentSeen = true;
  return { created: true, ...result };
}

function changeAppearanceField(creator, field, value) {
  const key = String(field || '');
  const options = APPEARANCE_OPTIONS_10[key];
  if (!options || !options.includes(value)) return creator;
  const previous = creator.appearanceProfile[key];
  if (previous === value) return creator;
  const stack = [...(creator.categoryHistory[key] || []), previous].slice(-20);
  return {
    ...creator,
    appearanceProfile: normalizeAppearance10({ ...creator.appearanceProfile, [key]: value }),
    categoryHistory: { ...creator.categoryHistory, [key]: stack },
  };
}

function undoAppearanceField(creator, field) {
  const key = String(field || '');
  const stack = [...(creator.categoryHistory[key] || [])];
  if (!APPEARANCE_OPTIONS_10[key] || !stack.length) return creator;
  const previous = stack.pop();
  return {
    ...creator,
    appearanceProfile: normalizeAppearance10({ ...creator.appearanceProfile, [key]: previous }),
    categoryHistory: { ...creator.categoryHistory, [key]: stack },
  };
}

function resetAppearanceField(creator, field) {
  const key = String(field || '');
  if (!APPEARANCE_OPTIONS_10[key]) return creator;
  const fallback = normalizeAppearance10({})[key];
  return changeAppearanceField(creator, key, fallback);
}

function randomizeAppearanceField(creator, field, seed = '') {
  const key = String(field || '');
  const options = APPEARANCE_OPTIONS_10[key];
  if (!options?.length) return creator;
  const current = creator.appearanceProfile[key];
  const start = stableIndex(`${seed}:${key}`, options.length);
  let next = options[start];
  if (next === current && options.length > 1) next = options[(start + 1) % options.length];
  return changeAppearanceField(creator, key, next);
}

function stableIndex(input, length) {
  let hash = 2166136261;
  for (const char of String(input || '')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % Math.max(1, length);
}

function normalizeHistory(value) {
  if (!value || typeof value !== 'object') return {};
  const output = {};
  for (const [field, entries] of Object.entries(value)) {
    if (!APPEARANCE_OPTIONS_10[field] || !Array.isArray(entries)) continue;
    output[field] = entries.filter((entry) => APPEARANCE_OPTIONS_10[field].includes(entry)).slice(-20);
  }
  return output;
}

function clampStep(value) {
  const number = Number(value);
  return Math.max(0, Math.min(CREATOR_STEPS_10.length - 1, Number.isFinite(number) ? Math.trunc(number) : 0));
}
function clean(value, max) { return String(value ?? '').trim().slice(0, max); }
