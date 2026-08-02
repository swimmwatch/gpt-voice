import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LOCAL_WHISPER_MAX_PROMPT_CODE_POINTS, type LocalWhisperRendererSnapshot } from '@shared/localWhisper';
import {
  countLocalWhisperPromptCodePoints,
  createLocalWhisperDraft,
  validateLocalWhisperDraft,
} from '@renderer/localWhisper/LocalWhisperSettingsState';
import { getLocalWhisperFamilyRequirement } from '@renderer/localWhisper/LocalWhisperPresentation';
import { FakeCoordinator, createSnapshotService } from '../../main/localWhisper/ipc/localWhisperIpcTestUtils';

function snapshot(): LocalWhisperRendererSnapshot {
  return createSnapshotService(new FakeCoordinator()).snapshot;
}

describe('Local Whisper settings draft', () => {
  it('publishes approximate RAM and VRAM guidance for every selectable model family', () => {
    const expected = {
      tiny: '≈ 2–4 GiB RAM · 1–2 GiB VRAM',
      base: '≈ 2–4 GiB RAM · 1–2 GiB VRAM',
      small: '≈ 4–6 GiB RAM · 2–3 GiB VRAM',
      medium: '≈ 6–10 GiB RAM · 3–6 GiB VRAM',
      'large-v3': '≈ 10–16 GiB RAM · 6–8 GiB VRAM',
      'large-v3-turbo': '≈ 6–10 GiB RAM · 3–6 GiB VRAM',
    } as const;

    for (const [family, requirement] of Object.entries(expected)) {
      assert.equal(getLocalWhisperFamilyRequirement(family as keyof typeof expected), requirement);
    }
  });

  it('builds one complete closed candidate and excludes hidden inactive fields', () => {
    const current = snapshot();
    const draft = {
      ...createLocalWhisperDraft(current),
      executionTarget: 'cpu' as const,
      cpuThreads: 'auto',
      decodingStrategy: 'greedy' as const,
      temperature: '0,00',
      beamSize: '999',
      bestOf: '999',
    };
    const result = validateLocalWhisperDraft(draft, current);

    assert.deepEqual(result.errors, {});
    assert.equal(result.candidate?.execution.target, 'cpu');
    assert.deepEqual(result.candidate?.decoding, { strategy: 'greedy', temperatureHundredths: 0 });
    assert.equal('deviceId' in (result.candidate?.execution ?? {}), false);
    assert.equal('beamSize' in (result.candidate?.decoding ?? {}), false);
    assert.equal('bestOf' in (result.candidate?.decoding ?? {}), false);
  });

  it('validates code points, Unicode safety, and explicit prompt mutation semantics', () => {
    const current = snapshot();
    const baseline = createLocalWhisperDraft(current);
    const maximum = '😀'.repeat(LOCAL_WHISPER_MAX_PROMPT_CODE_POINTS);
    assert.equal(countLocalWhisperPromptCodePoints(maximum), LOCAL_WHISPER_MAX_PROMPT_CODE_POINTS);
    assert.equal(
      validateLocalWhisperDraft({ ...baseline, initialPrompt: maximum, promptMutation: 'replace' }, current).errors
        .initialPrompt,
      undefined,
    );
    assert.match(
      validateLocalWhisperDraft({ ...baseline, initialPrompt: `${maximum}😀`, promptMutation: 'replace' }, current)
        .errors.initialPrompt ?? '',
      /at most/u,
    );
    assert.match(
      validateLocalWhisperDraft({ ...baseline, initialPrompt: 'unsafe\0prompt', promptMutation: 'replace' }, current)
        .errors.initialPrompt ?? '',
      /invalid Unicode scalar or NUL/u,
    );
    assert.match(
      validateLocalWhisperDraft({ ...baseline, initialPrompt: '', promptMutation: 'replace' }, current).errors
        .initialPrompt ?? '',
      /choose Clear on Save/u,
    );
    assert.deepEqual(validateLocalWhisperDraft({ ...baseline, promptMutation: 'clear' }, current).promptMutation, {
      kind: 'clear',
    });
  });

  it('enforces temperature grid, strategy cross-fields, q5_0 gating, and host CPU bounds', () => {
    const current = snapshot();
    const baseline = createLocalWhisperDraft(current);

    assert.match(
      validateLocalWhisperDraft({ ...baseline, temperature: '0.03' }, current).errors.temperature ?? '',
      /increments of 0.05/u,
    );
    assert.match(
      validateLocalWhisperDraft(
        { ...baseline, decodingStrategy: 'bestOfSampling', temperature: '0.00', bestOf: '5' },
        current,
      ).errors.temperature ?? '',
      /requires temperature/u,
    );
    assert.match(
      validateLocalWhisperDraft({ ...baseline, modelVariant: 'q5_0', modelFamily: 'medium' }, current).errors
        .modelVariant ?? '',
      /large-v3/u,
    );
    assert.match(
      validateLocalWhisperDraft(
        { ...baseline, executionTarget: 'cpu', cpuThreads: String(current.host.logicalProcessorCount + 1) },
        current,
      ).errors.cpuThreads ?? '',
      /integer from 1/u,
    );
  });
});
