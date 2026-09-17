import {
  Receipt, Users, CalendarDays, Settings, LogOut, BarChart3,
  UserPlus, ShoppingCart, Dumbbell, MessageCircle, DatabaseBackup,
  CreditCard, Layers, Lock,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usePlan } from '../../contexts/PlanContext';
import Modal from '../ui/Modal';
import { cn } from '../../lib/cn';

// Every destination the bottom bar does not already carry.
//
// This listed only five items, so Classes, Enquiries, Shop, Trainers, WhatsApp
// and Import/Export were unreachable on a phone — the sidebar that holds them
// is hidden below 1024px.
//
// Each entry previously carried a hardcoded hex (#f87171, #60a5fa, #34d399,
// #fbbf24, #8b5cf6) that duplicated the status tokens instead of referencing
// them — and #8b5cf6 belonged to no palette at all.
const MENU_ITEMS = [
  { icon: CalendarDays, label: 'Classes', path: '/classes', tone: 'text-accent bg-accent-soft', feature: 'classes' },
  { icon: UserPlus, label: 'Enquiries', path: '/leads', tone: 'text-info bg-info-soft', feature: 'leads' },
  { icon: ShoppingCart, label: 'Shop', path: '/shop', tone: 'text-success bg-success-soft', feature: 'shop' },
  { icon: Receipt, label: 'Expenses', path: '/expenses', tone: 'text-danger bg-danger-soft', feature: 'expenses' },
  { icon: BarChart3, label: 'Reports', path: '/payments/revenue', tone: 'text-warning bg-warning-soft', feature: 'reports' },
  { icon: Users, label: 'Staff', path: '/staff', tone: 'text-info bg-info-soft', feature: 'staff' },
  { icon: Dumbbell, label: 'Trainers', path: '/trainers', tone: 'text-accent bg-accent-soft', feature: 'trainers' },
  { icon: MessageCircle, label: 'WhatsApp', path: '/whatsapp', tone: 'text-success bg-success-soft', feature: 'whatsapp' },
  { icon: DatabaseBackup, label: 'Data', path: '/data', tone: 'text-muted bg-surface-3', feature: 'data' },
  { icon: Settings, label: 'Settings', path: '/settings', tone: 'text-muted bg-surface-3' },
];

// The admin sidebar's remaining destinations. Without these the super admin
// could only reach Overview, Gyms and Alerts on a phone.
const ADMIN_ITEMS = [
  { icon: CreditCard, label: 'Subscriptions', path: '/admin/subscriptions', tone: 'text-accent bg-accent-soft' },
  { icon: Layers, label: 'Plans', path: '/admin/plans', tone: 'text-info bg-info-soft' },
  { icon: Receipt, label: 'Payments', path: '/admin/payments', tone: 'text-success bg-success-soft' },
];

export default function MoreDrawer({ isOpen, onClose }) {
  const { logout, isAdmin } = useAuth();
  const { canUseFeature } = usePlan();
  const navigate = useNavigate();

  const go = (path) => {
    navigate(path);
    onClose();
  };

  return (
    <Modal open={isOpen} onClose={onClose} title="All areas" size="md">
      <div className="grid grid-cols-3 gap-2">
        {(isAdmin ? ADMIN_ITEMS : MENU_ITEMS).map((item) => {
          const locked = !isAdmin && item.feature ? !canUseFeature(item.feature) : false;
          
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                if (!locked) go(item.path);
              }}
              className={cn(
                'relative flex flex-col items-center gap-2 p-3 rounded-xl border border-line',
                'text-xs font-semibold text-body transition-colors',
                'hover:bg-surface-3 hover:border-line-hover',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                locked && 'opacity-60 grayscale cursor-not-allowed'
              )}
            >
              <span className={cn('flex items-center justify-center size-11 rounded-xl', item.tone)}>
                <item.icon className="size-5" aria-hidden="true" />
              </span>
              <span className="truncate w-full text-center">{item.label}</span>
              {locked && (
                <div className="absolute top-2 right-2 bg-surface p-1 rounded-full border border-line text-muted">
                  <Lock className="size-3" aria-hidden="true" />
                </div>
              )}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => {
            logout();
            navigate('/login');
          }}
          className={cn(
            'flex flex-col items-center gap-2 p-3 rounded-xl border border-line',
            'text-xs font-semibold text-danger transition-colors',
            'hover:bg-danger-soft hover:border-danger/40',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
          )}
        >
          <span className="flex items-center justify-center size-11 rounded-xl bg-danger-soft text-danger">
            <LogOut className="size-5" aria-hidden="true" />
          </span>
          <span>Logout</span>
        </button>
      </div>
    </Modal>
  );
}
