import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.AH_TEST_PORT || 4173);
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [path.join(root, 'scripts', 'serve.mjs'), '--source', path.join(root, 'dist'), '--port', String(port)], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});

let log = '';
server.stdout.on('data', (chunk) => { log += chunk; });
server.stderr.on('data', (chunk) => { log += chunk; });

function assertIncludes(text, marker, label) {
  if (!text.includes(marker)) throw new Error(`${label} is missing required marker: ${marker}`);
}

async function fetchText(route) {
  const response = await fetch(`${base}${route}`);
  if (!response.ok) throw new Error(`${route} returned ${response.status}`);
  return response.text();
}

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${base}/`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Preview server did not start. ${log.trim()}`);
}

try {
  await waitForServer();
  const [index, app, styles, manifest] = await Promise.all([
    fetchText('/'), fetchText('/app.js'), fetchText('/styles.css'), fetchText('/manifest.webmanifest'),
  ]);
  assertIncludes(index, '<title>Almost Human</title>', 'index.html');
  assertIncludes(app, 'Digital birth sequence', 'app.js');
  assertIncludes(app, 'AlmostHumanEngine', 'app.js');
  assertIncludes(app, 'Continue as Guest', 'app.js');
  assertIncludes(manifest, 'Almost Human', 'manifest');
  assertIncludes(styles, 'mobile-tabs', 'styles.css');
  assertIncludes(styles, 'being-face', 'styles.css');
  console.log('Browser delivery smoke passed.');
} finally {
  server.kill('SIGTERM');
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 1200);
    server.once('exit', () => { clearTimeout(timer); resolve(); });
  });
}
