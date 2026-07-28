/* eslint-disable max-classes-per-file -- the service and its private per-operation state share one invariant. */
import { StatusCodes } from 'http-status-codes';
import type {
  PrettifyFetch,
  PrettifyFetchResponse,
  PrettifyProviderModelList,
} from '@main/services/prettifyProviderBase';
import {
  PRETTIFY_HTTP_MAX_MODEL_OBJECTS,
  type OllamaRunningModelInfo,
  validateOllamaModels,
  validateOllamaRunningModels,
  validateVllmModels,
} from '@main/services/prettifyHttpModelContracts';
import type {
  PrettifyAuditOperationContext,
  PrettifyAuditMetadataOptions,
  PrettifyProviderAudit,
} from '@main/services/prettifyProviderAudit';
import type { PrettifyModelOption, PrettifyProviderAvailability } from '@shared/prettifySettings';

export const PRETTIFY_HTTP_READINESS_TIMEOUT_MS = 10_000;
export const PRETTIFY_HTTP_MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

export type PrettifyHttpProviderId = 'ollama' | 'vllm';

export interface PrettifyHttpReadinessClock {
  clearTimeout(handle: unknown): void;
  now(): number;
  setTimeout(callback: () => void, delayMs: number): unknown;
}

export interface PrettifyHttpReadinessDependencies {
  readonly audit: PrettifyProviderAudit;
  readonly clock: PrettifyHttpReadinessClock;
  readonly createAbortController: () => AbortController;
  readonly fetch: PrettifyFetch;
}

export interface PrettifyHttpAvailabilityRequest {
  readonly apiKey?: string;
  readonly auditContext?: PrettifyAuditOperationContext;
  readonly baseUrl: string;
  readonly providerId: PrettifyHttpProviderId;
  readonly signal: AbortSignal;
}

export interface PrettifyHttpModelListRequest {
  readonly apiKey?: string;
  readonly auditContext?: PrettifyAuditOperationContext;
  readonly baseUrl: string;
  readonly providerId: PrettifyHttpProviderId;
}

type PrettifyHttpReadinessFailureCause =
  'cancelled' | 'connection-failed' | 'request-failed' | 'timed-out' | 'unexpected-response';

interface PrettifyHttpReadinessFailure {
  readonly cause: PrettifyHttpReadinessFailureCause;
  readonly httpStatus?: number;
}

type PrettifyHttpReadinessResult<Value> =
  { readonly success: true; readonly value: Value } | ({ readonly success: false } & PrettifyHttpReadinessFailure);

/** Closed internal failure that never retains provider-controlled error details. */
class PrettifyHttpReadinessError extends Error {
  public constructor(
    public readonly causeCode: PrettifyHttpReadinessFailureCause,
    public readonly httpStatus?: number,
  ) {
    super('Prettify HTTP readiness failed');
    this.name = 'PrettifyHttpReadinessError';
  }
}

/** Owns the absolute deadline, cancellation composition, and aggregate operation budget. */
class PrettifyHttpReadinessOperation {
  private aborted = false;
  private callerAbortListener: (() => void) | null = null;
  private completed = false;
  private modelObjectCount = 0;
  private stopCause: 'cancelled' | 'timed-out' | null = null;
  private readonly stopPromise: Promise<'cancelled' | 'timed-out'>;
  private resolveStop: ((cause: 'cancelled' | 'timed-out') => void) | null = null;
  private timer: unknown;

  public readonly controller: AbortController;
  public readonly deadlineMs: number;

  public constructor(
    private readonly clock: PrettifyHttpReadinessClock,
    createAbortController: () => AbortController,
    private readonly callerSignal?: AbortSignal,
  ) {
    this.controller = createAbortController();
    const startedAt = this.clock.now();
    this.deadlineMs = startedAt + PRETTIFY_HTTP_READINESS_TIMEOUT_MS;
    this.stopPromise = new Promise((resolve) => {
      this.resolveStop = resolve;
    });

    if (callerSignal) {
      this.callerAbortListener = () => this.stop('cancelled');
      callerSignal.addEventListener('abort', this.callerAbortListener, { once: true });
    }
    if (callerSignal?.aborted) {
      this.stop('cancelled');
      return;
    }
    this.timer = this.clock.setTimeout(() => this.stop('timed-out'), PRETTIFY_HTTP_READINESS_TIMEOUT_MS);
  }

