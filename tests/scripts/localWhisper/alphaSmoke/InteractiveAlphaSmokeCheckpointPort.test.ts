import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { InteractiveAlphaSmokeCheckpointPort } from '@scripts/local-whisper/alpha-smoke/InteractiveAlphaSmokeCheckpointPort';

class FakePrompts {
  public closed = false;
  public readonly questions: string[] = [];

  public constructor(private readonly responses: string[]) {}

  public close(): void {
    this.closed = true;
  }

  public async question(prompt: string): Promise<string> {
    this.questions.push(prompt);
    const response = this.responses.shift();
    if (response === undefined) throw new Error('TEST_RESPONSE_MISSING');
    return response;
  }
}

function createOutput(): { values: string[]; write: (value: string) => void } {
  const values: string[] = [];
  return {
    values,
    write: (value) => {
      values.push(value);
    },
  };
}

describe('InteractiveAlphaSmokeCheckpointPort', () => {
  it('consumes one exact response for each sequential checkpoint on one terminal conversation', async () => {
    const prompts = new FakePrompts(['launch-isolated-app', 'cpu-ui-complete']);
    const output = createOutput();
    const checkpoints = new InteractiveAlphaSmokeCheckpointPort({ output, prompts });

    await checkpoints.confirm('launch-isolated-app', 'Wait for the app.');
    await checkpoints.confirm('cpu-ui-complete', 'Complete CPU exercise.');
    checkpoints.close();

    assert.deepEqual(prompts.questions, [
      'Complete the ordinary UI step, then enter checkpoint launch-isolated-app: ',
      'Complete the ordinary UI step, then enter checkpoint cpu-ui-complete: ',
    ]);
    assert.deepEqual(output.values, ['Wait for the app.\n', 'Complete CPU exercise.\n']);
    assert.equal(prompts.closed, true);
  });

  it('rejects a stale checkpoint response instead of advancing to a later UI stage', async () => {
    const prompts = new FakePrompts(['replace-alpha-deb']);
    const checkpoints = new InteractiveAlphaSmokeCheckpointPort({ prompts });

    await assert.rejects(checkpoints.confirm('launch-isolated-app'), /ALPHA_SMOKE_MANUAL_CHECKPOINT_INVALID/u);
  });

  it('does not allow a checkpoint after terminal input is closed', async () => {
    const checkpoints = new InteractiveAlphaSmokeCheckpointPort({ prompts: new FakePrompts([]) });
    checkpoints.close();

    await assert.rejects(checkpoints.confirm('cpu-ui-complete'), /ALPHA_SMOKE_MANUAL_CHECKPOINT_CLOSED/u);
  });

  it('defers the TTY requirement until a manual checkpoint is actually reached', async () => {
    const checkpoints = new InteractiveAlphaSmokeCheckpointPort({
      input: { isTTY: false } as NodeJS.ReadStream,
      prompts: new FakePrompts(['cpu-ui-complete']),
    });

    await checkpoints.confirm('cpu-ui-complete');
  });

  it('closes the terminal conversation when the shared attempt deadline is exhausted', async () => {
    const prompts = new FakePrompts(['cpu-ui-complete']);
    const checkpoints = new InteractiveAlphaSmokeCheckpointPort({ prompts });

    await assert.rejects(
      checkpoints.confirm('cpu-ui-complete', undefined, Date.now() - 1),
      /ALPHA_SMOKE_DEADLINE_EXHAUSTED/u,
    );
    assert.equal(prompts.closed, true);
    assert.deepEqual(prompts.questions, []);
  });
});
