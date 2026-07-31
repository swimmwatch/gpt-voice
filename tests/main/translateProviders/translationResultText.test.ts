import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  matchTranslationResultLineEndings,
  normalizeTranslationResultText,
} from '@main/translateProviders/translationResultText';

describe('translation result text formatting', () => {
  it('normalizes provider EOLs without collapsing Markdown blank lines or indentation', () => {
    assert.equal(
      normalizeTranslationResultText('  # Heading\r\n\r\n- First\r\n  continuation  '),
      '  # Heading\n\n- First\n  continuation  ',
    );
  });

  it('preserves boundary whitespace that can carry Markdown formatting', () => {
    const formatted = '    indented code\n\nFinal line  \n';

    assert.equal(normalizeTranslationResultText(formatted), formatted);
  });

  it('restores the line-ending convention used by the source document', () => {
    const translatedText = '# Heading\n\n- First\n- Second';

    assert.equal(
      matchTranslationResultLineEndings('# Заголовок\r\n\r\n- Первый', translatedText),
      '# Heading\r\n\r\n- First\r\n- Second',
    );
    assert.equal(
      matchTranslationResultLineEndings('# Заголовок\r\r- Первый', translatedText),
      '# Heading\r\r- First\r- Second',
    );
    assert.equal(matchTranslationResultLineEndings('# Заголовок\n- Первый', translatedText), translatedText);
  });
});
