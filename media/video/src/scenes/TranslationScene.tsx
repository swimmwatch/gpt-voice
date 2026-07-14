import type { JSX } from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { prompts } from '../data/content';
import { getTranslationViewState } from '../data/translationState';
import { getVideoUiState } from '../data/uiFixtures';
import { HotkeyChip } from '../product-ui/HotkeyChip';
import { ProductUiFrame } from '../product-ui/ProductUiFrame';
import { ResultComparison } from '../product-ui/ResultComparison';
import { VideoCursor } from '../product-ui/VideoCursor';

/** Demonstrates translating a Russian voice input into an English prompt without leaving GPT-Voice. */
export function TranslationScene(): JSX.Element {
  const frame = useCurrentFrame();
  const view = getTranslationViewState(frame);
  const resultOpacity = interpolate(frame, [288, 300], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      data-slot="translation-scene"
      style={{ background: 'radial-gradient(circle at 76% 42%, #173251 0%, #091421 43%, #050914 100%)' }}
    >
      <div style={{ left: 192, position: 'absolute', top: 248 }}>
        <ProductUiFrame scale={1.45} spinnerRotation={0} state={getVideoUiState(view.fixtureId)} />
      </div>
      <section style={{ left: 1000, position: 'absolute', top: 234, width: 590 }}>
        {view.showHotkey ? <HotkeyChip keys={['F11']} label="Translate selection" tone="blue" /> : null}
        <div style={{ marginTop: view.showHotkey ? 18 : 0, opacity: view.showResult ? resultOpacity : 1 }}>
          <ResultComparison
            details={['Language chosen for the model or task']}
            result={prompts.translation.result}
            resultLabel={`${prompts.translation.targetLanguage} for your task`}
            showResult={view.showResult}
            source={prompts.translation.source}
            sourceLabel={`Spoken in ${prompts.translation.inputLanguage}`}
          />
        </div>
        {view.showResult ? <VideoCursor active opacity={resultOpacity} x={500} y={304} /> : null}
      </section>
    </AbsoluteFill>
  );
}
