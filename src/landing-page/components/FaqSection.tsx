import { ChevronDownIcon } from 'lucide-react';
import * as React from 'react';

import type { LandingContent } from '../content/schema';

type FaqSectionProps = {
  content: LandingContent['faq'];
};

export function FaqSection({ content }: FaqSectionProps): React.JSX.Element {
  const [openItem, setOpenItem] = React.useState<string | null>(null);

  return (
    <section
      aria-labelledby="faq-title"
      className="landing-section faq-section"
      data-landing-reveal
      data-revealed="false"
      id="faq"
    >
      <header className="faq-heading">
        <p className="landing-eyebrow">{content.eyebrow}</p>
        <h2 id="faq-title">{content.title}</h2>
      </header>
      <div className="faq-accordion">
        {content.items.map((item) => {
          const isOpen = openItem === item.id;

          return (
            <article data-slot="accordion-item" key={item.id}>
              <h3 className="flex">
                <button
                  aria-expanded={isOpen}
                  className="flex min-h-12 flex-1 items-start justify-between gap-4 rounded-[var(--radius-control)] py-3 text-left text-sm font-medium transition-[color,box-shadow] duration-[var(--duration-standard)] hover:text-primary focus-visible:shadow-[var(--shadow-focus)]"
                  data-slot="accordion-trigger"
                  onClick={() => setOpenItem(isOpen ? null : item.id)}
                  type="button"
                >
                  {item.question}
                  <ChevronDownIcon
                    aria-hidden="true"
                    className={`pointer-events-none size-4 shrink-0 translate-y-0.5 text-muted-foreground transition-transform duration-200${
                      isOpen ? ' rotate-180' : ''
                    }`}
                  />
                </button>
              </h3>
              <div
                className="landing-accordion-content text-sm"
                data-slot="accordion-content"
                data-state={isOpen ? 'open' : 'closed'}
              >
                <div>{item.answer}</div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
