from pathlib import Path
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
failures = []
passes = []


def check(name, condition, detail=''):
    (passes if condition else failures).append((name, detail))


def read(relative):
    return (ROOT / relative).read_text(errors='ignore')


# Production file layout.
required_files = [
    'app/index.html', 'app/app.js', 'app/styles.css', 'app/config.js', 'app/manifest.webmanifest', 'app/sw.js',
    'app/core/engine.js', 'app/core/store.js', 'app/core/cloud.js', 'app/core/memory.js',
    'app/core/anti-repetition.js', 'app/core/safety.js', 'app/core/activities.js', 'app/core/stages.js',
    'app/core/chatStream.js', 'app/core/phraseQueue.js', 'app/core/performance9.js', 'app/core/voiceMode9.js',
    'app/features/onboarding9.js', 'app/features/navigation9.js', 'app/features/home9.js', 'app/features/growth9.js', 'app/features/memories9.js', 'app/features/haven9.js',
    'supabase/config.toml', 'supabase/migrations/202607290001_almost_human_core.sql',
    'supabase/functions/_shared/context.ts', 'supabase/functions/_shared/cors.ts',
    'supabase/functions/_shared/openai.ts', 'vercel.json', 'tsconfig.edge.json',
    'docs/DEPLOY_SUPABASE.md', 'docs/ENGINEERING_BLUEPRINT.md',
]
for relative in required_files:
    check(f'file {relative}', (ROOT / relative).is_file())
check('obsolete backend directory removed', not (ROOT / 'base44').exists())

# JSON documents parse.
for relative in ['package.json', 'vercel.json', 'app/manifest.webmanifest']:
    try:
        json.loads(read(relative))
        check(f'parse {relative}', True)
    except Exception as exc:
        check(f'parse {relative}', False, str(exc))

package = json.loads(read('package.json'))
check('product package name', package.get('name') == 'almost-human-premium')
check('production package version', package.get('version') == '10.0.0')
check('triple test script exists', package.get('scripts', {}).get('test:triple', '').count('test:all') == 3)
check('quadruple test script exists', package.get('scripts', {}).get('test:quadruple', '').count('test:all') == 4)
check('edge typecheck in full test', 'typecheck:edge' in package.get('scripts', {}).get('test:all', ''))
check('no runtime dependency bundle', not package.get('dependencies'))

# Frontend security and v7 product wiring.
frontend_files = [path for path in (ROOT / 'app').rglob('*') if path.is_file()]
frontend = '\n'.join(path.read_text(errors='ignore') for path in frontend_files)
app_js = read('app/app.js')
cloud_js = read('app/core/cloud.js')
chat_stream_js = read('app/core/chatStream.js')
growth9_js = read('app/features/growth9.js')
config_js = read('app/config.js')
index_html = read('app/index.html')
styles = read('app/styles.css')
sw = read('app/sw.js')

