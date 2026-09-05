import { useId } from 'react';
import { cn } from '../../lib/cn';

/**
 * Switch control.
 *
 * Built on a real checkbox rather than the previous `.form-toggle` + `.slider`
 * span pair, so it is focusable, announces its checked state, and responds to
 * the space bar.
 */
export default function Toggle({ label, description, checked, onChange, id, className, disabled }) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className={cn('flex items-center justify-between gap-4', className)}>
      <label htmlFor={inputId} className="flex flex-col cursor-pointer min-w-0">
        <span className="text-sm font-semibold text-body">{label}</span>
        {description && <span className="text-xs text-muted mt-0.5">{description}</span>}
      </label>

      <span className="relative inline-flex shrink-0">
        <input
          id={inputId}
          type="checkbox"
          role="switch"
          checked={Boolean(checked)}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className={cn(
            'block w-11 h-6 rounded-full bg-surface-3 border border-line',
            'transition-colors duration-200 cursor-pointer',
            'peer-checked:bg-accent peer-checked:border-accent',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface',
            'peer-disabled:opacity-50 peer-disabled:cursor-not-allowed',
            "after:content-[''] after:absolute after:top-1 after:left-1",
            'after:size-4 after:rounded-full after:bg-muted',
            'after:transition-transform after:duration-200',
            'peer-checked:after:translate-x-5 peer-checked:after:bg-accent-contrast'
          )}
        />
      </span>
    </div>
  );
}
