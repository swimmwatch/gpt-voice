import { createHash } from 'node:crypto';

import type {
  FocusedPreparedPerformanceInputs,
  LinuxPerformanceCollectionPlatformAdapter,
} from './LinuxPerformanceQualificationAdapters';
import {
  FocusedPerformanceDocumentProducer,
  focusedPerformanceSchedule,
  type FocusedPerformanceBundle,
  type FocusedPerformanceManifest,
  type FocusedPerformanceRunPlan,
} from './FocusedPerformanceQualification';
import {
  PerformanceCollectionError,
  PerformanceQualificationPhaseParser,
  type PerformanceAttemptProcessPort,
  type PerformanceCachePreparationPort,
  type PerformanceResourcePort,
  type PerformanceResourceProof,
} from './PerformanceQualificationCollector';
import type { LocalWhisperQualificationValidator } from './QualificationContracts';

const REASON_CODE = /^[A-Z][A-Z0-9_]{2,63}$/u;
const PROCESS_ROLES = ['main', 'guard', 'worker'] as const;

function failureCode(error: unknown): string {
  if (error instanceof PerformanceCollectionError && REASON_CODE.test(error.code)) return error.code;
  return 'ATTEMPT_FAILED';
}

function inputSetDigest(inputs: FocusedPreparedPerformanceInputs): string {
  const identities = [inputs.application, inputs.runtime, inputs.model, inputs.inputFixture]
    .map(({ identity }) => `${identity.sha256}|${identity.sizeBytes}`)
    .sort();
  return createHash('sha256').update(JSON.stringify(identities), 'utf8').digest('hex');
}

function validateResources(
  proof: PerformanceResourceProof,
  manifest: FocusedPerformanceManifest,
): readonly { readonly id: (typeof manifest.requiredResourceIds)[number]; readonly peakBytes: number }[] {
  const resourceIds = proof.resources.map(({ id }) => id);
  const roles = proof.roleRegistrations.map(({ role }) => role);
  if (
    JSON.stringify(resourceIds) !== JSON.stringify(manifest.requiredResourceIds) ||
    JSON.stringify(roles) !== JSON.stringify(PROCESS_ROLES) ||
    proof.processSettlementProof !== 'ownedProcessTreeSettled' ||
    proof.unownedProcessAttribution !== 0 ||
    proof.unownedGpuAttribution !== (manifest.backend === 'cpu' ? 'notApplicable' : 0) ||
    proof.identityChanges !== 0 ||
    proof.lateRoleRegistrations !== 0 ||
    proof.liveOwnedProcessesAfterSettlement !== 0 ||
    proof.resources.some(({ peakBytes }) => !Number.isSafeInteger(peakBytes) || peakBytes < 0)
  ) {
    throw new PerformanceCollectionError('RESOURCE_PROOF_INVALID');
  }
  return proof.resources;
}

/** Collects six candidate-only samples while retaining the legacy process transport strictly as a private adapter. */
export class FocusedPerformanceQualificationCollector {
  private collecting = false;

  public constructor(
    private readonly validator: LocalWhisperQualificationValidator,
    private readonly ports: Readonly<{
      readonly platform: Pick<LinuxPerformanceCollectionPlatformAdapter, 'prepareFocused' | 'verifyFocused'>;
      readonly cache: PerformanceCachePreparationPort;
      readonly process: PerformanceAttemptProcessPort;
      readonly resources: PerformanceResourcePort;
    }>,
  ) {}

  public async collect(plan: FocusedPerformanceRunPlan, signal?: AbortSignal): Promise<FocusedPerformanceBundle> {
    if (this.collecting) throw new PerformanceCollectionError('COLLECTION_ALREADY_ACTIVE');
    this.collecting = true;
    let inputs: FocusedPreparedPerformanceInputs | null = null;
    try {
      plan = this.validator.validateAndFreezeDocument(
        'focusedPerformanceRunPlan',
        plan,
      ) as unknown as FocusedPerformanceRunPlan;
      if (signal?.aborted) throw new PerformanceCollectionError('COLLECTION_CANCELLED');
      inputs = await this.ports.platform.prepareFocused(plan);
      const documents = new FocusedPerformanceDocumentProducer(this.validator);
      const manifest = documents.produceManifest(plan);
      const receipts = [];
      const samples = [];
      for (const cell of focusedPerformanceSchedule()) {
        if (signal?.aborted) throw new PerformanceCollectionError('COLLECTION_CANCELLED');
        const digest = inputSetDigest(inputs);
        try {
          await this.ports.cache.prepare({
            cacheState: cell.cacheState,
            inputSetDigest: digest,
            files: [inputs.application, inputs.runtime, inputs.model, inputs.inputFixture],
            ...(signal ? { signal } : {}),
          });
          const receipt = documents.produceCacheReceipt(manifest, {
            sampleId: cell.sampleId,
            cacheState: cell.cacheState,
            sampleIndex: cell.sampleIndex,
            inputSetDigest: digest,
            status: 'prepared',
            reasonCode: null,
          });
          receipts.push(receipt);
          samples.push(
            await this.collectAttempt(
              plan,
              manifest,
              inputs,
              cell,
              receipt.focusedPerformanceCacheReceiptDigest,
              signal,
            ),
          );
        } catch (error) {
          if (signal?.aborted) throw new PerformanceCollectionError('COLLECTION_CANCELLED');
          const reasonCode = failureCode(error);
          const receipt = documents.produceCacheReceipt(manifest, {
            sampleId: cell.sampleId,
            cacheState: cell.cacheState,
            sampleIndex: cell.sampleIndex,
            inputSetDigest: digest,
            status: 'failed',
            reasonCode,
          });
          receipts.push(receipt);
          samples.push(
            documents.produceSample(manifest, {
              focusedPerformanceCacheReceiptDigest: receipt.focusedPerformanceCacheReceiptDigest,
              sampleId: cell.sampleId,
              cacheState: cell.cacheState,
              sampleIndex: cell.sampleIndex,
              status: 'failed',
              failureReason: reasonCode,
              endToEndNanoseconds: null,
              phases: [],
              resources: [],
            }),
          );
        }
      }
      await this.ports.platform.verifyFocused(plan, inputs);
      return documents.produceBundle(manifest, receipts, samples);
    } finally {
      if (inputs) await this.ports.platform.verifyFocused(plan, inputs).catch(() => undefined);
      this.collecting = false;
    }
  }