check('no native alert', not re.search(r'\balert\s*\(', frontend))
check('no native confirm', not re.search(r'\bconfirm\s*\(', frontend))
check('no placeholder coming soon', 'coming soon' not in frontend.lower())
check('no lorem ipsum', 'lorem ipsum' not in frontend.lower())
check('no unfinished TODO', not re.search(r'\bTODO\b', frontend))
check('no GitHub dependency', 'github.com' not in frontend.lower() and 'github' not in package.get('scripts', {}))
check('no frontend OpenAI secret variable', 'OPENAI_API_KEY' not in frontend)
check('no frontend service-role secret variable', 'SUPABASE_SERVICE_ROLE_KEY' not in frontend and 'SUPABASE_SECRET_KEY' not in frontend)
check('no frontend secret-shaped Supabase key', not re.search(r'\bsb_secret_[A-Za-z0-9_-]+', frontend))
check('no frontend OpenAI key value', not re.search(r'\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}', frontend))
check('public Supabase URL configured', 'https://onvoaskzzxozmhkzyycy.supabase.co' in config_js)
check('public Supabase project ref configured', "projectRef: 'onvoaskzzxozmhkzyycy'" in config_js)
check('publishable key only', 'sb_publishable_' in config_js and 'sb_secret_' not in config_js)
check('Supabase preconnect', 'onvoaskzzxozmhkzyycy.supabase.co' in index_html and 'base44.app' not in index_html)
check('PWA manifest linked', 'manifest.webmanifest' in index_html)
check('service worker version advanced', 'almost-human-v9-0-conversation' in sw and 'v=9.0' in sw)
check('service worker excludes function APIs', "url.pathname.includes('/functions/')" in sw)
check('service worker does not cache non-GET', "request.method !== 'GET'" in sw)
check('privacy local export implemented', 'function exportData()' in app_js)
check('privacy cloud export implemented', 'function exportCloudData()' in app_js and "action: 'export_all'" in app_js)
check('local deletion implemented', 'function deleteAll()' in app_js)
check('cloud app-data deletion implemented', 'function deleteCloudData()' in app_js and 'DELETE MY ALMOST HUMAN DATA' in app_js)
check('cloud account deletion implemented', 'function deleteCloudAccount()' in app_js and 'DELETE MY ACCOUNT' in app_js)
check('guest authentication UI wired', 'Continue as Guest' in app_js and 'cloud.loginAnonymously' in app_js)
check('social account options wired', all(label in app_js for label in ['provider-google', 'provider-apple', 'provider-facebook']) and 'cloud.authSettings()' in app_js)
check('auth modal backdrop preserves typing', "target.classList.contains('modal-backdrop')" in app_js and 'event.target !== target' in app_js and 'onclick="event.stopPropagation()"' not in app_js)
check('complete focused interior pages', all(marker in app_js for marker in ['v9-growth', 'v9-memories', 'v9-haven', 'v8-settings-page']))
check('guest upgrade preserves life', 'cloud.attachEmail' in app_js and 'Protect this account' in app_js)
check('auth login UI wired', 'function openLogin()' in app_js and 'cloud.login(' in app_js)
check('auth registration UI wired', 'function openRegister()' in app_js and 'cloud.register(' in app_js)
check('password recovery wired', 'function openPasswordReset()' in app_js and 'cloud.resetPasswordRequest' in app_js)
check('manual cloud sync wired', 'function syncNow(' in app_js and 'cloud.syncLifeHistory' in app_js)
check('cloud health UI wired', 'function checkServices()' in app_js and 'cloud.health()' in app_js)
check('dedicated conversation reset wired', "cloud.invoke('conversationReset'" in app_js)
check('anti-repeat semantic check', 'semantic_duplicate' in read('app/core/anti-repetition.js'))
check('growth idempotency event keys', 'growthEventKeys' in read('app/core/engine.js'))
check('request ids used in chat', "makeRequestId('chat')" in app_js)
check('chat request guard and cancellation', 'activeChatController' in app_js and 'ui.activeRequestId' in app_js and 'stopCurrentTurn' in app_js)
check('optimistic message UI', 'createOptimisticTurn' in app_js and 'applyStreamEvent' in app_js and "status: 'pending'" in chat_stream_js)
check('short skippable first-light experience', 'firstLightDurationMs' in app_js and 'beginBirthSequence' in app_js and '.v9-first-light' in styles and 'Skip and talk now' in app_js)
check('coherent newborn UX copy without canned vocal praise', 'personality' in app_js.lower() and 'Your voice feels warm' not in read('app/core/engine.js') and 'Your voice feels warm' not in read('app/core/stages.js') and 'Your voice feels warm' not in read('supabase/functions/_shared/developmentalStages.ts') and 'Your voice came back' not in read('supabase/functions/_shared/developmentalStages.ts') and 'sound feels safe and familiar' not in read('supabase/functions/_shared/developmentalStages.ts').lower() and 'your voice is warm' not in frontend.lower())
check('premium neural voice preview', 'cloud.voicePreview' in app_js and 'voicePreview' in cloud_js)
check('six clear voice profiles', all(item in app_js for item in ['female-child','female-teen','female-adult','male-child','male-teen','male-adult']))
check('real appearance controls', all(item in app_js for item in ['skinTone','hairStyle','hairColor','eyeColor','customize-companion']))
check('conversation-first onboarding', 'createOnboardingModel' in app_js and 'v9-welcome' in app_js and 'v9-quick-create' in app_js and 'v9-first-light' in app_js)
check('native microphone transcription bridge', "nativePost('mic-toggle')" in app_js and 'transcribeAudio' in cloud_js and 'transcriptionService' in config_js)
check('native neural audio and explicit device fallback', "nativePost('audio-play'" in app_js and "nativePost('device-speak-once'" in app_js and "nativePost('speak'" not in app_js)
check('consumer UI hides provider labels', 'provider_mode' not in app_js and 'developmental-local' not in app_js)
check('companion-first portrait system', 'function beingMarkup' in app_js and '.being-face' in styles and '.presence-hero' in styles)
check('focused memory list and detail controls', 'memoryListModel9' in app_js and 'openMemoryDetail' in app_js and '.v9-memory-list' in styles)
check('no fake typing dots or thought carousel', 'THOUGHT_PHASES' not in app_js and 'typing-dots' not in app_js and 'I am with you.' in app_js)
check('reduced motion support', '.reduce-motion' in styles)
check('mobile companion layout', '@media(max-width:820px)' in styles and '.mobile-tabs' in styles)
check('touch controls have mobile baseline', 'width:41px;height:41px' in styles and 'min-width:190px' in styles)
check('billing stays preview-only', "billingMode: 'preview'" in config_js and 'purchase' not in app_js.lower())
check('optional daily rhythm remains available', 'daily-checkin' in app_js and 'dailyMomentEnabled' in app_js)
check('stage-aware conversation sparks wired', 'function conversationSparks' in app_js and 'function todaysConversationSpark' in app_js)
check('growth interests and skills remain in underlying state', 'interests:' in read('app/core/store.js') and 'skills:' in read('app/core/store.js'))
check('life journal data helper retained', 'function lifeJournalEntries' in app_js)
check('on this day memory helper retained', 'function onThisDayMemory' in app_js)
check('future letters exposed', 'function openLetterComposer' in app_js and 'function openFutureLetter' in app_js)
check('earned Haven home wired', 'v83-haven' in app_js and 'state.roomItems' in app_js and 'function havenProfile' in app_js)
check('visual keepsakes remain represented in Haven items', 'state.roomItems' in app_js and 'keepsake' in app_js.lower())
check('Haven stage and mood atmosphere wired', all(marker in app_js for marker in ['The Haven', 'mood-${safeClass', 'havenProfile']) and '.v83-haven-window' in styles)
check('Haven objects are inspectable', 'inspect-haven-item' in app_js and 'function inspectHavenItem' in app_js)
check('activity keepsakes populate Haven', 'unlockActivityKeepsake' in read('app/core/activities.js') and 'sourceActivityType' in read('app/core/activities.js'))
check('cloud chat can reference Haven', 'THE HAVEN (your evolving home)' in read('supabase/functions/chat-service/index.ts') and 'app.entities.RoomItem.filter' in read('supabase/functions/chat-service/index.ts'))
check('tactile feedback wired', 'function tactileFeedback' in app_js and 'navigator.vibrate' in app_js and '.v82-tactile' in styles)
check('liquid glass and cinematic reveal wired', '.v82-living-glass' in styles and '@keyframes v82Reveal' in styles)
check('reduced transparency support', '@media(prefers-reduced-transparency:reduce)' in styles)


