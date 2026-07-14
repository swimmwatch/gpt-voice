import type { JSX } from 'react';
import { Composition } from 'remotion';
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
      durationInFrames={3600}
      fps={60}
      height={1080}
      id="GptVoiceDemo"
      schema={gptVoiceDemoSchema}
      width={1920}
    />
  );
}
