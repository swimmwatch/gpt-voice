import type { JSX } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { claims, productLabels, prompts } from '../data/content';
import { getCtaViewState } from '../data/ctaState';

const actions = ['Speak', 'Retry', 'Translate', 'Refine'] as const;

function ActionPill({ action }: { action: (typeof actions)[number] }): JSX.Element {
  return (
    <span
      style={{
        background: '#17243A',
        border: '1px solid #60A5FA66',
        borderRadius: 999,
        color: '#DBEAFE',
        fontSize: 19,
        padding: '10px 16px',
      }}
    >
      {action}
    </span>
  );
}

/** Resolves the four workflows into a deliberately frame-invariant final poster hold. */
export function CtaScene(): JSX.Element {
  const frame = useCurrentFrame();
  const view = getCtaViewState(frame);

  return (
    <AbsoluteFill
      data-slot="cta-scene"
      style={{ background: 'radial-gradient(circle at 50% 34%, #1D4E89 0%, #101A33 44%, #050914 100%)' }}
    >
      <div style={{ left: 320, opacity: view.resolveOpacity, position: 'absolute', top: 192, width: 1280 }}>
        <p
          style={{
            color: '#93C5FD',
            fontSize: 20,
            letterSpacing: '0.12em',
            margin: 0,
            textAlign: 'center',
            textTransform: 'uppercase',
          }}
        >
          {productLabels.promptFirst}
        </p>
        <h1
          style={{ fontSize: 72, letterSpacing: '-0.05em', lineHeight: 1, margin: '18px 0 12px', textAlign: 'center' }}
        >
          {productLabels.cta}
        </h1>
        <p style={{ color: '#CBD5E1', fontSize: 25, margin: 0, textAlign: 'center' }}>{claims.control}</p>

        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 38 }}>
          {actions.map((action) => (
            <ActionPill action={action} key={action} />
          ))}
        </div>

        <section
          style={{
            background: '#0F1A2D',
            border: '1px solid #60A5FA66',
            borderRadius: 24,
            boxShadow: '0 28px 70px #02061766',
            margin: '44px auto 0',
            padding: '26px 32px',
            width: 860,
          }}
        >
          <p style={{ color: '#7DD3FC', fontSize: 17, letterSpacing: '0.1em', margin: 0, textTransform: 'uppercase' }}>
            Clean prompt outcome
          </p>
          <p style={{ color: '#F8FAFC', fontSize: 28, lineHeight: 1.4, margin: '12px 0 0' }}>
            {prompts.prettify.result}
          </p>
        </section>

        <p style={{ color: '#BFDBFE', fontSize: 22, margin: '36px 0 0', textAlign: 'center' }}>GPT-Voice on GitHub</p>
      </div>
    </AbsoluteFill>
  );
}
