import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Badge } from '@landing/components/ui/badge';
import { Button, buttonVariants } from '@landing/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@landing/components/ui/card';

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
