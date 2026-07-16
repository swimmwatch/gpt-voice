import * as React from 'react';

import type { LandingContent } from '../content/schema';
import { footerWaveformBars, getVoiceWaveformBarStyle } from './voice-waveform';

type SiteFooterProps = {
  content: LandingContent['footer'];
  links: LandingContent['links'];
};

export function SiteFooter({ content, links }: SiteFooterProps): React.JSX.Element {
  return (
    <footer className="site-footer" data-landing-reveal data-revealed="false">
      <div className="site-footer-inner">
        <div className="site-footer-content">
          <div className="site-footer-brand">
            <img
              alt=""
              aria-hidden="true"
              className="site-footer-logo"
              height="80"
              loading="lazy"
              src="/gpt-voice/generated/icons/gpt-voice.png"
              width="80"
            />
            <div className="site-footer-brand-copy">
              <p className="site-footer-title">{content.brand}</p>
              <p className="site-footer-description">{content.description}</p>
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
        <div aria-hidden="true" className="site-footer-signal">
          <div className="site-footer-waveform" data-footer-waveform="recording">
            {footerWaveformBars.map(({ amplitude, id }, index) => (
              <span
                data-footer-waveform-bar="true"
                key={id}
                style={getVoiceWaveformBarStyle({ amplitude, heightScale: 2.1, index, offsetStep: 8 })}
              />
            ))}
          </div>
        </div>
        <div className="site-footer-meta">
          <p>{content.disclaimer}</p>
          <p>{content.copyright}</p>
        </div>
      </div>
    </footer>
  );
}
