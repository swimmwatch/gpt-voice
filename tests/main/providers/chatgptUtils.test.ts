import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setLocale } from '../../../src/main/i18n';
import {
  getAudioFileExtension,
  getUnexpiredCookies,
  hasUsableSessionState,
  isChatGptAuthCookie,
  isUnexpiredCookie,
  parseTranscribeResponseBody,
  type StorageCookie,
} from '../../../src/main/providers/chatgptUtils';

function cookie(overrides: Partial<StorageCookie>): StorageCookie {
  return {
    name: 'session',
    value: 'value',
    domain: 'chatgpt.com',
    path: '/',
    expires: -1,
    ...overrides,
  };
}

describe('chatgptUtils', () => {
  afterEach(() => {
    setLocale('en');
  });

  describe('getAudioFileExtension', () => {
    it('maps known recording mime types to upload extensions', () => {
      assert.equal(getAudioFileExtension('audio/webm;codecs=opus'), 'webm');
      assert.equal(getAudioFileExtension('audio/mp4'), 'm4a');
      assert.equal(getAudioFileExtension('audio/ogg;codecs=opus'), 'ogg');
      assert.equal(getAudioFileExtension('audio/wav'), 'wav');
    });

    it('defaults unknown or empty mime types to webm', () => {
      assert.equal(getAudioFileExtension(''), 'webm');
      assert.equal(getAudioFileExtension('application/octet-stream'), 'webm');
    });
  });

  describe('cookies', () => {
    it('treats session cookies and future-expiring cookies as usable', () => {
      assert.equal(isUnexpiredCookie(cookie({ expires: -1 }), 1000), true);
      assert.equal(isUnexpiredCookie(cookie({ expires: 0 }), 1000), true);
      assert.equal(isUnexpiredCookie(cookie({ expires: 1001 }), 1000), true);
    });

    it('filters out expired cookies', () => {
      const cookies = [
        cookie({ name: 'expired', expires: 999 }),
        cookie({ name: 'future', expires: 1001 }),
        cookie({ name: 'session', expires: -1 }),
      ];

      assert.deepEqual(
        getUnexpiredCookies(cookies, 1000).map((item) => item.name),
        ['future', 'session'],
      );
    });

    it('recognizes ChatGPT and OpenAI auth cookies by name and domain', () => {
      assert.equal(isChatGptAuthCookie(cookie({ name: 'session', domain: 'chatgpt.com' })), true);
      assert.equal(isChatGptAuthCookie(cookie({ name: 'oai-client-auth-session', domain: '.openai.com' })), true);
      assert.equal(
        isChatGptAuthCookie(cookie({ name: '__Secure-next-auth.session-token.0', domain: 'auth.openai.com' })),
        true,
      );
    });

    it('rejects auth-looking cookies on unrelated domains', () => {
      assert.equal(isChatGptAuthCookie(cookie({ name: 'session', domain: 'example.com' })), false);
      assert.equal(isChatGptAuthCookie(cookie({ name: 'not-auth', domain: 'chatgpt.com' })), false);
    });

    it('detects a usable session only when an unexpired auth cookie exists', () => {
      assert.equal(
        hasUsableSessionState(
          {
            cookies: [
              cookie({ name: 'session', domain: 'chatgpt.com', expires: 999 }),
              cookie({ name: 'not-auth', domain: 'chatgpt.com', expires: 2000 }),
            ],
          },
          1000,
        ),
        false,
      );

      assert.equal(
        hasUsableSessionState(
          {
            cookies: [cookie({ name: 'session', domain: '.chatgpt.com', expires: 2000 })],
          },
          1000,
        ),
        true,
      );
    });
  });

  describe('parseTranscribeResponseBody', () => {
    it('returns text from a successful text response', () => {
      assert.deepEqual(parseTranscribeResponseBody({ status: 200, body: JSON.stringify({ text: 'hello' }) }), {
        success: true,
        text: 'hello',
      });
    });

    it('returns text from a successful transcript response', () => {
      assert.deepEqual(parseTranscribeResponseBody({ status: 200, body: JSON.stringify({ transcript: 'hello' }) }), {
        success: true,
        text: 'hello',
      });
    });

    it('returns a localized error for non-JSON responses', () => {
      setLocale('en');

      assert.deepEqual(parseTranscribeResponseBody({ status: 502, body: 'bad gateway' }), {
        success: false,
        error: 'Transcribe endpoint returned non-JSON (status 502): bad gateway',
      });
    });

    it('truncates non-JSON response bodies in errors', () => {
      const body = 'x'.repeat(400);
      const result = parseTranscribeResponseBody({ status: 500, body });

      assert.equal(result.success, false);
      assert.equal(result.error?.endsWith('x'.repeat(300)), true);
      assert.equal(result.error?.includes('x'.repeat(301)), false);
    });

    it('returns raw JSON when the response does not contain transcription text', () => {
      assert.deepEqual(parseTranscribeResponseBody({ status: 200, body: JSON.stringify({ ok: true }) }), {
        success: false,
        error: 'No transcription in response',
        raw: '{"ok":true}',
      });
    });

    it('returns provider detail errors from failed JSON responses', () => {
      assert.deepEqual(
        parseTranscribeResponseBody({
          status: 500,
          body: JSON.stringify({ detail: 'Error in ASR API' }),
        }),
        {
          success: false,
          error: 'Error in ASR API',
          raw: '{"detail":"Error in ASR API"}',
        },
      );
    });

    it('returns nested provider detail errors from failed JSON responses', () => {
      assert.deepEqual(
        parseTranscribeResponseBody({
          status: 429,
          body: JSON.stringify({
            detail: {
              detail: 'Transcription is temporarily unavailable. Please try again shortly.',
              retry_after_seconds: 30,
            },
          }),
        }),
        {
          success: false,
          error: 'Transcription is temporarily unavailable. Please try again shortly.',
          raw: '{"detail":{"detail":"Transcription is temporarily unavailable. Please try again shortly.","retry_after_seconds":30}}',
        },
      );
    });
  });
});
