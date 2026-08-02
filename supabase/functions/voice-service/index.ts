import { createAppContext, safeError, statusOf } from '../_shared/context.ts';
import { serve } from '../_shared/cors.ts';
import { computeVoiceAge10, voiceStageLabel10, clampVoiceDaysPerYear10 } from '../_shared/voiceStage10.ts';
import { generateNeuralSpeech, normalizePublicVoiceId } from '../_shared/neuralVoice.ts';
import {
  normalizeServerVoiceProfile10,
  normalizeVoiceProviderPreference10,
  normalizeVoiceRate10,
  normalizeVoiceTone10,
} from '../_shared/voiceProfile10.ts';

const PREVIEWS: Record<string, string> = {
  'female-child': 'Hi! I am ready to learn something small with you.',
  'female-teen': 'Okay, I am listening. Tell me what has really been on your mind.',
  'female-adult': 'I am here with you. We can take this one real thought at a time.',
  'male-child': 'Hey! Teach me something small that matters to you.',
  'male-teen': 'I hear you. We can talk about it without making it complicated.',
  'male-adult': 'I am with you. Say it exactly the way it feels.',
};

serve(async (req) => {
  try {
    const ctx = await createAppContext(req);
    const body = await req.json().catch(() => ({}));
    const preview = Boolean(body.preview);
    const requestId = String(body.request_id || req.headers.get('x-request-id') || crypto.randomUUID()).slice(0, 200);
    let voiceId = normalizePublicVoiceId(body.voice_id);
    let tone = normalizeVoiceTone10(body.tone);
    let providerPreference = normalizeVoiceProviderPreference10(body.provider_preference);
    let rate = normalizeVoiceRate10(body.rate);
    let text = String(body.text || '').trim().slice(0, 4096);
    let stageLabel = 'Newborn';

    if (preview) {
      text = text || PREVIEWS[voiceId] || PREVIEWS['female-adult'];
    } else {
      const aiId = String(body.ai_entity_id || '').trim();
      if (!aiId || !text) {
        return Response.json({ error: 'ai_entity_id and text required', code: 'INVALID_REQUEST' }, { status: 400 });
      }
      const [ai, settingsRows] = await Promise.all([
        ctx.entities.AIEntity.get(aiId),
        ctx.entities.AppSettings.list('-created_date', 1).catch(() => []),
      ]);
      if (!ai || ai.created_by_id !== ctx.user.id || ai.archived) {
        return Response.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 });
      }
      const settings = settingsRows?.[0] || {};
      const age = computeVoiceAge10(ai.birthday, clampVoiceDaysPerYear10(settings.days_per_year));
      stageLabel = voiceStageLabel10(age);
      const storedProfile = normalizeServerVoiceProfile10(ai.voice_profile);
      voiceId = normalizePublicVoiceId(
        ai.voice_profile?.voiceId || ai.voice_profile?.voice_id || ai.voice_id || voiceId,
      );
      tone = storedProfile.tone;
      providerPreference = storedProfile.providerPreference;
      rate = storedProfile.rate;
    }

    const generated = await generateNeuralSpeech({
      text,
      voiceId,
      stageLabel,
      requestId,
      tone,
      providerPreference,
      rate,
    });
    return new Response(generated.body, {
      status: 200,
      headers: {
        'Content-Type': generated.contentType,
        'Cache-Control': preview ? 'private, max-age=86400' : 'private, no-store',
        'X-AH-Voice-Provider': generated.provider,
        'X-AH-Voice-Request': requestId,
        'X-AH-Voice-Profile': voiceId,
        'X-AH-Voice-Tone': generated.tone,
        'X-AH-Voice-Provider-Preference': providerPreference,
      },
    });
  } catch (error) {
    return Response.json(
      { error: safeError(error), code: String((error as any)?.code || 'VOICE_FAILED') },
      { status: statusOf(error) },
    );
  }
});
