import type { JSX } from 'react';
import { Composition } from 'remotion';
import { fps, totalFrames } from './data/timeline';
import { GptVoiceDemo, gptVoiceDemoSchema, type GptVoiceDemoProps } from './GptVoiceDemo';

export function RemotionRoot(): JSX.Element {
  const defaultProps: GptVoiceDemoProps = {
    debugOverlays: false,
    effectsMode: 'webgl',
  };

  return (
    <Composition<typeof gptVoiceDemoSchema, GptVoiceDemoProps>
      component={GptVoiceDemo}
      defaultProps={defaultProps}
      durationInFrames={totalFrames}
      fps={fps}
      height={1080}
      id="GptVoiceDemo"
      schema={gptVoiceDemoSchema}
      width={1920}
    />
  );
}