  public async execute<Value>(
    operation: () => Promise<Value>,
    publishSuccess: (value: Value) => void,
  ): Promise<PrettifyHttpReadinessResult<Value>> {
    try {
      this.assertActive();
      const value = await operation();
      this.assertActive();
      try {
        publishSuccess(value);
      } catch {
        // Provider audit dependencies are fail-open and cannot alter readiness.
      }
      this.completed = true;
      return { success: true, value };
    } catch (error: unknown) {
      const failure =
        error instanceof PrettifyHttpReadinessError
          ? error
          : new PrettifyHttpReadinessError(this.stopCause ?? 'request-failed');
      return {
        success: false,
        cause: failure.causeCode,
        ...(failure.httpStatus === undefined ? {} : { httpStatus: failure.httpStatus }),
      };
    } finally {
      this.dispose();
    }
  }

  public async waitFor<Value>(
    promise: Promise<Value>,
    rejectionCause: 'connection-failed' | 'request-failed',
  ): Promise<Value> {
    this.assertActive();
    try {
      const result = await Promise.race([
        promise.then((value) => ({ kind: 'value' as const, value })),
        this.stopPromise.then((cause) => ({ cause, kind: 'stop' as const })),
      ]);
      if (result.kind === 'stop') throw new PrettifyHttpReadinessError(result.cause);
      this.assertActive();
      return result.value;
    } catch (error: unknown) {
      if (error instanceof PrettifyHttpReadinessError) throw error;
      if (this.stopCause) throw new PrettifyHttpReadinessError(this.stopCause);
      throw new PrettifyHttpReadinessError(rejectionCause);
    }
  }

  public assertActive(): void {
    if (!this.stopCause && this.clock.now() >= this.deadlineMs) this.stop('timed-out');
    if (this.stopCause) throw new PrettifyHttpReadinessError(this.stopCause);
  }

  public remainingModelObjects(): number {
    return PRETTIFY_HTTP_MAX_MODEL_OBJECTS - this.modelObjectCount;
  }

  public recordModelObjects(count: number): void {
    this.modelObjectCount += count;
    if (this.modelObjectCount > PRETTIFY_HTTP_MAX_MODEL_OBJECTS) {
      throw new PrettifyHttpReadinessError('unexpected-response');
    }
  }

  private stop(cause: 'cancelled' | 'timed-out'): void {
    if (this.completed || this.stopCause) return;
    this.stopCause = cause;
    if (!this.aborted) {
      this.aborted = true;
      try {
        this.controller.abort();
      } catch {
        // Cancellation classification and settlement do not depend on adapter abort behavior.
      }
    }
    this.resolveStop?.(cause);
    this.resolveStop = null;
  }

  private dispose(): void {
    this.completed = true;
    if (this.timer !== undefined) {
      try {
        this.clock.clearTimeout(this.timer);
      } catch {
        // Timer cleanup failures cannot alter an already-settled operation.
      }
      this.timer = undefined;
    }
    if (this.callerSignal && this.callerAbortListener) {
      try {
        this.callerSignal.removeEventListener('abort', this.callerAbortListener);
      } catch {
        // The main process does not own the caller signal.
      }
      this.callerAbortListener = null;
    }
    this.resolveStop = null;
  }
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function createHeaders(apiKey?: string): Record<string, string> {
  return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
}

function withOllamaRunningMetadata(
  models: readonly PrettifyModelOption[],
  runningModels: ReadonlyMap<string, OllamaRunningModelInfo>,
): PrettifyModelOption[] {
  return models.map((model) => {
    const runningModel = runningModels.get(model.id);
    if (!runningModel) return model;
    const sizeBytes = model.sizeBytes ?? runningModel.sizeBytes;
    return {
      ...model,
      isLoaded: true,
      ...(sizeBytes === undefined ? {} : { sizeBytes }),
      ...(runningModel.vramSizeBytes === undefined ? {} : { vramSizeBytes: runningModel.vramSizeBytes }),
    };
  });
}

function isSafeHttpStatus(status: number): boolean {
  return Number.isInteger(status) && status >= 100 && status <= 599;
}

/** Owns bounded HTTP readiness acquisition, validation, cancellation, and audit settlement. */
export class PrettifyHttpReadiness {
  public constructor(private readonly dependencies: PrettifyHttpReadinessDependencies) {}

