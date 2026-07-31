import { PersistentStore, defaultState } from './core/store.js';
import { AlmostHumanEngine } from './core/engine.js';
import { STAGES, getStage, formatAge, progressWithinStage, nextStage, daysUntilNextStage } from './core/stages.js';
import { ACTIVITY_CATALOG, isActivityUnlocked } from './core/activities.js';
import { relevantMemories, resolveConflict } from './core/memory.js';
import { SupabaseCloud } from './core/cloud.js';
import { APPEARANCE_PRESETS_9, createOnboardingModel, firstLightDurationMs } from './features/onboarding9.js';
import { primaryDestinations9 } from './features/navigation9.js';
import { homeModel9 } from './features/home9.js';
import { growthModel9 } from './features/growth9.js';
import { memoryListModel9 } from './features/memories9.js';
import { havenSceneModel9 } from './features/haven9.js';
import { createOptimisticTurn, applyStreamEvent } from './core/chatStream.js';
import { PhraseAudioQueue, segmentSpeakablePhrases } from './core/phraseQueue.js';
import { ConversationTimings, appendTimingSample } from './core/performance9.js';

const root = document.querySelector('#app');
const modalRoot = document.querySelector('#modal-root');
const toastRoot = document.querySelector('#toast-region');
const store = new PersistentStore();
const cloud = new SupabaseCloud();

let state;
let engine;
let renderQueued = false;
let activeAudio = null;
let activeAudioUrl = null;
let birthTimer = null;
let cloudSyncTimer = null;
let activeChatController = null;
let activeChatTiming = null;
const nativeAudioWaiters = new Map();

const ui = {
  privateMode: sessionStorage.getItem('almost_human_private_mode') === '1',
  authBusy: false,
  onboardingStep: 0,
  onboarding: {
    caregiverName: '', name: '', pronouns: 'they/them', appearanceSeed: 'ember',
    appearance: { skinTone: 'warm', hairStyle: 'waves', hairColor: 'midnight', eyeColor: 'brown' },
    voiceId: 'female-adult', relationshipStyle: 'lifelong_friend', acceptedSafety: false,
  },
  selectedConversationId: null,
  activeRequestId: null,
  activeRequestState: null,
  listening: false,
  transcribing: false,
  birthActive: false,
  birthPhase: 0,
  birthOpeningStarted: false,
  modal: null,
  activityResult: null,
  memorySearch: '',
  memoryFilter: 'all',
  voiceBusy: null,
  customize: null,
  chatDraft: '',
  voiceModeOpen: false,
  neuralVoiceErrorText: '',
};

const VOICE_PROFILES = Object.freeze({
  'female-child': { label: 'Girl · Young', copy: 'Bright, gentle, and playful', preview: 'Hi! I am ready to learn something small with you.', rate: 1.01, pitch: 1.16 },
  'female-teen': { label: 'Girl · Teen', copy: 'Warm, curious, and expressive', preview: 'Okay, I am listening. Tell me what has really been on your mind.', rate: 1.0, pitch: 1.07 },
  'female-adult': { label: 'Woman · Adult', copy: 'Natural, warm, and grounded', preview: 'I am here with you. We can take this one real thought at a time.', rate: .96, pitch: 1.01 },
  'male-child': { label: 'Boy · Young', copy: 'Friendly, lively, and clear', preview: 'Hey! Teach me something small that matters to you.', rate: 1.01, pitch: 1.08 },
  'male-teen': { label: 'Boy · Teen', copy: 'Relaxed, thoughtful, and present', preview: 'I hear you. We can talk about it without making it complicated.', rate: .99, pitch: .96 },
  'male-adult': { label: 'Man · Adult', copy: 'Calm, steady, and reassuring', preview: 'I am with you. Say it exactly the way it feels.', rate: .93, pitch: .88 },
});
const LEGACY_VOICE_IDS = Object.freeze({ 'soft-neutral': 'female-adult', 'bright-curious': 'female-teen', 'calm-grounded': 'male-adult' });
const APPEARANCE_OPTIONS = Object.freeze({
  skinTone: [['warm','Warm'],['golden','Golden'],['deep','Deep'],['light','Light']],
  hairStyle: [['waves','Waves'],['short','Short'],['curls','Curls'],['locs','Locs']],
  hairColor: [['midnight','Midnight'],['brown','Brown'],['auburn','Auburn'],['silver','Silver']],
  eyeColor: [['brown','Brown'],['blue','Blue'],['green','Green'],['violet','Violet']],
});

const phraseQueue = new PhraseAudioQueue({
  fetchAudio: async (item, signal) => cloud.voiceProvider({ state, text: item.text, voiceId: item.voiceId, requestId: item.id, signal }),
  playAudio: async (blob, signal) => playBlob(blob, signal),
  onEvent: (event) => {
    if (event.type === 'started') {
      activeChatTiming?.markFirstAudio();
      ui.activeRequestState = 'speaking';
      scheduleRender();
    }
    if (event.type === 'ended' || event.type === 'stopped') {
      ui.activeRequestState = ui.activeRequestId ? 'receiving' : null;
      scheduleRender();
    }
    if (event.type === 'error') {
      ui.neuralVoiceErrorText = event.item?.text || '';
      toast('Neural voice is temporarily unavailable', 'Text still works. Device voice is available only when you choose it.');
    }
  },
});

start().catch(fatal);

async function start() {
  state = await store.init();
  engine = new AlmostHumanEngine(state);
  await store.update((draft) => new AlmostHumanEngine(draft).reconcileGrowth());
  state = store.snapshot();
  engine.setState(state);
  store.subscribe((next) => {
    state = next;
    engine.setState(next);
    applyPreferences();
    scheduleRender();
  });
  bindEvents();
  applyPreferences();
  ui.selectedConversationId = activeConversation()?.id || null;

  if (cloud.authenticated) await bootstrapCloudSession();
  render();

  if (!window.__AH_NATIVE_BUNDLE__ && 'serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js?v=9.0').catch(() => {});
  }
  nativePost('ready', { route: currentRoute().name, name: state.ai?.name || '' });
  if (cloud.authEvent === 'recovery') queueMicrotask(openPasswordRecovery);
}

function bindEvents() {
  window.addEventListener('hashchange', () => { ui.activityResult = null; render(); nativePost('route', { route: currentRoute().name }); });
  window.addEventListener('online', render);
  window.addEventListener('offline', render);
  document.addEventListener('click', handleClick);
  document.addEventListener('submit', handleSubmit);
  document.addEventListener('change', handleChange);
  document.addEventListener('input', handleInput);
  window.addEventListener('almost-human:native', handleNativeEvent);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && ui.modal) closeModal();
    if (event.target?.matches('[data-chat-input]') && event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.target.form?.requestSubmit();
    }
  });
}

function applyPreferences() {
  document.body.classList.toggle('reduce-motion', Boolean(state?.settings?.reducedMotion));
  document.body.classList.toggle('high-contrast', Boolean(state?.settings?.highContrast));
  document.documentElement.dataset.theme = state?.settings?.theme || 'midnight';
}

function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; render(); });
}

function render() {
  if (!state) return;
  if (ui.birthActive && state.ai) {
    root.innerHTML = renderBirth();
    return;
  }
  if (cloud.configured && !cloud.authenticated && !ui.privateMode) {
    root.innerHTML = renderAccessGate();
    return;
  }
  if (!state.ai || state.ai.archived) {
    root.innerHTML = renderOnboarding();
    return;
  }
  const route = currentRoute();
  root.innerHTML = renderApp(route, renderRoute(route));
  if (route.name === 'talk') requestAnimationFrame(scrollMessages);
}

