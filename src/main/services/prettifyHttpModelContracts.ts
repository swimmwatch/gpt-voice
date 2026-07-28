import type { PrettifyModelOption } from '@shared/prettifySettings';

export const PRETTIFY_HTTP_MAX_MODEL_OBJECTS = 10_000;
export const PRETTIFY_HTTP_MAX_MODEL_PROPERTIES = 64;
export const PRETTIFY_HTTP_MAX_JSON_NESTING_LEVELS = 16;
export const PRETTIFY_HTTP_MAX_MODEL_NAME_BYTES = 512;

interface ValidatedModelContract {
  readonly modelObjectCount: number;
}

export interface ValidatedOllamaModels extends ValidatedModelContract {
  readonly models: PrettifyModelOption[];
}

export interface ValidatedOllamaRunningModels extends ValidatedModelContract {
  readonly models: ReadonlyMap<string, OllamaRunningModelInfo>;
}

export interface OllamaRunningModelInfo {
  readonly sizeBytes?: number;
  readonly vramSizeBytes?: number;
}

export interface ValidatedVllmModels extends ValidatedModelContract {
  readonly models: PrettifyModelOption[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function hasValidNesting(value: unknown): boolean {
  const pending: Array<{ readonly depth: number; readonly value: unknown }> = [{ depth: 1, value }];

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) return false;
    if (!isRecord(current.value) && !Array.isArray(current.value)) continue;
    if (current.depth > PRETTIFY_HTTP_MAX_JSON_NESTING_LEVELS) return false;

    const children = Array.isArray(current.value) ? current.value : Object.values(current.value);
    for (const child of children) {
      if (isRecord(child) || Array.isArray(child)) {
        pending.push({ depth: current.depth + 1, value: child });
      }
    }
  }

  return true;
}

function getFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function getBoundedModelName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (Buffer.byteLength(value, 'utf8') > PRETTIFY_HTTP_MAX_MODEL_NAME_BYTES) return null;
  const name = value.trim();
  return name || null;
}

function hasValidModelObjectShape(item: unknown): item is Record<string, unknown> {
  return isRecord(item) && Object.keys(item).length <= PRETTIFY_HTTP_MAX_MODEL_PROPERTIES;
}

function getOllamaModelName(item: Record<string, unknown>): string | null {
  const hasModel = hasOwn(item, 'model');
  const hasName = hasOwn(item, 'name');
  const model = hasModel ? getBoundedModelName(item.model) : null;
  const name = hasName ? getBoundedModelName(item.name) : null;

  if ((hasModel && model === null) || (hasName && name === null)) return null;
  return model ?? name;
}

function getValidatedModelArray(
  root: unknown,
  key: 'data' | 'models',
  remainingModelObjects: number,
): readonly unknown[] | null {
  if (!hasValidNesting(root) || !isRecord(root)) return null;
  const items = root[key];
  if (!isUnknownArray(items) || items.length > remainingModelObjects) {
    return null;
  }
  return items;
}

export function validateOllamaModels(root: unknown, remainingModelObjects: number): ValidatedOllamaModels | null {
  const items = getValidatedModelArray(root, 'models', remainingModelObjects);
  if (items === null) return null;

  const models: PrettifyModelOption[] = [];
  for (const item of items) {
    if (!hasValidModelObjectShape(item)) return null;
    const id = getOllamaModelName(item);
    if (id === null) return null;
    const sizeBytes = getFiniteNumber(item.size);
    if (hasOwn(item, 'size') && sizeBytes === undefined) return null;
    models.push(sizeBytes === undefined ? { id, name: id } : { id, name: id, sizeBytes });
  }

  return { modelObjectCount: items.length, models };
}

export function validateOllamaRunningModels(
  root: unknown,
  remainingModelObjects: number,
): ValidatedOllamaRunningModels | null {
  const items = getValidatedModelArray(root, 'models', remainingModelObjects);
  if (items === null) return null;

  const models = new Map<string, OllamaRunningModelInfo>();
  for (const item of items) {
    if (!hasValidModelObjectShape(item)) return null;
    const id = getOllamaModelName(item);
    if (id === null) return null;
    const sizeBytes = getFiniteNumber(item.size);
    const vramSizeBytes = getFiniteNumber(item.size_vram);
    if (
      (hasOwn(item, 'size') && sizeBytes === undefined) ||
      (hasOwn(item, 'size_vram') && vramSizeBytes === undefined)
    ) {
      return null;
    }
    models.set(id, {
      ...(sizeBytes === undefined ? {} : { sizeBytes }),
      ...(vramSizeBytes === undefined ? {} : { vramSizeBytes }),
    });
  }

  return { modelObjectCount: items.length, models };
}

export function validateVllmModels(root: unknown, remainingModelObjects: number): ValidatedVllmModels | null {
  const items = getValidatedModelArray(root, 'data', remainingModelObjects);
  if (items === null) return null;

  const models: PrettifyModelOption[] = [];
  for (const item of items) {
    if (!hasValidModelObjectShape(item)) return null;
    const id = getBoundedModelName(item.id);
    if (id === null) return null;
    models.push({ id, name: id });
  }

  return { modelObjectCount: items.length, models };
}
