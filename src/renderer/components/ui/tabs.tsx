import * as TabsPrimitive from '@radix-ui/react-tabs';
import type { ComponentProps } from 'react';
import { cn } from '@renderer/lib/cn';

type TabsTriggerProps = ComponentProps<typeof TabsPrimitive.Trigger> & {
  iconOnly?: boolean;
};

function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>): React.JSX.Element {
  return (
    <TabsPrimitive.List
      className={cn(
        'inline-flex min-h-10 items-center gap-1 rounded-md bg-surface p-1 ring-1 ring-border data-[orientation=vertical]:h-auto data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch',
        className,
      )}
      data-slot="tabs-list"
      {...props}
    />
  );
}

function TabsTrigger({ className, iconOnly = false, ...props }: TabsTriggerProps): React.JSX.Element {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'inline-flex h-8 cursor-pointer items-center justify-center gap-2 rounded-sm px-3 text-sm font-medium text-muted-foreground outline-none transition-colors duration-[var(--duration-fast)] hover:bg-surface-raised hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary aria-selected:bg-surface-raised aria-selected:text-foreground aria-selected:ring-1 aria-selected:ring-primary data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[icon-only=true]:size-8 data-[icon-only=true]:px-0 data-[orientation=vertical]:justify-start',
        className,
      )}
      data-icon-only={iconOnly || undefined}
      data-slot="tabs-trigger"
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>): React.JSX.Element {
  return (
    <TabsPrimitive.Content
      className={cn('mt-3 outline-none focus-visible:ring-2 focus-visible:ring-primary', className)}
      data-slot="tabs-content"
      {...props}
    />
  );
}

const Tabs = TabsPrimitive.Root;

export { Tabs, TabsContent, TabsList, TabsTrigger, type TabsTriggerProps };
