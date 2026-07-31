-- Almost Human production schema
-- Apply in a dedicated Supabase project. All exposed tables use RLS.

begin;

create extension if not exists pgcrypto;
create schema if not exists private;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  timezone text not null default 'UTC',
  locale text not null default 'en-US',
  country_code text not null default 'US',
  onboarding_complete boolean not null default false,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  locale text not null default 'en-US',
  country_code text not null default 'US',
  timezone text not null default 'UTC',
  days_per_year numeric(8,3) not null default 14 check (days_per_year between 1 and 365),
  voice_enabled boolean not null default true,
  voice_autoplay boolean not null default false,
  voice_rate numeric(4,2) not null default 0.96 check (voice_rate between 0.25 and 4),
  reduced_motion boolean not null default false,
  high_contrast boolean not null default false,
  daily_moment_enabled boolean not null default true,
  notifications_enabled boolean not null default false,
  analytics_opt_in boolean not null default false,
  sensitive_memory_mode text not null default 'ask' check (sensitive_memory_mode in ('ask','allow','off')),
  data_retention_days integer not null default 0 check (data_retention_days >= 0),
  app_lock_enabled boolean not null default false,
  sound_effects boolean not null default true,
  theme text not null default 'cosmic',
  last_growth_check_at timestamptz,
  last_export_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_entities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id text,
  name text not null check (char_length(name) between 1 and 80),
  nickname text,
  pronouns text not null default 'they/them',
  birthday timestamptz not null default now(),
  simulated_age numeric(10,5) not null default 0 check (simulated_age >= 0),
  developmental_stage text not null default 'newborn' check (developmental_stage in ('newborn','infant','toddler','early_child','child','preteen','teen','young_adult','adult')),
  appearance_seed text not null default 'violet-dawn',
  voice_id text not null default 'soft-neutral',
  relationship_style text not null default 'lifelong_friend' check (relationship_style in ('childlike_companion','digital_family','lifelong_friend','student_mentor')),
  current_mood text not null default 'wonder',
  mood_intensity numeric(5,2) not null default 50 check (mood_intensity between 0 and 100),
  personality_state jsonb not null default '{}'::jsonb,
  personality_history jsonb not null default '[]'::jsonb,
  development_state jsonb not null default '{}'::jsonb,
  room_state jsonb not null default '{}'::jsonb,
  favorite_things jsonb not null default '{}'::jsonb,
  trust_score numeric(5,2) not null default 18 check (trust_score between 0 and 100),
  attachment_score numeric(5,2) not null default 12 check (attachment_score between 0 and 100),
  bond_score numeric(5,2) not null default 14 check (bond_score between 0 and 100),
  last_interaction_at timestamptz,
  last_aged_at timestamptz,
  onboarding_complete boolean not null default true,
  total_interactions integer not null default 0 check (total_interactions >= 0),
  total_memories integer not null default 0 check (total_memories >= 0),
  growth_version integer not null default 1,
  last_growth_bucket text,
  last_birthday_year integer not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ai_entity_id uuid not null references public.ai_entities(id) on delete cascade,
  local_id text,
  title text not null default 'A new beginning',
  current_topic text,
  detected_intent text,
  summary text not null default '',
  quality_score numeric(5,2) not null default 0,
  status text not null default 'active' check (status in ('active','ended','archived')),
  message_count integer not null default 0 check (message_count >= 0),
  question_count integer not null default 0 check (question_count >= 0),
  reset_count integer not null default 0 check (reset_count >= 0),
  last_message_at timestamptz,
  ended_at timestamptz,
  memory_processed_through uuid,
  extraction_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id)
);

create table if not exists public.generation_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ai_entity_id uuid not null references public.ai_entities(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  request_id text not null,
  request_type text not null default 'chat',
  status text not null default 'generating' check (status in ('started','received','persisted','generating','complete','failed')),
  provider_mode text,
  attempts integer not null default 0,
  response_message_id uuid,
  error_code text,
  error_message text,
  result jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, request_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  ai_entity_id uuid not null references public.ai_entities(id) on delete cascade,
  local_id text,
  sender text not null check (sender in ('user','ai','system')),
  content text not null check (char_length(content) <= 20000),
  audio_url text,
  emotion text,
  intent text,
  age_at_message numeric(10,5),
  developmental_stage text,
  repetition_score numeric(6,5) not null default 0,
  repetition_reason text,
  model_used text,
  latency_ms integer,
  token_usage integer,
  prompt_version text,
  request_id text,
  status text not null default 'complete' check (status in ('persisted','generating','complete','failed')),
  client_created_at timestamptz,
  safety_flags text[] not null default '{}',
  memory_processed_at timestamptz,
  parent_message_id uuid references public.messages(id) on delete set null,
  retry_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id)
);

