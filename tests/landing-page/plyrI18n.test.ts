import assert from 'node:assert/strict';
import test from 'node:test';

import { getPlyrLabels, plyrLabelsByLocale } from '../../src/landing-page/plyr-i18n';
import { supportedLocales } from '../../src/landing-page/content';

test('provides localized labels for every enhanced video control', () => {
  const requiredLabels = [
    'captions',
    'enterFullscreen',
    'exitFullscreen',
    'mute',
    'normal',
    'pause',
    'pip',
    'play',
    'settings',
    'speed',
    'unmute',
    'volume',
  ] as const;

  assert.deepEqual(Object.keys(plyrLabelsByLocale).sort(), [...supportedLocales].sort());
  for (const locale of supportedLocales) {
    const labels = getPlyrLabels(locale);
    for (const label of requiredLabels) {
      assert.ok(labels[label].trim().length > 0, `${locale} requires a ${label} player label.`);
    }
  }
  assert.equal(getPlyrLabels('unsupported'), plyrLabelsByLocale.en);
});
