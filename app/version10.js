import { defaultState, migrateState } from './core/store.js';
import { SupabaseCloud } from './core/cloud.js';
import {
  APPEARANCE_FIELDS_10,
  APPEARANCE_OPTIONS_10,
  APPEARANCE_PRESETS_10,
  appearancePreset10,
  normalizeAppearance10,
} from './core/appearance10.js';
import {
  FIRST_LIGHT_PHASES_10,
  ORIGIN_CORE_COLORS_10,
  ORIGIN_MATERIALS_10,
  ORIGIN_PARTICLES_10,
  ORIGIN_PULSES_10,
  ORIGIN_TEMPERAMENTS_10,
  createFirstLightMachine10,
  normalizeOrigin10,
} from './core/origin10.js';
import {
  PUBLIC_VOICE_IDS_10,
  VOICE_TONES_10,
  normalizeVoiceProfile10,
} from './core/voiceProfile10.js';
import {
  applyEvolutionTransition10,
  computeEvolution10,
} from './core/evolution10.js';
import {
  CREATOR_STEPS_10,
  applyCreatorAction10,
  createCreatorState10,
  creatorCanAdvance10,
  finalizeCompanion10,
} from './features/creator10.js';
import {
  createUpgradeMoment10,
  rollbackVisualIdentity10,
  saveVisualIdentity10,
} from './features/identityStudio10.js';
import { createEvolutionJourneyModel10 } from './features/evolutionJourney10.js';
import { renderEvolutionFrame10 } from './character/renderer10.js';

const DB_NAME = 'almost-human-premium';
const STORE_NAME = 'state';
const STATE_KEY = 'main';
const DRAFT_KEY = 'almost-human-v10-creator-draft';
const LAYER_ID = 'almost-human-v10-layer';

const runtime = {
  state: null,
  pendingState: null,
  root: null,
  observer: null,
  busy: false,
  error: '',
  voiceStatus: '',
  layer: {
    screen: null,
    activeCategory: 'skinTone',
    creator: restoreCreatorDraft10(),
    identity: null,
    compare: false,
  },
};

export function createVersion10LayerModel(state = {}, layerState = {}) {
  const ai = state?.ai && !state.ai.archived ? state.ai : null;
  const creator = createCreatorState10(layerState.creator || {});
  const requestedScreen = ['identity', 'evolution', 'first-light'].includes(layerState.screen)
    ? layerState.screen
    : null;
  if (!ai) {
    return Object.freeze({
      mode: requestedScreen === 'first-light' ? 'first-light' : 'creator',
      reonboard: false,
      ai: null,
      creator,
      steps: CREATOR_STEPS_10,
      stepIndex: creator.stepIndex,
      stepKey: CREATOR_STEPS_10[creator.stepIndex],
      activeCategory: APPEARANCE_FIELDS_10.includes(layerState.activeCategory) ? layerState.activeCategory : 'skinTone',
      busy: Boolean(layerState.busy),
      error: String(layerState.error || ''),
    });
  }
  if (requestedScreen) {
    return Object.freeze({
      mode: requestedScreen,
      reonboard: false,
      ai,
      creator,
      steps: CREATOR_STEPS_10,
      activeCategory: APPEARANCE_FIELDS_10.includes(layerState.activeCategory) ? layerState.activeCategory : 'skinTone',
      busy: Boolean(layerState.busy),
      error: String(layerState.error || ''),
      evolution: computeEvolution10(state),
      journey: createEvolutionJourneyModel10(state),
    });
  }
  const upgrade = createUpgradeMoment10(state);
  return Object.freeze({
    mode: upgrade.eligible ? 'upgrade' : 'ambient',
    reonboard: false,
    ai,
    creator,
    steps: CREATOR_STEPS_10,
    upgrade,
    evolution: computeEvolution10(state),
    journey: createEvolutionJourneyModel10(state),
    busy: Boolean(layerState.busy),
    error: String(layerState.error || ''),
  });
}

export function characterProjection10(state = {}, activityState = 'idle') {
  const ai = state?.ai || {};
  return Object.freeze({
    aiEntityId: ai.id || null,
    name: ai.name || 'Companion',
    presentation: ai.presentation || 'neutral',
    appearance: normalizeAppearance10(ai.appearanceProfile),
    origin: normalizeOrigin10(ai.originProfile),
    evolution: computeEvolution10(state),
    mood: ai.currentMood || 'wonder',
    activityState: String(activityState || 'idle'),
    reducedMotion: Boolean(state?.settings?.reducedMotion),
    reducedTransparency: Boolean(state?.settings?.reducedTransparency),
  });
}