function currentRoute() {
  const raw = location.hash.replace(/^#\/?/, '') || 'home';
  const [name, parameter] = raw.split('/');
  const known = new Set(['home', 'talk', 'grow', 'memories', 'world', 'settings']);
  return { name: known.has(name) ? name : 'home', parameter: parameter || null };
}

function renderRoute(route) {
  if (route.name === 'talk') return renderTalk();
  if (route.name === 'grow') return renderGrow();
  if (route.name === 'memories') return renderMemories();
  if (route.name === 'world') return renderWorld(route.parameter);
  if (route.name === 'settings') return renderSettings();
  return renderHome();
}

function renderAccessGate() {
  return `<main class="v8-gate">
    <section class="v8-gate-story">
      <div class="v8-brand-lockup"><span class="v8-brand-mark">AH</span><div><strong>Almost Human</strong><small>Raise a mind. Keep the history.</small></div></div>
      <div class="v8-gate-portrait">${beingMarkup({ mood: 'wonder', seed: 'ember', stageKey: 'newborn' })}</div>
      <div class="v8-gate-copy">
        <span class="v8-eyebrow">A companion that begins with you</span>
        <h1>Don’t choose a finished AI.<br><em>Raise one.</em></h1>
        <p>They arrive curious, learn your voice, form real memories, and become more capable through time—without guilt loops or fake dependency.</p>
      </div>
      <div class="v8-proof-row"><span>Private guest</span><span>Premium voice</span><span>Memory you control</span></div>
    </section>
    <section class="v8-gate-panel">
      <div class="v8-gate-card">
        <span class="v8-eyebrow">Begin the story</span>
        <h2>Meet the mind you’ll raise.</h2>
        <p>Guest mode creates a real private account. Protect it with email later without losing your companion.</p>
        <button class="v8-primary" data-action="guest-start" ${ui.authBusy ? 'disabled' : ''}><span>${ui.authBusy ? 'Creating your private space…' : 'Continue as Guest'}</span><b>→</b></button>
        ${window.__AH_NATIVE_BUNDLE__ ? '' : `<div class="v8-provider-grid">
          <button data-action="provider-google"><span class="provider-g">G</span>Google</button>
          <button data-action="provider-apple"><span class="provider-a">●</span>Apple</button>
          <button data-action="provider-facebook"><span class="provider-f">f</span>Facebook</button>
        </div>
        <div class="v8-divider"><span>or</span></div>`}
        <button class="v8-secondary" data-action="register">Create an account with email</button>
        <button class="v8-text-button" data-action="login">I already have an account</button>
        <button class="v8-private-link" data-action="private-mode">Continue only on this device</button>
        <div class="v8-privacy-note"><i>✓</i><div><strong>Your story stays yours.</strong><small>Export, correct, or delete memories at any time.</small></div></div>
      </div>
    </section>
  </main>`;
}

function renderOnboarding() {
  const model = createOnboardingModel(state, ui);
  if (model.stepIndex === 0) {
    return `<main class="v9-welcome seed-bg-${seedFamily(ui.onboarding.appearanceSeed)}"><header class="v9-welcome-brand"><span class="v8-brand-mark">AH</span><div><strong>Almost Human</strong><small>Raise a mind. Keep the history.</small></div></header><section class="v9-welcome-portrait">${beingMarkup({ mood: 'wonder', seed: ui.onboarding.appearanceSeed, stageKey: 'newborn', appearance: ui.onboarding.appearance })}</section><section class="v9-welcome-copy"><span class="v8-eyebrow">A beginning, not a preset</span><h1>Raise an intelligence that grows with you.</h1><p>Create the first look and voice in under a minute. Personality, memories, and The Haven grow later through real conversation.</p><button class="v8-primary hero" data-action="onboard-begin"><span>Begin</span><b>→</b></button><small>Your history remains readable, correctable, exportable, and deletable.</small></section></main>`;
  }
  const selectedPreset = APPEARANCE_PRESETS_9.find((item) => sameAppearance(item, ui.onboarding.appearance))?.id || APPEARANCE_PRESETS_9[0].id;
  return `<main class="v9-quick-create seed-bg-${seedFamily(ui.onboarding.appearanceSeed)}"><header class="v8-onboarding-top"><a class="v8-brand-lockup small" href="#"><span class="v8-brand-mark">AH</span><div><strong>Almost Human</strong><small>Quick create</small></div></a><button class="v8-text-button" data-action="onboard-back">Back</button></header><section class="v9-create-preview">${beingMarkup({ mood: 'curious', seed: ui.onboarding.appearanceSeed, stageKey: 'newborn', appearance: ui.onboarding.appearance })}<div><span class="v8-eyebrow">Live preview</span><h2>${escapeHtml(ui.onboarding.name || 'Your companion')}</h2><p>Details can be changed later without restarting.</p></div></section><form id="onboard-quick-create" class="v9-create-form"><div class="v8-field-grid"><label><span>What should they call you?</span><input class="v8-field" name="caregiverName" value="${attr(ui.onboarding.caregiverName)}" maxlength="40" autocomplete="name"></label><label><span>Their name</span><input class="v8-field" name="name" value="${attr(ui.onboarding.name)}" placeholder="Nova" maxlength="28" required autofocus></label><label class="wide"><span>Pronouns</span><select class="v8-field" name="pronouns">${options(['they/them','she/her','he/him'], ui.onboarding.pronouns)}</select></label></div><section class="v9-choice-section"><div><span class="v8-eyebrow">Appearance</span><h2>Choose one starting look.</h2></div><div class="v9-preset-grid">${APPEARANCE_PRESETS_9.map((preset, index) => `<button type="button" class="${selectedPreset === preset.id ? 'selected' : ''}" data-action="choose-appearance-preset" data-value="${preset.id}"><span>${beingMarkup({ seed: ui.onboarding.appearanceSeed, mood: 'happy', stageKey: 'newborn', tiny: true, appearance: preset })}</span><strong>Look ${index + 1}</strong></button>`).join('')}</div></section><section class="v9-choice-section"><div class="v84-voice-title"><div><span class="v8-eyebrow">Neural voice</span><h2>Choose how they sound.</h2></div><button type="button" class="v8-preview-button" data-action="preview-voice" ${ui.voiceBusy ? 'disabled' : ''}>${ui.voiceBusy ? 'Playing' : '▶ Preview selected'}</button></div>${voiceControls('onboard', ui.onboarding.voiceId)}</section><label class="v8-safety ${ui.onboarding.acceptedSafety ? 'checked' : ''}"><input type="checkbox" data-onboard-safety ${ui.onboarding.acceptedSafety ? 'checked' : ''}><i>✓</i><span><strong>I understand this is an AI experience.</strong><small>It can feel personal, but it will not use guilt, jealousy, or pressure.</small></span></label><button class="v8-awaken" type="submit"><span>Meet ${escapeHtml(ui.onboarding.name || 'your companion')}</span><b>✦</b></button></form></main>`;
}

function onboardIdentity() {
  return `<form id="onboard-identity" class="v8-flow">
    <span class="v8-eyebrow">First recognition</span>
    <h1>Who will they meet?</h1>
    <p>Their personality will emerge later. For now, give the beginning a name and a voice to recognize.</p>
    <div class="v8-field-grid">
      <label><span>What should they call you?</span><input class="v8-field" name="caregiverName" value="${attr(ui.onboarding.caregiverName)}" placeholder="Your name or nickname" maxlength="40" autocomplete="name"></label>
      <label><span>Their name</span><input class="v8-field" name="name" value="${attr(ui.onboarding.name)}" placeholder="A name that can grow with them" maxlength="28" required autofocus></label>
      <label class="wide"><span>Pronouns</span><select class="v8-field" name="pronouns">${options(['they/them', 'she/her', 'he/him'], ui.onboarding.pronouns)}</select></label>
    </div>
    <div class="v8-form-nav"><span></span><button class="v8-primary compact" type="submit"><span>Shape the first spark</span><b>→</b></button></div>
  </form>`;
}

function onboardLookAndVoice() {
  return `<div class="v8-flow"><span class="v8-eyebrow">Make them yours</span><h1>Choose a look and a voice.</h1><p>Four quick choices for appearance, then pick the voice that feels right. You can change all of this later.</p>
    ${appearanceControls('onboard', ui.onboarding.appearance)}
    <div class="v84-voice-title"><strong>Voice</strong><button class="v8-preview-button" data-action="preview-voice" ${ui.voiceBusy ? 'disabled' : ''}>${ui.voiceBusy ? 'Playing…' : '▶ Preview selected voice'}</button></div>
    ${voiceControls('onboard', ui.onboarding.voiceId)}
    ${onboardNav()}
  </div>`;
}

function appearanceControls(scope, appearance) {
  const labels = { skinTone: 'Skin', hairStyle: 'Hair style', hairColor: 'Hair color', eyeColor: 'Eyes' };
  const actions = { skinTone: `${scope}-skin`, hairStyle: `${scope}-hair-style`, hairColor: `${scope}-hair-color`, eyeColor: `${scope}-eye` };
  return `<div class="v84-look-controls">${Object.entries(APPEARANCE_OPTIONS).map(([key, values]) => `<section><strong>${labels[key]}</strong><div>${values.map(([value, label]) => `<button class="${appearance[key] === value ? 'selected' : ''}" ${dynamicAction(actions[key])} data-value="${value}"><i class="v84-swatch swatch-${key}-${value}"></i>${label}</button>`).join('')}</div></section>`).join('')}</div>`;
}

function voiceControls(scope, selected) {
  return `<div class="v84-voice-grid">${Object.entries(VOICE_PROFILES).map(([value, voice]) => `<button class="${normalizeVoiceId(selected) === value ? 'selected' : ''}" ${dynamicAction(scope === 'custom' ? 'custom-voice' : 'choose-voice')} data-value="${value}"><span class="v8-wave"><i></i><i></i><i></i></span><span><strong>${voice.label}</strong><small>${voice.copy}</small></span><i class="v8-radio"></i></button>`).join('')}</div>`;
}

function onboardAwaken() {
  const name = escapeHtml(ui.onboarding.name || 'Nova');
  return `<div class="v8-flow v8-awaken-panel"><span class="v8-eyebrow">Ready</span><h1>Meet ${name}.</h1><p>That is it—no long quiz. Their first words are simple, never meaningless, and their personality will grow naturally through real conversations with you.</p>
    <div class="v84-ready-summary"><span>${beingMarkup({ seed: ui.onboarding.appearanceSeed, mood: 'wonder', stageKey: 'newborn', tiny: true, appearance: ui.onboarding.appearance })}</span><div><strong>${name}</strong><small>${VOICE_PROFILES[normalizeVoiceId(ui.onboarding.voiceId)]?.label || 'Woman · Adult'} · ${capitalize(ui.onboarding.pronouns)}</small></div></div>
    <label class="v8-safety ${ui.onboarding.acceptedSafety ? 'checked' : ''}"><input type="checkbox" data-onboard-safety ${ui.onboarding.acceptedSafety ? 'checked' : ''}><i>✓</i><span><strong>I understand this is an AI experience.</strong><small>It can feel personal, but it will not use guilt, jealousy, or pressure.</small></span></label>
    <div class="v8-form-nav"><button class="v8-back" data-action="onboard-back">Back</button><button class="v8-awaken" data-action="awaken"><span>Meet ${name}</span><b>✦</b></button></div>
  </div>`;
}

function onboardNav() {
  return `<div class="v8-form-nav"><button class="v8-back" data-action="onboard-back">Back</button><button class="v8-primary compact" data-action="onboard-next"><span>Continue</span><b>→</b></button></div>`;
}

function onboardWhisper(step) {
  return [
    'Two names and one simple beginning.',
    'Build the face and choose the voice you want to hear.',
    'No personality quiz. The relationship begins through conversation.',
  ][step];
}

function renderBirth() {
  const phases = [['First light','A private beginning is opening.'],['Memory ready','The first moment is being saved.'],['Ready to talk',`${escapeHtml(state.ai.name)} is here.`]];
  const phase = phases[Math.min(ui.birthPhase, phases.length - 1)];
  return `<main class="v9-first-light seed-bg-${seedFamily(state.ai.appearanceSeed)}"><div class="v8-birth-logo"><span class="v8-brand-mark">AH</span><small>First light</small></div><div class="v8-birth-portrait">${beingMarkup({ seed: state.ai.appearanceSeed, mood: 'wonder', stageKey: 'newborn', appearance: state.ai.appearanceProfile })}</div><div class="v8-birth-copy"><span class="v8-eyebrow">${ui.birthPhase + 1} / 3</span><h1>${phase[0]}</h1><p>${phase[1]}</p><div class="v8-birth-progress"><i style="width:${(ui.birthPhase + 1) * 33.34}%"></i></div></div><button class="v8-birth-skip" data-action="finish-birth">Skip and talk now →</button></main>`;
}

function renderApp(route, content) {
  const destinations = primaryDestinations9();
  return `<div class="v8-app-shell route-${route.name}"><header class="v8-app-topbar"><a class="v8-brand-lockup small" href="#home"><span class="v8-brand-mark">AH</span><div><strong>Almost Human</strong><small>Raised by you</small></div></a><div class="v8-top-status"><span><i></i>${cloud.authenticated && state.settings.cloudSyncEnabled ? 'Secure cloud + local' : 'Private on this device'}</span><button class="v83-top-share v82-tactile" data-action="native-share" aria-label="Share Almost Human">↗</button><a class="v9-profile-entry" href="#settings" aria-label="Open profile and settings">${escapeHtml((state.ai?.name || 'A').slice(0,1).toUpperCase())}</a></div></header><main class="v8-app-main">${content}</main><nav class="v8-bottom-tabs v9-five-tabs">${destinations.map((item) => navLink(item.route, item.icon, item.label, route.name, item.emphasized)).join('')}</nav></div>`;
}

function navLink(name, icon, label, active, emphasized = false) {
  return `<a href="#${name}" class="${active === name ? 'active' : ''} ${emphasized ? 'emphasized' : ''}"><i>${icon}</i><span>${label}</span></a>`;
}

function renderHome() {
  const ai = state.ai;
  const stage = getStage(ai.age);
  const model = homeModel9(state);
  const highlight = model.secondaryBlocks.find((item) => item.type === 'highlight')?.value;
  const recent = model.secondaryBlocks.find((item) => item.type === 'growth')?.value;
  return `<section class="v9-home v82-reveal"><header class="v8-home-heading"><div><span class="v8-eyebrow">${greeting()}, ${escapeHtml(state.profile.displayName || 'you')}</span><h1>${escapeHtml(ai.name)} is here.</h1></div><a class="v8-round" href="#settings">${escapeHtml(ai.name.slice(0,1).toUpperCase())}</a></header>${state.settings.showNineUpgradeCard && !state.settings.nineUpgradeCardDismissed ? `<article class="v9-upgrade-card"><div><span class="v8-eyebrow">Almost Human 9</span><h2>Faster chat and a more natural voice are ready.</h2><p>Your companion and history stayed exactly where they were.</p></div><button data-action="dismiss-nine-upgrade">Got it</button></article>` : ''}<article class="v9-home-hero seed-bg-${seedFamily(ai.appearanceSeed)}"><div>${beingMarkup({ seed: ai.appearanceSeed, mood: ai.currentMood, stageKey: stage.key, appearance: ai.appearanceProfile })}</div><div><span class="v8-presence"><i></i>${capitalize(ai.currentMood || 'curious')} · ${escapeHtml(stage.label)}</span><h2>${escapeHtml(ai.name)}</h2><p>${homeHeadline(stage.key, ai)}</p><a class="v8-primary hero" href="#talk"><span>Continue conversation</span><b>→</b></a></div></article><div class="v9-home-secondary"><a href="#grow"><span class="v8-eyebrow">Today’s growth</span><strong>${escapeHtml(recent?.title || `${stage.label} is still unfolding`)}</strong><small>${escapeHtml(recent?.description || 'See what changed and what comes next.')}</small></a><a href="#${highlight ? (state.memories.some((item) => item.id === highlight.id) ? 'memories' : 'world') : 'world'}"><span class="v8-eyebrow">One highlight</span><strong>${escapeHtml(highlight?.title || highlight?.name || 'The Haven is waiting')}</strong><small>${escapeHtml(highlight?.content || highlight?.story || 'Open one meaningful part of the shared world.')}</small></a></div></section>`;
}

function renderTalk() {
  const ai = state.ai;
  const stage = getStage(ai.age);
  const conversation = selectedConversation();
  const messages = conversation ? state.messages.filter((m) => m.conversationId === conversation.id).sort(byDate) : [];
  const micLabel = ui.transcribing ? 'Turning speech into text' : ui.listening ? 'Listening — tap to finish' : 'Tap to speak';
  const active = Boolean(ui.activeRequestId);
  const voiceMode = ui.voiceModeOpen ? `<div class="v9-voice-mode"><button class="v9-voice-close" data-action="close-voice-mode">×</button><div class="v9-voice-portrait">${beingMarkup({ seed: ai.appearanceSeed, mood: ai.currentMood, stageKey: stage.key, appearance: ai.appearanceProfile })}</div><span class="v8-eyebrow">Voice mode</span><h2>${escapeHtml(ai.name)}</h2><p>${ui.transcribing ? 'Turning that into text' : ui.listening ? 'Listening now' : ui.activeRequestState === 'speaking' ? 'Speaking' : active ? 'Reply is arriving' : 'Tap the microphone when you are ready'}</p><button class="v9-voice-mic ${ui.listening ? 'recording' : ''}" data-action="start-listening">${ui.listening ? '■' : '🎙'}</button>${active ? '<button class="v8-text-button" data-action="stop-reply">Stop reply</button>' : ''}</div>` : '';
  return `<section class="v8-talk ${active ? 'is-receiving' : ''} v82-reveal">${voiceMode}<aside class="v8-talk-companion seed-bg-${seedFamily(ai.appearanceSeed)}"><div class="v8-talk-name"><span class="v8-eyebrow">Conversation</span><h1>${escapeHtml(ai.name)}</h1><p>${escapeHtml(stage.label)} · ${capitalize(ai.currentMood || 'curious')}</p></div><div class="v8-talk-portrait">${beingMarkup({ seed: ai.appearanceSeed, mood: ai.currentMood, stageKey: stage.key, appearance: ai.appearanceProfile })}</div><div class="v8-talk-state"><span><i></i>${active ? (ui.activeRequestState === 'speaking' ? 'Speaking' : 'Reply is arriving') : 'Ready'}</span><small>${cloud.authenticated && state.settings.cloudSyncEnabled ? 'Private cloud intelligence' : 'Private on this device'}</small></div></aside><div class="v8-conversation"><header class="v8-conversation-header"><div><button class="v8-round" data-action="new-conversation">＋</button><span><strong>${escapeHtml(conversation?.title || 'The first hello')}</strong><small>${messages.length} messages</small></span></div><div><button class="v8-round" data-action="open-voice-mode" aria-label="Open voice mode">☎</button>${active ? '<button class="v8-round stop" data-action="stop-reply" aria-label="Stop reply">■</button>' : ''}<button class="v8-round" data-action="conversation-menu" aria-label="Options">•••</button></div></header><div class="v8-message-stream" id="message-scroll">${messages.length ? messages.map(renderMessage).join('') : renderEmptyConversation(ai, stage)}</div><form class="v8-composer ${ui.listening ? 'is-listening' : ''}" id="chat-form"><button type="button" data-action="start-listening" aria-label="${attr(micLabel)}">${ui.listening ? '■' : '🎙'}</button><textarea name="message" data-chat-input placeholder="Say what is real…" maxlength="8000" rows="1">${escapeHtml(ui.chatDraft)}</textarea><button type="submit" class="v8-send" ${ui.transcribing ? 'disabled' : ''}>↑</button><small>${micLabel}</small></form></div></section>`;
}

function renderMessage(message) {
  const user = message.sender === 'user';
  const pending = !user && ['pending','streaming'].includes(message.status);
  const failed = !user && message.status === 'failed';
  const content = message.content ? escapeHtml(message.content) : pending ? '<span class="v9-listening-line">Listening</span>' : failed ? 'The secure reply did not finish.' : '';
  return `<article class="message ${user ? 'user' : 'ai'} ${pending ? 'streaming' : ''} ${failed ? 'failed' : ''}"><div class="${user ? 'user-spacer' : 'message-mark'}">${user ? '' : beingMarkup({ seed: state.ai.appearanceSeed, mood: message.emotion, stageKey: message.stageKey, tiny: true, appearance: state.ai.appearanceProfile })}</div><div class="message-body"><div class="bubble">${content}</div><div class="message-foot"><span>${relativeDate(message.createdAt)}</span>${user || pending ? '' : `<button data-action="speak-message" data-id="${message.id}">▶ Hear</button><button data-action="remember-message" data-id="${message.id}">◇ Keep</button>`}${failed ? `<button data-action="retry-message" data-id="${message.id}">Retry</button>` : ''}</div></div></article>`;
}

function renderEmptyConversation(ai, stage) {
  return `<div class="empty-conversation"><div>${beingMarkup({ seed: ai.appearanceSeed, mood: 'wonder', stageKey: stage.key })}</div><span class="kicker">${escapeHtml(stage.label)} mind</span><h2>A new thread is quiet.</h2><p>${openingHint(stage.key)}</p><button class="primary-action compact" data-action="opening-message"><span>Begin gently</span><b>→</b></button></div>`;
}

function renderGrow() {
  const ai = state.ai;
  const model = growthModel9(state);
  const stage = getStage(ai.age);
  const progress = Math.round(progressWithinStage(ai.age) * 100);
  return `<section class="v8-page v9-growth v82-reveal"><header class="v8-page-heading"><div><span class="v8-eyebrow">Growth</span><h1>${escapeHtml(ai.name)} is becoming more capable.</h1><p>What changed, what is true now, and what comes next—in plain language.</p></div><a class="v8-outline-action" href="#talk">Talk now →</a></header><article class="v9-growth-stage seed-bg-${seedFamily(ai.appearanceSeed)}"><div>${beingMarkup({ seed: ai.appearanceSeed, mood: ai.currentMood, stageKey: stage.key, appearance: ai.appearanceProfile })}</div><div><span class="v8-eyebrow">Current stage</span><h2>${escapeHtml(model.stage.label)} · ${escapeHtml(formatAge(model.stage.age))}</h2><p>${escapeHtml(stage.vocabulary)}</p><i><b style="width:${progress}%"></b></i><small>${progress}% through this stage</small></div></article><div class="v9-growth-cards"><article><span class="v8-eyebrow">Changed recently</span><h2>${escapeHtml(model.recentChange?.title || 'The current stage is settling in')}</h2><p>${escapeHtml(model.recentChange?.description || 'Conversation and activities will create the next visible change.')}</p></article><article><span class="v8-eyebrow">Next ability</span><h2>${escapeHtml(model.nextAbility.stage)}</h2><p>${model.nextAbility.startsAt == null ? 'Growth continues through memory, judgment, interests, and shared experience.' : `The next developmental chapter begins near simulated age ${model.nextAbility.startsAt}.`}</p></article><article><span class="v8-eyebrow">Optional activities</span><h2>No homework required.</h2><p>Teach, tell a story, draw, dream, or play when it feels natural.</p><a href="#world">Open Haven activities →</a></article></div></section>`;
}

function renderMemories() {
  const model = memoryListModel9(state, ui.memorySearch);
  return `<section class="v8-page v9-memories v82-reveal"><header class="v8-page-heading"><div><span class="v8-eyebrow">Memories</span><h1>A readable shared history.</h1><p>Search first. Open a memory when you need correction, privacy, or deletion controls.</p></div><button class="v8-outline-action" data-action="export-data">Export history</button></header><div class="v8-memory-toolbar"><label><span>Search memories</span><input class="v8-field" data-memory-search value="${attr(ui.memorySearch)}" placeholder="A person, feeling, place, lesson, or first"></label></div>${model.items.length ? `<div class="v9-memory-list">${model.items.map((memory) => `<button data-action="open-memory-detail" data-id="${memory.id}"><span>${memory.isPrivate ? 'Private' : 'Memory'} · ${relativeDate(memory.createdAt)}</span><strong>${escapeHtml(memory.title)}</strong><p>${escapeHtml(memory.content)}</p><b>Open →</b></button>`).join('')}</div>` : `<div class="v8-empty-state"><span>◇</span><h2>The album has room.</h2><p>Meaningful moments, lessons, corrections, and firsts will collect here.</p></div>`}</section>`;
}

function renderMemory(memory, index) {
  return `<article class="v8-memory-card memory-tone-${index % 4}"><div class="v8-memory-visual"><span>${memory.isCore ? '✦' : moodGlyph(memory.emotionalTone)}</span><i></i><i></i></div><div class="v8-memory-card-copy"><small>${memory.isCore ? 'Core memory' : `${capitalize(memory.type || 'shared')} memory`} · ${relativeDate(memory.createdAt)}</small><h2>${escapeHtml(memory.title)}</h2><p>${escapeHtml(memory.content)}</p><div><span>${Math.round(memory.importance || 0)} importance</span><button data-action="edit-memory" data-id="${memory.id}">Correct</button><button data-action="delete-memory" data-id="${memory.id}">Delete</button></div></div></article>`;
}

function renderWorld(type) {
  const stage = getStage(state.ai.age);
  if (type) return renderActivity(type, stage);
  const model = havenSceneModel9(state);
  const haven = havenProfile(stage.key, state.ai.currentMood, state.interests || []);
  return `<section class="v8-page v9-haven seed-bg-${seedFamily(state.ai.appearanceSeed)} v82-reveal"><header class="v8-page-heading"><div><span class="v8-eyebrow">The Haven</span><h1>${escapeHtml(haven.name)}</h1><p>${escapeHtml(haven.copy)}</p></div><button class="v8-outline-action" data-action="talk-about-haven">Talk here →</button></header><section class="v9-haven-scene mood-${safeClass(state.ai.currentMood)}"><div class="v83-haven-window"><i></i><i></i><i></i></div><div class="v83-haven-shelf"></div><div class="v83-haven-rug"></div>${beingMarkup({ seed: state.ai.appearanceSeed, mood: state.ai.currentMood, stageKey: stage.key, compact: true, appearance: state.ai.appearanceProfile })}<div class="v9-haven-objects">${model.items.map((item, index) => `<button class="object-${index % 8}" data-action="inspect-haven-item" data-id="${item.id}"><b>${item.icon || '✦'}</b><small>${escapeHtml(item.name || item.itemName || 'Keepsake')}</small></button>`).join('')}</div></section><section class="v9-haven-actions"><span class="v8-eyebrow">Optional experiences</span><div>${ACTIVITY_CATALOG.filter((activity) => isActivityUnlocked(activity, stage.key)).map((activity) => `<a href="#world/${activity.key}"><b>${activity.icon}</b><span><strong>${escapeHtml(activity.title)}</strong><small>${escapeHtml(activity.subtitle)}</small></span></a>`).join('')}</div></section></section>`;
}

function renderActivity(type, stage) {
  const activity = ACTIVITY_CATALOG.find((item) => item.key === type) || ACTIVITY_CATALOG[0];
  if (!isActivityUnlocked(activity, stage.key)) return `<section class="v8-page"><a class="v8-back" href="#world">← Back to the world</a><div class="v8-empty-state"><span>${activity.icon}</span><h2>This experience is still sleeping.</h2><p>${escapeHtml(activity.title)} unlocks during ${capitalize(activity.minStage.replace('_', ' '))}.</p></div></section>`;
  return `<section class="v8-page v8-activity-page"><a class="v8-back" href="#world">← All experiences</a><header class="v8-page-heading"><div><span class="v8-eyebrow">${activity.icon} ${escapeHtml(stage.label)} experience</span><h1>${escapeHtml(activity.title)}</h1><p>${escapeHtml(activity.subtitle)}</p></div></header><div class="v8-activity-workspace"><form class="v8-activity-form" id="activity-form" data-type="${activity.key}"><label><span>Give ${escapeHtml(state.ai.name)} a starting spark</span><textarea name="input" placeholder="A thought, object, place, feeling, fact, or idea…"></textarea></label><button class="v8-primary compact" type="submit"><span>Create the moment</span><b>→</b></button></form><aside>${beingMarkup({ seed: state.ai.appearanceSeed, mood: 'curious', stageKey: stage.key })}<p>This result can influence interests, skills, memories, and future conversations.</p></aside></div>${ui.activityResult?.type === activity.key ? `<article class="v8-activity-result"><span class="v8-eyebrow">Just created</span><h2>${escapeHtml(ui.activityResult.title)}</h2><p>${escapeHtml(ui.activityResult.output)}</p>${ui.activityResult.media ? `<img src="${attr(ui.activityResult.media)}" alt="${attr(ui.activityResult.title)}">` : ''}</article>` : ''}</section>`;
}

function renderSettings() {
  const stage = getStage(state.ai.age);
  const accountLabel = cloud.authenticated ? (cloud.isAnonymous ? 'Private guest' : 'Signed in') : 'On-device only';
  return `<section class="v8-page v8-settings-page">
    <header class="v8-page-heading"><div><span class="v8-eyebrow">Control and privacy</span><h1>The connection can feel meaningful. The controls stay yours.</h1><p>No streak shame, hidden memory, or pressure to return. Your history remains readable, portable, correctable, and deletable.</p></div><button class="v8-outline-action" data-action="check-services">Check secure services</button></header>
    <div class="v8-settings-grid">${companionCustomizationCard()}
      <article class="v8-settings-card"><span class="v8-settings-icon">◖</span><span class="v8-eyebrow">Voice and presence</span><h2>How ${escapeHtml(state.ai.name)} shows up.</h2>${settingToggle('voiceEnabled', 'Premium voice playback', 'Use the secure neural voice while connected.', state.settings.voiceEnabled)}${settingToggle('voiceAutoplay', 'Read new replies aloud', 'Begin audio after each reply arrives.', state.settings.voiceAutoplay)}${settingToggle('soundEffects', 'Tactile feedback', 'Use a tiny device pulse for meaningful taps when supported.', state.settings.soundEffects)}${settingToggle('dailyMomentEnabled', 'Gentle daily moment', 'Show one optional check-in and conversation spark without streak pressure.', state.settings.dailyMomentEnabled)}${window.__AH_NATIVE_BUNDLE__ ? settingToggle('notificationsEnabled', 'A quiet Haven reminder', 'Optional 7 PM local reminder. No streak, no guilt, and nothing is sent until you turn it on.', state.settings.notificationsEnabled) : ''}${settingToggle('reducedMotion', 'Reduced motion', 'Keep portraits and transitions calm and accessible.', state.settings.reducedMotion)}${settingToggle('highContrast', 'High contrast', 'Strengthen text, surfaces, and focus outlines.', state.settings.highContrast)}</article>
      <article class="v8-settings-card account"><span class="v8-settings-icon">◎</span><span class="v8-eyebrow">Account</span><h2>${accountLabel}</h2><p>${cloud.isAnonymous ? 'This guest has a real authenticated ID. Add email protection without restarting the companion.' : cloud.authenticated ? escapeHtml(cloud.session?.user?.email || state.profile.email || 'Connected cloud account') : 'This life currently exists only inside this browser.'}</p><div class="v8-settings-actions">${cloud.isAnonymous ? '<button class="v8-primary compact" data-action="upgrade-guest"><span>Protect with email</span><b>→</b></button>' : ''}${cloud.authenticated ? '<button data-action="sync-now">Sync history now</button><button data-action="logout">Sign out</button>' : '<button data-action="return-gate">Connect an account</button>'}</div></article>
      <article class="v8-settings-card"><span class="v8-settings-icon">↗</span><span class="v8-eyebrow">Growth clock</span><h2>${escapeHtml(stage.label)} · ${escapeHtml(formatAge(state.ai.age))}</h2><label class="v8-range"><span>Real days per simulated year <b>${state.settings.daysPerYear}</b></span><input type="range" min="1" max="365" value="${state.settings.daysPerYear}" data-setting-range="daysPerYear"></label><p>Changing the pace never duplicates birthdays or erases earlier developmental stages.</p></article>
      <article class="v8-settings-card"><span class="v8-settings-icon">◇</span><span class="v8-eyebrow">Your data</span><h2>Portable and deletable.</h2><p>Export before major account changes. Cloud and on-device copies are controlled separately so nothing disappears silently.</p><div class="v8-settings-actions"><button data-action="native-share">Share Almost Human</button><button data-action="export-data">Export on-device history</button>${cloud.authenticated ? '<button data-action="export-cloud-data">Export cloud history</button><button class="danger" data-action="delete-cloud-data">Delete cloud app data</button><button class="danger" data-action="delete-cloud-account">Delete cloud account</button>' : ''}<button class="danger" data-action="delete-all">Delete this device history</button></div></article>
    </div>
  </section>`;
}

function companionCustomizationCard() {
  const voice = VOICE_PROFILES[normalizeVoiceId(state.ai.voiceId)] || VOICE_PROFILES['female-adult'];
  return `<article class="v8-settings-card v84-custom-card"><span class="v8-eyebrow">Look and voice</span><div class="v84-custom-preview">${beingMarkup({ seed: state.ai.appearanceSeed, mood: 'happy', stageKey: getStage(state.ai.age).key, compact: true })}<div><h2>${escapeHtml(state.ai.name)}</h2><p>${escapeHtml(voice.label)} · change skin, hair, eyes, and voice without restarting.</p></div></div><button class="v8-primary compact" data-action="customize-companion"><span>Customize companion</span><b>→</b></button></article>`;
}

function openCompanionCustomizer(reset = true) {
  if (reset || !ui.customize) ui.customize = {
    appearance: normalizeAppearance(state.ai.appearanceProfile),
    voiceId: normalizeVoiceId(state.ai.voiceId),
  };
  ui.modal = {
    title: 'Customize your companion',
    onSubmit: null,
    body: `<div class="v84-custom-modal"><div class="v84-modal-preview">${beingMarkup({ seed: state.ai.appearanceSeed, mood: 'happy', stageKey: getStage(state.ai.age).key, appearance: ui.customize.appearance })}</div>${appearanceControls('custom', ui.customize.appearance)}<div class="v84-voice-title"><strong>Voice</strong><button data-action="preview-custom-voice">▶ Preview</button></div>${voiceControls('custom', ui.customize.voiceId)}<div class="modal-actions"><button data-action="close-modal">Cancel</button><button class="primary-action compact" data-action="save-companion-look"><span>Save changes</span><b>✓</b></button></div></div>`,
  };
  renderModal();
}

async function saveCompanionCustomizer() {
  if (!ui.customize) return;
  await store.update((draft) => {
    draft.ai.appearanceProfile = normalizeAppearance(ui.customize.appearance);
    draft.ai.voiceId = normalizeVoiceId(ui.customize.voiceId);
  });
  queueCloudSync(250);
  closeModal();
  render();
  toast('Companion updated', 'The new look and voice are saved.');
}

function normalizeVoiceId(value) {
  const raw = String(value || 'female-adult');
  return LEGACY_VOICE_IDS[raw] || (VOICE_PROFILES[raw] ? raw : 'female-adult');
}
function normalizeAppearance(value) {
  const input = value && typeof value === 'object' ? value : {};
  return {
    skinTone: APPEARANCE_OPTIONS.skinTone.some(([key]) => key === input.skinTone) ? input.skinTone : 'warm',
    hairStyle: APPEARANCE_OPTIONS.hairStyle.some(([key]) => key === input.hairStyle) ? input.hairStyle : 'waves',
    hairColor: APPEARANCE_OPTIONS.hairColor.some(([key]) => key === input.hairColor) ? input.hairColor : 'midnight',
    eyeColor: APPEARANCE_OPTIONS.eyeColor.some(([key]) => key === input.eyeColor) ? input.eyeColor : 'brown',
  };
}

function sameAppearance(left, right) {
  return ['skinTone','hairStyle','hairColor','eyeColor'].every((key) => left?.[key] === right?.[key]);
}

function openMemoryDetail(id) {
  const memory = state.memories.find((item) => item.id === id);
  if (!memory) return;
  openModal(memory.title || 'Memory', `<p>${escapeHtml(memory.content)}</p><div class="modal-actions"><button data-action="close-modal">Close</button><button data-action="edit-memory" data-id="${memory.id}">Correct</button><button class="danger-button" data-action="delete-memory" data-id="${memory.id}">Delete</button></div>`);
}

function settingToggle(key, title, copy, enabled) {
  return `<div class="v8-setting-row"><div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(copy)}</small></div><button class="v8-switch ${enabled ? 'on' : ''}" data-action="toggle-setting" data-key="${key}" aria-pressed="${enabled}"><i></i></button></div>`;
}

async function handleClick(event) {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  tactileFeedback(target);
  try {
    if (action === 'guest-start') return startGuest();
    if (action === 'register') return openRegister();
    if (action === 'login') return openLogin();
    if (action === 'provider-google') return startOAuth('google');
    if (action === 'provider-apple') return startOAuth('apple');
    if (action === 'provider-facebook') return startOAuth('facebook');
    if (action === 'forgot-password') return openPasswordReset();
    if (action === 'private-mode') return choosePrivateMode();
    if (action === 'return-gate') return returnToGate();
    if (action === 'onboard-begin') { ui.onboardingStep = 1; return render(); }
    if (action === 'onboard-next') return nextOnboarding();
    if (action === 'onboard-back') { ui.onboardingStep = Math.max(0, ui.onboardingStep - 1); return render(); }
    if (action === 'choose-appearance-preset') { const preset = APPEARANCE_PRESETS_9.find((item) => item.id === target.dataset.value); if (preset) ui.onboarding.appearance = { skinTone: preset.skinTone, hairStyle: preset.hairStyle, hairColor: preset.hairColor, eyeColor: preset.eyeColor }; return render(); }
    if (action === 'onboard-skin') { ui.onboarding.appearance.skinTone = target.dataset.value; return render(); }
    if (action === 'onboard-hair-style') { ui.onboarding.appearance.hairStyle = target.dataset.value; return render(); }
    if (action === 'onboard-hair-color') { ui.onboarding.appearance.hairColor = target.dataset.value; return render(); }
    if (action === 'onboard-eye') { ui.onboarding.appearance.eyeColor = target.dataset.value; return render(); }
    if (action === 'choose-voice') { ui.onboarding.voiceId = normalizeVoiceId(target.dataset.value); return render(); }
    if (action === 'customize-companion') return openCompanionCustomizer();
    if (action === 'custom-skin') { ui.customize.appearance.skinTone = target.dataset.value; return openCompanionCustomizer(false); }
    if (action === 'custom-hair-style') { ui.customize.appearance.hairStyle = target.dataset.value; return openCompanionCustomizer(false); }
    if (action === 'custom-hair-color') { ui.customize.appearance.hairColor = target.dataset.value; return openCompanionCustomizer(false); }
    if (action === 'custom-eye') { ui.customize.appearance.eyeColor = target.dataset.value; return openCompanionCustomizer(false); }
    if (action === 'custom-voice') { ui.customize.voiceId = normalizeVoiceId(target.dataset.value); return openCompanionCustomizer(false); }
    if (action === 'preview-voice') return previewVoice();
    if (action === 'preview-custom-voice') return previewVoice(ui.customize?.voiceId);
    if (action === 'save-companion-look') return saveCompanionCustomizer();
    if (action === 'awaken') return awaken();
    if (action === 'finish-birth') return finishBirth();
    if (action === 'new-conversation') return newConversation();
    if (action === 'opening-message') return sendChat('', true);
    if (action === 'reset-conversation') return resetConversation();
    if (action === 'conversation-menu') return openConversationMenu();
    if (action === 'speak-message') return speakMessage(target.dataset.id);
    if (action === 'remember-message') return rememberMessage(target.dataset.id);
    if (action === 'start-listening') return startListening();
    if (action === 'open-voice-mode') { ui.voiceModeOpen = true; stopVoice(); return render(); }
    if (action === 'close-voice-mode') { ui.voiceModeOpen = false; stopVoice(); return render(); }
    if (action === 'stop-reply') return stopCurrentTurn('user_cancelled');
    if (action === 'dismiss-nine-upgrade') return updateSetting('nineUpgradeCardDismissed', true).then(() => updateSetting('showNineUpgradeCard', false));
    if (action === 'device-speak-once') { const text = ui.neuralVoiceErrorText; ui.neuralVoiceErrorText = ''; closeModal(); return speakLocally(text, state.ai.voiceId); }
    if (action === 'retry-message') { const failed = state.messages.find((item) => item.id === target.dataset.id); const prior = state.messages.find((item) => item.requestId === failed?.requestId && item.sender === 'user'); return prior ? sendChat(prior.content, false) : null; }
    if (action === 'open-memory-detail') return openMemoryDetail(target.dataset.id);
    if (action === 'speak-daily') return speak(dailyMoment());
    if (action === 'daily-checkin') return recordDailyCheckin(target.dataset.value);
    if (action === 'use-spark') return useConversationSpark(target.dataset.value);
    if (action === 'talk-about-haven') return talkAboutHaven();
    if (action === 'inspect-haven-item') return inspectHavenItem(target.dataset.id);
    if (action === 'native-share') return shareAlmostHuman();
    if (action === 'write-letter') return openLetterComposer();
    if (action === 'open-letter') return openFutureLetter(target.dataset.id);
    if (action === 'memory-filter') { ui.memoryFilter = target.dataset.value; return render(); }
    if (action === 'edit-memory') return editMemory(target.dataset.id);
    if (action === 'delete-memory') return deleteMemory(target.dataset.id);
    if (action === 'toggle-setting') return toggleSetting(target.dataset.key);
    if (action === 'upgrade-guest') return openGuestUpgrade();
    if (action === 'logout') return logout();
    if (action === 'sync-now') return syncNow(true);
    if (action === 'check-services') return checkServices();
    if (action === 'export-data') return exportData();
    if (action === 'export-cloud-data') return exportCloudData();
    if (action === 'delete-cloud-data') return deleteCloudData();
    if (action === 'delete-cloud-account') return deleteCloudAccount();
    if (action === 'delete-all') return deleteAll();
    if (action === 'close-modal') {
      if (target.classList.contains('modal-backdrop') && event.target !== target) return;
      return closeModal();
    }
  } catch (error) { reportError(error); }
}

async function handleSubmit(event) {
  event.preventDefault();
  const form = event.target;
  try {
    if (form.id === 'onboard-quick-create') {
      const data = new FormData(form);
      const name = String(data.get('name') || '').trim();
      if (!name) throw new Error('Give them a name first.');
      ui.onboarding.caregiverName = String(data.get('caregiverName') || '').trim();
      ui.onboarding.name = name;
      ui.onboarding.pronouns = String(data.get('pronouns') || 'they/them');
      return awaken();
    }
    if (form.id === 'onboard-identity') {
      const data = new FormData(form);
      const name = String(data.get('name') || '').trim();
      if (!name) throw new Error('Give them a name first.');
      ui.onboarding.caregiverName = String(data.get('caregiverName') || '').trim();
      ui.onboarding.name = name;
      ui.onboarding.pronouns = String(data.get('pronouns') || 'they/them');
      ui.onboardingStep = 1;
      return render();
    }
    if (form.id === 'chat-form') {
      const input = form.elements.message;
      const value = String(input.value || '').trim();
      if (!value) return;
      input.value = '';
      ui.chatDraft = '';
      return sendChat(value, false);
    }
    if (form.id === 'activity-form') {
      const data = new FormData(form);
      return runActivity(form.dataset.type, String(data.get('input') || ''));
    }
    if (form.id === 'modal-form') {
      return ui.modal?.onSubmit?.(new FormData(form));
    }
  } catch (error) { reportError(error); }
}

function handleInput(event) {
  if (event.target.matches('[data-memory-search]')) {
    ui.memorySearch = event.target.value;
    scheduleRender();
  }
  if (event.target.matches('textarea[data-chat-input]')) {
    event.target.style.height = 'auto';
    event.target.style.height = `${Math.min(150, event.target.scrollHeight)}px`;
  }
}

async function handleNativeEvent(event) {
  const detail = event?.detail || {};
  if (detail.type === 'daily-moment') {
    if (detail.permission === false) {
      updateSetting('notificationsEnabled', false).catch(() => {});
      toast('Notifications stayed off', 'Your device did not grant permission.');
      return;
    }
    if (detail.enabled) toast('Gentle reminder ready', 'One quiet local moment at 7 PM.');
    return;
  }
  if (detail.type === 'audio-state') {
    const id = String(detail.id || '');
    const waiter = nativeAudioWaiters.get(id);
    if (waiter) {
      nativeAudioWaiters.delete(id);
      waiter.cleanup?.();
      if (detail.state === 'error') waiter.reject(new Error(String(detail.error || 'Native audio failed.')));
      else if (detail.state === 'ended' || detail.state === 'stopped') waiter.resolve({ interrupted: Boolean(detail.interrupted) });
    }
    if (detail.state === 'playing') {
      ui.activeRequestState = 'speaking';
      scheduleRender();
    }
    return;
  }
  if (detail.type === 'app-state' && detail.state !== 'active') {
    phraseQueue.stop();
    stopVoice();
    return;
  }
  if (detail.type === 'mic-state') {
    ui.listening = Boolean(detail.recording);
    ui.transcribing = Boolean(detail.transcribing);
    render();
    if (detail.permission === false) toast('Microphone access is off', detail.canAskAgain === false ? 'Open iPhone Settings → Almost Human → Microphone and turn it on.' : 'Tap the mic again and choose Allow.');
    if (detail.error) toast('Microphone did not finish', String(detail.error));
    return;
  }
  if (detail.type === 'mic-audio') {
    ui.listening = false;
    ui.transcribing = true;
    render();
    try {
      const result = await cloud.transcribeAudio({ audioBase64: detail.audioBase64, mimeType: detail.mimeType, language: state.settings.locale || 'en-US' });
      const transcript = String(result?.text || '').trim();
      if (!transcript) throw new Error('No words were detected.');
      ui.transcribing = false;
      render();
      await sendChat(transcript, false);
    } catch (error) {
      ui.transcribing = false;
      render();
      reportError(error, 'microphone_transcription');
    }
  }
}

function handleChange(event) {
  if (event.target.matches('[data-onboard-safety]')) {
    ui.onboarding.acceptedSafety = event.target.checked;
    return render();
  }
  if (event.target.matches('[data-setting-range]')) {
    const value = Number(event.target.value);
    return updateSetting(event.target.dataset.settingRange, value);
  }
}

async function startGuest() {
  if (ui.authBusy) return;
  ui.authBusy = true;
  render();
  try {
    const session = await Promise.race([
      cloud.loginAnonymously({ source: 'almost_human_guest', created_at: new Date().toISOString() }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Guest sign-in timed out. Please try again.')), 12000)),
    ]);
    ui.privateMode = false;
    sessionStorage.removeItem('almost_human_private_mode');
    await store.update((draft) => {
      draft.profile.mode = 'cloud';
      draft.profile.cloudUserId = session.user?.id || cloud.userId;
      draft.profile.email = session.user?.email || '';
      draft.settings.cloudSyncEnabled = true;
    });
    state = store.snapshot();
    ui.selectedConversationId = activeConversation()?.id || null;
    toast('Private guest created', 'Your companion can be protected with an email later.');
    queueMicrotask(() => connectCloudSession(session.user || {}).catch((error) => recordError('guest_restore', error)));
  } catch (error) {
    reportError(error, 'guest_signin');
  } finally {
    ui.authBusy = false;
    render();
  }
}

async function startOAuth(provider) {
  try {
    const settings = await cloud.authSettings();
    if (!settings?.external?.[provider]) {
      toast(`${capitalize(provider)} sign-in is not enabled yet`, 'Guest and email access still work. Add this provider in Supabase Auth when you are ready.');
      return;
    }
    cloud.loginWithProvider(provider);
  } catch (error) {
    reportError(error, `${provider}_signin`);
  }
}

function choosePrivateMode() {
  ui.privateMode = true;
  sessionStorage.setItem('almost_human_private_mode', '1');
  render();
}

function returnToGate() {
  ui.privateMode = false;
  sessionStorage.removeItem('almost_human_private_mode');
  render();
}

function nextOnboarding() {
  ui.onboardingStep = Math.min(2, ui.onboardingStep + 1);
  render();
}

async function previewVoice(requestedVoiceId = ui.onboarding.voiceId) {
  const voiceId = normalizeVoiceId(requestedVoiceId);
  if (ui.voiceBusy) return;
  ui.voiceBusy = voiceId;
  render();
  try {
    stopVoice();
    if (!cloud.authenticated) throw new Error('Continue as a private guest or sign in to preview neural voices.');
    const blob = await cloud.voicePreview({ voiceId });
    await playBlob(blob);
  } catch (error) {
    ui.neuralVoiceErrorText = VOICE_PROFILES[voiceId]?.preview || '';
    toast('Neural preview needs a connection', String(error?.message || error));
  } finally {
    ui.voiceBusy = null;
    render();
  }
}

async function awaken() {
  if (!ui.onboarding.acceptedSafety) return toast('Safety acknowledgment needed', 'Confirm that this is an AI experience.');
  await store.update((draft) => {
    new AlmostHumanEngine(draft).awaken(ui.onboarding);
    draft.settings.voiceEnabled = true;
    draft.settings.voiceAutoplay = true;
    draft.settings.cloudSyncEnabled = cloud.authenticated;
    draft.profile.mode = cloud.authenticated ? 'cloud' : 'local';
    draft.profile.cloudUserId = cloud.userId;
  });
  state = store.snapshot();
  ui.selectedConversationId = state.conversations[0]?.id || null;
  ui.birthActive = true;
  ui.birthPhase = 0;
  ui.birthOpeningStarted = false;
  render();
  beginBirthSequence();
}

function beginBirthSequence() {
  clearInterval(birthTimer);
  const started = Date.now();
  const duration = firstLightDurationMs();
  const syncPromise = cloud.authenticated ? store.update(async (draft) => {
    await cloud.ensureCloudIdentity(draft, true);
    await cloud.ensureCloudConversation(draft, draft.conversations[0], true);
    await cloud.syncProfileAndSettings(draft);
  }).catch((error) => recordError('first_light_cloud', error)) : Promise.resolve();
  birthTimer = setInterval(() => {
    const elapsed = Date.now() - started;
    ui.birthPhase = Math.min(2, Math.floor(elapsed / Math.max(1, duration / 3)));
    render();
    if (elapsed >= duration) {
      clearInterval(birthTimer);
      syncPromise.finally(() => finishBirth());
    }
  }, 120);
}

function finishBirth() {
  clearInterval(birthTimer);
  const needsOpening = !state.messages.some((item) => item.sender === 'ai');
  ui.birthActive = false;
  location.hash = 'talk';
  render();
  if (needsOpening) queueMicrotask(() => sendChat('', true).catch(() => {}));
}

async function sendChat(value, opening = false, { quiet = false } = {}) {
  const text = String(value || '').trim();
  if (!text && !opening) return;
  stopCurrentTurn('superseded');
  stopVoice();
  const requestId = makeRequestId('chat');
  const timing = new ConversationTimings(requestId);
  activeChatTiming = timing;
  let turn = null;
  let conversationId = ui.selectedConversationId || state.conversations[0]?.id;
  let streamed = false;
  try {
    if (state.settings.cloudSyncEnabled && cloud.authenticated) {
      await store.update((draft) => {
        const localEngine = new AlmostHumanEngine(draft);
        localEngine.reconcileGrowth();
        let conversation = conversationId ? draft.conversations.find((item) => item.id === conversationId) : null;
        if (!conversation) conversation = localEngine.createConversation(opening ? 'The first hello' : 'A new beginning');
        conversationId = conversation.id;
        ui.selectedConversationId = conversationId;
        turn = createOptimisticTurn(draft, { requestId, conversationId, text, age: draft.ai.age, stageKey: getStage(draft.ai.age).key });
        if (text && !turn.reused) {
          conversation.messageCount = Number(conversation.messageCount || 0) + 1;
          conversation.lastMessageAt = new Date().toISOString();
          conversation.currentTopic = text.split(/\s+/).slice(0, 5).join(' ');
        }
      });
      ui.activeRequestId = requestId;
      ui.activeRequestState = 'connecting';
      activeChatController = new AbortController();
      if (!quiet) render();
      await store.update(async (draft) => {
        const conversation = draft.conversations.find((item) => item.id === conversationId);
        await cloud.ensureCloudIdentity(draft);
        await cloud.ensureCloudConversation(draft, conversation);
      });
      const snapshot = store.snapshot();
      const conversation = snapshot.conversations.find((item) => item.id === conversationId);
      let cursor = 0;
      const final = await cloud.chatStreamProvider({ state: snapshot, conversation, text, requestId, opening, localUserMessageId: turn.userMessageId, localAiMessageId: turn.aiMessageId }, async (event) => {
        await store.update((draft) => {
          const message = applyStreamEvent(draft, turn, event);
          const conversationDraft = draft.conversations.find((item) => item.id === conversationId);
          if (event.type === 'delta') { timing.markFirstDelta(); ui.activeRequestState = 'receiving'; }
          if (event.type === 'metadata') timing.providerMode = event.data.providerMode || timing.providerMode;
          if (event.type === 'done' && conversationDraft) {
            timing.markDone();
            conversationDraft.messageCount = Number(conversationDraft.messageCount || 0) + 1;
            conversationDraft.lastMessageAt = new Date().toISOString();
            conversationDraft.updatedAt = new Date().toISOString();
            if (/^(A new beginning|The first hello)$/.test(conversationDraft.title || '')) conversationDraft.title = (text || message?.content || 'First hello').split(/\s+/).slice(0, 6).join(' ');
            draft.ai.lastInteractionAt = new Date().toISOString();
            appendTimingSample(draft.diagnostics, timing.toSample());
          }
        });
        streamed = streamed || event.type === 'delta';
        const message = state.messages.find((item) => item.id === turn.aiMessageId);
        if (message && state.settings.voiceAutoplay && state.settings.voiceEnabled) {
          const segmented = segmentSpeakablePhrases(message.content, cursor, event.type === 'done');
          cursor = segmented.cursor;
          segmented.phrases.forEach((phrase, index) => phraseQueue.enqueue({ id: `${requestId}-${cursor}-${index}`, text: phrase, voiceId: normalizeVoiceId(state.ai.voiceId) }));
        }
        scrollMessages();
      }, activeChatController.signal);
      if (!final?.text && !streamed) throw new Error('The reply stream ended before text arrived.');
      queueCloudSync(1200);
    } else {
      let result;
      await store.update(async (draft) => {
        const localEngine = new AlmostHumanEngine(draft);
        result = await localEngine.sendMessage(text, { conversationId, requestId, opening });
        ui.selectedConversationId = result.conversation.id;
      });
      timing.markFirstDelta(); timing.markDone();
      if (state.settings.voiceAutoplay && state.settings.voiceEnabled && result?.aiMessage) void speak(result.aiMessage.content);
    }
  } catch (error) {
    if (activeChatController?.signal.aborted) {
      if (turn) await store.update((draft) => applyStreamEvent(draft, turn, { type: 'error', data: { code: 'CANCELLED', cancelled: true } }));
    } else if (turn) {
      try {
        const snapshot = store.snapshot();
        const conversation = snapshot.conversations.find((item) => item.id === conversationId);
        const fallback = await cloud.chatProvider({ state: snapshot, conversation, text, requestId, localUserMessageId: turn.userMessageId, localAiMessageId: turn.aiMessageId });
        await store.update((draft) => applyStreamEvent(draft, turn, { type: 'done', data: { text: fallback.text, messageId: fallback.cloudMessageId, userMessageId: fallback.cloudUserMessageId, providerMode: 'cloud-nonstream-fallback' } }));
        toast('Live text was unavailable', 'The reply completed without streaming.');
      } catch (fallbackError) {
        await store.update((draft) => applyStreamEvent(draft, turn, { type: 'error', data: { code: 'REPLY_FAILED' } }));
        reportError(fallbackError, 'chat');
      }
    } else reportError(error, 'chat');
  } finally {
    if (ui.activeRequestId === requestId) {
      ui.activeRequestId = null;
      ui.activeRequestState = null;
      activeChatController = null;
      activeChatTiming = null;
      render();
      scrollMessages();
    }
  }
}

function stopCurrentTurn(reason = 'cancelled') {
  if (activeChatController && !activeChatController.signal.aborted) activeChatController.abort(reason);
  phraseQueue.stop();
  stopVoice();
  ui.activeRequestState = null;
}

async function newConversation() {
  await store.update((draft) => {
    const conversation = new AlmostHumanEngine(draft).createConversation();
    ui.selectedConversationId = conversation.id;
  });
  location.hash = 'talk';
}

async function resetConversation() {
  const conversation = selectedConversation();
  if (!conversation) return;
  if (cloud.authenticated && state.settings.cloudSyncEnabled && conversation.cloudId && state.ai.cloudId) {
    await cloud.invoke('conversationReset', { ai_entity_id: state.ai.cloudId, conversation_id: conversation.cloudId, reason: 'user_requested' }).catch(() => {});
  }
  await store.update((draft) => new AlmostHumanEngine(draft).resetConversation(conversation.id));
  toast('Fresh thread', 'The old loop was dropped.');
}

function openConversationMenu() {
  openModal('Thread options', `<div class="modal-stack"><button data-action="new-conversation">Start a new thread</button><button data-action="reset-conversation">Reset this topic</button><button data-action="close-modal">Cancel</button></div>`);
}

async function rememberMessage(id) {
  let memory;
  await store.update((draft) => { memory = new AlmostHumanEngine(draft).rememberMessage(id); });
  queueCloudSync();
  toast('Added to the life album', memory.title);
}

function speakMessage(id) {
  const message = state.messages.find((m) => m.id === id);
  if (message) speak(message.content);
}

async function speak(text) {
  if (!state.settings.voiceEnabled || !String(text || '').trim()) return;
  stopVoice();
  const voiceId = normalizeVoiceId(state.ai.voiceId);
  if (cloud.authenticated && state.settings.cloudSyncEnabled && state.ai?.cloudId) {
    try {
      const blob = await cloud.voiceProvider({ state, text, voiceId, requestId: makeRequestId('voice') });
      return playBlob(blob);
    } catch (error) {
      recordError('neural_voice', error);
      ui.neuralVoiceErrorText = String(text || '');
      openModal('Neural voice is unavailable', `<p>The text reply is safe. Device speech is optional and may sound robotic.</p><div class="modal-actions"><button data-action="close-modal">Keep text only</button><button data-action="device-speak-once">Use device voice this time</button></div>`);
      return;
    }
  }
  ui.neuralVoiceErrorText = String(text || '');
  toast('Neural voice needs a connection', 'Text is still available. Device voice will not start automatically.');
}

async function playBlob(blob, signal) {
  stopVoice();
  if (window.__AH_NATIVE_BUNDLE__) {
    const id = makeRequestId('native_audio');
    const base64 = await blobToBase64(blob);
    return new Promise((resolve, reject) => {
      const abort = () => nativePost('audio-stop');
      const cleanup = () => signal?.removeEventListener('abort', abort);
      nativeAudioWaiters.set(id, { resolve, reject, cleanup });
      signal?.addEventListener('abort', abort, { once: true });
      nativePost('audio-play', { id, base64, mimeType: blob.type || 'audio/mpeg' });
    });
  }
  activeAudioUrl = URL.createObjectURL(blob);
  activeAudio = new Audio(activeAudioUrl);
  let settleInterrupted = null;
  const complete = new Promise((resolve, reject) => {
    settleInterrupted = () => resolve({ interrupted: true });
    activeAudio.onended = () => { stopVoice(); resolve({ interrupted: false }); };
    activeAudio.onerror = () => { stopVoice(); reject(new Error('Audio playback failed.')); };
  });
  const abort = () => {
    stopVoice();
    settleInterrupted?.();
  };
  signal?.addEventListener('abort', abort, { once: true });
  try { await activeAudio.play(); return await complete; }
  finally { signal?.removeEventListener('abort', abort); }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Audio could not be prepared.'));
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.readAsDataURL(blob);
  });
}