create unique index if not exists messages_request_sender_uidx
  on public.messages(user_id, conversation_id, request_id, sender)
  where request_id is not null;

alter table public.generation_requests
  drop constraint if exists generation_requests_response_message_id_fkey;
alter table public.generation_requests
  add constraint generation_requests_response_message_id_fkey
  foreign key (response_message_id) references public.messages(id) on delete set null;

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ai_entity_id uuid not null references public.ai_entities(id) on delete cascade,
  local_id text,
  memory_type text not null check (memory_type in ('episodic','semantic','emotional','skill','relationship','core','working')),
  title text not null,
  content text not null,
  normalized_content text,
  importance_score numeric(5,2) not null default 50 check (importance_score between 0 and 100),
  confidence_score numeric(5,4) not null default 0.7 check (confidence_score between 0 and 1),
  emotional_tone text,
  emotional_intensity numeric(5,4) check (emotional_intensity between 0 and 1),
  source_message_id uuid references public.messages(id) on delete set null,
  source_conversation_id uuid references public.conversations(id) on delete set null,
  age_created numeric(10,5),
  is_core_memory boolean not null default false,
  is_private boolean not null default false,
  hidden boolean not null default false,
  media_url text,
  normalized_key text,
  search_terms text[] not null default '{}',
  user_verified boolean not null default false,
  correction_note text,
  merged_count integer not null default 1,
  tags text[] not null default '{}',
  people text[] not null default '{}',
  location text,
  media_urls text[] not null default '{}',
  recall_count integer not null default 0,
  last_recalled_at timestamptz,
  status text not null default 'active' check (status in ('active','hidden','superseded','deleted')),
  merged_into_id uuid references public.memories(id) on delete set null,
  extraction_version text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id)
);

create index if not exists memories_recall_idx on public.memories(user_id, ai_entity_id, status, importance_score desc, created_at desc);
create index if not exists memories_tags_gin on public.memories using gin(tags);

create table if not exists public.user_facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ai_entity_id uuid not null references public.ai_entities(id) on delete cascade,
  local_id text,
  category text,
  fact_key text not null,
  normalized_key text not null,
  fact_value text not null,
  confidence numeric(5,4) not null default 0.6 check (confidence between 0 and 1),
  source_message_id uuid references public.messages(id) on delete set null,
  user_verified boolean not null default false,
  status text not null default 'active' check (status in ('active','disputed','superseded')),
  superseded_by_id uuid references public.user_facts(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id)
);

create unique index if not exists user_facts_active_key_uidx
  on public.user_facts(user_id, ai_entity_id, normalized_key)
  where status = 'active';

create table if not exists public.fact_conflicts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ai_entity_id uuid not null references public.ai_entities(id) on delete cascade,
  local_id text,
  fact_key text not null,
  existing_fact_id uuid references public.user_facts(id) on delete cascade,
  existing_value text not null,
  proposed_value text not null,
  source_conversation_id uuid references public.conversations(id) on delete set null,
  confidence numeric(5,4) not null default 0.5,
  status text not null default 'pending' check (status in ('pending','keep_existing','accept_new','dismissed')),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id)
);

create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ai_entity_id uuid not null references public.ai_entities(id) on delete cascade,
  local_id text,
  skill_name text not null,
  skill_category text,
  proficiency numeric(5,2) not null default 0 check (proficiency between 0 and 100),
  xp numeric(12,2) not null default 0,
  level integer not null default 1,
  evidence_count integer not null default 0,
  unlocked_at timestamptz,
  last_practiced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id),
  unique (user_id, ai_entity_id, skill_name)
);

