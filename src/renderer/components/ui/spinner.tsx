import { LoaderCircle } from 'lucide-react';
import { type ComponentProps, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@renderer/lib/cn';

const PROGRESS_CIRCLE_RADIUS = 9;
const PROGRESS_CIRCLE_CIRCUMFERENCE = 2 * Math.PI * PROGRESS_CIRCLE_RADIUS;

const spinnerVariants = cva('inline-flex shrink-0 items-center justify-center text-muted-foreground', {
  defaultVariants: {
    size: 'default',
  },
  variants: {
    size: {
      default: 'size-5',
      lg: 'size-6',
      sm: 'size-4',
    },
  },
});

type SpinnerProps = Omit<ComponentProps<'span'>, 'aria-label' | 'role'> &
  VariantProps<typeof spinnerVariants> & {
    /** Shows an indeterminate operation indicator while work is in progress. */
    active?: boolean;
    /** Keeps the indicator decorative when its parent already provides the operation status. */
    announce?: boolean;
    /** Content to restore after an active operation has visibly completed. */
    fallback?: ReactNode;
    label: string;
  };

type ProgressSpinnerProps = Omit<SpinnerProps, 'active' | 'fallback'> & {
  /** A measured completion percentage for an operation with a known total. */
  progress: number;
};

function normalizeProgress(progress: number): number {
  return Math.max(0, Math.min(100, progress));
}

/** Renders the established indeterminate loader for work whose completion cannot be measured. */
function Spinner({
  active,
  announce = true,
  className,
  fallback,
  label,
  size,
  ...props
}: SpinnerProps): React.JSX.Element {
  const tracksOperation = active !== undefined;
  if (tracksOperation && !active) return <>{fallback ?? null}</>;

  return (
    <span
      className={cn(spinnerVariants({ size }), className)}
      data-progress-state={tracksOperation ? 'indeterminate' : undefined}
      data-slot="spinner"
      {...props}
      aria-hidden={announce ? undefined : true}
      aria-label={announce ? label : undefined}
      role={announce ? 'status' : undefined}
    >
      <LoaderCircle aria-hidden="true" className="size-full animate-spin motion-reduce:animate-none" />
    </span>
  );
}

/** Renders measured progress only; callers must supply a value derived from completed work and its known total. */
function ProgressSpinner({
  announce = true,
  className,
  label,
  progress,
  size,
  ...props
}: ProgressSpinnerProps): React.JSX.Element {
  const normalizedProgress = normalizeProgress(progress);
  const roundedProgress = Math.round(normalizedProgress);
  const dashOffset = PROGRESS_CIRCLE_CIRCUMFERENCE * (1 - normalizedProgress / 100);

  return (
    <span
      className={cn(spinnerVariants({ size }), className)}
      data-progress-state="determinate"
      data-slot="spinner"
      {...props}
      aria-hidden={announce ? undefined : true}
      aria-label={announce ? label : undefined}
      aria-valuemax={announce ? 100 : undefined}
      aria-valuemin={announce ? 0 : undefined}
      aria-valuenow={announce ? roundedProgress : undefined}
      aria-valuetext={announce ? `${label}: ${roundedProgress}%` : undefined}
      role={announce ? 'progressbar' : undefined}
    >
      <svg aria-hidden="true" className="size-full" viewBox="0 0 24 24">
        <circle
          cx="12"
          cy="12"
          fill="none"
          opacity="0.2"
          r={PROGRESS_CIRCLE_RADIUS}
          stroke="currentColor"
          strokeWidth="2"
        />
        <circle
          cx="12"
          cy="12"
          fill="none"
          r={PROGRESS_CIRCLE_RADIUS}
          stroke="currentColor"
          strokeDasharray={PROGRESS_CIRCLE_CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          strokeWidth="2"
          transform="rotate(-90 12 12)"
        />
      </svg>
    </span>
  );
}

export { ProgressSpinner, Spinner, spinnerVariants, type ProgressSpinnerProps, type SpinnerProps };
