import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { APP_NAME } from '../../lib/constants';
import { LogoMark } from '../../components/ui/Logo';

/**
 * Centred card used by the password-recovery screens. They previously
 * referenced `.auth-card` and `.auth-logo`, neither of which was defined in
 * any stylesheet — so both pages rendered as unstyled stacked markup.
 */
export default function AuthShell({ title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8">
          <LogoMark className="size-10 rounded-xl" />
          <span className="text-base font-extrabold uppercase tracking-[0.16em] text-heading font-display">
            {APP_NAME}
          </span>
        </div>

        <h1 className="text-2xl font-bold text-heading font-display">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-1.5">{subtitle}</p>}

        <div className="mt-6">{children}</div>

        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 mt-8 text-sm font-semibold text-muted hover:text-accent transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
