import { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '../lib/cn';

const TOAST_STYLES = {
  success: { icon: CheckCircle2, className: 'border-success/30 bg-success-soft text-success' },
  error: { icon: XCircle, className: 'border-danger/30 bg-danger-soft text-danger' },
  warning: { icon: AlertTriangle, className: 'border-warning/30 bg-warning-soft text-warning' },
  info: { icon: Info, className: 'border-info/30 bg-info-soft text-info' },
};

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  // Date.now() collides when two toasts fire in the same millisecond, which
  // produces duplicate React keys and a dropped toast.
  const nextId = useRef(0);

  const addToast = useCallback((message, type = 'success') => {
    const id = ++nextId.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  const success = useCallback((msg) => addToast(msg, 'success'), [addToast]);
  const error = useCallback((msg) => addToast(msg, 'error'), [addToast]);
  const warning = useCallback((msg) => addToast(msg, 'warning'), [addToast]);
  const info = useCallback((msg) => addToast(msg, 'info'), [addToast]);

  // Memoised: the value literal was rebuilt on every provider render, so every
  // `toast` consumer got a fresh object identity. That is why 16 effects across
  // the app had to omit `toast` from their dependency arrays to avoid looping.
  const value = useMemo(() => ({ success, error, warning, info }), [success, error, warning, info]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/*
        `role="status"` + `aria-live="polite"` on the container: toasts were
        plain <div>s, so a screen reader was never told that a save succeeded
        or failed. The container is always mounted so announcements are not
        missed on first render.
      */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="false"
        className="fixed top-4 right-4 left-4 sm:left-auto z-[500] flex flex-col gap-2 pointer-events-none max-w-sm sm:ml-auto"
      >
        {toasts.map((t) => {
          const style = TOAST_STYLES[t.type] ?? TOAST_STYLES.info;
          const Icon = style.icon;
          return (
            <div
              key={t.id}
              className={cn(
                'flex items-start gap-2.5 p-3 rounded-xl border shadow-pop backdrop-blur-md',
                'text-sm font-medium pointer-events-auto',
                'animate-[ui-rise_200ms_cubic-bezier(0.22,1,0.36,1)]',
                style.className
              )}
            >
              <Icon className="size-4.5 shrink-0 mt-px" aria-hidden="true" />
              <span className="text-body grow">{t.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
