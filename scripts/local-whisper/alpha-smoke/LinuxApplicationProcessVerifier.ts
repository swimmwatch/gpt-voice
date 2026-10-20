import { readFile, readdir, open, readlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { LocalWhisperDeviceIdentityRepository } from '@main/localWhisper/deviceIdentity/LocalWhisperDeviceIdentityRepository';
import path from 'node:path';
import type { LinuxApplicationOwnedGroup } from './LinuxIsolatedApplicationSession';

import { LINUX_ALPHA_SMOKE_EXECUTABLES, type LinuxAlphaSmokeCommandPort } from './LinuxAlphaSmokeCommandRunner';
import { LinuxAlphaSmokeCommandExitError } from './LinuxAlphaSmokeCommandExitError';

const INSTALLED_APPLICATION_PATH = '/opt/GPT-Voice/gpt-voice';
const INSTALLED_APPLICATION_PROCESS_PATTERN = `^${INSTALLED_APPLICATION_PATH}([[:space:]]|$)`;
const PROCESS_ID_PATTERN = /^\d+$/u;
const GPU_MEMORY_PATTERN = /^\d+$/u;
const NO_RUNNING_GPU_PROCESSES = 'No running processes found';
const PROCESS_STAT_START_TIME_INDEX = 19;
const PROCESS_STAT_PARENT_ID_INDEX = 1;
const PROCESS_STAT_STATE_INDEX = 0;
const RTX_50_COMPUTE_CAPABILITY = '12.0';

export interface LinuxProcessIdentity {
  readonly parentProcessId: number;
  readonly processId: number;
  readonly startTime: string;
}

interface LinuxGpuAllocation {
  readonly gpuUuid: string;
  readonly memoryMegabytes: number;
  readonly processId: number;
}

function fail(code: string): never {
  throw new Error(`ALPHA_SMOKE_LINUX_${code}`);
}

function isExpectedNoMatch(error: unknown): boolean {
  return error instanceof LinuxAlphaSmokeCommandExitError && error.exitCode === 1 && error.signal === null;
}

function parseProcessId(value: string): number {
  if (!PROCESS_ID_PATTERN.test(value)) fail('PROCESS_ID_INVALID');
  const processId = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(processId) || processId <= 0) fail('PROCESS_ID_INVALID');
  return processId;
}

function parseParentProcessId(value: string): number {
  if (!PROCESS_ID_PATTERN.test(value)) fail('PROCESS_ID_INVALID');
  const processId = Number(value);
  if (!Number.isSafeInteger(processId) || processId < 0) fail('PROCESS_ID_INVALID');
  return processId;
}

/** Correlates the installed app's stable Linux process tree with NVIDIA compute allocations. */
export class LinuxApplicationProcessVerifier {
  private readonly registeredRoots = new Map<number, LinuxProcessIdentity>();
  private readonly capturedProcesses = new Map<number, LinuxProcessIdentity>();
  public constructor(
    private readonly dependencies: Readonly<{
      commands: LinuxAlphaSmokeCommandPort;
      procRoot?: string;
    }>,
  ) {}

  public async registerApplication(receipt: Readonly<{ processId: number; startTime: string }>): Promise<void> {
    const identity = await this.readProcessIdentity(
      path.join(this.dependencies.procRoot ?? '/proc', String(receipt.processId)),
    );
    if (!identity || identity.startTime !== receipt.startTime) fail('OWNED_PROCESS_LOST');
    this.registeredRoots.set(identity.processId, identity);
    this.capturedProcesses.set(identity.processId, identity);
  }

  public async captureOwnedWorkers(): Promise<ReadonlyMap<number, LinuxProcessIdentity>> {
    return await this.collectOwnedProcesses();
  }

  public async restoreOwnedGroups(groups: readonly LinuxApplicationOwnedGroup[]): Promise<void> {
    for (const group of groups) {
      for (const saved of group.members) {
        const current = await this.readProcessIdentity(
          path.join(this.dependencies.procRoot ?? '/proc', String(saved.processId)),
        );
        if (current?.startTime !== saved.startTime) continue;
        this.capturedProcesses.set(current.processId, current);
        if (saved.processId === group.receipt.processId) this.registeredRoots.set(current.processId, current);
      }
    }
  }