  public async checkAvailability(request: PrettifyHttpAvailabilityRequest): Promise<PrettifyProviderAvailability> {
    const context = request.auditContext ?? this.dependencies.audit.startAvailability(request.providerId);
    context.lifecycle.phaseEntered('readiness', this.dependencies.audit.createMetadata({ modelSource: 'http' }));
    const operation = new PrettifyHttpReadinessOperation(
      this.dependencies.clock,
      this.dependencies.createAbortController,
      request.signal,
    );
    const result = await operation.execute(
      async () => {
        const response = await this.fetchPrimaryResponse(operation, request);
        const contract = await this.parseModelsResponse(operation, request.providerId, response);
        operation.recordModelObjects(contract.modelObjectCount);
      },
      () => this.dependencies.audit.terminalSuccess(context, 'readiness', { modelSource: 'http' }),
    );

    if (!result.success) {
      this.terminalFailure(context, 'availability', result);
      return { status: 'unavailable' };
    }

    return { status: 'available' };
  }

  public async listModels(request: PrettifyHttpModelListRequest): Promise<PrettifyProviderModelList> {
    const context = request.auditContext ?? this.dependencies.audit.startModelList(request.providerId);
    context.lifecycle.phaseEntered('model-discovery', this.dependencies.audit.createMetadata({ modelSource: 'http' }));
    const operation = new PrettifyHttpReadinessOperation(
      this.dependencies.clock,
      this.dependencies.createAbortController,
    );
    const result = await operation.execute(
      async () => {
        const response = await this.fetchPrimaryResponse(operation, request);
        const primary = await this.parseModelsResponse(operation, request.providerId, response);
        operation.recordModelObjects(primary.modelObjectCount);

        if (request.providerId === 'vllm') return primary.models;
        const running = await this.fetchOllamaRunningModels(operation, request.baseUrl);
        return withOllamaRunningMetadata(primary.models, running);
      },
      () =>
        this.dependencies.audit.terminalSuccess(context, 'result', {
          modelSource: 'http',
        }),
    );

    if (!result.success) {
      this.terminalFailure(context, 'model-list', result);
      return { availability: { status: 'unavailable' }, models: [], source: 'http' };
    }

    return { availability: { status: 'available' }, models: result.value, source: 'http' };
  }

  private async fetchPrimaryResponse(
    operation: PrettifyHttpReadinessOperation,
    request: Pick<PrettifyHttpAvailabilityRequest, 'apiKey' | 'baseUrl' | 'providerId'>,
  ): Promise<PrettifyFetchResponse> {
    const path = request.providerId === 'ollama' ? '/api/tags' : '/models';
    let responsePromise: Promise<PrettifyFetchResponse>;
    try {
      responsePromise = this.dependencies.fetch(joinUrl(request.baseUrl, path), {
        ...(request.providerId === 'vllm' ? { headers: createHeaders(request.apiKey) } : {}),
        signal: operation.controller.signal,
      });
    } catch {
      throw new PrettifyHttpReadinessError('connection-failed');
    }
    const response = await operation.waitFor(responsePromise, 'connection-failed');
    const status = this.getStatus(response);
    if (status !== Number(StatusCodes.OK)) {
      throw new PrettifyHttpReadinessError('request-failed', status);
    }
    return response;
  }

  private async fetchOllamaRunningModels(
    operation: PrettifyHttpReadinessOperation,
    baseUrl: string,
  ): Promise<ReadonlyMap<string, OllamaRunningModelInfo>> {
    let responsePromise: Promise<PrettifyFetchResponse>;
    try {
      responsePromise = this.dependencies.fetch(joinUrl(baseUrl, '/api/ps'), {
        signal: operation.controller.signal,
      });
    } catch {
      return new Map();
    }

    let response: PrettifyFetchResponse;
    try {
      response = await operation.waitFor(responsePromise, 'connection-failed');
    } catch (error: unknown) {
      if (
        error instanceof PrettifyHttpReadinessError &&
        (error.causeCode === 'cancelled' || error.causeCode === 'timed-out')
      ) {
        throw error;
      }
      return new Map();
    }
    if (this.getStatus(response) !== Number(StatusCodes.OK)) return new Map();

    const parsed = await this.parseJsonResponse(operation, response);
    const contract = validateOllamaRunningModels(parsed, operation.remainingModelObjects());
    if (contract === null) throw new PrettifyHttpReadinessError('unexpected-response');
    operation.recordModelObjects(contract.modelObjectCount);
    return contract.models;
  }

