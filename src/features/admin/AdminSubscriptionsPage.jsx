import { useState, useEffect, useMemo } from 'react';
import { CreditCard, Power, PowerOff } from 'lucide-react';
import api from '../../lib/api';
import { formatDate } from '../../lib/utils';
import { useToast } from '../../contexts/ToastContext';
import {
  Page, PageHeader, Button, Badge, Table, Tabs, Select,
  EmptyState, ListSkeleton,
} from '../../components/ui';
import { useMoney } from '../../hooks/useMoney';

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'trial', label: 'Trial' },
  { key: 'expired', label: 'Expired' },
];

const PLAN_VARIANT = { pro: 'success', basic: 'info', free: 'neutral' };

// Prices come from /admin/plans. They were hardcoded here as
// { pro: 5000, basic: 2000, free: 0 } and again in admin.routes.js /metrics, so
// changing a price in one place left the other silently wrong.

export default function AdminSubscriptionsPage() {
  const money = useMoney();
  const toast = useToast();
  const [filter, setFilter] = useState('');
  const [gyms, setGyms] = useState(null);
  const [plans, setPlans] = useState([]);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [gymsRes, plansRes] = await Promise.all([
          api.get('/admin/gyms'),
          api.get('/admin/plans'),
        ]);
        if (!alive) return;
        setGyms(gymsRes.data.data || []);
        setPlans(plansRes.data.data || []);
      } catch (err) {
        console.error(err);
        if (alive) {
          setGyms([]);
          toast.error('Could not load subscriptions.');
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [refresh, toast]);

  const planPrice = useMemo(() => {
    const byId = new Map(plans.map((p) => [p.id, Number(p.price) || 0]));
    const byCode = new Map(plans.map((p) => [p.code, Number(p.price) || 0]));
    return (gym) => byId.get(gym.plan_id) ?? byCode.get(gym.plan_type) ?? 0;
  }, [plans]);

  const filtered = useMemo(() => {
    if (!gyms) return null;
    return gyms.filter((g) => {
      if (filter === 'active') return g.is_active && g.plan_type !== 'free';
      // trial_ends_at used to be written as a copy of subscription_ends_at, so
      // merely having a value did not mean the trial was live.
      if (filter === 'trial') return g.trial_ends_at && new Date(g.trial_ends_at) > new Date();
      if (filter === 'expired') return !g.is_active;
      return true;
    });
  }, [gyms, filter]);

  const handleUpdatePlan = async (id, plan) => {
    try {
      await api.patch(`/admin/gyms/${id}/plan`, { plan_type: plan });
      toast.success('Plan updated.');
      setRefresh((r) => r + 1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update the plan.');
    }
  };

  const handleToggleStatus = async (id, isActive) => {
    try {
      await api.patch(`/admin/gyms/${id}/plan`, { is_active: !isActive });
      toast.success(isActive ? 'Gym suspended.' : 'Gym activated.');
      setRefresh((r) => r + 1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update access.');
    }
  };

  const loading = filtered === null;
  const rows = filtered ?? [];

  const columns = [
    {
      key: 'gym',
      header: 'Gym',
      render: (g) => (
        <div className="min-w-0">
          <p className="font-semibold text-heading truncate">{g.gym_name}</p>
          <p className="text-xs text-muted truncate">{g.owner_name}</p>
        </div>
      ),
    },
    {
      key: 'plan_type',
      header: 'Plan',
      render: (g) => <Badge variant={PLAN_VARIANT[g.plan_type] ?? 'neutral'}>{g.plan_type}</Badge>,
    },
    {
      key: 'price',
      header: 'Monthly',
      align: 'right',
      render: (g) => <span className="tabular-nums">{money(planPrice(g))}</span>,
    },
    { key: 'created_at', header: 'Started', render: (g) => <span className="text-xs">{formatDate(g.created_at)}</span> },
    {
      key: 'expires',
      header: 'Expires',
      render: (g) => (
        <span className="text-xs">
          {g.subscription_ends_at
            ? formatDate(g.subscription_ends_at)
            : g.trial_ends_at
              ? formatDate(g.trial_ends_at)
              : '—'}
        </span>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (g) => (
        <Badge variant={g.is_active ? 'success' : 'danger'} dot>
          {g.is_active ? 'Active' : 'Expired'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (g) => (
        <div className="flex items-center justify-end gap-1.5">
          <Select
            aria-label={`Plan for ${g.gym_name}`}
            className="text-xs py-1 px-2 w-auto"
            value={g.plan_type}
            onChange={(e) => handleUpdatePlan(g.id, e.target.value)}
          >
            <option value="free">Free</option>
            <option value="basic">Basic</option>
            <option value="pro">Pro</option>
          </Select>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => handleToggleStatus(g.id, g.is_active)}
            aria-label={g.is_active ? `Suspend ${g.gym_name}` : `Activate ${g.gym_name}`}
            title={g.is_active ? 'Suspend' : 'Activate'}
            className={g.is_active ? 'hover:text-danger' : 'hover:text-success'}
          >
            {g.is_active ? <PowerOff className="size-4" aria-hidden="true" /> : <Power className="size-4" aria-hidden="true" />}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader title="Subscriptions" subtitle="Plans, expiry and platform access" />

      <Tabs
        items={FILTERS.map((f) => ({
          ...f,
          count:
            f.key === ''
              ? gyms?.length
              : gyms?.filter((g) =>
                  f.key === 'active'
                    ? g.is_active && g.plan_type !== 'free'
                    : f.key === 'trial'
                      ? Boolean(g.trial_ends_at)
                      : !g.is_active
                ).length,
        }))}
        value={filter}
        onChange={setFilter}
        className="mb-5"
      />

      {loading ? (
        <ListSkeleton rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState icon={CreditCard} title="No subscriptions" description="Try a different filter." />
      ) : (
        <Table
          columns={columns}
          rows={rows}
          renderCard={(g) => (
            <div key={g.id} className="flex flex-col gap-3 p-4 bg-surface-2 border border-line rounded-xl">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-heading truncate">{g.gym_name}</p>
                  <p className="text-xs text-muted truncate">{g.owner_name}</p>
                </div>
                <Badge variant={g.is_active ? 'success' : 'danger'} dot>
                  {g.is_active ? 'Active' : 'Expired'}
                </Badge>
              </div>

              <dl className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-muted">Plan</dt>
                  <dd className="mt-0.5">
                    <Badge variant={PLAN_VARIANT[g.plan_type] ?? 'neutral'}>{g.plan_type}</Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Monthly</dt>
                  <dd className="font-semibold text-heading tabular-nums mt-0.5">
                    {money(planPrice(g))}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-muted">Expires</dt>
                  <dd className="font-semibold text-heading mt-0.5">
                    {g.subscription_ends_at
                      ? formatDate(g.subscription_ends_at)
                      : g.trial_ends_at
                        ? formatDate(g.trial_ends_at)
                        : '—'}
                  </dd>
                </div>
              </dl>

              <div className="flex items-center gap-2">
                <Select
                  aria-label={`Plan for ${g.gym_name}`}
                  className="grow text-xs"
                  value={g.plan_type}
                  onChange={(e) => handleUpdatePlan(g.id, e.target.value)}
                >
                  <option value="free">Free</option>
                  <option value="basic">Basic</option>
                  <option value="pro">Pro</option>
                </Select>
                <Button
                  variant={g.is_active ? 'secondary' : 'primary'}
                  size="sm"
                  onClick={() => handleToggleStatus(g.id, g.is_active)}
                >
                  {g.is_active ? 'Suspend' : 'Activate'}
                </Button>
              </div>
            </div>
          )}
        />
      )}
    </Page>
  );
}
