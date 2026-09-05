import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation, matchPath } from 'react-router-dom';
import {
  LayoutDashboard, Users, ScanLine, CalendarDays, UserPlus, Bell,
  Wallet, Receipt, ShoppingCart, BarChart3,
  Dumbbell, MessageCircle, DatabaseBackup, Settings, LogOut,
} from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/cn';
import Logo from '../ui/Logo';

/**
 * Primary navigation.
 *
 * Previously sixteen items under headings named after internals rather than the
 * job: "Gate & Attendance", "Action Center", "Profit / Loss", "Import / Export".
 * Renamed to what the person is actually trying to do, and regrouped so the
 * daily-use items sit together at the top.
 */
const NAV = [
  {
    title: 'Daily',
    items: [
      { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { path: '/members', icon: Users, label: 'Members' },
      { path: '/attendance', icon: ScanLine, label: 'Check-in' },
      { path: '/action-center', icon: Bell, label: 'Follow-ups', badgeKey: 'pending' },
      { path: '/classes', icon: CalendarDays, label: 'Classes' },
      { path: '/leads', icon: UserPlus, label: 'Enquiries' },
    ],
  },
  {
    title: 'Money',
    items: [
      { path: '/payments', icon: Wallet, label: 'Payments', end: true, extraActivePaths: ['/payments/add'] },
      { path: '/shop', icon: ShoppingCart, label: 'Shop' },
      { path: '/expenses', icon: Receipt, label: 'Expenses', end: true, extraActivePaths: ['/expenses/add', '/expenses/:id/edit'] },
      { path: '/payments/revenue', icon: BarChart3, label: 'Reports', extraActivePaths: ['/expenses/summary'] },
    ],
  },
  {
    title: 'Manage',
    items: [
      { path: '/staff', icon: Users, label: 'Staff' },
      { path: '/trainers', icon: Dumbbell, label: 'Trainers' },
      { path: '/whatsapp', icon: MessageCircle, label: 'WhatsApp' },
      { path: '/data', icon: DatabaseBackup, label: 'Import & export' },
      { path: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
];

const itemClasses = (active) =>
  cn(
    'group relative flex items-center gap-3 w-full pl-3 pr-2 py-2 rounded-lg text-sm',
    'transition-colors duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset',
    active
      ? 'bg-accent-soft text-accent font-semibold'
      : 'text-body hover:text-heading hover:bg-surface-3 font-medium'
  );

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const fetchCount = async () => {
      try {
        const [pendingRes, notifRes] = await Promise.all([
          api.get('/payments/pending'),
          api.get('/notifications', { params: { status: 'pending' } }),
        ]);
        if (!isMounted) return;

        const members = pendingRes.data.data || [];
        const notifs = notifRes.data.data || [];
        const staffNotifs = notifs.filter((n) => n.notification_type && !n.notification_type.includes('member'));

        setPendingCount(members.length + staffNotifs.length);
      } catch (err) {
        console.error('Failed to calculate follow-up count', err);
      }
    };

    fetchCount();
    window.addEventListener('action-center-updated', fetchCount);
    return () => {
      isMounted = false;
      window.removeEventListener('action-center-updated', fetchCount);
    };
  }, [location.pathname]);

  const isMenuItemActive = (item, isActive) => {
    if (isActive) return true;
    if (!item.extraActivePaths?.length) return false;
    return item.extraActivePaths.some((pathPattern) =>
      Boolean(matchPath({ path: pathPattern, end: true }, location.pathname))
    );
  };

  return (
    <aside
      className={cn(
        'hidden lg:flex flex-col shrink-0',
        'w-(--sidebar-width) h-screen sticky top-0',
        'bg-surface-2 border-r border-line'
      )}
    >
      {/* Product first, workspace second — so the owner knows what they are in. */}
      <div className="flex items-center px-4 h-(--nav-height) border-b border-line shrink-0">
        <Logo subtitle={user?.gym_name} />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-6" aria-label="Main navigation">
        {NAV.map((group) => (
          <div key={group.title} className="flex flex-col gap-0.5">
            <h2 className="px-3 mb-1.5 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-muted/80">
              {group.title}
            </h2>
            {group.items.map((item) => {
              const badge = item.badgeKey === 'pending' ? pendingCount : 0;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.end}
                  className={({ isActive }) => itemClasses(isMenuItemActive(item, isActive))}
                >
                  {({ isActive }) => {
                    const active = isMenuItemActive(item, isActive);
                    return (
                      <>
                        {/* Rail marker: the active row is readable at a glance. */}
                        <span
                          className={cn(
                            'absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full transition-colors',
                            active ? 'bg-accent' : 'bg-transparent'
                          )}
                          aria-hidden="true"
                        />
                        <item.icon className="size-4.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">{item.label}</span>
                        {badge > 0 && (
                          <span
                            className="ml-auto min-w-5 h-5 px-1.5 inline-flex items-center justify-center rounded-full bg-danger text-white text-[0.6875rem] font-bold tabular-nums"
                            aria-label={`${badge} needing attention`}
                          >
                            {badge > 99 ? '99+' : badge}
                          </span>
                        )}
                      </>
                    );
                  }}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-line shrink-0">
        <button
          type="button"
          className={cn(itemClasses(false), 'hover:text-danger hover:bg-danger-soft')}
          onClick={() => {
            logout();
            navigate('/login');
          }}
        >
          <LogOut className="size-4.5 shrink-0" aria-hidden="true" />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
}
