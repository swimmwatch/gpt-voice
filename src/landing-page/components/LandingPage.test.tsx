import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { englishContent, getLocaleDefinition } from '@landing/content';
import { LandingPage } from '@landing/components/LandingPage';

describe('LandingPage', () => {
  it('renders the complete English information architecture as semantic HTML', () => {
    const markup = renderToStaticMarkup(<LandingPage content={englishContent} locale={getLocaleDefinition('en')} />);

    expect(markup).toContain('<header>');
    expect(markup).toContain('<main id="main-content" tabindex="-1">');
    expect(markup).toContain('<footer>');
    expect(markup).toContain('<h1 id="hero-title">Write better AI prompts faster.</h1>');
    expect(markup).toContain('See the complete workflow.');
    expect(markup).toContain('Three steps to better prompts, faster.');
    expect(markup).toContain('Two ways to turn speech into prompts.');
    expect(markup).toContain('How GPT-Voice works.');
  });

  it('keeps static video, captions, transcripts, and qualified provider facts in the initial HTML', () => {
    const markup = renderToStaticMarkup(<LandingPage content={englishContent} locale={getLocaleDefinition('en')} />);

    expect(markup).toContain('preload="none"');
    expect(markup).toContain('/gpt-voice/generated/media/demo.mp4');
    expect(markup).toContain('/gpt-voice/generated/captions/en.vtt');
    expect(markup).toContain('Writing prompts for AI agents and assistants is work.');
    expect(markup).toContain('GPT-Voice does not bypass quotas.');
    expect(markup).toContain('No compatibility or timing is promised.');
  });
});