create table if not exists public.interests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ai_entity_id uuid not null references public.ai_entities(id) on delete cascade,
  local_id text,
  interest_name text not null,
  affinity_score numeric(5,2) not null default 0 check (affinity_score between 0 and 100),
  source text,
  evidence_count integer not null default 0,
  first_observed_at timestamptz not null default now(),
  last_observed_at timestamptz not null default now(),
  last_reinforced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id),
  unique (user_id, ai_entity_id, interest_name)
);

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ai_entity_id uuid not null references public.ai_entities(id) on delete cascade,
  local_id text,
  milestone_type text not null,
  title text not null,
  description text not null default '',
  age_reached numeric(10,5),
  media_url text,
  is_keepsake boolean not null default false,
  event_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id)
);

create unique index if not exists milestones_event_uidx
  on public.milestones(user_id, ai_entity_id, event_key)
  where event_key is not null;

create table if not exists public.mood_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ai_entity_id uuid not null references public.ai_entities(id) on delete cascade,
  local_id text,
  mood text not null,
  intensity numeric(5,4) not null default 0.5 check (intensity between 0 and 1),
  cause text,
  created_at timestamptz not null default now(),
  unique (user_id, local_id)
);

create table if not exists public.relationship_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ai_entity_id uuid not null references public.ai_entities(id) on delete cascade,
  local_id text,
  event_type text not null,
  impact text not null default 'neutral' check (impact in ('positive','neutral','negative')),
  description text,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id)
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ai_entity_id uuid not null references public.ai_entities(id) on delete cascade,
  local_id text,
  activity_type text not null check (activity_type in ('teach','story','draw','play','school','daily_moment','dream','letter')),
  activity_data jsonb not null default '{}'::jsonb,
  result_data jsonb not null default '{}'::jsonb,
  title text,
  content text,
  status text not null default 'complete' check (status in ('started','complete','failed')),
  age_at_activity numeric(10,5),
  score numeric(8,2),
  skill_gains jsonb not null default '{}'::jsonb,
  request_id text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id)
);

create unique index if not exists activities_request_uidx
  on public.activities(user_id, request_id)
  where request_id is not null;

create table if not exists public.letters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ai_entity_id uuid not null references public.ai_entities(id) on delete cascade,
  local_id text,
  title text not null default 'A letter through time',
  content text not null,
  unlock_age numeric(10,5) not null,
  unlocked_at timestamptz,
  opened_at timestamptz,
  is_private boolean not null default true,
  from_name text,
  sealed_at timestamptz,
  delivered boolean not null default false,
  delivered_memory_id uuid references public.memories(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id)
);

create table if not exists public.room_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ai_entity_id uuid not null references public.ai_entities(id) on delete cascade,
  local_id text,
  item_key text not null,
  item_name text not null,
  category text,
  unlocked_at_age numeric(10,5),
  placed boolean not null default true,
  position jsonb not null default '{}'::jsonb,
  source text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_id),
  unique (user_id, ai_entity_id, item_key)
);

create table if not exists public.repeat_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ai_entity_id uuid not null references public.ai_entities(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  local_id text,
  response_text text not null,
  question_text text,
  topic text,
  is_question boolean not null default false,
  similarity_score numeric(6,5) not null default 0,
  reason text,
  regeneration_count integer not null default 0,
  resolved boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, local_id)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'none' check (provider in ('none','revenuecat','apple','google','stripe')),
  provider_subscription_id text,
  tier text not null default 'free' check (tier in ('free','plus','legacy')),
  status text not null default 'none' check (status in ('active','trialing','past_due','canceled','expired','none')),
  renewal_date timestamptz,
  product_id text,
  platform text,
  entitlements jsonb not null default '{}'::jsonb,
  cancel_at_period_end boolean not null default false,
  last_verified_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.admin_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  ai_entity_id uuid references public.ai_entities(id) on delete cascade,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  severity text not null default 'info' check (severity in ('info','warning','error','critical')),
  created_at timestamptz not null default now()
);

create index if not exists ai_entities_user_idx on public.ai_entities(user_id, archived, created_at desc);
create index if not exists conversations_user_ai_idx on public.conversations(user_id, ai_entity_id, last_message_at desc);
create index if not exists messages_conversation_idx on public.messages(user_id, conversation_id, created_at asc);
create index if not exists user_facts_ai_idx on public.user_facts(user_id, ai_entity_id, status, normalized_key);
create index if not exists activities_ai_idx on public.activities(user_id, ai_entity_id, created_at desc);
create index if not exists admin_events_user_idx on public.admin_events(user_id, created_at desc);

