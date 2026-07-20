import type * as React from 'react';

export const voiceWaveformBars = [
  { amplitude: 6, id: '01' },
  { amplitude: 8, id: '02' },
  { amplitude: 7, id: '03' },
  { amplitude: 10, id: '04' },
  { amplitude: 12, id: '05' },
  { amplitude: 9, id: '06' },
  { amplitude: 14, id: '07' },
  { amplitude: 18, id: '08' },
  { amplitude: 13, id: '09' },
  { amplitude: 20, id: '10' },
  { amplitude: 16, id: '11' },
  { amplitude: 22, id: '12' },
  { amplitude: 18, id: '13' },
  { amplitude: 24, id: '14' },
  { amplitude: 21, id: '15' },
  { amplitude: 28, id: '16' },
  { amplitude: 24, id: '17' },
  { amplitude: 19, id: '18' },
  { amplitude: 23, id: '19' },
  { amplitude: 17, id: '20' },
  { amplitude: 21, id: '21' },
  { amplitude: 15, id: '22' },
  { amplitude: 18, id: '23' },
  { amplitude: 13, id: '24' },
  { amplitude: 15, id: '25' },
  { amplitude: 10, id: '26' },
  { amplitude: 12, id: '27' },
  { amplitude: 9, id: '28' },
  { amplitude: 10, id: '29' },
  { amplitude: 7, id: '30' },
  { amplitude: 6, id: '31' },
] as const;

export const footerWaveformBars = voiceWaveformBars.flatMap((bar, index) => {
  const nextBar = voiceWaveformBars[index + 1];

  if (!nextBar) {
    return [bar];
  }

  return [bar, { amplitude: (bar.amplitude + nextBar.amplitude) / 2, id: `${bar.id}-between` }];
});

type VoiceWaveformBarStyleOptions = {
  amplitude: number;
  heightScale?: number;
  index: number;
  offsetStep?: number;
};

export function getVoiceWaveformBarStyle({
  amplitude,
  heightScale = 1,
  index,
  offsetStep = 3,
}: VoiceWaveformBarStyleOptions): React.CSSProperties {
  return {
    '--voice-wave-delay': `${-(index * 83)}ms`,
    '--voice-wave-duration': `${700 + (index % 5) * 90}ms`,
    '--voice-wave-height': `${amplitude * heightScale}px`,
    '--voice-wave-offset': `${-(index * offsetStep)}px`,
  } as React.CSSProperties;
}
