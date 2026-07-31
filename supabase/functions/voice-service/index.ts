import { createAppContext, safeError, statusOf } from '../_shared/context.ts';
import { serve } from '../_shared/cors.ts';
import { computeSimulatedAge, getStageFromAge, clampDaysPerYear } from '../_shared/developmentalStages.ts';

const VOICES: Record<string, { provider: string; label: string; direction: string; preview: string }> = {
  'soft-neutral': {
    provider: 'marin', label: 'Warm & close',
    direction: 'Speak with intimate warmth, natural breath, soft confidence, and subtle emotion. Never sound robotic, theatrical, or like baby talk.',
    preview: 'I think I know your voice now. It feels warm when you say my name.'
  },
  'bright-curious': {
    provider: 'coral', label: 'Bright & curious',
    direction: 'Speak with light curiosity, clear warmth, quick natural timing, and a hint of wonder. Never sound chirpy, synthetic, or exaggerated.',
    preview: 'There is so much I have not seen yet. I like that you are the first thing I get to know.'
  },
  'calm-grounded': {
    provider: 'cedar', label: 'Calm & grounded',
    direction: 'Speak with calm presence, grounded warmth, unhurried natural phrasing, and quiet emotional depth. Never sound monotone or sleepy.',
    preview: 'I am here. We do not have to rush the beginning.'
  },
};

serve(async (req) => {
  try {
    const ctx = await createAppContext(req);
    const body = await req.json().catch(() => ({}));
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) return Response.json({ error: 'Voice provider is not configured', code: 'VOICE_NOT_CONFIGURED' }, { status: 503 });

    const preview = Boolean(body.preview);
    let voiceId = String(body.voice_id || 'soft-neutral');
    let text = String(body.text || '').trim().slice(0, 4096);
    let stage = getStageFromAge(0);

    if (!preview) {
      const aiId = String(body.ai_entity_id || '').trim();
      if (!aiId || !text) return Response.json({ error: 'ai_entity_id and text required' }, { status: 400 });
      const [ai, settingsRows] = await Promise.all([
        ctx.entities.AIEntity.get(aiId),
        ctx.entities.AppSettings.list('-created_date', 1).catch(() => []),
      ]);
      if (!ai || ai.created_by_id !== ctx.user.id || ai.archived) return Response.json({ error: 'Not found' }, { status: 404 });
      const settings = settingsRows?.[0] || {};
      const age = computeSimulatedAge(ai.birthday, clampDaysPerYear(settings.days_per_year));
      stage = getStageFromAge(age);
      voiceId = String(ai.voice_id || voiceId);
    } else {
      text = VOICES[voiceId]?.preview || VOICES['soft-neutral'].preview;
    }

    const voice = VOICES[voiceId] || VOICES['soft-neutral'];
    const speedByStage: Record<string, number> = {
      newborn: .9, infant: .92, toddler: .95, early_child: .97, child: .99,
      preteen: 1, teen: 1, young_adult: .99, adult: .98
    };
    const stageDirection = preview
      ? 'This is a premium voice preview for a newly awakened digital companion.'
      : `The character is in the ${stage.label.toLowerCase()} developmental stage. Preserve a coherent recognizable voice identity; age changes vocabulary and pacing, not audio quality.`;

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: Deno.env.get('OPENAI_TTS_MODEL') || 'gpt-4o-mini-tts',
        voice: voice.provider,
        input: text,
        response_format: 'mp3',
        speed: speedByStage[stage.key] || .98,
        instructions: `${voice.direction} ${stageDirection}`,
      }),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Voice generation failed (${response.status}): ${detail.slice(0, 240)}`);
    }
    return new Response(response.body, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': preview ? 'private, max-age=86400' : 'private, no-store',
        'X-Voice-Label': voice.label,
      }
    });
  } catch (error) {
    return Response.json({ error: safeError(error) }, { status: statusOf(error) });
  }
});
