import { createAppContext, statusOf } from '../_shared/context.ts';
import { serve } from '../_shared/cors.ts';
import { generateText } from '../_shared/openai.ts';
import {
  computeSimulatedAge, getStageFromAge, clampDaysPerYear, enforceDevelopmentalOutput
} from '../_shared/developmentalStages.ts';
import {
  activityDefinition, activitySystemPrompt, deterministicActivityFallback, isActivityUnlocked
} from '../_shared/activityEngine.ts';
import { inspectUserInput, containsProhibitedPhrase } from '../_shared/safety.ts';
import { entitlementsForTier, normalizeTier } from '../_shared/entitlements.ts';
import { memoryKey, memoryTerms } from '../_shared/memoryEngine.ts';

serve(async (req) => {
  let app: any = null;
  let activity: any = null;
  try {
    app = await createAppContext(req);
    const user = app.user;
    const body = await req.json().catch(() => ({}));
    const aiEntityId = String(body.ai_entity_id || '').trim();
    const activityType = String(body.activity_type || '').trim();
    const userInput = String(body.user_input || '').trim().slice(0, 8000);
    const requestId = String(body.request_id || crypto.randomUUID()).trim().slice(0, 200);
    const localActivityId = String(body.local_activity_id || '').trim().slice(0, 200) || null;
    if (!aiEntityId || !activityType) return Response.json({ error: 'ai_entity_id and activity_type required' }, { status: 400 });

    const definition = activityDefinition(activityType);
    if (!definition || activityType === 'letter') return Response.json({ error: 'Unsupported activity type' }, { status: 400 });
    const ai = await app.entities.AIEntity.get(aiEntityId);
    if (!ai || ai.created_by_id !== user.id || ai.archived) return Response.json({ error: 'Not found' }, { status: 404 });

    const settings = (await app.entities.AppSettings.list('-created_date', 1).catch(() => []))?.[0] || {};
    const subscription = (await app.entities.Subscription.list('-created_date', 1).catch(() => []))?.[0];
    const tier = normalizeTier(subscription && ['active','trialing'].includes(subscription.status) ? subscription.tier : 'free');
    const entitlements = entitlementsForTier(tier);
    const age = computeSimulatedAge(ai.birthday, clampDaysPerYear(settings.days_per_year));
    const stage = getStageFromAge(age);
    if (!isActivityUnlocked(activityType, stage.key)) {
      return Response.json({ error: `${definition.label} unlocks later`, code: 'LOCKED', min_stage: definition.minStage }, { status: 403 });
    }
    const safety = inspectUserInput(userInput, stage.key);
    if (safety.blocked) return Response.json({ error: safety.response, code: 'SAFETY' }, { status: 400 });
    if (['draw','dream','school'].includes(activityType) && tier === 'free') {
      const sample = deterministicActivityFallback(activityType, stage.key, ai.name);
      return Response.json({ content: sample, sample: true, locked_tier: 'plus', stage: stage.key, age });
    }

    const existing = await app.entities.Activity.filter({ ai_entity_id: aiEntityId, request_id: requestId }, '-created_date', 1);
    if (existing.length && existing[0].status === 'complete') {
      return Response.json({ ...existing[0].result_data, activity_id: existing[0].id, request_id: requestId, replayed: true });
    }
    if (existing.length && existing[0].status === 'started') {
      const ageMs = Date.now() - new Date(existing[0].created_date || 0).getTime();
      if (ageMs < 45_000) return Response.json({ pending: true, request_id: requestId, activity_id: existing[0].id }, { status: 202 });
      activity = await app.entities.Activity.update(existing[0].id, { status: 'started', completed_at: null });
    }

    if (!activity) {
      try {
        activity = await app.entities.Activity.create({
          ai_entity_id: aiEntityId, activity_type: activityType, title: definition.label,
          activity_data: { user_input: userInput }, status: 'started', age_at_activity: age, request_id: requestId, local_id: localActivityId,
        });
      } catch {
        activity = (await app.entities.Activity.filter({ ai_entity_id: aiEntityId, request_id: requestId }, '-created_date', 1))[0];
        if (!activity) throw new Error('Unable to create activity request.');
        if (activity.status === 'complete') return Response.json({ ...activity.result_data, activity_id: activity.id, request_id: requestId, replayed: true });
        return Response.json({ pending: true, request_id: requestId, activity_id: activity.id }, { status: 202 });
      }
    }

    let content = '';
    let providerMode = 'ai';
    let modelUsed = 'developmental-fallback';
    let tokenUsage = 0;
    if (Deno.env.get('OPENAI_API_KEY')) {
      try {
        const memories = await app.entities.Memory.filter({ ai_entity_id: aiEntityId, hidden: false }, '-importance_score', 6).catch(() => []);
        const interests = await app.entities.Interest.filter({ ai_entity_id: aiEntityId }, '-affinity_score', 5).catch(() => []);
        const context = [
          memories.length ? `Stored context: ${memories.map((memory: any) => `${memory.title || 'Memory'}: ${memory.content}`).join(' | ')}` : 'No relevant stored context.',
          interests.length ? `Emerging interests: ${interests.map((interest: any) => interest.interest_name).join(', ')}.` : 'No established interests yet.',
          `User activity input: ${userInput || 'No extra input; create a gentle starting turn.'}`,
        ].join('\n');
        const response = await generateText({
          instructions: activitySystemPrompt(activityType, stage.key, ai.name),
          messages: [{ role: 'user', content: context }],
          model: Deno.env.get('OPENAI_ACTIVITY_MODEL') || Deno.env.get('OPENAI_CHAT_MODEL') || 'gpt-5-mini',
          maxOutputTokens: Math.min(700, Math.max(80, stage.maxResponseWords * 5)),
          timeoutMs: 28000,
        });
        content = enforceDevelopmentalOutput(response.text, stage);
        modelUsed = response.model;
        tokenUsage = response.totalTokens;
      } catch (error) {
        await app.entities.AdminEvent.create({ user_id: user.id, ai_entity_id: aiEntityId, event_type: 'activity_provider_error', severity: 'error', details: { activity_type: activityType, message: String(error?.message || error).slice(0, 400) } }).catch(() => {});
      }
    }

    if (!content || containsProhibitedPhrase(content)) {
      providerMode = 'fallback';
      content = enforceDevelopmentalOutput(deterministicActivityFallback(activityType, stage.key, ai.name), stage);
    }
    const score = computeScore(userInput, content);
    const result = { content, provider_mode: providerMode, score, stage: stage.key, age, tier, model_used: modelUsed, token_usage: tokenUsage, request_id: requestId };
    await app.entities.Activity.update(activity.id, { content, result_data: result, status: 'complete', score, completed_at: new Date().toISOString() });
    await applySkillGain(app, aiEntityId, definition.skill, activityType, score);
    await applyActivitySideEffects(app, ai, activityType, userInput, content, age);
    return Response.json({ ...result, activity_id: activity.id, entitlements });
  } catch (error) {
    if (app && activity?.id) {
      await app.entities.Activity.update(activity.id, {
        status: 'failed', result_data: { error: String(error?.message || error).slice(0, 500) }, completed_at: new Date().toISOString(),
      }).catch(() => {});
    }
    return Response.json({ error: String(error?.message || error).slice(0, 500) }, { status: statusOf(error) });
  }
});

