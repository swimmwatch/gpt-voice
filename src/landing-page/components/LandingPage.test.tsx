import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { englishContent, getLocaleDefinition } from '@landing/content';
import { LandingPage } from '@landing/components/LandingPage';

describe('LandingPage', () => {
  it('renders the complete English information architecture as semantic HTML', () => {
    const markup = renderToStaticMarkup(<LandingPage content={englishContent} locale={getLocaleDefinition('en')} />);

    expect(markup).toContain('<header class="site-header">');
    expect(markup).toContain('<main id="main-content" tabindex="-1">');
    expect(markup).toContain('<footer class="site-footer"');
    expect(markup).toContain('<h1 id="hero-title">Write better AI prompts faster.</h1>');
    expect(markup).toContain('See the complete workflow.');
    expect(markup).toContain('Three steps to better prompts, faster.');
    expect(markup).toContain('Two ways to turn speech into prompts.');
    expect(markup).toContain('How GPT-Voice works.');
  });

  it('renders the approved hero capture as a responsive, non-interactive image', () => {
    const markup = renderToStaticMarkup(<LandingPage content={englishContent} locale={getLocaleDefinition('en')} />);

    expect(markup).toContain('class="landing-section hero-section"');
    expect(markup).toContain('class="hero-screenshot-frame"');
    expect(markup).toContain('type="image/avif"');
    expect(markup).toContain('/gpt-voice/generated/media/app-main.avif');
    expect(markup).toContain('type="image/webp"');
    expect(markup).toContain('/gpt-voice/generated/media/app-main.webp');
    expect(markup).toContain('/gpt-voice/generated/media/app-main.png');
    expect(markup).toContain('height="840"');
    expect(markup).toContain('width="920"');
  });

  it('renders an accessible video placeholder until the approved demo media is available', () => {
    const markup = renderToStaticMarkup(<LandingPage content={englishContent} locale={getLocaleDefinition('en')} />);

    expect(markup).toContain('data-demo-placeholder="true"');
    expect(markup).toContain('Full product demo coming soon.');
    expect(markup).not.toContain('<video');
    expect(markup).not.toContain('/gpt-voice/generated/media/demo.mp4');
    expect(markup).not.toContain('/gpt-voice/generated/captions/en.vtt');
    expect(markup).toContain('GPT-Voice does not bypass quotas.');
    expect(markup).toContain('No compatibility or timing is promised.');
  });

  it('keeps reveal targets visible by default in the static shell', () => {
    const markup = renderToStaticMarkup(<LandingPage content={englishContent} locale={getLocaleDefinition('en')} />);

    expect(markup.match(/data-landing-reveal="true"/g)).toHaveLength(6);
    expect(markup.match(/data-revealed="false"/g)).toHaveLength(6);
  });
});
