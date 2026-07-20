import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from '@radix-ui/react-slot';

import { cn } from '@landing/lib/utils';

const buttonVariants = cva(
  "inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-transparent text-sm font-medium whitespace-nowrap transition-[background-color,border-color,box-shadow,color,transform] duration-[var(--duration-standard)] ease-[var(--ease-standard)] focus-visible:shadow-[var(--shadow-focus)] disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-[var(--primary-hover)]',
        ghost: 'bg-transparent text-foreground hover:bg-accent',
        icon: 'bg-transparent text-foreground hover:bg-accent',
        outline: 'border-border bg-transparent text-foreground hover:border-[var(--border-strong)] hover:bg-muted',
      },
      size: {
        default: 'h-11 px-4',
        icon: 'size-11 p-0',
        lg: 'h-12 px-5 text-base',
        sm: 'h-10 px-3',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  type = 'button',
  ...props
}: ButtonProps): React.JSX.Element {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...(!asChild ? { type } : {})}
      {...props}
    />
  );
}

export { Button, buttonVariants, type ButtonProps };
