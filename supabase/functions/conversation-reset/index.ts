import { createAppContext, statusOf } from '../_shared/context.ts';
import { serve } from '../_shared/cors.ts';
import { computeSimulatedAge, getStageFromAge, clampDaysPerYear, PROMPT_VERSION, stageFallback } from "../_shared/developmentalStages.ts";

serve(async (req) => {
  try {
    const app = await createAppContext(req);
    const user = app.user;

    const body = await req.json().catch(() => ({}));
    const aiEntityId = String(body.ai_entity_id || "").trim();
    const conversationId = String(body.conversation_id || "").trim();
    const requestId = String(body.request_id || `reset:${crypto.randomUUID()}`).trim();
    if (!aiEntityId || !conversationId) return Response.json({ error: "ai_entity_id and conversation_id required" }, { status: 400 });

    const [ai, conversation] = await Promise.all([
      app.entities.AIEntity.get(aiEntityId),
      app.entities.Conversation.get(conversationId),
    ]);
    if (!ai || ai.created_by_id !== user.id || !conversation || conversation.created_by_id !== user.id || conversation.ai_entity_id !== aiEntityId) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const prior = await app.entities.Message.filter({ conversation_id: conversationId, request_id: requestId, sender: "ai" }, "-created_date", 1);
    if (prior.length) return Response.json({ ai_text: prior[0].content, message_id: prior[0].id, conversation_id: conversationId, replayed: true });

    const settings = (await app.entities.AppSettings.list("-created_date", 1).catch(() => []))?.[0] || {};
    const age = computeSimulatedAge(ai.birthday, clampDaysPerYear(settings.days_per_year));
    const stage = getStageFromAge(age);
    const text = stageFallback(stage.key, Number(conversation.reset_count || 0));

    await app.entities.AdminEvent.create({ user_id: user.id, ai_entity_id: aiEntityId, event_type: "conversation_reset", details: { conversation_id: conversationId }, severity: "info" }).catch(() => {});
    const message = await app.entities.Message.create({
      conversation_id: conversationId, ai_entity_id: aiEntityId, sender: "ai",
      content: text, emotion: "calm", intent: "reset", age_at_message: age,
      repetition_score: 0, model_used: "reset-rule", prompt_version: PROMPT_VERSION,
      request_id: requestId, status: "complete",
    });
    await app.entities.Conversation.update(conversationId, {
      current_topic: "", question_count: 0,
      reset_count: Number(conversation.reset_count || 0) + 1,
      last_message_at: new Date().toISOString(),
      message_count: Number(conversation.message_count || 0) + 1,
    });

    return Response.json({ ai_text: text, message_id: message.id, conversation_id: conversationId, stage: stage.key, age });
  } catch (error) {
    return Response.json({ error: String(error?.message || error).slice(0, 500) }, { status: statusOf(error) });
  }
});
