import { createAppContext, statusOf } from '../_shared/context.ts';
import { serve } from '../_shared/cors.ts';
import { computeSimulatedAge, getStageFromAge, clampDaysPerYear, PROMPT_VERSION } from "../_shared/developmentalStages.ts";

serve(async (req) => {
  try {
    const app = await createAppContext(req);
    const user = app.user;
    const body = await req.json().catch(() => ({}));
    const aiEntityId = String(body.ai_entity_id || "").trim();
    if (!aiEntityId) return Response.json({ error: "ai_entity_id required" }, { status: 400 });
    const ai = await app.entities.AIEntity.get(aiEntityId);
    if (!ai || ai.created_by_id !== user.id) return Response.json({ error: "Not found" }, { status: 404 });

    const settings = (await app.entities.AppSettings.list("-created_date", 1).catch(() => []))?.[0] || {};
    const age = computeSimulatedAge(ai.birthday, clampDaysPerYear(settings.days_per_year));
    const stage = getStageFromAge(age);
    const [conversations, messages, memories, milestones, repeats, events, activities, conflicts] = await Promise.all([
      app.entities.Conversation.filter({ ai_entity_id: aiEntityId }, "-created_date", 200),
      app.entities.Message.filter({ ai_entity_id: aiEntityId }, "-created_date", 500),
      app.entities.Memory.filter({ ai_entity_id: aiEntityId }, "-created_date", 500),
      app.entities.Milestone.filter({ ai_entity_id: aiEntityId }, "-created_date", 200),
      app.entities.RepeatLog.filter({ ai_entity_id: aiEntityId }, "-created_date", 100),
      app.entities.AdminEvent.filter({ ai_entity_id: aiEntityId }, "-created_date", 100).catch(() => []),
      app.entities.Activity.filter({ ai_entity_id: aiEntityId }, "-created_date", 200),
      app.entities.FactConflict.filter({ ai_entity_id: aiEntityId, status: "pending" }, "-created_date", 100),
    ]);

    const aiMessages = messages.filter((m: any) => m.sender === "ai");
    const highRepeats = repeats.filter((r: any) => Number(r.similarity_score || 0) >= .55);
    const providerFallbacks = aiMessages.filter((m: any) => /fallback|rule/.test(String(m.model_used || "")));
    const averageLatency = average(aiMessages.map((m: any) => Number(m.latency_ms || 0)).filter((n: number) => n > 0));

    return Response.json({
      prompt_version: PROMPT_VERSION,
      age, stage: stage.key, stage_label: stage.label,
      growth_bucket: ai.last_growth_bucket || null,
      counts: {
        conversations: conversations.length, messages: messages.length, memories: memories.length,
        milestones: milestones.length, activities: activities.length, pending_fact_conflicts: conflicts.length,
      },
      quality: {
        high_repetition_events: highRepeats.length,
        fallback_responses: providerFallbacks.length,
        average_latency_ms: Math.round(averageLatency),
        unresolved_errors: events.filter((e: any) => ["error","critical"].includes(e.severity)).length,
      },
      recent_events: events.slice(0, 15).map((event: any) => ({ id: event.id, type: event.event_type, severity: event.severity, created_date: event.created_date })),
      settings: { days_per_year: clampDaysPerYear(settings.days_per_year), voice_enabled: settings.voice_enabled !== false, voice_autoplay: Boolean(settings.voice_autoplay) },
      environment: {
        ai_configured: Boolean(Deno.env.get("OPENAI_API_KEY")),
        chat_model: Deno.env.get("OPENAI_CHAT_MODEL") || "gpt-5-mini",
      }
    });
  } catch (error) {
    return Response.json({ error: String(error?.message || error).slice(0, 500) }, { status: statusOf(error) });
  }
});

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
