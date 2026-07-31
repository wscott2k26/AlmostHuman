const TIMING_KEYS = new Set(['requestId', 'providerMode', 'startedAt', 'firstDeltaMs', 'finalTextMs', 'firstAudioMs', 'interruptionMs', 'transcriptionMs', 'createdAt']);

function duration(start, end) {
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, Math.round(end - start));
}

export class ConversationTimings {
  constructor(requestId, startedAt = performanceNow()) {
    this.requestId = String(requestId || '');
    this.startedAt = startedAt;
    this.firstDeltaAt = null;
    this.doneAt = null;
    this.firstAudioAt = null;
    this.interruptedAt = null;
    this.transcriptionStartedAt = null;
    this.transcriptionDoneAt = null;
    this.providerMode = null;
  }
  markFirstDelta(at = performanceNow()) { if (this.firstDeltaAt == null) this.firstDeltaAt = at; }
  markDone(at = performanceNow()) { this.doneAt = at; }
  markFirstAudio(at = performanceNow()) { if (this.firstAudioAt == null) this.firstAudioAt = at; }
  markInterrupted(at = performanceNow()) { this.interruptedAt = at; }
  markTranscriptionStart(at = performanceNow()) { this.transcriptionStartedAt = at; }
  markTranscriptionDone(at = performanceNow()) { this.transcriptionDoneAt = at; }
  toSample() {
    return sanitizeTimingSample({
      requestId: this.requestId, providerMode: this.providerMode, startedAt: this.startedAt,
      firstDeltaMs: duration(this.startedAt, this.firstDeltaAt), finalTextMs: duration(this.startedAt, this.doneAt),
      firstAudioMs: duration(this.startedAt, this.firstAudioAt), interruptionMs: duration(this.firstAudioAt, this.interruptedAt),
      transcriptionMs: duration(this.transcriptionStartedAt, this.transcriptionDoneAt), createdAt: new Date().toISOString(),
    });
  }
}

export function sanitizeTimingSample(input = {}) {
  const output = {};
  for (const [key, value] of Object.entries(input)) {
    if (!TIMING_KEYS.has(key) || value == null) continue;
    if (key.endsWith('Ms') || key === 'startedAt') output[key] = Math.max(0, Number(value) || 0);
    else output[key] = String(value).slice(0, 120);
  }
  return output;
}

export function appendTimingSample(diagnostics, sample, limit = 100) {
  const clean = sanitizeTimingSample(sample);
  diagnostics.performance9 = [...(diagnostics.performance9 || []), clean].slice(-Math.max(1, limit));
  return clean;
}

function performanceNow() {
  return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
}
