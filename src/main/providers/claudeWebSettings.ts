import * as fs from 'node:fs';
import * as path from 'node:path';
import { APP_DIR } from '../config';
import {
  DEFAULT_CLAUDE_WEB_SETTINGS,
  assertValidClaudeWebSettingsInput,
  normalizeClaudeWebSettings,
  type ClaudeWebSettings,
  type ClaudeWebSettingsInput,
} from '@shared/claudeWebSettings';

export const CLAUDE_WEB_SETTINGS_FILE = path.join(APP_DIR, 'claude-web-settings.json');
export const CLAUDE_WEB_PRIVATE_FILE_MODE = 0o600;
export const CLAUDE_WEB_PRIVATE_DIRECTORY_MODE = 0o700;
export const CLAUDE_WEB_SETTINGS_SCHEMA_VERSION = 1;

export type ClaudeWebPrivateJsonReadResult =
  { status: 'ok'; value: unknown } | { status: 'missing' } | { status: 'malformed' };

interface StoredClaudeWebSettings extends ClaudeWebSettings {
  schemaVersion: typeof CLAUDE_WEB_SETTINGS_SCHEMA_VERSION;
}

export function readClaudeWebPrivateJson(filePath: string): ClaudeWebPrivateJsonReadResult {
  if (!fs.existsSync(filePath)) return { status: 'missing' };

  try {
    return { status: 'ok', value: JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown };
  } catch {
    return { status: 'malformed' };
  }
}

export function writeClaudeWebPrivateJson(filePath: string, value: unknown): void {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: CLAUDE_WEB_PRIVATE_DIRECTORY_MODE });
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2), {
      encoding: 'utf8',
      mode: CLAUDE_WEB_PRIVATE_FILE_MODE,
    });
    fs.chmodSync(filePath, CLAUDE_WEB_PRIVATE_FILE_MODE);
  } catch {
    throw new Error('Claude Web private state could not be saved');
  }
}

export function removeClaudeWebPrivateFile(filePath: string): boolean {
  try {
    if (!fs.existsSync(filePath)) return false;
    fs.unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
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

export function getClaudeWebSettings(filePath = CLAUDE_WEB_SETTINGS_FILE): ClaudeWebSettings {
  const result = readClaudeWebPrivateJson(filePath);
  if (result.status !== 'ok' || !isStoredClaudeWebSettings(result.value)) {
    return { ...DEFAULT_CLAUDE_WEB_SETTINGS };
  }
  return normalizeClaudeWebSettings(result.value);
}

export function saveClaudeWebSettings(
  input: ClaudeWebSettingsInput,
  filePath = CLAUDE_WEB_SETTINGS_FILE,
): ClaudeWebSettings {
  const settings = normalizeClaudeWebSettings(input);
  writeClaudeWebPrivateJson(filePath, {
    schemaVersion: CLAUDE_WEB_SETTINGS_SCHEMA_VERSION,
    ...settings,
  } satisfies StoredClaudeWebSettings);
  return settings;
}
