import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from '@radix-ui/react-slot';

import { cn } from '@landing/lib/utils';

const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-[var(--radius-pill)] border px-2 py-1 text-xs font-medium leading-none whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3',
  {
    variants: {
      variant: {
        default: 'border-primary bg-[var(--primary-subtle)] text-foreground',
        outline: 'border-border bg-transparent text-muted-foreground',
        secondary: 'border-border bg-secondary text-secondary-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

type BadgeProps = React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean;
  };

function Badge({ className, variant = 'default', asChild = false, ...props }: BadgeProps): React.JSX.Element {
  const Comp = asChild ? Slot : 'span';

  return (
    <Comp data-slot="badge" data-variant={variant} className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants, type BadgeProps };
