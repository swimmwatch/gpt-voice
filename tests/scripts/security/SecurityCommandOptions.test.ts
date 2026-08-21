import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SecurityCommandOptions } from '@scripts/security/securityCommandOptions';

function options(arguments_: readonly string[]): SecurityCommandOptions {
  return new SecurityCommandOptions(arguments_, () => {
    throw new Error('ARGUMENT_INVALID');
  });
}

describe('SecurityCommandOptions', () => {
  it('reads one optional or required value without depending on argument order', () => {
    const commandOptions = options(['node', 'script', '--source-commit=abc', '--platform=linux']);

    assert.equal(commandOptions.optional('missing'), null);
    assert.equal(commandOptions.required('source-commit'), 'abc');
    assert.equal(commandOptions.platform(), 'linux');
  });

  it('rejects missing, empty, duplicate, and unsupported values through the caller-owned error', () => {
    assert.throws(() => options([]).required('source-commit'), /^Error: ARGUMENT_INVALID$/u);
    assert.throws(() => options(['--source-commit=']).required('source-commit'), /^Error: ARGUMENT_INVALID$/u);
    assert.throws(
      () => options(['--source-commit=one', '--source-commit=two']).optional('source-commit'),
      /^Error: ARGUMENT_INVALID$/u,
    );
    assert.throws(() => options(['--platform=darwin']).platform(), /^Error: ARGUMENT_INVALID$/u);
  });
});
