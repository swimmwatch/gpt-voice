import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { HowItWorksSection } from './HowItWorksSection';
import { englishContent } from '../content';

describe('HowItWorksSection', () => {
  it('keeps Retry as an unnumbered provider-error branch between the ordered primary steps', () => {
    const markup = renderToStaticMarkup(<HowItWorksSection content={englishContent.workflow} />);

    expect(markup.match(/data-workflow-step=/g)).toHaveLength(3);
    expect(markup).toContain('data-workflow-step="transcribe"');
    expect(markup).toContain('data-workflow-step="translate"');
    expect(markup).toContain('data-workflow-step="prettify"');
    expect(markup).toContain('class="workflow-retry"');
    expect(markup).not.toContain('role="note"');
    expect(markup).toContain('OPTIONAL · PROVIDER ERROR');
    expect(markup).toContain('Only if the voice provider returns an error.');
    expect(markup.indexOf('data-workflow-step="transcribe"')).toBeLessThan(markup.indexOf('workflow-retry'));
    expect(markup.indexOf('workflow-retry')).toBeLessThan(markup.indexOf('data-workflow-step="translate"'));
  });

  it('renders factual keyboard proof and the clear-model-input benefits without expanding into cards', () => {
    const markup = renderToStaticMarkup(<HowItWorksSection content={englishContent.workflow} />);

    expect(markup).toContain('F9');
    expect(markup).toContain('Ctrl+F8');
    expect(markup).toContain('F11');
    expect(markup).toContain('F12');
    expect(markup).toContain('Convert your prompt into the language the model handles best');
    expect(markup).toContain('Remove grammar errors, repetition, and filler');
    expect(markup).not.toContain('data-slot="card"');
  });
});
