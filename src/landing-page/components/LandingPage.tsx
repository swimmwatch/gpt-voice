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
import type { LandingContent, LandingLocaleDefinition, ProviderRoute } from '../content/schema';
import { getVoiceWaveformBarStyle, voiceWaveformBars } from './voice-waveform';

type LandingPageProps = {
  content: LandingContent;
  locale: LandingLocaleDefinition;
};

const providerLogoFiles: Record<string, string> = {
  'ChatGPT Web': 'openai.svg',
  'Claude Web': 'claude.svg',
  'Gemini Web': 'gemini.svg',
  'OpenAI API': 'openai.svg',
};

const providerRoutePulseDelays = [0, -0.52, -1.04] as const;

type ProviderRouteGeometry = {
  apiY: number;
  currentY: number;
  futureY: number;
  height: number;
  inputY: number;
  width: number;
};

const defaultProviderRouteGeometry: ProviderRouteGeometry = {
  apiY: 307.2,
  currentY: 92.16,
  futureY: 460.8,
  height: 512,
  inputY: 256,
  width: 80,
};

function roundRouteCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}

function routeTargetCenter(target: HTMLElement, mapRect: DOMRect): number {
  const targetRect = target.getBoundingClientRect();
  return roundRouteCoordinate(targetRect.top + targetRect.height / 2 - mapRect.top);
}

function buildProviderRoutePaths({ apiY, currentY, futureY, height, inputY, width }: ProviderRouteGeometry) {
  const junctionX = roundRouteCoordinate(width / 2);

  return {
    api: `M0 ${inputY}H${junctionX}V${apiY}H${width}`,
    current: `M0 ${inputY}H${junctionX}V${currentY}H${width}`,
    future: `M${junctionX} ${apiY}V${futureY}H${width}`,
    viewBox: `0 0 ${width} ${height}`,
  };
}

