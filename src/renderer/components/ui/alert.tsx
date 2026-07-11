import { CircleAlert, Info, TriangleAlert } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@renderer/lib/cn';

const alertVariants = cva(
  'relative grid w-full grid-cols-[auto_minmax(0,1fr)] gap-x-3 rounded-md border px-3 py-2.5 text-sm',
  {
    defaultVariants: {
      variant: 'info',
    },
    variants: {
      variant: {
        destructive: 'border-destructive/50 bg-destructive/15 text-foreground',
        info: 'border-primary/50 bg-[var(--primary-subtle)] text-foreground',
        warning: 'border-warning/50 bg-[var(--warning-surface)] text-foreground',
      },
    },
  },
);

const alertIcons = {
  destructive: CircleAlert,
  info: Info,
  warning: TriangleAlert,
} as const;

type AlertVariant = NonNullable<VariantProps<typeof alertVariants>['variant']>;
type AlertProps = ComponentProps<'div'> & VariantProps<typeof alertVariants>;

function Alert({ className, role, variant = 'info', ...props }: AlertProps): React.JSX.Element {
  const Icon = alertIcons[variant as AlertVariant];

  return (
    <div
      className={cn(alertVariants({ variant }), className)}
      data-slot="alert"
      role={role ?? (variant === 'info' ? 'status' : 'alert')}
      {...props}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0" data-slot="alert-content">
        {props.children}
      </div>
    </div>
  );
}

function AlertTitle({ className, ...props }: ComponentProps<'h2'>): React.JSX.Element {
  return <h2 className={cn('font-medium text-foreground', className)} data-slot="alert-title" {...props} />;
}

function AlertDescription({ className, ...props }: ComponentProps<'div'>): React.JSX.Element {
  return <div className={cn('mt-1 text-muted-foreground', className)} data-slot="alert-description" {...props} />;
}

export { Alert, AlertDescription, AlertTitle, alertVariants, type AlertProps, type AlertVariant };
