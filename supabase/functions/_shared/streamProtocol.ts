const encoder = new TextEncoder();

export type AppStreamEvent = 'ack' | 'delta' | 'metadata' | 'done' | 'error';

export function encodeAppStreamEvent(type: AppStreamEvent, data: Record<string, unknown> = {}): Uint8Array {
  return encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function validatedDeliveryChunks(text: string): string[] {
  const source = String(text || '').trim();
  if (!source) return [];
  const sentences = source.match(/[^.!?]+[.!?]?/g) || [source];
  const chunks: string[] = [];
  for (const sentence of sentences) {
    const words = sentence.trim().split(/\s+/).filter(Boolean);
    for (let index = 0; index < words.length; index += 7) {
      const group = words.slice(index, index + 7).join(' ');
      const isLast = index + 7 >= words.length;
      chunks.push(`${group}${isLast ? '' : ' '}${isLast && /[.!?]$/.test(sentence.trim()) ? sentence.trim().slice(-1) : ''}`);
    }
  }
  return chunks.filter(Boolean);
}
