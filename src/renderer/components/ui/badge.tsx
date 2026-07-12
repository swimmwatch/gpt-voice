import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@renderer/lib/cn';

const badgeVariants = cva(
  'inline-flex min-h-5 shrink-0 items-center gap-1 rounded-sm border px-1.5 py-0.5 text-xs font-medium leading-none',
  {
    defaultVariants: {
      variant: 'default',
    },
    variants: {
      variant: {
        default: 'border-border bg-surface-muted text-foreground',
        destructive: 'border-destructive/60 bg-destructive/15 text-destructive',
        outline: 'border-border bg-transparent text-muted-foreground',
        success: 'border-success/60 bg-success/15 text-success',
        warning: 'border-warning/60 bg-warning/15 text-warning',
      },
    },
  },
);

type BadgeProps = ComponentProps<'span'> & VariantProps<typeof badgeVariants>;

function Badge({ className, variant, ...props }: BadgeProps): React.JSX.Element {
  return <span className={cn(badgeVariants({ variant }), className)} data-slot="badge" {...props} />;
}

export { Badge, badgeVariants, type BadgeProps };
