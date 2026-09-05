import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/cn';
import Button from './Button';

/**
 * Empty / error / loading states.
 *
 * The previous `StateView` referenced thirteen CSS classes
 * (`.status-view`, `.status-view-title`, `.btn-retry`, …) that were defined in
 * no stylesheet in the repo. Every "no results" and "something went wrong"
 * screen in the app therefore rendered as unstyled browser-default HTML —
 * a left-aligned h3, a p, and a grey system button.
 */
export function EmptyState({ icon: Icon = Inbox, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-14 px-6', className)}>
      <div className="flex items-center justify-center size-14 rounded-2xl bg-surface-3 text-muted mb-4">
        <Icon className="size-6" aria-hidden="true" />
      </div>
      <h3 className="text-base font-bold text-heading">{title}</h3>
      {description && <p className="text-sm text-muted mt-1.5 max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', description, onRetry, className }) {
  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center justify-center text-center py-14 px-6', className)}
    >
      <div className="flex items-center justify-center size-14 rounded-2xl bg-danger-soft text-danger mb-4">
        <AlertTriangle className="size-6" aria-hidden="true" />
      </div>
      <h3 className="text-base font-bold text-heading">{title}</h3>
      {description && <p className="text-sm text-muted mt-1.5 max-w-sm">{description}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry}>
          <RefreshCw className="size-3.5" aria-hidden="true" />
          Try again
        </Button>
      )}
    </div>
  );
}

export function Skeleton({ className }) {
  return (
    <div
      className={cn(
        'rounded-md bg-surface-3 relative overflow-hidden',
        'after:absolute after:inset-0 after:-translate-x-full',
        'after:bg-gradient-to-r after:from-transparent after:via-white/5 after:to-transparent',
        'after:animate-[ui-shimmer_1.6s_infinite]',
        className
      )}
      aria-hidden="true"
    />
  );
}

/** Placeholder matching the shape of a member/staff list row. */
export function ListSkeleton({ rows = 5, className }) {
  return (
    <div className={cn('flex flex-col gap-2', className)} aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 p-4 bg-surface-2 border border-line rounded-xl">
          <Skeleton className="size-10 rounded-full shrink-0" />
          <div className="flex flex-col gap-2 grow min-w-0">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full shrink-0" />
        </div>
      ))}
    </div>
  );
}

/**
 * Placeholder matching a grid of cards.
 *
 * The shop and plans pages render a card grid but showed `ListSkeleton`'s
 * stacked rows while loading, so the layout visibly jumped once data arrived.
 */
export function GridSkeleton({ items = 6, className }) {
  return (
    <div
      className={cn('grid grid-cols-2 sm:grid-cols-3 gap-2', className)}
      aria-hidden="true"
    >
      {Array.from({ length: items }, (_, i) => (
        <div key={i} className="p-4 bg-surface-2 border border-line rounded-xl flex flex-col gap-2">
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-3 w-2/5" />
        </div>
      ))}
    </div>
  );
}

export function Spinner({ className, label = 'Loading' }) {
  return (
    <span role="status" aria-label={label} className={cn('inline-flex', className)}>
      <span className="size-5 rounded-full border-2 border-line border-t-accent animate-spin" />
    </span>
  );
}

/**
 * The loading / error / empty / content decision, in one place.
 *
 * Every list page reimplemented this ternary chain independently, each with
 * slightly different behaviour. Pass `data === null` (or `undefined`) to mean
 * "still loading" — the sentinel the pages already use.
 */
export function AsyncBoundary({
  loading,
  error,
  onRetry,
  isEmpty,
  empty,
  skeleton,
  children,
}) {
  if (loading) return skeleton ?? <ListSkeleton />;
  if (error) {
    return (
      <ErrorState
        description={typeof error === 'string' ? error : error?.message}
        onRetry={onRetry}
      />
    );
  }
  if (isEmpty) return empty ?? <EmptyState title="Nothing here yet" />;
  return children;
}
