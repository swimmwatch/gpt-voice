/* eslint-disable max-classes-per-file -- private JSON storage and its settings repository share one adapter boundary. */
import type * as fs from 'node:fs';
import * as path from 'node:path';
import {
  DEFAULT_CLAUDE_WEB_SETTINGS,
  assertValidClaudeWebSettingsInput,
  normalizeClaudeWebSettings,
  type ClaudeWebSettings,
  type ClaudeWebSettingsInput,
} from '@shared/claudeWebSettings';

export const CLAUDE_WEB_PRIVATE_FILE_MODE = 0o600;
export const CLAUDE_WEB_PRIVATE_DIRECTORY_MODE = 0o700;
export const CLAUDE_WEB_SETTINGS_SCHEMA_VERSION = 1;

export type ClaudeWebPrivateJsonReadResult =
  { status: 'ok'; value: unknown } | { status: 'missing' } | { status: 'malformed' };

interface StoredClaudeWebSettings extends ClaudeWebSettings {
  readonly schemaVersion: typeof CLAUDE_WEB_SETTINGS_SCHEMA_VERSION;
}

export interface ClaudeWebPrivateJsonRepository {
  read(filePath: string): ClaudeWebPrivateJsonReadResult;
  remove(filePath: string): boolean;
  write(filePath: string, value: unknown): void;
}

export interface FileClaudeWebPrivateJsonRepositoryDependencies {
  readonly fileSystem: Pick<
    typeof fs,
    'chmodSync' | 'existsSync' | 'mkdirSync' | 'readFileSync' | 'unlinkSync' | 'writeFileSync'
  >;
}

/** Restrictive filesystem adapter shared by Claude settings and session repositories. */
export class FileClaudeWebPrivateJsonRepository implements ClaudeWebPrivateJsonRepository {
  public constructor(private readonly dependencies: FileClaudeWebPrivateJsonRepositoryDependencies) {}

  public read(filePath: string): ClaudeWebPrivateJsonReadResult {
    if (!this.dependencies.fileSystem.existsSync(filePath)) return { status: 'missing' };

    try {
      return {
        status: 'ok',
        value: JSON.parse(this.dependencies.fileSystem.readFileSync(filePath, 'utf8')) as unknown,
      };
    } catch {
      return { status: 'malformed' };
    }
  }

  public remove(filePath: string): boolean {
    try {
      if (!this.dependencies.fileSystem.existsSync(filePath)) return false;
      this.dependencies.fileSystem.unlinkSync(filePath);
      return true;
    } catch {
      return false;
    }
  }

  public write(filePath: string, value: unknown): void {
    try {
      this.dependencies.fileSystem.mkdirSync(path.dirname(filePath), {
        recursive: true,
        mode: CLAUDE_WEB_PRIVATE_DIRECTORY_MODE,
      });
      this.dependencies.fileSystem.writeFileSync(filePath, JSON.stringify(value, null, 2), {
        encoding: 'utf8',
        mode: CLAUDE_WEB_PRIVATE_FILE_MODE,
      });
      this.dependencies.fileSystem.chmodSync(filePath, CLAUDE_WEB_PRIVATE_FILE_MODE);
    } catch {
      throw new Error('Claude Web private state could not be saved');
    }
  }
}

export interface ClaudeWebSettingsRepositoryDependencies {
  readonly privateJson: ClaudeWebPrivateJsonRepository;
  readonly settingsFile: string;
}

/** Provider settings repository with an owned file path and injected private storage. */
export class ClaudeWebSettingsRepository {
  public constructor(private readonly dependencies: ClaudeWebSettingsRepositoryDependencies) {}

  public readonly getSettings = (): ClaudeWebSettings => {
    const result = this.dependencies.privateJson.read(this.dependencies.settingsFile);
    if (result.status !== 'ok' || !isStoredClaudeWebSettings(result.value)) {
      return { ...DEFAULT_CLAUDE_WEB_SETTINGS };
    }
    return normalizeClaudeWebSettings(result.value);
  };

  public readonly save = (input: ClaudeWebSettingsInput): ClaudeWebSettings => {
    const settings = normalizeClaudeWebSettings(input);
    this.dependencies.privateJson.write(this.dependencies.settingsFile, {
      schemaVersion: CLAUDE_WEB_SETTINGS_SCHEMA_VERSION,
      ...settings,
    } satisfies StoredClaudeWebSettings);
    return settings;
  };
}

function isStoredClaudeWebSettings(value: unknown): value is StoredClaudeWebSettings {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const stored = value as Record<string, unknown>;
  return stored.schemaVersion === CLAUDE_WEB_SETTINGS_SCHEMA_VERSION && getStoredSettingsInputError(stored) === null;
}

function getStoredSettingsInputError(stored: Record<string, unknown>): string | null {
  try {
    assertValidClaudeWebSettingsInput({ language: stored.language });
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Invalid Claude Web settings';
  }
}
