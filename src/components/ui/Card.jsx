import { forwardRef } from 'react';
import { cn } from '../../lib/cn';

const PADDING = {
  none: '',
  sm: 'p-3',
  md: 'p-4 sm:p-5',
  lg: 'p-5 sm:p-6',
};

/**
 * Surface container. `interactive` adds the hover/press affordance used by
 * clickable rows — pair it with `as="button"` so the element is actually
 * focusable rather than a clickable <div>.
 */
const Card = forwardRef(function Card(
  { as: Tag = 'div', padding = 'md', interactive = false, className, children, ...props },
  ref
) {
  return (
    <Tag
      ref={ref}
      className={cn(
        'bg-surface-2 border border-line rounded-xl shadow-card',
        PADDING[padding] ?? PADDING.md,
        interactive && [
          'w-full text-left cursor-pointer transition-all duration-150',
          'hover:border-line-hover hover:shadow-pop hover:-translate-y-px',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
        ],
        className
      )}
      {...props}
    >
      {children}
    </Tag>
  );
});

export function CardHeader({ title, subtitle, action, className }) {
  return (
    <div className={cn('flex items-start justify-between gap-3 mb-4', className)}>
      <div className="min-w-0">
        <h2 className="text-base font-bold text-heading truncate">{title}</h2>
        {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export default Card;
