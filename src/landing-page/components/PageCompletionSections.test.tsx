import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { LandingPage } from './LandingPage';
import { englishContent, getLocaleDefinition } from '../content';

describe('LandingPage completion sections', () => {
  it('renders the final prompt-first CTA inside main before the factual footer', () => {
    const markup = renderToStaticMarkup(<LandingPage content={englishContent} locale={getLocaleDefinition('en')} />);

    expect(markup).toContain('class="landing-section final-cta-section"');
    expect(markup).toContain('Write better prompts faster, with less effort.');
    expect(markup).toContain('https://github.com/swimmwatch/gpt-voice/releases/latest');
    expect(markup).toContain('https://github.com/swimmwatch/gpt-voice');
    expect(markup.indexOf('final-cta-section')).toBeLessThan(markup.indexOf('<footer class="site-footer"'));
  });

  it('keeps the four descriptive footer destinations and independence disclaimer', () => {
    const markup = renderToStaticMarkup(<LandingPage content={englishContent} locale={getLocaleDefinition('en')} />);

    expect(markup).toContain('>Releases</a>');
    expect(markup).toContain('>Repository</a>');
    expect(markup).toContain('>Issues</a>');
    expect(markup).toContain('>License</a>');
    expect(markup).toContain('Independent project. Not affiliated with OpenAI, Anthropic, or Google.');
    expect(markup).not.toContain('LinkedIn');
  });
});
