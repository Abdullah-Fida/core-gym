import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn';

const VARIANTS = {
  primary:
    'bg-accent text-accent-contrast hover:bg-accent-hover shadow-accent border border-transparent',
  secondary:
    'bg-surface-2 text-body border border-line hover:border-line-strong hover:bg-surface-3',
  ghost:
    'bg-transparent text-muted border border-transparent hover:bg-surface-2 hover:text-body',
  danger:
    'bg-danger text-white hover:brightness-110 border border-transparent',
  'danger-soft':
    'bg-danger-soft text-danger border border-danger/25 hover:border-danger/50',
  success:
    'bg-success text-white hover:brightness-110 border border-transparent',
  outline:
    'bg-transparent text-accent border border-accent/40 hover:bg-accent-soft hover:border-accent',
};

const SIZES = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-md',
  md: 'h-10 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-12 px-6 text-base gap-2 rounded-lg',
  icon: 'h-10 w-10 p-0 rounded-lg',
  'icon-sm': 'h-8 w-8 p-0 rounded-md',
};

/**
 * The app's button. Replaces ~200 hand-rolled `<button className="btn ...">`
 * elements that were each re-specifying padding, radius and colour inline.
 *
 * `loading` disables the button and swaps in a spinner while preserving width,
 * so submit buttons no longer resize mid-request.
 */
const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    block = false,
    className,
    children,
    type = 'button',
    ...props
  },
  ref
) {
  const isIcon = size === 'icon' || size === 'icon-sm';

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center font-semibold whitespace-nowrap',
        'transition-colors duration-150 ease-out cursor-pointer select-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
        VARIANTS[variant] ?? VARIANTS.primary,
        SIZES[size] ?? SIZES.md,
        block && 'w-full',
        className
      )}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className={cn('animate-spin', isIcon ? 'size-4' : 'size-4 shrink-0')} aria-hidden="true" />
          {!isIcon && <span>{children}</span>}
        </>
      ) : (
        children
      )}
    </button>
  );
});

export default Button;