  private async parseModelsResponse(
    operation: PrettifyHttpReadinessOperation,
    providerId: PrettifyHttpProviderId,
    response: PrettifyFetchResponse,
  ) {
    const parsed = await this.parseJsonResponse(operation, response);
    const contract =
      providerId === 'ollama'
        ? validateOllamaModels(parsed, operation.remainingModelObjects())
        : validateVllmModels(parsed, operation.remainingModelObjects());
    if (contract === null) throw new PrettifyHttpReadinessError('unexpected-response');
    return contract;
  }

  private async parseJsonResponse(
    operation: PrettifyHttpReadinessOperation,
    response: PrettifyFetchResponse,
  ): Promise<unknown> {
    let body: ReadableStream<Uint8Array> | null | undefined;
    try {
      body = response.body;
    } catch {
      throw new PrettifyHttpReadinessError('unexpected-response');
    }
    if (!body) throw new PrettifyHttpReadinessError('unexpected-response');

    const bytes = await this.readBoundedBody(operation, body);
    operation.assertActive();
    let json: string;
    try {
      json = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      throw new PrettifyHttpReadinessError('unexpected-response');
    }
    operation.assertActive();
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new PrettifyHttpReadinessError('unexpected-response');
    }
    operation.assertActive();
    return parsed;
  }

  private async readBoundedBody(
    operation: PrettifyHttpReadinessOperation,
    body: ReadableStream<Uint8Array>,
  ): Promise<Uint8Array> {
    let reader: ReadableStreamDefaultReader<Uint8Array>;
    try {
      reader = body.getReader();
    } catch {
      throw new PrettifyHttpReadinessError('unexpected-response');
    }
    const chunks: Uint8Array[] = [];
    let byteLength = 0;
    try {
      while (true) {
        const result = await operation.waitFor(reader.read(), 'request-failed');
        if (result.done) break;
        if (!(result.value instanceof Uint8Array)) {
          throw new PrettifyHttpReadinessError('unexpected-response');
        }
        byteLength += result.value.byteLength;
        if (byteLength > PRETTIFY_HTTP_MAX_RESPONSE_BYTES) {
          throw new PrettifyHttpReadinessError('unexpected-response');
        }
        chunks.push(result.value);
      }
    } finally {
      try {
        void reader.cancel().catch(() => undefined);
      } catch {
        // A provider-owned stream may reject cancellation after the operation has already settled.
      }
      try {
        reader.releaseLock();
      } catch {
        // A pending read owned by a timed-out provider stream may keep the lock until its late settlement.
      }
    }

    const bytes = new Uint8Array(byteLength);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  }

  private getStatus(response: PrettifyFetchResponse): number {
    let status: number;
    try {
      status = response.status;
    } catch {
      throw new PrettifyHttpReadinessError('unexpected-response');
    }
    if (!isSafeHttpStatus(status)) throw new PrettifyHttpReadinessError('unexpected-response');
    return status;
  }

  private terminalFailure(
    context: PrettifyAuditOperationContext,
    operation: 'availability' | 'model-list',
    failure: PrettifyHttpReadinessFailure,
  ): void {
    const phase =
      failure.cause === 'unexpected-response'
        ? 'result'
        : operation === 'availability'
          ? 'readiness'
          : 'model-discovery';
    const metadata: Omit<PrettifyAuditMetadataOptions, 'causeCode'> = {
      modelSource: 'http',
      ...(failure.httpStatus === undefined ? {} : { httpStatus: failure.httpStatus }),
    };
    try {
      if (failure.cause === 'cancelled') {
        this.dependencies.audit.terminalCancelled(context, phase, metadata);
        return;
      }
      this.dependencies.audit.terminalFailure(context, phase, failure.cause, metadata);
    } catch {
      // Provider audit dependencies are fail-open and cannot alter readiness.
    }
  }
}
