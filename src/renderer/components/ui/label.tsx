import type { ComponentProps } from 'react';
import { cn } from '@renderer/lib/cn';

type LabelProps = ComponentProps<'label'>;

function Label({ className, ...props }: LabelProps): React.JSX.Element {
  return (
    <label className={cn('text-sm font-medium leading-none text-foreground', className)} data-slot="label" {...props} />
  );
}

export { Label, type LabelProps };
