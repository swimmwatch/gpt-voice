import { useCallback, useRef, useState, type ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@renderer/components/ui/alert-dialog';
import { Button } from '@renderer/components/ui/button';
import { Spinner } from '@renderer/components/ui/spinner';

export type ConfirmationDialogActionTone = 'destructive' | 'primary';

export interface ConfirmationDialogProps {
  readonly actionIcon?: ReactNode;
  readonly cancelLabel: string;
  readonly children?: ReactNode;
  readonly confirmLabel: string;
  readonly description: ReactNode;
  readonly onConfirm: () => boolean | Promise<boolean>;
  readonly onOpenChange: (open: boolean) => void;
  readonly onPendingChange?: (pending: boolean) => void;
  readonly open: boolean;
  readonly pendingLabel?: string;
  readonly title: ReactNode;
  readonly tone: ConfirmationDialogActionTone;
}

/** Resolves feature-owned confirmation work without rendering a rejected error value. */
export async function resolveConfirmationAction(onConfirm: ConfirmationDialogProps['onConfirm']): Promise<boolean> {
  try {
    return (await onConfirm()) === true;
  } catch {
    return false;
  }
}

/** Composes a controlled confirmation that closes only after successful asynchronous work. */
export function ConfirmationDialog({
  actionIcon,
  cancelLabel,
  children,
  confirmLabel,
  description,
  onConfirm,
  onOpenChange,
  onPendingChange,
  open,
  pendingLabel,
  title,
  tone,
}: ConfirmationDialogProps): React.JSX.Element {
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);

  const publishPending = useCallback(
    (nextPending: boolean): void => {
      pendingRef.current = nextPending;
      setPending(nextPending);
      onPendingChange?.(nextPending);
    },
    [onPendingChange],
  );

  const handleOpenChange = useCallback(
    (nextOpen: boolean): void => {
      if (!nextOpen && pendingRef.current) return;
      onOpenChange(nextOpen);
    },
    [onOpenChange],
  );

  const confirm = useCallback(async (): Promise<void> => {
    if (pendingRef.current) return;
    publishPending(true);
    const succeeded = await resolveConfirmationAction(onConfirm);
    publishPending(false);
    if (succeeded) onOpenChange(false);
  }, [onConfirm, onOpenChange, publishPending]);

  const actionLabel = pending ? (pendingLabel ?? confirmLabel) : confirmLabel;

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button disabled={pending} variant="outline">
              {cancelLabel}
            </Button>
          </AlertDialogCancel>
          <Button
            aria-busy={pending || undefined}
            className={pending ? 'disabled:cursor-wait disabled:opacity-100' : undefined}
            disabled={pending}
            onClick={() => void confirm()}
            variant={tone}
          >
            {pending ? <Spinner announce={false} label={actionLabel} size="sm" /> : actionIcon}
            {actionLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
