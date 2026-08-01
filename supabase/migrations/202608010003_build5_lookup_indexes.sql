begin;

-- Build 5 adds only missing lookup support. Existing indexes, policies,
-- constraints, IDs, and rows remain unchanged.
create index if not exists messages_conversation_fk_idx
  on public.messages (conversation_id);

create index if not exists messages_ai_entity_fk_idx
  on public.messages (ai_entity_id);

create index if not exists memories_ai_entity_fk_idx
  on public.memories (ai_entity_id);

create index if not exists milestones_ai_entity_fk_idx
  on public.milestones (ai_entity_id);

create index if not exists activities_ai_entity_fk_idx
  on public.activities (ai_entity_id);

create index if not exists room_items_owner_ai_placed_idx
  on public.room_items (user_id, ai_entity_id, placed);

create index if not exists room_items_ai_entity_fk_idx
  on public.room_items (ai_entity_id);

comment on index public.room_items_owner_ai_placed_idx is
  'Supports owner-scoped Version 10 Haven placement and environment lookups.';

commit;
