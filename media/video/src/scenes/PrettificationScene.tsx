import type { JSX } from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { prompts } from '../data/content';
import { getPrettificationViewState } from '../data/prettificationState';
import { getVideoUiState } from '../data/uiFixtures';
import { HotkeyChip } from '../product-ui/HotkeyChip';
import { ProductUiFrame } from '../product-ui/ProductUiFrame';
import { ResultComparison } from '../product-ui/ResultComparison';

/** Refines the approved rough prompt while keeping its security-review goal and requested top-three output. */
export function PrettificationScene(): JSX.Element {
  const frame = useCurrentFrame();
  const view = getPrettificationViewState(frame);
  const resultOpacity = interpolate(frame, [252, 276], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      data-slot="prettification-scene"
      style={{ background: 'radial-gradient(circle at 76% 42%, #173D35 0%, #091C1A 43%, #050914 100%)' }}
    >
      <div style={{ left: 192, position: 'absolute', top: 248 }}>
        <ProductUiFrame scale={1.45} spinnerRotation={0} state={getVideoUiState(view.fixtureId)} />
      </div>
      <section style={{ left: 1000, position: 'absolute', top: 234, width: 590 }}>
        {view.showHotkey ? <HotkeyChip keys={['F12']} label="Prettify selection" tone="green" /> : null}
        <div style={{ marginTop: view.showHotkey ? 18 : 0, opacity: view.showResult ? resultOpacity : 1 }}>
          <ResultComparison result={prompts.prettify.result} showResult={view.showResult} source={prompts.prettify.source} />
        </div>
      </section>
    </AbsoluteFill>
  );
}
