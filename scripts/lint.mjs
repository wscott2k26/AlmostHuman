import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const roots = ['app', 'supabase', 'scripts', 'tests'];
const files = [];
for (const root of roots) files.push(...await walk(root));
const problems = [];
const productForbidden = [
  [/\balert\s*\(/g, 'native alert()'],
  [/\bconfirm\s*\(/g, 'native confirm()'],
  [/lorem ipsum/gi, 'placeholder lorem ipsum'],
  [/coming soon/gi, 'coming soon placeholder'],
  [/TODO\b/g, 'unfinished TODO marker'],
  [/console\.log\(/g, 'console.log in product source'],
];
const secretPatterns = [
  [/\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g, 'OpenAI-like secret'],
  [/\bsb_secret_[A-Za-z0-9_-]{16,}\b/g, 'Supabase secret key'],
  [/\bservice_role\b\s*[:=]\s*['\"][A-Za-z0-9._-]{20,}/gi, 'service-role value'],
  [/SUPABASE_SERVICE_ROLE_KEY\s*=\s*\S+/g, 'service-role value'],
  [/OPENAI_API_KEY\s*=\s*\S+/g, 'OpenAI key value'],
];
for (const file of files.filter((file) => /\.(js|mjs|ts|html|css|py|sh|sql|toml|json)$/.test(file))) {
  const content = await readFile(file, 'utf8');
  const productSource = file.startsWith('app/');
  for (const [pattern, label] of productForbidden) {
    if (productSource && pattern.test(content)) problems.push(`${file}: ${label}`);
    pattern.lastIndex = 0;
  }
  for (const [pattern, label] of secretPatterns) {
    if (pattern.test(content)) problems.push(`${file}: ${label}`);
    pattern.lastIndex = 0;
  }
  if ((file.startsWith('app/') || file.startsWith('supabase/')) && /@base44|base44\.app|Base44Cloud/.test(content)) {
    problems.push(`${file}: obsolete backend dependency`);
  }
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`Lint passed: ${files.length} files checked.`);

async function walk(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await walk(full));
    else output.push(full);
  }
  return output;
}