# Every literal data-action must be handled by the delegated action router.
actions = set(re.findall(r'data-action=["\']([^"\']+)', app_js))
handlers = set(re.findall(r"action === ['\"]([^'\"]+)['\"]", app_js))
missing_actions = sorted(actions - handlers)
check('all frontend actions are routed', not missing_actions, ', '.join(missing_actions))

# Supabase browser adapter.
check('Supabase REST adapter', '/rest/v1' in cloud_js and '/functions/v1/' in cloud_js and '/auth/v1' in cloud_js)
check('bearer auth attached', 'headers.Authorization = `Bearer ${this.session.access_token}`' in cloud_js)
check('session refresh implemented', 'ensureFreshSession' in cloud_js and 'refresh_token' in cloud_js)
check('OAuth callback strips tokens', 'history.replaceState' in cloud_js and 'access_token' in cloud_js)
check('OAuth redirect uses query return route', "url.searchParams.set('auth_return', route)" in cloud_js)
check('PostgREST filters avoid double encoding', "function encodeFilter(value) { return String(value).replace(/,/g, '\\\\,'); }" in cloud_js)
check('app settings primary key special case', "table === 'app_settings' ? 'user_id' : 'id'" in cloud_js)
check('subscriptions browser read-only', "new Set(['subscriptions'])" in cloud_js and 'READ_ONLY_ENTITY' in cloud_js)
check('chat pending polling', 'result?.pending' in cloud_js and 'REQUEST_PENDING' in cloud_js)
check('cloud request timeout', 'AbortController' in cloud_js and "code = null" in cloud_js)
check('life-history synchronization', 'syncLifeHistory(state)' in cloud_js and "['Memory', state.memories" in cloud_js)