function Shortcut({ action, keys }: { action: string; keys: readonly string[] }): React.JSX.Element {
  return (
    <span className="hero-shortcut">
      <KbdGroup aria-label={action}>
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
        <div aria-label={content.hero.shortcutsLabel} className="hero-shortcuts">
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

function Demo({ content, locale }: Pick<LandingPageProps, 'content' | 'locale'>): React.JSX.Element {
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
        <AspectRatio className="demo-video-frame" ratio={16 / 9}>
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
              src={locale.captions}
              srcLang={locale.tag}
            />
            {content.demo.videoUnsupported}
          </video>
        </AspectRatio>
        <p className="demo-supporting-note" id="demo-note">
          {content.demo.supportingNote}
        </p>
      </div>
    </section>
  );
}

function ProviderAudioInput({ content }: Pick<LandingPageProps, 'content'>): React.JSX.Element {
  return (
    <div className="provider-audio-input" data-provider-route-target="input">
      <div aria-hidden="true" className="provider-microphone">
        <Mic strokeWidth={1.75} />
      </div>
      <div aria-hidden="true" className="provider-waveform" data-provider-waveform="recording">
        {voiceWaveformBars.map(({ amplitude, id }, index) => (
          <span data-provider-waveform-bar="true" key={id} style={getVoiceWaveformBarStyle({ amplitude, index })} />
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

function ProviderCard({
  provider,
  requirementsLabel,
}: {
  provider: ProviderRoute;
  requirementsLabel: string;
}): React.JSX.Element {
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
        <ul aria-label={`${provider.provider} ${requirementsLabel}`} className="provider-facts">
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

/** Draws responsive connector paths and animated pulses between the voice input and provider cards. */
function ProviderRouteMap(): React.JSX.Element {
  const mapRef = React.useRef<HTMLDivElement>(null);
  const [geometry, setGeometry] = React.useState(defaultProviderRouteGeometry);
  const paths = buildProviderRoutePaths(geometry);

  React.useEffect(() => {
    const map = mapRef.current;
    const signalMap = map?.parentElement;
    if (!map || !signalMap) return undefined;

    const input = signalMap.querySelector<HTMLElement>('[data-provider-route-target="input"]');
    const chatGpt = signalMap.querySelector<HTMLElement>('[data-provider-route-target="chatgpt"]');
    const api = signalMap.querySelector<HTMLElement>('[data-provider-route-target="api"]');
    const future = signalMap.querySelector<HTMLElement>('[data-provider-route-target="future"]');

    if (!input || !chatGpt || !api || !future) return undefined;
    const updateGeometry = () => {
      const mapRect = map.getBoundingClientRect();
      if (mapRect.width === 0 || mapRect.height === 0) return;

      const nextGeometry: ProviderRouteGeometry = {
        apiY: routeTargetCenter(api, mapRect),
        currentY: routeTargetCenter(chatGpt, mapRect),
        futureY: routeTargetCenter(future, mapRect),
        height: roundRouteCoordinate(mapRect.height),
        inputY: routeTargetCenter(input, mapRect),
        width: roundRouteCoordinate(mapRect.width),
      };

      setGeometry((previousGeometry) =>
        Object.entries(nextGeometry).every(
          ([key, value]) => previousGeometry[key as keyof ProviderRouteGeometry] === value,
        )
          ? previousGeometry
          : nextGeometry,
      );
    };

    const resizeObserver = new ResizeObserver(updateGeometry);
    [map, input, chatGpt, api, future].forEach((element) => resizeObserver.observe(element));
    const animationFrame = window.requestAnimationFrame(updateGeometry);
    window.addEventListener('resize', updateGeometry);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', updateGeometry);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div aria-hidden="true" className="provider-route-map" ref={mapRef}>
      <span className="provider-route-line provider-route-input" data-provider-route-input="true" />
      <span className="provider-route-line provider-route-current" data-provider-route-branch="current" />
      <span className="provider-route-line provider-route-api" data-provider-route-branch="current" />
      <span className="provider-route-line provider-route-future" data-provider-route-branch="future" />
      <svg className="provider-route-pulses" focusable="false" preserveAspectRatio="none" viewBox={paths.viewBox}>
        <path className="provider-route-vector" d={paths.current} data-provider-route-path="chatgpt" />
        <path className="provider-route-vector" d={paths.api} data-provider-route-path="api" />
        <path
          className="provider-route-vector provider-route-vector-future"
          d={paths.future}
          data-provider-route-path="future"
        />
        {providerRoutePulseDelays.map((delay) => (
          <React.Fragment key={delay}>
            <circle className="provider-route-pulse" cx="0" cy="0" r="3">
              <animateMotion begin={`${delay}s`} dur="1.56s" path={paths.current} repeatCount="indefinite" />
            </circle>
            <circle className="provider-route-pulse" cx="0" cy="0" r="3">
              <animateMotion begin={`${delay}s`} dur="1.56s" path={paths.api} repeatCount="indefinite" />
            </circle>
          </React.Fragment>
        ))}
      </svg>
    </div>
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
        <ProviderRouteMap />
        <div className="provider-routes">
          <div data-provider-route-target="chatgpt">
            <ProviderCard
              provider={content.providers.chatGptWeb}
              requirementsLabel={content.providers.requirementsLabel}
            />
          </div>
          <div data-provider-route-target="api">
            <ProviderCard
              provider={content.providers.openAiApi}
              requirementsLabel={content.providers.requirementsLabel}
            />
          </div>
          <aside
            aria-label={content.providers.future.blockLabel}
            className="provider-future-horizon"
            data-provider-route-target="future"
          >
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

function LandingLoader(): React.JSX.Element {
  return (
    <div aria-hidden="true" className="landing-loader" data-landing-loader="true">
      <div className="landing-loader-mark">
        <img
          alt=""
          className="landing-loader-logo"
          height="72"
          src="/gpt-voice/generated/icons/gpt-voice.png"
          width="72"
        />
        <div className="landing-loader-wave">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}

export function LandingPage({ content, locale }: LandingPageProps): React.JSX.Element {
  return (
    <>
      <LandingLoader />
      <SiteHeader
        brandDescription={content.footer.description}
        content={content.navigation}
        links={content.links}
        locale={locale}
      />
      <main id="main-content" tabIndex={-1}>
        <Hero content={content} />
        <Demo content={content} locale={locale} />
        <HowItWorksSection content={content.workflow} />
        <Providers content={content} />
        <FaqSection content={content.faq} />
        <FinalCtaSection content={content.finalCta} links={content.links} />
      </main>
      <SiteFooter content={content.footer} links={content.links} />
    </>
  );
}