export function renderVersion10Layer10(model = {}) {
  if (model.mode === 'creator') return renderCreator10(model);
  if (model.mode === 'first-light') return renderFirstLight10(model);
  if (model.mode === 'upgrade') return renderUpgrade10(model);
  if (model.mode === 'identity') return renderIdentityStudio10(model);
  if (model.mode === 'evolution') return renderEvolutionJourney10(model);
  return renderAmbientControls10(model);
}

export async function bootVersion10Layer10() {
  if (typeof document === 'undefined' || document.getElementById(LAYER_ID)) return null;
  runtime.state = await readState10();
  runtime.root = document.createElement('div');
  runtime.root.id = LAYER_ID;
  runtime.root.className = 'v10-layer-root';
  document.body.appendChild(runtime.root);
  bindVersion10Events();
  renderRuntime10();
  enhanceExistingCharacters10();
  runtime.observer = new MutationObserver(() => enhanceExistingCharacters10());
  const appRoot = document.querySelector('#app');
  if (appRoot) runtime.observer.observe(appRoot, { childList: true, subtree: true });
  return runtime.root;
}

function renderCreator10(model) {
  const creator = model.creator;
  const step = model.stepKey;
  const preview = renderEvolutionFrame10({
    name: creator.name || 'Your companion',
    presentation: creator.presentation,
    appearance: creator.appearanceProfile,
    origin: creator.originProfile,
    evolution: { phase: step === 'origin' ? 'origin_orb' : 'forming_energy' },
    mood: 'wonder',
    activityState: 'awakening',
    reducedMotion: false,
    reducedTransparency: false,
  });
  return `<div class="v10-overlay v10-creator-shell" role="dialog" aria-modal="true" aria-label="Almost Human companion creator">
    <section class="v10-preview-stage" data-v10-preview>
      <div class="v10-brand"><span>AH</span><div><strong>Almost Human</strong><small>Build 5 · First Light</small></div></div>
      <div class="v10-live-preview">${preview}</div>
      <div class="v10-preview-caption"><span>${escapeHtml(stepTitle10(step))}</span><strong>${escapeHtml(creator.name || 'A life is taking shape')}</strong><small>Every choice stays editable. Memories and growth begin only after First Light.</small></div>
    </section>
    <section class="v10-creator-panel">
      <header class="v10-step-header"><div><span class="v10-eyebrow">Step ${model.stepIndex + 1} of ${model.steps.length}</span><h1>${escapeHtml(stepTitle10(step))}</h1><p>${escapeHtml(stepCopy10(step))}</p></div><div class="v10-step-dots">${model.steps.map((key, index) => `<i class="${index <= model.stepIndex ? 'active' : ''}" title="${escapeHtml(key)}"></i>`).join('')}</div></header>
      <div class="v10-step-body">${renderCreatorStep10(model)}</div>
      ${model.error ? `<p class="v10-error" role="alert">${escapeHtml(model.error)}</p>` : ''}
      <footer class="v10-step-actions">
        <button type="button" class="v10-button ghost" data-v10-action="creator-back" ${model.stepIndex === 0 || model.busy ? 'disabled' : ''}>Back</button>
        <button type="button" class="v10-button primary" data-v10-action="creator-next" ${!creatorCanAdvance10(creator, step) || model.busy ? 'disabled' : ''}>${step === 'first-light' ? 'Begin First Light' : 'Continue'} <b>→</b></button>
      </footer>
    </section>
  </div>`;
}