# Migration structure and security.
migration = read('supabase/migrations/202607290001_almost_human_core.sql')
check('migration transaction begins', migration.lstrip().startswith('-- Almost Human') and re.search(r'\bbegin;\s', migration, re.I))
check('migration transaction commits', migration.rstrip().endswith('commit;'))
check('balanced dollar quote delimiters', migration.count('$$') % 2 == 0, str(migration.count('$$')))

# Parenthesis scanner ignores comments and quoted strings.
def balanced_parentheses(sql):
    depth = 0
    in_string = False
    i = 0
    while i < len(sql):
        if not in_string and sql.startswith('--', i):
            end = sql.find('\n', i)
            i = len(sql) if end < 0 else end + 1
            continue
        ch = sql[i]
        if ch == "'":
            if in_string and i + 1 < len(sql) and sql[i + 1] == "'":
                i += 2
                continue
            in_string = not in_string
        elif not in_string:
            if ch == '(':
                depth += 1
            elif ch == ')':
                depth -= 1
                if depth < 0:
                    return False
        i += 1
    return depth == 0 and not in_string

check('SQL parentheses and strings balanced', balanced_parentheses(migration))

tables = set(re.findall(r'create table if not exists public\.(\w+)', migration, re.I))
expected_tables = {
    'profiles', 'app_settings', 'ai_entities', 'conversations', 'generation_requests', 'messages',
    'memories', 'user_facts', 'fact_conflicts', 'skills', 'interests', 'milestones', 'mood_history',
    'relationship_events', 'activities', 'letters', 'room_items', 'repeat_logs', 'subscriptions', 'admin_events',
}
check('all production tables exist', expected_tables <= tables, ', '.join(sorted(expected_tables - tables)))
check('table count is controlled', len(tables) == len(expected_tables), str(len(tables)))

rls_array_match = re.search(r"foreach t in array array\[([^\]]+)\]\s*\n\s*loop\s*\n\s*execute format\('alter table public\.%I enable row level security'", migration, re.S | re.I)
rls_tables = set(re.findall(r"'([a-z_]+)'", rls_array_match.group(1))) if rls_array_match else set()
check('RLS enabled for every public table', expected_tables <= rls_tables, ', '.join(sorted(expected_tables - rls_tables)))
check('anon table access revoked', 'revoke all on all tables in schema public from anon;' in migration)
check('owner policies use auth uid', '(select auth.uid()) = user_id' in migration)
check('profile role guard', 'prevent_profile_role_change' in migration and 'profiles_role_guard' in migration)
check('admin role comes from JWT app metadata', "auth.jwt() -> 'app_metadata' ->> 'role'" in migration)
check('conversation ownership trigger', 'conversations_owner_guard' in migration and 'assert_conversation_ai_owner' in migration)
check('message conversation/AI ownership trigger', 'messages_owner_guard' in migration and 'Conversation AI mismatch' in migration)
check('message parent ownership guard', 'Parent message ownership mismatch' in migration)
check('generation request ownership guard', 'generation_requests_owner_guard' in migration)
check('repeat log ownership guard', 'repeat_logs_owner_guard' in migration)
check('memory optional references guarded', 'memories_reference_guard' in migration and 'Memory source message ownership mismatch' in migration)
check('fact optional references guarded', 'user_facts_reference_guard' in migration and 'Superseding fact ownership mismatch' in migration)
check('fact conflict references guarded', 'fact_conflicts_reference_guard' in migration and 'Conflict conversation ownership mismatch' in migration)
check('letter delivered memory guarded', 'letters_reference_guard' in migration and 'Delivered memory ownership mismatch' in migration)
check('admin event AI reference guarded', 'admin_events_ai_guard' in migration)
check('subscription has select-only policy', 'create policy subscriptions_select_own' in migration and 'subscriptions_insert_own' not in migration)
check('subscription table writes explicitly revoked', 'revoke insert, update, delete on public.subscriptions from authenticated;' in migration)
check('auth user bootstrap', 'on_auth_user_created' in migration and 'handle_new_user' in migration)
check('birthday idempotency index', 'milestones_event_uidx' in migration and "'birthday:' || year_value" in migration)
check('activity request idempotency index', 'activities_request_uidx' in migration)
check('message request idempotency index', 'messages_request_sender_uidx' in migration)
check('generation request uniqueness', 'unique (user_id, request_id)' in migration)
check('aging row lock', 'for update;' in migration and 'progress_ai_aging' in migration)
check('data export RPC', 'export_my_almost_human_data' in migration)
check('data deletion RPC confirmation phrase', "DELETE MY ALMOST HUMAN DATA" in migration and 'delete_my_almost_human_data' in migration)
check('private storage bucket', "'almost-human-private'" in migration and 'public, file_size_limit' in migration)
check('storage owner folder policies', '(storage.foldername(name))[1] = (select auth.uid())::text' in migration)
check('RPC anonymous execution revoked', 'revoke all on function public.progress_ai_aging' in migration and 'from public, anon' in migration)

