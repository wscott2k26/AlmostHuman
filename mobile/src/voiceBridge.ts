export type NativeVoiceBridgeMessage = {
  type?: string;
  id?: string;
  url?: string;
  base64?: string;
  mimeType?: string;
  text?: string;
  voiceId?: string;
};

const VOICE_TYPES = new Set(['audio-play', 'audio-stop', 'device-speak-once', 'mic-toggle']);

export function isNativeVoiceBridgeMessage(message: NativeVoiceBridgeMessage): boolean {
  if (!VOICE_TYPES.has(String(message?.type || ''))) return false;
  if (message.type === 'audio-play') {
    return Boolean(String(message.id || '').trim() && (String(message.url || '').startsWith('https://') || String(message.base64 || '').length));
  }
  if (message.type === 'device-speak-once') return Boolean(String(message.text || '').trim());
  return true;
}
