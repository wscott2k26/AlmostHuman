import { cp, mkdir, rm, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const root = process.cwd();
const source = path.join(root, 'app');
const output = path.join(root, 'dist');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(source, output, { recursive: true });

const files = await walk(output);
const hash = createHash('sha256');
for (const file of files.filter((file) => !file.endsWith('build-meta.json')).sort()) {
  hash.update(path.relative(output, file));
  hash.update(await readFile(file));
}
const metadata = {
  product: 'Almost Human',
  version: '8.3.0',
  builtAt: new Date().toISOString(),
  contentHash: hash.digest('hex'),
  files: files.length,
  frontend: 'dependency-free ES modules',
  backend: 'Supabase PostgreSQL, Auth, Storage, Row Level Security, and Edge Functions'
};
await writeFile(path.join(output, 'build-meta.json'), JSON.stringify(metadata, null, 2));
console.log(`Built ${metadata.product} ${metadata.version}: ${metadata.files} files, ${metadata.contentHash.slice(0, 12)}`);

async function walk(directory) {
  const found = [];
  for (const entry of await readdir(directory)) {
    const full = path.join(directory, entry);
    const info = await stat(full);
    if (info.isDirectory()) found.push(...await walk(full)); else found.push(full);
  }
  return found;
}
