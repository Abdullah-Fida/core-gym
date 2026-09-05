import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, TrendingUp, Wallet, Coins, Repeat, CalendarClock,
  Trophy, AlertTriangle, ChevronRight, Bell,
} from 'lucide-react';
import api from '../../lib/api';
import { calculateHealthScore } from '../../lib/utils';
import { cn } from '../../lib/cn';
import {
  Page, PageHeader, Card, CardHeader, Button, Badge,
  StatCard, Skeleton, EmptyState,
} from '../../components/ui';
import { useMoney } from '../../hooks/useMoney';

const ALERT_TONES = {
  trial_ending: 'bg-warning-soft text-warning',
  suspended_expired: 'bg-danger-soft text-danger',
  no_login: 'bg-info-soft text-info',
};

export default function AdminDashboardPage() {
  const money = useMoney();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [mRes, gRes, aRes] = await Promise.all([
          api.get('/admin/metrics'),
          api.get('/admin/gyms', { params: { limit: 100 } }),
          api.get('/admin/alerts'),
        ]);
        if (!alive) return;
        setData({
          metrics: mRes.data.data,
          gyms: gRes.data.data || [],
          alerts: aRes.data.data || [],
        });
      } catch (err) {
        console.error('Failed to fetch admin dashboard data', err);
        if (alive) setData({ metrics: null, gyms: [], alerts: [] });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const { topActive, lowHealth } = useMemo(() => {
    const gyms = data?.gyms ?? [];
    return {
      topActive: [...gyms]
        .sort((a, b) => (b.members?.[0]?.count || 0) - (a.members?.[0]?.count || 0))
        .slice(0, 5),
      lowHealth: [...gyms]
        .map((g) => ({ ...g, healthScore: calculateHealthScore(g) }))
        .sort((a, b) => a.healthScore - b.healthScore)
        .slice(0, 5),
    };
  }, [data]);

  const loading = !data;
  const m = data?.metrics;

  const stats = [
    { label: 'Total gyms', value: m?.totalGyms ?? 0, tone: 'accent', icon: Building2, path: '/admin/gyms' },
    { label: 'Monthly revenue', value: money(m?.totalMonthlyRevenue || 0), tone: 'success', icon: TrendingUp, path: '/admin/payments' },
    { label: 'Setup fees', value: money(m?.totalSetupRevenue || 0), tone: 'warning', icon: Coins, path: '/admin/payments' },
    { label: 'Total income', value: money(m?.totalCombinedRevenue || 0), tone: 'accent', icon: Wallet, path: '/admin/payments' },
    { label: 'MRR (estimated)', value: money(m?.mrr || 0), tone: 'info', icon: Repeat },
    { label: 'Renewals due (7d)', value: m?.renewalsDue ?? 0, tone: 'warning', icon: CalendarClock, path: '/admin/alerts' },
  ];

  return (
    <Page>
      <PageHeader title="Platform overview" subtitle="Gyms, revenue and things needing attention" />

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        {stats.map((s) => {
          const card = (
            <StatCard
              key={s.label}
              label={s.label}
              value={s.value}
              tone={s.tone}
              icon={s.icon}
              loading={loading}
              className={s.path && 'h-full transition-all hover:border-line-hover hover:-translate-y-px'}
            />
          );
          return s.path ? (
            <button
              key={s.label}
              type="button"
              onClick={() => navigate(s.path)}
              className="text-left rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {card}
            </button>
          ) : (
            card
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader
            title="Most active gyms"
            subtitle="By member count"
            action={
              <Button variant="ghost" size="sm" onClick={() => navigate('/admin/gyms')}>
                All gyms
                <ChevronRight className="size-3.5" aria-hidden="true" />
              </Button>
            }
          />
          {loading ? (
            <Skeleton className="h-48" />
          ) : topActive.length === 0 ? (
            <EmptyState icon={Trophy} title="No gyms yet" className="py-8" />
          ) : (
            <ol className="flex flex-col gap-2">
              {topActive.map((g, i) => (
                <li key={g.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/gyms/${g.id}`)}
                    className="flex items-center gap-3 w-full p-2.5 text-left rounded-lg border border-line transition-colors hover:bg-surface-3 hover:border-line-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <span className="flex items-center justify-center size-7 rounded-full bg-accent text-accent-contrast text-xs font-bold shrink-0">
                      {i + 1}
                    </span>
                    <span className="grow min-w-0">
                      <span className="block text-sm font-semibold text-heading truncate">{g.gym_name}</span>
                      <span className="block text-xs text-muted truncate">
                        {g.city ? `${g.city} · ` : ''}
                        {g.members?.[0]?.count || 0} members
                      </span>
                    </span>
                    <Badge variant="accent">{g.plan_type}</Badge>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card>
          <CardHeader title="Action needed" subtitle="Lowest health scores" />
          {loading ? (
            <Skeleton className="h-48" />
          ) : lowHealth.length === 0 ? (
            <EmptyState icon={AlertTriangle} title="Nothing to act on" className="py-8" />
          ) : (
            <ul className="flex flex-col gap-2">
              {lowHealth.map((g) => {
                const variant = g.healthScore <= 30 ? 'danger' : g.healthScore <= 60 ? 'warning' : 'success';
                return (
                  <li key={g.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/admin/gyms/${g.id}`)}
                      className="flex items-center gap-3 w-full p-2.5 text-left rounded-lg border border-line transition-colors hover:bg-surface-3 hover:border-line-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <Badge variant={variant}>{g.healthScore}</Badge>
                      <span className="grow min-w-0">
                        <span className="block text-sm font-semibold text-heading truncate">{g.gym_name}</span>
                        <span className="block text-xs text-muted truncate">
                          {g.owner_name}
                          {g.city ? ` · ${g.city}` : ''}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {!loading && data.alerts.length > 0 && (
        <Card>
          <CardHeader
            title={`Active alerts (${data.alerts.length})`}
            action={
              <Button variant="ghost" size="sm" onClick={() => navigate('/admin/alerts')}>
                View all
                <ChevronRight className="size-3.5" aria-hidden="true" />
              </Button>
            }
          />
          <ul className="flex flex-col gap-2">
            {data.alerts.slice(0, 3).map((a) => (
              <li
                key={a.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-line bg-surface-3/40"
              >
                <span
                  className={cn(
                    'flex items-center justify-center size-9 rounded-lg shrink-0',
                    ALERT_TONES[a.type] ?? 'bg-info-soft text-info'
                  )}
                >
                  <Bell className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-heading truncate">
                    {a.gym?.gym_name}
                  </span>
                  <span className="block text-xs text-muted">{a.message}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </Page>
  );
}