# Edge Functions, auth, models, safety, privacy, and idempotency.
function_names = {
    'chat-service', 'activity-service', 'memory-extract', 'memory-control', 'privacy-service',
    'conversation-reset', 'progress-aging', 'diagnostics-service', 'voice-service', 'transcription-service', 'letter-service', 'chat-stream', 'health',
}
function_dirs = {path.parent.name for path in (ROOT / 'supabase/functions').glob('*/index.ts')}
check('all Edge Functions exist', function_names == function_dirs, f'missing={sorted(function_names-function_dirs)} extra={sorted(function_dirs-function_names)}')
config_toml = read('supabase/config.toml')
for name in sorted(function_names):
    check(f'function config {name}', f'[functions.{name}]' in config_toml)
    text = read(f'supabase/functions/{name}/index.ts')
    check(f'{name} uses serve wrapper', 'serve(async' in text)
    if name == 'health':
        check('health is explicitly public', '[functions.health]\nverify_jwt = false' in config_toml)
    else:
        check(f'{name} requires authenticated context', 'createAppContext(req)' in text or 'createAppContext' in text)
        check(f'{name} JWT verification enabled', f'[functions.{name}]\nverify_jwt = true' in config_toml)

context_ts = read('supabase/functions/_shared/context.ts')
cors_ts = read('supabase/functions/_shared/cors.ts')
openai_ts = read('supabase/functions/_shared/openai.ts')
chat_ts = read('supabase/functions/chat-service/index.ts')
activity_ts = read('supabase/functions/activity-service/index.ts')
privacy_ts = read('supabase/functions/privacy-service/index.ts')
voice_ts = read('supabase/functions/voice-service/index.ts')
neural_voice_ts = read('supabase/functions/_shared/neuralVoice.ts')
chat_stream_ts = read('supabase/functions/chat-stream/index.ts')
stream_protocol_ts = read('supabase/functions/_shared/streamProtocol.ts')
transcription_ts = read('supabase/functions/transcription-service/index.ts')
letter_ts = read('supabase/functions/letter-service/index.ts')

