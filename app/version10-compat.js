import { SupabaseCloud } from './core/cloud.js';

const DRAFT_KEY = 'almost-human-v10-creator-draft';
const ACTION_ALIASES = Object.freeze({
  'select-identity-field': 'identity-field',
  'select-identity-appearance': 'identity-appearance',
  'select-identity-voice': 'identity-voice',
});
const FOCUSABLE_10 = 'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])';
let activeDialog10 = null;
let previousFocus10 = null;

export function normalizeNativeBridgeMessage10(payload) {
  let message = payload;
  const serialized = typeof payload === 'string';
  if (serialized) {
    try { message = JSON.parse(payload); }
    catch { return payload; }
  }
  if (!message || typeof message !== 'object' || message.type !== 'v10-haptic') return payload;
  const strength = ({
    selection: 'light',
    'first-light': 'success',
    success: 'success',
    rollback: 'medium',
    warning: 'warning',
  })[message.kind] || 'light';
  const normalized = { type: 'tap', strength };
  return serialized ? JSON.stringify(normalized) : normalized;
}

export function focusableVersion10Elements10(dialog) {
  return [...(dialog?.querySelectorAll?.(FOCUSABLE_10) || [])].filter((node) => !node.hidden && node.getAttribute?.('aria-hidden') !== 'true');
}

export function syncVersion10DialogAccessibility10({
  root = typeof document !== 'undefined' ? document : null,
  appRoot = root?.querySelector?.('#app') || null,
} = {}) {
  const dialog = root?.querySelector?.('#almost-human-v10-layer .v10-overlay[role="dialog"]') || null;
  if (dialog === activeDialog10) return dialog;

  if (dialog) {
    previousFocus10 = root?.activeElement || null;
    activeDialog10 = dialog;
    if (appRoot) appRoot.inert = true;
    if (!dialog.hasAttribute?.('tabindex')) dialog.setAttribute?.('tabindex', '-1');
    queueMicrotask(() => {
      const first = focusableVersion10Elements10(dialog)[0] || dialog;
      first.focus?.({ preventScroll: true });
    });
    return dialog;
  }

  activeDialog10 = null;
  if (appRoot) appRoot.inert = false;
  if (previousFocus10?.isConnected) previousFocus10.focus?.({ preventScroll: true });
  previousFocus10 = null;
  return null;
}

if (typeof document !== 'undefined') {
  installNativeBridgeCompatibility10();

  document.addEventListener('click', (event) => {
    const target = event.target?.closest?.('[data-v10-action]');
    const alias = target ? ACTION_ALIASES[target.dataset.v10Action] : null;
    if (alias) target.dataset.v10Action = alias;
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab' || !activeDialog10) return;
    const elements = focusableVersion10Elements10(activeDialog10);
    if (!elements.length) {
      event.preventDefault();
      activeDialog10.focus?.();
      return;
    }
    const first = elements[0];
    const last = elements.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus?.();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus?.();
    }
  }, true);

  const dialogObserver10 = new MutationObserver(() => syncVersion10DialogAccessibility10());
  dialogObserver10.observe(document.body, { childList: true, subtree: true });
  syncVersion10DialogAccessibility10();
  applyAccessibilityPreferences10().catch(() => {});
  registerVersion10ServiceWorker10().catch(() => {});
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

export async function registerVersion10ServiceWorker10({
  navigatorObject = typeof navigator !== 'undefined' ? navigator : null,
  locationObject = typeof location !== 'undefined' ? location : null,
  nativeBundle = Boolean(globalThis.__AH_NATIVE_BUNDLE__),
} = {}) {
  if (nativeBundle || !navigatorObject?.serviceWorker || locationObject?.protocol === 'file:') return null;
  return navigatorObject.serviceWorker.register('./sw.js?v=10.0');
}

function installNativeBridgeCompatibility10() {
  const bridge = globalThis.ReactNativeWebView;
  if (!bridge?.postMessage || bridge.__almostHumanVersion10Compatible) return;
  const originalPostMessage = bridge.postMessage.bind(bridge);
  bridge.postMessage = (payload) => originalPostMessage(normalizeNativeBridgeMessage10(payload));
  Object.defineProperty(bridge, '__almostHumanVersion10Compatible', {
    configurable: false,
    enumerable: false,
    value: true,
    writable: false,
  });
}

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