  public async assertOwnedProcessesExited(): Promise<void> {
    for (const saved of this.capturedProcesses.values()) {
      const current = await this.readProcessIdentity(
        path.join(this.dependencies.procRoot ?? '/proc', String(saved.processId)),
      );
      if (current?.startTime === saved.startTime) fail('OWNED_PROCESS_ACTIVE');
    }
  }

  public async assertSelectedGpuAllocation(
    selectedGpuUuid: string,
    worker: Readonly<{ processId: number; startTime: string }>,
  ): Promise<void> {
    const owned = await this.collectOwnedProcesses();
    if (owned.get(worker.processId)?.startTime !== worker.startTime) fail('WORKER_IDENTITY_INVALID');
    const [allocations, eligible] = await Promise.all([this.readGpuAllocations(), this.readRtx50GpuUuids()]);
    if (
      !eligible.has(selectedGpuUuid) ||
      !allocations.some(
        (allocation) =>
          allocation.processId === worker.processId &&
          allocation.gpuUuid === selectedGpuUuid &&
          allocation.memoryMegabytes > 0,
      )
    )
      fail('CUDA_GPU_ALLOCATION_MISSING');
    if (
      allocations.some(
        (allocation) =>
          owned.has(allocation.processId) &&
          (allocation.gpuUuid !== selectedGpuUuid || allocation.processId !== worker.processId),
      )
    )
      fail('CUDA_UNEXPECTED_ALLOCATION');
  }

  public async assertWorkerRuntime(
    record: Readonly<{
      pid: number;
      processStartIdentity: string;
      runtimeBuildDigest: string;
      runtimeIdentityKey: string;
    }>,
    expected: Readonly<{ workerSha256: string; runtimeBuildDigest: string; runtimeIdentityKey: string }>,
  ): Promise<LinuxProcessIdentity> {
    const owned = await this.collectOwnedProcesses();
    const worker = owned.get(record.pid);
    if (
      !worker ||
      worker.startTime !== record.processStartIdentity ||
      record.runtimeBuildDigest !== expected.runtimeBuildDigest ||
      record.runtimeIdentityKey !== expected.runtimeIdentityKey
    )
      fail('WORKER_RUNTIME_INVALID');
    const handle = await open(path.join(this.dependencies.procRoot ?? '/proc', String(record.pid), 'exe'), 'r');
    try {
      const before = await handle.stat();
      if (!before.isFile() || before.size > 512 * 1024 * 1024) fail('WORKER_RUNTIME_INVALID');
      const hash = createHash('sha256');
      for await (const chunk of handle.createReadStream({ autoClose: false })) {
        if (!Buffer.isBuffer(chunk)) fail('WORKER_RUNTIME_INVALID');
        hash.update(chunk);
      }
      const after = await handle.stat();
      if (
        hash.digest('hex') !== expected.workerSha256 ||
        before.dev !== after.dev ||
        before.ino !== after.ino ||
        before.size !== after.size ||
        before.mtimeMs !== after.mtimeMs
      )
        fail('WORKER_RUNTIME_INVALID');
      await this.assertProcessIdentitiesStillMatch(new Map([[worker.processId, worker]]));
      return worker;
    } finally {
      await handle.close();
    }
  }

  public async selectedGpuUuid(deviceId: string, identityDocument: unknown): Promise<string> {
    const identities = new LocalWhisperDeviceIdentityRepository(
      {
        read: () => ({ status: 'ok', value: identityDocument }),
        write: () => fail('DEVICE_IDENTITY_INVALID'),
        remove: () => fail('DEVICE_IDENTITY_INVALID'),
      },
      () => fail('DEVICE_IDENTITY_INVALID'),
    );
    const output = await this.dependencies.commands.run(LINUX_ALPHA_SMOKE_EXECUTABLES.nvidiaSmi, [
      '--query-gpu=uuid,pci.bus_id,compute_cap',
      '--format=csv,noheader,nounits',
    ]);
    const matches: string[] = [];
    for (const line of output.split('\n')) {
      const fields = line.split(',').map((field) => field.trim());
      if (fields.length !== 3 || !/^(?:[a-f\d]{4}|[a-f\d]{8}):[a-f\d]{2}:[a-f\d]{2}\.[0-7]$/iu.test(fields[1]))
        fail('DEVICE_INVENTORY_INVALID');
      const nativeIdentity = fields[1].toLowerCase().replace(/^00000000:/u, '0000:');
      if (identities.getOpaqueId(nativeIdentity) === deviceId && fields[2] === RTX_50_COMPUTE_CAPABILITY)
        matches.push(fields[0]);
    }
    if (matches.length !== 1) fail('SELECTED_DEVICE_INVALID');
    return matches[0];
  }

