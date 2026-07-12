import { Toaster as Sonner, type ToasterProps } from 'sonner';
import { cn } from '@renderer/lib/cn';

function Toaster({ className, toastOptions, ...props }: ToasterProps): React.JSX.Element {
  const classNames = {
    actionButton: 'bg-primary text-primary-foreground hover:bg-primary-hover',
    cancelButton: 'bg-surface-muted text-foreground hover:bg-surface-raised',
    closeButton: 'border-border bg-surface text-muted-foreground hover:bg-surface-muted hover:text-foreground',
    description: 'text-sm text-muted-foreground',
    toast: 'group border-border bg-surface text-foreground shadow-lg [-webkit-app-region:no-drag]',
    ...toastOptions?.classNames,
  };

  return (
    <Sonner
      className={cn('toaster group', className)}
      position="bottom-center"
      theme="dark"
      toastOptions={{ ...toastOptions, classNames }}
      visibleToasts={3}
      {...props}
    />
  );
}

export { Toaster };
