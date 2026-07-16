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
    expect(markup).toContain('<a href="/gpt-voice/docs/">Documentation</a>');
    expect(markup).toMatch(/<footer[\s\S]*?<a href="\/gpt-voice\/docs\/">Documentation<\/a>[\s\S]*?<\/footer>/);
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

  it('renders the native English visual walkthrough without autoplay', () => {
    const markup = renderToStaticMarkup(<LandingPage content={englishContent} locale={getLocaleDefinition('en')} />);

    expect(markup).toContain('<video');
    expect(markup).toContain('controls=""');
    expect(markup).toContain('preload="none"');
    expect(markup).not.toContain('autoplay');
    expect(markup).toContain('/gpt-voice/generated/media/demo.mp4');
    expect(markup).toContain('/gpt-voice/generated/media/demo-poster.webp');
    expect(markup).toContain('data-demo-video="true"');
    expect(markup).toContain('kind="captions"');
    expect(markup).toContain('/gpt-voice/generated/captions/en.vtt');
    expect(markup).toContain('Read the visual walkthrough notes');
    expect(markup).toContain('data-demo-transcript="true"');
    expect(markup.match(/data-demo-visual-note="true"/g)).toHaveLength(9);
    expect(markup).toContain('GPT-Voice does not bypass quotas.');
    expect(markup).toContain('No compatibility or timing is promised.');
  });

  it('renders the SVG-reference provider signal map with branded cards and branched routes', () => {
    const markup = renderToStaticMarkup(<LandingPage content={englishContent} locale={getLocaleDefinition('en')} />);

    expect(markup).toContain('class="landing-section provider-section"');
    expect(markup).toContain('class="provider-signal-map"');
    expect(markup).toContain('class="provider-audio-input"');
    expect(markup).toContain('data-provider-waveform="recording"');
    expect(markup.match(/data-provider-waveform-bar="true"/g)).toHaveLength(31);
    expect(markup).toContain('class="provider-route-map"');
    expect(markup.match(/data-provider-route-arrow="true"/g)).toHaveLength(1);
    expect(markup.match(/data-provider-route-branch="current"/g)).toHaveLength(2);
    expect(markup.match(/data-provider-route-branch="future"/g)).toHaveLength(1);
    expect(markup).toContain('YOUR VOICE');
    expect(markup).toContain('ChatGPT Web');
    expect(markup).toContain('OpenAI API');
    expect(markup).toContain('FUTURE HORIZON · NOT AVAILABLE');
    expect(markup).toContain('/generated/icons/providers/openai.svg');
    expect(markup).toContain('/generated/icons/providers/claude.svg');
    expect(markup).toContain('/generated/icons/providers/gemini.svg');
  });

  it('keeps reveal targets visible by default in the static shell', () => {
    const markup = renderToStaticMarkup(<LandingPage content={englishContent} locale={getLocaleDefinition('en')} />);

    expect(markup.match(/data-landing-reveal="true"/g)).toHaveLength(7);
    expect(markup.match(/data-revealed="false"/g)).toHaveLength(7);
  });
});
