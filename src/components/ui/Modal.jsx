import { useEffect, useRef, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';
import Button from './Button';

const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible dialog.
 *
 * Every modal in the app was previously a bare `<div className="modal-backdrop">`
 * with no role, no focus trap, no Escape handler, no scroll lock and no focus
 * restore — a keyboard user could tab straight out of the dialog into the page
 * behind it, and a screen reader was never told a dialog had opened.
 */
export default function Modal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  children,
  footer,
  closeOnBackdrop = true,
  className,
}) {
  const panelRef = useRef(null);
  const restoreFocusRef = useRef(null);
  const titleId = useId();
  const descId = useId();

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose?.();
        return;
      }
      if (event.key !== 'Tab') return;

      const nodes = panelRef.current?.querySelectorAll(FOCUSABLE);
      if (!nodes?.length) return;

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return undefined;

    restoreFocusRef.current = document.activeElement;

    // Lock background scroll, compensating for the scrollbar so the page
    // behind does not visibly shift when the dialog opens.
    const { body } = document;
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = body.style.overflow;
    const prevPadding = body.style.paddingRight;
    body.style.overflow = 'hidden';
    if (scrollBarWidth > 0) body.style.paddingRight = `${scrollBarWidth}px`;

    // Move focus into the dialog.
    const raf = requestAnimationFrame(() => {
      const target = panelRef.current?.querySelector(FOCUSABLE) ?? panelRef.current;
      target?.focus();
    });

    return () => {
      cancelAnimationFrame(raf);
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPadding;
      restoreFocusRef.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[400] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onKeyDown={handleKeyDown}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-[ui-fade-in_150ms_ease-out]"
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          'relative w-full bg-elevated border border-line shadow-modal',
          'animate-[ui-rise_180ms_cubic-bezier(0.22,1,0.36,1)]',
          'rounded-t-2xl sm:rounded-2xl',
          'max-h-[90vh] flex flex-col outline-none',
          SIZES[size] ?? SIZES.md,
          className
        )}
      >
        {(title || onClose) && (
          <div className="flex items-start justify-between gap-4 p-5 pb-3 shrink-0">
            <div className="min-w-0">
              {title && (
                <h2 id={titleId} className="text-lg font-bold text-heading font-display">
                  {title}
                </h2>
              )}
              {description && (
                <p id={descId} className="text-sm text-muted mt-1">
                  {description}
                </p>
              )}
            </div>
            {onClose && (
              <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close dialog">
                <X className="size-4" aria-hidden="true" />
              </Button>
            )}
          </div>
        )}

        <div className="px-5 pb-5 overflow-y-auto grow">{children}</div>

        {footer && (
          <div className="flex gap-2 p-5 pt-3 border-t border-line shrink-0 pb-safe sm:pb-5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
