import test from 'node:test';
import assert from 'node:assert/strict';
import { SupabaseCloud, CloudError } from '../app/core/cloud.js';

const originalFetch = globalThis.fetch;
const originalLocalStorage = globalThis.localStorage;
const originalLocation = globalThis.location;
const originalHistory = globalThis.history;
const originalDocument = globalThis.document;
const PROJECT = { url: 'https://project.supabase.co', publishableKey: 'sb_publishable_test', projectRef: 'project', functionNames: { health: 'health' } };

class FakeStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
  clear() { this.map.clear(); }
}

function b64url(value) { return Buffer.from(JSON.stringify(value)).toString('base64url'); }
function jwt(payload) { return `${b64url({ alg: 'none' })}.${b64url(payload)}.`; }
function response(body, status = 200, headers = {}) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}
function authenticatedCloud() {
  const cloud = new SupabaseCloud(PROJECT);
  cloud.setSession({
    access_token: jwt({ sub: 'user-1', exp: Math.floor(Date.now() / 1000) + 3600 }),
    refresh_token: 'refresh', expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: 'user-1', email: 'user@example.com' },
  });
  return cloud;
}

test.beforeEach(() => {
  globalThis.localStorage = new FakeStorage();
  globalThis.location = { search: '', hash: '', origin: 'https://app.example.com', pathname: '/', href: '' };
  globalThis.history = { replaceState() {} };
  globalThis.document = { title: 'Almost Human' };
});

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test.after(() => {
  globalThis.localStorage = originalLocalStorage;
  globalThis.location = originalLocation;
  globalThis.history = originalHistory;
  globalThis.document = originalDocument;
});

test('public Supabase configuration is recognized without a secret key', () => {
  const cloud = new SupabaseCloud(PROJECT);
  assert.equal(cloud.configured, true);
  assert.equal(cloud.authenticated, false);
});

test('password login stores a normalized authenticated session', async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), `${PROJECT.url}/auth/v1/token?grant_type=password`);
    assert.equal(options.headers.apikey, PROJECT.publishableKey);
    assert.equal(options.headers.Authorization, undefined);
    assert.deepEqual(JSON.parse(options.body), { email: 'user@example.com', password: 'secret123' });
    return response({ access_token: jwt({ sub: 'user-1', email: 'user@example.com' }), refresh_token: 'refresh', expires_in: 3600, user: { id: 'user-1', email: 'user@example.com' } });
  };
  const cloud = new SupabaseCloud(PROJECT);
  const session = await cloud.login('user@example.com', 'secret123');
  assert.equal(session.user.id, 'user-1');
  assert.equal(cloud.authenticated, true);
});

test('REST calls use the publishable key and signed-in bearer token', async () => {
  const access = jwt({ sub: 'user-1', exp: Math.floor(Date.now() / 1000) + 3600 });
  const cloud = new SupabaseCloud(PROJECT);
  cloud.setSession({ access_token: access, refresh_token: 'refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'user-1' } });
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), `${PROJECT.url}/rest/v1/memories?select=*&ai_entity_id=eq.ai-1&order=created_at.desc&limit=25`);
    assert.equal(options.headers.apikey, PROJECT.publishableKey);
    assert.equal(options.headers.Authorization, `Bearer ${access}`);
    return response([]);
  };
  const rows = await cloud.entity('Memory').filter({ ai_entity_id: 'ai-1' }, '-created_at', 25);
  assert.deepEqual(rows, []);
});

test('PostgREST filters are encoded once and preserve escaped commas', async () => {
  const cloud = authenticatedCloud();
  globalThis.fetch = async (url) => {
    assert.equal(String(url), `${PROJECT.url}/rest/v1/memories?select=*&local_id=eq.row%2C1&limit=1`);
    return response([]);
  };
  await cloud.entity('Memory').filter({ local_id: 'row,1' }, null, 1);
});

test('app settings use user_id as their primary key', async () => {
  const cloud = authenticatedCloud();
  globalThis.fetch = async (url) => {
    assert.equal(String(url), `${PROJECT.url}/rest/v1/app_settings?select=*&user_id=eq.user-1&limit=1`);
    return response([{ user_id: 'user-1' }]);
  };
  const row = await cloud.entity('AppSettings').get('user-1');
  assert.equal(row.user_id, 'user-1');
});

test('subscription records are read-only in the browser adapter', async () => {
  const cloud = authenticatedCloud();
  await assert.rejects(() => cloud.entity('Subscription').create({ tier: 'premium' }), (error) => error instanceof CloudError && error.code === 'READ_ONLY_ENTITY');
  await assert.rejects(() => cloud.entity('Subscription').update('sub-1', { tier: 'premium' }), (error) => error instanceof CloudError && error.code === 'READ_ONLY_ENTITY');
  await assert.rejects(() => cloud.entity('Subscription').delete('sub-1'), (error) => error instanceof CloudError && error.code === 'READ_ONLY_ENTITY');
});

