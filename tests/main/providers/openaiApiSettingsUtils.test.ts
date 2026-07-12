import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_OPENAI_API_SETTINGS,
  OPENAI_API_SETTINGS_MODEL,
  getOpenAIApiSettingsInputError,
  normalizeOpenAIApiSettings,
  normalizeTemperature,
  sanitizeOpenAIApiSettings,
  shouldUpdateApiKey,
} from '@main/providers/openaiApiSettingsUtils';

describe('openaiApiSettingsUtils', () => {
  it('normalizes unknown values to safe Whisper defaults', () => {
    assert.deepEqual(
      normalizeOpenAIApiSettings({
        model: 'unknown',
        prettifyModel: '',
        language: 'de',
        prompt: 42 as unknown as string,
        temperature: Number.NaN,
      }),
      DEFAULT_OPENAI_API_SETTINGS,
    );
  });

  it('keeps supported language, trims prompt, clamps temperature, and ignores legacy prettify model', () => {
    assert.deepEqual(
      normalizeOpenAIApiSettings({
        language: 'ru',
        prettifyModel: '  gpt-5.5  ',
        prompt: '  domain vocabulary  ',
        temperature: 1.2,
      }),
      {
        model: OPENAI_API_SETTINGS_MODEL,
        language: 'ru',
        prompt: 'domain vocabulary',
        temperature: 1,
      },
    );

    assert.equal(normalizeTemperature(-0.5), 0);
    assert.equal(normalizeTemperature(0.337), 0.34);
  });

  it('sanitizes renderer settings without exposing an API key', () => {
    const sanitized = sanitizeOpenAIApiSettings(
      {
        apiKey: 'sk-secret',
        language: 'en',
        prompt: 'names',
        temperature: 0.1,
      },
      true,
    );

    assert.equal('apiKey' in sanitized, false);
    assert.deepEqual(sanitized, {
      hasApiKey: true,
      model: OPENAI_API_SETTINGS_MODEL,
      language: 'en',
      prompt: 'names',
      temperature: 0.1,
    });
  });

  it('updates API key only when a non-empty value is provided', () => {
    assert.equal(shouldUpdateApiKey('sk-test'), true);
    assert.equal(shouldUpdateApiKey('   '), false);
    assert.equal(shouldUpdateApiKey(undefined), false);
  });

  it('rejects malformed write payloads instead of silently replacing them with defaults', () => {
    assert.equal(getOpenAIApiSettingsInputError([]), 'OpenAI API settings must be an object');
    assert.equal(getOpenAIApiSettingsInputError({ apiKey: 42 }), 'OpenAI API key must be a string');
    assert.equal(
      getOpenAIApiSettingsInputError({ model: 'gpt-4o-transcribe' }),
      `Only ${OPENAI_API_SETTINGS_MODEL} is supported`,
    );
    assert.equal(getOpenAIApiSettingsInputError({ language: 'de' }), 'Select a supported transcription language');
    assert.equal(getOpenAIApiSettingsInputError({ temperature: 1.01 }), 'Temperature must be between 0 and 1');
  });
});
