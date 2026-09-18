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
        'bg-[#152238]',
        'size-9',
        className
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 48 48" className="size-6">
        <rect x="8" y="22.5" width="32" height="3" rx="1.5" fill="#94a3b8"/>
        <rect x="7" y="17" width="4" height="14" rx="2" fill="#cbd5e1"/>
        <rect x="12" y="15" width="4" height="18" rx="2" fill="#cbd5e1"/>
        <rect x="19" y="20" width="3" height="9" rx="1" fill="#84cc16"/>
        <rect x="23.5" y="16" width="3" height="13" rx="1" fill="#9ae626"/>
        <rect x="28" y="12" width="3" height="17" rx="1" fill="#a3e635"/>
        <rect x="33" y="15" width="4" height="18" rx="2" fill="#cbd5e1"/>
        <rect x="38" y="17" width="4" height="14" rx="2" fill="#cbd5e1"/>
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