-- Prevent client-side privilege labels from being changed. Admin authorization uses JWT app metadata.
create or replace function private.prevent_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if tg_op = 'INSERT' and new.role <> 'user' and not public.is_admin() then
    raise exception 'Role assignment is not allowed' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Role changes are not allowed' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_role_guard on public.profiles;
create trigger profiles_role_guard before insert or update of role on public.profiles
for each row execute function private.prevent_profile_role_change();

-- Cross-table ownership checks prevent a user from attaching their row to another user's UUID.
create or replace function private.assert_ai_owner()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare owner_id uuid;
begin
  select user_id into owner_id from public.ai_entities where id = new.ai_entity_id;
  if owner_id is null or owner_id <> new.user_id then
    raise exception 'AI ownership mismatch' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function private.assert_conversation_owner()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare c_user uuid; c_ai uuid; p_user uuid; p_conversation uuid; p_ai uuid;
begin
  select user_id, ai_entity_id into c_user, c_ai from public.conversations where id = new.conversation_id;
  if c_user is null or c_user <> new.user_id then
    raise exception 'Conversation ownership mismatch' using errcode = '42501';
  end if;
  if new.ai_entity_id is not null and c_ai <> new.ai_entity_id then
    raise exception 'Conversation AI mismatch' using errcode = '23514';
  end if;
  if new.parent_message_id is not null then
    select user_id, conversation_id, ai_entity_id into p_user, p_conversation, p_ai
    from public.messages where id = new.parent_message_id;
    if p_user is null or p_user <> new.user_id or p_conversation <> new.conversation_id or p_ai <> new.ai_entity_id then
      raise exception 'Parent message ownership mismatch' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.assert_ai_and_optional_conversation_owner()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare a_user uuid; c_user uuid; c_ai uuid;
begin
  select user_id into a_user from public.ai_entities where id = new.ai_entity_id;
  if a_user is null or a_user <> new.user_id then
    raise exception 'AI ownership mismatch' using errcode = '42501';
  end if;
  if new.conversation_id is not null then
    select user_id, ai_entity_id into c_user, c_ai from public.conversations where id = new.conversation_id;
    if c_user is null or c_user <> new.user_id then
      raise exception 'Conversation ownership mismatch' using errcode = '42501';
    end if;
    if c_ai <> new.ai_entity_id then
      raise exception 'Conversation AI mismatch' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.assert_conversation_ai_owner()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare a_user uuid;
begin
  select user_id into a_user from public.ai_entities where id = new.ai_entity_id;
  if a_user is null or a_user <> new.user_id then
    raise exception 'AI ownership mismatch' using errcode = '42501';
  end if;
  return new;
end;
$$;


-- Optional foreign keys must remain inside the same user and AI boundary.
create or replace function private.assert_memory_reference_owners()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare ref_user uuid; ref_ai uuid;
begin
  if new.source_message_id is not null then
    select user_id, ai_entity_id into ref_user, ref_ai from public.messages where id = new.source_message_id;
    if ref_user is null or ref_user <> new.user_id or ref_ai <> new.ai_entity_id then
      raise exception 'Memory source message ownership mismatch' using errcode = '42501';
    end if;
  end if;
  if new.source_conversation_id is not null then
    select user_id, ai_entity_id into ref_user, ref_ai from public.conversations where id = new.source_conversation_id;
    if ref_user is null or ref_user <> new.user_id or ref_ai <> new.ai_entity_id then
      raise exception 'Memory source conversation ownership mismatch' using errcode = '42501';
    end if;
  end if;
  if new.merged_into_id is not null then
    select user_id, ai_entity_id into ref_user, ref_ai from public.memories where id = new.merged_into_id;
    if ref_user is null or ref_user <> new.user_id or ref_ai <> new.ai_entity_id then
      raise exception 'Merged memory ownership mismatch' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.assert_fact_reference_owners()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare ref_user uuid; ref_ai uuid;
