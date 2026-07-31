function allowedOrigins(): string[] {
  const raw = Deno.env.get('ALLOWED_ORIGINS') || '*';
  return raw.split(',').map((value) => value.trim()).filter(Boolean);
}

function originFor(req?: Request): string {
  const allowed = allowedOrigins();
  if (allowed.includes('*')) return '*';
  const origin = req?.headers.get('Origin') || '';
  return allowed.includes(origin) ? origin : allowed[0] || 'null';
}

export function corsHeaders(req?: Request): Record<string, string> {
  const origin = originFor(req);
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-request-id',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

export function handleOptions(req: Request): Response | null {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  return null;
}

export function json(data: unknown, status = 200, req?: Request): Response {
  return Response.json(data, { status, headers: corsHeaders(req) });
}

export function fail(message: string, status = 500, code?: string, detail?: unknown, req?: Request): Response {
  return json({ error: message, code, detail }, status, req);
}

export function serve(handler: (req: Request) => Promise<Response> | Response) {
  Deno.serve(async (req) => {
    const options = handleOptions(req);
    if (options) return options;
    let response: Response;
    try {
      response = await handler(req);
    } catch (error) {
      response = Response.json(
        { error: String((error as any)?.message || error) },
        { status: Number((error as any)?.status || 500) },
      );
    }
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(corsHeaders(req))) headers.set(key, value);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  });
}
