import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cn } from '../../lib/cn';

/** "← Back" affordance above a page title. */
export default function BackLink({ to, label = 'Back', className }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => (to ? navigate(to) : navigate(-1))}
      className={cn(
        'inline-flex items-center gap-1.5 mb-2 -ml-1 px-1 py-0.5 rounded',
        'text-xs font-semibold text-muted transition-colors hover:text-accent',
        // 20px tall on a phone otherwise — the smallest target in the app.
        'pointer-coarse:min-h-11 pointer-coarse:px-2 pointer-coarse:text-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        className
      )}
    >
      <ArrowLeft className="size-3.5" aria-hidden="true" />
      {label}
    </button>
  );
}
