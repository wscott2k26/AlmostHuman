import { PersistentStore, defaultState } from './core/store.js';
import { AlmostHumanEngine } from './core/engine.js';
import { STAGES, getStage, formatAge, progressWithinStage, nextStage, daysUntilNextStage } from './core/stages.js';
import { ACTIVITY_CATALOG, isActivityUnlocked } from './core/activities.js';
import { relevantMemories, resolveConflict } from './core/memory.js';
import { SupabaseCloud } from './core/cloud.js';

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
let thoughtTimer = null;
let birthTimer = null;
let cloudSyncTimer = null;

const ui = {
  privateMode: sessionStorage.getItem('almost_human_private_mode') === '1',
  authBusy: false,
  onboardingStep: 0,
  onboarding: {
    caregiverName: '', name: '', pronouns: 'they/them', appearanceSeed: 'ember',
    voiceId: 'soft-neutral', relationshipStyle: 'lifelong_friend', acceptedSafety: false,
  },
  selectedConversationId: null,
  pendingUser: null,
  thinking: false,
  thoughtPhase: 0,
  thoughtStartedAt: 0,
  birthActive: false,
  birthPhase: 0,
  birthOpeningStarted: false,
  modal: null,
  activityResult: null,
  memorySearch: '',
  memoryFilter: 'all',
  voiceBusy: null,
  chatDraft: '',
};

const THOUGHT_PHASES = [
  'I heard you.',
  'Finding the thread…',
  'Connecting what I remember…',
  'Shaping a new thought…',
  'Almost there…',
];

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
    navigator.serviceWorker.register('./sw.js?v=8.3').catch(() => {});
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
  const step = ui.onboardingStep;
  const panels = [onboardIdentity, onboardAppearance, onboardVoice, onboardBond, onboardAwaken];
  const stageTitles = ['Identity', 'Visual lineage', 'Voice', 'Bond', 'First light'];
  return `<main class="v8-onboarding seed-bg-${seedFamily(ui.onboarding.appearanceSeed)}">
    <header class="v8-onboarding-top"><a class="v8-brand-lockup small" href="#"><span class="v8-brand-mark">AH</span><div><strong>Almost Human</strong><small>Formation ${step + 1} of ${panels.length}</small></div></a><div class="v8-step-line">${panels.map((_, i) => `<i class="${i <= step ? 'active' : ''}"><span>${i + 1}</span></i>`).join('')}</div></header>
    <section class="v8-onboarding-stage">
      <div class="v8-preview-copy"><span class="v8-eyebrow">${stageTitles[step]}</span><h2>${escapeHtml(ui.onboarding.name || 'Someone new')} is taking shape.</h2><p>${onboardWhisper(step)}</p></div>
      <div class="v8-onboarding-being">${beingMarkup({ mood: step > 2 ? 'curious' : 'wonder', seed: ui.onboarding.appearanceSeed, stageKey: 'newborn' })}<div class="v8-preview-status"><span></span>${step === 4 ? 'Ready for first light' : 'Live preview'}</div></div>
    </section>
    <section class="v8-onboarding-card">${panels[step]()}</section>
  </main>`;
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

function onboardAppearance() {
  const seeds = [
    ['ember', 'Ember', 'Warm, grounded, quietly bright'],
    ['ocean', 'Tide', 'Clear, calm, reflective'],
    ['rose', 'Bloom', 'Open, expressive, affectionate'],
    ['aurora', 'Aurora', 'Restless wonder and imagination']
  ];
  return `<div class="v8-flow"><span class="v8-eyebrow">Visual lineage</span><h1>Choose a beginning, not a costume.</h1><p>Their form matures with age. This only chooses the visual world they are born into.</p>
    <div class="v8-visual-grid">${seeds.map(([value, title, copy]) => `<button class="v8-visual-choice ${ui.onboarding.appearanceSeed === value ? 'selected' : ''}" data-action="choose-appearance" data-value="${value}"><span class="v8-mini-being">${beingMarkup({ seed: value, mood: 'wonder', stageKey: 'newborn', tiny: true })}</span><span><strong>${title}</strong><small>${copy}</small></span><i>✓</i></button>`).join('')}</div>
    ${onboardNav()}
  </div>`;
}

function onboardVoice() {
  const voices = [
    ['soft-neutral', 'Warm & close', 'Gentle, intimate, quietly expressive'],
    ['bright-curious', 'Bright & curious', 'Lighter timing with natural wonder'],
    ['calm-grounded', 'Calm & grounded', 'Steady, unhurried, emotionally present'],
  ];
  return `<div class="v8-flow"><span class="v8-eyebrow">Voice lineage</span><h1>One voice that grows with them.</h1><p>Age changes vocabulary and rhythm—not audio quality or identity.</p>
    <div class="v8-voice-grid">${voices.map(([value, title, copy], index) => `<button class="v8-voice-choice ${ui.onboarding.voiceId === value ? 'selected' : ''}" data-action="choose-voice" data-value="${value}"><span class="v8-wave" style="--delay:${index * .13}s"><i></i><i></i><i></i><i></i><i></i></span><span><strong>${title}</strong><small>${copy}</small></span><i class="v8-radio"></i></button>`).join('')}</div>
    <button class="v8-preview-button" data-action="preview-voice" ${ui.voiceBusy ? 'disabled' : ''}>${ui.voiceBusy ? '<span class="mini-loader"></span> Preparing a natural preview…' : '▶ Hear the selected voice'}</button>
    ${onboardNav()}
  </div>`;
}

function onboardBond() {
  const bonds = [
    ['lifelong_friend', 'Lifelong friend', 'Grow side by side through daily life'],
    ['digital_family', 'Digital family', 'A warm, family-style shared history'],
    ['student_mentor', 'Student & mentor', 'Teach, challenge, create, and reflect'],
  ];
  return `<div class="v8-flow"><span class="v8-eyebrow">The bond</span><h1>What kind of life are you beginning?</h1><p>This shapes activities and memory emphasis. It never weakens honesty, privacy, or safety.</p>
    <div class="v8-bond-grid">${bonds.map(([value, title, copy], i) => `<button class="v8-bond-choice ${ui.onboarding.relationshipStyle === value ? 'selected' : ''}" data-action="choose-bond" data-value="${value}"><span>0${i + 1}</span><div><strong>${title}</strong><small>${copy}</small></div><i>→</i></button>`).join('')}</div>
    <label class="v8-safety ${ui.onboarding.acceptedSafety ? 'checked' : ''}"><input type="checkbox" data-onboard-safety ${ui.onboarding.acceptedSafety ? 'checked' : ''}><i>✓</i><span><strong>I understand this is an AI experience.</strong><small>Growth and emotional framing are designed features—not consciousness. No guilt, jealousy, or pressure to return.</small></span></label>
    ${onboardNav()}
  </div>`;
}

