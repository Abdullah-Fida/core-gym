import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Building2, AlertTriangle, CreditCard, LogOut, Receipt, Layers } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { APP_NAME } from '../../lib/constants';
import { LogoMark } from '../ui/Logo';
import BottomNav from './BottomNav';
import AppHeader from './AppHeader';
import Button from '../ui/Button';
import { cn } from '../../lib/cn';

const NAV_SECTIONS = [
  {
    title: 'Overview',
    items: [
      { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/admin/gyms', icon: Building2, label: 'All Gyms' },
    ],
  },
  {
    title: 'Management',
    items: [
      { to: '/admin/alerts', icon: AlertTriangle, label: 'Alerts' },
      { to: '/admin/subscriptions', icon: CreditCard, label: 'Subscriptions' },
      { to: '/admin/plans', icon: Layers, label: 'Plans' },
      { to: '/admin/payments', icon: Receipt, label: 'Platform Payments' },
    ],
  },
];

const itemClasses = (active) =>
  cn(
    'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset',
    active ? 'bg-accent-soft text-accent font-semibold' : 'text-muted hover:text-heading hover:bg-surface-3'
  );

export default function AdminLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen bg-surface">
      {/*
        The old sidebar had an `open` state driven by a hamburger button, but
        `layout.css` set `.admin-sidebar { display: none !important }` below
        1024px — the !important won, so the toggle did nothing on mobile. Admin
        navigation on small screens goes through BottomNav instead, which is
        what actually worked.
      */}
      <aside className="hidden lg:flex flex-col shrink-0 w-(--sidebar-width) h-screen sticky top-0 bg-surface-2 border-r border-line">
        <div className="flex items-center gap-3 px-4 h-(--nav-height) border-b border-line shrink-0">
          <LogoMark />
          <div className="min-w-0">
            <p className="text-sm font-extrabold uppercase tracking-[0.14em] text-heading font-display truncate leading-tight">
              {APP_NAME}
            </p>
            <p className="flex items-center gap-1.5 text-[0.625rem] font-bold uppercase tracking-wider text-accent">
              <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
              Super Admin
            </p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-5" aria-label="Admin navigation">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="flex flex-col gap-0.5">
              <h2 className="px-3 mb-1 text-[0.6875rem] font-bold uppercase tracking-wider text-muted">
                {section.title}
              </h2>
              {section.items.map((item) => (
                <NavLink key={item.to} to={item.to} className={({ isActive }) => itemClasses(isActive)}>
                  <item.icon className="size-5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-line shrink-0">
          <Button
            variant="secondary"
            size="sm"
            block
            className="hover:text-danger hover:border-danger/40"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            <LogOut className="size-4" aria-hidden="true" />
            Logout
          </Button>
        </div>
      </aside>

      <div className="flex flex-col grow min-w-0 h-screen">
        <AppHeader
          homePath="/admin/dashboard"
          badge={
            <span className="hidden sm:inline-flex items-center gap-1.5 ml-2 px-2 py-0.5 rounded-full bg-accent-soft text-accent text-[0.625rem] font-bold uppercase tracking-wider">
              Super Admin
            </span>
          }
        />

        <main className="grow overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>

        <BottomNav />
      </div>
    </div>
  );
}
