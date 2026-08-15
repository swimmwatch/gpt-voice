import { useState, type ReactNode } from 'react';
import type { IconType } from 'react-icons';
import { PiCaretDown, PiCaretRight } from 'react-icons/pi';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@renderer/components/ui/select';
import { useI18n } from '@renderer/hooks/useI18n';
import { cn } from '@renderer/lib/cn';

interface LocalWhisperPanelProps {
  readonly actions?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
  readonly icon: IconType;
  readonly title: string;
}

export function LocalWhisperPanel({
  actions,
  children,
  className,
  icon: Icon,
  title,
}: LocalWhisperPanelProps): React.JSX.Element {
  return (
    <section className={cn('lw-panel', className)}>
      <div className="lw-section-heading">
        <span>
          <Icon aria-hidden="true" />
          <strong>{title}</strong>
        </span>
        {actions}
      </div>
      {children}
    </section>
  );
}

interface LocalWhisperDisclosureProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly defaultOpen?: boolean;
  readonly icon?: IconType;
  readonly summary?: string;
  readonly title: string;
}

export function LocalWhisperDisclosure({
  children,
  className,
  defaultOpen = false,
  icon: Icon,
  summary,
  title,
}: LocalWhisperDisclosureProps): React.JSX.Element {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={cn('lw-disclosure', open && 'is-open', className)}>
      <button
        aria-expanded={open}
        className="lw-disclosure-trigger"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="lw-disclosure-title">
          {Icon ? <Icon aria-hidden="true" /> : null}
          <strong>{title}</strong>
          {summary ? <span>{summary}</span> : null}
        </span>
        {open ? <PiCaretDown aria-hidden="true" /> : <PiCaretRight aria-hidden="true" />}
      </button>
      {open ? <div className="lw-disclosure-content">{children}</div> : null}
    </section>
  );
}

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
      {hint ? (
        <p className="text-xs text-muted-foreground" id={htmlFor ? `${htmlFor}-hint` : undefined}>
          {hint}
        </p>
      ) : null}
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
  const { t } = useI18n();
  const selectedOptionMissing = value !== null && !options.some((option) => option.id === value);
  return (
    <Select disabled={disabled} onValueChange={onChange} value={value ?? ''}>
      <SelectTrigger aria-describedby={describedBy} id={id}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {selectedOptionMissing && value !== null ? (
          <SelectItem disabled value={value}>
            {value} · {t('localWhisper.settings.savedSelectionUnavailable')}
          </SelectItem>
        ) : null}
        {options.map((option) => (
          <SelectItem disabled={option.available === false} key={option.id} value={option.id}>
            {option.label}
            {option.available === false ? ` · ${t('localWhisper.settings.optionUnavailable')}` : ''}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