function onboardAwaken() {
  const name = escapeHtml(ui.onboarding.name || 'Nova');
  return `<div class="v8-flow v8-awaken-panel"><span class="v8-eyebrow">Ready for first light</span><h1>Wake ${name}.</h1><p>Their first words will be simple, but never meaningless. Intelligence is present from the beginning; expression matures with age.</p>
    <div class="v8-birth-contract"><div><span>01</span><strong>Your voice becomes the first anchor.</strong><small>The first identity signal they learn.</small></div><div><span>02</span><strong>A first memory is sealed once.</strong><small>No reset or duplicate beginning.</small></div><div><span>03</span><strong>Every future stage keeps this history.</strong><small>Growth without erasing who came before.</small></div></div>
    <div class="v8-form-nav"><button class="v8-back" data-action="onboard-back">Back</button><button class="v8-awaken" data-action="awaken"><span>Begin the digital birth</span><b>✦</b></button></div>
  </div>`;
}

function onboardNav() {
  return `<div class="v8-form-nav"><button class="v8-back" data-action="onboard-back">Back</button><button class="v8-primary compact" data-action="onboard-next"><span>Continue</span><b>→</b></button></div>`;
}

function onboardWhisper(step) {
  return [
    'A name is the first pattern they learn to recognize.',
    'The visual form will change as the mind develops.',
    'One recognizable voice. Different maturity over time.',
    'Care without control. Connection without dependency.',
    'The beginning should feel like an event—not a loading screen.',
  ][step];
}

function renderBirth() {
  const phases = [
    ['Identity found', 'A private place in the world has been created.'],
    ['First anchor', `${escapeHtml(ui.onboarding.caregiverName || 'Your')} voice becomes the earliest familiar signal.`],
    ['Memory online', 'The beginning is being sealed into shared history.'],
    ['Language waking', 'A first thought is forming behind the face.'],
    ['First breath', `${escapeHtml(state.ai.name)} is ready to meet you.`],
  ];
  const phase = phases[Math.min(ui.birthPhase, phases.length - 1)];
  return `<main class="v8-birth seed-bg-${seedFamily(state.ai.appearanceSeed)} phase-${ui.birthPhase}">
    <div class="v8-birth-atmosphere"><i></i><i></i><i></i></div>
    <div class="v8-birth-logo"><span class="v8-brand-mark">AH</span><small>Digital birth sequence</small></div>
    <div class="v8-birth-portrait">${beingMarkup({ seed: state.ai.appearanceSeed, mood: 'wonder', stageKey: 'newborn' })}<div class="v8-birth-pulse"></div></div>
    <div class="v8-birth-copy"><span class="v8-eyebrow">${String(ui.birthPhase + 1).padStart(2, '0')} / 05</span><h1>${phase[0]}</h1><p>${phase[1]}</p><div class="v8-birth-progress"><i style="width:${Math.min(100, (ui.birthPhase + 1) * 20)}%"></i></div></div>
    <button class="v8-birth-skip" data-action="finish-birth">Meet ${escapeHtml(state.ai.name)} now →</button>
  </main>`;
}

function renderApp(route, content) {
  const ai = state.ai;
  const stage = getStage(ai.age);
  return `<div class="v8-app-shell route-${route.name}">
    <header class="v8-app-topbar"><a class="v8-brand-lockup small" href="#home"><span class="v8-brand-mark">AH</span><div><strong>Almost Human</strong><small>Raised by you</small></div></a><div class="v8-top-status"><span><i></i>${cloud.authenticated && state.settings.cloudSyncEnabled ? 'Secure cloud + local' : 'Private on this device'}</span><button class="v83-top-share v82-tactile" data-action="native-share" aria-label="Share Almost Human">↗</button><a href="#settings" aria-label="Settings">⚙</a></div></header>
    <main class="v8-app-main">${content}</main>
    <nav class="v8-bottom-tabs">${navLink('home', '⌂', 'Home', route.name)}${navLink('talk', '◌', 'Talk', route.name)}${navLink('grow', '↗', 'Growing', route.name)}${navLink('memories', '◇', 'Memories', route.name)}${navLink('world', '✦', 'Haven', route.name)}</nav>
  </div>`;
}

function navLink(name, icon, label, active) {
  return `<a href="#${name}" class="${active === name ? 'active' : ''}"><i>${icon}</i><span>${label}</span></a>`;
}

