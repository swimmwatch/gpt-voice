import type { ComponentProps } from 'react';
import { useFieldContext, joinAriaDescribedBy } from '@renderer/components/ui/field';
import { cn } from '@renderer/lib/cn';

type InputProps = ComponentProps<'input'>;

function Input({
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  className,
  disabled,
  id,
  required,
  ...props
}: InputProps): React.JSX.Element {
  const field = useFieldContext();

  return (
    <input
      aria-describedby={joinAriaDescribedBy(field?.descriptionId, field?.errorId, ariaDescribedBy)}
      aria-invalid={ariaInvalid ?? (field?.invalid || undefined)}
      className={cn(
        'flex h-10 w-full min-w-0 rounded-md border border-border bg-surface-muted px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      data-slot="input"
      disabled={disabled ?? field?.disabled}
      id={id ?? field?.inputId}
      required={required ?? field?.required}
      {...props}
    />
  );
}

export { Input, type InputProps };