function computeScore(input: string, content: string): number {
  const participation = Math.min(1, input.trim().length / 120);
  const completion = Math.min(1, content.trim().length / 160);
  return Math.round((0.55 + participation * 0.25 + completion * 0.2) * 100);
}

async function applySkillGain(app: any, aiEntityId: string, skillName: string, category: string, score: number) {
  const normalized = skillName.toLowerCase().replace(/\s+/g, '_');
  const rows = await app.entities.Skill.filter({ ai_entity_id: aiEntityId, skill_name: normalized }, '-created_date', 1);
  const xpDelta = Math.max(3, Math.round(score / 12));
  if (rows.length) {
    const current = rows[0];
    const xp = Number(current.xp || 0) + xpDelta;
    await app.entities.Skill.update(current.id, {
      xp, level: 1 + Math.floor(xp / 100),
      proficiency: Math.min(100, Number(current.proficiency || 0) + xpDelta * 0.45),
      evidence_count: Number(current.evidence_count || 0) + 1,
      last_practiced_at: new Date().toISOString(),
    });
  } else {
    await app.entities.Skill.create({
      ai_entity_id: aiEntityId, skill_name: normalized, skill_category: category,
      xp: xpDelta, level: 1, proficiency: Math.min(10, xpDelta * 0.45), evidence_count: 1,
      unlocked_at: new Date().toISOString(), last_practiced_at: new Date().toISOString(),
    });
  }
}

async function applyActivitySideEffects(app: any, ai: any, type: string, input: string, content: string, age: number) {
  if (type === 'teach' && input.length >= 6) {
    const title = `Lesson: ${input.split(/[.!?]/)[0].slice(0, 70)}`;
    const key = memoryKey('skill', title, input);
    const existing = await app.entities.Memory.filter({ ai_entity_id: ai.id, normalized_key: key }, '-created_date', 1);
    if (!existing.length) await app.entities.Memory.create({ ai_entity_id: ai.id, memory_type: 'skill', title, content: `The user taught ${ai.name}: ${input.slice(0, 800)}`, importance_score: 58, confidence_score: .92, age_created: age, is_private: false, normalized_key: key, search_terms: memoryTerms(input), status: 'active' });
  }
  const milestones: Record<string, { type: string; title: string; description: string }> = {
    story: { type: 'first_story', title: 'First Story', description: 'Created a first shared story.' },
    draw: { type: 'first_drawing', title: 'First Drawing', description: 'Created a first age-appropriate drawing.' },
    dream: { type: 'first_dream', title: 'First Dream', description: 'Imagined a first dreamscape.' },
  };
  const milestone = milestones[type];
  if (milestone) {
    const existing = await app.entities.Milestone.filter({ ai_entity_id: ai.id, event_key: `activity:${milestone.type}` }, '-created_date', 1);
    if (!existing.length) await app.entities.Milestone.create({ ai_entity_id: ai.id, milestone_type: milestone.type, title: milestone.title, description: milestone.description, age_reached: age, event_key: `activity:${milestone.type}` });
  }
  if (type === 'dream') {
    const key = memoryKey('episodic', 'dream', content);
    const existing = await app.entities.Memory.filter({ ai_entity_id: ai.id, normalized_key: key }, '-created_date', 1);
    if (!existing.length) await app.entities.Memory.create({ ai_entity_id: ai.id, memory_type: 'episodic', title: 'An Imagined Dream', content: content.slice(0, 1000), importance_score: 45, confidence_score: 1, emotional_tone: 'imaginative', age_created: age, is_private: false, normalized_key: key, search_terms: memoryTerms(content), status: 'active' });
  }
}