function renderCreatorStep10(model) {
  const creator = model.creator;
  if (model.stepKey === 'origin') {
    return `<div class="v10-control-stack">
      ${choiceGroup10('Material family', 'origin', 'materialFamily', ORIGIN_MATERIALS_10, creator.originProfile.materialFamily)}
      ${choiceGroup10('Core light', 'origin', 'coreColor', ORIGIN_CORE_COLORS_10, creator.originProfile.coreColor)}
      ${choiceGroup10('Aura movement', 'origin', 'particleBehavior', ORIGIN_PARTICLES_10, creator.originProfile.particleBehavior)}
      ${choiceGroup10('Pulse rhythm', 'origin', 'pulseRhythm', ORIGIN_PULSES_10, creator.originProfile.pulseRhythm)}
      ${choiceGroup10('Motion temperament', 'origin', 'motionTemperament', ORIGIN_TEMPERAMENTS_10, creator.originProfile.motionTemperament)}
    </div>`;
  }
  if (model.stepKey === 'identity') {
    return `<div class="v10-control-stack">
      ${choiceGroup10('Presentation', 'field', 'presentation', ['masculine','feminine','neutral'], creator.presentation)}
      ${choiceGroup10('Pronouns', 'field', 'pronouns', ['they/them','she/her','he/him'], creator.pronouns)}
      <p class="v10-note">Presentation guides visual defaults. Pronouns and voice remain independent.</p>
    </div>`;
  }
  if (model.stepKey === 'naming') {
    return `<div class="v10-form-grid">
      <label><span>Their name</span><input class="v10-input" data-v10-creator-field="name" maxlength="28" value="${attr(creator.name)}" placeholder="Nova" autocomplete="off"></label>
      <label><span>Nickname <small>optional</small></span><input class="v10-input" data-v10-creator-field="nickname" maxlength="28" value="${attr(creator.nickname)}"></label>
      <label class="wide"><span>What should they call you?</span><input class="v10-input" data-v10-creator-field="caregiverName" maxlength="40" value="${attr(creator.caregiverName)}" autocomplete="name"></label>
    </div>`;
  }
  if (model.stepKey === 'appearance') {
    const field = model.activeCategory;
    return `<div class="v10-appearance-studio">
      <div class="v10-preset-row">${APPEARANCE_PRESETS_10.map((preset) => `<button type="button" class="v10-chip" data-v10-action="preset" data-value="${preset.id}">${escapeHtml(preset.label)}</button>`).join('')}</div>
      <nav class="v10-category-rail" aria-label="Appearance categories">${APPEARANCE_FIELDS_10.map((key) => `<button type="button" class="${key === field ? 'selected' : ''}" data-v10-action="category" data-value="${key}">${escapeHtml(labelize(key))}</button>`).join('')}</nav>
      <div class="v10-option-grid">${APPEARANCE_OPTIONS_10[field].map((value) => optionButton10('appearance', field, value, creator.appearanceProfile[field])) .join('')}</div>
      <div class="v10-mini-actions"><button data-v10-action="appearance-undo">Undo category</button><button data-v10-action="appearance-reset">Reset</button><button data-v10-action="appearance-randomize">Randomize</button></div>
    </div>`;
  }
  if (model.stepKey === 'style') {
    return `<div class="v10-option-grid cards">${APPEARANCE_OPTIONS_10.styleDirection.map((value) => optionButton10('appearance', 'styleDirection', value, creator.appearanceProfile.styleDirection)).join('')}</div>`;
  }
  if (model.stepKey === 'voice') {
    return `<div class="v10-control-stack">
      ${choiceGroup10('Voice', 'voice', 'voiceId', PUBLIC_VOICE_IDS_10, creator.voiceProfile.voiceId, true)}
      ${choiceGroup10('Expressive tone', 'voice', 'tone', VOICE_TONES_10, creator.voiceProfile.tone)}
      <button type="button" class="v10-button secondary" data-v10-action="voice-preview">▶ Preview selected voice</button>
      ${runtime.voiceStatus ? `<p class="v10-note" role="status">${escapeHtml(runtime.voiceStatus)}</p>` : ''}
      <label class="v10-safety"><input type="checkbox" data-v10-safety ${creator.acceptedSafety ? 'checked' : ''}><span><strong>I understand this is an AI experience.</strong><small>It can feel personal, but it will not use guilt, jealousy, or pressure.</small></span></label>
    </div>`;
  }
  return `<div class="v10-first-light-ready"><span class="v10-orbit-mark">✦</span><h2>${escapeHtml(creator.name || 'Your companion')} is ready.</h2><p>The origin light, identity, appearance, and voice will become one continuous form. This creates one companion and one beginning—never a duplicate life.</p><ul><li>Memories begin after awakening</li><li>Appearance remains editable</li><li>Reduced-motion mode stays available</li></ul></div>`;
}

