import type { ComponentProps } from 'react';
import { cn } from '@renderer/lib/cn';

function Empty({ className, ...props }: ComponentProps<'div'>): React.JSX.Element {
  return (
    <div
      className={cn('flex min-h-40 w-full flex-col items-center justify-center gap-4 px-5 py-8 text-center', className)}
      data-slot="empty"
      {...props}
    />
  );
}

function EmptyHeader({ className, ...props }: ComponentProps<'div'>): React.JSX.Element {
  return <div className={cn('grid justify-items-center gap-1.5', className)} data-slot="empty-header" {...props} />;
}

function EmptyMedia({ className, ...props }: ComponentProps<'div'>): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex size-10 items-center justify-center rounded-md bg-surface-muted text-muted-foreground',
        className,
      )}
      data-slot="empty-media"
      {...props}
    />
  );
}

function EmptyTitle({ className, ...props }: ComponentProps<'h2'>): React.JSX.Element {
  return <h2 className={cn('text-sm font-medium text-foreground', className)} data-slot="empty-title" {...props} />;
}

function EmptyDescription({ className, ...props }: ComponentProps<'p'>): React.JSX.Element {
  return (
    <p className={cn('max-w-md text-sm text-muted-foreground', className)} data-slot="empty-description" {...props} />
  );
}

function EmptyContent({ className, ...props }: ComponentProps<'div'>): React.JSX.Element {
  return <div className={cn('flex flex-wrap justify-center gap-2', className)} data-slot="empty-content" {...props} />;
}

export { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle };
