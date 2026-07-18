import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Input } from '@renderer/components/ui/input';
import { cn } from '@renderer/lib/cn';

export interface SearchableSelectOption {
  label: string;
  value: string;
}

interface SearchableSelectInputProps {
  allowCustomValue?: boolean;
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  emptyMessage: string;
  onValueChange: (value: string) => void;
  options: readonly SearchableSelectOption[];
  placeholder: string;
  toggleLabel: string;
  value: string;
}

function normalizeSearchValue(value: string): string {
  return value
    .normalize('NFKD')
    .toLocaleLowerCase()
    .replace(/\p{Diacritic}/gu, '');
}

export function filterSearchableSelectOptions(
  options: readonly SearchableSelectOption[],
  query: string,
): readonly SearchableSelectOption[] {
  const terms = normalizeSearchValue(query).trim().split(/\s+/u).filter(Boolean);
  if (terms.length === 0) return options;

  return options.filter((option) => {
    const searchableValue = normalizeSearchValue(`${option.label} ${option.value}`);
    return terms.every((term) => searchableValue.includes(term));
  });
}

export function getSearchableSelectDisplayValue(options: readonly SearchableSelectOption[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

/** Accessible editable combobox for a finite suggestion list with custom-value support. */
function SearchableSelectInput({
  allowCustomValue = true,
  ariaLabel,
  className,
  disabled = false,
  emptyMessage,
  onValueChange,
  options,
  placeholder,
  toggleLabel,
  value,
}: SearchableSelectInputProps): React.JSX.Element {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [query, setQuery] = useState('');
  const [inputValue, setInputValue] = useState(() => getSearchableSelectDisplayValue(options, value));
  const isEditingRef = useRef(false);
  const filteredOptions = useMemo(() => filterSearchableSelectOptions(options, query), [options, query]);

  useEffect(() => {
    if (!isEditingRef.current) {
      setInputValue(getSearchableSelectDisplayValue(options, value));
    }
  }, [options, value]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event: PointerEvent): void => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);

  const effectiveActiveIndex = activeIndex >= 0 && activeIndex < filteredOptions.length ? activeIndex : -1;

  const selectOption = (option: SearchableSelectOption): void => {
    isEditingRef.current = false;
    onValueChange(option.value);
    setInputValue(option.label);
    setQuery('');
    setIsOpen(false);
    setActiveIndex(-1);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => Math.min(current + 1, filteredOptions.length - 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) =>
        current <= 0 || current >= filteredOptions.length ? filteredOptions.length - 1 : current - 1,
      );
      return;
    }
    if (event.key === 'Enter' && isOpen && effectiveActiveIndex >= 0) {
      event.preventDefault();
      const option = filteredOptions[effectiveActiveIndex];
      if (option) selectOption(option);
      return;
    }
    if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      isEditingRef.current = false;
      setInputValue(getSearchableSelectDisplayValue(options, value));
      setQuery('');
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div className={cn('grid min-w-0', className)} ref={rootRef}>
      <div className="relative min-w-0">
        <Input
          aria-activedescendant={effectiveActiveIndex >= 0 ? `${listboxId}-option-${effectiveActiveIndex}` : undefined}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={isOpen}
          aria-label={ariaLabel}
          autoCapitalize="none"
          autoComplete="off"
          className="pr-10"
          disabled={disabled}
          onBlur={(event) => {
            if (!rootRef.current?.contains(event.relatedTarget)) {
              isEditingRef.current = false;
              setInputValue(getSearchableSelectDisplayValue(options, value));
              setQuery('');
              setIsOpen(false);
            }
          }}
          onChange={(event) => {
            isEditingRef.current = true;
            setInputValue(event.target.value);
            if (allowCustomValue) {
              onValueChange(event.target.value);
            }
            setQuery(event.target.value);
            setIsOpen(true);
            setActiveIndex(0);
          }}
          onFocus={() => {
            setQuery('');
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          ref={inputRef}
          role="combobox"
          spellCheck={false}
          value={inputValue}
        />
        <button
          aria-label={toggleLabel}
          className="absolute inset-y-0 right-0 flex w-10 cursor-pointer items-center justify-center text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled}
          onClick={() => {
            const nextOpen = !isOpen;
            isEditingRef.current = false;
            setInputValue(getSearchableSelectDisplayValue(options, value));
            setQuery('');
            setIsOpen(nextOpen);
            if (nextOpen) inputRef.current?.focus();
          }}
          onMouseDown={(event) => event.preventDefault()}
          tabIndex={-1}
          type="button"
        >
          <ChevronDown aria-hidden="true" className="size-4" />
        </button>
      </div>

      {isOpen && (
        <div
          aria-label={ariaLabel}
          className="mt-1 max-h-60 overflow-y-auto rounded-md border border-border bg-surface p-1 shadow-lg"
          id={listboxId}
          role="listbox"
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, index) => (
              <button
                aria-selected={option.value === value}
                className={cn(
                  'relative flex w-full cursor-pointer items-center rounded-sm py-1.5 pr-8 pl-2 text-left text-sm text-foreground outline-none hover:bg-surface-muted focus:bg-surface-muted',
                  index === effectiveActiveIndex && 'bg-surface-muted',
                )}
                id={`${listboxId}-option-${index}`}
                key={option.value}
                onClick={() => selectOption(option)}
                onMouseDown={(event) => event.preventDefault()}
                role="option"
                tabIndex={-1}
                type="button"
              >
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                <span className="ml-3 shrink-0 text-xs text-muted-foreground">{option.value}</span>
                {option.value === value && <Check aria-hidden="true" className="absolute right-2 size-4" />}
              </button>
            ))
          ) : (
            <p className="px-2 py-3 text-sm text-muted-foreground" role="status">
              {emptyMessage}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default SearchableSelectInput;