test('OAuth callback captures tokens and removes them from the visible URL', () => {
  const access = jwt({ sub: 'oauth-user', email: 'oauth@example.com' });
  globalThis.location = { search: '', hash: `#access_token=${access}&refresh_token=oauth-refresh&expires_in=3600&type=signup`, origin: 'https://app.example.com', pathname: '/', href: '' };
  let cleanUrl = '';
  globalThis.history = { replaceState(_a, _b, value) { cleanUrl = value; } };
  const cloud = new SupabaseCloud(PROJECT);
  assert.equal(cloud.authenticated, true);
  assert.equal(cloud.userId, 'oauth-user');
  assert.equal(cleanUrl, '/#settings');
});

test('health can run without a user session while private functions cannot', async () => {
  const cloud = new SupabaseCloud(PROJECT);
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), `${PROJECT.url}/functions/v1/health`);
    assert.equal(options.headers.Authorization, undefined);
    return response({ data: { status: 'ok' } });
  };
  const health = await cloud.health();
  assert.equal(health.status, 'ok');
  await assert.rejects(() => cloud.invoke('privacyService', { action: 'export_all' }), (error) => error instanceof CloudError && error.code === 'AUTH_REQUIRED');
});

test('chat provider sends stable local message IDs and returns cloud mappings', async () => {
  const cloud = authenticatedCloud();
  cloud.ensureCloudIdentity = async (state) => { state.ai.cloudId = 'cloud-ai-1'; return { id: 'cloud-ai-1' }; };
  cloud.ensureCloudConversation = async (_state, conversation) => { conversation.cloudId = 'cloud-conversation-1'; return { id: 'cloud-conversation-1' }; };
  cloud.invoke = async (name, payload) => {
    assert.equal(name, 'chatService');
    assert.equal(payload.request_id, 'request-1');
    assert.equal(payload.local_user_message_id, 'local-user-1');
    assert.equal(payload.local_ai_message_id, 'local-ai-1');
    return { text: 'Hello', user_message_id: 'cloud-user-message', message_id: 'cloud-ai-message' };
  };
  const result = await cloud.chatProvider({
    state: { ai: { id: 'local-ai', cloudId: null } }, conversation: { id: 'local-conversation', cloudId: null },
    text: 'Hi', requestId: 'request-1', localUserMessageId: 'local-user-1', localAiMessageId: 'local-ai-1'
  });
  assert.equal(result.cloudUserMessageId, 'cloud-user-message');
  assert.equal(result.cloudMessageId, 'cloud-ai-message');
});

test('activity provider sends a stable local activity ID', async () => {
  const cloud = authenticatedCloud();
  cloud.ensureCloudIdentity = async (state) => { state.ai.cloudId = 'cloud-ai-1'; return { id: 'cloud-ai-1' }; };
  cloud.invoke = async (name, payload) => {
    assert.equal(name, 'activityService');
    assert.equal(payload.local_activity_id, 'activity-local-1');
    return { result: { title: 'Drawing', content: 'A moon' } };
  };
  const result = await cloud.activityProvider({ state: { ai: { id: 'local-ai' } }, type: 'draw', input: 'moon', requestId: 'request-2', localActivityId: 'activity-local-1' });
  assert.equal(result.result.title, 'Drawing');
});

test('secure voice returns a blob without exposing an AI key to the browser', async () => {
  const cloud = authenticatedCloud();
  cloud.ensureCloudIdentity = async (state) => { state.ai.cloudId = 'cloud-ai-1'; return { id: 'cloud-ai-1' }; };
  cloud.invoke = async (name, payload, options) => {
    assert.equal(name, 'voiceService');
    assert.equal(payload.ai_entity_id, 'cloud-ai-1');
    assert.equal(payload.voice_id, 'calm-grounded');
    assert.equal(payload.tone, 'calm');
    assert.equal(payload.provider_preference, 'auto');
    assert.equal(payload.rate, .96);
    assert.equal(options.raw, true);
    return new Response(new Blob(['audio'], { type: 'audio/mpeg' }), { status: 200 });
  };
  const blob = await cloud.voiceProvider({ state: { ai: { id: 'local-ai', voiceId: 'calm-grounded' }, settings: { voiceRate: .96 } }, text: 'hello' });
  assert.equal(blob.type, 'audio/mpeg');
});

