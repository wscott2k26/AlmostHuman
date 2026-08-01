import { normalizeOrigin10 } from './origin10.js';
import { normalizePublicVoiceId10, normalizeVoiceProfile10 } from './voiceProfile10.js';

export const APPEARANCE_FIELDS_10 = Object.freeze([
  'skinTone','skinUndertone','faceShape','eyeShape','eyeColor',
  'browShape','browWeight','hairStyle','hairTexture','hairColor',
  'facialHair','bodySilhouette','styleDirection',
]);

export const APPEARANCE_OPTIONS_10 = deepFreeze({
  skinTone: ['porcelain','light','warm','golden','olive','brown','deep','ebony'],
  skinUndertone: ['cool','neutral','warm'],
  faceShape: ['oval','round','square','heart','diamond','long'],
  eyeShape: ['almond','round','hooded','upturned','downturned','wide'],
  eyeColor: ['brown','amber','hazel','green','blue','gray','violet'],
  browShape: ['soft','straight','arched','angled','rounded'],
  browWeight: ['light','medium','bold'],
  hairStyle: ['none','short','waves','curls','locs','braids','coils','long','updo'],
  hairTexture: ['none','straight','wavy','curly','coily','locs','braids'],
  hairColor: ['midnight','black','brown','auburn','copper','blonde','silver','white','rose','violet','blue'],
  facialHair: ['none','shadow','mustache','goatee','short-beard','full-beard'],
  bodySilhouette: ['slender','balanced','soft','athletic','broad'],
  styleDirection: ['comfort','street','classic','creative','futuristic','nature','minimal','mystical'],
});

const DEFAULT_APPEARANCE_10 = Object.freeze({
  skinTone: 'warm', skinUndertone: 'neutral', faceShape: 'oval', eyeShape: 'almond', eyeColor: 'brown',
  browShape: 'soft', browWeight: 'medium', hairStyle: 'waves', hairTexture: 'wavy', hairColor: 'midnight',
  facialHair: 'none', bodySilhouette: 'balanced', styleDirection: 'minimal',
});

const PRESET_INPUTS = Object.freeze([
  { id: 'ember-atelier', label: 'Ember Atelier', profile: { skinTone:'warm',skinUndertone:'warm',faceShape:'oval',eyeShape:'almond',eyeColor:'brown',browShape:'soft',browWeight:'medium',hairStyle:'waves',hairTexture:'wavy',hairColor:'midnight',facialHair:'none',bodySilhouette:'balanced',styleDirection:'creative' } },
  { id: 'golden-current', label: 'Golden Current', profile: { skinTone:'golden',skinUndertone:'warm',faceShape:'heart',eyeShape:'upturned',eyeColor:'green',browShape:'arched',browWeight:'medium',hairStyle:'short',hairTexture:'straight',hairColor:'brown',facialHair:'none',bodySilhouette:'athletic',styleDirection:'futuristic' } },
  { id: 'deep-orbit', label: 'Deep Orbit', profile: { skinTone:'deep',skinUndertone:'neutral',faceShape:'square',eyeShape:'hooded',eyeColor:'brown',browShape:'straight',browWeight:'bold',hairStyle:'locs',hairTexture:'locs',hairColor:'midnight',facialHair:'shadow',bodySilhouette:'broad',styleDirection:'street' } },
  { id: 'silver-grove', label: 'Silver Grove', profile: { skinTone:'light',skinUndertone:'cool',faceShape:'round',eyeShape:'wide',eyeColor:'blue',browShape:'rounded',browWeight:'light',hairStyle:'curls',hairTexture:'curly',hairColor:'silver',facialHair:'none',bodySilhouette:'soft',styleDirection:'nature' } },
  { id: 'violet-muse', label: 'Violet Muse', profile: { skinTone:'brown',skinUndertone:'warm',faceShape:'diamond',eyeShape:'downturned',eyeColor:'violet',browShape:'angled',browWeight:'medium',hairStyle:'braids',hairTexture:'braids',hairColor:'violet',facialHair:'none',bodySilhouette:'slender',styleDirection:'mystical' } },
  { id: 'classic-tide', label: 'Classic Tide', profile: { skinTone:'olive',skinUndertone:'neutral',faceShape:'long',eyeShape:'almond',eyeColor:'hazel',browShape:'straight',browWeight:'medium',hairStyle:'coils',hairTexture:'coily',hairColor:'black',facialHair:'short-beard',bodySilhouette:'balanced',styleDirection:'classic' } },
]);

export const APPEARANCE_PRESETS_10 = deepFreeze(PRESET_INPUTS.map((preset) => ({
  id: preset.id,
  label: preset.label,
  profile: normalizeAppearance10(preset.profile),
})));

export function normalizeAppearance10(value) {
  const input = value && typeof value === 'object' ? value : {};
  const output = {};
  for (const field of APPEARANCE_FIELDS_10) {
    let candidate = input[field];
    if (field === 'hairTexture' && !candidate) candidate = legacyHairTexture(input.hairStyle);
    output[field] = APPEARANCE_OPTIONS_10[field].includes(candidate) ? candidate : DEFAULT_APPEARANCE_10[field];
  }
  return output;
}

export function appearancePreset10(id) {
  const preset = APPEARANCE_PRESETS_10.find((item) => item.id === id) || APPEARANCE_PRESETS_10[0];
  return { id: preset.id, label: preset.label, profile: { ...preset.profile } };
}

export function compareAppearance10(before, after) {
  const left = normalizeAppearance10(before);
  const right = normalizeAppearance10(after);
  return APPEARANCE_FIELDS_10.filter((field) => left[field] !== right[field]);
}

export function createVisualSnapshot10(ai = {}, { id, reason = 'visual-change', capturedAt = null } = {}) {
  const voiceId = normalizePublicVoiceId10(ai.voiceProfile?.voiceId || ai.voiceId);
  return {
    id: String(id || `visual-${ai.id || 'unknown'}-${stableSnapshotSuffix(ai, reason)}`),
    aiEntityId: ai.id || null,
    reason: String(reason || 'visual-change'),
    rendererVersion: validRenderer(ai.rendererVersion),
    presentation: ['masculine','feminine','neutral'].includes(ai.presentation) ? ai.presentation : presentationFromPronouns(ai.pronouns),
    appearanceSeed: String(ai.appearanceSeed || 'ember'),
    originProfile: normalizeOrigin10(ai.originProfile),
    appearanceProfile: normalizeAppearance10(ai.appearanceProfile),
    voiceProfile: normalizeVoiceProfile10(ai.voiceProfile, voiceId),
    capturedAt: capturedAt || ai.updatedAt || ai.createdAt || null,
  };
}

function legacyHairTexture(style) {
  if (style === 'curls') return 'curly';
  if (style === 'locs') return 'locs';
  if (style === 'braids') return 'braids';
  if (style === 'coils') return 'coily';
  if (style === 'none') return 'none';
  if (style === 'short') return 'straight';
  return 'wavy';
}
function presentationFromPronouns(value) {
  if (value === 'she/her') return 'feminine';
  if (value === 'he/him') return 'masculine';
  return 'neutral';
}
function validRenderer(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 9 ? number : 9;
}
function stableSnapshotSuffix(ai, reason) {
  const input = `${ai.id || ''}:${reason}:${ai.rendererVersion || 9}:${ai.appearanceSeed || 'ember'}`;
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const item of Object.values(value)) deepFreeze(item);
  return value;
}
