import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { FileChatGPTSessionStore } from '@main/providers/chatgptSessionStore';
import type { SessionState } from '@main/providers/chatgptUtils';

const FIXED_NOW_MS = 1_753_603_200_000;

class FileChatGPTSessionStoreFixture {
  public readonly directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gpt-voice-chatgpt-session-'));
  public readonly errors: string[] = [];
  public readonly info: Array<{ readonly message: string; readonly value: number }> = [];
  public readonly sessionFile = path.join(this.directory, 'session.json');
  public readonly tokenFile = path.join(this.directory, 'token.json');
  public readonly store = new FileChatGPTSessionStore({
    fileSystem: fs,
    logger: {
      error: (message) => this.errors.push(message),
      info: (message, value) => this.info.push({ message, value }),
    },
    now: () => FIXED_NOW_MS,
    sessionFile: this.sessionFile,
    tokenFile: this.tokenFile,
  });

  public dispose(): void {
    fs.rmSync(this.directory, { force: true, recursive: true });
  }
}

const fixtures: FileChatGPTSessionStoreFixture[] = [];

function createFixture(): FileChatGPTSessionStoreFixture {
  const fixture = new FileChatGPTSessionStoreFixture();
  fixtures.push(fixture);
  return fixture;
}

afterEach(() => {
  for (const fixture of fixtures) fixture.dispose();
  fixtures.length = 0;
});

describe('file ChatGPT session store', () => {
  it('persists and restores session and access-token state through the injected filesystem', () => {
    const fixture = createFixture();
    const session: SessionState = { cookies: [] };
    const accessToken = 'private-access-token-canary';

    fixture.store.saveSession(session);
    fixture.store.saveAccessToken(accessToken);

    assert.deepEqual(fixture.store.readSession(), session);
    assert.equal(fixture.store.readAccessToken(), accessToken);
    assert.deepEqual(JSON.parse(fs.readFileSync(fixture.tokenFile, 'utf8')), {
      accessToken,
      savedAt: FIXED_NOW_MS,
    });
    assert.deepEqual(fixture.info, [{ message: 'Loaded cached token, length:', value: accessToken.length }]);
    assert.doesNotMatch(JSON.stringify(fixture.info), /private-access-token-canary/u);
  });

  it('returns empty state for missing or malformed files without exposing their contents', () => {
    const fixture = createFixture();

    assert.equal(fixture.store.readSession(), null);
    assert.equal(fixture.store.readAccessToken(), '');

    fs.writeFileSync(fixture.sessionFile, '{private-session-canary');
    fs.writeFileSync(fixture.tokenFile, '{"accessToken":42,"secret":"private-token-canary"}');

    assert.equal(fixture.store.readSession(), null);
    assert.equal(fixture.store.readAccessToken(), '');
    assert.deepEqual(fixture.errors, ['Failed to load session']);
    assert.doesNotMatch(JSON.stringify(fixture.errors), /private-session-canary|private-token-canary/u);
  });

  it('clears persisted state idempotently', () => {
    const fixture = createFixture();
    fixture.store.saveSession({ cookies: [] });
    fixture.store.saveAccessToken('token');

    fixture.store.clearSession();
    fixture.store.clearAccessToken();
    fixture.store.clearSession();
    fixture.store.clearAccessToken();

    assert.equal(fs.existsSync(fixture.sessionFile), false);
    assert.equal(fs.existsSync(fixture.tokenFile), false);
    assert.equal(fixture.store.readSession(), null);
    assert.equal(fixture.store.readAccessToken(), '');
  });

  it('keeps token persistence and cleanup fail-open when filesystem operations fail', () => {
    const fixture = createFixture();
    const store = new FileChatGPTSessionStore({
      fileSystem: {
        existsSync: () => true,
        readFileSync: () => {
          throw new Error('private read failure');
        },
        unlinkSync: () => {
          throw new Error('private unlink failure');
        },
        writeFileSync: () => {
          throw new Error('private write failure');
        },
      },
      logger: {
        error: (message) => fixture.errors.push(message),
        info: (message, value) => fixture.info.push({ message, value }),
      },
      now: () => FIXED_NOW_MS,
      sessionFile: fixture.sessionFile,
      tokenFile: fixture.tokenFile,
    });

    assert.equal(store.readSession(), null);
    assert.equal(store.readAccessToken(), '');
    assert.doesNotThrow(() => store.saveAccessToken('private-token-canary'));
    assert.doesNotThrow(() => store.clearSession());
    assert.doesNotThrow(() => store.clearAccessToken());
    assert.deepEqual(fixture.errors, [
      'Failed to load session',
      'Failed to load cached token',
      'Failed to save cached token',
    ]);
    assert.doesNotMatch(JSON.stringify(fixture.errors), /private|token-canary/u);
  });
});
