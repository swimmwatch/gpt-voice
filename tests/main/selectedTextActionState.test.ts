import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createSelectedTextActionGate } from '@main/services/selectedTextActionState';

describe('selectedTextActionState', () => {
  it('allows only one selected-text action at a time', () => {
    const gate = createSelectedTextActionGate();

    assert.equal(gate.tryBegin('translate'), true);
    assert.equal(gate.getActive(), 'translate');
    assert.equal(gate.tryBegin('translate'), false);
    assert.equal(gate.tryBegin('prettify'), false);

    gate.finish('translate');

    assert.equal(gate.getActive(), null);
    assert.equal(gate.tryBegin('prettify'), true);
  });

  it('ignores finish calls for inactive actions', () => {
    const gate = createSelectedTextActionGate();

    assert.equal(gate.tryBegin('translate'), true);
    gate.finish('prettify');

    assert.equal(gate.getActive(), 'translate');
  });
});
