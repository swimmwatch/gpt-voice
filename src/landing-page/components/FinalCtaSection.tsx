import * as React from 'react';

import { Button } from './ui/button';
import type { LandingContent } from '../content/schema';

type FinalCtaSectionProps = {
  content: LandingContent['finalCta'];
  links: LandingContent['links'];
};

export function FinalCtaSection({ content, links }: FinalCtaSectionProps): React.JSX.Element {
  return (
    <section
      className="landing-section final-cta-section"
      aria-labelledby="final-cta-title"
      data-landing-reveal
      data-revealed="false"
    >
      <div className="final-cta-surface">
        <h2 id="final-cta-title">{content.title}</h2>
        <p className="landing-lead">{content.lead}</p>
        <div className="final-cta-actions">
          <Button asChild size="lg">
            <a href={links.latestRelease}>{content.primaryCta}</a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href={links.repository}>{content.secondaryCta}</a>
          </Button>
        </div>
        <p className="final-cta-license">{content.licenseNote}</p>
      </div>
    </section>
  );
}
