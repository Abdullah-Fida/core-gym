import { cn } from '../../lib/cn';

/**
 * Filter / segment control.
 *
 * `.filter-tab.active` hard-coded `color: #041017` — fine on the blue accent,
 * unreadable on the amber and lime presets. It now uses `--accent-contrast`,
 * which each theme defines for itself.
 */
export default function Tabs({ items, value, onChange, className, size = 'md' }) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center gap-1 p-1 bg-surface-2 border border-line rounded-lg',
        'overflow-x-auto max-w-full',
        className
      )}
    >
      {items.map((item) => {
        const active = item.key === value;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.key)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md font-semibold whitespace-nowrap',
              'transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              // Touch screens get a 44px row; desktop keeps the compact height.
              'pointer-coarse:min-h-11 pointer-coarse:px-4 pointer-coarse:text-sm',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
              active
                ? 'bg-accent text-accent-contrast'
                : 'text-muted hover:text-body hover:bg-surface-3'
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 text-[0.6875rem] tabular-nums',
                  active ? 'bg-black/15' : 'bg-surface-3 text-muted'
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
