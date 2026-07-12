import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { createContext, use, useEffect, useState, type ComponentProps } from 'react';
import { cn } from '@renderer/lib/cn';
import { shouldDismissTooltipForPointerExit } from '@renderer/tooltipDismissal';

const TooltipDismissalContext = createContext(0);

function TooltipProvider({
  children,
  delayDuration = 300,
  disableHoverableContent = true,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Provider>): React.JSX.Element {
  const [dismissalVersion, setDismissalVersion] = useState(0);

  useEffect(() => {
    const dismissTooltips = (): void => {
      setDismissalVersion((currentVersion) => currentVersion + 1);
    };
    const handlePointerExit = (event: MouseEvent | PointerEvent): void => {
      if (shouldDismissTooltipForPointerExit(event.relatedTarget)) {
        dismissTooltips();
      }
    };

    window.addEventListener('blur', dismissTooltips);
    window.addEventListener('mouseout', handlePointerExit);
    document.addEventListener('pointerout', handlePointerExit);

    return () => {
      window.removeEventListener('blur', dismissTooltips);
      window.removeEventListener('mouseout', handlePointerExit);
      document.removeEventListener('pointerout', handlePointerExit);
    };
  }, []);

  return (
    <TooltipDismissalContext value={dismissalVersion}>
      <TooltipPrimitive.Provider
        data-slot="tooltip-provider"
        delayDuration={delayDuration}
        disableHoverableContent={disableHoverableContent}
        {...props}
      >
        {children}
      </TooltipPrimitive.Provider>
    </TooltipDismissalContext>
  );
}

function Tooltip({ ...props }: ComponentProps<typeof TooltipPrimitive.Root>): React.JSX.Element {
  const dismissalVersion = use(TooltipDismissalContext);

  return <TooltipPrimitive.Root key={dismissalVersion} data-slot="tooltip" {...props} />;
}

function TooltipTrigger({ ...props }: ComponentProps<typeof TooltipPrimitive.Trigger>): React.JSX.Element {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  sideOffset = 6,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Content>): React.JSX.Element {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        className={cn(
          'z-50 max-w-60 rounded-md border border-border bg-surface px-2 py-1 text-xs text-foreground shadow-lg',
          className,
        )}
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
