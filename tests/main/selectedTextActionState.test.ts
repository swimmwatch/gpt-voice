import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SelectedTextActionGate } from '@main/services/selectedTextActionState';

describe('selectedTextActionState', () => {
  it('allows only one selected-text action at a time', () => {
    const gate = new SelectedTextActionGate();

    assert.equal(gate.tryBegin('translate'), true);
    assert.equal(gate.getActive(), 'translate');
    assert.equal(gate.tryBegin('translate'), false);
    assert.equal(gate.tryBegin('prettify'), false);

    gate.finish('translate');

    assert.equal(gate.getActive(), null);
    assert.equal(gate.tryBegin('prettify'), true);
  });

  it('ignores finish calls for inactive actions', () => {
    const gate = new SelectedTextActionGate();

    assert.equal(gate.tryBegin('translate'), true);
    gate.finish('prettify');

    assert.equal(gate.getActive(), 'translate');
  });

  it('publishes only matching acquisition, completion, and reset transitions', () => {
    const gate = new SelectedTextActionGate();
    const activity: Array<'translate' | 'prettify' | null> = [];
    gate.subscribe((action) => activity.push(action));

    assert.equal(gate.tryBegin('translate'), true);
    assert.equal(gate.tryBegin('prettify'), false);
    gate.finish('prettify');
    gate.finish('translate');
    gate.reset();
    assert.equal(gate.tryBegin('prettify'), true);
    gate.reset();

    assert.deepEqual(activity, ['translate', null, 'prettify', null]);
  });

  it('isolates throwing listeners and allows subscription cleanup', () => {
    const gate = new SelectedTextActionGate();
    const activity: Array<'translate' | 'prettify' | null> = [];
    const unsubscribe = gate.subscribe((action) => activity.push(action));
    gate.subscribe(() => {
      throw new Error('presentation failure');
    });

    assert.equal(gate.tryBegin('translate'), true);
    gate.finish('translate');
    unsubscribe();
    assert.equal(gate.tryBegin('prettify'), true);
    gate.reset();

    assert.deepEqual(activity, ['translate', null]);
    assert.equal(gate.getActive(), null);
  });
});
