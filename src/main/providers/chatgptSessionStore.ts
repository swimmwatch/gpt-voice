import type * as fs from 'node:fs';
import type { SessionState } from './chatgptUtils';

export interface ChatGPTSessionStore {
  clearAccessToken(): void;
  clearSession(): void;
  readAccessToken(): string;
  readSession(): SessionState | null;
  saveAccessToken(accessToken: string): void;
  saveSession(state: SessionState): void;
}

export interface ChatGPTSessionStoreLogger {
  error(message: string): void;
  info(message: string, value: number): void;
}

export interface FileChatGPTSessionStoreDependencies {
  readonly fileSystem: Pick<typeof fs, 'existsSync' | 'readFileSync' | 'unlinkSync' | 'writeFileSync'>;
  readonly logger: ChatGPTSessionStoreLogger;
  readonly now: () => number;
  readonly sessionFile: string;
  readonly tokenFile: string;
}

interface StoredAccessToken {
  readonly accessToken: string;
  readonly savedAt: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Filesystem adapter for ChatGPT session cookies and the cached access token. */
export class FileChatGPTSessionStore implements ChatGPTSessionStore {
  public constructor(private readonly dependencies: FileChatGPTSessionStoreDependencies) {}

  public readSession(): SessionState | null {
    try {
      if (!this.dependencies.fileSystem.existsSync(this.dependencies.sessionFile)) return null;
      const value: unknown = JSON.parse(
        this.dependencies.fileSystem.readFileSync(this.dependencies.sessionFile, 'utf8'),
      );
      return isRecord(value) ? value : null;
    } catch {
      this.dependencies.logger.error('Failed to load session');
      return null;
    }
  }

  public saveSession(state: SessionState): void {
    this.dependencies.fileSystem.writeFileSync(this.dependencies.sessionFile, JSON.stringify(state, null, 2));
  }

  public clearSession(): void {
    try {
      if (this.dependencies.fileSystem.existsSync(this.dependencies.sessionFile)) {
        this.dependencies.fileSystem.unlinkSync(this.dependencies.sessionFile);
      }
    } catch {
      // Session cleanup remains fail-open.
    }
  }

  public readAccessToken(): string {
    try {
      if (!this.dependencies.fileSystem.existsSync(this.dependencies.tokenFile)) return '';
      const value: unknown = JSON.parse(this.dependencies.fileSystem.readFileSync(this.dependencies.tokenFile, 'utf8'));
      if (!isRecord(value) || typeof value.accessToken !== 'string' || !value.accessToken) return '';
      this.dependencies.logger.info('Loaded cached token, length:', value.accessToken.length);
      return value.accessToken;
    } catch {
      this.dependencies.logger.error('Failed to load cached token');
      return '';
    }
  }

  public saveAccessToken(accessToken: string): void {
    const stored: StoredAccessToken = {
      accessToken,
      savedAt: this.dependencies.now(),
    };
    try {
      this.dependencies.fileSystem.writeFileSync(this.dependencies.tokenFile, JSON.stringify(stored, null, 2));
    } catch {
      this.dependencies.logger.error('Failed to save cached token');
    }
  }

  public clearAccessToken(): void {
    try {
      if (this.dependencies.fileSystem.existsSync(this.dependencies.tokenFile)) {
        this.dependencies.fileSystem.unlinkSync(this.dependencies.tokenFile);
      }
    } catch {
      // Token cleanup remains fail-open.
    }
  }
}
