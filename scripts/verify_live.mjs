import fs from 'node:fs';

const source = fs.readFileSync(new URL('../app/config.js', import.meta.url), 'utf8');
const configuredUrl = source.match(/supabaseUrl:\s*'([^']+)'/)?.[1] || '';
const configuredKey = source.match(/supabasePublishableKey:\s*'([^']+)'/)?.[1] || '';
const url = String(process.env.SUPABASE_URL || configuredUrl).replace(/\/$/, '');
const key = String(process.env.SUPABASE_PUBLISHABLE_KEY || configuredKey);

if (!url || !key) fail('Supabase URL or publishable key is missing.');
if (/service_role|secret/i.test(key)) fail('Refusing to use a secret/service-role key in a client verification script.');

const results = {};
results.auth = await request('/auth/v1/settings', { method: 'GET', auth: false });
results.health = await request('/functions/v1/health', { method: 'POST', body: {}, auth: false });

const email = process.env.AH_TEST_EMAIL;
const password = process.env.AH_TEST_PASSWORD;
if (email || password) {
  if (!email || !password) fail('Set both AH_TEST_EMAIL and AH_TEST_PASSWORD, or neither.');
  const session = await request('/auth/v1/token?grant_type=password', {
    method: 'POST', body: { email, password }, auth: false,
  });
  const token = session.data?.access_token;
  if (!token) fail('Test account sign-in did not return an access token.');
  results.session = { ok: true, status: session.status, user_id: session.data?.user?.id || null };
  results.profile = await request('/rest/v1/profiles?select=id,display_name&limit=1', { method: 'GET', token });
  results.diagnostics = await request('/functions/v1/diagnostics-service', { method: 'POST', body: { action: 'summary' }, token });
}

const summary = {
  supabase_url: url,
  auth_endpoint: summarize(results.auth),
  health: results.health.data,
  signed_in_checks: email ? {
    session: results.session,
    profile: summarize(results.profile),
    diagnostics: summarize(results.diagnostics),
  } : 'skipped (set AH_TEST_EMAIL and AH_TEST_PASSWORD locally to include)',
};
console.log(JSON.stringify(summary, null, 2));

const health = results.health.data || {};
if (!results.auth.ok) fail(`Auth endpoint failed with HTTP ${results.auth.status}.`);
if (!results.health.ok) fail(`Health function failed with HTTP ${results.health.status}. Deploy the functions first.`);
if (!health.database || !health.schema) fail('Health function reports that the database migration is not ready.');
if (!health.ai_configured) fail('Health function reports that OPENAI_API_KEY is missing.');
if (!health.account_deletion_configured) fail('Health function reports that secure account deletion is not configured.');
console.log('\nLive Supabase release gate passed.');

async function request(path, { method = 'GET', body, token, auth = true } = {}) {
  const headers = { apikey: key, Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  else if (auth) headers.Authorization = `Bearer ${key}`;
  let response;
  try {
    response = await fetch(`${url}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (error) {
    fail(`Network request failed for ${path}: ${error.message}`);
  }
  const text = await response.text();
  let data = text;
  try { data = text ? JSON.parse(text) : null; } catch {}
  return { ok: response.ok, status: response.status, data };
}
function summarize(result) { return { ok: result.ok, status: result.status, data: result.data }; }
function fail(message) { console.error(`\nLIVE VERIFY FAILED: ${message}`); process.exit(1); }
