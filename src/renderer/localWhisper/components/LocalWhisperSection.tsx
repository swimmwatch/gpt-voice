import type { ReactNode } from 'react';
import { cn } from '@renderer/lib/cn';

interface LocalWhisperSectionProps {
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
  readonly className?: string;
}

export function LocalWhisperSection({
  title,
  description,
  children,
  className,
}: LocalWhisperSectionProps): React.JSX.Element {
  return (
    <section className={cn('min-w-0 rounded-lg border border-border bg-card p-4 shadow-sm', className)}>
      <div className="mb-4 min-w-0">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

interface LocalWhisperFieldProps {
  readonly label: string;
  readonly hint?: string;
  readonly error?: string;
  readonly htmlFor?: string;
  readonly children: ReactNode;
}

export function LocalWhisperField({
  label,
  hint,
  error,
  htmlFor,
  children,
}: LocalWhisperFieldProps): React.JSX.Element {
  return (
    <div className="min-w-0 space-y-1.5">
      <label className="block text-sm font-medium text-foreground" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? (
        <p className="text-xs font-medium text-destructive" id={htmlFor ? `${htmlFor}-error` : undefined} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface LocalWhisperOptionSelectProps {
  readonly id: string;
  readonly value: string | null;
  readonly options: readonly { readonly id: string; readonly label: string; readonly available?: boolean }[];
  readonly placeholder: string;
  readonly disabled?: boolean;
  readonly describedBy?: string;
  readonly onChange: (value: string) => void;
}

export function LocalWhisperOptionSelect({
  id,
  value,
  options,
  placeholder,
  disabled = false,
  describedBy,
  onChange,
}: LocalWhisperOptionSelectProps): React.JSX.Element {
  const selectedOptionMissing = value !== null && !options.some((option) => option.id === value);
  return (
    <select
      aria-describedby={describedBy}
      className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled}
      id={id}
      onChange={(event) => onChange(event.target.value)}
      value={value ?? ''}
    >
      <option disabled value="">
        {placeholder}
      </option>
      {selectedOptionMissing ? (
        <option disabled value={value ?? ''}>
          {value} · Saved selection unavailable
        </option>
      ) : null}
      {options.map((option) => (
        <option disabled={option.available === false} key={option.id} value={option.id}>
          {option.label}
          {option.available === false ? ' · Unavailable' : ''}
        </option>
      ))}
    </select>
  );
}