test('letter calls use the local ID as the cloud idempotency key', async () => {
  const cloud = authenticatedCloud();
  cloud.ensureCloudIdentity = async (state) => { state.ai.cloudId = 'cloud-ai-1'; return { id: 'cloud-ai-1' }; };
  cloud.invoke = async (name, payload) => {
    assert.equal(name, 'letterService');
    assert.equal(payload.local_id, 'letter-local-1');
    return { id: 'cloud-letter-1' };
  };
  await cloud.createLetter({ state: { ai: { id: 'local-ai' } }, letter: { id: 'letter-local-1', title: 'Later', content: 'Hello', unlockAge: 12 } });
});

test('cloud restore hydrates a fresh device while preserving local lock secrets', async () => {
  const cloud = authenticatedCloud();
  cloud.loadLifeHistory = async () => ({ found: true, profile: { displayName: 'Will' }, settings: { theme: 'aurora' }, subscription: null, ai: { id: 'local-ai', cloudId: 'cloud-ai', name: 'Nova' }, conversations: [], messages: [], memories: [], facts: [], factConflicts: [], skills: [], interests: [], milestones: [], moodHistory: [], relationshipEvents: [], activities: [], letters: [], roomItems: [] });
  const state = { profile: {}, settings: { appLockEnabled: true, pinHash: 'secret', theme: 'midnight' }, ai: null, conversations: [], messages: [], memories: [], facts: [], factConflicts: [], skills: [], interests: [], milestones: [], moodHistory: [], relationshipEvents: [], activities: [], letters: [], roomItems: [] };
  const result = await cloud.restoreLifeHistory(state);
  assert.equal(result.restored, true);
  assert.equal(state.ai.name, 'Nova');
  assert.equal(state.settings.theme, 'aurora');
  assert.equal(state.settings.appLockEnabled, true);
  assert.equal(state.settings.pinHash, 'secret');
});

test('cloud restore refuses to merge two unrelated lives silently', async () => {
  const cloud = authenticatedCloud();
  cloud.loadLifeHistory = async () => ({ found: true, ai: { id: 'remote-ai', cloudId: 'cloud-ai' }, profile: null, settings: null, subscription: null, conversations: [], messages: [], memories: [], facts: [], factConflicts: [], skills: [], interests: [], milestones: [], moodHistory: [], relationshipEvents: [], activities: [], letters: [], roomItems: [] });
  const state = { ai: { id: 'local-ai', cloudId: null }, messages: [{ id: 'one' }], memories: [{ id: 'one' }, { id: 'two' }] };
  await assert.rejects(() => cloud.restoreLifeHistory(state), (error) => error instanceof CloudError && error.code === 'LIFE_CONFLICT');
});

test('anonymous guest login stores a private authenticated session', async () => {
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url: String(url), options };
    return response({ access_token: jwt({ sub: 'guest-1', is_anonymous: true, exp: Math.floor(Date.now() / 1000) + 3600 }), refresh_token: 'guest-refresh', expires_in: 3600, user: { id: 'guest-1', is_anonymous: true } });
  };
  const cloud = new SupabaseCloud(PROJECT);
  const session = await cloud.loginAnonymously({ source: 'test' });
  assert.equal(request.url, `${PROJECT.url}/auth/v1/signup`);
  assert.deepEqual(JSON.parse(request.options.body), { data: { source: 'test' } });
  assert.equal(session.user.id, 'guest-1');
  assert.equal(cloud.authenticated, true);
  assert.equal(cloud.isAnonymous, true);
});

test('social provider readiness is read from public Supabase auth settings', async () => {
  const cloud = new SupabaseCloud(PROJECT);
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), `${PROJECT.url}/auth/v1/settings`);
    assert.equal(options.headers.Authorization, undefined);
    return response({ external: { google: true, apple: false, facebook: false } });
  };
  const settings = await cloud.authSettings();
  assert.equal(settings.external.google, true);
  assert.equal(settings.external.apple, false);
});

test('voice preview uses the authenticated secure Edge Function', async () => {
  const cloud = authenticatedCloud();
  cloud.invoke = async (name, payload, options) => {
    assert.equal(name, 'voiceService');
    assert.deepEqual(payload, {
      preview: true,
      voice_id: 'bright-curious',
      tone: 'calm',
      provider_preference: 'auto',
      rate: 0.96,
    });
    assert.equal(options.raw, true);
    return new Response(new Blob(['preview-audio'], { type: 'audio/mpeg' }), { status: 200 });
  };
  const blob = await cloud.voicePreview({ voiceId: 'bright-curious' });
  assert.equal(blob.type, 'audio/mpeg');
  assert.equal(await blob.text(), 'preview-audio');
});
