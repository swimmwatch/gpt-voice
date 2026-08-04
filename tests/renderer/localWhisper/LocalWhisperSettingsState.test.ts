import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  LOCAL_WHISPER_MAX_PROMPT_CODE_POINTS,
  type LocalWhisperRendererOption,
  type LocalWhisperRendererOptionCompatibility,
  type LocalWhisperRendererSnapshot,
} from '@shared/localWhisper';
import {
  countLocalWhisperPromptCodePoints,
  createLocalWhisperDraft,
  updateLocalWhisperModelFamily,
  updateLocalWhisperModelRevision,
  updateLocalWhisperRuntimeRevision,
  updateLocalWhisperTarget,
  validateLocalWhisperDraft,
} from '@renderer/localWhisper/LocalWhisperSettingsState';
import { getLocalWhisperFamilyRequirement } from '@renderer/localWhisper/LocalWhisperPresentation';
import { FakeCoordinator, createSnapshotService } from '../../main/localWhisper/ipc/localWhisperIpcTestUtils';

function snapshot(): LocalWhisperRendererSnapshot {
  return createSnapshotService(new FakeCoordinator()).snapshot;
}

function option(
  group: LocalWhisperRendererOption['group'],
  id: string,
  compatibility: Partial<LocalWhisperRendererOptionCompatibility> = {},
): LocalWhisperRendererOption {
  return Object.freeze({
    group,
    id,
    label: id,
    available: true,
    tier: 'Production',
    reason: null,
    selected: false,
    selectedButUnavailable: false,
    saved: false,
    default: false,
    recommended: true,
    remembered: false,
    compatibility: Object.freeze({
      target: compatibility.target ?? null,
      backend: compatibility.backend ?? null,
      modelFamily: compatibility.modelFamily ?? null,
      modelVariant: compatibility.modelVariant ?? null,
      eligibleBackends: Object.freeze([...(compatibility.eligibleBackends ?? [])]),
    }),
  });
}

function selectionSnapshot(): LocalWhisperRendererSnapshot {
  const current = snapshot();
  return Object.freeze({
    ...current,
    options: Object.freeze([
      option('runtime', 'runtime-cpu-v1', { target: 'cpu', backend: 'cpu' }),
      option('runtime', 'runtime-cuda-v1', { target: 'gpu', backend: 'cuda' }),
      option('backend', 'cuda', { target: 'gpu', backend: 'cuda' }),
      option('device', 'nvidia-device', { target: 'gpu', eligibleBackends: ['cuda'] }),
      option('modelFamily', 'base'),
      option('modelFamily', 'medium'),
      option('modelRevision', 'model-base-v1', { modelFamily: 'base', modelVariant: 'full' }),
      option('modelRevision', 'model-medium-v1', { modelFamily: 'medium', modelVariant: 'full' }),
      option('modelVariant', 'full'),
    ]),
  });
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

  it('updates the CUDA runtime, backend, and device atomically when GPU becomes the parent target', () => {
    const current = selectionSnapshot();
    const draft = updateLocalWhisperTarget(createLocalWhisperDraft(current), 'gpu', current);
    const result = validateLocalWhisperDraft(draft, current);

    assert.equal(draft.runtimeRevision, 'runtime-cuda-v1');
    assert.equal(draft.backend, 'cuda');
    assert.equal(draft.deviceId, 'nvidia-device');
    assert.deepEqual(result.errors, {});
    assert.deepEqual(result.candidate?.execution, {
      target: 'gpu',
      backend: 'cuda',
      deviceId: 'nvidia-device',
    });
  });

  it('keeps execution and model parents synchronized when a dependent revision is selected', () => {
    const current = selectionSnapshot();
    const cuda = updateLocalWhisperRuntimeRevision(createLocalWhisperDraft(current), 'runtime-cuda-v1', current);
    const medium = updateLocalWhisperModelRevision(cuda, 'model-medium-v1', current);
    const result = validateLocalWhisperDraft(medium, current);

    assert.equal(medium.executionTarget, 'gpu');
    assert.equal(medium.backend, 'cuda');
    assert.equal(medium.modelFamily, 'medium');
    assert.equal(medium.modelVariant, 'full');
    assert.deepEqual(result.errors, {});
  });

  it('selects a revision from the requested model family and rejects cross-field mismatches before save', () => {
    const current = selectionSnapshot();
    const baseline = createLocalWhisperDraft(current);
    const medium = updateLocalWhisperModelFamily(baseline, 'medium', current);

    assert.equal(medium.modelRevision, 'model-medium-v1');
    assert.deepEqual(validateLocalWhisperDraft(medium, current).errors, {});
    assert.match(
      validateLocalWhisperDraft(
        {
          ...baseline,
          executionTarget: 'gpu',
          backend: 'cuda',
          deviceId: 'nvidia-device',
          runtimeRevision: 'runtime-cpu-v1',
        },
        current,
      ).errors.runtimeRevision ?? '',
      /compatible with the execution target/u,
    );
    assert.match(
      validateLocalWhisperDraft({ ...baseline, modelFamily: 'medium' }, current).errors.modelRevision ?? '',
      /compatible with the model family/u,
    );
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
