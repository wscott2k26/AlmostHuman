import test from 'node:test';
import assert from 'node:assert/strict';
import { SupabaseCloud, CloudError } from '../app/core/cloud.js';

const PROJECT = {
  url: 'https://example.supabase.co',
  publishableKey: 'sb_publishable_test_public',
  projectRef: 'example',
  functionNames: {},
};

function makeStorage() {
  const map = new Map();
  return {
    getItem: (key) => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    clear: () => map.clear(),
  };
}

function jwt(payload = {}) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ sub: 'user-1', email: 'owner@example.com', exp: Math.floor(Date.now() / 1000) + 3600, ...payload })}.sig`;
}

function response(data, status = 200, headers = { 'content-type': 'application/json' }) {
  return new Response(data === null ? '' : JSON.stringify(data), { status, headers });
}

function installBrowser({ search = '', hash = '' } = {}) {
  globalThis.localStorage = makeStorage();
  globalThis.location = {
    search,
    hash,
    pathname: '/index.html',
    origin: 'https://almost-human.test',
    href: 'https://almost-human.test/index.html',
  };
  globalThis.document = { title: 'Almost Human' };
  let replaced = null;
  globalThis.history = { replaceState: (_state, _title, url) => { replaced = url; } };
  return () => replaced;
}

function authenticatedCloud() {
  const cloud = new SupabaseCloud(PROJECT);
  cloud.setSession({ access_token: jwt(), refresh_token: 'refresh-1', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'user-1', email: 'owner@example.com' } });
  return cloud;
}

test.beforeEach(() => {
  installBrowser();
  globalThis.fetch = undefined;
});

test('public Supabase configuration is recognized without a secret key', () => {
  const cloud = new SupabaseCloud(PROJECT);
  assert.equal(cloud.configured, true);
  assert.equal(cloud.authenticated, false);
  assert.equal('secretKey' in cloud.config, false);
});

test('password login stores a normalized authenticated session', async () => {
  const access = jwt();
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url: String(url), options };
    return response({ access_token: access, refresh_token: 'refresh-token', expires_in: 3600, user: { id: 'user-1', email: 'owner@example.com' } });
  };
  const cloud = new SupabaseCloud(PROJECT);
  await cloud.login(' owner@example.com ', 'correct-horse-battery');
  assert.equal(cloud.authenticated, true);
  assert.equal(cloud.userId, 'user-1');
  assert.equal(request.url, `${PROJECT.url}/auth/v1/token?grant_type=password`);
  assert.equal(request.options.headers.apikey, PROJECT.publishableKey);
  assert.equal(request.options.headers.Authorization, undefined);
  assert.deepEqual(JSON.parse(request.options.body), { email: 'owner@example.com', password: 'correct-horse-battery' });
  assert.match(localStorage.getItem('almost_human_supabase_session'), /refresh-token/);
});

test('REST calls use the publishable key and signed-in bearer token', async () => {
  const cloud = authenticatedCloud();
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url: String(url), options };
    return response([]);
  };
  await cloud.entity('Message').list('-created_at', 25, 0);
  assert.match(request.url, /\/rest\/v1\/messages\?/);
  assert.equal(request.options.headers.apikey, PROJECT.publishableKey);
  assert.equal(request.options.headers.Authorization, `Bearer ${cloud.session.access_token}`);
});

test('PostgREST filters are encoded once and preserve escaped commas', async () => {
  const cloud = authenticatedCloud();
  let requestedUrl = '';
  globalThis.fetch = async (url) => { requestedUrl = String(url); return response([]); };
  await cloud.entity('Message').filter({ request_id: 'req,one' }, '-created_at', 10);
  const url = new URL(requestedUrl);
  assert.equal(url.searchParams.get('request_id'), 'eq.req\\,one');
  assert.equal(requestedUrl.includes('%252C'), false);
});

test('app settings use user_id as their primary key', async () => {
  const cloud = authenticatedCloud();
  let requestedUrl = '';
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return response([{ user_id: 'user-1', locale: 'en-US' }]);
  };
  const row = await cloud.entity('AppSettings').get('user-1');
  assert.equal(new URL(requestedUrl).searchParams.get('user_id'), 'eq.user-1');
  assert.equal(row.id, undefined);
  assert.equal(row.created_by_id, 'user-1');
});

test('subscription records are read-only in the browser adapter', async () => {
  const cloud = authenticatedCloud();
  await assert.rejects(
    () => cloud.entity('Subscription').create({ tier: 'legacy' }),
    (error) => error instanceof CloudError && error.code === 'READ_ONLY_ENTITY' && error.status === 403,
  );
});

test('OAuth callback captures tokens and removes them from the visible URL', () => {
  const access = jwt();
  const getReplaced = installBrowser({
    search: '?auth_return=settings&campaign=founder',
    hash: `#access_token=${encodeURIComponent(access)}&refresh_token=refresh-oauth&expires_in=3600&type=recovery`,
  });
  const cloud = new SupabaseCloud(PROJECT);
  assert.equal(cloud.authenticated, true);
  assert.equal(cloud.authEvent, 'recovery');
  assert.equal(getReplaced(), '/index.html?campaign=founder#settings');
  assert.equal(getReplaced().includes('access_token'), false);
});

