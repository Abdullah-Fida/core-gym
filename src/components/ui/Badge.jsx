import { cn } from '../../lib/cn';

const VARIANTS = {
  neutral: 'bg-surface-3 text-muted border-line',
  accent: 'bg-accent-soft text-accent border-accent/30',
  success: 'bg-success-soft text-success border-success/30',
  warning: 'bg-warning-soft text-warning border-warning/30',
  danger: 'bg-danger-soft text-danger border-danger/30',
  info: 'bg-info-soft text-info border-info/30',
};

const DOTS = {
  neutral: 'bg-muted',
  accent: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
};

/**
 * Status pill.
 *
 * Note `badge-secondary` — the class the members list used for Trial and
 * Inactive members — was never defined in any stylesheet, so those two badges
 * rendered with a border and no colour at all. `neutral` is its replacement.
 */
export default function Badge({ variant = 'neutral', dot = false, className, children, ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 border rounded-full',
        'px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        VARIANTS[variant] ?? VARIANTS.neutral,
        className
      )}
      {...props}
    >
      {dot && <span className={cn('size-1.5 rounded-full shrink-0', DOTS[variant])} aria-hidden="true" />}
      {children}
    </span>
  );
}

/**
 * Single source of truth for how a member's status renders.
 *
 * MembersListPage evaluated the same five-branch ternary chain three times in a
 * row (once for the badge colour, once for the dot, once for the label) and
 * they had already drifted apart.
 */
export const MEMBER_STATUS_BADGE = {
  active: { variant: 'success', label: 'Active' },
  trial: { variant: 'info', label: 'Trial' },
  due_soon: { variant: 'warning', label: 'Due Soon' },
  expired: { variant: 'danger', label: 'Expired' },
  inactive: { variant: 'neutral', label: 'Inactive' },
};

export function MemberStatusBadge({ status, className }) {
  const config = MEMBER_STATUS_BADGE[status] ?? MEMBER_STATUS_BADGE.inactive;
  return (
    <Badge variant={config.variant} dot className={className}>
      {config.label}
    </Badge>
  );
}
