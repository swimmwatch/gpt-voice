import * as path from 'node:path';
import type { Protocol } from 'electron';
import { APP_ICON_ASSET_PATH } from '@shared/appAssets';

const APP_PROTOCOL = 'app';
const APP_HOST = 'gpt-voice';
const DEFAULT_APP_PATH = 'index.html';
const DEFAULT_CONTENT_TYPE = 'application/octet-stream';
const NOT_FOUND_RESPONSE = 'Not found';
const FORBIDDEN_RESPONSE = 'Forbidden';

const MIME_TYPES = new Map<string, string>([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
]);

export interface AppProtocolControllerDependencies {
  readonly appIconPath: string;
  readonly appRoot: string;
  readonly logger: {
    warn(...args: unknown[]): void;
  };
  readonly protocol: Pick<Protocol, 'handle' | 'registerSchemesAsPrivileged' | 'unhandle'>;
  readonly readFile: (filePath: string) => Promise<Uint8Array>;
  readonly schemePreRegistered?: boolean;
}

/** Registers the privileged renderer scheme synchronously before Electron is ready. */
export function registerAppProtocolScheme(protocol: Pick<Protocol, 'registerSchemesAsPrivileged'>): void {
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

/** Owns registration and teardown of the privileged app:// renderer protocol. */
export class AppProtocolController {
  private readonly appRoot: string;
  private handlerRegistered = false;
  private schemeRegistered: boolean;

  public constructor(private readonly dependencies: AppProtocolControllerDependencies) {
    this.appRoot = path.resolve(dependencies.appRoot);
    this.schemeRegistered = dependencies.schemePreRegistered ?? false;
  }

  public registerScheme(): void {
    if (this.schemeRegistered) return;
    registerAppProtocolScheme(this.dependencies.protocol);
    this.schemeRegistered = true;
  }

  public registerHandler(): void {
    if (this.handlerRegistered) return;
    this.dependencies.protocol.handle(APP_PROTOCOL, async (request) => {
      try {
        const url = new URL(request.url);
        if (url.host !== APP_HOST) {
          return new Response(NOT_FOUND_RESPONSE, { status: 404 });
        }

        const relativePath = path.normalize(decodeURIComponent(url.pathname).replace(/^\/+/, '') || DEFAULT_APP_PATH);
        const bundledFilePath = path.resolve(this.appRoot, relativePath);
        const isInsideAppRoot =
          bundledFilePath === this.appRoot || bundledFilePath.startsWith(`${this.appRoot}${path.sep}`);
        if (!isInsideAppRoot) {
          return new Response(FORBIDDEN_RESPONSE, { status: 403 });
        }

        const filePath = getAppProtocolFilePath(relativePath, this.appRoot, this.dependencies.appIconPath);
        const body = await this.dependencies.readFile(filePath);
        return new Response(Uint8Array.from(body).buffer, {
          headers: { 'content-type': getAppProtocolContentType(filePath) },
        });
      } catch (error: unknown) {
        this.dependencies.logger.warn('Failed to serve app protocol request:', request.url, error);
        return new Response(NOT_FOUND_RESPONSE, { status: 404 });
      }
    });
    this.handlerRegistered = true;
  }

  public dispose(): void {
    if (!this.handlerRegistered) return;
    this.dependencies.protocol.unhandle(APP_PROTOCOL);
    this.handlerRegistered = false;
  }
}

export function getAppUrl(pathname = DEFAULT_APP_PATH): string {
  return `${APP_PROTOCOL}://${APP_HOST}/${pathname.replace(/^\/+/, '')}`;
}

export function getAppProtocolFilePath(relativePath: string, appRoot: string, appIconPath: string): string {
  return relativePath === APP_ICON_ASSET_PATH ? appIconPath : path.resolve(appRoot, relativePath);
}

export function getAppProtocolContentType(filePath: string): string {
  return MIME_TYPES.get(path.extname(filePath).toLowerCase()) || DEFAULT_CONTENT_TYPE;
}