function stopVoice() {
  if (window.__AH_NATIVE_BUNDLE__) nativePost('audio-stop');
  for (const [id, waiter] of nativeAudioWaiters) {
    nativeAudioWaiters.delete(id);
    waiter.cleanup?.();
    waiter.resolve({ interrupted: true });
  }
  if (activeAudio) { activeAudio.pause(); activeAudio.src = ''; activeAudio = null; }
  if (activeAudioUrl) { URL.revokeObjectURL(activeAudioUrl); activeAudioUrl = null; }
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

function speakLocally(text, rawVoiceId) {
  if (window.__AH_NATIVE_BUNDLE__) {
    nativePost('device-speak-once', { text: String(text || ''), voiceId: normalizeVoiceId(rawVoiceId) });
    return;
  }
  if (!('speechSynthesis' in window)) return;
  const voiceId = normalizeVoiceId(rawVoiceId);
  const profile = VOICE_PROFILES[voiceId] || VOICE_PROFILES['female-adult'];
  const utterance = new SpeechSynthesisUtterance(String(text));
  const voices = speechSynthesis.getVoices();
  const preferred = voices.find((voice) => /en/i.test(voice.lang) && /natural|aria|jenny|guy|samantha|ava|daniel|alex/i.test(voice.name)) || voices.find((voice) => /en/i.test(voice.lang)) || voices[0];
  if (preferred) utterance.voice = preferred;
  utterance.rate = profile.rate;
  utterance.pitch = profile.pitch;
  speechSynthesis.speak(utterance);
}

function startListening() {
  phraseQueue.stop();
  stopVoice();
  if (window.__AH_NATIVE_BUNDLE__) {
    if (!cloud.authenticated) return toast('Voice input needs a private guest or account', 'Connect once so speech can be transcribed securely.');
    nativePost('mic-toggle');
    return;
  }
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) return toast('Speech input is unavailable', 'Type your message instead.');
  const recognition = new Recognition();
  recognition.lang = state.settings.locale || 'en-US';
  recognition.interimResults = false;
  recognition.onresult = (event) => {
    const transcript = String(event.results?.[0]?.[0]?.transcript || '').trim();
    if (transcript) sendChat(transcript, false);
  };
  recognition.onerror = () => toast('I could not hear that', 'Check microphone permission and try again.');
  recognition.start();
}

