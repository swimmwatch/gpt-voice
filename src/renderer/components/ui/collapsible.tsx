import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';
import type { ComponentProps } from 'react';
import { cn } from '@renderer/lib/cn';

function CollapsibleTrigger({
  className,
  ...props
}: ComponentProps<typeof CollapsiblePrimitive.Trigger>): React.JSX.Element {
  return (
    <CollapsiblePrimitive.Trigger
      className={cn('cursor-pointer [-webkit-app-region:no-drag]', className)}
      data-slot="collapsible-trigger"
      {...props}
    />
  );
}

function CollapsibleContent({
  className,
  ...props
}: ComponentProps<typeof CollapsiblePrimitive.Content>): React.JSX.Element {
  return (
    <CollapsiblePrimitive.Content
      className={cn('overflow-hidden [-webkit-app-region:no-drag]', className)}
      data-slot="collapsible-content"
      {...props}
    />
  );
}

const Collapsible = CollapsiblePrimitive.Root;

export { Collapsible, CollapsibleContent, CollapsibleTrigger };
