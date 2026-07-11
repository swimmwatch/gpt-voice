import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cn } from '@renderer/lib/cn';

describe('cn', () => {
  it('combines conditional class values and resolves Tailwind conflicts', () => {
    assert.equal(cn('px-2', false, 'px-4', ['text-sm', { 'font-medium': true }]), 'px-4 text-sm font-medium');
  });
});