test('health can run without a user session while private functions cannot', async () => {
  const cloud = new SupabaseCloud(PROJECT);
  globalThis.fetch = async (url, options) => {
    assert.equal(options.headers.Authorization, undefined);
    return response({ database: true, ai_configured: false });
  };
  const result = await cloud.health();
  assert.equal(result.database, true);
  await assert.rejects(() => cloud.invoke('chatService', {}), (error) => error.code === 'AUTH_REQUIRED');
});

test('chat provider sends stable local message IDs and returns cloud mappings', async () => {
  const cloud = authenticatedCloud();
  cloud.ensureCloudIdentity = async (state) => { state.ai.cloudId ||= 'ai-cloud'; return { id: state.ai.cloudId }; };
  cloud.ensureCloudConversation = async () => ({ id: 'conversation-cloud' });
  cloud.invoke = async (name, payload) => {
    assert.equal(name, 'chatService');
    assert.equal(payload.local_user_message_id, 'message-user-local');
    assert.equal(payload.local_ai_message_id, 'message-ai-local');
    return { ai_text: 'Hello.', message_id: 'message-ai-cloud', user_message_id: 'message-user-cloud', provider_mode: 'ai' };
  };
  const result = await cloud.chatProvider({
    state: { ai: { cloudId: 'ai-cloud' } }, conversation: { id: 'conversation-local' }, text: 'Hi', requestId: 'request-1',
    localUserMessageId: 'message-user-local', localAiMessageId: 'message-ai-local',
  });
  assert.equal(result.cloudMessageId, 'message-ai-cloud');
  assert.equal(result.cloudUserMessageId, 'message-user-cloud');
});

test('activity provider sends a stable local activity ID', async () => {
  const cloud = authenticatedCloud();
  cloud.ensureCloudIdentity = async () => ({ id: 'ai-cloud' });
  cloud.invoke = async (name, payload) => {
    assert.equal(name, 'activityService');
    assert.equal(payload.local_activity_id, 'activity-local');
    return { content: 'A story', activity_id: 'activity-cloud', request_id: payload.request_id };
  };
  const result = await cloud.activityProvider({ state: { ai: { cloudId: 'ai-cloud' } }, type: 'story', input: 'stars', requestId: 'activity-request', localActivityId: 'activity-local' });
  assert.equal(result.activity_id, 'activity-cloud');
});

test('secure voice returns a blob without exposing an AI key to the browser', async () => {
  const cloud = authenticatedCloud();
  cloud.ensureCloudIdentity = async () => ({ id: 'ai-cloud' });
  cloud.invoke = async (name, payload, options) => {
    assert.equal(name, 'voiceService');
    assert.equal(payload.ai_entity_id, 'ai-cloud');
    assert.equal(options.raw, true);
    return new Response(new Blob(['audio-bytes'], { type: 'audio/mpeg' }), { status: 200 });
  };
  const blob = await cloud.voiceProvider({ state: { ai: { cloudId: 'ai-cloud' } }, text: 'Hello there' });
  assert.equal(blob.type, 'audio/mpeg');
  assert.equal(await blob.text(), 'audio-bytes');
});