check('Edge auth verifies token user', 'supabase.auth.getUser(token)' in context_ts)
check('Edge clients do not persist sessions', 'persistSession: false' in context_ts)
check('CORS uses origin allowlist secret', "Deno.env.get('ALLOWED_ORIGINS')" in cors_ts)
check('CORS varies by origin', "'Vary': 'Origin'" in cors_ts)
check('CORS permits request id header', 'x-request-id' in cors_ts)
check('OpenAI Responses API used', "https://api.openai.com/v1/responses" in openai_ts)
check('OpenAI output token cap used', 'max_output_tokens' in openai_ts)
check('OpenAI response output parsed', 'output_text' in openai_ts)
check('no legacy chat completions endpoint', '/v1/chat/completions' not in openai_ts and 'chat.completions' not in openai_ts)
check('chat stage prompt', 'DEVELOPMENT RULES' in chat_ts and 'maxResponseWords' in chat_ts)
check('chat repetition regeneration', 'checkRepetition' in chat_ts and 'REWRITE REQUIRED' in chat_ts)
check('chat deterministic fallback', 'developmental-fallback' in chat_ts and 'stageFallback' in chat_ts)
check('chat provider bounded timeout', 'EARLY_CHAT_TIMEOUT_MS = 5_200' in chat_ts and 'DEFAULT_CHAT_TIMEOUT_MS = 7_500' in chat_ts and 'maxGenerationAttempts = earlyStage ? 1 : 2' in chat_ts)
check('chat request lease claim', 'claimGenerationRequest' in chat_ts and 'expires_at: leaseUntil' in chat_ts)
check('chat pending response', 'pending: true' in chat_ts and 'status: 202' in chat_ts)
check('chat generation request completion', 'completeGenerationRequest' in chat_ts and 'response_message_id' in chat_ts)
check('chat generation failure persisted', 'error_code: String' in chat_ts and 'status: "failed"' in chat_ts)
check('activity duplicate processing blocked', 'pending: true' in activity_ts and 'ageMs < 45_000' in activity_ts)
check('activity deterministic fallback', 'deterministicActivityFallback' in activity_ts)
check('privacy account secret checked before data deletion', privacy_ts.find('MISSING_SECRET_KEY') < privacy_ts.find("rpc('delete_my_almost_human_data'"))
check('privacy auth identity deletion', 'auth.admin.deleteUser' in privacy_ts)
check('neural voice supports ElevenLabs streaming endpoint', 'api.elevenlabs.io/v1/text-to-speech' in neural_voice_ts and '/stream' in neural_voice_ts)
check('neural voice keeps provider keys server side', "Deno.env.get('ELEVENLABS_API_KEY')" in neural_voice_ts and "Deno.env.get('OPENAI_API_KEY')" in neural_voice_ts)
check('neural voice has six mapped profiles', all(name in neural_voice_ts for name in ['female-child','female-teen','female-adult','male-child','male-teen','male-adult']))
check('chat stream emits validated progressive events', all(marker in chat_stream_ts + stream_protocol_ts for marker in ['ack','delta','done','text/event-stream']))
check('streaming OpenAI responses supported', 'response.output_text.delta' in openai_ts and 'stream: true' in openai_ts)
check('transcription uses current audio endpoint', "https://api.openai.com/v1/audio/transcriptions" in transcription_ts)
check('transcription uses server API key', "Deno.env.get('OPENAI_API_KEY')" in transcription_ts)
check('transcription limits audio size', 'MAX_AUDIO_BYTES' in transcription_ts and '413' in transcription_ts)


check('multi-device cloud restore implemented', 'loadLifeHistory()' in cloud_js and 'restoreLifeHistory(state)' in cloud_js and 'mergeRecordSets' in cloud_js)
connect_block = app_js[app_js.find('async function connectCloudSession'):app_js.find('async function bootstrapCloudSession')]
check('cloud restore runs before outbound sync', 'cloud.restoreLifeHistory(draft)' in connect_block and ('cloud.syncLifeHistory(draft)' not in connect_block or connect_block.find('cloud.restoreLifeHistory(draft)') < connect_block.find('cloud.syncLifeHistory(draft)')))
check('background sync follows cloud interactions', 'function queueCloudSync' in app_js and 'syncNow(false)' in app_js)
check('chat local IDs prevent sync duplicates', 'local_user_message_id' in cloud_js and 'local_ai_message_id' in cloud_js and 'local_id: localUserMessageId' in chat_ts and 'local_id: args.localId' in chat_ts)
check('activity local IDs prevent sync duplicates', 'local_activity_id' in cloud_js and 'local_id: localActivityId' in activity_ts)
check('letter service is idempotent by local ID', 'local_id: localId' in letter_ts and 'replayed: true' in letter_ts and 'app.entities.Letter.filter' in letter_ts)
check('cloud voice wired to frontend', 'voiceProvider' in cloud_js and 'cloud.voiceProvider' in app_js and 'URL.createObjectURL' in app_js)
check('memory controls wired to cloud', 'memoryControl(payload)' in cloud_js and "action: 'update_memory'" in app_js and "action: 'delete_memory'" in app_js)

# Vercel packaging/security.
vercel = json.loads(read('vercel.json'))
check('Vercel builds production dist', vercel.get('buildCommand') == 'npm run build' and vercel.get('outputDirectory') == 'dist')
headers_text = json.dumps(vercel.get('headers', []))
check('CSP security header configured', 'Content-Security-Policy' in headers_text and 'frame-ancestors' in headers_text)
check('content type protection configured', 'X-Content-Type-Options' in headers_text)
check('root source index no broken React entry', '/src/main.jsx' not in read('index.html'))

for name, detail in passes:
    print('PASS', name, detail)
for name, detail in failures:
    print('FAIL', name, detail)
print(f'\nIntegrity: {len(passes)} passed, {len(failures)} failed')
if failures:
    sys.exit(1)