  private async collectAttempt(
    plan: FocusedPerformanceRunPlan,
    manifest: FocusedPerformanceManifest,
    inputs: FocusedPreparedPerformanceInputs,
    cell: ReturnType<typeof focusedPerformanceSchedule>[number],
    receiptDigest: string,
    signal: AbortSignal | undefined,
  ) {
    const documents = new FocusedPerformanceDocumentProducer(this.validator);
    let processSession: ReturnType<PerformanceAttemptProcessPort['start']> | null = null;
    let resourceSession: ReturnType<PerformanceResourcePort['start']> | null = null;
    try {
      processSession = this.ports.process.start({
        executablePath: inputs.application.absolutePath,
        workingDirectory: inputs.candidateSource,
        timeoutMilliseconds: plan.attemptTimeoutMilliseconds,
        ...(signal ? { signal } : {}),
        // This private runner transport is version-3-only. Its synthetic fields never enter the v4 documents.
        request: Object.freeze({
          schemaVersion: 3,
          activationPurpose: 'qualification',
          sampleId: cell.sampleId,
          platform: 'linux',
          backend: manifest.backend,
          model: Object.freeze({ family: 'base', variant: 'full', sha256: manifest.model.sha256 }),
          candidateWindow: 1,
          cacheState: cell.cacheState,
          pairIndex: cell.sampleIndex,
          runOrder: 'beforeThenAfter',
          side: 'after',
          runtimeArtifact: Object.freeze({
            absolutePath: inputs.runtime.absolutePath,
            sizeBytes: inputs.runtime.identity.sizeBytes,
            sha256: inputs.runtime.identity.sha256,
          }),
          modelArtifact: Object.freeze({
            absolutePath: inputs.model.absolutePath,
            sizeBytes: inputs.model.identity.sizeBytes,
            sha256: inputs.model.identity.sha256,
          }),
          inputFixture: Object.freeze({
            absolutePath: inputs.inputFixture.absolutePath,
            sizeBytes: inputs.inputFixture.identity.sizeBytes,
            sha256: inputs.inputFixture.identity.sha256,
          }),
          requiredPhaseIds: manifest.requiredPhaseIds,
          derivedSourceReceiptDigest: manifest.instrumentationOverlaySha256,
        }),
      });
      resourceSession = this.ports.resources.start({
        rootPid: processSession.rootPid,
        backend: manifest.backend,
        expectedExecutableSha256: inputs.application.identity.sha256,
        requiredResourceIds: manifest.requiredResourceIds,
        eventStream: processSession.eventStream,
        completionTimeoutMilliseconds: plan.attemptTimeoutMilliseconds,
      });
      const output = await processSession.complete();
      const outcome = new PerformanceQualificationPhaseParser().parse(output, manifest as never);
      if (outcome.status === 'failed') {
        resourceSession.terminate();
        return documents.produceSample(manifest, {
          focusedPerformanceCacheReceiptDigest: receiptDigest,
          sampleId: cell.sampleId,
          cacheState: cell.cacheState,
          sampleIndex: cell.sampleIndex,
          status: 'failed',
          failureReason: outcome.failureReason,
          endToEndNanoseconds: null,
          phases: [],
          resources: [],
        });
      }
      const resources = validateResources(await resourceSession.finish(), manifest);
      return documents.produceSample(manifest, {
        focusedPerformanceCacheReceiptDigest: receiptDigest,
        sampleId: cell.sampleId,
        cacheState: cell.cacheState,
        sampleIndex: cell.sampleIndex,
        status: 'success',
        failureReason: null,
        endToEndNanoseconds: outcome.endToEndNanoseconds,
        phases: outcome.phases,
        resources,
      });
    } catch (error) {
      if (signal?.aborted) throw new PerformanceCollectionError('COLLECTION_CANCELLED');
      return documents.produceSample(manifest, {
        focusedPerformanceCacheReceiptDigest: receiptDigest,
        sampleId: cell.sampleId,
        cacheState: cell.cacheState,
        sampleIndex: cell.sampleIndex,
        status: 'failed',
        failureReason: failureCode(error),
        endToEndNanoseconds: null,
        phases: [],
        resources: [],
      });
    } finally {
      resourceSession?.terminate();
      await processSession?.terminate().catch(() => undefined);
    }
  }
}