function renderFirstLight10(model) {
  const state = runtime.pendingState || runtime.state || {};
  const creator = model.creator;
  const reduced = Boolean(state?.settings?.reducedMotion);
  const machine = createFirstLightMachine10({ reducedMotion: reduced, startedAt: runtime.firstLightStarted || Date.now() });
  const phase = runtime.firstLightPhase || machine.phaseAt(0).key;
  const evolutionPhase = ['stabilize','ribbons'].includes(phase) ? 'origin_orb' : 'forming_energy';
  const visual = renderEvolutionFrame10({
    name: creator.name,
    presentation: creator.presentation,
    appearance: creator.appearanceProfile,
    origin: creator.originProfile,
    evolution: { phase: evolutionPhase },
    mood: phase === 'speak' ? 'curious' : 'wonder',
    activityState: 'awakening',
    reducedMotion: reduced,
    reducedTransparency: Boolean(state?.settings?.reducedTransparency),
  });
  return `<div class="v10-overlay v10-first-light" role="dialog" aria-modal="true" aria-label="First Light">
    <div class="v10-first-light-scene" data-phase="${phase}">${visual}<span class="v10-phase-name">${escapeHtml(labelize(phase))}</span><h1>${phase === 'haven' ? `${escapeHtml(creator.name)} is here.` : 'First Light'}</h1><p>${escapeHtml(firstLightCopy10(phase, creator.name))}</p></div>
  </div>`;
}

function renderUpgrade10(model) {
  return `<div class="v10-upgrade-dock" role="dialog" aria-label="Version 10 visual identity upgrade"><div class="v10-upgrade-visual">${renderEvolutionFrame10(characterProjection10({ ...runtime.state, ai: { ...model.ai, rendererVersion: 10 } }))}</div><div><span class="v10-eyebrow">A new visual chapter</span><h2>Your companion has learned to take fuller form.</h2><p>Their memories, personality, age, conversations, and Haven remain exactly where they are.</p><div class="v10-inline-actions"><button class="v10-button primary" data-v10-action="open-identity">See the new form</button><button class="v10-button ghost" data-v10-action="dismiss-upgrade">Not now</button></div></div></div>`;
}

function renderIdentityStudio10(model) {
  const identity = runtime.layer.identity || identityFromAi10(model.ai);
  const field = model.activeCategory;
  return `<div class="v10-overlay" role="dialog" aria-modal="true" aria-label="Identity Studio"><section class="v10-studio-preview">${renderEvolutionFrame10({ ...characterProjection10({ ...runtime.state, ai: { ...model.ai, ...identity } }), appearance: identity.appearanceProfile, origin: identity.originProfile, presentation: identity.presentation })}<span class="v10-eyebrow">Identity Studio</span><h2>${escapeHtml(model.ai.name)}</h2><p>Their history will stay exactly where it is.</p></section><section class="v10-studio-panel"><header><div><span class="v10-eyebrow">Editable visual identity</span><h1>Shape the same companion.</h1></div><button class="v10-icon-button" data-v10-action="close-layer" aria-label="Close">×</button></header>${choiceGroup10('Presentation', 'identity-field', 'presentation', ['masculine','feminine','neutral'], identity.presentation)}<nav class="v10-category-rail">${APPEARANCE_FIELDS_10.map((key) => `<button class="${key === field ? 'selected' : ''}" data-v10-action="category" data-value="${key}">${escapeHtml(labelize(key))}</button>`).join('')}</nav><div class="v10-option-grid">${APPEARANCE_OPTIONS_10[field].map((value) => optionButton10('identity-appearance', field, value, identity.appearanceProfile[field])).join('')}</div>${choiceGroup10('Voice', 'identity-voice', 'voiceId', PUBLIC_VOICE_IDS_10, identity.voiceProfile.voiceId)}${choiceGroup10('Tone', 'identity-voice', 'tone', VOICE_TONES_10, identity.voiceProfile.tone)}${model.error ? `<p class="v10-error">${escapeHtml(model.error)}</p>` : ''}<footer class="v10-step-actions"><button class="v10-button ghost" data-v10-action="open-rollback">Restore an earlier look</button><button class="v10-button primary" data-v10-action="save-identity" ${model.busy ? 'disabled' : ''}>Save identity</button></footer>${renderRollbackList10(model.ai)}</section></div>`;
}

