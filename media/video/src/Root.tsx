import type { JSX } from 'react';
import { Composition } from 'remotion';
import { Placeholder } from './Placeholder';

export function RemotionRoot(): JSX.Element {
  return (
    <Composition
      component={Placeholder}
      durationInFrames={3600}
      fps={60}
      height={1080}
      id="GptVoiceDemo"
      width={1920}
    />
  );
}
