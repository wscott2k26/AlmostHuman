const ENTITY_TABLES = Object.freeze({
  User: 'profiles', AppSettings: 'app_settings', AIEntity: 'ai_entities', Conversation: 'conversations',
  Message: 'messages', Memory: 'memories', UserFact: 'user_facts', FactConflict: 'fact_conflicts',
  Skill: 'skills', Interest: 'interests', Milestone: 'milestones', MoodHistory: 'mood_history',
  RelationshipEvent: 'relationship_events', Activity: 'activities', Letter: 'letters',
  RoomItem: 'room_items', RepeatLog: 'repeat_logs', GenerationRequest: 'generation_requests',
  Subscription: 'subscriptions', AdminEvent: 'admin_events'
});

const FIELD_ALIASES = Object.freeze({
  created_date: 'created_at', updated_date: 'updated_at', created_by_id: 'user_id'
});

const READ_ONLY_TABLES = new Set(['subscriptions']);
function primaryKeyFor(table) { return table === 'app_settings' ? 'user_id' : 'id'; }

function runtimeConfig() {
  const config = globalThis.__ALMOST_HUMAN_CONFIG__ || {};
  const search = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
  return {
    url: String(search.get('supabase_url') || config.supabaseUrl || '').replace(/\/$/, ''),
    publishableKey: String(config.supabasePublishableKey || ''),
    projectRef: String(config.projectRef || ''),
    functionNames: { ...(config.functionNames || {}) },
    authRedirectPath: String(config.authRedirectPath || '')
  };
}

export class SupabaseCloud {
  constructor(config = runtimeConfig()) {
    this.config = config;
    this.session = readJson('almost_human_supabase_session');
    this.refreshPromise = null;
    this.authEvent = null;
    this.authError = null;
    this.captureSessionFromUrl();
  }

  get configured() { return Boolean(this.config.url && this.config.publishableKey); }
  get authenticated() { return Boolean(this.configured && this.session?.access_token && this.session?.refresh_token); }
  get isAnonymous() {
    const payload = jwtPayload(this.session?.access_token);
    return Boolean(this.session?.user?.is_anonymous ?? payload?.is_anonymous);
  }
  get userId() { return this.session?.user?.id || jwtPayload(this.session?.access_token)?.sub || null; }