test('letter calls use the local ID as the cloud idempotency key', async () => {
  const cloud = authenticatedCloud();
  cloud.ensureCloudIdentity = async () => ({ id: 'ai-cloud' });
  cloud.invoke = async (name, payload) => {
    assert.equal(name, 'letterService');
    assert.equal(payload.local_id, 'letter-local');
    return { letter_id: 'letter-cloud', status: payload.action === 'create' ? 'sealed' : payload.action };
  };
  const state = { ai: { cloudId: 'ai-cloud' } };
  const letter = { id: 'letter-local', title: 'Later', content: 'Keep growing.', unlockAge: 5 };
  const created = await cloud.createLetter({ state, letter });
  assert.equal(created.letter_id, 'letter-cloud');
});

test('cloud restore hydrates a fresh device while preserving local lock secrets', async () => {
  const cloud = authenticatedCloud();
  cloud.loadLifeHistory = async () => ({
    found: true,
    profile: { id: 'user-1', displayName: 'Will', mode: 'cloud', cloudUserId: 'user-1' },
    settings: { locale: 'en-US', daysPerYear: 14, appLockEnabled: false },
    subscription: { tier: 'free', status: 'active' },
    ai: { id: 'ai-local', cloudId: 'ai-cloud', name: 'Nova', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z' },
    conversations: [{ id: 'conversation-local', cloudId: 'conversation-cloud', title: 'Hello', createdAt: '2026-01-01T00:00:00Z' }],
    messages: [{ id: 'message-local', cloudId: 'message-cloud', conversationId: 'conversation-local', sender: 'ai', content: 'Hi', createdAt: '2026-01-01T00:00:00Z' }],
    memories: [], facts: [], factConflicts: [], skills: [], interests: [], milestones: [], moodHistory: [], relationshipEvents: [], activities: [], letters: [], roomItems: [],
  });
  const state = {
    profile: { mode: 'local' },
    settings: { appLockEnabled: true, pinHash: 'local-only-pin', cloudSyncEnabled: false },
    subscription: { tier: 'founder_preview' },
    ai: null,
    conversations: [], messages: [], memories: [], facts: [], factConflicts: [], skills: [], interests: [], milestones: [], moodHistory: [], relationshipEvents: [], activities: [], letters: [], roomItems: [],
  };
  const result = await cloud.restoreLifeHistory(state);
  assert.equal(result.restored, true);
  assert.equal(state.ai.cloudId, 'ai-cloud');
  assert.equal(state.messages[0].cloudId, 'message-cloud');
  assert.equal(state.settings.cloudSyncEnabled, true);
  assert.equal(state.settings.appLockEnabled, true);
  assert.equal(state.settings.pinHash, 'local-only-pin');
});

test('cloud restore refuses to merge two unrelated lives silently', async () => {
  const cloud = authenticatedCloud();
  cloud.loadLifeHistory = async () => ({ found: true, ai: { id: 'remote-ai', cloudId: 'remote-cloud' }, profile: null, settings: null, subscription: null,
    conversations: [], messages: [], memories: [], facts: [], factConflicts: [], skills: [], interests: [], milestones: [], moodHistory: [], relationshipEvents: [], activities: [], letters: [], roomItems: [] });
  const state = { profile: {}, settings: { appLockEnabled: false, pinHash: null }, ai: { id: 'local-ai', cloudId: null }, messages: [{ id: 'm1' }], memories: [{ id: 'core' }, { id: 'm2' }], conversations: [], facts: [], factConflicts: [], skills: [], interests: [], milestones: [], moodHistory: [], relationshipEvents: [], activities: [], letters: [], roomItems: [] };
  await assert.rejects(() => cloud.restoreLifeHistory(state), (error) => error instanceof CloudError && error.code === 'LIFE_CONFLICT');
});

test('anonymous guest login stores a private authenticated session', async () => {
  const access = jwt({ is_anonymous: true, email: undefined });
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url: String(url), options };
    return response({ access_token: access, refresh_token: 'guest-refresh', expires_in: 3600, user: { id: 'guest-1', is_anonymous: true } });
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
