import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PRETTIFY_PROMPT,
  DEFAULT_PRETTIFY_REASONING,
  isPrettifyReasoning,
  normalizePrettifySettings,
} from '@shared/prettifySettings';

describe('prettifySettings', () => {
  it('recognizes supported reasoning values', () => {
    assert.equal(isPrettifyReasoning('instant'), true);
    assert.equal(isPrettifyReasoning('standard'), true);
    assert.equal(isPrettifyReasoning('extended'), true);
    assert.equal(isPrettifyReasoning('slow'), false);
    assert.equal(isPrettifyReasoning(null), false);
  });

  it('normalizes missing or invalid settings to defaults', () => {
    assert.deepEqual(normalizePrettifySettings(), {
      prompt: DEFAULT_PRETTIFY_PROMPT,
      reasoning: DEFAULT_PRETTIFY_REASONING,
    });
    assert.deepEqual(normalizePrettifySettings({ prompt: '   ', reasoning: 'slow' }), {
      prompt: DEFAULT_PRETTIFY_PROMPT,
      reasoning: DEFAULT_PRETTIFY_REASONING,
    });
  });

  it('trims custom prompts and keeps supported reasoning values', () => {
    assert.deepEqual(normalizePrettifySettings({ prompt: '  Improve this  ', reasoning: 'extended' }), {
      prompt: 'Improve this',
      reasoning: 'extended',
    });
  });
});