  captureSessionFromUrl() {
    if (typeof location === 'undefined') return;
    const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
    const search = new URLSearchParams(location.search);
    const authError = hash.get('error_description') || search.get('error_description');
    if (authError) this.authError = authError;
    const accessToken = hash.get('access_token') || search.get('access_token');
    const refreshToken = hash.get('refresh_token') || search.get('refresh_token');
    if (!accessToken || !refreshToken) return;
    const expiresIn = Number(hash.get('expires_in') || search.get('expires_in') || 3600);
    const eventType = hash.get('type') || search.get('type') || 'signin';
    this.authEvent = eventType;
    this.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: hash.get('token_type') || search.get('token_type') || 'bearer',
      expires_in: expiresIn,
      expires_at: Math.floor(Date.now() / 1000) + expiresIn,
      user: jwtUser(accessToken)
    });
    const returnRoute = search.get('auth_return') || 'settings';
    const cleanSearch = new URLSearchParams(search);
    for (const key of ['access_token','refresh_token','expires_in','expires_at','token_type','type','error','error_code','error_description','auth_return']) cleanSearch.delete(key);
    const cleanQuery = cleanSearch.toString();
    const clean = `${location.pathname}${cleanQuery ? `?${cleanQuery}` : ''}#${returnRoute}`;
    history.replaceState({}, document.title, clean);
  }

  setSession(session) {
    this.session = session?.access_token ? session : null;
    if (this.session) writeJson('almost_human_supabase_session', this.session);
    else removeStorage('almost_human_supabase_session');
  }

  async ensureFreshSession() {
    if (!this.authenticated) return null;
    const expiresAt = Number(this.session.expires_at || jwtPayload(this.session.access_token)?.exp || 0);
    if (expiresAt - Math.floor(Date.now() / 1000) > 90) return this.session;
    if (!this.refreshPromise) this.refreshPromise = this.refreshSession().finally(() => { this.refreshPromise = null; });
    return this.refreshPromise;
  }

  async refreshSession() {
    if (!this.session?.refresh_token) throw new CloudError('Your session expired. Sign in again.', 401, 'SESSION_EXPIRED');
    const data = await this.authRequest('/token?grant_type=refresh_token', {
      method: 'POST', body: { refresh_token: this.session.refresh_token }, authenticated: false
    });
    this.setSession(normalizeSession(data));
    return this.session;
  }

  baseHeaders({ authenticated = true, json = true, prefer } = {}) {
    const headers = {
      Accept: 'application/json',
      apikey: this.config.publishableKey,
      ...(json ? { 'Content-Type': 'application/json' } : {}),
      ...(prefer ? { Prefer: prefer } : {})
    };
    if (authenticated && this.session?.access_token) headers.Authorization = `Bearer ${this.session.access_token}`;
    return headers;
  }

  async fetchJson(url, options = {}) {
    if (!this.configured) throw new CloudError('Supabase is not configured.', 503, 'NOT_CONFIGURED');
    if (options.authenticated !== false) await this.ensureFreshSession();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 30000);
    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers: { ...this.baseHeaders(options), ...(options.headers || {}) },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: options.signal || controller.signal
      });
      const raw = await response.text();
      let data = null;
      try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
      if (!response.ok) {
        const message = data?.msg || data?.message || data?.error_description || data?.error || `Cloud request failed (${response.status}).`;
        if (response.status === 401 && options.allowRefreshRetry !== false && this.session?.refresh_token) {
          await this.refreshSession().catch(() => this.setSession(null));
          if (this.authenticated) return this.fetchJson(url, { ...options, allowRefreshRetry: false });
        }
        throw new CloudError(message, response.status, data?.code || data?.error_code, data);
      }
      return data;
    } catch (error) {
      if (error?.name === 'AbortError') throw new CloudError('The cloud request timed out. Your local data is still safe.', 408, 'TIMEOUT');
      throw error;
    } finally { clearTimeout(timeout); }
  }

  authRequest(path, options = {}) {
    return this.fetchJson(`${this.config.url}/auth/v1${path}`, options);
  }

  authSettings() {
    return this.authRequest('/settings', { method: 'GET', authenticated: false });
  }

  restRequest(path, options = {}) {
    return this.fetchJson(`${this.config.url}/rest/v1${path}`, options);
  }

  entity(name) {
    const table = ENTITY_TABLES[name] || name;
    if (!/^[a-z_]+$/.test(table)) throw new CloudError('Unknown cloud entity.', 400, 'UNKNOWN_ENTITY');
    return {
      list: (sort, limit, skip) => this.listRows(table, {}, sort, limit, skip),
      filter: (query, sort, limit, skip) => this.listRows(table, query || {}, sort, limit, skip),
      get: async (id) => {
        const rows = await this.listRows(table, { [primaryKeyFor(table)]: id }, null, 1, 0);
        if (!rows[0]) throw new CloudError('Record not found.', 404, 'NOT_FOUND');
        return rows[0];
      },
      create: async (data) => {
        assertWritableTable(table);
        const payload = await this.addOwnerFields(table, normalizeOutbound(data));
        const rows = await this.restRequest(`/${table}`, { method: 'POST', body: payload, prefer: 'return=representation' });
        return normalizeInbound(Array.isArray(rows) ? rows[0] : rows);
      },
      update: async (id, data) => {
        assertWritableTable(table);
        const primaryKey = primaryKeyFor(table);
        const rows = await this.restRequest(`/${table}?${primaryKey}=eq.${encodeFilter(id)}`, {
          method: 'PATCH', body: normalizeOutbound(data), prefer: 'return=representation'
        });
        if (!Array.isArray(rows) || !rows[0]) throw new CloudError('Record not found or not owned by this account.', 404, 'NOT_FOUND');
        return normalizeInbound(rows[0]);
      },
      delete: async (id) => {
        assertWritableTable(table);
        const primaryKey = primaryKeyFor(table);
        await this.restRequest(`/${table}?${primaryKey}=eq.${encodeFilter(id)}`, { method: 'DELETE', prefer: 'return=minimal' });
        return true;
      },
      upsert: async (data, onConflict = 'user_id,local_id') => {
        assertWritableTable(table);
        const payload = await this.addOwnerFields(table, normalizeOutbound(data));
        const rows = await this.restRequest(`/${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
          method: 'POST', body: payload, prefer: 'resolution=merge-duplicates,return=representation'
        });
        return normalizeInbound(Array.isArray(rows) ? rows[0] : rows);
      }
    };
  }

  async listRows(table, query, sort, limit = 100, skip = 0) {
    const params = new URLSearchParams({ select: '*' });
    for (const [rawKey, rawValue] of Object.entries(query || {})) {
      const key = mapField(rawKey);
      if (rawValue === undefined) continue;
      if (rawValue === null) params.set(key, 'is.null');
      else if (Array.isArray(rawValue)) params.set(key, `in.(${rawValue.map(encodeFilter).join(',')})`);
      else params.set(key, `eq.${encodeFilter(rawValue)}`);
    }
    if (sort) {
      const descending = String(sort).startsWith('-');
      params.set('order', `${mapField(String(sort).replace(/^-/, ''))}.${descending ? 'desc' : 'asc'}`);
    }
    if (limit !== undefined && limit !== null) params.set('limit', String(Math.min(1000, Math.max(1, Number(limit) || 100))));
    if (skip) params.set('offset', String(Math.max(0, Number(skip) || 0)));
    const rows = await this.restRequest(`/${table}?${params}`);
    return (Array.isArray(rows) ? rows : []).map(normalizeInbound);
  }

  async addOwnerFields(table, payload) {
    if (!this.authenticated) throw new CloudError('Sign in before writing cloud data.', 401, 'AUTH_REQUIRED');
    const user = await this.me();
    if (table === 'profiles') return { ...payload, id: payload.id || user.id };
    if (table === 'app_settings') return { ...payload, user_id: payload.user_id || user.id };
    return { ...payload, user_id: payload.user_id || user.id };
  }

  async invoke(functionName, data, { raw = false, timeoutMs = 30000 } = {}) {
    if (!this.authenticated && functionName !== 'health') throw new CloudError('Sign in to use secure cloud features.', 401, 'AUTH_REQUIRED');
    await this.ensureFreshSession();
    const deployedName = this.config.functionNames?.[functionName] || camelToKebab(functionName);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${this.config.url}/functions/v1/${encodeURIComponent(deployedName)}`, {
        method: 'POST', headers: this.baseHeaders({ authenticated: functionName !== 'health' }),
        body: JSON.stringify(data || {}), signal: controller.signal
      });
      if (raw && response.ok) return response;
      const text = await response.text();
      let result = null; try { result = text ? JSON.parse(text) : null; } catch { result = text; }
      if (!response.ok) throw new CloudError(result?.error || result?.message || `Function failed (${response.status}).`, response.status, result?.code, result);
      return result?.data ?? result;
    } catch (error) {
      if (error?.name === 'AbortError') throw new CloudError('The secure function timed out. Your local data is still safe.', 408, 'TIMEOUT');
      throw error;
    } finally { clearTimeout(timeout); }
  }

  async rpc(name, args = {}) {
    return this.restRequest(`/rpc/${encodeURIComponent(name)}`, { method: 'POST', body: args });
  }

  async me() {
    if (!this.authenticated) throw new CloudError('Sign in required.', 401, 'AUTH_REQUIRED');
    const user = await this.authRequest('/user', { method: 'GET' });
    this.session.user = user;
    this.setSession(this.session);
    return user;
  }

  async login(email, password) {
    const data = await this.authRequest('/token?grant_type=password', {
      method: 'POST', body: { email: String(email).trim(), password: String(password) }, authenticated: false
    });
    const session = normalizeSession(data); this.setSession(session); return session;
  }

  async loginAnonymously(metadata = {}) {
    const data = await this.authRequest('/signup', {
      method: 'POST', authenticated: false, body: { data: metadata }
    });
    const session = normalizeSession(data);
    this.setSession(session);
    return session;
  }

  async register(email, password, metadata = {}) {
    const data = await this.authRequest('/signup', {
      method: 'POST', authenticated: false,
      body: { email: String(email).trim(), password: String(password), data: metadata }
    });
    if (data?.access_token) this.setSession(normalizeSession(data));
    return data;
  }

  async verifyOtp(email, token, type = 'signup') {
    const data = await this.authRequest('/verify', {
      method: 'POST', authenticated: false, body: { email: String(email).trim(), token: String(token).trim(), type }
    });
    if (data?.access_token) this.setSession(normalizeSession(data));
    return data;
  }

  async resetPasswordRequest(email) {
    return this.authRequest('/recover', {
      method: 'POST', authenticated: false,
      body: { email: String(email).trim(), redirect_to: this.authRedirectUrl('settings'), gotrue_meta_security: {} }
    });
  }

  async attachEmail(email) {
    const result = await this.authRequest('/user', { method: 'PUT', body: { email: String(email).trim() } });
    if (result?.id) { this.session.user = result; this.setSession(this.session); }
    return result;
  }

  async updatePassword(password) {
    const result = await this.authRequest('/user', { method: 'PUT', body: { password: String(password) } });
    if (result?.id) { this.session.user = result; this.setSession(this.session); }
    return result;
  }

  async logout() {
    if (this.authenticated) await this.authRequest('/logout', { method: 'POST', body: {}, allowRefreshRetry: false }).catch(() => {});
    this.setSession(null);
  }

  loginWithProvider(provider = 'google') {
    if (!this.configured) throw new CloudError('Supabase is not configured.', 503, 'NOT_CONFIGURED');
    const redirect = this.authRedirectUrl('settings');
    const url = new URL(`${this.config.url}/auth/v1/authorize`);
    url.searchParams.set('provider', provider);
    url.searchParams.set('redirect_to', redirect);
    location.href = url.toString();
  }

  authRedirectUrl(route = '') {
    if (typeof location === 'undefined') return '';
    const url = new URL(`${location.origin}${location.pathname}`);
    if (route) url.searchParams.set('auth_return', route);
    return url.toString();
  }

  async health() {
    if (!this.configured) return { status: 'not_configured', database: false, ai_configured: false, voice_configured: false };
    return this.invoke('health', {}, { timeoutMs: 10000 });
  }

  async allRows(table, query = {}, sort = 'created_at', pageSize = 1000) {
    const rows = [];
    for (let offset = 0; offset < 100000; offset += pageSize) {
      const page = await this.listRows(table, query, sort, pageSize, offset);
      rows.push(...page);
      if (page.length < pageSize) break;
    }
    return rows;
  }

  async loadLifeHistory() {
    if (!this.authenticated) throw new CloudError('Sign in before restoring cloud history.', 401, 'AUTH_REQUIRED');
    const [profileRows, settingsRows, subscriptionRows, aiRows] = await Promise.all([
      this.entity('User').list('-updated_at', 1, 0),
      this.entity('AppSettings').list('-updated_at', 1, 0),
      this.entity('Subscription').list('-updated_at', 1, 0),
      this.entity('AIEntity').filter({ archived: false }, '-updated_at', 10, 0),
    ]);
    const aiRow = aiRows[0];
    if (!aiRow) return { found: false, profile: profileRows[0] || null, settings: settingsRows[0] || null, subscription: subscriptionRows[0] || null };
    const aiId = aiRow.id;
    const [conversationRows, messageRows, memoryRows, factRows, conflictRows, skillRows, interestRows, milestoneRows, moodRows, relationshipRows, activityRows, letterRows, roomRows] = await Promise.all([
      this.allRows('conversations', { ai_entity_id: aiId }, 'created_at'),
      this.allRows('messages', { ai_entity_id: aiId }, 'created_at'),
      this.allRows('memories', { ai_entity_id: aiId }, 'created_at'),
      this.allRows('user_facts', { ai_entity_id: aiId }, 'created_at'),
      this.allRows('fact_conflicts', { ai_entity_id: aiId }, 'created_at'),
      this.allRows('skills', { ai_entity_id: aiId }, 'created_at'),
      this.allRows('interests', { ai_entity_id: aiId }, 'created_at'),
      this.allRows('milestones', { ai_entity_id: aiId }, 'created_at'),
      this.allRows('mood_history', { ai_entity_id: aiId }, 'created_at'),
      this.allRows('relationship_events', { ai_entity_id: aiId }, 'created_at'),
      this.allRows('activities', { ai_entity_id: aiId }, 'created_at'),
      this.allRows('letters', { ai_entity_id: aiId }, 'created_at'),
      this.allRows('room_items', { ai_entity_id: aiId }, 'created_at'),
    ]);
    const conversations = conversationRows.map(fromCloudConversation);
    const conversationIds = new Map(conversationRows.map((row, index) => [row.id, conversations[index].id]));
    const messages = messageRows.map((row) => fromCloudMessage(row, conversationIds));
    const messageIds = new Map(messageRows.map((row, index) => [row.id, messages[index].id]));
    const facts = factRows.map((row) => fromCloudFact(row, messageIds));
    const factIds = new Map(factRows.map((row, index) => [row.id, facts[index].id]));
    const memories = memoryRows.map((row) => fromCloudMemory(row, messageIds, conversationIds));
    const memoryIds = new Map(memoryRows.map((row, index) => [row.id, memories[index].id]));
    return {
      found: true,
      profile: fromCloudProfile(profileRows[0]),
      settings: fromCloudSettings(settingsRows[0]),
      subscription: fromCloudSubscription(subscriptionRows[0]),
      ai: withGrowthKeys(fromCloudAI(aiRow), milestoneRows),
      conversations,
      messages,
      memories,
      facts,
      factConflicts: conflictRows.map((row) => fromCloudFactConflict(row, factIds, conversationIds)),
      skills: skillRows.map(fromCloudSkill),
      interests: interestRows.map(fromCloudInterest),
      milestones: milestoneRows.map(fromCloudMilestone),
      moodHistory: moodRows.map(fromCloudMood),
      relationshipEvents: relationshipRows.map(fromCloudRelationship),
      activities: activityRows.map(fromCloudActivity),
      letters: letterRows.map((row) => fromCloudLetter(row, memoryIds)),
      roomItems: roomRows.map(fromCloudRoomItem),
    };
  }

  async restoreLifeHistory(state) {
    const remote = await this.loadLifeHistory();
    if (!remote.found) return remote;
    if (state.ai?.cloudId && state.ai.cloudId !== remote.ai.cloudId) {
      throw new CloudError('This device contains a different Almost Human life. Export or reset the local copy before connecting this account.', 409, 'LIFE_CONFLICT');
    }
    if (state.ai && !state.ai.cloudId && state.ai.id !== remote.ai.id && ((state.messages?.length || 0) > 0 || (state.memories?.length || 0) > 1)) {
      throw new CloudError('This account already has an Almost Human life, while this device has a separate local life. Export one copy before choosing which life to keep.', 409, 'LIFE_CONFLICT');
    }
    state.profile = { ...state.profile, ...(remote.profile || {}), mode: 'cloud', cloudUserId: this.userId };
    const localSecurity = { appLockEnabled: state.settings.appLockEnabled, pinHash: state.settings.pinHash };
    state.settings = { ...state.settings, ...(remote.settings || {}), ...localSecurity, cloudSyncEnabled: true };
    if (remote.subscription) state.subscription = { ...state.subscription, ...remote.subscription };
    state.ai = preferNewer(state.ai, remote.ai);
    for (const key of ['conversations','messages','memories','facts','factConflicts','skills','interests','milestones','moodHistory','relationshipEvents','activities','letters','roomItems']) {
      state[key] = mergeRecordSets(state[key], remote[key]);
    }
    return { ...remote, restored: true };
  }

  async ensureCloudIdentity(state, force = false) {
    if (!this.authenticated || !state.ai) return null;
    if (state.ai.cloudId && !force) return { id: state.ai.cloudId };
    const entity = this.entity('AIEntity');
    let cloudAI = null;
    if (state.ai.cloudId) cloudAI = await entity.get(state.ai.cloudId).catch(() => null);
    if (!cloudAI && state.ai.id) cloudAI = (await entity.filter({ local_id: state.ai.id }, '-created_at', 1))[0] || null;
    const payload = {
      local_id: state.ai.id, name: state.ai.name, pronouns: state.ai.pronouns,
      birthday: state.ai.birthTimestamp || state.ai.birthday, simulated_age: state.ai.age,
      developmental_stage: state.ai.stageKey, appearance_seed: state.ai.appearanceSeed,
      voice_id: state.ai.voiceId, relationship_style: state.ai.relationshipStyle,
      current_mood: state.ai.currentMood, mood_intensity: state.ai.moodIntensity,
      personality_state: state.ai.personality, personality_history: state.ai.personalityHistory || [],
      development_state: { growthEventKeys: state.ai.growthEventKeys || [] },
      trust_score: state.ai.trust, attachment_score: state.ai.attachment, bond_score: state.ai.bond,
      room_state: { ...(state.ai.roomState || {}), appearanceProfile: state.ai.appearanceProfile || null }, favorite_things: state.ai.favoriteThings || {},
      last_interaction_at: state.ai.lastInteractionAt, last_growth_bucket: String(state.ai.lastGrowthBucket || ''),
      archived: Boolean(state.ai.archived), onboarding_complete: true
    };
    cloudAI = cloudAI ? await entity.update(cloudAI.id, payload) : await entity.create(payload);
    state.ai.cloudId = cloudAI.id;
    await this.syncProfileAndSettings(state).catch(() => {});
    return cloudAI;
  }

  async syncProfileAndSettings(state) {
    const user = await this.me();
    await this.entity('User').upsert({
      id: user.id, display_name: state.profile.displayName || '', timezone: state.settings.timezone || 'UTC',
      locale: state.settings.locale || 'en-US', country_code: state.settings.countryCode || 'US', onboarding_complete: Boolean(state.ai)
    }, 'id');
    await this.entity('AppSettings').upsert({
      user_id: user.id, days_per_year: state.settings.daysPerYear, voice_enabled: state.settings.voiceEnabled,
      voice_autoplay: state.settings.voiceAutoplay, voice_rate: state.settings.voiceRate,
      reduced_motion: state.settings.reducedMotion, high_contrast: state.settings.highContrast,
      daily_moment_enabled: state.settings.dailyMomentEnabled, notifications_enabled: state.settings.notificationsEnabled,
      analytics_opt_in: state.settings.analyticsOptIn, sensitive_memory_mode: state.settings.sensitiveMemoryMode,
      data_retention_days: state.settings.dataRetentionDays, sound_effects: state.settings.soundEffects,
      theme: state.settings.theme, last_growth_check_at: state.settings.lastGrowthCheckAt
    }, 'user_id');
  }

  async ensureCloudConversation(state, localConversation, force = false) {
    if (!this.authenticated) return null;
    if (localConversation.cloudId && state.ai?.cloudId && !force) return { id: localConversation.cloudId };
    await this.ensureCloudIdentity(state, force);
    const entity = this.entity('Conversation');
    let cloud = localConversation.cloudId ? await entity.get(localConversation.cloudId).catch(() => null) : null;
    if (!cloud && localConversation.id) cloud = (await entity.filter({ local_id: localConversation.id }, '-created_at', 1))[0] || null;
    const payload = {
      ai_entity_id: state.ai.cloudId, local_id: localConversation.id, title: localConversation.title,
      status: localConversation.status || 'active', current_topic: localConversation.currentTopic,
      summary: localConversation.summary || '', message_count: localConversation.messageCount || 0,
      question_count: localConversation.questionCount || 0, last_message_at: localConversation.lastMessageAt
    };
    cloud = cloud ? await entity.update(cloud.id, payload) : await entity.create(payload);
    localConversation.cloudId = cloud.id;
    return cloud;
  }

  async syncLifeHistory(state) {
    if (!this.authenticated || !state.ai) return { synced: 0, conversations: 0, messages: 0 };
    await this.ensureCloudIdentity(state, true);
    let synced = 0;
    let conversationCount = 0;
    let messageCount = 0;
    const conversationMap = new Map();
    for (const conversation of (state.conversations || []).slice(0, 500)) {
      const cloudConversation = await this.ensureCloudConversation(state, conversation, true);
      conversationMap.set(conversation.id, cloudConversation.id);
      conversationCount += 1;
    }
    const messages = this.entity('Message');
    for (const row of (state.messages || []).slice(-5000)) {
      const conversationId = conversationMap.get(row.conversationId);
      if (!conversationId) continue;
      const cloudMessage = await messages.upsert({
        ai_entity_id: state.ai.cloudId, conversation_id: conversationId, local_id: row.id,
        sender: row.sender, content: String(row.content || '').slice(0, 20000), emotion: row.emotion,
        intent: row.intent, age_at_message: row.ageAtMessage, developmental_stage: row.stageKey,
        repetition_score: Number(row.repetitionScore || 0), repetition_reason: row.repetitionReason,
        request_id: row.requestId, status: row.status || 'complete', client_created_at: row.createdAt,
        safety_flags: row.safetyFlags || [], model_used: row.providerMode || 'local', metadata: { provider_mode: row.providerMode || 'local' }
      });
      row.cloudId = cloudMessage?.id || row.cloudId || null;
      messageCount += 1;
    }
    const specs = [
      ['Memory', state.memories, mapMemory], ['UserFact', state.facts, mapFact], ['FactConflict', state.factConflicts, mapFactConflict],
      ['Skill', state.skills, mapSkill], ['Interest', state.interests, mapInterest], ['Milestone', state.milestones, mapMilestone],
      ['MoodHistory', state.moodHistory, mapMood], ['RelationshipEvent', state.relationshipEvents, mapRelationship],
      ['Activity', state.activities, mapActivity], ['Letter', state.letters, mapLetter], ['RoomItem', state.roomItems, mapRoomItem]
    ];
    for (const [name, rows, mapper] of specs) {
      const entity = this.entity(name);
      for (const row of (rows || []).slice(0, 5000)) {
        const cloudRow = await entity.upsert({ ai_entity_id: state.ai.cloudId, local_id: row.id, ...mapper(row, state, conversationMap) });
        row.cloudId = cloudRow?.id || row.cloudId || null;
        synced += 1;
      }
    }
    await this.syncProfileAndSettings(state);
    return { synced, conversations: conversationCount, messages: messageCount };
  }

  async deleteAccount(confirmPhrase) {
    return this.invoke('privacyService', { action: 'delete_account', confirm_phrase: confirmPhrase });
  }

  async memoryControl(payload) {
    return this.invoke('memoryControl', payload);
  }

  async chatProvider({ state, conversation, text, requestId, localUserMessageId = null, localAiMessageId = null }) {
    if (!this.authenticated) throw new CloudError('Sign in to use secure cloud intelligence.', 401, 'AUTH_REQUIRED');
    await this.ensureCloudIdentity(state);
    const cloudConversation = await this.ensureCloudConversation(state, conversation);
    let result = null;
    const deadline = Date.now() + 18_000;
    for (let attempt = 0; attempt < 12 && Date.now() < deadline; attempt += 1) {
      result = await this.invoke('chatService', {
        ai_entity_id: state.ai.cloudId, conversation_id: cloudConversation.id,
        user_message: text, request_id: requestId,
        local_user_message_id: localUserMessageId, local_ai_message_id: localAiMessageId
      }, { timeoutMs: Math.max(3000, Math.min(12_000, deadline - Date.now())) });
      if (!result?.pending) break;
      await sleep(Math.min(1100, 350 + attempt * 70));
    }
    if (result?.pending || !result?.ai_text) throw new CloudError('The secure reply is still processing. Try sending again; the request will not duplicate.', 408, 'REQUEST_PENDING');
    return { text: result.ai_text, mode: result.provider_mode || 'cloud-ai', cloudMessageId: result.message_id, cloudUserMessageId: result.user_message_id || null };
  }

  async activityProvider({ state, type, input, requestId, localActivityId = null }) {
    if (!this.authenticated) throw new CloudError('Sign in to use secure cloud activities.', 401, 'AUTH_REQUIRED');
    await this.ensureCloudIdentity(state);
    let result = null;
    for (let attempt = 0; attempt < 32; attempt += 1) {
      result = await this.invoke('activityService', {
        ai_entity_id: state.ai.cloudId, activity_type: type, user_input: String(input || ''), request_id: requestId,
        local_activity_id: localActivityId
      }, { timeoutMs: 32000 });
      if (!result?.pending) return result;
      await sleep(Math.min(1500, 450 + attempt * 75));
    }
    throw new CloudError('The secure activity is still processing. Retry it; the request will not duplicate.', 408, 'REQUEST_PENDING');
  }

  async voiceProvider({ state, text }) {
    if (!this.authenticated) throw new CloudError('Sign in to use secure cloud voice.', 401, 'AUTH_REQUIRED');
    await this.ensureCloudIdentity(state);
    const response = await this.invoke('voiceService', {
      ai_entity_id: state.ai.cloudId, text: String(text || '').slice(0, 4096)
    }, { raw: true, timeoutMs: 45000 });
    return response.blob();
  }

  async voicePreview({ voiceId }) {
    if (!this.authenticated) throw new CloudError('Continue as guest or sign in to preview cloud voices.', 401, 'AUTH_REQUIRED');
    const response = await this.invoke('voiceService', { preview: true, voice_id: String(voiceId || 'female-adult') }, { raw: true, timeoutMs: 30000 });
    return response.blob();
  }

  async transcribeAudio({ audioBase64, mimeType = 'audio/m4a', language = 'en-US' }) {
    if (!this.authenticated) throw new CloudError('Continue as guest or sign in before using voice input.', 401, 'AUTH_REQUIRED');
    return this.invoke('transcriptionService', {
      audio_base64: String(audioBase64 || ''), mime_type: String(mimeType || 'audio/m4a'), language: String(language || 'en-US')
    }, { timeoutMs: 45000 });
  }

  async createLetter({ state, letter }) {
    if (!this.authenticated) throw new CloudError('Sign in to seal cloud letters.', 401, 'AUTH_REQUIRED');
    await this.ensureCloudIdentity(state);
    return this.invoke('letterService', {
      action: 'create', ai_entity_id: state.ai.cloudId, local_id: letter.id,
      title: letter.title, content: letter.content, unlock_age: letter.unlockAge
    });
  }

  async openLetter({ state, letter }) {
    if (!this.authenticated) throw new CloudError('Sign in to open the cloud letter.', 401, 'AUTH_REQUIRED');
    await this.ensureCloudIdentity(state);
    return this.invoke('letterService', {
      action: 'open', ai_entity_id: state.ai.cloudId, letter_id: letter.cloudId || null, local_id: letter.id
    });
  }

  async deleteLetter({ state, letter }) {
    if (!this.authenticated) throw new CloudError('Sign in to delete the cloud letter.', 401, 'AUTH_REQUIRED');
    await this.ensureCloudIdentity(state);
    return this.invoke('letterService', {
      action: 'delete', ai_entity_id: state.ai.cloudId, letter_id: letter.cloudId || null, local_id: letter.id
    });
  }
}