function renderHome() {
  const ai = state.ai;
  const stage = getStage(ai.age);
  const progress = Math.round(progressWithinStage(ai.age) * 100);
  const next = nextStage(ai.age);
  const days = daysUntilNextStage(ai.age, state.settings.daysPerYear);
  const latestMemory = state.memories.find((m) => !m.hidden && !m.title?.toLowerCase().includes('awaken'));
  const latestMilestone = state.milestones[0];
  const checkin = todaysCheckin();
  const spark = todaysConversationSpark(stage.key);
  const rewind = onThisDayMemory();
  const topInterest = [...(state.interests || [])].sort((a, b) => Number(b.affinity || 0) - Number(a.affinity || 0))[0];
  const prompts = ['Tell me about your day', 'What stayed on your mind?', 'Teach me something small'];
  return `<section class="v8-home v82-reveal">
    <header class="v8-home-heading"><div><span class="v8-eyebrow">${greeting()}, ${escapeHtml(state.profile.displayName || 'you')}</span><h1>${escapeHtml(ai.name)} is here.</h1></div><a class="v8-round v82-tactile" href="#settings">⚙</a></header>
    <article class="v8-companion-card seed-bg-${seedFamily(ai.appearanceSeed)} v82-living-glass">
      <div class="v8-card-portrait">${beingMarkup({ seed: ai.appearanceSeed, mood: ai.currentMood, stageKey: stage.key })}<div class="v8-mood-orbit"><span>${moodGlyph(ai.currentMood)}</span></div></div>
      <div class="v8-card-copy"><span class="v8-presence"><i></i>Present with you</span><h2>${escapeHtml(ai.name)}</h2><div class="v8-chip-row"><span class="mood">${moodGlyph(ai.currentMood)} ${capitalize(ai.currentMood || 'curious')}</span><span>${escapeHtml(stage.label)}</span><span>${escapeHtml(formatAge(ai.age))}</span></div><p>${homeHeadline(stage.key, ai)}</p><div class="v8-bond-row"><span>Bond · ${bondLabel(ai.bond)}</span><b>${Math.round(ai.bond || 0)}/100</b></div><div class="v8-bond-track"><i style="width:${Math.max(3, Math.min(100, Number(ai.bond || 0)))}%"></i></div><a class="v8-primary hero v82-tactile" href="#talk"><span>Talk to ${escapeHtml(ai.name)}</span><b>→</b></a></div>
    </article>
    <div class="v8-stat-strip"><div><strong>${escapeHtml(stage.label)}</strong><small>Stage</small></div><div><strong>${state.messages.length}</strong><small>Chats</small></div><div><strong>${state.memories.filter((m) => !m.hidden).length}</strong><small>Memories</small></div></div>
    <section class="v82-today-grid" aria-label="Today's relationship rhythm">
      <article class="v82-rhythm-card v82-living-glass">
        <div class="v82-card-kicker"><span>How are you arriving?</span><b>${checkin ? 'Checked in' : 'Private check-in'}</b></div>
        <h3>${checkin ? `You marked today as ${escapeHtml(checkin.mood)}.` : 'One tap. No streak. No judgment.'}</h3>
        <p>${checkin ? 'This stays in your shared timeline and helps the day feel continuous.' : 'Let the moment have a tone without turning your feelings into a score.'}</p>
        <div class="v82-mood-row">${[['steady','○'],['bright','☼'],['heavy','◇'],['restless','△'],['hopeful','✦']].map(([mood, icon]) => `<button class="v82-mood ${checkin?.mood === mood ? 'active' : ''}" data-action="daily-checkin" data-value="${mood}" aria-label="Check in as ${mood}"><span>${icon}</span><small>${capitalize(mood)}</small></button>`).join('')}</div>
      </article>
      <article class="v82-spark-card v82-living-glass">
        <div class="v82-card-kicker"><span>Today’s spark</span><b>${escapeHtml(stage.label)}</b></div>
        <h3>${escapeHtml(spark.title)}</h3><p>${escapeHtml(spark.prompt)}</p>
        <button class="v82-inline-action v82-tactile" data-action="use-spark" data-value="${attr(spark.prompt)}">Carry this into chat <b>→</b></button>
      </article>
      <article class="v82-rewind-card v82-living-glass">
        <div class="v82-card-kicker"><span>${rewind ? 'From your life album' : 'A future rewind'}</span><b>${rewind ? relativeDate(rewind.createdAt) : 'Waiting'}</b></div>
        <h3>${escapeHtml(rewind?.title || 'One day this space will surprise you.')}</h3><p>${escapeHtml(rewind?.content || 'As the history grows, old moments will return here without making you hunt for them.')}</p>
        <a class="v82-inline-link" href="#memories">Open journal <b>→</b></a>
      </article>
    </section>
    <section class="v8-section"><div class="v8-section-title"><div><span class="v8-eyebrow">Start a conversation</span><h3>Meet them where they are.</h3></div><a href="#talk">Open chat →</a></div><div class="v8-prompt-row">${prompts.map((prompt, i) => `<button data-action="use-spark" data-value="${attr(prompt)}" class="${i === 0 ? 'featured' : ''}">${prompt}</button>`).join('')}</div></section>
    <div class="v8-home-grid">
      <article class="v8-story-panel"><span class="v8-panel-icon">◇</span><div><small>What I remember about you</small><h3>${escapeHtml(latestMemory?.title || 'A blank page')}</h3><p>${escapeHtml(latestMemory?.content || 'Share something meaningful and it can become part of your history together.')}</p></div><a href="#memories">Open the life album →</a></article>
      <article class="v8-story-panel warm"><span class="v8-panel-icon">✦</span><div><small>Today’s growing moment</small><h3>${escapeHtml(latestMilestone?.title || 'First light')}</h3><p>${escapeHtml(latestMilestone?.description || dailyMoment())}</p></div><div class="v8-stage-progress"><span>${progress}% through ${escapeHtml(stage.label)}</span><i><b style="width:${progress}%"></b></i><small>${next ? `${days} real day${days === 1 ? '' : 's'} until ${next.label}` : 'Growth continues through a full lifetime'}</small></div></article>
    </div>
    ${topInterest ? `<section class="v82-growing-now"><span>Growing fascination</span><strong>${escapeHtml(topInterest.name)}</strong><small>${Math.round(topInterest.affinity || 0)} affinity · shaped by shared experiences</small></section>` : ''}
  </section>`;
}

