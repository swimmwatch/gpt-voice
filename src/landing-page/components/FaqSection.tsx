import * as React from 'react';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import type { LandingContent } from '../content/schema';

type FaqSectionProps = {
  content: LandingContent['faq'];
};

export function FaqSection({ content }: FaqSectionProps): React.JSX.Element {
  return (
    <section
      className="landing-section faq-section"
      aria-labelledby="faq-title"
      data-landing-reveal
      data-revealed="false"
      id="faq"
    >
      <header className="faq-heading">
        <p className="landing-eyebrow">{content.eyebrow}</p>
        <h2 id="faq-title">{content.title}</h2>
      </header>
      <Accordion className="faq-accordion" collapsible type="single">
        {content.items.map((item) => (
          <AccordionItem key={item.id} value={item.id}>
            <AccordionTrigger>{item.question}</AccordionTrigger>
            <AccordionContent>{item.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
