import { cn } from '../../lib/cn';

const TONES = {
  accent: 'bg-accent-soft text-accent',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  neutral: 'bg-surface-3 text-muted',
};

const SIZES = {
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-14 text-lg',
};

/**
 * Initials avatar. The members list computed these colours inline with a
 * four-branch ternary on both `background` and `color`, duplicated per row.
 */
export default function Avatar({ name, tone = 'accent', size = 'md', className }) {
  const initials =
    String(name ?? '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || '?';

  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex items-center justify-center rounded-full font-bold shrink-0 select-none',
        TONES[tone] ?? TONES.accent,
        SIZES[size] ?? SIZES.md,
        className
      )}
    >
      {initials}
    </span>
  );
}
