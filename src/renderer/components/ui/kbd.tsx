import type { ComponentProps } from 'react';
import { cn } from '@renderer/lib/cn';

function Kbd({ className, ...props }: ComponentProps<'kbd'>): React.JSX.Element {
  return (
    <kbd
      className={cn(
        'inline-flex min-h-5 min-w-5 items-center justify-center rounded-sm border border-border bg-surface-muted px-1.5 font-mono text-xs font-medium text-muted-foreground',
        className,
      )}
      data-slot="kbd"
      {...props}
    />
  );
}

export { Kbd };
