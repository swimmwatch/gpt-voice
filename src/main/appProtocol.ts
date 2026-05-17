import { protocol } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from './logger';

const APP_PROTOCOL = 'app';
const APP_HOST = 'gpt-voice';
const log = createLogger('app-protocol');

const mimeTypes = new Map<string, string>([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
]);

export function registerAppProtocolScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_PROTOCOL,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
      },
    },
  ]);
}

export function getAppUrl(pathname = 'index.html'): string {
  return `${APP_PROTOCOL}://${APP_HOST}/${pathname.replace(/^\/+/, '')}`;
}

export function registerAppProtocol(): void {
  protocol.handle(APP_PROTOCOL, async (request) => {
    try {
      const url = new URL(request.url);
      if (url.host !== APP_HOST) {
        return new Response('Not found', { status: 404 });
      }

      const appRoot = path.resolve(__dirname);
      const relativePath = path.normalize(decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html');
      const filePath = path.resolve(appRoot, relativePath);
      const isInsideAppRoot = filePath === appRoot || filePath.startsWith(`${appRoot}${path.sep}`);

      if (!isInsideAppRoot) {
        return new Response('Forbidden', { status: 403 });
      }

      const body = await fs.readFile(filePath);
      const contentType = mimeTypes.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream';
      return new Response(body, { headers: { 'content-type': contentType } });
    } catch (error) {
      log.warn('Failed to serve app protocol request:', request.url, error);
      return new Response('Not found', { status: 404 });
    }
  });
}