begin
  if new.source_message_id is not null then
    select user_id, ai_entity_id into ref_user, ref_ai from public.messages where id = new.source_message_id;
    if ref_user is null or ref_user <> new.user_id or ref_ai <> new.ai_entity_id then
      raise exception 'Fact source message ownership mismatch' using errcode = '42501';
    end if;
  end if;
  if new.superseded_by_id is not null then
    select user_id, ai_entity_id into ref_user, ref_ai from public.user_facts where id = new.superseded_by_id;
    if ref_user is null or ref_user <> new.user_id or ref_ai <> new.ai_entity_id then
      raise exception 'Superseding fact ownership mismatch' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.assert_conflict_reference_owners()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare ref_user uuid; ref_ai uuid;
begin
  if new.existing_fact_id is not null then
    select user_id, ai_entity_id into ref_user, ref_ai from public.user_facts where id = new.existing_fact_id;
    if ref_user is null or ref_user <> new.user_id or ref_ai <> new.ai_entity_id then
      raise exception 'Conflict fact ownership mismatch' using errcode = '42501';
    end if;
  end if;
  if new.source_conversation_id is not null then
    select user_id, ai_entity_id into ref_user, ref_ai from public.conversations where id = new.source_conversation_id;
    if ref_user is null or ref_user <> new.user_id or ref_ai <> new.ai_entity_id then
      raise exception 'Conflict conversation ownership mismatch' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.assert_letter_reference_owners()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare ref_user uuid; ref_ai uuid;
begin
  if new.delivered_memory_id is not null then
    select user_id, ai_entity_id into ref_user, ref_ai from public.memories where id = new.delivered_memory_id;
    if ref_user is null or ref_user <> new.user_id or ref_ai <> new.ai_entity_id then
      raise exception 'Delivered memory ownership mismatch' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.assert_admin_event_ai_owner()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare ref_user uuid;
begin
  if new.ai_entity_id is not null then
    select user_id into ref_user from public.ai_entities where id = new.ai_entity_id;
    if ref_user is null or new.user_id is null or ref_user <> new.user_id then
      raise exception 'Admin event AI ownership mismatch' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists conversations_owner_guard on public.conversations;
create trigger conversations_owner_guard before insert or update of user_id, ai_entity_id on public.conversations
for each row execute function private.assert_conversation_ai_owner();

drop trigger if exists messages_owner_guard on public.messages;
create trigger messages_owner_guard before insert or update of user_id, conversation_id, ai_entity_id on public.messages
for each row execute function private.assert_conversation_owner();

drop trigger if exists generation_requests_owner_guard on public.generation_requests;
create trigger generation_requests_owner_guard before insert or update of user_id, conversation_id, ai_entity_id on public.generation_requests
for each row execute function private.assert_ai_and_optional_conversation_owner();

drop trigger if exists repeat_logs_owner_guard on public.repeat_logs;
create trigger repeat_logs_owner_guard before insert or update of user_id, conversation_id, ai_entity_id on public.repeat_logs
for each row execute function private.assert_ai_and_optional_conversation_owner();

-- Tables that belong directly to an AI.
do $$
declare t text;
begin
  foreach t in array array['memories','user_facts','fact_conflicts','skills','interests','milestones','mood_history','relationship_events','activities','letters','room_items']
  loop
    execute format('drop trigger if exists %I_owner_guard on public.%I', t, t);
    execute format('create trigger %I_owner_guard before insert or update of user_id, ai_entity_id on public.%I for each row execute function private.assert_ai_owner()', t, t);
  end loop;
end $$;

-- Cross-reference guards close the remaining optional foreign-key paths.
drop trigger if exists memories_reference_guard on public.memories;
create trigger memories_reference_guard before insert or update of user_id, ai_entity_id, source_message_id, source_conversation_id, merged_into_id on public.memories
for each row execute function private.assert_memory_reference_owners();

drop trigger if exists user_facts_reference_guard on public.user_facts;
create trigger user_facts_reference_guard before insert or update of user_id, ai_entity_id, source_message_id, superseded_by_id on public.user_facts
for each row execute function private.assert_fact_reference_owners();

drop trigger if exists fact_conflicts_reference_guard on public.fact_conflicts;
create trigger fact_conflicts_reference_guard before insert or update of user_id, ai_entity_id, existing_fact_id, source_conversation_id on public.fact_conflicts
for each row execute function private.assert_conflict_reference_owners();