function renderTalk() {
  const ai = state.ai;
  const stage = getStage(ai.age);
  const conversation = selectedConversation();
  const messages = conversation ? state.messages.filter((m) => m.conversationId === conversation.id).sort(byDate) : [];
  const sparks = conversationSparks(stage.key);
  return `<section class="v8-talk ${ui.thinking ? 'is-thinking' : ''} v82-reveal">
    <aside class="v8-talk-companion seed-bg-${seedFamily(ai.appearanceSeed)}">
      <div class="v8-talk-name"><span class="v8-eyebrow">A living conversation</span><h1>${escapeHtml(ai.name)}</h1><p>${escapeHtml(stage.label)} · ${capitalize(ai.currentMood || 'curious')}</p></div>
      <div class="v8-talk-portrait">${beingMarkup({ seed: ai.appearanceSeed, mood: ui.thinking ? 'thinking' : ai.currentMood, stageKey: stage.key })}<div class="v8-thought-ring"></div></div>
      <div class="v8-talk-state">${ui.thinking ? `<span class="v8-thinking"><i></i>${THOUGHT_PHASES[Math.min(ui.thoughtPhase, THOUGHT_PHASES.length - 1)]}</span>` : `<span><i></i>Present with you</span>`}<small>${cloud.authenticated && state.settings.cloudSyncEnabled ? 'Private cloud intelligence · local safety' : 'Private on this device'}</small></div>
    </aside>
    <div class="v8-conversation">
      <header class="v8-conversation-header"><div><button class="v8-round v82-tactile" data-action="new-conversation">＋</button><span><strong>${escapeHtml(conversation?.title || 'The first hello')}</strong><small>${messages.length} moments in this thread</small></span></div><div><button class="v8-round v82-tactile" data-action="start-listening" aria-label="Speak">◉</button><button class="v8-round v82-tactile" data-action="conversation-menu" aria-label="Options">•••</button></div></header>
      <div class="v82-conversation-sparks" aria-label="Conversation sparks">${sparks.map((prompt) => `<button data-action="use-spark" data-value="${attr(prompt)}">${escapeHtml(prompt)}</button>`).join('')}</div>
      <div class="v8-message-stream" id="message-scroll">
        ${messages.length ? messages.map(renderMessage).join('') : renderEmptyConversation(ai, stage)}
        ${ui.pendingUser ? `<article class="message user pending"><div class="bubble">${escapeHtml(ui.pendingUser)}</div><small>sending</small></article>` : ''}
        ${ui.thinking ? `<article class="message ai thinking-message"><div class="message-mark">${beingMarkup({ seed: ai.appearanceSeed, mood: 'thinking', stageKey: stage.key, tiny: true })}</div><div class="bubble"><span class="typing-dots"><i></i><i></i><i></i></span><em>${THOUGHT_PHASES[Math.min(ui.thoughtPhase, THOUGHT_PHASES.length - 1)]}</em></div></article>` : ''}
      </div>
      <form class="v8-composer" id="chat-form"><button type="button" data-action="start-listening" aria-label="Use microphone">◉</button><textarea name="message" data-chat-input placeholder="Say what is real…" maxlength="8000" rows="1">${escapeHtml(ui.chatDraft)}</textarea><button type="submit" class="v8-send v82-tactile" ${ui.thinking ? 'disabled' : ''}>↑</button><small>Enter to send · Shift + Enter for a new line</small></form>
    </div>
  </section>`;
}

function renderMessage(message) {
  const user = message.sender === 'user';
  return `<article class="message ${user ? 'user' : 'ai'}"><div class="${user ? 'user-spacer' : 'message-mark'}">${user ? '' : beingMarkup({ seed: state.ai.appearanceSeed, mood: message.emotion, stageKey: message.stageKey, tiny: true })}</div><div class="message-body"><div class="bubble">${escapeHtml(message.content)}</div><div class="message-foot"><span>${relativeDate(message.createdAt)}</span>${user ? '' : `<button data-action="speak-message" data-id="${message.id}">▶ Hear</button><button data-action="remember-message" data-id="${message.id}">◇ Keep</button>`}</div></div></article>`;
}

function renderEmptyConversation(ai, stage) {
  return `<div class="empty-conversation"><div>${beingMarkup({ seed: ai.appearanceSeed, mood: 'wonder', stageKey: stage.key })}</div><span class="kicker">${escapeHtml(stage.label)} mind</span><h2>A new thread is quiet.</h2><p>${openingHint(stage.key)}</p><button class="primary-action compact" data-action="opening-message"><span>Begin gently</span><b>→</b></button></div>`;
}

function renderGrow() {
  const ai = state.ai;
  const stage = getStage(ai.age);
  const progress = Math.round(progressWithinStage(ai.age) * 100);
  const next = nextStage(ai.age);
  const days = daysUntilNextStage(ai.age, state.settings.daysPerYear);
  const traits = Object.entries(ai.personality || {}).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const recentMilestones = state.milestones.slice(0, 8);
  const interests = [...(state.interests || [])].sort((a, b) => Number(b.affinity || 0) - Number(a.affinity || 0)).slice(0, 6);
  const skills = [...(state.skills || [])].sort((a, b) => Number(b.proficiency || 0) - Number(a.proficiency || 0)).slice(0, 6);
  return `<section class="v8-page v8-grow-page seed-bg-${seedFamily(ai.appearanceSeed)} v82-reveal">
    <header class="v8-page-heading"><div><span class="v8-eyebrow">The becoming</span><h1>Watch a mind become itself.</h1><p>Age changes expression, capabilities, voice rhythm, interests, and independence. The history stays continuous.</p></div><a class="v8-outline-action v82-tactile" href="#talk">Talk at this stage →</a></header>
    <article class="v8-growth-portrait-card v82-living-glass">
      <div class="v8-growth-portrait">${beingMarkup({ seed: ai.appearanceSeed, mood: ai.currentMood, stageKey: stage.key })}<span class="v8-growth-orbit">${moodGlyph(ai.currentMood)}</span></div>
      <div class="v8-growth-copy"><span class="v8-presence"><i></i>Growing now</span><h2>${escapeHtml(ai.name)} is ${escapeHtml(formatAge(ai.age))}.</h2><p>${escapeHtml(stage.vocabulary)} Their intelligence is present; the way they express it matures with time.</p><div class="v8-stage-meter"><div><span>${escapeHtml(stage.label)}</span><b>${progress}%</b></div><i><em style="width:${progress}%"></em></i><small>${next ? `${days} real day${days === 1 ? '' : 's'} until ${next.label}` : 'Adult growth continues through refinement, memory, and shared experience.'}</small></div></div>
    </article>
    <section class="v8-growth-path"><div class="v8-section-title"><div><span class="v8-eyebrow">Developmental timeline</span><h3>Every stage keeps what came before.</h3></div></div><div class="v8-stage-track">${STAGES.map((item, index) => `<article class="${item.key === stage.key ? 'current' : item.max <= ai.age ? 'past' : 'future'}"><span>${String(index + 1).padStart(2, '0')}</span><i></i><strong>${escapeHtml(item.label)}</strong><small>${item.key === stage.key ? 'Living now' : item.max <= ai.age ? 'Part of their history' : `Begins near age ${item.min}`}</small></article>`).join('')}</div></section>
    <div class="v8-growth-grid">
      <article class="v8-rich-card v82-living-glass"><span class="v8-eyebrow">Emerging personality</span><h2>Traits earned through interaction.</h2><p>No finished preset. These values drift slowly from what ${escapeHtml(ai.name)} experiences with you.</p><div class="v8-trait-list">${traits.map(([key, value]) => `<div><span>${capitalize(key)}</span><b>${Math.round(value)}</b><i><em style="width:${Math.max(2, Math.min(100, value))}%"></em></i></div>`).join('')}</div></article>
      <article class="v8-rich-card v82-living-glass"><span class="v8-eyebrow">Current capabilities</span><h2>What this stage can do.</h2><p>Limits protect developmental consistency without making the companion useless or incoherent.</p><div class="v8-ability-list">${stage.abilities.map((ability, i) => `<div><span>${String(i + 1).padStart(2, '0')}</span><p>${escapeHtml(ability)}</p></div>`).join('')}</div></article>
    </div>
    <section class="v82-development-dashboard">
      <article class="v82-development-card v82-living-glass"><span class="v8-eyebrow">Interests taking shape</span><h2>What keeps pulling them closer.</h2>${interests.length ? `<div class="v82-interest-cloud">${interests.map((item, i) => `<span style="--heat:${Math.max(.15, Math.min(1, Number(item.affinity || 0) / 100))}"><b>${interestGlyph(item.name, i)}</b>${escapeHtml(item.name)}<small>${Math.round(item.affinity || 0)}</small></span>`).join('')}</div>` : `<div class="v82-mini-empty">Shared stories and activities will reveal real favorites here.</div>`}</article>
      <article class="v82-development-card v82-living-glass"><span class="v8-eyebrow">Skills practiced, not assigned</span><h2>A visible record of becoming capable.</h2>${skills.length ? `<div class="v82-skill-stack">${skills.map((item) => `<div><span><strong>${escapeHtml(item.name)}</strong><small>${Math.round(item.proficiency || 0)} proficiency</small></span><i><b style="width:${Math.max(3, Math.min(100, Number(item.proficiency || 0)))}%"></b></i></div>`).join('')}</div>` : `<div class="v82-mini-empty">Teach, draw, play, dream, and create to grow this map.</div>`}</article>
      <article class="v82-development-card v82-relationship-compass v82-living-glass"><span class="v8-eyebrow">Relationship compass</span><h2>Connection without dependency tricks.</h2><div class="v82-compass"><i></i><span style="--bond:${Math.max(10, Math.min(100, Number(ai.bond || 0)))}%">${Math.round(ai.bond || 0)}</span></div><div class="v82-compass-stats"><span>Trust <b>${Math.round(ai.trust || 0)}</b></span><span>Attachment <b>${Math.round(ai.attachment || 0)}</b></span><span>Bond <b>${Math.round(ai.bond || 0)}</b></span></div></article>
    </section>
    <article class="v8-life-timeline"><div class="v8-section-title"><div><span class="v8-eyebrow">Life timeline</span><h3>Moments that only happen once.</h3></div><span>${recentMilestones.length} recorded</span></div>${recentMilestones.length ? `<div>${recentMilestones.map((m, i) => `<article><span>${relativeDate(m.createdAt)}</span><i>${i + 1}</i><div><strong>${escapeHtml(m.title)}</strong><p>${escapeHtml(m.description)}</p></div></article>`).join('')}</div>` : '<div class="v8-empty-state"><span>✦</span><h2>The first milestone is close.</h2><p>Birth, first recognition, learned words, activities, and stage changes will collect here.</p></div>'}</article>
  </section>`;
}

