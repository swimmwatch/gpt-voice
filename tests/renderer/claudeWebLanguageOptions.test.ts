import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getClaudeWebLanguageOptions } from '@renderer/claudeWebLanguageOptions';
import {
  filterSearchableSelectOptions,
  getSearchableSelectDisplayValue,
} from '@renderer/components/SearchableSelectInput';

describe('Claude Web language options', () => {
  it('prioritizes saved and suggested canonical tags without duplicates', () => {
    const options = getClaudeWebLanguageOptions('en', ['fr-ca', 'en-us', 'invalid locale']);

    assert.equal(options[0]?.value, 'fr-CA');
    assert.equal(options[1]?.value, 'en-US');
    assert.equal(options.filter((option) => option.value === 'en-US').length, 1);
    assert.equal(
      options.some((option) => option.value === 'invalid locale'),
      false,
    );
    assert.ok(options.every((option) => option.label.length > 0));
  });

  it('searches localized names and BCP-47 tags case- and accent-insensitively', () => {
    const options = [
      { label: 'English (United States)', value: 'en-US' },
      { label: 'Français (Canada)', value: 'fr-CA' },
      { label: 'Українська', value: 'uk' },
    ];

    assert.deepEqual(filterSearchableSelectOptions(options, 'english us'), [options[0]]);
    assert.deepEqual(filterSearchableSelectOptions(options, 'francais'), [options[1]]);
    assert.deepEqual(filterSearchableSelectOptions(options, 'FR-ca'), [options[1]]);
    assert.deepEqual(filterSearchableSelectOptions(options, 'missing'), []);
  });

  it('displays the language name while retaining the BCP-47 value', () => {
    const options = [
      { label: 'American English', value: 'en-US' },
      { label: 'Russian', value: 'ru' },
    ];

    assert.equal(getSearchableSelectDisplayValue(options, 'ru'), 'Russian');
    assert.equal(getSearchableSelectDisplayValue(options, 'en-US'), 'American English');
    assert.equal(getSearchableSelectDisplayValue(options, 'x-custom'), 'x-custom');
  });
});
