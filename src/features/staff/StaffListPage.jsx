import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Users } from 'lucide-react';
import { STAFF_ROLES } from '../../lib/constants';
import api from '../../lib/api';
import {
  Page, PageHeader, Button, Tabs, Avatar, Badge,
  EmptyState, ListSkeleton,
} from '../../components/ui';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'inactive', label: 'Inactive' },
];

export default function StaffListPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const [staffData, setStaffData] = useState(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const res = await api.get('/staff');
        if (!isMounted) return;

        const results = (res.data.data || [])
          .filter((s) => s.status !== 'deleted')
          .map((s) => {
            const payments = s.staff_payments || [];
            let isPaid = false;
            if (payments.length) {
              const [latest] = [...payments].sort((a, b) => new Date(b.paid_date) - new Date(a.paid_date));
              const last = new Date(latest.paid_date);
              const today = new Date();
              last.setHours(0, 0, 0, 0);
              today.setHours(0, 0, 0, 0);
              isPaid = Math.floor((today - last) / 86400000) <= 30;
            }
            return { ...s, staff_payments: payments, isPaid };
          });

        setStaffData(results);
      } catch (err) {
        console.error('Staff API error:', err);
        if (isMounted) setStaffData([]);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!staffData) return null;
    return filter === 'all' ? staffData : staffData.filter((s) => s.status === filter);
  }, [staffData, filter]);

  const loading = filtered === null;
  const list = filtered ?? [];

  return (
    <Page>
      <PageHeader
        title="Staff"
        subtitle={loading ? 'Loading…' : `${list.length} staff member${list.length === 1 ? '' : 's'}`}
        actions={
          <Button onClick={() => navigate('/staff/add')}>
            <UserPlus className="size-4" aria-hidden="true" />
            Add staff
          </Button>
        }
      />

      <Tabs
        items={FILTERS.map((f) => ({
          ...f,
          count: f.key === 'all' ? staffData?.length : staffData?.filter((s) => s.status === f.key).length,
        }))}
        value={filter}
        onChange={setFilter}
        className="mb-5"
      />

      {loading ? (
        <ListSkeleton rows={4} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No staff members"
          description={filter !== 'all' ? 'Try a different filter.' : 'Add your first trainer or receptionist.'}
          action={
            filter === 'all' ? (
              <Button onClick={() => navigate('/staff/add')}>
                <UserPlus className="size-4" aria-hidden="true" />
                Add staff
              </Button>
            ) : null
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((s) => {
            const role = STAFF_ROLES.find((r) => r.value === s.role);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/staff/${s.id}`)}
                  className="flex items-center gap-3 w-full p-3 sm:p-4 text-left bg-surface-2 border border-line rounded-xl transition-all hover:border-line-hover hover:shadow-pop focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <Avatar name={s.name} tone={role?.tone ?? 'neutral'} />
                  <span className="grow min-w-0">
                    <span className="block font-semibold text-heading truncate">{s.name}</span>
                    <span className="block text-xs text-muted truncate">{s.phone || 'No phone'}</span>
                  </span>
                  <span className="flex flex-col items-end gap-1 shrink-0">
                    <Badge variant={role?.tone ?? 'neutral'}>{role?.label || s.custom_role || 'Staff'}</Badge>
                    <Badge variant={s.isPaid ? 'success' : 'danger'} dot>
                      {s.isPaid ? 'Paid' : 'Unpaid'}
                    </Badge>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Page>
  );
}
