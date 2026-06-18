// 极简本地静态服务器：给原型一个 http 来源，便于连接云开发（云开发会校验来源域名）。
// 用法：node tools/serve.mjs   然后浏览器打开 http://localhost:5500/
// 自检页：http://localhost:5500/cloud-test.html
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../prototype/', import.meta.url));
const port = Number(process.env.PORT) || 5500;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent((req.url || '/').split('?')[0]);
    if (pathname === '/') pathname = '/index.html';
    const filePath = normalize(join(root, pathname));
    // 防目录穿越：解析后的路径必须仍在 prototype 目录内
    if (filePath !== root.slice(0, -1) && !filePath.startsWith(root) && !filePath.startsWith(root.slice(0, -1) + sep)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    const data = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': TYPES[extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  } catch (err) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  }
});

server.listen(port, () => {
  console.log('原型本地服务器已启动：');
  console.log('  主原型   ->  http://localhost:' + port + '/');
  console.log('  云自检   ->  http://localhost:' + port + '/cloud-test.html');
  console.log('（按 Ctrl+C 退出）');
});
