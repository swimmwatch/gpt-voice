import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { securityErrorWithCause, SecurityCommandOptions } from '@scripts/security/securityCommandOptions';

function options(arguments_: readonly string[]): SecurityCommandOptions {
  return new SecurityCommandOptions(arguments_, () => {
    throw new Error('ARGUMENT_INVALID');
  });
}

describe('SecurityCommandOptions', () => {
  it('preserves a private command failure cause without changing its message', () => {
    const cause = new Error('private cause');

    const error = securityErrorWithCause('bounded message', cause);

    assert.equal(error.message, 'bounded message');
    assert.equal(Object.getOwnPropertyDescriptor(error, 'cause')?.value, cause);
  });

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
