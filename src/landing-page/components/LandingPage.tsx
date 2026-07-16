import { AudioWaveform, Database, KeyRound, Mic, UserRound } from 'lucide-react';
import { FaqSection } from './FaqSection';
import { FinalCtaSection } from './FinalCtaSection';
import { HowItWorksSection } from './HowItWorksSection';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';
import * as React from 'react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { AspectRatio } from './ui/aspect-ratio';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader } from './ui/card';
import { Kbd, KbdGroup } from './ui/kbd';
import { Separator } from './ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import type { LandingContent, LandingLocaleDefinition, ProviderRoute } from '../content/schema';

type LandingPageProps = {
  content: LandingContent;
  locale: LandingLocaleDefinition;
};

const providerWaveformBars = [
  { amplitude: 6, id: '01' },
  { amplitude: 8, id: '02' },
  { amplitude: 7, id: '03' },
  { amplitude: 10, id: '04' },
  { amplitude: 12, id: '05' },
  { amplitude: 9, id: '06' },
  { amplitude: 14, id: '07' },
  { amplitude: 18, id: '08' },
  { amplitude: 13, id: '09' },
  { amplitude: 20, id: '10' },
  { amplitude: 16, id: '11' },
  { amplitude: 22, id: '12' },
  { amplitude: 18, id: '13' },
  { amplitude: 24, id: '14' },
  { amplitude: 21, id: '15' },
  { amplitude: 28, id: '16' },
  { amplitude: 24, id: '17' },
  { amplitude: 19, id: '18' },
  { amplitude: 23, id: '19' },
  { amplitude: 17, id: '20' },
  { amplitude: 21, id: '21' },
  { amplitude: 15, id: '22' },
  { amplitude: 18, id: '23' },
  { amplitude: 13, id: '24' },
  { amplitude: 15, id: '25' },
  { amplitude: 10, id: '26' },
  { amplitude: 12, id: '27' },
  { amplitude: 9, id: '28' },
  { amplitude: 10, id: '29' },
  { amplitude: 7, id: '30' },
  { amplitude: 6, id: '31' },
] as const;

const providerLogoFiles: Record<string, string> = {
  'ChatGPT Web': 'openai.svg',
  'Claude Web': 'claude.svg',
  'Gemini Web': 'gemini.svg',
  'OpenAI API': 'openai.svg',
};

function Shortcut({ action, keys }: { action: string; keys: readonly string[] }): React.JSX.Element {
  return (
    <span className="hero-shortcut">
      <KbdGroup aria-label={`${action} shortcut`}>
        {keys.map((key) => (
          <Kbd key={key}>{key}</Kbd>
        ))}
      </KbdGroup>
      <span>{action}</span>
    </span>
  );
}

function Hero({ content }: Pick<LandingPageProps, 'content'>): React.JSX.Element {
  return (
    <section
      aria-labelledby="hero-title"
      className="landing-section hero-section"
      data-landing-reveal
      data-revealed="false"
    >
      <div className="hero-copy">
        <Badge>{content.hero.badge}</Badge>
        <h1 id="hero-title">{content.hero.title}</h1>
        <p className="hero-lead">{content.hero.lead}</p>
        <div className="hero-actions">
          <Button asChild>
            <a href={content.links.latestRelease}>{content.hero.primaryCta}</a>
          </Button>
          <Button asChild variant="outline">
            <a href={content.links.repository}>{content.hero.secondaryCta}</a>
          </Button>
        </div>
        <div aria-label="Keyboard shortcuts" className="hero-shortcuts">
          {content.hero.shortcuts.map((shortcut) => (
            <Shortcut key={shortcut.action} {...shortcut} />
          ))}
        </div>
      </div>
      <div className="hero-screenshot-frame">
        <AspectRatio ratio={19 / 18}>
          <picture>
            <source srcSet="/gpt-voice/generated/media/app-main.avif" type="image/avif" />
            <source srcSet="/gpt-voice/generated/media/app-main.webp" type="image/webp" />
            <img
              alt={content.hero.screenshotAlt}
              decoding="async"
              fetchPriority="high"
              height="840"
              src="/gpt-voice/generated/media/app-main.png"
              width="920"
            />
          </picture>
        </AspectRatio>
      </div>
    </section>
  );
}

