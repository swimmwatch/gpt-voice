import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import type { ComponentProps } from 'react';
import { cn } from '@renderer/lib/cn';
import { FLOATING_LIST_ITEM_CLASS, FLOATING_LIST_SURFACE_CLASS } from './floating-list-styles';

function DropdownMenuContent({
  className,
  sideOffset = 4,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Content>): React.JSX.Element {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        className={cn('min-w-36 overflow-hidden p-1', FLOATING_LIST_SURFACE_CLASS, className)}
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

function DropdownMenuItem({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Item>): React.JSX.Element {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(FLOATING_LIST_ITEM_CLASS, className)}
      data-slot="dropdown-menu-item"
      {...props}
    />
  );
}

function DropdownMenuLabel({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Label>): React.JSX.Element {
  return (
    <DropdownMenuPrimitive.Label
      className={cn('px-2 py-1.5 text-xs font-medium text-muted-foreground', className)}
      data-slot="dropdown-menu-label"
      {...props}
    />
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Separator>): React.JSX.Element {
  return (
    <DropdownMenuPrimitive.Separator
      className={cn('-mx-1 my-1 h-px bg-border', className)}
      data-slot="dropdown-menu-separator"
      {...props}
    />
  );
}

function DropdownMenuTrigger({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Trigger>): React.JSX.Element {
  return (
    <DropdownMenuPrimitive.Trigger
      className={cn('cursor-pointer disabled:cursor-not-allowed', className)}
      data-slot="dropdown-menu-trigger"
      {...props}
    />
  );
}

const DropdownMenu = DropdownMenuPrimitive.Root;
const DropdownMenuGroup = DropdownMenuPrimitive.Group;

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
};
