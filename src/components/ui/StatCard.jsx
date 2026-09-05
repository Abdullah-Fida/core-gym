import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Skeleton } from './States';

const TONES = {
  accent: { bar: 'bg-accent', icon: 'bg-accent-soft text-accent' },
  success: { bar: 'bg-success', icon: 'bg-success-soft text-success' },
  warning: { bar: 'bg-warning', icon: 'bg-warning-soft text-warning' },
  danger: { bar: 'bg-danger', icon: 'bg-danger-soft text-danger' },
  info: { bar: 'bg-info', icon: 'bg-info-soft text-info' },
};

/**
 * KPI tile.
 *
 * The dashboard repeated this card body three times as near-identical IIFEs,
 * and one of the four siblings broke the pattern with an inline
 * `borderTop: '4px solid #fbbf24'` while the others used modifier classes.
 */
export default function StatCard({
  label,
  value,
  tone = 'accent',
  icon: Icon,
  delta,
  deltaLabel,
  footer,
  loading = false,
  className,
  children,
}) {
  const t = TONES[tone] ?? TONES.accent;
  const deltaUp = typeof delta === 'number' && delta > 0;
  const deltaDown = typeof delta === 'number' && delta < 0;

  return (
    <div
      className={cn(
        'relative bg-surface-2 border border-line rounded-xl p-4 overflow-hidden',
        'shadow-card',
        className
      )}
    >
      <span className={cn('absolute inset-x-0 top-0 h-1', t.bar)} aria-hidden="true" />

      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
        {Icon && (
          <span className={cn('flex items-center justify-center size-8 rounded-lg shrink-0', t.icon)}>
            <Icon className="size-4" aria-hidden="true" />
          </span>
        )}
      </div>

      {loading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <p className="text-2xl font-bold text-heading font-display tabular-nums leading-none">{value}</p>
      )}

      {(delta !== undefined || deltaLabel) && !loading && (
        <p
          className={cn(
            'flex items-center gap-1 text-xs font-semibold mt-2',
            deltaUp && 'text-success',
            deltaDown && 'text-danger',
            !deltaUp && !deltaDown && 'text-muted'
          )}
        >
          {deltaUp && <TrendingUp className="size-3.5" aria-hidden="true" />}
          {deltaDown && <TrendingDown className="size-3.5" aria-hidden="true" />}
          {deltaLabel}
        </p>
      )}

      {footer && <div className="mt-3 pt-3 border-t border-line">{footer}</div>}
      {children}
    </div>
  );
}
