const ALLOWED = new Set(['audio-play', 'audio-stop', 'device-speak-once', 'mic-toggle', 'audio-session']);

export function validateVoiceBridgeMessage(message) {
  const input = message && typeof message === 'object' ? message : {};
  if (!ALLOWED.has(input.type)) return { ok: false, code: 'UNKNOWN_VOICE_MESSAGE' };
  if (input.type === 'audio-play') {
    const safeUrl = typeof input.url === 'string' && /^(blob:|data:audio\/|https:\/\/)/.test(input.url);
    const safeBase64 = typeof input.base64 === 'string' && input.base64.length > 0 && input.base64.length <= 6_000_000;
    if (!input.id || (!safeUrl && !safeBase64)) return { ok: false, code: 'INVALID_AUDIO_PAYLOAD' };
  }
  if (input.type === 'device-speak-once' && !String(input.text || '').trim()) return { ok: false, code: 'EMPTY_DEVICE_SPEECH' };
  return { ok: true, message: input };
}

export function voiceModeState(current = {}, event, payload = {}) {
  const state = {
    open: Boolean(current.open), speaking: Boolean(current.speaking), recording: Boolean(current.recording),
    transcribing: Boolean(current.transcribing), errorCode: null, effects: [],
  };
  if (event === 'open') state.open = true;
  if (event === 'close') { state.open = false; state.speaking = false; state.recording = false; state.effects.push('stop-audio'); }
  if (event === 'audio-start') state.speaking = true;
  if (event === 'audio-stop') state.speaking = false;
  if (event === 'mic-tap') {
    if (state.speaking) state.effects.push('stop-audio');
    state.speaking = false;
    state.recording = !state.recording;
    state.effects.push(state.recording ? 'start-recording' : 'stop-recording');
  }
  if (event === 'transcribing') { state.recording = false; state.transcribing = true; }
  if (event === 'transcribed') state.transcribing = false;
  if (event === 'permission-denied') {
    state.recording = false; state.transcribing = false;
    state.errorCode = payload.canAskAgain === false ? 'MIC_PERMISSION_SETTINGS' : 'MIC_PERMISSION_DENIED';
  }
  if (event === 'empty-transcript') { state.transcribing = false; state.errorCode = 'EMPTY_TRANSCRIPT'; }
  return state;
}
