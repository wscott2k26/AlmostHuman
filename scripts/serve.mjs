import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const option = (name, fallback) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : fallback; };
const source = path.resolve(option('--source', 'dist'));
const port = Number(option('--port', '4173'));
const types = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml' };
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let pathname = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    if (!pathname || pathname.endsWith('/')) pathname += 'index.html';
    let file = path.resolve(source, pathname);
    if (!file.startsWith(source)) throw new Error('Invalid path');
    try { if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html'); }
    catch { if (!path.extname(pathname)) file = path.join(source, 'index.html'); }
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': path.basename(file)==='sw.js'?'no-cache':'no-store', 'Cross-Origin-Opener-Policy':'same-origin' });
    res.end(body);
  } catch (error) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not found');
  }
});
server.listen(port, '127.0.0.1', () => console.log(`Almost Human at http://127.0.0.1:${port}`));
