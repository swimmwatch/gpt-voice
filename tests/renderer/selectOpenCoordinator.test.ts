import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import { createSelectOpenCoordinator } from '@renderer/selectOpenCoordinator';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

describe('renderer Select open coordination', () => {
  it('closes the previous menu before activating another and ignores unrelated deactivation', () => {
    const coordinator = createSelectOpenCoordinator();
    const first = Symbol('first');
    const second = Symbol('second');
    const closed: string[] = [];

    coordinator.activate(first, () => closed.push('first'));
    coordinator.deactivate(second);
    coordinator.activate(first, () => closed.push('first-replacement'));
    assert.equal(closed.join(','), '');

    coordinator.activate(second, () => closed.push('second'));
    assert.equal(closed.join(','), 'first-replacement');

    coordinator.deactivate(second);
    coordinator.activate(first, () => closed.push('first-after-reset'));
    assert.equal(closed.join(','), 'first-replacement');
  });

  it('is shared by Radix and searchable Select implementations', () => {
    const select = readFileSync(path.join(PROJECT_ROOT, 'src/renderer/components/ui/select.tsx'), 'utf8');
    const searchable = readFileSync(
      path.join(PROJECT_ROOT, 'src/renderer/components/SearchableSelectInput.tsx'),
      'utf8',
    );

    for (const source of [select, searchable]) {
      assert.match(source, /selectOpenCoordinator\.activate/u);
      assert.match(source, /selectOpenCoordinator\.deactivate/u);
    }
  });
});
