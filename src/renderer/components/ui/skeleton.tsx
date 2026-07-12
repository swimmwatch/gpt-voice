import type { ComponentProps } from 'react';
import { cn } from '@renderer/lib/cn';

type SkeletonProps = Omit<ComponentProps<'div'>, 'aria-hidden'>;

function Skeleton({ className, ...props }: SkeletonProps): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      className={cn('h-4 w-full animate-pulse rounded-md bg-surface-muted motion-reduce:animate-none', className)}
      data-slot="skeleton"
      {...props}
    />
  );
}

export { Skeleton, type SkeletonProps };
