export interface GenerateOptions {
  instructions: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxOutputTokens: number;
  model?: string;
  timeoutMs?: number;
}

export interface GenerateResult {
  text: string;
  model: string;
  totalTokens: number;
  responseId: string | null;
}

export async function generateText(options: GenerateOptions): Promise<GenerateResult> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
  const model = options.model || Deno.env.get('OPENAI_CHAT_MODEL') || 'gpt-5-mini';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 18_000);
  const isGpt5 = /^gpt-5/i.test(model);
  const payload: Record<string, unknown> = {
    model,
    instructions: options.instructions,
    input: options.messages.map((message) => ({ role: message.role, content: message.content })),
    max_output_tokens: Math.max(48, Math.min(options.maxOutputTokens, 1200)),
  };
  if (isGpt5) {
    payload.reasoning = { effort: 'low' };
    payload.text = { verbosity: 'low' };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const raw = await response.text();
    let data: any = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { data = { error: { message: raw } }; }
    if (!response.ok) throw new Error(data?.error?.message || `OpenAI request failed (${response.status})`);
    const text = String(data?.output_text || extractOutputText(data)).trim();
    if (!text) {
      const incomplete = data?.incomplete_details?.reason || data?.status || 'unknown';
      const outputTypes = (data?.output || []).map((item: any) => item?.type).filter(Boolean).join(',') || 'none';
      throw new Error(`OpenAI returned no visible text (state=${incomplete}; output=${outputTypes}; id=${data?.id || 'unknown'})`);
    }
    return {
      text,
      model: String(data?.model || model),
      totalTokens: Number(data?.usage?.total_tokens || 0),
      responseId: data?.id || null,
    };
  } catch (error) {
    if ((error as any)?.name === 'AbortError') throw new Error(`OpenAI request exceeded ${options.timeoutMs || 18_000}ms`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function extractOutputText(data: any): string {
  const chunks: string[] = [];
  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === 'output_text' && content?.text) chunks.push(content.text);
    }
  }
  return chunks.join('\n');
}


export interface BufferedStreamOptions extends GenerateOptions {
  onRawDelta?: (delta: string) => void | Promise<void>;
}

export async function generateTextBufferedStream(options: BufferedStreamOptions): Promise<GenerateResult> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
  const model = options.model || Deno.env.get('OPENAI_FAST_CHAT_MODEL') || 'gpt-4.1-mini';
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs || 7_000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const isGpt5 = /^gpt-5/i.test(model);
  const payload: Record<string, unknown> = {
    model,
    instructions: options.instructions,
    input: options.messages.map((message) => ({ role: message.role, content: message.content })),
    max_output_tokens: Math.max(32, Math.min(options.maxOutputTokens, 900)),
    stream: true,
  };
  if (isGpt5) {
    payload.reasoning = { effort: 'low' };
    payload.text = { verbosity: 'low' };
  }
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok || !response.body) {
      const detail = await response.text();
      throw new Error(`OpenAI stream failed (${response.status}): ${detail.slice(0, 300)}`);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let text = '';
    let completed: any = null;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf('\n\n');
      while (boundary >= 0) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const dataLine = block.split(/\r?\n/).find((line) => line.startsWith('data:'));
        const raw = dataLine?.slice(5).trim();
        if (raw && raw !== '[DONE]') {
          let event: any = null;
          try { event = JSON.parse(raw); } catch { event = null; }
          if (event?.type === 'response.output_text.delta' && event.delta) {
            text += String(event.delta);
            await options.onRawDelta?.(String(event.delta));
          }
          if (event?.type === 'response.completed') completed = event.response || event;
          if (event?.type === 'error') throw new Error(event?.error?.message || event?.message || 'OpenAI streaming error');
        }
        boundary = buffer.indexOf('\n\n');
      }
    }
    text = text.trim();
    if (!text) throw new Error('OpenAI returned no visible streamed text');
    return {
      text,
      model: String(completed?.model || model),
      totalTokens: Number(completed?.usage?.total_tokens || 0),
      responseId: completed?.id || null,
    };
  } catch (error) {
    if ((error as any)?.name === 'AbortError') throw new Error(`OpenAI stream exceeded ${timeoutMs}ms`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function extractJson<T>(instructions: string, input: string, fallback: T): Promise<T> {
  const result = await generateText({
    instructions: `${instructions}\nReturn JSON only. No markdown fences or commentary.`,
    messages: [{ role: 'user', content: input }], maxOutputTokens: 900,
    model: Deno.env.get('OPENAI_EXTRACT_MODEL') || Deno.env.get('OPENAI_CHAT_MODEL') || 'gpt-5-mini',
  });
  try {
    const cleaned = result.text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    return JSON.parse(cleaned) as T;
  } catch { return fallback; }
}
