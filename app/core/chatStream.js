function safeObject(value) {
  return value && typeof value === 'object' ? value : {};
}

export function encodeStreamEvent(type, data = {}) {
  return `event: ${String(type || 'message')}\ndata: ${JSON.stringify(safeObject(data))}\n\n`;
}

export async function parseEventStream(readable, onEvent, signal) {
  if (!readable?.getReader) throw new TypeError('A readable response body is required.');
  const reader = readable.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let aborted = false;
  const abort = () => {
    aborted = true;
    reader.cancel('aborted').catch(() => {});
  };
  signal?.addEventListener('abort', abort, { once: true });
  try {
    while (!aborted) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf('\n\n');
      while (boundary >= 0) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        await dispatchBlock(block, onEvent);
        boundary = buffer.indexOf('\n\n');
      }
    }
    buffer += decoder.decode();
    if (!aborted && buffer.trim()) await dispatchBlock(buffer, onEvent);
    return { aborted };
  } finally {
    signal?.removeEventListener('abort', abort);
    reader.releaseLock();
  }
}

async function dispatchBlock(block, onEvent) {
  const lines = String(block || '').split(/\r?\n/);
  const eventLine = lines.find((line) => line.startsWith('event:'));
  const dataLines = lines.filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart());
  const type = eventLine ? eventLine.slice(6).trim() : 'message';
  try {
    const data = JSON.parse(dataLines.join('\n') || '{}');
    await onEvent?.({ type, data: safeObject(data) });
  } catch {
    await onEvent?.({ type: 'error', data: { code: 'MALFORMED_STREAM_EVENT', message: 'The reply stream contained an unreadable event.' } });
  }
}

function messageId(prefix, requestId) {
  return `${prefix}-${String(requestId).replace(/[^a-z0-9_-]/gi, '').slice(0, 80)}`;
}

export function createOptimisticTurn(draft, { requestId, conversationId, text, now = Date.now(), age = 0, stageKey = 'adult' }) {
  draft.messages ||= [];
  draft.generationRequests ||= [];
  const priorUser = draft.messages.find((item) => item.requestId === requestId && item.sender === 'user');
  const priorAi = draft.messages.find((item) => item.requestId === requestId && item.sender === 'ai');
  if (priorAi) return { requestId, conversationId, userMessageId: priorUser?.id || null, aiMessageId: priorAi.id, reused: true };
  const createdAt = new Date(now).toISOString();
  const userMessage = priorUser || {
    id: messageId('message-user', requestId), requestId, conversationId, sender: 'user', content: String(text || ''),
    ageAtMessage: age, stageKey, emotion: 'curious', intent: 'conversation', safetyFlags: [], status: 'complete', createdAt,
  };
  if (!priorUser && userMessage.content) draft.messages.push(userMessage);
  const aiMessage = {
    id: messageId('message-ai', requestId), requestId, conversationId, sender: 'ai', content: '',
    ageAtMessage: age, stageKey, emotion: 'curious', intent: 'conversation', repetitionScore: 0,
    providerMode: 'cloud-stream', status: 'pending', createdAt,
  };
  draft.messages.push(aiMessage);
  draft.generationRequests.unshift({ id: requestId, conversationId, status: 'streaming', providerMode: 'cloud-stream', createdAt });
  draft.generationRequests = draft.generationRequests.slice(0, 200);
  return { requestId, conversationId, userMessageId: userMessage.id, aiMessageId: aiMessage.id, reused: false };
}

export function applyStreamEvent(draft, turn, event) {
  const ai = draft.messages?.find((item) => item.id === turn.aiMessageId);
  const user = draft.messages?.find((item) => item.id === turn.userMessageId);
  const request = draft.generationRequests?.find((item) => item.id === turn.requestId);
  if (!ai) return null;
  const data = safeObject(event?.data);
  if (event.type === 'ack') {
    ai.status = 'streaming';
    if (data.userMessageId && user) user.cloudId = data.userMessageId;
  } else if (event.type === 'delta') {
    ai.status = 'streaming';
    ai.content += String(data.text || '');
  } else if (event.type === 'metadata') {
    ai.providerMode = String(data.providerMode || ai.providerMode);
    ai.emotion = String(data.emotion || ai.emotion);
  } else if (event.type === 'done') {
    ai.content = String(data.text ?? ai.content).trim();
    ai.cloudId = data.messageId || ai.cloudId || null;
    ai.status = 'complete';
    ai.providerMode = String(data.providerMode || ai.providerMode || 'cloud-stream');
    if (user && data.userMessageId) user.cloudId = data.userMessageId;
    if (request) { request.status = 'complete'; request.completedAt = new Date().toISOString(); }
  } else if (event.type === 'error') {
    ai.status = data.cancelled ? 'cancelled' : 'failed';
    ai.errorCode = String(data.code || 'STREAM_ERROR');
    if (request) { request.status = ai.status; request.errorCode = ai.errorCode; }
  }
  return ai;
}
