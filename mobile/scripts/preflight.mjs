import { createHash } from 'node:crypto';
import { access, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(ROOT, '..');
const checks = [];

function pass(name, detail = '') { checks.push({ name, ok: true, detail }); }
function fail(name, detail = '') { checks.push({ name, ok: false, detail }); }
function expect(name, condition, detail = '') { condition ? pass(name, detail) : fail(name, detail); }
async function text(relative) { return readFile(path.join(ROOT, relative), 'utf8'); }
async function exists(relative) { try { await access(path.join(ROOT, relative)); return true; } catch { return false; } }
function sha(value) { return createHash('sha256').update(value).digest('hex'); }

for (const required of [
  'app/_layout.tsx', 'app/index.tsx', 'src/NativeShell.tsx', 'src/almostHumanHtml.ts',
  'assets/almost-human.html', 'assets/icon.png', 'assets/adaptive-icon.png', 'assets/splash.png', 'assets/notification-icon.png',
  'app.json', 'eas.json', 'package.json', 'tsconfig.json',
]) expect(`required:${required}`, await exists(required));

const app = JSON.parse(await text('app.json'));
const pkg = JSON.parse(await text('package.json'));
const eas = JSON.parse(await text('eas.json'));
const shell = await text('src/NativeShell.tsx');
const html = await text('assets/almost-human.html');
const htmlTs = await text('src/almostHumanHtml.ts');
const webApp = await readFile(path.join(REPO, 'app/app.js'), 'utf8');
const webCss = await readFile(path.join(REPO, 'app/styles.css'), 'utf8');

expect('identity:name', app.expo.name === 'Almost Human', app.expo.name);
expect('identity:slug', app.expo.slug === 'almost-human', app.expo.slug);
expect('identity:owner', app.expo.owner === 'wscott2k26', app.expo.owner);
expect('identity:ios-bundle', app.expo.ios?.bundleIdentifier === 'com.stormandme.almosthuman', app.expo.ios?.bundleIdentifier);
expect('identity:android-package', app.expo.android?.package === 'com.stormandme.almosthuman', app.expo.android?.package);
expect('identity:scheme', app.expo.scheme === 'almost-human', app.expo.scheme);
expect('release:version', app.expo.version === '1.0.0', app.expo.version);
expect('release:build-number', app.expo.ios?.buildNumber === '1', app.expo.ios?.buildNumber);
expect('release:eas-auto-increment', eas.build?.production?.autoIncrement === true);
expect('release:no-auto-submit-before-asc-record', Object.keys(eas.submit?.production?.ios || {}).length === 0);

const expectedDeps = {
  expo: '54.0.36', react: '19.1.0', 'react-native': '0.81.5',
  'react-native-webview': '13.15.0', 'expo-haptics': '15.0.8',
  'expo-notifications': '~0.32.17', 'expo-blur': '~15.0.8', 'expo-linear-gradient': '15.0.8',
};
for (const [name, version] of Object.entries(expectedDeps)) {
  expect(`dependency:${name}`, pkg.dependencies?.[name] === version, pkg.dependencies?.[name]);
}

for (const marker of [
  'WebView', 'ALMOST_HUMAN_HTML', 'injectedJavaScriptBeforeContentLoaded', 'expo-notifications',
  'configureDailyMoment', 'A quiet moment in The Haven', 'Haptics', 'Share.share',
  'useSafeAreaInsets', 'onContentProcessDidTerminate', 'onRenderProcessGone',
  'pullToRefreshEnabled', 'routeFromUrl', 'almost-human-swart.vercel.app',
]) expect(`native-shell:${marker}`, shell.includes(marker));

for (const marker of [
  'The Haven', 'A quiet Haven reminder', 'native-share', 'notificationsEnabled',
  'talk-about-haven', 'inspect-haven-item', 'v83-haven-window', '__AH_NATIVE_BUNDLE__',
]) expect(`web-bundle:${marker}`, html.includes(marker));

for (const marker of ['nativePost', "nativePost('daily-moment'", 'shareAlmostHuman', "navigator.serviceWorker.register('./sw.js?v=8.3')"]) {
  expect(`web-source:${marker}`, webApp.includes(marker));
}
for (const marker of ['V8.3 — THE HAVEN', 'v83-top-share', 'v83-haven-window']) {
  expect(`visual-system:${marker}`, webCss.includes(marker));
}

const match = htmlTs.match(/export const ALMOST_HUMAN_HTML = ("[\s\S]*") as const;\s*$/);
expect('bundle:typescript-embedding-readable', Boolean(match));
if (match) {
  const embedded = JSON.parse(match[1]);
  expect('bundle:typescript-matches-html', embedded === html, `${sha(embedded)} / ${sha(html)}`);
}
expect('bundle:min-size', Buffer.byteLength(html) > 250_000, `${Buffer.byteLength(html)} bytes`);
expect('bundle:no-remote-app-script', !/<script[^>]+src=["']\.\/app\.js/i.test(html));
expect('bundle:no-remote-stylesheet', !/<link[^>]+href=["']\.\/styles\.css/i.test(html));

const sourceSet = [shell, webApp, webCss, html];
const forbidden = [
  /\bTODO\b/i, /\bFIXME\b/i, /lorem ipsum/i, /YOUR[_ -]?(?:TOKEN|PROJECT|APP)/i,
  /service_role/i, /sk-[A-Za-z0-9_-]{16,}/,
];
for (const pattern of forbidden) expect(`clean:${pattern}`, !sourceSet.some((value) => pattern.test(value)));

function pngDimensions(buffer) {
  if (buffer.toString('ascii', 1, 4) !== 'PNG') return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}
for (const [file, minimum] of [['assets/icon.png', 1024], ['assets/adaptive-icon.png', 1024], ['assets/splash.png', 1024], ['assets/notification-icon.png', 96]]) {
  const buffer = await readFile(path.join(ROOT, file));
  const dims = pngDimensions(buffer);
  expect(`asset:${file}`, Boolean(dims && dims.width >= minimum && dims.height >= minimum), dims ? `${dims.width}x${dims.height}` : 'not png');
}

const failed = checks.filter((item) => !item.ok);
for (const item of checks) console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.name}${item.detail ? ` — ${item.detail}` : ''}`);
console.log(`\n${checks.length - failed.length} passed, ${failed.length} failed`);

const report = {
  generatedAt: new Date().toISOString(),
  passed: checks.length - failed.length,
  failed: failed.length,
  mobileBundleSha256: sha(html),
  checks,
};
await writeFile(path.join(ROOT, 'STEP7_PREFLIGHT.json'), JSON.stringify(report, null, 2) + '\n');
if (failed.length) process.exit(1);
