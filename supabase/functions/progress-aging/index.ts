import { createAppContext, safeError, statusOf } from '../_shared/context.ts';
import { serve } from '../_shared/cors.ts';
import { STAGE_ORDER } from '../_shared/milestones.ts';

serve(async (req) => {
  try {
    const ctx = await createAppContext(req);
    const body = await req.json().catch(() => ({}));
    const aiEntityId = String(body.ai_entity_id || '').trim();
    if (!aiEntityId) return Response.json({ error: 'ai_entity_id required' }, { status: 400 });
    const ai = await ctx.entities.AIEntity.get(aiEntityId);
    if (!ai || ai.created_by_id !== ctx.user.id || ai.archived) return Response.json({ error: 'Not found' }, { status: 404 });

    const effectiveNow = body.effective_now ? String(body.effective_now) : new Date().toISOString();
    const { data, error } = await ctx.supabase.rpc('progress_ai_aging', {
      target_ai_id: aiEntityId,
      effective_now: effectiveNow,
    });
    if (error) throw error;

    const roomItems = await ensureStageRoomItems(ctx, aiEntityId, String(data?.stage || 'newborn'), Number(data?.age || 0));
    return Response.json({
      status: Number(data?.events_created || 0) > 0 || roomItems.length ? 'advanced' : 'unchanged',
      ...data,
      room_items_created: roomItems,
    });
  } catch (error) {
    return Response.json({ error: safeError(error) }, { status: statusOf(error) });
  }
});

async function ensureStageRoomItems(ctx: any, aiEntityId: string, stageKey: string, age: number): Promise<string[]> {
  const stageIndex = Math.max(0, STAGE_ORDER.indexOf(stageKey));
  const catalog = [
    { min: 0, key: 'first_light', name: 'First Light', category: 'keepsake' },
    { min: 1, key: 'soft_star', name: 'Soft Star Toy', category: 'toy' },
    { min: 2, key: 'picture_book', name: 'Picture Book', category: 'book' },
    { min: 3, key: 'art_corner', name: 'Art Corner', category: 'creative' },
    { min: 4, key: 'story_shelf', name: 'Story Shelf', category: 'book' },
    { min: 5, key: 'hobby_desk', name: 'Hobby Desk', category: 'furniture' },
    { min: 6, key: 'music_wall', name: 'Music Wall', category: 'creative' },
    { min: 7, key: 'memory_console', name: 'Memory Console', category: 'technology' },
    { min: 8, key: 'legacy_window', name: 'Legacy Window', category: 'keepsake' },
  ];
  const created: string[] = [];
  for (const item of catalog.filter((entry) => entry.min <= stageIndex)) {
    const { error } = await ctx.supabase.from('room_items').upsert({
      user_id: ctx.user.id, ai_entity_id: aiEntityId, item_key: item.key, item_name: item.name,
      category: item.category, unlocked_at_age: age, placed: true, position: { slot: item.min }, source: `stage:${stageKey}`,
    }, { onConflict: 'user_id,ai_entity_id,item_key', ignoreDuplicates: true });
    if (!error) created.push(item.key);
  }
  return created;
}
