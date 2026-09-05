import { Users, LayoutGrid, Building2, AlertTriangle, LayoutDashboard, LogOut, Bell } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/cn';

const GYM_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/members', icon: Users, label: 'Members' },
  { to: '/action-center', icon: Bell, label: 'Follow-ups' },
];

const ADMIN_ITEMS = [
  { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Overview' },
  { to: '/admin/gyms', icon: Building2, label: 'Gyms' },
  { to: '/admin/alerts', icon: AlertTriangle, label: 'Alerts' },
];

const itemClasses = (active) =>
  cn(
    'flex flex-col items-center justify-center gap-1 flex-1 min-w-0 py-2 px-1',
    'text-[0.6875rem] font-semibold transition-colors duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset rounded-lg',
    active ? 'text-accent' : 'text-muted hover:text-body'
  );

/**
 * Mobile tab bar. `pb-safe` keeps it clear of the iPhone home indicator — the
 * previous fixed bar had no safe-area inset and sat underneath it.
 */
export default function BottomNav({ onMoreClick }) {
  const { isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const items = isAdmin ? ADMIN_ITEMS : GYM_ITEMS;

  return (
    <nav
      className={cn(
        'lg:hidden fixed bottom-0 inset-x-0 z-[600]',
        'flex items-stretch',
        'bg-surface-2/95 backdrop-blur-lg border-t border-line',
        'pb-safe'
      )}
      aria-label="Primary"
    >
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => itemClasses(isActive)}>
          <item.icon className="size-5.5" aria-hidden="true" />
          <span className="truncate">{item.label}</span>
        </NavLink>
      ))}

      {isAdmin ? (
        <button
          type="button"
          className={cn(itemClasses(false), 'text-danger hover:text-danger')}
          onClick={() => {
            logout();
            navigate('/login');
          }}
        >
          <LogOut className="size-5.5" aria-hidden="true" />
          <span>Logout</span>
        </button>
      ) : (
        <button type="button" className={itemClasses(false)} onClick={onMoreClick}>
          <LayoutGrid className="size-5.5" aria-hidden="true" />
          <span>More</span>
        </button>
      )}
    </nav>
  );
}
