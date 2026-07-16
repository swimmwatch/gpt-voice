import { Languages, Mic, RefreshCw, WandSparkles, type LucideIcon } from 'lucide-react';
import * as React from 'react';

import { Badge } from './ui/badge';
import { Kbd, KbdGroup } from './ui/kbd';
import type { LandingContent, TranslateWorkflowStep, WorkflowStep } from '../content/schema';

type HowItWorksSectionProps = {
  content: LandingContent['workflow'];
};

type PrimaryStep = WorkflowStep | TranslateWorkflowStep;

const icons: Record<PrimaryStep['id'], LucideIcon> = {
  transcribe: Mic,
  translate: Languages,
  prettify: WandSparkles,
};

function WorkflowShortcuts({ label, shortcuts }: { label: string; shortcuts: readonly string[] }): React.JSX.Element {
  return (
    <KbdGroup aria-label={label}>
      {shortcuts.map((shortcut) => (
        <Kbd key={shortcut}>{shortcut}</Kbd>
      ))}
    </KbdGroup>
  );
}

function PrimaryStepRow({ step }: { step: PrimaryStep }): React.JSX.Element {
  const Icon = icons[step.id];
  const isTranslation = step.id === 'translate';

  return (
    <li className="workflow-step" data-workflow-step={step.id}>
      <div className="workflow-node" aria-hidden="true">
        <Icon strokeWidth={1.75} />
      </div>
      <article className="workflow-copy">
        <p className="workflow-order">{step.order}</p>
        <h3>{step.title}</h3>
        <p>{step.description}</p>
        <div className="workflow-proof">
          <WorkflowShortcuts label={step.title} shortcuts={step.shortcuts} />
          <p>{step.compactResult}</p>
        </div>
        {isTranslation ? <p className="workflow-detail">{step.languages}</p> : null}
        <p className="workflow-footnote">{step.footnote}</p>
      </article>
    </li>
  );
}

function RetryBranch({ retry }: Pick<HowItWorksSectionProps['content'], 'retry'>): React.JSX.Element {
  return (
    <li className="workflow-retry">
      <div className="workflow-retry-node" aria-hidden="true">
        <RefreshCw strokeWidth={1.75} />
      </div>
      <aside className="workflow-retry-copy" aria-label={retry.title}>
        <Badge variant="outline">{retry.statusLabel}</Badge>
        <h3>{retry.title}</h3>
        <p>{retry.condition}</p>
        <div className="workflow-proof">
          <WorkflowShortcuts label={retry.title} shortcuts={retry.shortcuts} />
          <p>{retry.compactResult}</p>
        </div>
        <p className="workflow-footnote">{retry.footnote}</p>
      </aside>
    </li>
  );
}

export function HowItWorksSection({ content }: HowItWorksSectionProps): React.JSX.Element {
  return (
    <section
      className="landing-section workflow-section"
      aria-labelledby="how-it-works-title"
      data-landing-reveal
      data-revealed="false"
      id="how-it-works"
    >
      <div className="workflow-heading">
        <p className="landing-eyebrow">{content.eyebrow}</p>
        <h2 id="how-it-works-title">{content.title}</h2>
        <p className="landing-lead">{content.lead}</p>
      </div>
      <ol className="workflow-path">
        <PrimaryStepRow step={content.transcribe} />
        <RetryBranch retry={content.retry} />
        <PrimaryStepRow step={content.translate} />
        <PrimaryStepRow step={content.prettify} />
      </ol>
    </section>
  );
}
