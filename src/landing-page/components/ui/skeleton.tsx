import { cn } from '@landing/lib/utils';

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn('animate-pulse rounded-[var(--radius-media)] bg-muted', className)}
      {...props}
      aria-hidden="true"
    />
  );
}

export { Skeleton };