  public async assertOfflineNamespace(receipt: Readonly<{ processId: number; startTime: string }>): Promise<void> {
    const current = await this.readProcessIdentity(
      path.join(this.dependencies.procRoot ?? '/proc', String(receipt.processId)),
    );
    if (!current || current.startTime !== receipt.startTime) fail('OWNED_PROCESS_LOST');
    const [ownNamespace, applicationNamespace] = await Promise.all([
      readlink('/proc/self/ns/net'),
      readlink(path.join(this.dependencies.procRoot ?? '/proc', String(receipt.processId), 'ns/net')),
    ]);
    if (ownNamespace === applicationNamespace) fail('OFFLINE_NAMESPACE_INVALID');
  }

  public async assertNoActiveApplicationProcess(): Promise<void> {
    const roots = await this.findApplicationRootProcessIds();
    if (roots.length > 0) fail('PACKAGE_PROCESS_ACTIVE');
  }

  public async assertNoOwnedGpuAllocation(): Promise<void> {
    const ownedProcesses = await this.collectOwnedProcesses();
    const allocations = await this.readGpuAllocations();
    if (allocations.some((allocation) => ownedProcesses.has(allocation.processId))) {
      fail('CPU_GPU_ALLOCATION');
    }
  }

  public async assertOwnedRtx50GpuAllocation(): Promise<void> {
    const ownedProcesses = await this.collectOwnedProcesses();
    const [allocations, rtx50GpuUuids] = await Promise.all([this.readGpuAllocations(), this.readRtx50GpuUuids()]);
    if (
      !allocations.some(
        (allocation) =>
          ownedProcesses.has(allocation.processId) &&
          rtx50GpuUuids.has(allocation.gpuUuid) &&
          allocation.memoryMegabytes > 0,
      )
    ) {
      fail('CUDA_GPU_ALLOCATION_MISSING');
    }
  }

  private async findApplicationRootProcessIds(): Promise<readonly number[]> {
    let output: string;
    try {
      output = await this.dependencies.commands.run(LINUX_ALPHA_SMOKE_EXECUTABLES.pgrep, [
        '-f',
        INSTALLED_APPLICATION_PROCESS_PATTERN,
      ]);
    } catch (error) {
      if (isExpectedNoMatch(error)) return Object.freeze([]);
      throw error;
    }
    const ids = output
      .split('\n')
      .filter((value) => value.length > 0)
      .map((value) => parseProcessId(value));
    if (new Set(ids).size !== ids.length) fail('PROCESS_ID_INVALID');
    return Object.freeze(ids);
  }

  private async collectOwnedProcesses(): Promise<ReadonlyMap<number, LinuxProcessIdentity>> {
    const rootIds = [...this.registeredRoots.keys()];
    if (rootIds.length === 0) fail('OWNED_PROCESS_MISSING');
    const processes = await this.readProcessIdentities();
    const owned = new Map<number, LinuxProcessIdentity>();
    for (const processId of rootIds) {
      const process = processes.get(processId);
      if (!process) continue;
      if (process.startTime !== this.registeredRoots.get(processId)?.startTime) fail('OWNED_PROCESS_LOST');
      owned.set(processId, process);
    }
    for (const captured of this.capturedProcesses.values()) {
      const current = processes.get(captured.processId);
      if (current?.startTime === captured.startTime) owned.set(current.processId, current);
    }
    let added = true;
    while (added) {
      added = false;
      for (const process of processes.values()) {
        if (!owned.has(process.processId) && owned.has(process.parentProcessId)) {
          owned.set(process.processId, process);
          added = true;
        }
      }
    }
    await this.assertProcessIdentitiesStillMatch(owned);
    for (const [pid, identity] of owned) this.capturedProcesses.set(pid, identity);
    return owned;
  }