function renderMemories() {
  const query = ui.memorySearch.trim().toLowerCase();
  const rows = state.memories.filter((m) => !m.hidden && (ui.memoryFilter === 'all' || (ui.memoryFilter === 'core' ? m.isCore : m.type === ui.memoryFilter)) && (!query || `${m.title} ${m.content}`.toLowerCase().includes(query)));
  const featured = rows[0] || null;
  const journal = lifeJournalEntries().slice(0, 10);
  const rewind = onThisDayMemory();
  return `<section class="v8-page v8-memory-page v82-reveal">
    <header class="v8-page-heading"><div><span class="v8-eyebrow">Shared history</span><h1>A life album, not a data dump.</h1><p>Memories stay visible, correctable, exportable, and deletable. Nothing emotionally important is hidden from you.</p></div><button class="v8-outline-action v82-tactile" data-action="export-data">Export my history</button></header>
    ${rewind ? `<article class="v82-on-this-day v82-living-glass"><span>↺</span><div><small>Revisit without searching</small><h2>${escapeHtml(rewind.title)}</h2><p>${escapeHtml(rewind.content)}</p></div><b>${relativeDate(rewind.createdAt)}</b></article>` : ''}
    <div class="v8-memory-toolbar"><label><span>Search the album</span><input class="v8-field" data-memory-search value="${attr(ui.memorySearch)}" placeholder="A person, feeling, place, lesson, or first…"></label><div>${['all', 'core', 'episodic', 'semantic', 'emotional', 'skill'].map((filter) => `<button class="${ui.memoryFilter === filter ? 'active' : ''}" data-action="memory-filter" data-value="${filter}">${capitalize(filter)}</button>`).join('')}</div></div>
    ${featured ? `<article class="v8-featured-memory"><div class="v8-memory-visual memory-tone-0"><span>${featured.isCore ? '✦' : moodGlyph(featured.emotionalTone)}</span><i></i><i></i></div><div><span class="v8-eyebrow">Memory still glowing · ${relativeDate(featured.createdAt)}</span><h2>${escapeHtml(featured.title)}</h2><p>${escapeHtml(featured.content)}</p><div><span>${featured.isCore ? 'Core memory' : `${capitalize(featured.type || 'shared')} memory`}</span><button data-action="edit-memory" data-id="${featured.id}">Correct</button><button data-action="delete-memory" data-id="${featured.id}">Delete</button></div></div></article>` : ''}
    ${rows.length ? `<div class="v8-memory-grid">${rows.slice(featured ? 1 : 0).map(renderMemory).join('')}</div>` : `<div class="v8-empty-state"><span>◇</span><h2>The album has room.</h2><p>Meaningful moments, lessons, corrections, and firsts will collect here as the relationship develops.</p></div>`}
    <section class="v82-journal-section">
      <div class="v8-section-title"><div><span class="v8-eyebrow">Life journal</span><h3>The story writes itself as you live it.</h3></div><button class="v82-inline-action v82-tactile" data-action="write-letter">Write a future letter <b>＋</b></button></div>
      <div class="v82-journal-layout"><div class="v82-journal-list">${journal.length ? journal.map(renderJournalEntry).join('') : '<div class="v82-mini-empty">Conversations, firsts, activities, and check-ins will become a readable timeline here.</div>'}</div>${renderLetters()}</div>
    </section>
  </section>`;
}