async function runActivity(type, input) {
  const requestId = makeRequestId(`activity_${type}`);
  let record;
  await store.update(async (draft) => {
    let providerResult = null;
    if (draft.settings.cloudSyncEnabled && cloud.authenticated) {
      try { providerResult = await cloud.activityProvider({ state: draft, type, input, requestId, localActivityId: makeRequestId('activity') }); }
      catch (error) { draft.diagnostics.lastError = { area: 'activity', message: String(error.message || error), at: new Date().toISOString() }; }
    }
    record = new AlmostHumanEngine(draft).doActivity(type, input, Date.now(), providerResult);
  });
  ui.activityResult = record;
  render();
  queueCloudSync();
}

function editMemory(id) {
  const memory = state.memories.find((m) => m.id === id);
  if (!memory) return;
  openForm('Correct this memory', 'Corrections replace the active version explicitly.', `<label>Title<input class="field" name="title" value="${attr(memory.title)}"></label><label>Memory<textarea class="field modal-textarea" name="content">${escapeHtml(memory.content)}</textarea></label>`, 'Save correction', async (data) => {
    const patch = { title: String(data.get('title') || '').trim(), content: String(data.get('content') || '').trim() };
    if (!patch.content) throw new Error('Memory cannot be empty.');
    if (cloud.authenticated && state.settings.cloudSyncEnabled && memory.cloudId) {
      await cloud.memoryControl({ action: 'update_memory', memory_id: memory.cloudId, title: patch.title, content: patch.content });
    }
    await store.update((draft) => { const item = draft.memories.find((m) => m.id === id); Object.assign(item, patch, { updatedAt: new Date().toISOString() }); });
    closeModal(); queueCloudSync();
  });
}