  private async readProcessIdentities(): Promise<ReadonlyMap<number, LinuxProcessIdentity>> {
    const procRoot = this.dependencies.procRoot ?? '/proc';
    const entries = await readdir(procRoot, { withFileTypes: true });
    const identities = new Map<number, LinuxProcessIdentity>();
    for (const entry of entries) {
      if (!entry.isDirectory() || !PROCESS_ID_PATTERN.test(entry.name)) continue;
      const identity = await this.readProcessIdentity(path.join(procRoot, entry.name));
      if (identity !== null) identities.set(identity.processId, identity);
    }
    return identities;
  }

  private async readProcessIdentity(processDirectory: string): Promise<LinuxProcessIdentity | null> {
    let stat: string;
    try {
      stat = await readFile(path.join(processDirectory, 'stat'), 'utf8');
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
      throw error;
    }
    const closingParenthesis = stat.lastIndexOf(')');
    if (closingParenthesis === -1 || stat[closingParenthesis + 1] !== ' ') fail('PROCESS_STAT_INVALID');
    const processId = parseProcessId(path.basename(processDirectory));
    const fields = stat
      .slice(closingParenthesis + 2)
      .trim()
      .split(/\s+/u);
    if (fields[PROCESS_STAT_STATE_INDEX] === 'Z') return null;
    if (
      fields.length <= PROCESS_STAT_START_TIME_INDEX ||
      fields[PROCESS_STAT_STATE_INDEX].length !== 1 ||
      !PROCESS_ID_PATTERN.test(fields[PROCESS_STAT_PARENT_ID_INDEX]) ||
      !/^\d+$/u.test(fields[PROCESS_STAT_START_TIME_INDEX])
    ) {
      fail('PROCESS_STAT_INVALID');
    }
    return Object.freeze({
      parentProcessId: parseParentProcessId(fields[PROCESS_STAT_PARENT_ID_INDEX]),
      processId,
      startTime: fields[PROCESS_STAT_START_TIME_INDEX],
    });
  }

  private async assertProcessIdentitiesStillMatch(processes: ReadonlyMap<number, LinuxProcessIdentity>): Promise<void> {
    const procRoot = this.dependencies.procRoot ?? '/proc';
    for (const process of processes.values()) {
      const current = await this.readProcessIdentity(path.join(procRoot, process.processId.toString(10)));
      if (
        current === null ||
        current.startTime !== process.startTime ||
        current.parentProcessId !== process.parentProcessId
      ) {
        fail('OWNED_PROCESS_LOST');
      }
    }
  }

  private async readGpuAllocations(): Promise<readonly LinuxGpuAllocation[]> {
    const output = await this.dependencies.commands.run(LINUX_ALPHA_SMOKE_EXECUTABLES.nvidiaSmi, [
      '--query-compute-apps=gpu_uuid,pid,used_gpu_memory',
      '--format=csv,noheader,nounits',
    ]);
    if (output === '' || output === NO_RUNNING_GPU_PROCESSES) return Object.freeze([]);
    const allocations = output.split('\n').map((line) => {
      const fields = line.split(',').map((value) => value.trim());
      if (fields.length !== 3 || fields.some((value) => value.length === 0) || !GPU_MEMORY_PATTERN.test(fields[2])) {
        fail('GPU_ALLOCATION_INVALID');
      }
      return Object.freeze({
        gpuUuid: fields[0],
        memoryMegabytes: Number.parseInt(fields[2], 10),
        processId: parseProcessId(fields[1]),
      });
    });
    return Object.freeze(allocations);
  }

  private async readRtx50GpuUuids(): Promise<ReadonlySet<string>> {
    const output = await this.dependencies.commands.run(LINUX_ALPHA_SMOKE_EXECUTABLES.nvidiaSmi, [
      '--query-gpu=uuid,compute_cap',
      '--format=csv,noheader,nounits',
    ]);
    const rtx50GpuUuids = output.split('\n').flatMap((line): readonly string[] => {
      const fields = line.split(',').map((value) => value.trim());
      if (fields.length !== 2 || fields.some((value) => value.length === 0)) fail('RTX50_INVENTORY_INVALID');
      return fields[1] === RTX_50_COMPUTE_CAPABILITY ? [fields[0]] : [];
    });
    if (rtx50GpuUuids.length === 0) fail('RTX50_UNAVAILABLE');
    return new Set(rtx50GpuUuids);
  }
}
