import * as SwitchPrimitive from '@radix-ui/react-switch';
import type { ComponentProps } from 'react';
import { useFieldContext, joinAriaDescribedBy } from '@renderer/components/ui/field';
import { cn } from '@renderer/lib/cn';

type SwitchProps = ComponentProps<typeof SwitchPrimitive.Root>;

function Switch({
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  className,
  disabled,
  id,
  required,
  ...props
}: SwitchProps): React.JSX.Element {
  const field = useFieldContext();

  return (
    <SwitchPrimitive.Root
      aria-describedby={joinAriaDescribedBy(field?.descriptionId, field?.errorId, ariaDescribedBy)}
      aria-invalid={ariaInvalid ?? (field?.invalid || undefined)}
      className={cn(
        'inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-surface-raised p-0.5 transition-colors duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=checked]:bg-primary disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      data-slot="switch"
      disabled={disabled ?? field?.disabled}
      id={id ?? field?.inputId}
      required={required ?? field?.required}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className="block size-4 rounded-full bg-primary-foreground shadow-sm transition-transform duration-[var(--duration-fast)] data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0"
        data-slot="switch-thumb"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch, type SwitchProps };
