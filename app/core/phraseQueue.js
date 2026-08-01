const ABBREVIATIONS = ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.', 'Sr.', 'Jr.', 'St.', 'vs.', 'e.g.', 'i.e.'];

function maskProtected(text) {
  let masked = String(text || '');
  const tokens = [];
  const protect = (value) => {
    const token = `\u0000${tokens.length}\u0000`;
    tokens.push(value);
    return token;
  };
  for (const abbreviation of ABBREVIATIONS) masked = masked.replaceAll(abbreviation, protect(abbreviation));
  masked = masked.replace(/\b\d+\.\d+\b/g, protect);
  return { masked, restore: (value) => value.replace(/\u0000(\d+)\u0000/g, (_, index) => tokens[Number(index)] || '') };
}

export function segmentSpeakablePhrases(text, cursor = 0, flush = false) {
  const source = String(text || '');
  const start = Math.max(0, Math.min(source.length, Number(cursor) || 0));
  const tail = source.slice(start);
  const { masked, restore } = maskProtected(tail);
  const phrases = [];
  let consumed = 0;
  const boundary = /.+?(?:[.!?](?=\s|$)|[,;:](?=\s|$)(?=(?:[^\s]+\s+){5,})|$)/gs;
  for (const match of masked.matchAll(boundary)) {
    const value = restore(match[0]).trim();
    const end = (match.index || 0) + match[0].length;
    const terminal = /[.!?]$/.test(value);
    const soft = /[,;:]$/.test(value) && value.split(/\s+/).length >= 6;
    const atEnd = end >= masked.length;
    if (terminal || soft || (flush && atEnd && value)) {
      phrases.push(value);
      consumed = end;
    }
  }
  return { phrases, cursor: start + consumed };
}

export class PhraseAudioQueue {
  constructor({ fetchAudio, playAudio, onEvent } = {}) {
    if (typeof fetchAudio !== 'function' || typeof playAudio !== 'function') throw new TypeError('fetchAudio and playAudio are required.');
    this.fetchAudio = fetchAudio;
    this.playAudio = playAudio;
    this.onEvent = onEvent;
    this.pending = [];
    this.ids = new Set();
    this.active = null;
    this.controller = null;
    this.running = false;
  }

  get size() { return this.pending.length + (this.active ? 1 : 0); }

  enqueue(item) {
    if (!item?.id || !String(item.text || '').trim() || this.ids.has(item.id)) return false;
    this.ids.add(item.id);
    this.pending.push({ ...item, text: String(item.text).trim() });
    this.drain().catch((error) => this.onEvent?.({ type: 'error', error }));
    return true;
  }

  async drain() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.pending.length) {
        const item = this.pending.shift();
        this.active = item;
        this.controller = new AbortController();
        try {
          this.onEvent?.({ type: 'fetching', item });
          const audio = await this.fetchAudio(item, this.controller.signal);
          if (this.controller.signal.aborted) continue;
          this.onEvent?.({ type: 'started', item });
          await this.playAudio(audio, this.controller.signal, item);
          if (!this.controller.signal.aborted) this.onEvent?.({ type: 'ended', item });
        } catch (error) {
          if (!this.controller.signal.aborted) this.onEvent?.({ type: 'error', item, error });
        } finally {
          this.ids.delete(item.id);
          this.active = null;
          this.controller = null;
        }
      }
    } finally {
      this.running = false;
    }
  }

  stop() {
    this.controller?.abort();
    this.pending.length = 0;
    this.ids.clear();
    this.active = null;
    this.onEvent?.({ type: 'stopped' });
  }
}
