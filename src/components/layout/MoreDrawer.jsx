import {
  Receipt, Users, CalendarDays, Settings, LogOut, BarChart3,
  UserPlus, ShoppingCart, Dumbbell, MessageCircle, DatabaseBackup,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
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
  { icon: CalendarDays, label: 'Classes', path: '/classes', tone: 'text-accent bg-accent-soft' },
  { icon: UserPlus, label: 'Enquiries', path: '/leads', tone: 'text-info bg-info-soft' },
  { icon: ShoppingCart, label: 'Shop', path: '/shop', tone: 'text-success bg-success-soft' },
  { icon: Receipt, label: 'Expenses', path: '/expenses', tone: 'text-danger bg-danger-soft' },
  { icon: BarChart3, label: 'Reports', path: '/payments/revenue', tone: 'text-warning bg-warning-soft' },
  { icon: Users, label: 'Staff', path: '/staff', tone: 'text-info bg-info-soft' },
  { icon: Dumbbell, label: 'Trainers', path: '/trainers', tone: 'text-accent bg-accent-soft' },
  { icon: MessageCircle, label: 'WhatsApp', path: '/whatsapp', tone: 'text-success bg-success-soft' },
  { icon: DatabaseBackup, label: 'Data', path: '/data', tone: 'text-muted bg-surface-3' },
  { icon: Settings, label: 'Settings', path: '/settings', tone: 'text-muted bg-surface-3' },
];

export default function MoreDrawer({ isOpen, onClose }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const go = (path) => {
    navigate(path);
    onClose();
  };

  return (
    <Modal open={isOpen} onClose={onClose} title="All areas" size="md">
      <div className="grid grid-cols-3 gap-2">
        {MENU_ITEMS.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => go(item.path)}
            className={cn(
              'flex flex-col items-center gap-2 p-3 rounded-xl border border-line',
              'text-xs font-semibold text-body transition-colors',
              'hover:bg-surface-3 hover:border-line-hover',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
            )}
          >
            <span className={cn('flex items-center justify-center size-11 rounded-xl', item.tone)}>
              <item.icon className="size-5" aria-hidden="true" />
            </span>
            <span className="truncate w-full text-center">{item.label}</span>
          </button>
        ))}

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
