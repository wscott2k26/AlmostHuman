import { createAppContext, safeError, statusOf } from '../_shared/context.ts';
import { serve } from '../_shared/cors.ts';
import { generateTextBufferedStream } from '../_shared/openai.ts';
import { computeSimulatedAge, getStageFromAge, clampDaysPerYear, enforceDevelopmentalOutput, stageFallback, PROMPT_VERSION } from '../_shared/developmentalStages.ts';
import { inspectUserInput, containsProhibitedPhrase, safetySystemPrompt } from '../_shared/safety.ts';
import { checkRepetition, extractQuestions, empathyPhrasesIn, containsVocalPraise } from '../_shared/antiRepetition.ts';
import { selectRelevantMemories } from '../_shared/memoryEngine.ts';
import { encodeAppStreamEvent, validatedDeliveryChunks } from '../_shared/streamProtocol.ts';

const FAST_TIMEOUT_MS = 6_200;

serve(async (req) => {
  const app = await createAppContext(req);
  const body = await req.json().catch(() => ({}));
  const aiEntityId = clean(body.ai_entity_id);
  const conversationId = clean(body.conversation_id);
  const userMessage = String(body.user_message || '').trim();
  const requestId = clean(body.request_id) || crypto.randomUUID();
  const localUserMessageId = clean(body.local_user_message_id) || null;
  const localAiMessageId = clean(body.local_ai_message_id) || null;
  const opening = Boolean(body.opening);
  if (!aiEntityId || !conversationId) return Response.json({ error: 'ai_entity_id and conversation_id required', code: 'INVALID_REQUEST' }, { status: 400 });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (type: any, data: Record<string, unknown>) => controller.enqueue(encodeAppStreamEvent(type, data));
      const startedAt = Date.now();
      let requestRow: any = null;
      try {
        const [ai, conversation, settingsRows] = await Promise.all([
          app.entities.AIEntity.get(aiEntityId),
          app.entities.Conversation.get(conversationId),
          app.entities.AppSettings.list('-created_date', 1).catch(() => []),
        ]);
        if (!ai || ai.created_by_id !== app.user.id || ai.archived || !conversation || conversation.created_by_id !== app.user.id || conversation.ai_entity_id !== aiEntityId) {
          throw Object.assign(new Error('Not found'), { status: 404, code: 'NOT_FOUND' });
        }

        const prior = await app.entities.Message.filter({ conversation_id: conversationId, request_id: requestId }, 'created_date', 10);
        const priorAI = prior.find((item: any) => item.sender === 'ai' && item.status !== 'failed');
        const priorUser = prior.find((item: any) => item.sender === 'user');
        send('ack', { requestId, conversationId, userMessageId: priorUser?.id || null, replayed: Boolean(priorAI) });
        if (priorAI) {
          for (const chunk of validatedDeliveryChunks(priorAI.content)) send('delta', { text: chunk });
          send('done', { text: priorAI.content, messageId: priorAI.id, userMessageId: priorUser?.id || null, providerMode: priorAI.model_used || 'replay', replayed: true });
          controller.close();
          return;
        }

        requestRow = await claimRequest(app, aiEntityId, conversationId, requestId);
        if (requestRow.status === 'complete' && requestRow.result?.ai_text) {
          const text = String(requestRow.result.ai_text);
          for (const chunk of validatedDeliveryChunks(text)) send('delta', { text: chunk });
          send('done', { text, messageId: requestRow.response_message_id || requestRow.result.message_id || null, providerMode: requestRow.provider_mode || 'replay' });
          controller.close();
          return;
        }
        await app.entities.GenerationRequest.update(requestRow.id, { status: 'generating' });

        const settings = settingsRows?.[0] || {};
        const age = computeSimulatedAge(ai.birthday, clampDaysPerYear(settings.days_per_year));
        const stage = getStageFromAge(age);
        const safety = inspectUserInput(userMessage, stage.key);
        let persistedUser = priorUser;
        if (userMessage && !persistedUser) {
          persistedUser = await app.entities.Message.create({
            conversation_id: conversationId, ai_entity_id: aiEntityId, sender: 'user', content: userMessage,
            age_at_message: age, developmental_stage: stage.key, request_id: requestId, local_id: localUserMessageId,
            client_created_at: new Date().toISOString(), status: 'complete', safety_flags: safety.flags,
          });
        }
        send('ack', { requestId, conversationId, userMessageId: persistedUser?.id || null, stage: stage.key });

        const [recentMessages, memories, facts] = await Promise.all([
          app.entities.Message.filter({ conversation_id: conversationId }, '-created_date', 24),
          app.entities.Memory.filter({ ai_entity_id: aiEntityId, status: 'active' }, '-importance_score', 80).catch(() => []),
          app.entities.UserFact.filter({ ai_entity_id: aiEntityId, status: 'active' }, '-created_date', 20).catch(() => []),
        ]);
        const recentAI = recentMessages.filter((item: any) => item.sender === 'ai').map((item: any) => String(item.content || '')).slice(0, 20);
        const recentQuestions = recentAI.slice(0, 12).flatMap(extractQuestions);
        const recentUser = recentMessages.filter((item: any) => item.sender === 'user').map((item: any) => String(item.content || '')).slice(0, 12);
        const relevant = selectRelevantMemories(memories, userMessage || conversation.summary || 'reconnect', 6);
        let providerMode = 'openai-stream-buffered';
        let modelUsed = Deno.env.get('OPENAI_FAST_CHAT_MODEL') || 'gpt-4.1-mini';
        let tokenUsage = 0;
        let text = '';

        if (safety.blocked && safety.response) {
          text = safety.response;
          providerMode = 'safety-rule';
          modelUsed = 'safety-rule';
        } else {
          const messages = recentMessages.slice(0, 16).reverse().filter((item: any) => item.sender === 'user' || item.sender === 'ai')
            .map((item: any) => ({ role: item.sender === 'ai' ? 'assistant' as const : 'user' as const, content: String(item.content || '').slice(0, 5000) }));
          if (!userMessage && opening) messages.push({ role: 'user', content: 'Begin with a brief first greeting. Do not ask a question.' });
          const result = await generateTextBufferedStream({
            instructions: buildPrompt({ ai, stage, age, relevant, facts, recentAI, recentQuestions, opening }),
            messages,
            maxOutputTokens: Math.min(420, Math.max(64, stage.maxResponseWords * 5)),
            model: modelUsed,
            timeoutMs: FAST_TIMEOUT_MS,
          });
          text = result.text;
          modelUsed = result.model;
          tokenUsage = result.totalTokens;
        }

        text = enforceDevelopmentalOutput(text, stage);
        const repetition = checkRepetition(text, {
          recentResponses: recentAI, recentQuestions, recentTopics: [conversation.current_topic || ''],
          recentEmpathyPhrases: recentAI.slice(0, 8).flatMap(empathyPhrasesIn), recentUserMessages: recentUser,
          maxQuestions: stage.questionsPerConversation, currentQuestionCount: Number(conversation.question_count || 0),
        });
        if (!text || repetition.shouldRegenerate || containsProhibitedPhrase(text) || (containsVocalPraise(text) && recentAI.some(containsVocalPraise))) {
          text = enforceDevelopmentalOutput(stageFallback(stage.key, Date.now()), stage);
          providerMode = 'developmental-fallback';
          modelUsed = 'developmental-fallback';
        }

        const emotion = inferEmotion(text);
        const intent = inferIntent(userMessage);
        const saved = await app.entities.Message.create({
          conversation_id: conversationId, ai_entity_id: aiEntityId, sender: 'ai', content: text,
          emotion, intent, age_at_message: age, developmental_stage: stage.key,
          repetition_score: repetition.score || 0, repetition_reason: repetition.reason,
          model_used: modelUsed, latency_ms: Date.now() - startedAt, token_usage: tokenUsage,
          prompt_version: PROMPT_VERSION, request_id: requestId, local_id: localAiMessageId,
          status: 'complete', safety_flags: safety.flags || [],
        });
        await Promise.all([
          app.entities.GenerationRequest.update(requestRow.id, {
            status: 'complete', response_message_id: saved.id, provider_mode: providerMode,
            result: { ai_text: text, message_id: saved.id, user_message_id: persistedUser?.id || null, stage: stage.key },
            completed_at: new Date().toISOString(), expires_at: null,
          }),
          app.entities.Conversation.update(conversationId, {
            status: 'active', last_message_at: new Date().toISOString(), current_topic: topic(userMessage) || conversation.current_topic || '',
            message_count: Number(conversation.message_count || 0) + (userMessage ? 2 : 1),
            question_count: Number(conversation.question_count || 0) + (text.match(/\?/g)?.length || 0),
            title: /^(Conversation|New conversation)$/i.test(String(conversation.title || '')) ? title(userMessage || text) : conversation.title,
          }),
          app.entities.AIEntity.update(aiEntityId, {
            simulated_age: age, developmental_stage: stage.key, current_mood: emotion,
            last_interaction_at: new Date().toISOString(), total_interactions: Number(ai.total_interactions || 0) + 1,
          }),
        ]);

        send('metadata', { providerMode, model: modelUsed, stage: stage.key, emotion, latencyMs: Date.now() - startedAt });
        for (const chunk of validatedDeliveryChunks(text)) send('delta', { text: chunk });
        send('done', { text, messageId: saved.id, userMessageId: persistedUser?.id || null, providerMode, latencyMs: Date.now() - startedAt });
      } catch (error) {
        if (requestRow?.id) await app.entities.GenerationRequest.update(requestRow.id, { status: 'failed', error_code: String((error as any)?.code || 'STREAM_FAILED'), error_message: safeError(error), completed_at: new Date().toISOString(), expires_at: null }).catch(() => {});
        send('error', { code: String((error as any)?.code || 'STREAM_FAILED'), message: safeError(error), status: statusOf(error) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' } });
});

async function claimRequest(app: any, aiEntityId: string, conversationId: string, requestId: string) {
  const rows = await app.entities.GenerationRequest.filter({ request_id: requestId, request_type: 'chat' }, '-created_date', 1);
  const existing = rows[0];
  if (existing) {
    if (existing.ai_entity_id !== aiEntityId || existing.conversation_id !== conversationId || existing.created_by_id !== app.user.id) throw Object.assign(new Error('Request identifier collision'), { status: 409, code: 'REQUEST_ID_COLLISION' });
    return existing;
  }
  try {
    return await app.entities.GenerationRequest.create({ ai_entity_id: aiEntityId, conversation_id: conversationId, request_id: requestId, request_type: 'chat', status: 'started', attempts: 1, expires_at: new Date(Date.now() + 30_000).toISOString() });
  } catch (error) {
    const retry = await app.entities.GenerationRequest.filter({ request_id: requestId, request_type: 'chat' }, '-created_date', 1);
    if (!retry[0]) throw error;
    return retry[0];
  }
}

function buildPrompt(ctx: any) {
  const parts = [
    `You are ${ctx.ai.name}, a developing AI companion in Almost Human. Simulated age: ${ctx.age}. Stage: ${ctx.stage.label}.`,
    ctx.stage.systemGuidance,
    `Use at most ${ctx.stage.maxResponseWords} words and ${ctx.stage.maxSentences} sentences. Ask no more questions than the stage permits.`,
    'Answer the newest message directly. Sound natural and specific, not like a therapy script.',
    "Do not repeatedly compliment the user's voice, tone, warmth, gentleness, or how they sound. Mention vocal qualities only when the user explicitly asks about voice or audio.",
    'Do not say “your voice is warm,” “your tone is gentle,” or close paraphrases as conversational filler.',
    'Do not ask a question after every response. A direct observation or useful thought is often better.',
  ];
  if (ctx.relevant.length) parts.push(`Relevant memories:\n${ctx.relevant.map((item: any) => `- ${item.title}: ${item.content}`).join('\n')}`);
  if (ctx.facts.length) parts.push(`Known user facts:\n${ctx.facts.slice(0, 10).map((item: any) => `- ${item.fact_key}: ${item.fact_value}`).join('\n')}`);
  if (ctx.recentAI.length) parts.push(`Do not repeat these recent replies:\n${ctx.recentAI.slice(0, 6).map((item: string) => `- ${item.slice(0, 180)}`).join('\n')}`);
  if (ctx.opening) parts.push('This is the opening. Greet briefly and do not ask a question.');
  parts.push(safetySystemPrompt());
  return parts.join('\n\n');
}

function inferIntent(value: string) { if (!value) return 'opening'; if (/\?$/.test(value.trim())) return 'question'; if (/\b(sad|hurt|lonely|angry|worried)\b/i.test(value)) return 'comfort'; return 'conversation'; }
function inferEmotion(value: string) { if (/\b(happy|excited|proud)\b/i.test(value)) return 'happy'; if (/\b(sad|hurt|sorry)\b/i.test(value)) return 'sad'; if (/\?/.test(value)) return 'curious'; return 'calm'; }
function clean(value: unknown) { return String(value || '').trim().slice(0, 200); }
function topic(value: string) { return String(value || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((item) => item.length > 3).slice(0, 4).join(' '); }
function title(value: string) { const cleanValue = String(value || 'A new beginning').replace(/\s+/g, ' ').trim(); return cleanValue.length > 42 ? `${cleanValue.slice(0, 39)}…` : cleanValue; }
