import { SupabaseCloud } from './core/cloud.js';

const DRAFT_KEY = 'almost-human-v10-creator-draft';
const ACTION_ALIASES = Object.freeze({
  'select-identity-field': 'identity-field',
  'select-identity-appearance': 'identity-appearance',
  'select-identity-voice': 'identity-voice',
});

if (typeof document !== 'undefined') {
  document.addEventListener('click', (event) => {
    const target = event.target?.closest?.('[data-v10-action]');
    const alias = target ? ACTION_ALIASES[target.dataset.v10Action] : null;
    if (alias) target.dataset.v10Action = alias;
  }, true);

  applyAccessibilityPreferences10().catch(() => {});
}

const originalVoicePreview10 = SupabaseCloud.prototype.voicePreview;
SupabaseCloud.prototype.voicePreview = function version10VoicePreview(options = {}) {
  const draft = readCreatorDraft10();
  const profile = draft?.voiceProfile || {};
  return originalVoicePreview10.call(this, {
    ...options,
    tone: options.tone || profile.tone || 'calm',
    providerPreference: options.providerPreference || profile.providerPreference || 'auto',
    rate: options.rate ?? profile.rate ?? 0.96,
  });
};

async function applyAccessibilityPreferences10() {
  if (typeof indexedDB === 'undefined') return;
  const db = await openDatabase10();
  const state = await new Promise((resolve, reject) => {
    const tx = db.transaction('state', 'readonly');
    const request = tx.objectStore('state').get('main');
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
  document.body.classList.toggle('reduce-transparency', Boolean(state?.settings?.reducedTransparency));
}

function openDatabase10() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('almost-human-premium', 1);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('state')) db.createObjectStore('state');
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function readCreatorDraft10() {
  if (typeof sessionStorage === 'undefined') return null;
  try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null'); }
  catch { return null; }
}
