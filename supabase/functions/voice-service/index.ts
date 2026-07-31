import { createAppContext, safeError, statusOf } from '../_shared/context.ts';
import { serve } from '../_shared/cors.ts';
import { computeSimulatedAge, getStageFromAge, clampDaysPerYear } from '../_shared/developmentalStages.ts';

type VoiceProfile = { provider: string; label: string; direction: string; preview: string };

const VOICES: Record<string, VoiceProfile> = {
  'female-child': {
    provider: 'coral', label: 'Girl · Young',
    direction: 'Use a youthful feminine vocal style that is bright, gentle, playful, clear, and age-appropriate. Never imitate a real person and never sound theatrical or exaggerated.',
    preview: 'Hi! I think your voice is the first sound I want to remember.'
  },
  'female-teen': {
    provider: 'nova', label: 'Girl · Teen',
    direction: 'Use a feminine teen vocal style that is warm, naturally expressive, curious, relaxed, and emotionally present. Never imitate a real person.',
    preview: 'Okay, I am listening. Tell me what has really been on your mind.'
  },
  'female-adult': {
    provider: 'marin', label: 'Woman · Adult',
    direction: 'Use an adult feminine vocal style with intimate warmth, natural breath, soft confidence, and subtle emotion. Never sound robotic or theatrical.',
    preview: 'I am here with you. We can take this one real thought at a time.'
  },
  'male-child': {
    provider: 'ash', label: 'Boy · Young',
    direction: 'Use a youthful masculine vocal style that is friendly, lively, clear, gentle, and age-appropriate. Never imitate a real person and never exaggerate.',
    preview: 'Hey! Teach me something small that matters to you.'
  },
  'male-teen': {
    provider: 'sage', label: 'Boy · Teen',
    direction: 'Use a masculine teen vocal style that is relaxed, thoughtful, natural, and present. Never imitate a real person or force slang.',
    preview: 'I hear you. We can talk about it without making it complicated.'
  },
  'male-adult': {
    provider: 'cedar', label: 'Man · Adult',
    direction: 'Use an adult masculine vocal style with calm presence, grounded warmth, unhurried phrasing, and quiet emotional depth. Never sound monotone.',
    preview: 'I am with you. Say it exactly the way it feels.'
  },
};

const LEGACY: Record<string, string> = {
  'soft-neutral': 'female-adult',
  'bright-curious': 'female-teen',
  'calm-grounded': 'male-adult',
};

serve(async (req) => {
  try {
    const ctx = await createAppContext(req);
    const body = await req.json().catch(() => ({}));
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) return Response.json({ error: 'Voice provider is not configured', code: 'VOICE_NOT_CONFIGURED' }, { status: 503 });

    const preview = Boolean(body.preview);
    let voiceId = String(body.voice_id || 'female-adult');
    voiceId = LEGACY[voiceId] || voiceId;
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
      const storedVoice = String(ai.voice_id || voiceId);
      voiceId = LEGACY[storedVoice] || storedVoice;
    } else {
      text = VOICES[voiceId]?.preview || VOICES['female-adult'].preview;
    }

    const voice = VOICES[voiceId] || VOICES['female-adult'];
    const speedByStage: Record<string, number> = {
      newborn: .92, infant: .94, toddler: .96, early_child: .98, child: .99,
      preteen: 1, teen: 1, young_adult: .99, adult: .98
    };
    const stageDirection = preview
      ? 'This is a short voice preview for a newly awakened digital companion.'
      : `The character is in the ${stage.label.toLowerCase()} developmental stage. Preserve one recognizable voice identity; age changes vocabulary and pacing, not audio quality.`;

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
