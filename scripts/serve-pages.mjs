import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pagesDirectory = path.resolve(process.env.PAGES_DIRECTORY ?? path.join(rootDirectory, 'build', 'github-pages'));
const basePath = '/gpt-voice';
const port = Number(process.env.PORT ?? 4175);

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.vtt': 'text/vtt; charset=utf-8',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
};

function contentType(filename) {
  return contentTypes[path.extname(filename)] ?? 'application/octet-stream';
}

function artifactPath(requestPath) {
  const decodedPath = decodeURIComponent(requestPath);
  if (decodedPath === basePath) {
    return null;
  }
  if (!decodedPath.startsWith(`${basePath}/`)) {
    return undefined;
  }

  const relativePath = decodedPath.slice(basePath.length + 1);
  const candidate = path.resolve(pagesDirectory, relativePath || 'index.html');
  if (candidate !== pagesDirectory && !candidate.startsWith(`${pagesDirectory}${path.sep}`)) {
    return undefined;
  }
  return candidate;
}

async function resolveFile(candidate) {
  try {
    return (await stat(candidate)).isDirectory() ? path.join(candidate, 'index.html') : candidate;
  } catch {
    return candidate;
  }
}

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? '127.0.0.1'}`);
  const candidate = artifactPath(requestUrl.pathname);
  if (candidate === null) {
    response.writeHead(308, { Location: `${basePath}/${requestUrl.search}` });
    response.end();
    return;
  }
  if (!candidate) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }

  try {
    const filename = await resolveFile(candidate);
    const body = await readFile(filename);
    response.writeHead(200, { 'Content-Type': contentType(filename) });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Serving Pages artifact at http://127.0.0.1:${port}${basePath}/`);
});
