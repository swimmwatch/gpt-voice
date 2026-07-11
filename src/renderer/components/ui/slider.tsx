import * as SliderPrimitive from '@radix-ui/react-slider';
import type { ComponentProps } from 'react';
import { cn } from '@renderer/lib/cn';

type SliderProps = Omit<ComponentProps<typeof SliderPrimitive.Root>, 'aria-label' | 'children' | 'orientation'> & {
  'aria-label': string;
};

function Slider({ 'aria-label': ariaLabel, className, ...props }: SliderProps): React.JSX.Element {
  return (
    <SliderPrimitive.Root
      className={cn(
        'relative flex w-full touch-none select-none items-center py-2 [-webkit-app-region:no-drag] data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
        className,
      )}
      data-slot="slider"
      orientation="horizontal"
      {...props}
    >
      <SliderPrimitive.Track
        className="relative h-1.5 grow overflow-hidden rounded-full bg-surface-raised"
        data-slot="slider-track"
      >
        <SliderPrimitive.Range className="absolute h-full bg-primary" data-slot="slider-range" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={ariaLabel}
        className="block size-4 shrink-0 rounded-full border-2 border-primary bg-surface shadow-sm outline-none transition-[box-shadow,background-color] duration-[var(--duration-fast)] hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none"
        data-slot="slider-thumb"
      />
    </SliderPrimitive.Root>
  );
}

export { Slider, type SliderProps };