drop trigger if exists letters_reference_guard on public.letters;
create trigger letters_reference_guard before insert or update of user_id, ai_entity_id, delivered_memory_id on public.letters
for each row execute function private.assert_letter_reference_owners();

drop trigger if exists admin_events_ai_guard on public.admin_events;
create trigger admin_events_ai_guard before insert or update of user_id, ai_entity_id on public.admin_events
for each row execute function private.assert_admin_event_ai_owner();

-- Updated-at triggers.
do $$
declare t text;
begin
  foreach t in array array['profiles','app_settings','ai_entities','conversations','generation_requests','messages','memories','user_facts','fact_conflicts','skills','interests','milestones','relationship_events','activities','letters','room_items','subscriptions']
  loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', t, t);
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- Create owner-scoped defaults when an Auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id, display_name, timezone, locale, country_code)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'timezone', 'UTC'),
    coalesce(new.raw_user_meta_data ->> 'locale', 'en-US'),
    coalesce(new.raw_user_meta_data ->> 'country_code', 'US')
  ) on conflict (id) do nothing;

  insert into public.app_settings(user_id, locale, country_code, timezone) values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'locale', 'en-US'),
    coalesce(new.raw_user_meta_data ->> 'country_code', 'US'),
    coalesce(new.raw_user_meta_data ->> 'timezone', 'UTC')
  ) on conflict (user_id) do nothing;
  insert into public.subscriptions(user_id, provider, tier, status, entitlements)
  values (new.id, 'none', 'free', 'none', '{"basic":true}'::jsonb)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Development stage helpers shared by scheduled and on-demand growth.
create or replace function public.almost_human_stage(age_value numeric)
returns text
language sql
immutable
as $$
  select case
    when age_value < 0.22 then 'newborn'
    when age_value < 0.50 then 'infant'
    when age_value < 1.00 then 'toddler'
    when age_value < 2.50 then 'early_child'
    when age_value < 5.00 then 'child'
    when age_value < 8.00 then 'preteen'
    when age_value < 13.00 then 'teen'
    when age_value < 18.00 then 'young_adult'
    else 'adult'
  end;
$$;

create or replace function public.almost_human_stage_label(stage_key text)
returns text
language sql
immutable
as $$
  select case stage_key
    when 'newborn' then 'Newborn'
    when 'infant' then 'Infant'
    when 'toddler' then 'Toddler'
    when 'early_child' then 'Early Child'
    when 'child' then 'Child'
    when 'preteen' then 'Preteen'
    when 'teen' then 'Teen'
    when 'young_adult' then 'Young Adult'
    else 'Adult'
  end;
$$;

create or replace function public.progress_ai_aging(target_ai_id uuid, effective_now timestamptz default now())
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  ai_row public.ai_entities%rowtype;
  days_value numeric;
  new_age numeric;
  old_age numeric;
  old_stage text;
  new_stage text;
  old_year integer;
  new_year integer;
  year_value integer;
  stage_value text;
  event_count integer := 0;