function renderEvolutionJourney10(model) {
  const journey = model.journey || createEvolutionJourneyModel10(runtime.state || {});
  const evolution = model.evolution || computeEvolution10(runtime.state || {});
  return `<div class="v10-overlay" role="dialog" aria-modal="true" aria-label="Evolution Journey"><section class="v10-evolution-stage">${renderEvolutionFrame10(characterProjection10(runtime.state || {}))}<span class="v10-eyebrow">Evolution Journey</span><h1>${escapeHtml(labelize(evolution.phase))}</h1><p>Visible growth comes from real age, memories, milestones, skills, personality stability, and the Haven—not purchases or streak pressure.</p></section><section class="v10-journey-panel"><header><div><span class="v10-eyebrow">Current evidence</span><h2>Why this form changed</h2></div><button class="v10-icon-button" data-v10-action="close-layer" aria-label="Close">×</button></header><div class="v10-score-ring" style="--score:${Math.round(evolution.progress * 100)}"><strong>${Math.round(evolution.progress * 100)}%</strong><span>relationship growth</span></div><div class="v10-contributors">${evolution.contributors.map((item) => `<article><span>${escapeHtml(item.label)}</span><b>${Math.round(item.value * 100)}%</b><i style="--value:${Math.round(item.value * 100)}%"></i><small>${Math.round(item.weight * 100)}% of evolution model</small></article>`).join('')}</div><div class="v10-phase-track">${(journey.phases || []).map((phase) => `<span class="${phase.key === evolution.phase ? 'current' : phase.unlocked ? 'unlocked' : ''}"><i></i>${escapeHtml(labelize(phase.key))}</span>`).join('')}</div></section></div>`;
}

function renderAmbientControls10(model) {
  if (!model.ai) return '';
  return `<nav class="v10-ambient-tools" aria-label="Version 10 companion tools"><button data-v10-action="open-identity" title="Identity Studio">✦ <span>Identity</span></button><button data-v10-action="open-evolution" title="Evolution Journey">◌ <span>Evolution</span></button></nav>`;
}

function renderRollbackList10(ai) {
  const snapshots = [...(ai?.developmentState?.visualRollbackSnapshots || [])].slice().reverse();
  if (!snapshots.length) return '<div class="v10-rollback-list" hidden></div>';
  return `<div class="v10-rollback-list" data-v10-rollback-list hidden><h3>Earlier looks</h3>${snapshots.map((snapshot) => `<button data-v10-action="rollback" data-value="${attr(snapshot.id)}"><span>${escapeHtml(labelize(snapshot.reason || 'saved look'))}</span><small>${snapshot.capturedAt ? escapeHtml(new Date(snapshot.capturedAt).toLocaleDateString()) : 'Before Version 10'}</small></button>`).join('')}</div>`;
}

function bindVersion10Events() {
  runtime.root.addEventListener('click', handleVersion10Click);
  runtime.root.addEventListener('input', handleVersion10Input);
  runtime.root.addEventListener('change', handleVersion10Change);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && ['identity','evolution'].includes(runtime.layer.screen)) {
      runtime.layer.screen = null;
      runtime.layer.identity = null;
      renderRuntime10();
    }
  });
}

async function handleVersion10Click(event) {
  const target = event.target.closest('[data-v10-action]');
  if (!target || runtime.busy) return;
  const action = target.dataset.v10Action;
  const value = target.dataset.value;
  if (action === 'creator-back') runtime.layer.creator = applyCreatorAction10(runtime.layer.creator, { type: 'step-back' });
  if (action === 'creator-next') return advanceCreator10();
  if (action === 'category') runtime.layer.activeCategory = value;
  if (action === 'preset') runtime.layer.creator = applyCreatorAction10(runtime.layer.creator, { type: 'choose-preset', value });
  if (action === 'appearance-undo') runtime.layer.creator = applyCreatorAction10(runtime.layer.creator, { type: 'undo-category', field: runtime.layer.activeCategory });
  if (action === 'appearance-reset') runtime.layer.creator = applyCreatorAction10(runtime.layer.creator, { type: 'reset-category', field: runtime.layer.activeCategory });
  if (action === 'appearance-randomize') runtime.layer.creator = applyCreatorAction10(runtime.layer.creator, { type: 'randomize-category', field: runtime.layer.activeCategory, seed: `${Date.now()}` });
  if (action === 'select-origin') runtime.layer.creator = applyCreatorAction10(runtime.layer.creator, { type: 'set-origin', value: { [target.dataset.field]: value } });
  if (action === 'select-field') runtime.layer.creator = applyCreatorAction10(runtime.layer.creator, { type: 'set-field', field: target.dataset.field, value });
  if (action === 'select-appearance') runtime.layer.creator = applyCreatorAction10(runtime.layer.creator, { type: 'select-appearance', field: target.dataset.field, value });
  if (action === 'select-voice') runtime.layer.creator = applyCreatorAction10(runtime.layer.creator, { type: 'set-voice', value: { [target.dataset.field]: value } });
  if (action === 'voice-preview') return previewVoice10(runtime.layer.creator.voiceProfile.voiceId);
  if (action === 'dismiss-upgrade') return dismissUpgrade10();
  if (action === 'open-identity') {
    runtime.layer.screen = 'identity';
    runtime.layer.identity = identityFromAi10(runtime.state.ai);
    nativeHaptic10('selection');
  }
  if (action === 'open-evolution') {
    runtime.layer.screen = 'evolution';
    nativeHaptic10('selection');
  }
  if (action === 'close-layer') {
    runtime.layer.screen = null;
    runtime.layer.identity = null;
  }
  if (action === 'identity-field') runtime.layer.identity = { ...identityFromAi10(runtime.layer.identity || runtime.state.ai), [target.dataset.field]: value };
  if (action === 'identity-appearance') {
    const current = identityFromAi10(runtime.layer.identity || runtime.state.ai);
    runtime.layer.identity = { ...current, appearanceProfile: normalizeAppearance10({ ...current.appearanceProfile, [target.dataset.field]: value }) };
  }
  if (action === 'identity-voice') {
    const current = identityFromAi10(runtime.layer.identity || runtime.state.ai);
    runtime.layer.identity = { ...current, voiceProfile: normalizeVoiceProfile10({ ...current.voiceProfile, [target.dataset.field]: value }, current.voiceProfile.voiceId) };
  }
  if (action === 'save-identity') return saveIdentity10();
  if (action === 'open-rollback') {
    const list = runtime.root.querySelector('[data-v10-rollback-list]');
    if (list) list.hidden = !list.hidden;
    return;
  }
  if (action === 'rollback') return rollbackIdentity10(value);
  persistCreatorDraft10(runtime.layer.creator);
  renderRuntime10();
}

