import type { CSSProperties, JSX } from 'react';
import { interpolate } from 'remotion';
import { promptProblems } from '../data/content';

interface PromptProblemMapProps {
  frame: number;
}

const groupRevealFrames = [0, 150, 330, 510] as const;
const groupColors = ['#60A5FA', '#F59E0B', '#C084FC', '#FB7185'] as const;

function issueOpacity(frame: number, groupIndex: number, issueIndex: number): number {
  const revealAt = groupRevealFrames[groupIndex] + issueIndex * 22;
  return interpolate(frame, [revealAt, revealAt + 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
}

/** Four concise clusters that make prompt-writing friction legible without product branding. */
export function PromptProblemMap({ frame }: PromptProblemMapProps): JSX.Element {
  return (
    <section aria-label="Prompt writing problems" data-slot="prompt-problem-map">
      <p
        style={{
          color: '#94A3B8',
          fontSize: 18,
          letterSpacing: '0.1em',
          margin: '0 0 16px',
          textTransform: 'uppercase',
        }}
      >
        Friction compounds
      </p>
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        {promptProblems.map((group, groupIndex) => {
          const groupOpacity = interpolate(frame, [groupRevealFrames[groupIndex], groupRevealFrames[groupIndex] + 20], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const color = groupColors[groupIndex];
          const cardStyle: CSSProperties = {
            background: '#101A2A',
            border: `1px solid ${color}55`,
            borderRadius: 18,
            boxShadow: `inset 0 1px 0 ${color}22`,
            opacity: groupOpacity,
            padding: 18,
          };

          return (
            <article key={group.id} style={cardStyle}>
              <h3 style={{ color, fontSize: 21, letterSpacing: '-0.02em', margin: '0 0 14px' }}>{group.label}</h3>
              <ul style={{ display: 'grid', gap: 8, listStyle: 'none', margin: 0, padding: 0 }}>
                {group.issues.map((issue, issueIndex) => (
                  <li
                    key={issue}
                    style={{
                      alignItems: 'center',
                      color: '#D8E2F0',
                      display: 'flex',
                      fontSize: 17,
                      gap: 8,
                      lineHeight: 1.25,
                      opacity: issueOpacity(frame, groupIndex, issueIndex),
                    }}
                  >
                    <span aria-hidden="true" style={{ color, fontSize: 13 }}>
                      ●
                    </span>
                    {issue}
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
    </section>
  );
}
