import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import type { ComponentProps } from 'react';
import { cn } from '@renderer/lib/cn';

function ScrollArea({ className, ...props }: ComponentProps<typeof ScrollAreaPrimitive.Root>): React.JSX.Element {
  return (
    <ScrollAreaPrimitive.Root
      className={cn('relative overflow-hidden [-webkit-app-region:no-drag]', className)}
      data-slot="scroll-area"
      {...props}
    />
  );
}

function ScrollAreaViewport({
  className,
  ...props
}: ComponentProps<typeof ScrollAreaPrimitive.Viewport>): React.JSX.Element {
  return (
    <ScrollAreaPrimitive.Viewport
      className={cn(
        'size-full rounded-[inherit] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary',
        className,
      )}
      data-slot="scroll-area-viewport"
      {...props}
    />
  );
}

function ScrollAreaScrollbar({
  className,
  orientation = 'vertical',
  ...props
}: ComponentProps<typeof ScrollAreaPrimitive.Scrollbar>): React.JSX.Element {
  return (
    <ScrollAreaPrimitive.Scrollbar
      className={cn(
        'flex touch-none select-none bg-transparent p-0.5 transition-colors duration-[var(--duration-fast)]',
        orientation === 'vertical' && 'h-full w-2.5',
        orientation === 'horizontal' && 'h-2.5 flex-col',
        className,
      )}
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb
        className="relative flex-1 cursor-grab rounded-full bg-muted-foreground/80 hover:bg-foreground active:cursor-grabbing"
        data-slot="scroll-area-thumb"
      />
    </ScrollAreaPrimitive.Scrollbar>
  );
}

function ScrollAreaCorner({
  className,
  ...props
}: ComponentProps<typeof ScrollAreaPrimitive.Corner>): React.JSX.Element {
  return (
    <ScrollAreaPrimitive.Corner className={cn('bg-transparent', className)} data-slot="scroll-area-corner" {...props} />
  );
}

export { ScrollArea, ScrollAreaCorner, ScrollAreaScrollbar, ScrollAreaViewport };
