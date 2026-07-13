import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@landing/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@landing/components/ui/alert';
import { AspectRatio } from '@landing/components/ui/aspect-ratio';
import { Badge } from '@landing/components/ui/badge';
import { Button, buttonVariants } from '@landing/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@landing/components/ui/card';
import { Kbd, KbdGroup } from '@landing/components/ui/kbd';
import { Skeleton } from '@landing/components/ui/skeleton';

describe('landing action and surface primitives', () => {
  it('preserves native button and external-link semantics', () => {
    const button = renderToStaticMarkup(<Button>Download</Button>);
    const externalLink = renderToStaticMarkup(
      <Button asChild variant="outline">
        <a href="https://github.com/swimmwatch/gpt-voice">Repository</a>
      </Button>,
    );

    expect(button).toContain('<button');
    expect(button).toContain('type="button"');
    expect(externalLink).toContain('<a');
    expect(externalLink).toContain('href="https://github.com/swimmwatch/gpt-voice"');
    expect(externalLink).not.toContain('type="button"');
  });

  it('provides the approved action variants and 44-pixel icon target', () => {
    expect(buttonVariants({ variant: 'default' })).toContain('bg-primary');
    expect(buttonVariants({ variant: 'outline' })).toContain('border-border');
    expect(buttonVariants({ variant: 'ghost' })).toContain('bg-transparent');
    expect(buttonVariants({ size: 'icon', variant: 'icon' })).toContain('size-11');
  });

  it('keeps badges and cards as non-interactive surfaces by default', () => {
    const badge = renderToStaticMarkup(<Badge variant="secondary">Windows</Badge>);
    const card = renderToStaticMarkup(
      <Card>
        <CardHeader>
          <CardTitle>Voice input</CardTitle>
        </CardHeader>
        <CardContent>Static provider signal.</CardContent>
      </Card>,
    );

    expect(badge).toMatch(/^<span/);
    expect(card).toMatch(/^<div/);
    expect(card).not.toContain('tabindex=');
    expect(card).not.toContain('role=');
  });
});

describe('landing disclosure and media primitives', () => {
  it('keeps collapsed accordion content in the server HTML for a JavaScript-free fallback', () => {
    const markup = renderToStaticMarkup(
      <Accordion collapsible type="single">
        <AccordionItem value="transcript">
          <AccordionTrigger>Read the transcript</AccordionTrigger>
          <AccordionContent>Transcript text stays in the initial document.</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );

    expect(markup).toContain('Read the transcript');
    expect(markup).toContain('Transcript text stays in the initial document.');
    expect(markup).toContain('role="region"');
    expect(markup).toContain('aria-labelledby=');
  });

  it('keeps explanatory alerts static and skeletons decorative', () => {
    const alert = renderToStaticMarkup(
      <Alert variant="warning">
        <AlertTitle>Subscription limits apply</AlertTitle>
        <AlertDescription>GPT-Voice does not bypass quotas.</AlertDescription>
      </Alert>,
    );
    const skeleton = renderToStaticMarkup(<Skeleton className="h-48" />);

    expect(alert).not.toContain('role="alert"');
    expect(alert).not.toContain('role="status"');
    expect(skeleton).toContain('aria-hidden="true"');
    expect(skeleton).not.toContain('role=');
  });

  it('preserves non-interactive media and keyboard semantics', () => {
    const aspectRatio = renderToStaticMarkup(
      <AspectRatio ratio={16 / 9}>
        <img alt="GPT-Voice transcription screen" src="/gpt-voice/media/app-main.webp" />
      </AspectRatio>,
    );
    const shortcut = renderToStaticMarkup(
      <KbdGroup aria-label="Record shortcut">
        <Kbd>F9</Kbd>
      </KbdGroup>,
    );

    expect(aspectRatio).toContain('data-slot="aspect-ratio"');
    expect(aspectRatio).toContain('alt="GPT-Voice transcription screen"');
    expect(shortcut).toMatch(/^<span/);
    expect(shortcut).toContain('<kbd');
    expect(shortcut).not.toContain('<kbd><kbd');
  });
});
