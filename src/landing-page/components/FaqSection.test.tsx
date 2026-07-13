import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { FaqSection } from './FaqSection';
import { englishContent } from '../content';

describe('FaqSection', () => {
  it('keeps all twelve functional answers in the static HTML', () => {
    const markup = renderToStaticMarkup(<FaqSection content={englishContent.faq} />);

    expect(markup.match(/data-slot="accordion-item"/g)).toHaveLength(12);
    expect(markup).toContain('How do I record and transcribe speech?');
    expect(markup).toContain('Which app languages, operating systems, and package formats are supported?');
    expect(markup).toContain('Press F9 to start recording.');
    expect(markup).toContain('macOS downloads are not promoted');
  });
});
