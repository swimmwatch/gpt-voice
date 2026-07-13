import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import * as React from 'react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { AspectRatio } from './ui/aspect-ratio';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Kbd, KbdGroup } from './ui/kbd';
import { Separator } from './ui/separator';
import type { LandingContent, LandingLocaleDefinition } from '../content/schema';

type LandingPageProps = {
  content: LandingContent;
  locale: LandingLocaleDefinition;
};

function Shortcut({ action, keys }: { action: string; keys: readonly string[] }): React.JSX.Element {
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <KbdGroup aria-label={`${action} shortcut`}>
        {keys.map((key) => (
          <Kbd key={key}>{key}</Kbd>
        ))}
      </KbdGroup>
      <span>{action}</span>
    </span>
  );
}

function Header({ content }: Pick<LandingPageProps, 'content'>): React.JSX.Element {
  return (
    <header>
      <a href="/gpt-voice/">{content.navigation.brand}</a>
      <nav aria-label={content.navigation.mobileMenu}>
        <a href="#providers">{content.navigation.providers}</a>
        <a href="#how-it-works">{content.navigation.howItWorks}</a>
        <a href="#faq">{content.navigation.faq}</a>
      </nav>
    </header>
  );
}

function Hero({ content }: Pick<LandingPageProps, 'content'>): React.JSX.Element {
  return (
    <section aria-labelledby="hero-title">
      <Badge>{content.hero.badge}</Badge>
      <h1 id="hero-title">{content.hero.title}</h1>
      <p>{content.hero.lead}</p>
      <p>
        <Button asChild>
          <a href={content.links.latestRelease}>{content.hero.primaryCta}</a>
        </Button>{' '}
        <Button asChild variant="outline">
          <a href={content.links.repository}>{content.hero.secondaryCta}</a>
        </Button>
      </p>
      <div aria-label="Keyboard shortcuts">
        {content.hero.shortcuts.map((shortcut) => (
          <Shortcut key={shortcut.action} {...shortcut} />
        ))}
      </div>
      <AspectRatio ratio={19 / 18}>
        <img alt={content.hero.screenshotAlt} height="840" src="/gpt-voice/generated/media/app-main.webp" width="920" />
      </AspectRatio>
    </section>
  );
}