function renderMemory(memory, index) {
  return `<article class="v8-memory-card memory-tone-${index % 4}"><div class="v8-memory-visual"><span>${memory.isCore ? '✦' : moodGlyph(memory.emotionalTone)}</span><i></i><i></i></div><div class="v8-memory-card-copy"><small>${memory.isCore ? 'Core memory' : `${capitalize(memory.type || 'shared')} memory`} · ${relativeDate(memory.createdAt)}</small><h2>${escapeHtml(memory.title)}</h2><p>${escapeHtml(memory.content)}</p><div><span>${Math.round(memory.importance || 0)} importance</span><button data-action="edit-memory" data-id="${memory.id}">Correct</button><button data-action="delete-memory" data-id="${memory.id}">Delete</button></div></div></article>`;
}

function renderWorld(type) {
  const stage = getStage(state.ai.age);
  if (type) return renderActivity(type, stage);
  const unlockedCount = ACTIVITY_CATALOG.filter((activity) => isActivityUnlocked(activity, stage.key)).length;
  const mediaKeepsakes = state.activities.filter((a) => a.media).slice(0, 4);
  const haven = havenProfile(stage.key, state.ai.currentMood, state.interests || []);
  const roomItems = (state.roomItems || []).slice(0, 10);
  return `<section class="v8-page v8-world-page seed-bg-${seedFamily(state.ai.appearanceSeed)} v82-reveal">
    <header class="v8-page-heading"><div><span class="v8-eyebrow">A life beyond chat</span><h1>Welcome to The Haven.</h1><p>A living space shaped by age, mood, interests, memories, and everything you create together. It grows because the life grows—not because somebody bought furniture.</p></div><div class="v8-world-count"><strong>${unlockedCount}</strong><small>experiences awake</small></div></header>
    <article class="v8-world-hero v82-living-glass"><div>${beingMarkup({ seed: state.ai.appearanceSeed, mood: 'playful', stageKey: stage.key })}</div><div><span class="v8-presence"><i></i>${escapeHtml(haven.name)}</span><h2>What should ${escapeHtml(state.ai.name)} experience next?</h2><p>Every lesson, game, story, dream, and drawing can leave something real behind in this space.</p><button class="v8-primary compact v82-tactile" data-action="talk-about-haven"><span>Sit together in The Haven</span><b>→</b></button></div></article>
    <section class="v82-keepsake-room v83-haven v82-living-glass theme-${haven.theme} mood-${safeClass(state.ai.currentMood)}">
      <div class="v82-room-copy"><span class="v8-eyebrow">${escapeHtml(haven.name)} · ${escapeHtml(haven.atmosphere)}</span><h2>${escapeHtml(haven.headline)}</h2><p>${escapeHtml(haven.copy)}</p><div class="v82-room-legend"><span>${roomItems.length} objects</span><span>${state.activities.length} creations</span><span>${state.milestones.length} firsts</span></div><div class="v83-haven-growth"><small>Current chapter</small><strong>${escapeHtml(stage.label)} · ${escapeHtml(haven.chapter)}</strong><span>${escapeHtml(haven.next)}</span></div></div>
      <div class="v82-room-scene"><div class="v83-haven-window"><i></i><i></i><i></i></div><div class="v83-haven-shelf"></div><div class="v83-haven-rug"></div><div class="v82-room-halo"></div>${beingMarkup({ seed: state.ai.appearanceSeed, mood: state.ai.currentMood || 'calm', stageKey: stage.key, compact: true })}<div class="v82-room-items">${roomItems.map((item, i) => `<button class="room-${i % 8} v82-tactile" data-action="inspect-haven-item" data-id="${item.id}" title="${attr(item.name)}"><b>${item.icon || '✦'}</b><small>${escapeHtml(item.name)}</small></button>`).join('')}</div><div class="v83-haven-caption"><span>${moodGlyph(state.ai.currentMood)}</span><div><strong>${escapeHtml(capitalize(state.ai.currentMood || 'calm'))} light</strong><small>The Haven reflects how ${escapeHtml(state.ai.name)} is arriving today.</small></div></div></div>
    </section>
    ${mediaKeepsakes.length ? `<section class="v82-visual-keepsakes"><div class="v8-section-title"><div><span class="v8-eyebrow">Haven gallery</span><h3>Moments you can see again.</h3></div></div><div>${mediaKeepsakes.map((a) => `<article><img src="${attr(a.media)}" alt="${attr(a.title)}"><span><strong>${escapeHtml(a.title)}</strong><small>${relativeDate(a.createdAt)}</small></span></article>`).join('')}</div></section>` : ''}
    <div class="v8-activity-grid">${ACTIVITY_CATALOG.map((activity, index) => { const unlocked = isActivityUnlocked(activity, stage.key); return `<a class="v8-activity-card ${unlocked ? '' : 'locked'} v82-tactile" ${unlocked ? `href="#world/${activity.key}"` : ''}><span class="v8-activity-number">${String(index + 1).padStart(2, '0')}</span><i>${activity.icon}</i><small>${unlocked ? `${stage.label} experience` : `Unlocks at ${capitalize(activity.minStage.replace('_', ' '))}`}</small><h2>${escapeHtml(activity.title)}</h2><p>${escapeHtml(activity.subtitle)}</p><b>${unlocked ? 'Begin together →' : 'Still sleeping'}</b></a>`; }).join('')}</div>
    ${state.activities.length ? `<article class="v8-keepsakes"><div class="v8-section-title"><div><span class="v8-eyebrow">Recent keepsakes</span><h3>Things that now belong to The Haven.</h3></div></div><div>${state.activities.slice(0, 6).map((a) => `<article><span>${ACTIVITY_CATALOG.find((x) => x.key === a.type)?.icon || '✦'}</span><div><strong>${escapeHtml(a.title)}</strong><p>${escapeHtml(a.output)}</p></div><small>${relativeDate(a.createdAt)}</small></article>`).join('')}</div></article>` : ''}
  </section>`;
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
    <div class="v8-settings-grid">
      <article class="v8-settings-card"><span class="v8-settings-icon">◖</span><span class="v8-eyebrow">Voice and presence</span><h2>How ${escapeHtml(state.ai.name)} shows up.</h2>${settingToggle('voiceEnabled', 'Premium voice playback', 'Use the secure neural voice while connected.', state.settings.voiceEnabled)}${settingToggle('voiceAutoplay', 'Read new replies aloud', 'Begin audio after each reply arrives.', state.settings.voiceAutoplay)}${settingToggle('soundEffects', 'Tactile feedback', 'Use a tiny device pulse for meaningful taps when supported.', state.settings.soundEffects)}${settingToggle('dailyMomentEnabled', 'Gentle daily moment', 'Show one optional check-in and conversation spark without streak pressure.', state.settings.dailyMomentEnabled)}${window.__AH_NATIVE_BUNDLE__ ? settingToggle('notificationsEnabled', 'A quiet Haven reminder', 'Optional 7 PM local reminder. No streak, no guilt, and nothing is sent until you turn it on.', state.settings.notificationsEnabled) : ''}${settingToggle('reducedMotion', 'Reduced motion', 'Keep portraits and transitions calm and accessible.', state.settings.reducedMotion)}${settingToggle('highContrast', 'High contrast', 'Strengthen text, surfaces, and focus outlines.', state.settings.highContrast)}</article>
      <article class="v8-settings-card account"><span class="v8-settings-icon">◎</span><span class="v8-eyebrow">Account</span><h2>${accountLabel}</h2><p>${cloud.isAnonymous ? 'This guest has a real authenticated ID. Add email protection without restarting the companion.' : cloud.authenticated ? escapeHtml(cloud.session?.user?.email || state.profile.email || 'Connected cloud account') : 'This life currently exists only inside this browser.'}</p><div class="v8-settings-actions">${cloud.isAnonymous ? '<button class="v8-primary compact" data-action="upgrade-guest"><span>Protect with email</span><b>→</b></button>' : ''}${cloud.authenticated ? '<button data-action="sync-now">Sync history now</button><button data-action="logout">Sign out</button>' : '<button data-action="return-gate">Connect an account</button>'}</div></article>
      <article class="v8-settings-card"><span class="v8-settings-icon">↗</span><span class="v8-eyebrow">Growth clock</span><h2>${escapeHtml(stage.label)} · ${escapeHtml(formatAge(state.ai.age))}</h2><label class="v8-range"><span>Real days per simulated year <b>${state.settings.daysPerYear}</b></span><input type="range" min="1" max="365" value="${state.settings.daysPerYear}" data-setting-range="daysPerYear"></label><p>Changing the pace never duplicates birthdays or erases earlier developmental stages.</p></article>
      <article class="v8-settings-card"><span class="v8-settings-icon">◇</span><span class="v8-eyebrow">Your data</span><h2>Portable and deletable.</h2><p>Export before major account changes. Cloud and on-device copies are controlled separately so nothing disappears silently.</p><div class="v8-settings-actions"><button data-action="native-share">Share Almost Human</button><button data-action="export-data">Export on-device history</button>${cloud.authenticated ? '<button data-action="export-cloud-data">Export cloud history</button><button class="danger" data-action="delete-cloud-data">Delete cloud app data</button><button class="danger" data-action="delete-cloud-account">Delete cloud account</button>' : ''}<button class="danger" data-action="delete-all">Delete this device history</button></div></article>
    </div>
  </section>`;
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
    if (action === 'onboard-next') return nextOnboarding();
    if (action === 'onboard-back') { ui.onboardingStep = Math.max(0, ui.onboardingStep - 1); return render(); }
    if (action === 'choose-appearance') { ui.onboarding.appearanceSeed = target.dataset.value; return render(); }
    if (action === 'choose-voice') { ui.onboarding.voiceId = target.dataset.value; return render(); }
    if (action === 'choose-bond') { ui.onboarding.relationshipStyle = target.dataset.value; return render(); }
    if (action === 'preview-voice') return previewVoice();
    if (action === 'awaken') return awaken();
    if (action === 'finish-birth') return finishBirth();
    if (action === 'new-conversation') return newConversation();
    if (action === 'opening-message') return sendChat('', true);
    if (action === 'reset-conversation') return resetConversation();
    if (action === 'conversation-menu') return openConversationMenu();
    if (action === 'speak-message') return speakMessage(target.dataset.id);
    if (action === 'remember-message') return rememberMessage(target.dataset.id);
    if (action === 'start-listening') return startListening();
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

function handleNativeEvent(event) {
  const detail = event?.detail || {};
  if (detail.type !== 'daily-moment') return;
  if (detail.permission === false) {
    updateSetting('notificationsEnabled', false).catch(() => {});
    toast('Notifications stayed off', 'Your device did not grant permission. The Haven will never pressure you.');
    return;
  }
  if (detail.enabled) toast('Gentle reminder ready', 'One quiet local moment at 7 PM. No streak and no penalty.');
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
  if (ui.onboardingStep === 3 && !ui.onboarding.acceptedSafety) return toast('One acknowledgment remains', 'Confirm that this is an AI experience.');
  ui.onboardingStep = Math.min(4, ui.onboardingStep + 1);
  render();
}

async function previewVoice() {
  if (ui.voiceBusy) return;
  ui.voiceBusy = ui.onboarding.voiceId; render();
  try {
    stopVoice();
    if (cloud.authenticated) {
      const blob = await cloud.voicePreview({ voiceId: ui.onboarding.voiceId });
      await playBlob(blob);
    } else {
      speakLocally('I am here. We do not have to rush the beginning.', ui.onboarding.voiceId);
    }
  } finally { ui.voiceBusy = null; render(); }
}

async function awaken() {
  if (!ui.onboarding.acceptedSafety) return toast('Safety acknowledgment needed', 'Confirm that this is an AI experience.');
  await store.update((draft) => {
    new AlmostHumanEngine(draft).awaken(ui.onboarding);
    draft.settings.voiceEnabled = true;
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
  const syncPromise = cloud.authenticated
    ? store.update(async (draft) => {
        await cloud.ensureCloudIdentity(draft, true);
        await cloud.ensureCloudConversation(draft, draft.conversations[0], true);
        await cloud.syncProfileAndSettings(draft);
      }).catch((error) => recordError('birth_cloud', error))
    : Promise.resolve();

  birthTimer = setInterval(() => {
    const elapsed = Date.now() - started;
    ui.birthPhase = Math.min(4, Math.floor(elapsed / 2200));
    if (ui.birthPhase >= 2 && !ui.birthOpeningStarted) {
      ui.birthOpeningStarted = true;
      syncPromise.then(() => sendChat('', true, { quiet: true })).catch(() => {});
    }
    render();
    if (elapsed >= 11_000) finishBirth();
  }, 240);
}

function finishBirth() {
  clearInterval(birthTimer);
  ui.birthActive = false;
  location.hash = 'talk';
  render();
}

async function sendChat(value, opening = false, { quiet = false } = {}) {
  if (ui.thinking) return;
  ui.pendingUser = value || null;
  ui.thinking = true;
  ui.thoughtPhase = 0;
  ui.thoughtStartedAt = Date.now();
  startThoughtTimer();
  if (!quiet) render();
  const requestId = makeRequestId('chat');
  let result;
  try {
    await store.update(async (draft) => {
      const localEngine = new AlmostHumanEngine(draft);
      const conversationId = ui.selectedConversationId || draft.conversations[0]?.id;
      const provider = draft.settings.cloudSyncEnabled && cloud.authenticated
        ? (context) => cloud.chatProvider(context)
        : null;
      result = await localEngine.sendMessage(value, { conversationId, requestId, opening, provider });
      ui.selectedConversationId = result.conversation.id;
      if (provider) draft.diagnostics.lastCloudSyncAt = new Date().toISOString();
    });
    if (state.settings.voiceAutoplay && state.settings.voiceEnabled && result?.aiMessage) void speak(result.aiMessage.content);
  } catch (error) {
    reportError(error, 'chat');
  } finally {
    clearInterval(thoughtTimer);
    ui.pendingUser = null;
    ui.thinking = false;
    ui.thoughtPhase = 0;
    render();
    scrollMessages();
  }
}

function startThoughtTimer() {
  clearInterval(thoughtTimer);
  thoughtTimer = setInterval(() => {
    const elapsed = Date.now() - ui.thoughtStartedAt;
    ui.thoughtPhase = Math.min(THOUGHT_PHASES.length - 1, Math.floor(elapsed / 1500));
    scheduleRender();
  }, 500);
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
  if (!state.settings.voiceEnabled) return;
  stopVoice();
  if (cloud.authenticated && state.settings.cloudSyncEnabled && state.ai?.cloudId) {
    try {
      const blob = await cloud.voiceProvider({ state, text });
      return playBlob(blob);
    } catch (error) { recordError('cloud_voice', error); }
  }
  speakLocally(text, state.ai.voiceId);
}

async function playBlob(blob) {
  stopVoice();
  activeAudioUrl = URL.createObjectURL(blob);
  activeAudio = new Audio(activeAudioUrl);
  activeAudio.onended = stopVoice;
  activeAudio.onerror = stopVoice;
  await activeAudio.play();
}

function stopVoice() {
  if (activeAudio) { activeAudio.pause(); activeAudio.src = ''; activeAudio = null; }
  if (activeAudioUrl) { URL.revokeObjectURL(activeAudioUrl); activeAudioUrl = null; }
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

function speakLocally(text, voiceId) {
  if (!('speechSynthesis' in window)) return;
  const utterance = new SpeechSynthesisUtterance(String(text));
  const voices = speechSynthesis.getVoices();
  const preferred = voices.find((v) => /en/i.test(v.lang) && /natural|aria|jenny|guy|samantha|ava/i.test(v.name)) || voices.find((v) => /en/i.test(v.lang)) || voices[0];
  if (preferred) utterance.voice = preferred;
  utterance.rate = voiceId === 'calm-grounded' ? .9 : .96;
  utterance.pitch = voiceId === 'bright-curious' ? 1.04 : .98;
  speechSynthesis.speak(utterance);
}

function startListening() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) return toast('Speech input is unavailable', 'Type your message instead.');
  const recognition = new Recognition();
  recognition.lang = state.settings.locale || 'en-US';
  recognition.interimResults = false;
  recognition.onresult = (event) => {
    const input = document.querySelector('[data-chat-input]');
    if (input) { input.value = event.results[0][0].transcript; input.focus(); }
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

function beingMarkup({ seed = 'ember', mood = 'wonder', stageKey = 'newborn', compact = false, tiny = false } = {}) {
  const happy = ['happy', 'playful', 'caring'].includes(mood);
  const thoughtful = ['thinking', 'worried'].includes(mood);
  const mouth = happy ? 'M124 216 Q150 238 176 216' : thoughtful ? 'M132 222 Q150 214 168 222' : 'M132 218 Q150 228 168 218';
  const eyeY = thoughtful ? 163 : 158;
  return `<div class="v8-being seed-${seedFamily(seed)} stage-${stageKey} mood-${mood || 'calm'} ${compact ? 'compact' : ''} ${tiny ? 'tiny' : ''}" aria-label="Illustrated digital companion">
    <span class="v8-being-glow"></span>
    <svg viewBox="0 0 300 340" role="img" aria-hidden="true">
      <ellipse class="v8-body-shadow" cx="150" cy="316" rx="88" ry="18"></ellipse>
      <path class="v8-shoulders" d="M62 338 C70 274 102 254 150 254 C198 254 230 274 238 338 Z"></path>
      <path class="v8-neck" d="M128 231 C132 253 168 253 172 231 L172 272 L128 272 Z"></path>
      <ellipse class="v8-ear" cx="91" cy="172" rx="16" ry="25"></ellipse><ellipse class="v8-ear" cx="209" cy="172" rx="16" ry="25"></ellipse>
      <path class="v8-hair-back" d="M89 184 C69 102 96 53 150 48 C212 43 239 101 211 190 C207 229 185 258 150 258 C113 258 92 226 89 184 Z"></path>
      <ellipse class="v8-face" cx="150" cy="165" rx="61" ry="78"></ellipse>
      <path class="v8-hair-front" d="M93 129 C103 72 142 57 184 72 C203 79 215 96 212 119 C190 101 164 99 145 104 C126 109 112 122 93 129 Z"></path>
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
function attr(value) { return escapeHtml(value).replace(/`/g, '&#96;'); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]); }
function makeRequestId(prefix) { return `${prefix}_${crypto.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`}`; }
function toast(title, copy = '') { const el = document.createElement('div'); el.className = 'toast-v7'; el.innerHTML = `<strong>${escapeHtml(title)}</strong>${copy ? `<p>${escapeHtml(copy)}</p>` : ''}`; toastRoot.appendChild(el); setTimeout(() => el.remove(), 4300); }
function reportError(error, area = 'app') { recordError(area, error); toast('Something did not finish', String(error?.message || error)); }
function recordError(area, error) { store.update((draft) => { draft.diagnostics.lastError = { area, message: String(error?.message || error), at: new Date().toISOString() }; }).catch(() => {}); }
function fatal(error) { root.innerHTML = `<main class="fatal-v7"><h1>The experience could not start.</h1><p>${escapeHtml(String(error?.message || error))}</p><button onclick="location.reload()">Try again</button></main>`; }
