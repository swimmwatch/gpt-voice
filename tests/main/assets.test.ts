import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';
import { AssetPathResolver } from '@main/assets';

describe('AssetPathResolver', () => {
  it('resolves development and packaged assets from injected graph paths', () => {
    const development = new AssetPathResolver({
      isPackaged: false,
      mainDirectory: '/application/dist',
      resourcesPath: '/unused',
    });
    const packaged = new AssetPathResolver({
      isPackaged: true,
      mainDirectory: '/unused',
      resourcesPath: '/application/resources',
    });

    assert.equal(development.getAssetPath('icon.png'), path.join('/application', 'assets', 'icon.png'));
    assert.equal(development.getApplicationRoot(), path.resolve('/application/dist'));
    assert.equal(packaged.getAssetPath('icon.png'), path.join('/application/resources', 'assets', 'icon.png'));
  });
});
