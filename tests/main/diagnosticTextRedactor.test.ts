import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DIAGNOSTIC_REDACTION_REPLACEMENT,
  DIAGNOSTIC_REDACTOR_VERSION,
  DiagnosticTextRedactor,
} from '@main/services/diagnosticTextRedactor';

describe('diagnostic text redactor', () => {
  it('redacts authorization and cookie header values deterministically', () => {
    const redactor = new DiagnosticTextRedactor();
    const secrets = [
      'Bearer bearer-secret-value',
      'Basic dXNlcjpwYXNzd29yZA==',
      'session=private-cookie',
      'refresh=private-cookie',
    ];
    const result = redactor.redact(
      [
        `Authorization: ${secrets[0]}`,
        `Proxy-Authorization: ${secrets[1]}`,
        `Cookie: ${secrets[2]}`,
        `Set-Cookie: ${secrets[3]}`,
      ].join('\n'),
    );

    assert.equal(result.redactorVersion, DIAGNOSTIC_REDACTOR_VERSION);
    assert.equal(result.redactionCount, 4);
    assert.equal(
      result.text,
      [
        `Authorization: ${DIAGNOSTIC_REDACTION_REPLACEMENT}`,
        `Proxy-Authorization: ${DIAGNOSTIC_REDACTION_REPLACEMENT}`,
        `Cookie: ${DIAGNOSTIC_REDACTION_REPLACEMENT}`,
        `Set-Cookie: ${DIAGNOSTIC_REDACTION_REPLACEMENT}`,
      ].join('\n'),
    );
    for (const secret of secrets) {
      assert.equal(result.text.includes(secret), false);
    }
  });

  it('redacts assignments, URL credentials, query values, tokens, JWTs, and private keys', () => {
    const redactor = new DiagnosticTextRedactor();
    const canaries = [
      'correct-horse-battery-staple',
      'api-secret-value',
      'user-name:pass-word',
      'query-password',
      'query-access-token',
      'sk-proj-abcdefghijklmnopqrstuvwxyz123456',
      'github_pat_abcdefghijklmnopqrstuvwxyz123456',
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signaturevalue',
      'private-key-material',
      'dXNlcjphbm90aGVyLXByaXZhdGUtcGFzc3dvcmQ=',
    ];
    const result = redactor.redact(
      [
        `password="${canaries[0]}"`,
        `api_key=${canaries[1]}`,
        `https://${canaries[2]}@example.test/path?password=${canaries[3]}&access_token=${canaries[4]}`,
        `Bearer ${canaries[5]}`,
        canaries[6],
        canaries[7],
        `-----BEGIN PRIVATE KEY-----\n${canaries[8]}\n-----END PRIVATE KEY-----`,
        `Basic ${canaries[9]}`,
      ].join('\n'),
    );

    assert.equal(result.redactionCount, 10);
    assert.equal(result.text.match(/\[REDACTED\]/gu)?.length, 10);
    for (const canary of canaries) {
      assert.equal(result.text.includes(canary), false);
    }
  });

  it('covers every normalized sensitive assignment name', () => {
    const redactor = new DiagnosticTextRedactor();
    const names = [
      'password',
      'passwd',
      'api-key',
      'api_key',
      'access-token',
      'refresh-token',
      'authorization',
      'secret',
      'cookie',
    ];
    const input = names.map((name, index) => `${name}=private-value-${index}`).join('\n');

    const result = redactor.redact(input);

    assert.equal(result.redactionCount, names.length);
    assert.equal(result.text.match(/\[REDACTED\]/gu)?.length, names.length);
    assert.equal(result.text.includes('private-value'), false);
  });

  it('does not alter ordinary words, short prefix-like text, or non-sensitive query names', () => {
    const redactor = new DiagnosticTextRedactor();
    const input =
      'Discuss the password policy, keep the secret garden, bake a cookie recipe, keep sk-short, and open https://example.test/?mode=secret.';

    assert.deepEqual(redactor.redact(input), {
      redactionCount: 0,
      redactorVersion: DIAGNOSTIC_REDACTOR_VERSION,
      text: input,
    });
  });

  it('handles a one-MiB input without unbounded matching behavior', () => {
    const redactor = new DiagnosticTextRedactor();
    const secret = 'sk-proj-abcdefghijklmnopqrstuvwxyz123456';
    const input = `${'a'.repeat(1_048_576 - secret.length - 1)} ${secret}`;

    const result = redactor.redact(input);

    assert.equal(result.redactionCount, 1);
    assert.equal(result.text.includes(secret), false);
    assert.equal(result.text.endsWith(DIAGNOSTIC_REDACTION_REPLACEMENT), true);
  });
});
