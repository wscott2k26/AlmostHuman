import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2';

const TABLES: Record<string, string> = {
  User: 'profiles', AppSettings: 'app_settings', AIEntity: 'ai_entities', Conversation: 'conversations',
  Message: 'messages', Memory: 'memories', UserFact: 'user_facts', FactConflict: 'fact_conflicts',
  Skill: 'skills', Interest: 'interests', Milestone: 'milestones', MoodHistory: 'mood_history',
  RelationshipEvent: 'relationship_events', Activity: 'activities', Letter: 'letters', RoomItem: 'room_items',
  RepeatLog: 'repeat_logs', GenerationRequest: 'generation_requests', Subscription: 'subscriptions', AdminEvent: 'admin_events',
};

const LEGACY_TO_DB: Record<string, string> = { created_date: 'created_at', updated_date: 'updated_at', created_by_id: 'user_id' };

export interface AppContext {
  user: User;
  supabase: SupabaseClient;
  admin: SupabaseClient;
  entities: Record<string, EntityAdapter>;
  auth: { me(): Promise<User> };
}

export async function createAppContext(req: Request): Promise<AppContext> {
  const url = Deno.env.get('SUPABASE_URL');
  const publishable = runtimeKey('publishable');
  const secret = runtimeKey('secret');
  if (!url || !publishable) throw new HttpError('Supabase environment is incomplete.', 500, 'SERVER_CONFIG');

  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new HttpError('Unauthorized', 401, 'AUTH_REQUIRED');

  const supabase = createClient(url, publishable, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new HttpError('Unauthorized', 401, 'AUTH_REQUIRED');

  const admin = createClient(url, secret || publishable, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const entities = new Proxy({}, {
    get(_target, property: string) {
      const table = TABLES[property];
      if (!table) throw new Error(`Unknown entity ${property}`);
      return new EntityAdapter(supabase, table, data.user!.id);
    }
  }) as Record<string, EntityAdapter>;
  return { user: data.user, supabase, admin, entities, auth: { me: async () => data.user! } };
}


function runtimeKey(kind: 'publishable' | 'secret'): string {
  const direct = kind === 'publishable'
    ? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')
    : Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (direct) return direct;
  const dictionaryName = kind === 'publishable' ? 'SUPABASE_PUBLISHABLE_KEYS' : 'SUPABASE_SECRET_KEYS';
  try {
    const dictionary = JSON.parse(Deno.env.get(dictionaryName) || '{}') as Record<string, string>;
    return dictionary.default || Object.values(dictionary).find(Boolean) || '';
  } catch {
    return '';
  }
}

export class EntityAdapter {
  constructor(private client: SupabaseClient, private table: string, private userId: string) {}

  private primaryKey() { return this.table === 'app_settings' ? 'user_id' : 'id'; }

  async get(id: string): Promise<any> {
    const { data, error } = await this.client.from(this.table).select('*').eq(this.primaryKey(), id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return inbound(this.table, data);
  }

  async list(sort = '-created_date', limit = 100, skip = 0): Promise<any[]> {
    return this.filter({}, sort, limit, skip);
  }

  async filter(query: Record<string, unknown> = {}, sort = '-created_date', limit = 100, skip = 0): Promise<any[]> {
    let builder = this.client.from(this.table).select('*');
    for (const [rawKey, value] of Object.entries(query)) {
      const key = LEGACY_TO_DB[rawKey] || rawKey;
      if (value === null) builder = builder.is(key, null);
      else if (Array.isArray(value)) builder = builder.in(key, value);
      else builder = builder.eq(key, value as never);
    }
    if (sort) {
      const desc = String(sort).startsWith('-');
      builder = builder.order(LEGACY_TO_DB[String(sort).replace(/^-/, '')] || String(sort).replace(/^-/, ''), { ascending: !desc });
    }
    builder = builder.range(Math.max(0, skip), Math.max(0, skip) + Math.max(1, Math.min(limit || 100, 1000)) - 1);
    const { data, error } = await builder;
    if (error) throw error;
    return (data || []).map((row) => inbound(this.table, row));
  }

  async create(input: Record<string, unknown>): Promise<any> {
    const payload = outbound(this.table, { ...input, user_id: input.user_id || this.userId });
    if (this.table === 'profiles') {
      delete payload.user_id;
      payload.id = input.id || this.userId;
    }
    if (this.table === 'app_settings') payload.user_id = input.user_id || this.userId;
    const { data, error } = await this.client.from(this.table).insert(payload).select('*').single();
    if (error) throw error;
    return inbound(this.table, data);
  }

  async update(id: string, input: Record<string, unknown>): Promise<any> {
    const payload = outbound(this.table, input);
    delete payload.id; delete payload.user_id; delete payload.created_at; delete payload.updated_at;
    const { data, error } = await this.client.from(this.table).update(payload).eq(this.primaryKey(), id).select('*').maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError('Not found', 404, 'NOT_FOUND');
    return inbound(this.table, data);
  }

  async delete(id: string): Promise<boolean> {
    const { error } = await this.client.from(this.table).delete().eq(this.primaryKey(), id);
    if (error) throw error;
    return true;
  }
}

function outbound(table: string, input: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [rawKey, value] of Object.entries(input || {})) {
    const key = LEGACY_TO_DB[rawKey] || rawKey;
    if (value !== undefined) out[key] = value;
  }
  if (table === 'memories') {
    if ('hidden' in out && !('status' in out)) out.status = out.hidden ? 'hidden' : 'active';
    if ('media_url' in out && out.media_url && !('media_urls' in out)) out.media_urls = [out.media_url];
    if (Number(out.importance_score) >= 0 && Number(out.importance_score) <= 1) out.importance_score = Number(out.importance_score) * 100;
  }
  if (table === 'interests' && Number(out.affinity_score) >= 0 && Number(out.affinity_score) <= 1) {
    out.affinity_score = Number(out.affinity_score) * 100;
  }
  if (table === 'generation_requests' && out.status === 'started') out.status = 'started';
  return out;
}

function inbound(table: string, row: any): any {
  return { ...row, id: table === 'app_settings' ? row.user_id : row.id, created_date: row.created_at, updated_date: row.updated_at, created_by_id: row.user_id };
}

export class HttpError extends Error {
  constructor(message: string, public status = 500, public code?: string, public detail?: unknown) { super(message); }
}

export function safeError(error: unknown): string {
  return String((error as any)?.message || error || 'Unexpected error').slice(0, 500);
}

export function statusOf(error: unknown): number {
  return Number((error as any)?.status || (error as any)?.statusCode || 500);
}
