import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@renderer/lib/cn';

const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors duration-[var(--duration-fast)] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
  {
    defaultVariants: {
      size: 'default',
      variant: 'primary',
    },
    variants: {
      size: {
        default: 'h-10 px-4 py-2',
        icon: 'size-10',
        lg: 'h-11 px-5 text-base',
        sm: 'h-9 px-3',
      },
      variant: {
        destructive: 'bg-destructive text-primary-foreground hover:bg-destructive-hover',
        ghost: 'text-foreground hover:bg-surface-muted',
        outline: 'border border-border bg-transparent text-foreground hover:bg-surface-muted',
        primary: 'bg-primary text-primary-foreground hover:bg-primary-hover',
        secondary: 'bg-surface-muted text-foreground hover:bg-surface-raised',
      },
    },
  },
);

type ButtonProps = ComponentProps<'button'> & VariantProps<typeof buttonVariants>;

function Button({ className, size, type = 'button', variant, ...props }: ButtonProps): React.JSX.Element {
  return (
    <button className={cn(buttonVariants({ size, variant }), className)} data-slot="button" type={type} {...props} />
  );
}

export { Button, buttonVariants, type ButtonProps };