export class CloudError extends Error {
  constructor(message, status = 500, code = null, detail = null) {
    super(message); this.name = 'CloudError'; this.status = status; this.code = code; this.detail = detail;
  }
}

function normalizeSession(data) {
  const expiresIn = Number(data?.expires_in || 3600);
  return {
    ...data,
    expires_at: Number(data?.expires_at || Math.floor(Date.now() / 1000) + expiresIn),
    user: data?.user || jwtUser(data?.access_token)
  };
}
function jwtPayload(token) { try { return JSON.parse(atob(String(token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch { return null; } }
function jwtUser(token) { const payload = jwtPayload(token); return payload ? { id: payload.sub, email: payload.email, is_anonymous: Boolean(payload.is_anonymous), app_metadata: payload.app_metadata, user_metadata: payload.user_metadata } : null; }
function camelToKebab(value) { return String(value).replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase(); }
function mapField(key) { return FIELD_ALIASES[key] || key; }
function assertWritableTable(table) { if (READ_ONLY_TABLES.has(table)) throw new CloudError('This record is managed by the secure billing server.', 403, 'READ_ONLY_ENTITY'); }
function encodeFilter(value) { return String(value).replace(/,/g, '\\,'); }
function normalizeOutbound(value) {
  const output = {};
  for (const [key, item] of Object.entries(value || {})) {
    const mapped = mapField(key);
    if (['id','created_at','updated_at'].includes(mapped) && item == null) continue;
    if (item !== undefined) output[mapped] = item;
  }
  return output;
}
function normalizeInbound(row) {
  if (!row || typeof row !== 'object') return row;
  return { ...row, created_date: row.created_at, updated_date: row.updated_at, created_by_id: row.user_id };
}
function readJson(key) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } }
function writeJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
function removeStorage(key) { try { localStorage.removeItem(key); } catch {} }
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function mapMemory(row, state, conversationMap) { return { memory_type: row.type || 'episodic', title: row.title, content: row.content, normalized_content: row.normalizedContent, importance_score: row.importance, confidence_score: row.confidence, emotional_tone: row.emotionalTone, emotional_intensity: row.emotionalIntensity, source_message_id: state?.messages?.find(item=>item.id===row.sourceMessageId)?.cloudId || null, source_conversation_id: conversationMap?.get(row.sourceConversationId) || null, age_created: row.ageCreated, is_core_memory: Boolean(row.isCore), is_private: Boolean(row.isPrivate), tags: row.tags || [], recall_count: row.recallCount || 0, last_recalled_at: row.lastRecalledAt, status: row.status || 'active' }; }
function mapFact(row, state) { return { category: row.category, fact_key: row.label || row.key || row.factKey, normalized_key: row.key || row.normalizedKey || normalizeKey(row.label), fact_value: row.value || row.factValue, confidence: row.confidence, user_verified: Boolean(row.verified), source_message_id: state?.messages?.find(item=>item.id===row.sourceMessageId)?.cloudId || null, status: row.status || 'active' }; }
function mapFactConflict(row, state, conversationMap) { return { fact_key: row.factKey || row.key, existing_fact_id: state?.facts?.find(item=>item.id===row.factId)?.cloudId || null, existing_value: row.existingValue, proposed_value: row.proposedValue, confidence: row.confidence, source_conversation_id: conversationMap?.get(row.sourceConversationId) || null, status: row.status || 'pending', resolved_at: row.resolvedAt }; }
function mapSkill(row) { return { skill_name: row.name || row.skillName, skill_category: row.category, proficiency: row.proficiency || 0, xp: row.xp || 0, level: row.level || 1, evidence_count: row.evidenceCount || 0, unlocked_at: row.unlockedAt, last_practiced_at: row.lastPracticedAt }; }
function mapInterest(row) { return { interest_name: row.name || row.interestName, affinity_score: row.affinity || row.affinityScore || 0, source: row.source, evidence_count: row.evidenceCount || 0, first_observed_at: row.createdAt, last_observed_at: row.updatedAt || row.createdAt }; }
function mapMilestone(row) { return { milestone_type: row.type || row.milestoneType, title: row.title, description: row.description || '', age_reached: row.age, media_url: row.mediaUrl, is_keepsake: Boolean(row.isKeepsake), event_key: row.eventKey, metadata: row.metadata || {} }; }
function mapMood(row) { return { mood: row.mood, intensity: Math.min(1, Number(row.intensity || 50) / (Number(row.intensity || 0) > 1 ? 100 : 1)), cause: row.cause }; }
function mapRelationship(row) { return { event_type: row.type || row.eventType, impact: row.impact || 'neutral', description: row.description, resolved: Boolean(row.resolved) }; }
function mapActivity(row) { return { activity_type: row.type || row.activityType, activity_data: row.input || row.activityData || {}, result_data: row.result || row.resultData || {}, title: row.title, content: row.content, status: row.status || 'complete', age_at_activity: row.age || row.ageAtActivity, score: row.score, skill_gains: row.skillGains || {}, request_id: row.requestId, completed_at: row.completedAt || row.createdAt }; }
function mapLetter(row, state) { return { title: row.title || 'A letter through time', content: row.content, unlock_age: row.unlockAge, unlocked_at: row.unlockedAt, opened_at: row.openedAt, is_private: row.isPrivate !== false, delivered_memory_id: state?.memories?.find(item=>item.id===row.deliveredMemoryId)?.cloudId || null, metadata: row.metadata || {} }; }
function mapRoomItem(row) { return { item_key: row.key || row.itemKey, item_name: row.name || row.itemName, category: row.category, unlocked_at_age: row.unlockAge || row.unlockedAtAge, placed: row.placed !== false, position: row.position || {}, source: row.source, metadata: { ...(row.metadata || {}), icon: row.icon } }; }
function normalizeKey(value) { return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''); }


function fromCloudProfile(row) {
  if (!row) return null;
  return { id: row.id, displayName: row.display_name || '', mode: 'cloud', cloudUserId: row.id, createdAt: row.created_at, updatedAt: row.updated_at };
}
function fromCloudSettings(row) {
  if (!row) return null;
  return { locale: row.locale || 'en-US', timezone: row.timezone || 'UTC', countryCode: row.country_code || 'US', daysPerYear: row.days_per_year,
    voiceEnabled: row.voice_enabled, voiceAutoplay: row.voice_autoplay, voiceRate: row.voice_rate, reducedMotion: row.reduced_motion,
    highContrast: row.high_contrast, dailyMomentEnabled: row.daily_moment_enabled, notificationsEnabled: row.notifications_enabled,
    analyticsOptIn: row.analytics_opt_in, sensitiveMemoryMode: row.sensitive_memory_mode, dataRetentionDays: row.data_retention_days,
    soundEffects: row.sound_effects, theme: row.theme, lastGrowthCheckAt: row.last_growth_check_at };
}
function fromCloudSubscription(row) {
  if (!row) return null;
  return { tier: row.tier || 'free', status: row.status || 'inactive', platform: row.platform || row.provider || 'cloud', entitlements: row.entitlements || {}, updatedAt: row.updated_at };
}
function fromCloudAI(row) {
  const development = row.development_state || {};
  return { id: row.local_id || `cloud-ai-${row.id}`, cloudId: row.id, name: row.name, nickname: row.nickname, pronouns: row.pronouns,
    birthday: row.birthday, birthTimestamp: row.birthday, age: Number(row.simulated_age || 0), stageKey: row.developmental_stage,
    appearanceSeed: row.appearance_seed, appearanceProfile: row.room_state?.appearanceProfile || null, voiceId: row.voice_id, relationshipStyle: row.relationship_style, currentMood: row.current_mood,
    moodIntensity: Number(row.mood_intensity || 50), personality: row.personality_state || {}, personalityHistory: row.personality_history || [],
    favoriteThings: row.favorite_things || {}, roomState: row.room_state || {}, trust: Number(row.trust_score || 0), attachment: Number(row.attachment_score || 0),
    bond: Number(row.bond_score || 0), lastInteractionAt: row.last_interaction_at, lastGrowthBucket: Number(row.last_growth_bucket || 0),
    growthEventKeys: development.growthEventKeys || [], archived: Boolean(row.archived), createdAt: row.created_at, updatedAt: row.updated_at };
}
function withGrowthKeys(ai, milestoneRows = []) { ai.growthEventKeys = [...new Set([...(ai.growthEventKeys || []), ...milestoneRows.map((row) => row.event_key).filter((key) => /^birthday:|^stage:/.test(String(key || '')))])]; return ai; }
function fromCloudConversation(row) { return { id: row.local_id || `cloud-conversation-${row.id}`, cloudId: row.id, title: row.title, status: row.status, currentTopic: row.current_topic, summary: row.summary || '', messageCount: row.message_count || 0, questionCount: row.question_count || 0, createdAt: row.created_at, updatedAt: row.updated_at, lastMessageAt: row.last_message_at }; }
function fromCloudMessage(row, conversationIds) { return { id: row.local_id || `cloud-message-${row.id}`, cloudId: row.id, requestId: row.request_id, conversationId: conversationIds.get(row.conversation_id) || `cloud-conversation-${row.conversation_id}`, sender: row.sender, content: row.content, ageAtMessage: Number(row.age_at_message || 0), stageKey: row.developmental_stage, emotion: row.emotion, intent: row.intent, repetitionScore: Number(row.repetition_score || 0), repetitionReason: row.repetition_reason, providerMode: row.metadata?.provider_mode || row.model_used || 'cloud', safetyFlags: row.safety_flags || [], status: row.status || 'complete', createdAt: row.client_created_at || row.created_at, updatedAt: row.updated_at }; }
function fromCloudMemory(row, messageIds, conversationIds) { return { id: row.local_id || `cloud-memory-${row.id}`, cloudId: row.id, type: row.memory_type, title: row.title, content: row.content, normalizedContent: row.normalized_content, importance: Number(row.importance_score || 0), confidence: Number(row.confidence_score || 0), emotionalTone: row.emotional_tone, emotionalIntensity: row.emotional_intensity, sourceMessageId: messageIds.get(row.source_message_id) || null, sourceConversationId: conversationIds.get(row.source_conversation_id) || null, ageCreated: Number(row.age_created || 0), isCore: Boolean(row.is_core_memory), isPrivate: Boolean(row.is_private), hidden: Boolean(row.hidden), tags: row.tags || [], recallCount: row.recall_count || 0, lastRecalledAt: row.last_recalled_at, status: row.status || 'active', createdAt: row.created_at, updatedAt: row.updated_at }; }
function fromCloudFact(row, messageIds) { return { id: row.local_id || `cloud-fact-${row.id}`, cloudId: row.id, category: row.category, key: row.normalized_key, label: row.fact_key, value: row.fact_value, confidence: Number(row.confidence || 0), verified: Boolean(row.user_verified), sourceMessageId: messageIds.get(row.source_message_id) || null, status: row.status || 'active', createdAt: row.created_at, updatedAt: row.updated_at }; }
function fromCloudFactConflict(row, factIds, conversationIds) { return { id: row.local_id || `cloud-conflict-${row.id}`, cloudId: row.id, factId: factIds.get(row.existing_fact_id) || null, factKey: row.fact_key, existingValue: row.existing_value, proposedValue: row.proposed_value, confidence: Number(row.confidence || 0), sourceConversationId: conversationIds.get(row.source_conversation_id) || null, status: row.status || 'pending', resolvedAt: row.resolved_at, createdAt: row.created_at, updatedAt: row.updated_at }; }
function fromCloudSkill(row) { return { id: row.local_id || `cloud-skill-${row.id}`, cloudId: row.id, name: row.skill_name, category: row.skill_category, proficiency: Number(row.proficiency || 0), xp: row.xp || 0, level: row.level || 1, evidenceCount: row.evidence_count || 0, unlockedAt: row.unlocked_at, lastPracticedAt: row.last_practiced_at, createdAt: row.created_at, updatedAt: row.updated_at }; }
function fromCloudInterest(row) { return { id: row.local_id || `cloud-interest-${row.id}`, cloudId: row.id, name: row.interest_name, affinity: Number(row.affinity_score || 0), source: row.source, evidenceCount: row.evidence_count || 0, createdAt: row.first_observed_at || row.created_at, updatedAt: row.updated_at }; }
function fromCloudMilestone(row) { return { id: row.local_id || `cloud-milestone-${row.id}`, cloudId: row.id, type: row.milestone_type, title: row.title, description: row.description, age: Number(row.age_reached || 0), mediaUrl: row.media_url, isKeepsake: Boolean(row.is_keepsake), eventKey: row.event_key, metadata: row.metadata || {}, createdAt: row.created_at, updatedAt: row.updated_at }; }
function fromCloudMood(row) { return { id: row.local_id || `cloud-mood-${row.id}`, cloudId: row.id, mood: row.mood, intensity: Number(row.intensity || 0) <= 1 ? Number(row.intensity || 0) * 100 : Number(row.intensity || 0), cause: row.cause, createdAt: row.created_at, updatedAt: row.updated_at }; }
function fromCloudRelationship(row) { return { id: row.local_id || `cloud-relationship-${row.id}`, cloudId: row.id, type: row.event_type, impact: row.impact, description: row.description, resolved: Boolean(row.resolved), createdAt: row.created_at, updatedAt: row.updated_at }; }
function fromCloudActivity(row) { const result=row.result_data||{}; return { id: row.local_id || `cloud-activity-${row.id}`, cloudId: row.id, cloudActivityId: row.id, type: row.activity_type, title: row.title, input: row.activity_data?.user_input || '', output: row.content || result.content || '', media: result.media || null, score: row.score, providerMode: result.provider_mode || 'cloud', requestId: row.request_id, ageAtCompletion: Number(row.age_at_activity || 0), stageKey: result.stage, createdAt: row.completed_at || row.created_at, updatedAt: row.updated_at, status: row.status || 'complete' }; }
function fromCloudLetter(row, memoryIds) { return { id: row.local_id || `cloud-letter-${row.id}`, cloudId: row.id, title: row.title, content: row.content, unlockAge: Number(row.unlock_age), unlockedAt: row.unlocked_at, openedAt: row.opened_at, isPrivate: Boolean(row.is_private), deliveredMemoryId: memoryIds.get(row.delivered_memory_id) || null, sealedAt: row.sealed_at, createdAt: row.created_at, updatedAt: row.updated_at }; }
function fromCloudRoomItem(row) { return { id: row.local_id || `cloud-room-${row.id}`, cloudId: row.id, key: row.item_key, name: row.item_name, category: row.category, unlockAge: Number(row.unlocked_at_age || 0), placed: row.placed !== false, position: row.position || {}, source: row.source, icon: row.metadata?.icon, metadata: row.metadata || {}, createdAt: row.created_at, updatedAt: row.updated_at }; }
function mergeRecordSets(localRows = [], remoteRows = []) {
  const merged = new Map();
  for (const row of [...(remoteRows || []), ...(localRows || [])]) {
    if (!row) continue;
    const key = row.cloudId || row.id;
    const prior = merged.get(key);
    merged.set(key, preferNewer(prior, row));
  }
  return [...merged.values()].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}
function preferNewer(local, remote) {
  if (!local) return remote;
  if (!remote) return local;
  const localTime = new Date(local.updatedAt || local.createdAt || 0).getTime();
  const remoteTime = new Date(remote.updatedAt || remote.createdAt || 0).getTime();
  const newer = remoteTime > localTime ? remote : local;
  return { ...local, ...remote, ...newer, id: local.id || remote.id, cloudId: remote.cloudId || local.cloudId || null };
}
