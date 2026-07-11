import * as DialogPrimitive from '@radix-ui/react-dialog';
import type { ComponentProps } from 'react';
import { cn } from '@renderer/lib/cn';

function DialogOverlay({ className, ...props }: ComponentProps<typeof DialogPrimitive.Overlay>): React.JSX.Element {
  return (
    <DialogPrimitive.Overlay
      className={cn('fixed inset-0 z-50 bg-[var(--overlay)] [-webkit-app-region:no-drag]', className)}
      data-slot="dialog-overlay"
      {...props}
    />
  );
}

function DialogContent({
  'aria-describedby': ariaDescribedBy,
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content>): React.JSX.Element {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        aria-describedby={ariaDescribedBy}
        className={cn(
          'fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border border-border bg-surface p-5 text-foreground shadow-xl outline-none [-webkit-app-region:no-drag]',
          className,
        )}
        data-slot="dialog-content"
        {...props}
      />
    </DialogPrimitive.Portal>
  );
}

function DialogHeader({ className, ...props }: ComponentProps<'div'>): React.JSX.Element {
  return <div className={cn('grid gap-1', className)} data-slot="dialog-header" {...props} />;
}

function DialogFooter({ className, ...props }: ComponentProps<'div'>): React.JSX.Element {
  return <div className={cn('flex flex-wrap justify-end gap-2', className)} data-slot="dialog-footer" {...props} />;
}

function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>): React.JSX.Element {
  return (
    <DialogPrimitive.Title
      className={cn('text-base font-semibold text-foreground', className)}
      data-slot="dialog-title"
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>): React.JSX.Element {
  return (
    <DialogPrimitive.Description
      className={cn('text-sm text-muted-foreground', className)}
      data-slot="dialog-description"
      {...props}
    />
  );
}

const Dialog = DialogPrimitive.Root;
const DialogClose = DialogPrimitive.Close;
const DialogTrigger = DialogPrimitive.Trigger;

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
};
