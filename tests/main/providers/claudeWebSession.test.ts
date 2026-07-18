import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  CLAUDE_WEB_SESSION_FILE,
  clearClaudeWebSession,
  createClaudeWebSessionState,
  getClaudeWebReadinessFailureCategory,
  getPlaywrightStorageState,
  readClaudeWebSession,
  resolveClaudeWebOrganization,
  saveClaudeWebSession,
  type ClaudeWebAccountScope,
  type ClaudeWebSessionCookie,
} from '@main/providers/claudeWebSession';
import { CLAUDE_WEB_PRIVATE_FILE_MODE } from '@main/providers/claudeWebSettings';

const TEST_ORIGIN = 'https://voice.test.invalid';
const TEST_ORIGIN_OPTIONS = { origin: TEST_ORIGIN, nowSeconds: 1_000 } as const;
const temporaryDirectories: string[] = [];

function createSessionFile(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gpt-voice-claude-session-'));
  temporaryDirectories.push(directory);
  return path.join(directory, 'session.json');
}

function cookie(overrides: Partial<ClaudeWebSessionCookie> = {}): ClaudeWebSessionCookie {
  return {
    name: 'synthetic-session',
    value: 'synthetic-value',
    domain: 'voice.test.invalid',
    path: '/',
    expires: 2_000,
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    ...overrides,
  };
}

