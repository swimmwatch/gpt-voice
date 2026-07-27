import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AppProtocolController } from '@main/appProtocol';

class RecordingProtocol {
  public handleCount = 0;
  public handler: ((request: Request) => Promise<Response>) | null = null;
  public schemeCount = 0;
  public unhandleCount = 0;

  public handle(_scheme: string, handler: (request: Request) => Promise<Response>): void {
    this.handleCount += 1;
    this.handler = handler;
  }

  public registerSchemesAsPrivileged(): void {
    this.schemeCount += 1;
  }

  public unhandle(): void {
    this.unhandleCount += 1;
    this.handler = null;
  }
}

describe('AppProtocolController', () => {
  it('registers the privileged scheme and request handler once', () => {
    const protocol = new RecordingProtocol();
    const controller = new AppProtocolController({
      appIconPath: '/resources/icon.png',
      appRoot: '/app/dist',
      logger: { warn: () => undefined },
      protocol,
      readFile: async () => Uint8Array.of(1, 2, 3),
    });

    controller.registerScheme();
    controller.registerScheme();
    controller.registerHandler();
    controller.registerHandler();
    assert.equal(protocol.schemeCount, 1);
    assert.equal(protocol.handleCount, 1);

    controller.dispose();
    controller.dispose();
    assert.equal(protocol.unhandleCount, 1);
  });

  it('serves only normalized files inside the app root', async () => {
    const protocol = new RecordingProtocol();
    const readPaths: string[] = [];
    const controller = new AppProtocolController({
      appIconPath: '/resources/icon.png',
      appRoot: '/app/dist',
      logger: { warn: () => undefined },
      protocol,
      readFile: async (filePath) => {
        readPaths.push(filePath);
        return Uint8Array.of(1, 2, 3);
      },
    });
    controller.registerHandler();

    const success = await protocol.handler?.(new Request('app://gpt-voice/renderer/main.js'));
    const traversal = await protocol.handler?.(new Request('app://gpt-voice/%2e%2e%2fprivate.txt'));
    const wrongHost = await protocol.handler?.(new Request('app://untrusted/index.html'));

    assert.equal(success?.status, 200);
    assert.equal(success?.headers.get('content-type'), 'text/javascript; charset=utf-8');
    assert.deepEqual(readPaths, ['/app/dist/renderer/main.js']);
    assert.equal(traversal?.status, 403);
    assert.equal(wrongHost?.status, 404);
  });
});
