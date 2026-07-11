import { LoaderCircle } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@renderer/lib/cn';

const spinnerVariants = cva('inline-flex shrink-0 items-center justify-center text-muted-foreground', {
  defaultVariants: {
    size: 'default',
  },
  variants: {
    size: {
      default: 'size-5',
      lg: 'size-6',
      sm: 'size-4',
    },
  },
});

type SpinnerProps = Omit<ComponentProps<'span'>, 'aria-label' | 'role'> &
  VariantProps<typeof spinnerVariants> & {
    label: string;
  };

function Spinner({ className, label, size, ...props }: SpinnerProps): React.JSX.Element {
  return (
    <span
      aria-label={label}
      className={cn(spinnerVariants({ size }), className)}
      data-slot="spinner"
      role="status"
      {...props}
    >
      <LoaderCircle aria-hidden="true" className="size-full animate-spin motion-reduce:animate-none" />
    </span>
  );
}

export { Spinner, spinnerVariants, type SpinnerProps };