begin
  if current_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;

  select * into ai_row
  from public.ai_entities
  where id = target_ai_id and user_id = current_user_id and archived = false
  for update;

  if not found then raise exception 'AI not found' using errcode = 'P0002'; end if;

  select days_per_year into days_value from public.app_settings where user_id = current_user_id;
  days_value := greatest(1, least(coalesce(days_value, 14), 365));
  old_age := ai_row.simulated_age;
  old_stage := ai_row.developmental_stage;
  new_age := greatest(0, extract(epoch from (effective_now - ai_row.birthday)) / 86400 / days_value);
  new_stage := public.almost_human_stage(new_age);
  old_year := floor(old_age);
  new_year := floor(new_age);

  if new_year > old_year then
    for year_value in greatest(1, old_year + 1)..new_year loop
      insert into public.milestones(user_id, ai_entity_id, milestone_type, title, description, age_reached, is_keepsake, event_key)
      values (current_user_id, target_ai_id, 'birthday', 'Turned ' || year_value,
        ai_row.name || ' reached simulated age ' || year_value || '.', year_value, true, 'birthday:' || year_value)
      on conflict do nothing;
      if found then event_count := event_count + 1; end if;
    end loop;
  end if;

  if old_stage is distinct from new_stage then
    foreach stage_value in array array['newborn','infant','toddler','early_child','child','preteen','teen','young_adult','adult']
    loop
      if case stage_value
           when 'newborn' then 0 when 'infant' then 1 when 'toddler' then 2 when 'early_child' then 3
           when 'child' then 4 when 'preteen' then 5 when 'teen' then 6 when 'young_adult' then 7 else 8 end
         > case old_stage
           when 'newborn' then 0 when 'infant' then 1 when 'toddler' then 2 when 'early_child' then 3
           when 'child' then 4 when 'preteen' then 5 when 'teen' then 6 when 'young_adult' then 7 else 8 end
         and
         case stage_value
           when 'newborn' then 0 when 'infant' then 1 when 'toddler' then 2 when 'early_child' then 3
           when 'child' then 4 when 'preteen' then 5 when 'teen' then 6 when 'young_adult' then 7 else 8 end
         <= case new_stage
           when 'newborn' then 0 when 'infant' then 1 when 'toddler' then 2 when 'early_child' then 3
           when 'child' then 4 when 'preteen' then 5 when 'teen' then 6 when 'young_adult' then 7 else 8 end
      then
        insert into public.milestones(user_id, ai_entity_id, milestone_type, title, description, age_reached, is_keepsake, event_key)
        values (current_user_id, target_ai_id, 'stage_graduation',
          'Became a ' || public.almost_human_stage_label(stage_value),
          ai_row.name || ' entered the ' || lower(public.almost_human_stage_label(stage_value)) || ' stage.',
          new_age, true, 'stage:' || stage_value)
        on conflict do nothing;
        if found then event_count := event_count + 1; end if;
      end if;
    end loop;
  end if;

  update public.ai_entities
  set simulated_age = new_age,
      developmental_stage = new_stage,
      last_aged_at = effective_now,
      last_growth_bucket = floor(new_age * 1000)::text,
      last_birthday_year = greatest(last_birthday_year, new_year)
  where id = target_ai_id;

  update public.letters
  set unlocked_at = coalesce(unlocked_at, effective_now)
  where user_id = current_user_id and ai_entity_id = target_ai_id and unlocked_at is null and unlock_age <= new_age;

  update public.app_settings set last_growth_check_at = effective_now where user_id = current_user_id;

  return jsonb_build_object(
    'ai_entity_id', target_ai_id,
    'old_age', old_age,
    'age', new_age,
    'old_stage', old_stage,
    'stage', new_stage,
    'events_created', event_count,
    'processed_at', effective_now
  );
end;
$$;

create or replace function public.export_my_almost_human_data()
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'exported_at', now(),
    'format_version', 1,
    'profile', (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    'settings', (select to_jsonb(s) from public.app_settings s where s.user_id = auth.uid()),
    'subscription', (select to_jsonb(s) - 'raw_payload' from public.subscriptions s where s.user_id = auth.uid()),
    'ai_entities', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.ai_entities x where x.user_id = auth.uid()), '[]'::jsonb),
    'conversations', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.conversations x where x.user_id = auth.uid()), '[]'::jsonb),
    'messages', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.messages x where x.user_id = auth.uid()), '[]'::jsonb),
    'memories', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.memories x where x.user_id = auth.uid()), '[]'::jsonb),
    'facts', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.user_facts x where x.user_id = auth.uid()), '[]'::jsonb),
    'fact_conflicts', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.fact_conflicts x where x.user_id = auth.uid()), '[]'::jsonb),
    'skills', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.skills x where x.user_id = auth.uid()), '[]'::jsonb),
    'interests', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.interests x where x.user_id = auth.uid()), '[]'::jsonb),
    'milestones', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.milestones x where x.user_id = auth.uid()), '[]'::jsonb),
    'activities', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.activities x where x.user_id = auth.uid()), '[]'::jsonb),
    'letters', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.letters x where x.user_id = auth.uid()), '[]'::jsonb),
    'room_items', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.room_items x where x.user_id = auth.uid()), '[]'::jsonb)
  );
$$;