function Demo({ content }: Pick<LandingPageProps, 'content'>): React.JSX.Element {
  return (
    <section
      aria-labelledby="demo-title"
      className="landing-section demo-section"
      data-landing-reveal
      data-revealed="false"
      id="demo"
    >
      <div className="demo-heading">
        <p className="landing-eyebrow">{content.demo.eyebrow}</p>
        <h2 id="demo-title">{content.demo.title}</h2>
        <p className="landing-lead">{content.demo.lead}</p>
      </div>
      <div className="demo-media">
        <AspectRatio ratio={16 / 9}>
          <video
            aria-describedby="demo-note"
            aria-label={content.demo.videoLabel}
            className="demo-video"
            controls
            data-demo-video="true"
            data-poster="/gpt-voice/generated/media/demo-poster.webp"
            height="1080"
            playsInline
            poster="/gpt-voice/generated/media/demo-poster.webp"
            preload="none"
            width="1920"
          >
            <source src="/gpt-voice/generated/media/demo.mp4" type="video/mp4" />
            <track
              default
              kind="captions"
              label={content.demo.captionTrackLabel}
              src="/gpt-voice/generated/captions/en.vtt"
              srcLang="en"
            />
            Your browser does not support HTML video. Read the visual walkthrough notes below.
          </video>
        </AspectRatio>
        <p className="demo-supporting-note" id="demo-note">
          {content.demo.supportingNote}
        </p>
        <Accordion className="demo-transcript" collapsible data-demo-transcript="true" type="single">
          <AccordionItem value="visual-walkthrough">
            <AccordionTrigger>{content.demo.transcriptControl}</AccordionTrigger>
            <AccordionContent>
              <p>{content.demo.summary}</p>
              <ol>
                {content.demo.transcriptCues.map((cue) => (
                  <li data-demo-visual-note="true" key={cue.id}>
                    {cue.visualDescription}
                  </li>
                ))}
              </ol>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </section>
  );
}