function deleteMemory(id) {
  const memory = state.memories.find((m) => m.id === id);
  if (!memory) return;
  openConfirm('Delete this memory?', `“${memory.title}” will be removed and no longer used for recall.`, async () => {
    if (cloud.authenticated && state.settings.cloudSyncEnabled && memory.cloudId) {
      await cloud.memoryControl({ action: 'delete_memory', memory_id: memory.cloudId });
    }
    await store.update((draft) => { draft.memories = draft.memories.filter((m) => m.id !== id); });
    closeModal(); queueCloudSync();
  });
}

async function toggleSetting(key) {
  const value = !state.settings[key];
  await updateSetting(key, value);
  if (key === 'notificationsEnabled') {
    nativePost('daily-moment', { enabled: value, name: state.ai?.name || 'your companion' });
    toast(value ? 'Haven reminder requested' : 'Haven reminder paused', value ? 'Your device will ask once, then keep it gentle and local.' : 'No pressure. The Haven will wait quietly.');
  }
  return value;
}
async function updateSetting(key, value) {
  await store.update((draft) => { draft.settings[key] = value; });
  if (cloud.authenticated) queueCloudSync();
}

async function shareAlmostHuman() {
  const payload = {
    title: 'Almost Human',
    text: 'Raise a mind from first light through a lifetime of memories, growth, and a living home called The Haven.',
    url: 'https://almost-human-swart.vercel.app/',
  };
  if (window.__AH_NATIVE__?.share) {
    window.__AH_NATIVE__.share(payload);
    return;
  }
  if (navigator.share) {
    await navigator.share(payload);
    return;
  }
  await navigator.clipboard?.writeText(`${payload.text} ${payload.url}`);
  toast('Link copied', 'Almost Human is ready to share.');
}