create or replace function public.delete_my_almost_human_data(confirm_phrase text)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if confirm_phrase <> 'DELETE MY ALMOST HUMAN DATA' then raise exception 'Confirmation phrase mismatch' using errcode = '22023'; end if;

  -- ai_entities cascades through almost all life-history tables.
  delete from public.ai_entities where user_id = uid;
  delete from public.admin_events where user_id = uid;
  update public.profiles set onboarding_complete = false, updated_at = now() where id = uid;
  update public.app_settings set last_growth_check_at = null, last_export_at = null where user_id = uid;
  update public.subscriptions set provider = 'none', provider_subscription_id = null, tier = 'free', status = 'none',
    renewal_date = null, product_id = null, entitlements = '{"basic":true}'::jsonb,
    cancel_at_period_end = false, last_verified_at = null, raw_payload = '{}'::jsonb where user_id = uid;
  return true;
end;
$$;

-- Enable RLS and install owner policies.
do $$
declare t text;
begin
  foreach t in array array['profiles','app_settings','ai_entities','conversations','generation_requests','messages','memories','user_facts','fact_conflicts','skills','interests','milestones','mood_history','relationship_events','activities','letters','room_items','repeat_logs','subscriptions','admin_events']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) = id or public.is_admin());
create policy profiles_insert_own on public.profiles for insert to authenticated with check ((select auth.uid()) = id and role = 'user');
create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists app_settings_all_own on public.app_settings;
create policy app_settings_all_own on public.app_settings for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Uniform owner policies for user-owned content. Subscription writes are server-only.
do $$
declare t text;
begin
  foreach t in array array['ai_entities','conversations','generation_requests','messages','memories','user_facts','fact_conflicts','skills','interests','milestones','mood_history','relationship_events','activities','letters','room_items','repeat_logs']
  loop
    execute format('drop policy if exists %I_select_own on public.%I', t, t);
    execute format('drop policy if exists %I_insert_own on public.%I', t, t);
    execute format('drop policy if exists %I_update_own on public.%I', t, t);
    execute format('drop policy if exists %I_delete_own on public.%I', t, t);
    execute format('create policy %I_select_own on public.%I for select to authenticated using ((select auth.uid()) = user_id or public.is_admin())', t, t);
    execute format('create policy %I_insert_own on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t, t);
    execute format('create policy %I_update_own on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t, t);
    execute format('create policy %I_delete_own on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t, t);
  end loop;
end $$;

drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own on public.subscriptions for select to authenticated
using ((select auth.uid()) = user_id or public.is_admin());

drop policy if exists admin_events_select on public.admin_events;
drop policy if exists admin_events_insert_own on public.admin_events;
drop policy if exists admin_events_update_admin on public.admin_events;
drop policy if exists admin_events_delete_admin on public.admin_events;
create policy admin_events_select on public.admin_events for select to authenticated
using ((select auth.uid()) = user_id or public.is_admin());
create policy admin_events_insert_own on public.admin_events for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy admin_events_update_admin on public.admin_events for update to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy admin_events_delete_admin on public.admin_events for delete to authenticated
using (public.is_admin());

-- Private media bucket. Every object path begins with the authenticated user UUID.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('almost-human-private', 'almost-human-private', false, 26214400,
  array['image/png','image/jpeg','image/webp','audio/mpeg','audio/wav','audio/webm','application/json'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists almost_human_media_select on storage.objects;
drop policy if exists almost_human_media_insert on storage.objects;
drop policy if exists almost_human_media_update on storage.objects;
drop policy if exists almost_human_media_delete on storage.objects;
create policy almost_human_media_select on storage.objects for select to authenticated
using (bucket_id = 'almost-human-private' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy almost_human_media_insert on storage.objects for insert to authenticated
with check (bucket_id = 'almost-human-private' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy almost_human_media_update on storage.objects for update to authenticated
using (bucket_id = 'almost-human-private' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'almost-human-private' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy almost_human_media_delete on storage.objects for delete to authenticated
using (bucket_id = 'almost-human-private' and (storage.foldername(name))[1] = (select auth.uid())::text);

revoke all on all tables in schema public from anon;
revoke all on function public.progress_ai_aging(uuid, timestamptz) from public, anon;
revoke all on function public.export_my_almost_human_data() from public, anon;
revoke all on function public.delete_my_almost_human_data(text) from public, anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke insert, update, delete on public.subscriptions from authenticated;
grant execute on function public.progress_ai_aging(uuid, timestamptz) to authenticated;
grant execute on function public.export_my_almost_human_data() to authenticated;
grant execute on function public.delete_my_almost_human_data(text) to authenticated;

commit;
