import { DEFAULT_DAYS_PER_YEAR } from './stages.js';

export const DATA_VERSION = 4;
const DB_NAME = 'almost-human-premium';
const STORE_NAME = 'state';
const STATE_KEY = 'main';

export function defaultState(now = Date.now()) {
  return {
    version: DATA_VERSION,
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
    profile: { id: null, displayName: '', email: '', mode: 'local', cloudUserId: null, createdAt: new Date(now).toISOString() },
    settings: {
      locale: navigatorLocale(), timezone: timezone(), countryCode: 'US', daysPerYear: DEFAULT_DAYS_PER_YEAR,
      voiceEnabled: true, voiceAutoplay: false, voiceRate: 0.96, reducedMotion: false, highContrast: false,
      dailyMomentEnabled: true, notificationsEnabled: false, analyticsOptIn: false, sensitiveMemoryMode: 'ask',
      dataRetentionDays: 0, appLockEnabled: false, pinHash: null, soundEffects: true, cloudSyncEnabled: false,
      theme: 'cosmic', lastGrowthCheckAt: null
    },
    subscription: { tier: 'founder_preview', status: 'preview', platform: 'web', entitlements: { allPremiumFeatures: true }, updatedAt: new Date(now).toISOString() },
    ai: null,
    conversations: [], messages: [], memories: [], facts: [], factConflicts: [], skills: [], interests: [], milestones: [],
    moodHistory: [], relationshipEvents: [], activities: [], letters: [], roomItems: [], repeatLogs: [], generationRequests: [],
    diagnostics: { launches: 0, lastError: null, lastSelfTest: null, providerMode: 'local', lastCloudSyncAt: null, migrations: [] }
  };
}

export function migrateState(input) {
  const base = defaultState();
  if (!input || typeof input !== 'object') return base;
  const merged = { ...base, ...input };
  merged.settings = { ...base.settings, ...(input.settings || {}) };
  merged.profile = { ...base.profile, ...(input.profile || {}) };
  merged.subscription = { ...base.subscription, ...(input.subscription || {}) };
  merged.diagnostics = { ...base.diagnostics, ...(input.diagnostics || {}) };
  const arrays = ['conversations','messages','memories','facts','factConflicts','skills','interests','milestones','moodHistory','relationshipEvents','activities','letters','roomItems','repeatLogs','generationRequests'];
  for (const key of arrays) merged[key] = Array.isArray(input[key]) ? input[key] : [];
  if ((input.version || 0) < DATA_VERSION) {
    merged.diagnostics.migrations = [...(merged.diagnostics.migrations || []), { from: input.version || 0, to: DATA_VERSION, at: new Date().toISOString() }].slice(-20);
  }
  merged.version = DATA_VERSION;
  return merged;
}

export class PersistentStore {
  constructor({ namespace = DB_NAME, memoryOnly = false } = {}) {
    this.namespace = namespace;
    this.memoryOnly = memoryOnly;
    this.db = null;
    this.state = null;
    this.listeners = new Set();
    this.writeChain = Promise.resolve();
  }

  async init() {
    if (!this.memoryOnly && typeof indexedDB !== 'undefined') {
      try {
        this.db = await openDatabase(this.namespace);
        const saved = await idbGet(this.db, STATE_KEY);
        this.state = migrateState(saved || defaultState());
      } catch (error) {
        this.db = null;
        this.state = migrateState(readLocalFallback(this.namespace));
        this.state.diagnostics.lastError = { area: 'storage_init', message: String(error?.message || error), at: new Date().toISOString() };
      }
    } else {
      this.state = migrateState(this.memoryOnly ? null : readLocalFallback(this.namespace));
    }
    this.state.diagnostics.launches = Number(this.state.diagnostics.launches || 0) + 1;
    await this.persist();
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) navigator.storage.persist().catch(() => {});
    return this.snapshot();
  }

  snapshot() { return structuredCloneSafe(this.state || defaultState()); }

  async update(mutator) {
    this.writeChain = this.writeChain.then(async () => {
      const next = this.snapshot();
      const result = await mutator(next);
      next.updatedAt = new Date().toISOString();
      next.version = DATA_VERSION;
      this.state = next;
      await this.persist();
      this.emit();
      return result;
    });
    return this.writeChain;
  }

  async replace(nextState) {
    this.state = migrateState(nextState);
    this.state.updatedAt = new Date().toISOString();
    await this.persist();
    this.emit();
    return this.snapshot();
  }

  async reset() {
    this.state = defaultState();
    await this.persist();
    this.emit();
    return this.snapshot();
  }

  async persist() {
    if (!this.state) return;
    if (this.db) {
      await idbSet(this.db, STATE_KEY, this.state);
    } else if (!this.memoryOnly && typeof localStorage !== 'undefined') {
      localStorage.setItem(`${this.namespace}:fallback`, JSON.stringify(this.state));
    }
  }

  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  emit() { const snapshot = this.snapshot(); for (const listener of this.listeners) listener(snapshot); }
}

function navigatorLocale() { return typeof navigator !== 'undefined' ? navigator.language || 'en-US' : 'en-US'; }
function timezone() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; } }
function structuredCloneSafe(value) { return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)); }
function readLocalFallback(namespace) { try { return JSON.parse(localStorage.getItem(`${namespace}:fallback`) || 'null'); } catch { return null; } }
function openDatabase(name) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => { const db = request.result; if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME); };
    request.onsuccess = () => resolve(request.result);
  });
}
function idbGet(db, key) { return new Promise((resolve, reject) => { const tx = db.transaction(STORE_NAME, 'readonly'); const request = tx.objectStore(STORE_NAME).get(key); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
function idbSet(db, key, value) { return new Promise((resolve, reject) => { const tx = db.transaction(STORE_NAME, 'readwrite'); tx.objectStore(STORE_NAME).put(value, key); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); }
