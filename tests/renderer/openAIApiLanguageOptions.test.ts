import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getOpenAIApiLanguageOptions } from '@renderer/openAIApiLanguageOptions';
import {
  filterSearchableSelectOptions,
  getSearchableSelectDisplayValue,
} from '@renderer/components/SearchableSelectInput';
import { OPENAI_API_TRANSCRIPTION_LANGUAGES } from '@shared/openaiApiTranscription';

describe('OpenAI API language options', () => {
  it('includes every supported language once with auto first', () => {
    const options = getOpenAIApiLanguageOptions('en', 'Automatic');

    assert.equal(options[0]?.value, 'auto');
    assert.equal(options[0]?.label, 'Automatic');
    assert.equal(options.length, OPENAI_API_TRANSCRIPTION_LANGUAGES.length);
    assert.equal(new Set(options.map((option) => option.value)).size, options.length);
    assert.ok(options.every((option) => option.label.length > 0));
  });

  it('searches by localized name or ISO-639-1 code and displays the selected name', () => {
    const options = getOpenAIApiLanguageOptions('en', 'Auto');
    const german = options.find((option) => option.value === 'de');

    assert.ok(german);
    assert.deepEqual(filterSearchableSelectOptions(options, 'German'), [german]);
    assert.deepEqual(filterSearchableSelectOptions(options, 'de'), [german]);
    assert.equal(getSearchableSelectDisplayValue(options, 'de'), german.label);
  });
});
