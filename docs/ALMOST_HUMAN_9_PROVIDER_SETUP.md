# Almost Human 9.0 provider setup

## Active production providers

- Text conversation: OpenAI Responses streaming through the JWT-protected `chat-stream` Edge Function.
- Neural voice: OpenAI neural speech through the JWT-protected `voice-service` Edge Function.
- Transcription: OpenAI secure transcription through the JWT-protected `transcription-service` Edge Function.
- Device system speech is not the normal path. It is available only as an explicit one-time fallback when neural audio fails.

## Required Supabase secrets

Keep private provider values only in Supabase. Never place them in the web app, native bundle, repository, or Expo configuration.

Active configuration:

- `OPENAI_API_KEY`
- Optional overrides: `OPENAI_FAST_CHAT_MODEL`, `OPENAI_CHAT_MODEL`, `OPENAI_TTS_MODEL`, `OPENAI_TRANSCRIBE_MODEL`
- `ALLOWED_ORIGINS` containing production plus approved preview and local origins

Optional ElevenLabs upgrade:

- `ELEVENLABS_API_KEY`
- `ELEVENLABS_VOICE_FEMALE_CHILD`
- `ELEVENLABS_VOICE_FEMALE_TEEN`
- `ELEVENLABS_VOICE_FEMALE_ADULT`
- `ELEVENLABS_VOICE_MALE_CHILD`
- `ELEVENLABS_VOICE_MALE_TEEN`
- `ELEVENLABS_VOICE_MALE_ADULT`
- Optional `ELEVENLABS_TTS_MODEL`

ElevenLabs becomes active only when its API key and all six voice mappings exist. Otherwise OpenAI remains the secure neural voice provider.

## Verification

The public health endpoint reports configuration booleans and provider names without exposing secret values. Authenticated release checks verify JWT rejection, exact production-origin CORS, streamed text, neural audio, transcription, and temporary-account cleanup.
