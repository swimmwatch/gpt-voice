import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getLocalWhisperLanguageEntry,
  isLocalWhisperLanguageId,
  LOCAL_WHISPER_LANGUAGE_CATALOG,
  LOCAL_WHISPER_LANGUAGE_CATALOG_REVISION,
  mapLocalWhisperLanguageForWhisperCpp,
} from '@shared/localWhisper';

describe('Local Whisper common language catalog', () => {
  it('pins one versioned multilingual intersection with auto detection', () => {
    assert.equal(LOCAL_WHISPER_LANGUAGE_CATALOG_REVISION, 'local-whisper-languages-v1');
    assert.equal(LOCAL_WHISPER_LANGUAGE_CATALOG[0]?.id, 'auto');
    assert.equal(LOCAL_WHISPER_LANGUAGE_CATALOG.length, 101);
    assert.equal(new Set(LOCAL_WHISPER_LANGUAGE_CATALOG.map(({ id }) => id)).size, 101);
  });

  it('enumerates every entry through the explicit Whisper.cpp mapping', () => {
    for (const entry of LOCAL_WHISPER_LANGUAGE_CATALOG) {
      assert.equal(isLocalWhisperLanguageId(entry.id), true);
      assert.equal(getLocalWhisperLanguageEntry(entry.id), entry);
      assert.equal(mapLocalWhisperLanguageForWhisperCpp(entry.id), entry.whisperCpp);
      assert.equal(entry.labelKey, `localWhisper.language.${entry.id}`);
    }
    assert.equal(mapLocalWhisperLanguageForWhisperCpp('auto'), 'auto');
  });

  it('rejects unknown, localized, and engine-specific aliases', () => {
    for (const value of ['', 'EN', 'english', 'auto-detect', 'zh-CN', 'pt-BR', null, 1]) {
      assert.equal(isLocalWhisperLanguageId(value), false);
      assert.equal(getLocalWhisperLanguageEntry(value), undefined);
      assert.equal(mapLocalWhisperLanguageForWhisperCpp(value), undefined);
    }
  });
});
