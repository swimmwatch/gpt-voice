import type { JSX } from 'react';

interface HotkeyChipProps {
  keys: readonly string[];
  label: string;
  tone?: 'blue' | 'green' | 'red';
}

const toneStyles = {
  blue: { border: '#60A5FA88', key: '#0F2B53', text: '#BFDBFE' },
  green: { border: '#34D39988', key: '#103328', text: '#BBF7D0' },
  red: { border: '#FB718588', key: '#381725', text: '#FECDD3' },
} as const;

/** A deterministic, non-interactive visual for a global shortcut. */
export function HotkeyChip({ keys, label, tone = 'blue' }: HotkeyChipProps): JSX.Element {
  const colors = toneStyles[tone];

  return (
    <div
      aria-label={`${keys.join('+')} ${label}`}
      data-slot="hotkey-chip"
      style={{
        alignItems: 'center',
        background: '#0B1627',
        border: `1px solid ${colors.border}`,
        borderRadius: 14,
        color: colors.text,
        display: 'inline-flex',
        fontSize: 18,
        fontWeight: 650,
        gap: 10,
        padding: '10px 13px',
      }}
    >
      <span style={{ display: 'inline-flex', gap: 5 }}>
        {keys.map((key) => (
          <kbd
            key={key}
            style={{
              backgroundColor: colors.key,
              border: `1px solid ${colors.border}`,
              borderBottomWidth: 3,
              borderRadius: 7,
              color: '#F8FAFC',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 16,
              padding: '4px 7px',
            }}
          >
            {key}
          </kbd>
        ))}
      </span>
      <span>{label}</span>
    </div>
  );
}
