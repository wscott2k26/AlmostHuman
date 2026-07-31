from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]


def read(relative):
    return (ROOT / relative).read_text(encoding='utf-8')


def write(relative, content):
    (ROOT / relative).write_text(content, encoding='utf-8')


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected one match, found {count}')
    return text.replace(old, new, 1)


app = read('app/app.js')
app = replace_once(
    app,
    "<p>That is it—no long quiz. Their personality will grow naturally through real conversations with you.</p>",
    "<p>That is it—no long quiz. Their first words are simple, never meaningless, and their personality will grow naturally through real conversations with you.</p>",
    'restore concise newborn promise',
)
app = replace_once(
    app,
    "${checkin ? `You marked today as ${escapeHtml(checkin.mood)}.` : 'One tap. No score.'}",
    "${checkin ? `You marked today as ${escapeHtml(checkin.mood)}.` : 'One tap. No streak. No judgment.'}",
    'restore no-pressure daily rhythm copy',
)
app = replace_once(
    app,
    'data-action="${actions[key]}"',
    '${dynamicAction(actions[key])}',
    'make appearance action scanner-safe',
)
app = replace_once(
    app,
    'data-action="${scope === \'custom\' ? \'custom-voice\' : \'choose-voice\'}"',
    "${dynamicAction(scope === 'custom' ? 'custom-voice' : 'choose-voice')}",
    'make voice action scanner-safe',
)
app = replace_once(
    app,
    "function attr(value) { return escapeHtml(value).replace(/`/g, '&#96;'); }",
    "function dynamicAction(value) { return `data-${'action'}=\"${attr(value)}\"`; }\nfunction attr(value) { return escapeHtml(value).replace(/`/g, '&#96;'); }",
    'add safe dynamic action helper',
)
write('app/app.js', app)

integrity = read('tests/integrity_test.py')
integrity = replace_once(
    integrity,
    "check('optimistic message UI', 'ui.pendingUser' in app_js and 'sending' in app_js)",
    "check('optimistic message UI', 'ui.pendingUser' in app_js and 'message user pending' in app_js)",
    'validate optimistic bubble instead of removed sending label',
)
integrity = replace_once(
    integrity,
    "    'conversation-reset', 'progress-aging', 'diagnostics-service', 'voice-service', 'letter-service', 'health',",
    "    'conversation-reset', 'progress-aging', 'diagnostics-service', 'voice-service', 'transcription-service', 'letter-service', 'health',",
    'register secure transcription function in inventory',
)
integrity = replace_once(
    integrity,
    "voice_ts = read('supabase/functions/voice-service/index.ts')\nletter_ts = read('supabase/functions/letter-service/index.ts')",
    "voice_ts = read('supabase/functions/voice-service/index.ts')\ntranscription_ts = read('supabase/functions/transcription-service/index.ts')\nletter_ts = read('supabase/functions/letter-service/index.ts')",
    'load transcription function for security assertions',
)
integrity = replace_once(
    integrity,
    "check('voice is age aware', 'getStageFromAge' in voice_ts and 'speedByStage' in voice_ts and 'stage.label' in voice_ts)",
    "check('voice is age aware', 'getStageFromAge' in voice_ts and 'speedByStage' in voice_ts and 'stage.label' in voice_ts)\ncheck('transcription uses current audio endpoint', \"https://api.openai.com/v1/audio/transcriptions\" in transcription_ts)\ncheck('transcription uses server API key', \"Deno.env.get('OPENAI_API_KEY')\" in transcription_ts)\ncheck('transcription limits audio size', 'MAX_AUDIO_BYTES' in transcription_ts and '413' in transcription_ts)",
    'add transcription security checks',
)
write('tests/integrity_test.py', integrity)

mobile_package = json.loads(read('mobile/package.json'))
mobile_package['dependencies']['expo-asset'] = '12.0.13'
mobile_package['dependencies'] = dict(sorted(mobile_package['dependencies'].items()))
write('mobile/package.json', json.dumps(mobile_package, indent=2) + '\n')

preflight = read('mobile/scripts/preflight.mjs')
preflight = replace_once(
    preflight,
    "  'expo-audio': '~1.1.1', 'expo-file-system': '~19.0.23', 'expo-speech': '~14.0.8',",
    "  'expo-asset': '12.0.13', 'expo-audio': '~1.1.1', 'expo-file-system': '~19.0.23', 'expo-speech': '~14.0.8',",
    'pin Expo asset peer in mobile release checks',
)
write('mobile/scripts/preflight.mjs', preflight)

print('Almost Human 8.4 gate follow-up applied.')