function storageState(
  overrides: {
    cookies?: ClaudeWebSessionCookie[];
    origins?: Array<{ origin: string; localStorage: Array<{ name: string; value: string }> }>;
  } = {},
) {
  return {
    cookies: overrides.cookies ?? [cookie()],
    origins: overrides.origins ?? [
      {
        origin: TEST_ORIGIN,
        localStorage: [{ name: 'synthetic-state', value: 'synthetic-value' }],
      },
    ],
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('claudeWebSession', () => {
  it('uses a provider-specific path and persists only relevant browser state', () => {
    const filePath = createSessionFile();
    const state = storageState({
      cookies: [
        cookie(),
        cookie({ domain: 'unrelated.test.invalid', name: 'unrelated' }),
        cookie({ name: 'synthetic-public', httpOnly: false }),
      ],
      origins: [
        ...storageState().origins,
        { origin: 'https://unrelated.test.invalid', localStorage: [{ name: 'other', value: 'value' }] },
      ],
    });

    assert.notEqual(path.basename(CLAUDE_WEB_SESSION_FILE), 'chatgpt-session.json');
    assert.notEqual(path.basename(CLAUDE_WEB_SESSION_FILE), 'openai-api-settings.json');
    assert.deepEqual(
      saveClaudeWebSession(state, filePath, TEST_ORIGIN_OPTIONS),
      createClaudeWebSessionState(state, TEST_ORIGIN_OPTIONS),
    );

    const persisted = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
    assert.equal(JSON.stringify(persisted).includes('unrelated'), false);
    assert.equal(JSON.stringify(persisted).includes('synthetic-public'), false);
    assert.equal('organizationUuid' in persisted, false);
    assert.equal('accountScope' in persisted, false);
    if (process.platform !== 'win32') {
      assert.equal(fs.statSync(filePath).mode & 0o777, CLAUDE_WEB_PRIVATE_FILE_MODE);
    }
  });

  it('round-trips usable state without schema metadata in the Playwright view', () => {
    const filePath = createSessionFile();
    saveClaudeWebSession(storageState(), filePath, TEST_ORIGIN_OPTIONS);

    const result = readClaudeWebSession(filePath, TEST_ORIGIN_OPTIONS);
    assert.equal(result.status, 'usable');
    if (result.status !== 'usable') return;
    assert.deepEqual(getPlaywrightStorageState(result.state), storageState());
    assert.equal('schemaVersion' in getPlaywrightStorageState(result.state), false);
  });

  it('classifies missing, malformed, unsupported, expired, and missing-origin state', () => {
    const filePath = createSessionFile();
    assert.deepEqual(readClaudeWebSession(filePath, TEST_ORIGIN_OPTIONS), { status: 'missing' });

    fs.writeFileSync(filePath, '{');
    assert.deepEqual(readClaudeWebSession(filePath, TEST_ORIGIN_OPTIONS), { status: 'malformed' });

    fs.writeFileSync(filePath, JSON.stringify({ schemaVersion: 2, cookies: [], origins: [] }));
    assert.deepEqual(readClaudeWebSession(filePath, TEST_ORIGIN_OPTIONS), { status: 'unsupported-version' });

    fs.writeFileSync(
      filePath,
      JSON.stringify({ schemaVersion: 1, ...storageState({ cookies: [cookie({ expires: 999 })] }) }),
    );
    assert.deepEqual(readClaudeWebSession(filePath, TEST_ORIGIN_OPTIONS), { status: 'expired' });

    fs.writeFileSync(filePath, JSON.stringify({ schemaVersion: 1, ...storageState({ origins: [] }) }));
    assert.deepEqual(readClaudeWebSession(filePath, TEST_ORIGIN_OPTIONS), { status: 'missing-origin' });
  });

  it('rejects unusable saves and clears persisted state without exposing values', () => {
    const filePath = createSessionFile();
    assert.throws(
      () => saveClaudeWebSession(storageState({ origins: [] }), filePath, TEST_ORIGIN_OPTIONS),
      /missing-origin/,
    );
    assert.equal(fs.existsSync(filePath), false);

    saveClaudeWebSession(storageState(), filePath, TEST_ORIGIN_OPTIONS);
    assert.equal(clearClaudeWebSession(filePath), true);
    assert.equal(clearClaudeWebSession(filePath), false);
  });

  it('resolves exactly one active organization without using response order', () => {
    const first = { uuid: 'synthetic-org-alpha' };
    const second = { uuid: 'synthetic-org-beta' };
    const result = resolveClaudeWebOrganization({
      activeOrganizationCandidates: [second.uuid],
      eligibleOrganizations: [first, second],
    });

    assert.deepEqual(result, {
      routing: { status: 'resolved', organizationUuid: second.uuid },
      accountScope: 'unknown',
    });
  });

  it('fails safely for missing, mismatched, duplicated, and ambiguous evidence', () => {
    assert.deepEqual(resolveClaudeWebOrganization({ activeOrganizationCandidates: [], eligibleOrganizations: [] }), {
      routing: { status: 'missing' },
      accountScope: 'unknown',
    });
    assert.deepEqual(
      resolveClaudeWebOrganization({
        activeOrganizationCandidates: ['synthetic-org-missing'],
        eligibleOrganizations: [{ uuid: 'synthetic-org-alpha' }],
      }),
      { routing: { status: 'missing' }, accountScope: 'unknown' },
    );
    assert.deepEqual(
      resolveClaudeWebOrganization({
        activeOrganizationCandidates: ['synthetic-org-alpha', 'synthetic-org-beta'],
        eligibleOrganizations: [{ uuid: 'synthetic-org-alpha' }, { uuid: 'synthetic-org-beta' }],
      }),
      { routing: { status: 'ambiguous' }, accountScope: 'unknown' },
    );
    assert.deepEqual(
      resolveClaudeWebOrganization({
        activeOrganizationCandidates: ['synthetic-org-alpha'],
        eligibleOrganizations: [{ uuid: 'synthetic-org-alpha' }, { uuid: 'synthetic-org-alpha' }],
      }),
      { routing: { status: 'ambiguous' }, accountScope: 'unknown' },
    );
  });

  it('keeps account scope independent and reserves personal without heuristic emission', () => {
    const reservedPersonalScope: ClaudeWebAccountScope = 'personal';
    const heuristicInput = {
      activeOrganizationCandidates: ['synthetic-org-alpha'],
      eligibleOrganizations: [{ uuid: 'synthetic-org-alpha', displayName: 'synthetic-label', plan: 'synthetic-plan' }],
      accountScope: reservedPersonalScope,
    };

    assert.equal(reservedPersonalScope, 'personal');
    assert.equal(resolveClaudeWebOrganization(heuristicInput).accountScope, 'unknown');
  });

  it('maps session, feature, and routing failures to safe readiness categories', () => {
    const resolved = { status: 'resolved', organizationUuid: 'synthetic-org-alpha' } as const;
    const missing = { status: 'missing' } as const;
    const ambiguous = { status: 'ambiguous' } as const;

    assert.equal(getClaudeWebReadinessFailureCategory('expired', true, resolved), 'expired');
    assert.equal(getClaudeWebReadinessFailureCategory('malformed', true, resolved), 'missing');
    assert.equal(getClaudeWebReadinessFailureCategory('usable', false, resolved), 'feature-unavailable');
    assert.equal(getClaudeWebReadinessFailureCategory('usable', true, missing), 'missing');
    assert.equal(getClaudeWebReadinessFailureCategory('usable', true, ambiguous), 'ambiguous');
    assert.equal(getClaudeWebReadinessFailureCategory('usable', true, resolved), null);
  });
});
