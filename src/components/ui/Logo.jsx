import { cn } from '../../lib/cn';
import { APP_NAME } from '../../lib/constants';

/**
 * BATGOS brand mark.
 *
 * The product name appeared nowhere in the signed-in app — every surface showed
 * only the customer's own gym name, so a gym owner had no idea what software
 * they were using and there was nothing to recognise or recommend.
 *
 * The glyph is inline SVG rather than an image file so it inherits the live
 * accent colour and stays crisp at any size.
 */

export function LogoMark({ className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center shrink-0 rounded-xl',
        'bg-accent text-accent-contrast',
        'size-9',
        className
      )}
      aria-hidden="true"
    >
      {/* A dumbbell, drawn as one stroke so it reads at 16px as well as 40px. */}
      <svg viewBox="0 0 24 24" fill="none" className="size-5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" stroke="currentColor" strokeWidth="2.2" />
      </svg>
    </span>
  );
}

/**
 * Full lock-up: mark plus wordmark, with optional secondary line.
 *
 * `subtitle` carries the gym's own name, so the hierarchy is explicit —
 * BATGOS is the product, the gym name is the workspace.
 */
export default function Logo({ subtitle, size = 'md', className }) {
  return (
    <span className={cn('flex items-center gap-2.5 min-w-0', className)}>
      <LogoMark className={size === 'sm' ? 'size-8 rounded-lg' : 'size-9'} />
      <span className="flex flex-col min-w-0 leading-tight">
        <span
          className={cn(
            'font-display font-extrabold tracking-[0.14em] text-heading uppercase',
            size === 'sm' ? 'text-xs' : 'text-sm'
          )}
        >
          {APP_NAME}
        </span>
        {subtitle && (
          <span className="text-xs text-muted truncate max-w-[11rem]">{subtitle}</span>
        )}
      </span>
    </span>
  );
}
