import { cn } from '../../lib/cn';

/**
 * Consistent page title block. Replaces the `.page-header` / `.page-title` /
 * `.page-subtitle` markup that every page re-typed with its own inline
 * `marginBottom` override.
 */
export default function PageHeader({ title, subtitle, actions, back, className }) {
  return (
    <header className={cn('flex flex-wrap items-start justify-between gap-3 mb-6', className)}>
      <div className="min-w-0">
        {back}
        <h1 className="text-2xl sm:text-3xl font-bold text-heading font-display tracking-tight">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}

/** Standard page shell: max width, gutters, and room for the mobile nav. */
export function Page({ className, children, width = 'default' }) {
  return (
    <div
      className={cn(
        'w-full mx-auto px-4 py-5 sm:px-6 sm:py-7',
        'pb-24 lg:pb-8', // clears the fixed bottom nav on mobile
        width === 'default' && 'max-w-(--max-content-width)',
        width === 'narrow' && 'max-w-2xl',
        className
      )}
    >
      {children}
    </div>
  );
}
