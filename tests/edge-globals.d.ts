declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): unknown;
};

declare module 'npm:@supabase/supabase-js@2' {
  export type SupabaseClient = any;
  export type User = any;
  export function createClient(...args: any[]): any;
}

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };
