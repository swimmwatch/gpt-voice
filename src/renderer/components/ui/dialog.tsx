import * as DialogPrimitive from '@radix-ui/react-dialog';
import type { ComponentProps } from 'react';
import { cn } from '@renderer/lib/cn';
import {
  MODAL_CONTENT_CLASS_NAME,
  MODAL_DESCRIPTION_CLASS_NAME,
  MODAL_FOOTER_CLASS_NAME,
  MODAL_HEADER_CLASS_NAME,
  MODAL_OVERLAY_CLASS_NAME,
  MODAL_TITLE_CLASS_NAME,
} from '@renderer/components/ui/modal-styles';

function DialogOverlay({ className, ...props }: ComponentProps<typeof DialogPrimitive.Overlay>): React.JSX.Element {
  return (
    <DialogPrimitive.Overlay
      className={cn(MODAL_OVERLAY_CLASS_NAME, className)}
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
        className={cn(MODAL_CONTENT_CLASS_NAME, 'max-w-lg', className)}
        data-slot="dialog-content"
        {...props}
      />
    </DialogPrimitive.Portal>
  );
}

function DialogHeader({ className, ...props }: ComponentProps<'div'>): React.JSX.Element {
  return <div className={cn(MODAL_HEADER_CLASS_NAME, className)} data-slot="dialog-header" {...props} />;
}

function DialogFooter({ className, ...props }: ComponentProps<'div'>): React.JSX.Element {
  return <div className={cn(MODAL_FOOTER_CLASS_NAME, className)} data-slot="dialog-footer" {...props} />;
}

function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>): React.JSX.Element {
  return (
    <DialogPrimitive.Title className={cn(MODAL_TITLE_CLASS_NAME, className)} data-slot="dialog-title" {...props} />
  );
}

function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>): React.JSX.Element {
  return (
    <DialogPrimitive.Description
      className={cn(MODAL_DESCRIPTION_CLASS_NAME, className)}
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
