import { createContext, useContext, useId, type ComponentProps, type ReactNode } from 'react';
import { Label } from '@renderer/components/ui/label';
import { cn } from '@renderer/lib/cn';

type FieldContextValue = {
  descriptionId?: string;
  disabled: boolean;
  errorId?: string;
  inputId: string;
  invalid: boolean;
  required: boolean;
};

const FieldContext = createContext<FieldContextValue | null>(null);

type FieldProps = Omit<ComponentProps<'div'>, 'id'> & {
  description?: ReactNode;
  disabled?: boolean;
  error?: ReactNode;
  id?: string;
  label?: ReactNode;
  required?: boolean;
};

function joinAriaDescribedBy(...ids: Array<string | undefined>): string | undefined {
  const uniqueIds = new Set(
    ids.flatMap((id) => {
      const trimmed = id?.trim();
      return trimmed ? [trimmed] : [];
    }),
  );
  const value = [...uniqueIds].join(' ');
  return value || undefined;
}

function useFieldContext(): FieldContextValue | null {
  return useContext(FieldContext);
}

function Field({
  children,
  className,
  description,
  disabled = false,
  error,
  id,
  label,
  required = false,
  ...props
}: FieldProps): React.JSX.Element {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hasDescription = Boolean(description);
  const hasError = Boolean(error);
  const hasLabel = Boolean(label);
  const contextValue: FieldContextValue = {
    descriptionId: hasDescription ? `${inputId}-description` : undefined,
    disabled,
    errorId: hasError ? `${inputId}-error` : undefined,
    inputId,
    invalid: hasError,
    required,
  };

  return (
    <FieldContext.Provider value={contextValue}>
      <div
        className={cn('grid gap-1.5', className)}
        data-disabled={disabled || undefined}
        data-invalid={hasError || undefined}
        data-slot="field"
        {...props}
      >
        {hasLabel ? (
          <Label htmlFor={inputId}>
            {label}
            {required && <span aria-hidden="true"> *</span>}
          </Label>
        ) : null}
        {children}
        {hasDescription && (
          <p className="text-xs text-muted-foreground" id={contextValue.descriptionId}>
            {description}
          </p>
        )}
        {hasError && (
          <p className="text-xs text-destructive" id={contextValue.errorId} role="alert">
            {error}
          </p>
        )}
      </div>
    </FieldContext.Provider>
  );
}

export { Field, joinAriaDescribedBy, type FieldProps, useFieldContext };