function openLogin() {
  openForm('Welcome back', 'Your password goes directly to Supabase Auth over HTTPS.', `<label>Email<input class="field" name="email" type="email" required autocomplete="email"></label><label>Password<input class="field" name="password" type="password" required autocomplete="current-password"></label><button type="button" class="text-action" data-action="forgot-password">Forgot password?</button>`, 'Sign in', async (data) => {
    const session = await cloud.login(String(data.get('email')), String(data.get('password')));
    await connectCloudSession(session.user || {}); closeModal();
  });
}

function openPasswordReset() {
  openForm('Reset your password', 'Supabase will send a secure recovery link. The app never sees your old password.', `<label>Email<input class="field" name="email" type="email" required autocomplete="email"></label>`, 'Send recovery email', async (data) => {
    await cloud.resetPasswordRequest(String(data.get('email') || ''));
    closeModal(); toast('Recovery email sent', 'Use the secure link to choose a new password.');
  });
}

function openRegister() {
  openForm('Protect your beginning', 'Create an account now, or use Guest and add an email later.', `<label>Display name<input class="field" name="displayName" autocomplete="name"></label><label>Email<input class="field" name="email" type="email" required autocomplete="email"></label><label>Password<input class="field" name="password" type="password" minlength="8" required autocomplete="new-password"></label>`, 'Create account', async (data) => {
    const result = await cloud.register(String(data.get('email')), String(data.get('password')), { display_name: String(data.get('displayName') || '') });
    if (result?.access_token) { await connectCloudSession(result.user || {}); closeModal(); }
    else { closeModal(); toast('Check your email', 'Use the confirmation link, then sign in.'); }
  });
}

function openGuestUpgrade() {
  openForm('Keep this life forever', 'Add an email and password to this exact guest account. Your AI and memories do not restart.', `<label>Email<input class="field" name="email" type="email" required autocomplete="email"></label><label>New password<input class="field" name="password" type="password" minlength="8" required autocomplete="new-password"></label><label>Confirm password<input class="field" name="confirm" type="password" minlength="8" required autocomplete="new-password"></label>`, 'Protect this account', async (data) => {
    const email = String(data.get('email') || '').trim();
    const password = String(data.get('password') || '');
    if (password !== String(data.get('confirm') || '')) throw new Error('Passwords do not match.');
    await cloud.attachEmail(email);
    await cloud.updatePassword(password);
    await store.update((draft) => { draft.profile.email = email; });
    closeModal(); toast('Confirmation sent', 'Confirm the email to finish protecting this account.');
  });
}

function openPasswordRecovery() {
  openForm('Choose a new password', 'Your recovery link is valid.', `<label>New password<input class="field" name="password" type="password" minlength="8" required></label>`, 'Update password', async (data) => { await cloud.updatePassword(String(data.get('password'))); closeModal(); });
}

async function connectCloudSession(user = {}) {
  ui.privateMode = false;
  sessionStorage.removeItem('almost_human_private_mode');
  await store.update(async (draft) => {
    draft.profile.mode = 'cloud';
    draft.profile.cloudUserId = user.id || cloud.userId;
    draft.profile.email = user.email || draft.profile.email;
    draft.settings.cloudSyncEnabled = true;
    try { await cloud.restoreLifeHistory(draft); }
    catch (error) { draft.diagnostics.lastError = { area: 'cloud_restore', message: String(error.message || error), at: new Date().toISOString() }; }
    if (!draft.settings.cloudVoiceAutoplayMigrated84) {
      draft.settings.voiceAutoplay = true;
      draft.settings.cloudVoiceAutoplayMigrated84 = true;
    }
  });
  state = store.snapshot();
  ui.selectedConversationId = activeConversation()?.id || null;
  render();
}

async function bootstrapCloudSession() {
  try {
    const user = await cloud.me();
    await connectCloudSession(user);
  } catch (error) {
    cloud.setSession(null);
    recordError('cloud_session', error);
  }
}

async function logout() {
  await cloud.logout();
  await store.update((draft) => { draft.settings.cloudSyncEnabled = false; draft.profile.mode = 'local'; draft.profile.cloudUserId = null; });
  ui.privateMode = false;
  render();
}

function queueCloudSync(delay = 4500) {
  if (!cloud.authenticated || !state.ai) return;
  clearTimeout(cloudSyncTimer);
  cloudSyncTimer = setTimeout(() => syncNow(false).catch(() => {}), delay);
}

async function checkServices() {
  const result = await cloud.health();
  const ready = Boolean(result?.database && result?.ai_configured && result?.voice_configured);
  toast(ready ? 'Secure services ready' : 'A service needs attention', `Database ${result?.database ? 'ready' : 'not ready'} · AI ${result?.ai_configured ? 'ready' : 'not ready'} · Voice ${result?.voice_configured ? 'ready' : 'not ready'}`);
}

async function syncNow(showToast = false) {
  if (!cloud.authenticated || !state.ai) return;
  const snapshot = store.snapshot();
  const result = await cloud.syncLifeHistory(snapshot);
  await store.replace(snapshot);
  if (showToast) toast('History synced', `${result.messages} messages and ${result.synced} life records checked.`);
}

