import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
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

function AlertDialogOverlay({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Overlay>): React.JSX.Element {
  return (
    <AlertDialogPrimitive.Overlay
      className={cn(MODAL_OVERLAY_CLASS_NAME, className)}
      data-slot="alert-dialog-overlay"
      {...props}
    />
  );
}

function AlertDialogContent({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Content>): React.JSX.Element {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        className={cn(MODAL_CONTENT_CLASS_NAME, 'max-w-md', className)}
        data-slot="alert-dialog-content"
        {...props}
      />
    </AlertDialogPrimitive.Portal>
  );
}

function AlertDialogHeader({ className, ...props }: ComponentProps<'div'>): React.JSX.Element {
  return <div className={cn(MODAL_HEADER_CLASS_NAME, className)} data-slot="alert-dialog-header" {...props} />;
}

function AlertDialogFooter({ className, ...props }: ComponentProps<'div'>): React.JSX.Element {
  return <div className={cn(MODAL_FOOTER_CLASS_NAME, className)} data-slot="alert-dialog-footer" {...props} />;
}

function AlertDialogTitle({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Title>): React.JSX.Element {
  return (
    <AlertDialogPrimitive.Title
      className={cn(MODAL_TITLE_CLASS_NAME, className)}
      data-slot="alert-dialog-title"
      {...props}
    />
  );
}

function AlertDialogDescription({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Description>): React.JSX.Element {
  return (
    <AlertDialogPrimitive.Description
      className={cn(MODAL_DESCRIPTION_CLASS_NAME, className)}
      data-slot="alert-dialog-description"
      {...props}
    />
  );
}

const AlertDialog = AlertDialogPrimitive.Root;
const AlertDialogAction = AlertDialogPrimitive.Action;
const AlertDialogCancel = AlertDialogPrimitive.Cancel;
const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
};
