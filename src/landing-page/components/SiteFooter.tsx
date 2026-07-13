import * as React from 'react';

import { Separator } from './ui/separator';
import type { LandingContent } from '../content/schema';

type SiteFooterProps = {
  content: LandingContent['footer'];
  links: LandingContent['links'];
};

export function SiteFooter({ content, links }: SiteFooterProps): React.JSX.Element {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <Separator />
        <div className="site-footer-content">
          <div className="site-footer-brand">
            <div>
              <p>{content.brand}</p>
              <p>{content.description}</p>
            </div>
          </div>
          <nav aria-label={content.brand} className="site-footer-links">
            {content.links.map((link) => (
              <a href={links[link.href]} key={link.href}>
                {link.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="site-footer-meta">
          <p>{content.disclaimer}</p>
          <p>{content.copyright}</p>
        </div>
      </div>
    </footer>
  );
}
