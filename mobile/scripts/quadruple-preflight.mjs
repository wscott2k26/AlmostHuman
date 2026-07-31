import { spawnSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runs = [];
for (let pass = 1; pass <= 4; pass += 1) {
  console.log(`\n===== STEP 7 PREFLIGHT PASS ${pass}/4 =====`);
  const result = spawnSync(process.execPath, [path.join(ROOT, 'scripts/preflight.mjs')], { cwd: ROOT, stdio: 'inherit' });
  runs.push({ pass, exitCode: result.status ?? 1 });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const report = `# Almost Human Step 7 Quadruple Preflight\n\nGenerated: ${new Date().toISOString()}\n\n${runs.map((run) => `- Pass ${run.pass}: ${run.exitCode === 0 ? 'PASS' : 'FAIL'}`).join('\n')}\n\n**Result: FOUR CONSECUTIVE PASSES**\n`;
await writeFile(path.join(ROOT, 'STEP7_QUADRUPLE_PREFLIGHT.md'), report);
console.log('\nFOUR CONSECUTIVE STEP 7 PREFLIGHT PASSES');
