begin;

-- Build 5 / Version 10 is intentionally additive. Existing identifiers,
-- Version 9 fields, ownership columns, policies, and history tables remain unchanged.
alter table public.ai_entities
  add column if not exists presentation text,
  add column if not exists origin_profile jsonb not null default '{}'::jsonb,
  add column if not exists appearance_profile jsonb not null default '{}'::jsonb,
  add column if not exists voice_profile jsonb not null default '{}'::jsonb,
  add column if not exists renderer_version integer not null default 9;

-- Backfill only records that do not already have a Version 10 value.
update public.ai_entities
set presentation = case
  when pronouns = 'she/her' then 'feminine'
  when pronouns = 'he/him' then 'masculine'
  else 'neutral'
end
where presentation is null;

update public.ai_entities
set renderer_version = 9
where renderer_version is null;

update public.ai_entities
set origin_profile = case
  when jsonb_typeof(coalesce(development_state, '{}'::jsonb)->'originProfile') = 'object'
    then coalesce(development_state, '{}'::jsonb)->'originProfile'
  else '{}'::jsonb
end
where origin_profile = '{}'::jsonb;

update public.ai_entities
set appearance_profile = case
  when jsonb_typeof(coalesce(room_state, '{}'::jsonb)->'appearanceProfile') = 'object'
    then coalesce(room_state, '{}'::jsonb)->'appearanceProfile'
  else jsonb_build_object(
    'skinTone', 'warm',
    'skinUndertone', 'neutral',
    'faceShape', 'oval',
    'eyeShape', 'almond',
    'eyeColor', 'brown',
    'browShape', 'soft',
    'browWeight', 'medium',
    'hairStyle', 'waves',
    'hairTexture', 'wavy',
    'hairColor', 'midnight',
    'facialHair', 'none',
    'bodySilhouette', 'balanced',
    'styleDirection', 'minimal'
  )
end
where appearance_profile = '{}'::jsonb;

update public.ai_entities
set voice_profile = jsonb_build_object(
  'voiceId', coalesce(nullif(voice_id, ''), 'female-adult'),
  'tone', 'calm',
  'providerPreference', 'auto',
  'rate', 0.96,
  'previewVersion', 1
)
where voice_profile = '{}'::jsonb;

-- Keep the rollback collection inside the already-versioned development_state.
-- This does not remove or rename any Version 9 key.
update public.ai_entities
set development_state = jsonb_set(
  coalesce(development_state, '{}'::jsonb),
  '{visualRollbackSnapshots}',
  case
    when jsonb_typeof(coalesce(development_state, '{}'::jsonb)->'visualRollbackSnapshots') = 'array'
      then coalesce(development_state, '{}'::jsonb)->'visualRollbackSnapshots'
    else '[]'::jsonb
  end,
  true
)
where not (coalesce(development_state, '{}'::jsonb) ? 'visualRollbackSnapshots');

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_entities_presentation_v10_check'
      and conrelid = 'public.ai_entities'::regclass
  ) then
    alter table public.ai_entities
      add constraint ai_entities_presentation_v10_check
      check (presentation in ('masculine', 'feminine', 'neutral')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_entities_origin_profile_object_v10_check'
      and conrelid = 'public.ai_entities'::regclass
  ) then
    alter table public.ai_entities
      add constraint ai_entities_origin_profile_object_v10_check
      check (jsonb_typeof(origin_profile) = 'object') not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_entities_appearance_profile_object_v10_check'
      and conrelid = 'public.ai_entities'::regclass
  ) then
    alter table public.ai_entities
      add constraint ai_entities_appearance_profile_object_v10_check
      check (jsonb_typeof(appearance_profile) = 'object') not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_entities_voice_profile_object_v10_check'
      and conrelid = 'public.ai_entities'::regclass
  ) then
    alter table public.ai_entities
      add constraint ai_entities_voice_profile_object_v10_check
      check (jsonb_typeof(voice_profile) = 'object') not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_entities_renderer_version_v10_check'
      and conrelid = 'public.ai_entities'::regclass
  ) then
    alter table public.ai_entities
      add constraint ai_entities_renderer_version_v10_check
      check (renderer_version >= 9 and renderer_version <= 10) not valid;
  end if;
end
$$;

comment on column public.ai_entities.presentation is
  'Version 10 visual presentation; independent from pronouns, voice, personality, and memories.';
comment on column public.ai_entities.origin_profile is
  'Versioned Origin Chamber material, light, particle, pulse, and motion selections.';
comment on column public.ai_entities.appearance_profile is
  'Versioned reversible procedural appearance selections; legacy appearance_seed remains supported.';
comment on column public.ai_entities.voice_profile is
  'Public voice ID, expressive tone, provider preference, rate, and preview version; contains no provider secret.';
comment on column public.ai_entities.renderer_version is
  'Procedural visual renderer version. Version 9 remains the compatibility baseline.';

commit;
