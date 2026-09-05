import { forwardRef, useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn';

const CONTROL = cn(
  'w-full bg-surface-3 border border-line rounded-lg',
  'px-3 py-2.5 text-sm text-heading',
  'placeholder:text-muted/70',
  'transition-colors duration-150',
  'hover:border-line-hover',
  'focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30',
  'disabled:opacity-60 disabled:cursor-not-allowed'
);

/**
 * Label + control + error, wired together.
 *
 * Across the whole app exactly one `<label>` had an `htmlFor`, so clicking a
 * label did nothing and screen readers announced unlabelled inputs. `Field`
 * generates the id and the aria wiring so that cannot regress.
 */
export function Field({ label, hint, error, required, children, className, htmlFor }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-xs font-semibold text-body">
          {label}
          {required && (
            <span className="text-danger ml-0.5" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-muted">{hint}</p>
      )}
    </div>
  );
}

export const Input = forwardRef(function Input(
  { label, hint, error, required, className, id, ...props },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  const control = (
    <input
      ref={ref}
      id={inputId}
      required={required}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${inputId}-error` : undefined}
      className={cn(CONTROL, error && 'border-danger focus:border-danger focus:ring-danger/30', className)}
      {...props}
    />
  );

  if (!label && !hint && !error) return control;
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={inputId}>
      {control}
    </Field>
  );
});

export const Textarea = forwardRef(function Textarea(
  { label, hint, error, required, className, id, rows = 3, ...props },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  const control = (
    <textarea
      ref={ref}
      id={inputId}
      rows={rows}
      required={required}
      aria-invalid={error ? true : undefined}
      className={cn(CONTROL, 'resize-y min-h-20', error && 'border-danger', className)}
      {...props}
    />
  );

  if (!label && !hint && !error) return control;
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={inputId}>
      {control}
    </Field>
  );
});

export const Select = forwardRef(function Select(
  { label, hint, error, required, className, id, children, ...props },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  const control = (
    <div className="relative">
      <select
        ref={ref}
        id={inputId}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cn(CONTROL, 'appearance-none pr-9 cursor-pointer', error && 'border-danger', className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted"
        aria-hidden="true"
      />
    </div>
  );

  if (!label && !hint && !error) return control;
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={inputId}>
      {control}
    </Field>
  );
});
