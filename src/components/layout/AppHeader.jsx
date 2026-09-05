import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Settings, LogOut, Sun, Moon, ChevronDown, Plus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getActiveMode, toggleMode } from '../../lib/theme';
import { APP_NAME } from '../../lib/constants';
import Button from '../ui/Button';
import { LogoMark } from '../ui/Logo';
import { cn } from '../../lib/cn';

/**
 * Sticky top bar, shared by GymLayout and AdminLayout.
 *
 * It used to repeat the gym name that the sidebar already shows, next to three
 * unlabelled icons. That is a wasted row on every screen: the name is now in
 * the sidebar only, and this bar carries where you are plus the actions you
 * actually reach for.
 */

/** Route → readable title. Keeps the bar meaningful without a router config. */
const TITLES = [
  ['/members/add', 'Add member'],
  ['/members', 'Members'],
  ['/attendance', 'Check-in'],
  ['/action-center', 'Follow-ups'],
  ['/classes', 'Classes'],
  ['/leads', 'Enquiries'],
  ['/payments/add', 'Log payment'],
  ['/payments/revenue', 'Reports'],
  ['/payments', 'Payments'],
  ['/shop', 'Shop'],
  ['/expenses/summary', 'Profit and loss'],
  ['/expenses/add', 'Add expense'],
  ['/expenses', 'Expenses'],
  ['/staff', 'Staff'],
  ['/trainers', 'Trainers'],
  ['/whatsapp', 'WhatsApp'],
  ['/data', 'Import & export'],
  ['/settings', 'Settings'],
  ['/dashboard', 'Dashboard'],
  ['/admin/dashboard', 'Platform overview'],
  ['/admin/gyms', 'Gyms'],
  ['/admin/plans', 'Plans'],
  ['/admin/subscriptions', 'Subscriptions'],
  ['/admin/payments', 'Platform payments'],
  ['/admin/alerts', 'Alerts'],
];

const titleFor = (pathname) => TITLES.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? '';

/** Primary action for the page you are on, so the common job is one tap away. */
const QUICK_ACTION = [
  ['/members', { label: 'Add member', to: '/members/add' }],
  ['/payments', { label: 'Log payment', to: '/payments/add' }],
  ['/expenses', { label: 'Add expense', to: '/expenses/add' }],
];

export default function AppHeader({ homePath = '/', badge, settingsPath }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState(getActiveMode);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const isDark = mode !== 'light';
  const pageTitle = titleFor(location.pathname);

  const quick = QUICK_ACTION.find(
    ([prefix]) => location.pathname === prefix
  )?.[1];

  // Close the menu on an outside click or Escape, the way a menu is expected to.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const initials = (user?.name || user?.gym_name || 'B')
    .split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  return (
    <header
      className={cn(
        'sticky top-0 z-200 shrink-0',
        'h-(--nav-height) px-4 sm:px-6',
        'flex items-center justify-between gap-3',
        'bg-glass backdrop-blur-xl border-b border-line'
      )}
    >
      {/* On mobile the sidebar is hidden, so the brand lives here instead. */}
      <button
        type="button"
        onClick={() => navigate(homePath)}
        className={cn(
          'flex items-center gap-2.5 min-w-0 rounded-lg -ml-1 px-1 py-1',
          'transition-colors hover:bg-surface-3',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
        )}
      >
        <span className="lg:hidden flex items-center gap-2.5">
          <LogoMark className="size-8 rounded-lg" />
          <span className="font-display font-extrabold tracking-[0.14em] text-heading uppercase text-xs">
            {APP_NAME}
          </span>
        </span>
        {/* Shown on mobile only. On desktop the page's own <PageHeader> carries
            the title, and repeating it here just used the row twice. */}
        {pageTitle && (
          <span className="lg:hidden text-sm font-semibold text-muted truncate">
            {pageTitle}
          </span>
        )}
        {badge}
      </button>

      <div className="flex items-center gap-1.5 shrink-0">
        {quick && (
          <Button size="sm" className="hidden sm:inline-flex" onClick={() => navigate(quick.to)}>
            <Plus className="size-4" aria-hidden="true" />
            {quick.label}
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMode(toggleMode())}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Moon className="size-4.5" aria-hidden="true" /> : <Sun className="size-4.5" aria-hidden="true" />}
        </Button>

        {/* Account menu. Settings and Log out were bare icons with no labels —
            unguessable, and invisible entirely on mobile. */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className={cn(
              'flex items-center gap-1.5 pl-1 pr-1.5 py-1 rounded-lg',
              'transition-colors hover:bg-surface-3',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
            )}
          >
            <span className="flex items-center justify-center size-8 rounded-lg bg-surface-3 text-body text-xs font-bold">
              {initials}
            </span>
            <ChevronDown className="size-3.5 text-muted" aria-hidden="true" />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className={cn(
                'absolute right-0 top-full mt-1.5 w-56 z-210',
                'bg-elevated border border-line rounded-xl shadow-modal p-1.5',
                'animate-[ui-rise_120ms_ease-out]'
              )}
            >
              <div className="px-2.5 py-2 border-b border-line mb-1">
                <p className="text-sm font-semibold text-heading truncate">{user?.name || 'Signed in'}</p>
                <p className="text-xs text-muted truncate">{user?.email}</p>
                {user?.gym_name && (
                  <p className="text-xs text-muted truncate mt-0.5">{user.gym_name}</p>
                )}
              </div>

              {settingsPath && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setMenuOpen(false); navigate(settingsPath); }}
                  className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-sm text-body hover:bg-surface-3 hover:text-heading transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <Settings className="size-4" aria-hidden="true" />
                  Settings
                </button>
              )}

              <button
                type="button"
                role="menuitem"
                onClick={() => { logout(); navigate('/login'); }}
                className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-sm text-body hover:bg-danger-soft hover:text-danger transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <LogOut className="size-4" aria-hidden="true" />
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
