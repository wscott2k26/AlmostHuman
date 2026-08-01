import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';

const rootPackage = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const mobilePackage = JSON.parse(await readFile(new URL('../mobile/package.json', import.meta.url), 'utf8'));
const mobileApp = JSON.parse(await readFile(new URL('../mobile/app.json', import.meta.url), 'utf8'));
const eas = JSON.parse(await readFile(new URL('../mobile/eas.json', import.meta.url), 'utf8'));

async function exists(relativePath) {
  try {
    await access(new URL(`../${relativePath}`, import.meta.url), constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function allScripts(...packages) {
  return packages.flatMap((pkg) => Object.values(pkg.scripts || {})).join('\n');
}

test('Build 5 locks web and native identities without paid release commands', () => {
  assert.equal(rootPackage.version, '10.0.0');
  assert.equal(mobilePackage.version, '1.0.0');
  assert.equal(mobileApp.expo.version, '1.0.0');
  assert.equal(mobileApp.expo.ios.bundleIdentifier, 'com.stormandme.almosthuman');
  assert.equal(mobileApp.expo.android.package, 'com.stormandme.almosthuman');
  assert.equal(mobileApp.expo.extra.eas.projectId, 'cd0be7bb-e65a-454e-b255-3b261de060ee');
  assert.equal(eas.cli.appVersionSource, 'remote');
  assert.equal(eas.build.production.autoIncrement, true);
  assert.doesNotMatch(allScripts(rootPackage, mobilePackage), /\beas\s+(build|submit)\b|\bfastlane\b|\baltool\b|\bnotarytool\b/i);
});

test('Build 5 branch contains no failed transfer package or failure receipt', async () => {
  assert.equal(await exists('BUILD5_INSTALL_FAILURE.txt'), false);
  assert.equal(await exists('.release/build5-source.patch.gz'), false);
  assert.equal(await exists('.release/READY'), false);
});

test('Build 5 rollback baseline explicitly preserves TestFlight build 4', async () => {
  const baseline = await readFile(new URL('../BUILD5_ROLLBACK_BASELINE.md', import.meta.url), 'utf8');
  assert.match(baseline, /1\.0\.0\s*\(4\)/);
  assert.match(baseline, /9af3b9e9-eec0-473a-a59e-12fdeff56e42/);
  assert.match(baseline, /dpl_JCVTgEzyXbar4SnFegsBxTcfX3Gp/);
  assert.match(baseline, /EAS builds?[^\n]*0/i);
  assert.match(baseline, /TestFlight uploads?[^\n]*0/i);
}