function ProviderAudioInput({ content }: Pick<LandingPageProps, 'content'>): React.JSX.Element {
  return (
    <div className="provider-audio-input">
      <div aria-hidden="true" className="provider-microphone">
        <Mic strokeWidth={1.75} />
      </div>
      <div aria-hidden="true" className="provider-waveform" data-provider-waveform="recording">
        {providerWaveformBars.map(({ amplitude, id }, index) => (
          <span
            data-provider-waveform-bar="true"
            key={id}
            style={
              {
                '--provider-wave-delay': `${-(index * 83)}ms`,
                '--provider-wave-duration': `${700 + (index % 5) * 90}ms`,
                '--provider-wave-height': `${amplitude}px`,
                '--provider-wave-offset': `${-(index * 3)}px`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
      <div className="provider-audio-labels">
        <strong>{content.providers.inputNode}</strong>
        <span>{content.providers.inputDetail}</span>
      </div>
    </div>
  );
}

function ProviderLogo({ provider }: { provider: string }): React.JSX.Element | null {
  const fileName = providerLogoFiles[provider];

  if (!fileName) {
    return null;
  }

  return (
    <span aria-hidden="true" className="provider-logo">
      <img alt="" height="36" src={`/gpt-voice/generated/icons/providers/${fileName}`} width="36" />
    </span>
  );
}

function ProviderFactIcon({ fact }: { fact: string }): React.JSX.Element | null {
  const className = 'provider-fact-icon';

  switch (fact) {
    case 'Subscription':
      return <UserRound aria-hidden="true" className={className} />;
    case 'Saved session':
      return <Database aria-hidden="true" className={className} />;
    case 'No API key':
    case 'API key + billing/quota':
      return <KeyRound aria-hidden="true" className={className} />;
    case 'whisper-1':
      return <AudioWaveform aria-hidden="true" className={className} />;
    default:
      return null;
  }
}

function ProviderCard({ provider }: { provider: ProviderRoute }): React.JSX.Element {
  return (
    <Card className="provider-card provider-card-current">
      <CardHeader className="provider-card-header">
        <div className="provider-card-identity">
          <ProviderLogo provider={provider.provider} />
          <h3>{provider.provider}</h3>
        </div>
        <Badge>{provider.status}</Badge>
      </CardHeader>
      <CardContent className="provider-card-content">
        <ul aria-label={`${provider.provider} requirements`} className="provider-facts">
          {provider.facts.map((fact) => (
            <li key={fact}>
              <ProviderFactIcon fact={fact} />
              {fact}
            </li>
          ))}
        </ul>
        {provider.claim ? <p className="provider-claim">{provider.claim}</p> : null}
        {provider.qualification ? (
          <>
            <Separator />
            <Alert className="provider-qualification" variant="warning">
              <AlertTitle>{provider.provider}</AlertTitle>
              <AlertDescription>{provider.qualification}</AlertDescription>
            </Alert>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Providers({ content }: Pick<LandingPageProps, 'content'>): React.JSX.Element {
  return (
    <section
      aria-labelledby="providers-title"
      className="landing-section provider-section"
      data-landing-reveal
      data-revealed="false"
      id="providers"
    >
      <div className="provider-heading">
        <p className="landing-eyebrow">{content.providers.eyebrow}</p>
        <h2 id="providers-title">{content.providers.title}</h2>
        <p className="landing-lead">{content.providers.lead}</p>
        <div aria-label={content.providers.groupDescription} className="provider-legend">
          <span>
            <i className="provider-route-key provider-route-key-current" />
            {content.providers.availableNow}
          </span>
          <span>
            <i className="provider-route-key provider-route-key-future" />
            {content.providers.futureRouteLegend}
          </span>
        </div>
      </div>
      <div aria-label={content.providers.groupDescription} className="provider-signal-map">
        <ProviderAudioInput content={content} />
        <div aria-hidden="true" className="provider-route-map">
          <span className="provider-route-line provider-route-input" data-provider-route-arrow="true" />
          <span className="provider-route-line provider-route-current" data-provider-route-branch="current" />
          <span className="provider-route-line provider-route-api" data-provider-route-branch="current" />
          <span className="provider-route-line provider-route-future" data-provider-route-branch="future" />
          <i className="provider-route-junction" />
        </div>
        <div className="provider-routes">
          <ProviderCard provider={content.providers.chatGptWeb} />
          <ProviderCard provider={content.providers.openAiApi} />
          <aside aria-label={content.providers.future.blockLabel} className="provider-future-horizon">
            <p>{content.providers.future.blockLabel}</p>
            <ul>
              {content.providers.future.providers.map((provider) => (
                <li key={provider.provider}>
                  <ProviderLogo provider={provider.provider} />
                  <strong>{provider.provider}</strong>
                  <span>{provider.status}</span>
                </li>
              ))}
            </ul>
            <p>{content.providers.future.longerTermCopy}</p>
            <p>{content.providers.future.qualification}</p>
            <p>{content.providers.future.independenceNote}</p>
          </aside>
        </div>
      </div>
    </section>
  );
}

export function LandingPage({ content, locale }: LandingPageProps): React.JSX.Element {
  return (
    <>
      <SiteHeader content={content.navigation} links={content.links} locale={locale} />
      <main id="main-content" tabIndex={-1}>
        <Hero content={content} />
        <Demo content={content} />
        <HowItWorksSection content={content.workflow} />
        <Providers content={content} />
        <FaqSection content={content.faq} />
        <FinalCtaSection content={content.finalCta} links={content.links} />
      </main>
      <SiteFooter content={content.footer} links={content.links} />
    </>
  );
}