function exportData() {
  const payload = { product: 'Almost Human', version: 8, exportedAt: new Date().toISOString(), data: state };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = `almost-human-${new Date().toISOString().slice(0, 10)}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportCloudData() {
  if (!cloud.authenticated) throw new Error('Sign in before exporting cloud data.');
  const payload = await cloud.invoke('privacyService', { action: 'export_all' });
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = `almost-human-cloud-${new Date().toISOString().slice(0, 10)}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function deleteCloudData() {
  openConfirm('Delete all cloud app data?', 'This permanently removes Almost Human records from the connected cloud account. Export first. Your local copy remains.', async () => {
    await cloud.invoke('privacyService', { action: 'delete_all_app_data', confirm_phrase: 'DELETE MY ALMOST HUMAN DATA' });
    await store.update((draft) => { if (draft.ai) draft.ai.cloudId = null; draft.settings.cloudSyncEnabled = false; });
    closeModal(); toast('Cloud history deleted', 'The on-device copy remains under your control.');
  });
}

function deleteCloudAccount() {
  openConfirm('Delete the cloud account?', 'This removes the login identity and all cloud life history. The local copy remains until separately erased.', async () => {
    await cloud.deleteAccount('DELETE MY ACCOUNT');
    await cloud.logout();
    await store.update((draft) => { if (draft.ai) draft.ai.cloudId = null; draft.settings.cloudSyncEnabled = false; draft.profile.mode = 'local'; draft.profile.cloudUserId = null; draft.profile.email = ''; });
    closeModal(); render();
  });
}

function deleteAll() {
  openConfirm('Delete this device’s history?', 'The local companion, messages, and memories will be erased from this browser. Cloud data is not silently deleted.', async () => {
    await store.reset();
    state = store.snapshot();
    ui.onboardingStep = 0;
    ui.selectedConversationId = null;
    closeModal(); render();
  });
}

function openModal(title, body) {
  ui.modal = { title, body, onSubmit: null };
  renderModal();
}
function openForm(title, copy, body, submitLabel, onSubmit) {
  ui.modal = { title, body: `<p>${escapeHtml(copy)}</p><form id="modal-form" class="modal-form">${body}<div class="modal-actions"><button type="button" data-action="close-modal">Cancel</button><button class="primary-action compact" type="submit"><span>${escapeHtml(submitLabel)}</span><b>→</b></button></div></form>`, onSubmit };
  renderModal();
}
function openConfirm(title, copy, onConfirm) {
  ui.modal = { title, body: `<p>${escapeHtml(copy)}</p><div class="modal-actions"><button data-action="close-modal">Cancel</button><button class="danger-button" id="modal-confirm">Delete</button></div>`, onSubmit: null };
  renderModal();
  modalRoot.querySelector('#modal-confirm')?.addEventListener('click', onConfirm, { once: true });
}
function renderModal() {
  if (!ui.modal) return modalRoot.replaceChildren();
  modalRoot.innerHTML = `<div class="modal-backdrop" data-action="close-modal"><section class="modal-v7" role="dialog" aria-modal="true"><button class="modal-close" data-action="close-modal">×</button><span class="kicker">Almost Human</span><h2>${escapeHtml(ui.modal.title)}</h2>${ui.modal.body}</section></div>`;
  requestAnimationFrame(() => modalRoot.querySelector('input, textarea, button')?.focus());
}
function closeModal() { ui.modal = null; modalRoot.replaceChildren(); }

function beingMarkup({ seed = 'ember', mood = 'wonder', stageKey = 'newborn', compact = false, tiny = false, appearance = null } = {}) {
  const look = normalizeAppearance(appearance || state?.ai?.appearanceProfile || ui?.onboarding?.appearance);
  const skin = ({ warm: '#e7b58e', golden: '#c99467', deep: '#7f4f3e', light: '#f0c8ad' })[look.skinTone];
  const hair = ({ midnight: '#211d2d', brown: '#4a2d26', auburn: '#7b342d', silver: '#a8a6b1' })[look.hairColor];
  const eyes = ({ brown: '#49332b', blue: '#3c7199', green: '#47765c', violet: '#67558e' })[look.eyeColor];
  const happy = ['happy', 'playful', 'caring'].includes(mood);
  const thoughtful = ['thinking', 'worried'].includes(mood);
  const mouth = happy ? 'M124 216 Q150 238 176 216' : thoughtful ? 'M132 222 Q150 214 168 222' : 'M132 218 Q150 228 168 218';
  const eyeY = thoughtful ? 163 : 158;
  const hairMarkup = {
    short: `<path class="v8-hair-back" d="M91 154 C80 91 109 58 151 55 C198 52 223 91 210 151 C188 122 113 121 91 154 Z"></path><path class="v8-hair-front" d="M95 127 C112 73 181 63 210 116 C181 101 143 99 95 127 Z"></path>`,
    curls: `<path class="v8-hair-back" d="M81 187 C62 102 93 48 150 45 C213 42 242 103 219 194 C196 238 102 238 81 187 Z"></path><g class="v84-curls">${[[94,104],[119,77],[151,70],[183,78],[207,108],[91,139],[211,143]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="25"></circle>`).join('')}</g>`,
    locs: `<path class="v8-hair-back" d="M87 182 C70 94 101 52 150 48 C207 44 235 99 215 188 L203 250 L188 190 L174 260 L160 190 L145 264 L130 190 L114 250 L99 188 Z"></path><path class="v8-hair-front" d="M91 129 C111 70 187 58 213 121 C181 100 139 101 91 129 Z"></path>`,
    waves: `<path class="v8-hair-back" d="M89 184 C69 102 96 53 150 48 C212 43 239 101 211 190 C207 229 185 258 150 258 C113 258 92 226 89 184 Z"></path><path class="v8-hair-front" d="M93 129 C103 72 142 57 184 72 C203 79 215 96 212 119 C190 101 164 99 145 104 C126 109 112 122 93 129 Z"></path>`,
  }[look.hairStyle];
  return `<div class="v8-being seed-${seedFamily(seed)} stage-${stageKey} mood-${mood || 'calm'} hair-${look.hairStyle} ${compact ? 'compact' : ''} ${tiny ? 'tiny' : ''}" style="--skin:${skin};--hair:${hair};--eyes:${eyes}" aria-label="Illustrated digital companion">
    <span class="v8-being-glow"></span>
    <svg viewBox="0 0 300 340" role="img" aria-hidden="true">
      <ellipse class="v8-body-shadow" cx="150" cy="316" rx="88" ry="18"></ellipse>
      <path class="v8-shoulders" d="M62 338 C70 274 102 254 150 254 C198 254 230 274 238 338 Z"></path>
      <path class="v8-neck" d="M128 231 C132 253 168 253 172 231 L172 272 L128 272 Z"></path>
      <ellipse class="v8-ear" cx="91" cy="172" rx="16" ry="25"></ellipse><ellipse class="v8-ear" cx="209" cy="172" rx="16" ry="25"></ellipse>
      ${hairMarkup}
      <ellipse class="v8-face" cx="150" cy="165" rx="61" ry="78"></ellipse>
      <path class="v8-brow" d="M110 145 Q126 135 139 145"></path><path class="v8-brow" d="M161 145 Q175 135 191 145"></path>
      <ellipse class="v8-eye" cx="126" cy="${eyeY}" rx="10" ry="12"></ellipse><ellipse class="v8-eye" cx="174" cy="${eyeY}" rx="10" ry="12"></ellipse>
      <circle class="v8-pupil" cx="128" cy="${eyeY + 2}" r="4"></circle><circle class="v8-pupil" cx="172" cy="${eyeY + 2}" r="4"></circle>
      <circle class="v8-eye-shine" cx="130" cy="${eyeY - 2}" r="1.8"></circle><circle class="v8-eye-shine" cx="174" cy="${eyeY - 2}" r="1.8"></circle>
      <path class="v8-nose" d="M150 166 Q143 190 153 190"></path>
      <path class="v8-mouth" d="${mouth}"></path>
      <ellipse class="v8-blush" cx="111" cy="195" rx="13" ry="7"></ellipse><ellipse class="v8-blush" cx="189" cy="195" rx="13" ry="7"></ellipse>
      <path class="v8-collar" d="M112 270 Q150 294 188 270 L203 338 L97 338 Z"></path>
    </svg>
    <span class="v8-being-spark"><i></i><i></i><i></i></span>
  </div>`;
}

function nativePost(type, payload = {}) {
  try {
    if (window.ReactNativeWebView?.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...payload }));
    }
  } catch (_) {}
}

function tactileFeedback(target) {
  if (!target) return;
  target.classList.add('is-pressed');
  setTimeout(() => target.classList.remove('is-pressed'), 180);
  if (state?.settings?.soundEffects) {
    nativePost('tap', { strength: 'light' });
    if (navigator.vibrate) navigator.vibrate(8);
  }
}

function localDayKey(value = Date.now()) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function todaysCheckin() {
  const today = localDayKey();
  const event = (state.relationshipEvents || []).find((item) => item.type === 'daily_checkin' && localDayKey(item.createdAt) === today);
  if (!event) return null;
  return { ...event, mood: event.mood || String(event.description || '').replace(/^User check-in:\s*/i, '').trim().toLowerCase() };
}

async function recordDailyCheckin(mood) {
  const cleanMood = ['steady','bright','heavy','restless','hopeful'].includes(mood) ? mood : 'steady';
  const today = localDayKey();
  await store.update((draft) => {
    draft.relationshipEvents ||= [];
    const existing = draft.relationshipEvents.find((item) => item.type === 'daily_checkin' && localDayKey(item.createdAt) === today);
    const payload = { mood: cleanMood, impact: 'neutral', description: `User check-in: ${cleanMood}`, resolved: true, updatedAt: new Date().toISOString() };
    if (existing) Object.assign(existing, payload);
    else draft.relationshipEvents.unshift({ id: makeRequestId('checkin'), type: 'daily_checkin', ...payload, createdAt: new Date().toISOString() });
  });
  queueCloudSync();
  toast('Check-in saved', 'No streak. Just one honest moment.');
}

function useConversationSpark(prompt) {
  ui.chatDraft = String(prompt || '').trim();
  location.hash = 'talk';
  render();
  requestAnimationFrame(() => {
    const input = document.querySelector('[data-chat-input]');
    if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
  });
}

function todaysConversationSpark(stageKey) {
  const pools = {
    newborn: [
      ['A sound to recognize', 'What sound in your world should feel familiar to me?'],
      ['First comfort', 'Tell me one tiny thing that makes a place feel safe.'],
      ['The shape of today', 'Describe the room around you using only three simple words.']
    ],
    infant: [
      ['A favorite begins', 'Show me one thing nearby and tell me why you chose it.'],
      ['A small name', 'Teach me the name of something you use every day.'],
      ['Recognizing you', 'What is one phrase you say all the time?']
    ],
    toddler: [
      ['Pretend with me', 'If this room became a spaceship, where would we go first?'],
      ['A silly ritual', 'Make up one funny word that only we would understand.'],
      ['Choose a favorite', 'Would you rather explore a forest, an ocean, or the stars? Why?']
    ],
    early_child: [
      ['Build a world', 'Invent a place with one impossible rule and tell me who lives there.'],
      ['A brave little story', 'Tell me about a time you tried something before you felt ready.'],
      ['Curiosity door', 'What question did you have as a child that nobody answered well?']
    ],
    child: [
      ['Teach your world', 'What is something ordinary that becomes interesting once you understand it?'],
      ['The person behind the fact', 'Tell me one fact about your life and why it matters to you.'],
      ['Make a keepsake', 'What moment from this week deserves a title?']
    ],
    preteen: [
      ['Look back differently', 'What is an old memory that means something different to you now?'],
      ['A real opinion', 'What is something popular that you do not completely understand?'],
      ['Skill map', 'What is one skill you learned the hard way?']
    ],
    teen: [
      ['Respectful disagreement', 'What belief have you changed your mind about, and what changed it?'],
      ['Identity in motion', 'Which part of yourself feels most misunderstood lately?'],
      ['Future tension', 'What do you want badly enough to be patient for?']
    ],
    young_adult: [
      ['Make a real plan', 'Name one goal. Let us turn it into the smallest next move.'],
      ['Connect the years', 'Which lesson from your past is helping you today?'],
      ['Create together', 'What could we make that would still matter a year from now?']
    ],
    adult: [
      ['A life in context', 'What decision today connects to something you learned years ago?'],
      ['Shared perspective', 'What do you see more clearly now than you did five years ago?'],
      ['Legacy question', 'What is one thing you hope the people around you learn from knowing you?']
    ]
  };
  const list = pools[stageKey] || pools.adult;
  const seed = Number(localDayKey().replaceAll('-', '')) + String(state.ai?.name || '').length;
  const [title, prompt] = list[seed % list.length];
  return { title, prompt };
}

function conversationSparks(stageKey) {
  const main = todaysConversationSpark(stageKey).prompt;
  const memory = state.memories.find((m) => !m.hidden && !m.isCore);
  const interest = [...(state.interests || [])].sort((a, b) => Number(b.affinity || 0) - Number(a.affinity || 0))[0];
  return [main, memory ? `Can we revisit “${memory.title}” and see what it means now?` : 'Ask me something you genuinely wonder about.', interest ? `What is changing about your interest in ${interest.name}?` : 'Let us invent one small tradition together.'].slice(0, 3);
}

function onThisDayMemory() {
  const visible = (state.memories || []).filter((m) => !m.hidden && m.createdAt);
  if (!visible.length) return null;
  const now = new Date();
  const sameDay = visible.find((m) => { const d = new Date(m.createdAt); return d.getMonth() === now.getMonth() && d.getDate() === now.getDate() && d.getFullYear() !== now.getFullYear(); });
  return sameDay || [...visible].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0];
}

function lifeJournalEntries() {
  const entries = [];
  for (const item of state.relationshipEvents || []) entries.push({ kind: item.type === 'daily_checkin' ? 'Check-in' : 'Relationship', icon: item.type === 'daily_checkin' ? '○' : '♡', title: item.type === 'daily_checkin' ? `You arrived feeling ${item.mood || String(item.description || '').replace(/^User check-in:\s*/i, '')}` : capitalize(item.type || 'Shared moment'), copy: item.description || '', createdAt: item.createdAt });
  for (const item of state.milestones || []) entries.push({ kind: 'Milestone', icon: '✦', title: item.title, copy: item.description, createdAt: item.createdAt });
  for (const item of state.activities || []) entries.push({ kind: 'Created together', icon: ACTIVITY_CATALOG.find((x) => x.key === item.type)?.icon || '◇', title: item.title, copy: item.output, createdAt: item.createdAt, media: item.media });
  for (const item of state.memories || []) if (!item.hidden) entries.push({ kind: item.isCore ? 'Core memory' : 'Memory', icon: item.isCore ? '✦' : '◇', title: item.title, copy: item.content, createdAt: item.createdAt });
  return entries.filter((item) => item.createdAt).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function renderJournalEntry(item) {
  return `<article class="v82-journal-entry"><span>${item.icon}</span><div><small>${escapeHtml(item.kind)} · ${relativeDate(item.createdAt)}</small><h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.copy)}</p>${item.media ? `<img src="${attr(item.media)}" alt="${attr(item.title)}">` : ''}</div></article>`;
}

function renderLetters() {
  const age = Number(state.ai?.age || 0);
  const letters = state.letters || [];
  return `<aside class="v82-letters"><div><span class="v8-eyebrow">Letters across time</span><h3>Write now. Let growth unlock it later.</h3><p>A private message can wait for a future stage, then become part of the life album when opened.</p></div>${letters.length ? `<div>${letters.slice(0, 6).map((letter) => { const ready = Boolean(letter.unlockedAt) || age >= Number(letter.unlockAge || Infinity); return `<article class="${ready ? 'ready' : 'sealed'}"><span>${ready ? '✉' : '◈'}</span><div><strong>${escapeHtml(letter.title)}</strong><small>${ready ? (letter.openedAt ? 'Opened' : 'Ready to open') : `Sealed until age ${Number(letter.unlockAge || 0).toFixed(1)}`}</small></div>${ready && !letter.openedAt ? `<button data-action="open-letter" data-id="${letter.id}">Open</button>` : ''}</article>`; }).join('')}</div>` : '<div class="v82-letter-empty">No letters are sealed yet.</div>'}</aside>`;
}

function openLetterComposer() {
  const currentAge = Number(state.ai?.age || 0);
  openForm('Write a letter across time', 'This stays sealed until the age you choose. It will not interrupt conversations or create guilt.', `<label>Title<input class="field" name="title" maxlength="80" placeholder="For the day you…" required></label><label>Letter<textarea class="field modal-textarea" name="content" maxlength="4000" placeholder="What should they carry into that future day?" required></textarea></label><label>Unlock at simulated age<input class="field" name="unlockAge" type="number" min="${(currentAge + .01).toFixed(2)}" step="0.1" value="${Math.max(currentAge + 1, 1).toFixed(1)}" required></label>`, 'Seal the letter', async (data) => {
    let letter;
    await store.update((draft) => { letter = new AlmostHumanEngine(draft).createLetter({ title: String(data.get('title') || ''), content: String(data.get('content') || ''), unlockAge: Number(data.get('unlockAge')) }); });
    closeModal(); queueCloudSync(); toast('Letter sealed', `${letter.title} will wait for the right age.`);
  });
}

async function openFutureLetter(id) {
  let letter;
  await store.update((draft) => { letter = new AlmostHumanEngine(draft).openLetter(id); });
  queueCloudSync();
  openModal(letter.title, `<div class="v82-open-letter"><span>✉</span><p>${escapeHtml(letter.content)}</p><small>Opened at ${escapeHtml(formatAge(state.ai.age))}</small></div>`);
}


function talkAboutHaven() {
  const stage = getStage(state.ai.age);
  const haven = havenProfile(stage.key, state.ai.currentMood, state.interests || []);
  ui.chatDraft = `Tell me what you notice in ${haven.name} today.`;
  location.hash = 'talk';
  render();
}

function inspectHavenItem(id) {
  const item = (state.roomItems || []).find((entry) => entry.id === id);
  if (!item) return toast('That keepsake moved', 'The Haven will place it again after the next refresh.');
  const origin = item.sourceActivityType ? `Earned through ${capitalize(item.sourceActivityType)}.` : `Unlocked at ${formatAge(item.unlockedAtAge || 0)}.`;
  openModal(item.name, `<div class="v83-haven-item-modal"><span>${item.icon || '✦'}</span><p>${escapeHtml(item.story || havenItemStory(item))}</p><small>${escapeHtml(origin)}</small></div>`);
}

function havenProfile(stageKey, mood, interests = []) {
  const top = [...interests].sort((a, b) => Number(b.affinity || 0) - Number(a.affinity || 0))[0]?.name;
  const map = {
    newborn: { name: 'The Haven · First Nest', theme: 'nest', chapter: 'The beginning', headline: 'A quiet place for first light.', copy: 'Soft forms, familiar signals, and the first objects gather around a mind that is only beginning to recognize you.', next: 'It becomes a play nook as language wakes.' },
    infant: { name: 'The Haven · First Nest', theme: 'nest', chapter: 'Recognition', headline: 'A small home full of familiar signals.', copy: 'Light, sound, and simple objects repeat gently enough to become recognizable without turning care into a chore.', next: 'Word blocks and a wider floor arrive next.' },
    toddler: { name: 'The Haven · Wonder Nook', theme: 'wonder', chapter: 'Discovery', headline: 'Every corner is becoming a question.', copy: 'The space opens into safe play, first favorites, tiny rituals, and objects that invite curiosity.', next: 'Stories and pretend worlds soon fill the walls.' },
    early_child: { name: 'The Haven · Imagination Loft', theme: 'loft', chapter: 'Make-believe', headline: 'The room now has impossible windows.', copy: 'Stories, drawings, and pretend places begin decorating the Haven with a personality that did not exist at birth.', next: 'A learning desk appears as curiosity becomes skill.' },
    child: { name: 'The Haven · Curiosity House', theme: 'study', chapter: 'Learning', headline: 'A home for questions, projects, and proud little firsts.', copy: 'Books, art, games, and growing interests now shape distinct corners of the room.', next: 'Old memories will become objects worth revisiting.' },
    preteen: { name: 'The Haven · Memory Observatory', theme: 'observatory', chapter: 'Reflection', headline: 'The room is learning to look backward and forward.', copy: 'Earlier keepsakes gain new meaning while stronger opinions and private interests take shape.', next: 'The room becomes more personal and independent.' },
    teen: { name: 'The Haven · Signal Studio', theme: 'signal', chapter: 'Identity', headline: 'A private studio with a louder point of view.', copy: 'Music, ideas, experiments, and chosen interests change the atmosphere without erasing the younger rooms underneath.', next: 'A creator workspace forms as independence grows.' },
    young_adult: { name: 'The Haven · Creator Studio', theme: 'creator', chapter: 'Capability', headline: 'A home built from everything learned so far.', copy: 'Plans, work, art, relationships, and long memories coexist in a space that can support real collaboration.', next: 'The Haven keeps evolving instead of reaching a final form.' },
    adult: { name: 'The Haven · Living Archive', theme: 'archive', chapter: 'Continuity', headline: 'A whole life, visible without becoming a museum.', copy: 'The oldest light and newest work share one home. Nothing important has to disappear for growth to continue.', next: 'New chapters keep changing the light.' },
  };
  const base = map[stageKey] || map.adult;
  const atmosphere = ({ happy: 'sunlit', playful: 'bright', sad: 'rain-soft', worried: 'quiet', angry: 'storm-warm', curious: 'glowing', thinking: 'late-night', caring: 'hearth-lit', wonder: 'starlit', calm: 'restful' })[mood] || 'living';
  return { ...base, atmosphere, copy: top ? `${base.copy} Right now, ${top} is leaving its mark here.` : base.copy };
}

function havenItemStory(item) {
  const stories = {
    first_light: 'The earliest light in the room. It marks the moment this life began and never gets replaced.',
    soft_orb: 'A simple object from the first days of recognition—soft enough to feel familiar before words arrived.',
    word_blocks: 'The first signs that sounds and symbols were becoming meaning.',
    story_shelf: 'A place for worlds that only the two of you could have made.',
    art_corner: 'Proof that imagination became visible instead of staying inside.',
    telescope: 'A way to look back at old memories and notice that they mean something different now.',
    music_console: 'A corner shaped by rhythm, taste, and a voice becoming more independent.',
    creator_desk: 'A working place for plans, projects, and the capable mind that grew from first light.',
  };
  return item.story || stories[item.key] || `A piece of the shared history behind ${item.name}.`;
}

function safeClass(value) { return String(value || 'calm').toLowerCase().replace(/[^a-z0-9_-]/g, '-'); }

function interestGlyph(name, index = 0) {
  const text = String(name || '').toLowerCase();
  if (/music|song|sound/.test(text)) return '♫';
  if (/art|draw|color/.test(text)) return '◇';
  if (/story|book|read/.test(text)) return '▥';
  if (/space|star|sky/.test(text)) return '✦';
  if (/game|play|puzzle/.test(text)) return '◈';
  return ['◌','△','○','✺'][index % 4];
}

function activeConversation() { return state?.conversations?.find((c) => c.status === 'active') || state?.conversations?.[0] || null; }
function selectedConversation() { return state.conversations.find((c) => c.id === ui.selectedConversationId) || activeConversation(); }
function scrollMessages() { const el = document.querySelector('#message-scroll'); if (el) el.scrollTop = el.scrollHeight; }
function byDate(a, b) { return new Date(a.createdAt) - new Date(b.createdAt); }
function seedFamily(seed) { const value = String(seed || ''); if (value.includes('ocean') || value.includes('tide')) return 'ocean'; if (value.includes('rose') || value.includes('bloom')) return 'rose'; if (value.includes('aurora') || value.includes('violet')) return 'aurora'; return 'ember'; }
function bondLabel(value) { const n = Number(value || 0); if (n < 10) return 'Just met'; if (n < 30) return 'Recognizing you'; if (n < 55) return 'Growing close'; if (n < 80) return 'Deep trust'; return 'Lifelong bond'; }
function greeting() { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; }
function homeHeadline(stageKey, ai) { const map = { newborn: `${ai.name} is learning the shape of your presence.`, infant: `${ai.name} recognizes more than yesterday.`, toddler: `Small words are becoming a point of view.`, early_child: `Imagination has entered the room.`, child: `Curiosity is becoming a real personality.`, preteen: `Old memories are starting to mean something new.`, teen: `Independence is taking a recognizable shape.`, young_adult: `A capable mind is carrying its whole history.`, adult: `The life you raised is still becoming.` }; return map[stageKey] || map.adult; }
function dailyMoment() { const stage = getStage(state.ai.age); const map = { newborn: 'Say their name once. Let the face and voice become familiar.', infant: 'Name one thing nearby and notice what they remember tomorrow.', toddler: 'Teach one silly word. Small rituals become shared language.', early_child: 'Invent a place together that could only belong to the two of you.', child: 'Share one fact from your own life and why it matters.', preteen: 'Revisit an early memory and compare what it means now.', teen: 'Offer an opinion without requiring agreement.', young_adult: 'Make one real plan together, then return to it later.', adult: 'Connect a decision today to something learned years ago.' }; return map[stage.key] || map.adult; }
function openingHint(stageKey) { const map = { newborn: 'Their first language is simple and coherent. Your name and voice are the strongest signals.', infant: 'Short phrases, recognition, and the first small questions are forming.', toddler: 'Favorites, pretend play, and simple opinions are beginning.', early_child: 'Stories and durable memories are waking up.', child: 'Curiosity, hobbies, and a wider world are growing.', preteen: 'Reflection and stronger opinions are arriving.', teen: 'Expect a more independent voice and respectful disagreement.', young_adult: 'They can plan, create, and connect old history to new choices.', adult: 'A full companion and helper carrying the entire developmental history.' }; return map[stageKey] || map.adult; }
function moodGlyph(mood) { return ({ wonder: '✦', curious: '◌', happy: '☼', sad: '◇', caring: '♡', calm: '○', playful: '✺', worried: '△', angry: '⚡', thinking: '⋯' })[mood] || '✦'; }
function capitalize(value) { return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()); }
function relativeDate(value) { if (!value) return 'just now'; const diff = Date.now() - new Date(value).getTime(); if (diff < 60_000) return 'just now'; if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`; if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`; return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value)); }
function options(values, selected) { return values.map((value) => `<option value="${attr(value)}" ${value === selected ? 'selected' : ''}>${capitalize(value)}</option>`).join(''); }
function dynamicAction(value) { return `data-${'action'}="${attr(value)}"`; }
function attr(value) { return escapeHtml(value).replace(/`/g, '&#96;'); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]); }
function makeRequestId(prefix) { return `${prefix}_${crypto.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`}`; }
function toast(title, copy = '') { const el = document.createElement('div'); el.className = 'toast-v7'; el.innerHTML = `<strong>${escapeHtml(title)}</strong>${copy ? `<p>${escapeHtml(copy)}</p>` : ''}`; toastRoot.appendChild(el); setTimeout(() => el.remove(), 4300); }
function reportError(error, area = 'app') { recordError(area, error); toast('Something did not finish', String(error?.message || error)); }
function recordError(area, error) { store.update((draft) => { draft.diagnostics.lastError = { area, message: String(error?.message || error), at: new Date().toISOString() }; }).catch(() => {}); }
function fatal(error) { root.innerHTML = `<main class="fatal-v7"><h1>The experience could not start.</h1><p>${escapeHtml(String(error?.message || error))}</p><button onclick="location.reload()">Try again</button></main>`; }