function Demo({ content, locale }: LandingPageProps): React.JSX.Element {
  return (
    <section aria-labelledby="demo-title" id="demo">
      <p>{content.demo.eyebrow}</p>
      <h2 id="demo-title">{content.demo.title}</h2>
      <p>{content.demo.lead}</p>
      <AspectRatio ratio={16 / 9}>
        <video
          aria-label={content.demo.videoLabel}
          controls
          playsInline
          poster="/gpt-voice/generated/media/demo-poster.webp"
          preload="none"
        >
          <source src="/gpt-voice/generated/media/demo.mp4" type="video/mp4" />
          <track
            default={locale.tag === 'en'}
            kind="captions"
            label={content.demo.captionTrackLabel}
            src={`/gpt-voice/generated/captions/${locale.tag}.vtt`}
            srcLang={locale.tag}
          />
        </video>
      </AspectRatio>
      <p>{content.demo.summary}</p>
      <p>{content.demo.supportingNote}</p>
      <Accordion collapsible type="single">
        <AccordionItem value="transcript">
          <AccordionTrigger>{content.demo.transcriptControl}</AccordionTrigger>
          <AccordionContent>
            <ol>
              {content.demo.transcriptCues.map((cue) => (
                <li key={cue.id}>
                  <p>{cue.narration}</p>
                  <p>{cue.visualDescription}</p>
                  <p>{cue.soundCues.join(' · ')}</p>
                </li>
              ))}
            </ol>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
}

function HowItWorks({ content }: Pick<LandingPageProps, 'content'>): React.JSX.Element {
  const { prettify, retry, transcribe, translate } = content.workflow;

  return (
    <section aria-labelledby="how-it-works-title" id="how-it-works">
      <p>{content.workflow.eyebrow}</p>
      <h2 id="how-it-works-title">{content.workflow.title}</h2>
      <p>{content.workflow.lead}</p>
      <ol>
        {[transcribe, translate, prettify].map((step) => (
          <li key={step.id}>
            <p>{step.order}</p>
            <h3>{step.title}</h3>
            <p>{step.description}</p>
            <p>{step.compactResult}</p>
            <KbdGroup aria-label={`${step.title} shortcuts`}>
              {step.shortcuts.map((shortcut) => (
                <Kbd key={shortcut}>{shortcut}</Kbd>
              ))}
            </KbdGroup>
            <p>{step.footnote}</p>
          </li>
        ))}
      </ol>
      <aside aria-label={retry.statusLabel}>
        <Badge variant="outline">{retry.statusLabel}</Badge>
        <h3>{retry.title}</h3>
        <p>{retry.condition}</p>
        <p>{retry.description}</p>
        <p>{retry.compactResult}</p>
        <KbdGroup aria-label={`${retry.title} shortcut`}>
          {retry.shortcuts.map((shortcut) => (
            <Kbd key={shortcut}>{shortcut}</Kbd>
          ))}
        </KbdGroup>
        <p>{retry.comparisonLabel}</p>
        <p>{retry.comparisonNote}</p>
        <p>{retry.footnote}</p>
      </aside>
    </section>
  );
}

function Providers({ content }: Pick<LandingPageProps, 'content'>): React.JSX.Element {
  return (
    <section aria-labelledby="providers-title" id="providers">
      <p>{content.providers.eyebrow}</p>
      <h2 id="providers-title">{content.providers.title}</h2>
      <p>{content.providers.lead}</p>
      <Card>
        <CardHeader>
          <CardTitle>{content.providers.inputNode}</CardTitle>
        </CardHeader>
        <CardContent>{content.providers.inputDetail}</CardContent>
      </Card>
      <p>{content.providers.groupDescription}</p>
      {[content.providers.chatGptWeb, content.providers.openAiApi].map((provider) => (
        <Card key={provider.provider}>
          <CardHeader>
            <CardTitle>{provider.provider}</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge>{provider.status}</Badge>
            <p>{provider.facts.join(' · ')}</p>
            {provider.claim ? <p>{provider.claim}</p> : null}
            {provider.qualification ? (
              <Alert variant="warning">
                <AlertTitle>{provider.provider}</AlertTitle>
                <AlertDescription>{provider.qualification}</AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>
      ))}
      <aside aria-label={content.providers.future.blockLabel}>
        <p>{content.providers.future.blockLabel}</p>
        {content.providers.future.providers.map((provider) => (
          <p key={provider.provider}>
            {provider.provider} · {provider.status}
          </p>
        ))}
        <p>{content.providers.future.longerTermCopy}</p>
        <p>{content.providers.future.qualification}</p>
        <p>{content.providers.future.independenceNote}</p>
      </aside>
    </section>
  );
}

function Faq({ content }: Pick<LandingPageProps, 'content'>): React.JSX.Element {
  return (
    <section aria-labelledby="faq-title" id="faq">
      <p>{content.faq.eyebrow}</p>
      <h2 id="faq-title">{content.faq.title}</h2>
      <Accordion collapsible type="single">
        {content.faq.items.map((item) => (
          <AccordionItem key={item.id} value={item.id}>
            <AccordionTrigger>{item.question}</AccordionTrigger>
            <AccordionContent>{item.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

function Footer({ content }: Pick<LandingPageProps, 'content'>): React.JSX.Element {
  return (
    <footer>
      <Separator />
      <h2>{content.finalCta.title}</h2>
      <p>{content.finalCta.lead}</p>
      <p>
        <Button asChild>
          <a href={content.links.latestRelease}>{content.finalCta.primaryCta}</a>
        </Button>{' '}
        <Button asChild variant="outline">
          <a href={content.links.repository}>{content.finalCta.secondaryCta}</a>
        </Button>
      </p>
      <p>{content.finalCta.licenseNote}</p>
      <p>{content.footer.description}</p>
      <nav aria-label={content.footer.brand}>
        {content.footer.links.map((link) => (
          <a href={content.links[link.href]} key={link.href}>
            {link.label}
          </a>
        ))}
      </nav>
      <p>{content.footer.disclaimer}</p>
      <p>{content.footer.copyright}</p>
    </footer>
  );
}

export function LandingPage({ content, locale }: LandingPageProps): React.JSX.Element {
  return (
    <>
      <Header content={content} />
      <main id="main-content" tabIndex={-1}>
        <Hero content={content} />
        <Demo content={content} locale={locale} />
        <HowItWorks content={content} />
        <Providers content={content} />
        <Faq content={content} />
      </main>
      <Footer content={content} />
    </>
  );
}