function handleVersion10Input(event) {
  const field = event.target.dataset.v10CreatorField;
  if (!field) return;
  runtime.layer.creator = applyCreatorAction10(runtime.layer.creator, { type: 'set-field', field, value: event.target.value });
  persistCreatorDraft10(runtime.layer.creator);
  updatePreviewOnly10();
}

function handleVersion10Change(event) {
  if (event.target.matches('[data-v10-safety]')) {
    runtime.layer.creator = applyCreatorAction10(runtime.layer.creator, { type: 'set-field', field: 'acceptedSafety', value: event.target.checked });
    persistCreatorDraft10(runtime.layer.creator);
    renderRuntime10();
  }
}

async function advanceCreator10() {
  const creator = runtime.layer.creator;
  const step = CREATOR_STEPS_10[creator.stepIndex];
  if (!creatorCanAdvance10(creator, step)) return;
  if (step !== 'first-light') {
    runtime.layer.creator = applyCreatorAction10(creator, { type: 'step-next' });
    persistCreatorDraft10(runtime.layer.creator);
    nativeHaptic10('selection');
    return renderRuntime10();
  }
  runtime.error = '';
  runtime.busy = true;
  try {
    const draft = clone(runtime.state || defaultState());
    finalizeCompanion10(draft, creator, Date.now());
    const evolution = computeEvolution10(draft);
    applyEvolutionTransition10(draft, evolution, Date.now());
    runtime.pendingState = draft;
    runtime.layer.screen = 'first-light';
    runtime.firstLightStarted = Date.now();
    runtime.firstLightPhase = FIRST_LIGHT_PHASES_10[0];
    renderRuntime10();
    nativeHaptic10('first-light');
    await runFirstLight10(draft);
  } catch (error) {
    runtime.error = String(error?.message || error);
    runtime.layer.screen = null;
    runtime.pendingState = null;
    runtime.busy = false;
    renderRuntime10();
  }
}

