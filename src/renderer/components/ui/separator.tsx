import type { ComponentProps } from 'react';
import { cn } from '@renderer/lib/cn';

type SeparatorProps = Omit<ComponentProps<'div'>, 'role'> & {
  decorative?: boolean;
  orientation?: 'horizontal' | 'vertical';
};

function Separator({
  className,
  decorative = true,
  orientation = 'horizontal',
  ...props
}: SeparatorProps): React.JSX.Element {
  return (
    <div
      aria-orientation={decorative ? undefined : orientation}
      className={cn('shrink-0 bg-border', orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px', className)}
      data-orientation={orientation}
      data-slot="separator"
      role={decorative ? undefined : 'separator'}
      {...props}
    />
  );
}

export { Separator, type SeparatorProps };