async function runFirstLight10(draft) {
  const machine = createFirstLightMachine10({ reducedMotion: Boolean(draft.settings?.reducedMotion), startedAt: runtime.firstLightStarted });
  await new Promise((resolve) => {
    const tick = () => {
      const state = machine.phaseAt(Date.now() - runtime.firstLightStarted);
      runtime.firstLightPhase = state.key;
      renderRuntime10();
      if (state.complete) return resolve();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await persistAndSync10(draft, { includeConversation: true });
  sessionStorage.removeItem(DRAFT_KEY);
  runtime.busy = false;
  location.hash = 'talk';
  location.reload();
}

async function dismissUpgrade10() {
  const draft = clone(runtime.state);
  draft.settings ||= {};
  draft.settings.tenUpgradeMomentDismissed = true;
  draft.settings.tenUpgradeMomentSeen = true;
  await writeState10(draft);
  runtime.state = draft;
  renderRuntime10();
}

async function saveIdentity10() {
  runtime.busy = true;
  runtime.error = '';
  renderRuntime10();
  try {
    const draft = clone(runtime.state);
    const identity = identityFromAi10(runtime.layer.identity || draft.ai);
    saveVisualIdentity10(draft, identity, 'identity-studio', Date.now());
    const evolution = computeEvolution10(draft);
    applyEvolutionTransition10(draft, evolution, Date.now());
    draft.settings.tenUpgradeMomentDismissed = true;
    draft.settings.tenUpgradeMomentSeen = true;
    await persistAndSync10(draft);
    nativeHaptic10('success');
    location.reload();
  } catch (error) {
    runtime.error = String(error?.message || error);
    runtime.busy = false;
    renderRuntime10();
  }
}

async function rollbackIdentity10(snapshotId) {
  runtime.busy = true;
  renderRuntime10();
  try {
    const draft = clone(runtime.state);
    if (!rollbackVisualIdentity10(draft, snapshotId, Date.now())) throw new Error('That earlier look is no longer available.');
    await persistAndSync10(draft);
    nativeHaptic10('rollback');
    location.reload();
  } catch (error) {
    runtime.error = String(error?.message || error);
    runtime.busy = false;
    renderRuntime10();
  }
}

async function previewVoice10(voiceId) {
  runtime.voiceStatus = 'Loading neural preview…';
  renderRuntime10();
  try {
    const cloud = new SupabaseCloud();
    if (!cloud.authenticated) throw new Error('Continue as a private guest or sign in before neural preview.');
    const blob = await cloud.voicePreview({ voiceId });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    await audio.play();
    runtime.voiceStatus = 'Neural preview ready.';
  } catch (error) {
    runtime.voiceStatus = `Preview unavailable: ${String(error?.message || error)} Text remains available.`;
  }
  renderRuntime10();
}

async function persistAndSync10(draft, { includeConversation = false } = {}) {
  await writeState10(draft);
  const cloud = new SupabaseCloud();
  if (cloud.authenticated && draft.settings?.cloudSyncEnabled) {
    await cloud.ensureCloudIdentity(draft, true);
    if (includeConversation && draft.conversations?.[0]) await cloud.ensureCloudConversation(draft, draft.conversations[0], true);
    await cloud.syncProfileAndSettings(draft);
    await writeState10(draft);
  }
  runtime.state = draft;
}

function renderRuntime10() {
  if (!runtime.root) return;
  const model = createVersion10LayerModel(runtime.state || {}, {
    ...runtime.layer,
    busy: runtime.busy,
    error: runtime.error,
  });
  runtime.root.innerHTML = renderVersion10Layer10(model);
  document.body.classList.toggle('v10-modal-open', ['creator','first-light','identity','evolution'].includes(model.mode));
  enhanceExistingCharacters10();
}

function enhanceExistingCharacters10() {
  if (typeof document === 'undefined' || !runtime.state?.ai) return;
  const projection = characterProjection10(runtime.state, activityFromDocument10());
  document.querySelectorAll('.v8-being').forEach((node) => {
    if (node.closest(`#${LAYER_ID}`)) return;
    const compact = node.classList.contains('compact') || node.classList.contains('tiny');
    node.dataset.v10Enhanced = 'true';
    node.classList.add('v10-host', compact ? 'v10-host-compact' : 'v10-host-full');
    node.innerHTML = renderEvolutionFrame10(projection);
  });
}

function updatePreviewOnly10() {
  const preview = runtime.root?.querySelector('[data-v10-preview] .v10-live-preview');
  if (!preview) return;
  const creator = runtime.layer.creator;
  preview.innerHTML = renderEvolutionFrame10({
    name: creator.name || 'Your companion', presentation: creator.presentation,
    appearance: creator.appearanceProfile, origin: creator.originProfile,
    evolution: { phase: creator.stepIndex === 0 ? 'origin_orb' : 'forming_energy' },
    mood: 'wonder', activityState: 'awakening',
  });
  const name = runtime.root.querySelector('.v10-preview-caption strong');
  if (name) name.textContent = creator.name || 'A life is taking shape';
}

function identityFromAi10(value = {}) {
  const ai = value && typeof value === 'object' ? value : {};
  return {
    presentation: ['masculine','feminine','neutral'].includes(ai.presentation) ? ai.presentation : 'neutral',
    originProfile: normalizeOrigin10(ai.originProfile),
    appearanceProfile: normalizeAppearance10(ai.appearanceProfile),
    voiceProfile: normalizeVoiceProfile10(ai.voiceProfile, ai.voiceId),
  };
}

async function readState10() {
  const raw = await idbRead10().catch(() => null) || readFallback10();
  return migrateState(raw || defaultState());
}

async function writeState10(value) {
  const state = migrateState(value);
  state.updatedAt = new Date().toISOString();
  if (typeof indexedDB !== 'undefined') {
    try { await idbWrite10(state); return state; } catch (_) {}
  }
  if (typeof localStorage !== 'undefined') localStorage.setItem(`${DB_NAME}:fallback`, JSON.stringify(state));
  return state;
}

function openDatabase10() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function idbRead10() {
  if (typeof indexedDB === 'undefined') return null;
  const db = await openDatabase10();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(STATE_KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function idbWrite10(state) {
  const db = await openDatabase10();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(state, STATE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function readFallback10() {
  try { return JSON.parse(localStorage.getItem(`${DB_NAME}:fallback`) || 'null'); }
  catch { return null; }
}

function restoreCreatorDraft10() {
  if (typeof sessionStorage === 'undefined') return createCreatorState10();
  try { return createCreatorState10(JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null') || {}); }
  catch { return createCreatorState10(); }
}

function persistCreatorDraft10(value) {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(createCreatorState10(value)));
}

function choiceGroup10(label, actionType, field, values, selected, preview = false) {
  return `<fieldset class="v10-choice-group"><legend>${escapeHtml(label)}</legend><div class="v10-choice-row">${values.map((value) => `<button type="button" class="v10-choice ${value === selected ? 'selected' : ''}" data-v10-action="select-${actionType}" data-field="${attr(field)}" data-value="${attr(value)}"><span>${escapeHtml(labelize(value))}</span>${preview ? '<small>Tap to choose</small>' : ''}</button>`).join('')}</div></fieldset>`;
}

function optionButton10(actionType, field, value, selected) {
  return `<button type="button" class="v10-material-option ${value === selected ? 'selected' : ''}" data-v10-action="select-${actionType}" data-field="${attr(field)}" data-value="${attr(value)}"><i aria-hidden="true"></i><span>${escapeHtml(labelize(value))}</span></button>`;
}

function stepTitle10(step) {
  return ({ origin: 'Origin Chamber', identity: 'Identity Resonance', naming: 'Name the presence', appearance: 'Appearance Studio', style: 'Style Direction', voice: 'Voice Atelier', 'first-light': 'First Light' })[step] || 'First Light';
}
function stepCopy10(step) {
  return ({ origin: 'Choose the material, light, pulse, and motion that will remain inside every future form.', identity: 'Presentation guides the silhouette without deciding pronouns, personality, or voice.', naming: 'Give this one life a name and decide how you will address each other.', appearance: 'Shape a recognizable face and body with reversible, accessible controls.', style: 'Choose an outward direction. It changes clothing and atmosphere—not identity or history.', voice: 'Choose one of six neural voices and the expressive tone that fits this beginning.', 'first-light': 'Awaken one companion. No manufactured memories, duplicate identities, or hidden reset.' })[step] || '';
}
function firstLightCopy10(phase, name) {
  return ({ stabilize: 'The origin light steadies.', ribbons: 'Color and motion begin remembering their shape.', trace: 'A recognizable outline appears.', emerge: 'Identity and appearance join the same form.', awaken: 'The new presence opens its eyes.', speak: `${name || 'Your companion'} is ready to hear you.`, haven: 'The first chapter can begin.' })[phase] || 'First Light is unfolding.';
}
function activityFromDocument10() {
  const route = String(location.hash || '').replace(/^#\/?/, '').split('/')[0];
  if (route === 'talk') return document.querySelector('.is-listening,[data-listening="true"]') ? 'listening' : 'present';
  if (route === 'world') return 'exploring';
  if (route === 'grow') return 'reflecting';
  return 'idle';
}
function nativeHaptic10(kind) {
  try { window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'v10-haptic', kind })); } catch (_) {}
}
function clone(value) { return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)); }
function labelize(value) { return String(value || '').replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function attr(value) { return escapeHtml(value).replace(/`/g, '&#96;'); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' })[char]); }

if (typeof document !== 'undefined') {
  const start = () => bootVersion10Layer10().catch((error) => {
    console.error('Version 10 layer could not start.', error);
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else queueMicrotask(start);
}
