import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, AlertTriangle, CalendarCheck, TrendingUp, DollarSign,
  UserPlus, CreditCard, Clock, AlertCircle, TrendingDown,
  BarChart3, PieChart, ArrowUpRight, ArrowDownRight, Minus,
  ChevronRight, Flame,
} from 'lucide-react';
import { Bar, Doughnut } from 'react-chartjs-2';
import '../../lib/chartSetup';
import { useAuth } from '../../contexts/AuthContext';
import { formatDateShort, getMonthName, calculateMemberStatus } from '../../lib/utils';
import { useThemeColors, alpha } from '../../hooks/useThemeColors';
import api from '../../lib/api';
import { cn } from '../../lib/cn';
import {
  Page, PageHeader, Card, CardHeader, Button, StatCard,
  Avatar, Tabs, EmptyState, Skeleton, ErrorState,
} from '../../components/ui';
import { useMoney } from '../../hooks/useMoney';


const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const parseDateParts = (dateStr) => {
  if (!dateStr) return { y: 0, m: -1, d: 0 };
  const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number);
  return { y, m: m - 1, d };
};

const prevDateStr = (dateStr) => {
  const dt = new Date(dateStr);
  dt.setDate(dt.getDate() - 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

const QUICK_ACTIONS = [
  { icon: UserPlus, label: 'Add member', path: '/members/add', tone: 'text-accent bg-accent-soft' },
  { icon: CreditCard, label: 'Collect fee', path: '/payments/add', tone: 'text-success bg-success-soft' },
  { icon: AlertTriangle, label: 'View expired', path: '/members?status=expired', tone: 'text-danger bg-danger-soft' },
  { icon: CalendarCheck, label: 'Attendance', path: '/attendance', tone: 'text-info bg-info-soft' },
];

export default function DashboardPage() {
  const money = useMoney();
  const navigate = useNavigate();
  const { user } = useAuth();
  const c = useThemeColors();

  const [activeTab, setActiveTab] = useState('revenue');
  const [cashDate, setCashDate] = useState(todayStr);
  const [membersAddedDate, setMembersAddedDate] = useState(todayStr);
  const [membersExpiringDate, setMembersExpiringDate] = useState(todayStr);

  const [raw, setRaw] = useState(null);
  const [error, setError] = useState(null);

  // Fetched ONCE. This effect previously depended on the three date pickers, so
  // changing any single KPI's date refetched every member, payment, expense and
  // staff record in the gym. The dates only affect derived counts, which are
  // computed from `raw` in the memo below.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [membersRes, paymentsRes, expensesRes, staffRes] = await Promise.all([
          api.get('/members'),
          api.get('/payments'),
          api.get('/expenses'),
          api.get('/staff'),
        ]);
        if (!alive) return;

        const staffPayments = (staffRes.data.data || []).flatMap((s) => s.staff_payments || []);
        setRaw({
          members: (membersRes.data.data || [])
            .filter((m) => m.status !== 'deleted')
            .map((m) => ({ ...m, status: calculateMemberStatus(m) })),
          payments: paymentsRes.data.data || [],
          expenses: expensesRes.data.data || [],
          staffPayments,
        });
      } catch (err) {
        console.error('Dashboard error:', err);
        if (alive) setError(err.message || 'Could not load dashboard data.');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const stats = useMemo(() => {
    if (!raw) return null;
    const { members, payments, expenses, staffPayments } = raw;

    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    const inThisMonth = (dateStr) => {
      const { y, m } = parseDateParts(dateStr);
      return m === thisMonth && y === thisYear;
    };

    const revenue = payments.filter((p) => inThisMonth(p.payment_date)).reduce((s, p) => s + Number(p.amount || 0), 0);
    const generalExpenses = expenses.filter((e) => inThisMonth(e.expense_date)).reduce((s, e) => s + Number(e.amount || 0), 0);
    const salaryTotal = staffPayments
      .filter((p) => p.month === thisMonth + 1 && p.year === thisYear)
      .reduce((s, p) => s + Number(p.amount_paid || 0), 0);

    const prevAdded = prevDateStr(membersAddedDate);
    const prevExpiring = prevDateStr(membersExpiringDate);
    const prevCashStr = prevDateStr(cashDate);

    let currMembersAdded = 0, prevMembersAdded = 0;
    let currMembersExpiring = 0, prevMembersExpiring = 0;
    let dueSoonCount = 0;

    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);

    for (const m of members) {
      if (m.join_date) {
        const j = String(m.join_date).slice(0, 10);
        if (j === membersAddedDate) currMembersAdded++;
        if (j === prevAdded) prevMembersAdded++;
      }
      if (m.latest_expiry) {
        const e = String(m.latest_expiry).slice(0, 10);
        if (e === membersExpiringDate) currMembersExpiring++;
        if (e === prevExpiring) prevMembersExpiring++;
        if (m.status !== 'expired') {
          const target = new Date(m.latest_expiry);
          target.setHours(0, 0, 0, 0);
          const days = Math.ceil((target - midnight) / 86400000);
          if (days >= 0 && days <= 3) dueSoonCount++;
        }
      }
    }

    let currCash = 0, prevCash = 0;
    const planCounts = {};
    for (const p of payments) {
      if (!p.payment_date) continue;
      const d = String(p.payment_date).slice(0, 10);
      const amt = Number(p.amount || 0);
      if (d === cashDate) currCash += amt;
      if (d === prevCashStr) prevCash += amt;

      if (inThisMonth(p.payment_date) && amt > 0) {
        const plan = p.plan_duration_months || 'Unknown';
        const key = String(plan) === 'custom' ? 'Custom days' : `${plan} month${plan > 1 ? 's' : ''}`;
        planCounts[key] ??= { count: 0, revenue: 0 };
        planCounts[key].count += 1;
        planCounts[key].revenue += amt;
      }
    }

    const trend = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const m = d.getMonth();
      const y = d.getFullYear();
      const matches = (dateStr) => {
        const parts = parseDateParts(dateStr);
        return parts.m === m && parts.y === y;
      };
      const mRev = payments.filter((p) => matches(p.payment_date)).reduce((s, p) => s + Number(p.amount || 0), 0);
      const mSal = staffPayments.filter((p) => p.month === m + 1 && p.year === y).reduce((s, p) => s + Number(p.amount_paid || 0), 0);
      const mExp = expenses.filter((e) => matches(e.expense_date)).reduce((s, e) => s + Number(e.amount || 0), 0) + mSal;
      trend.push({ month: m + 1, revenue: mRev, expenses: mExp, profit: mRev - mExp });
    }

    const recentActivity = [...payments]
      .sort((a, b) => new Date(b.created_at || b.payment_date) - new Date(a.created_at || a.payment_date))
      .slice(0, 5)
      .map((p) => ({
        ...p,
        member_name: members.find((m) => m.id === p.member_id)?.name ?? p.members?.name ?? 'Unknown member',
      }));

    const totalMembers = members.length;
    const activeMembers = members.filter((m) => m.status === 'active').length;
    const expiredCount = members.filter((m) => m.status === 'expired').length;

    return {
      totalMembers,
      activeMembers,
      expiredCount,
      dueSoonCount,
      noPayment: Math.max(0, totalMembers - activeMembers - dueSoonCount - expiredCount),
      revenue,
      generalExpenses,
      salaryTotal,
      expenses: generalExpenses + salaryTotal,
      profit: revenue - generalExpenses - salaryTotal,
      currCash, prevCash,
      currMembersAdded, prevMembersAdded,
      currMembersExpiring, prevMembersExpiring,
      popularPlans: Object.entries(planCounts)
        .map(([label, d]) => ({ label, ...d }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 4),
      recentActivity,
      revenueTrend: trend,
    };
  }, [raw, cashDate, membersAddedDate, membersExpiringDate]);

  // Rebuilt whenever the theme changes, so the canvas follows light/dark and
  // every accent preset.
  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: c.surface3,
          titleColor: c.heading,
          bodyColor: c.body,
          borderColor: c.line,
          borderWidth: 1,
          cornerRadius: 8,
          padding: 10,
          callbacks: { label: (ctx) => ` ${money(ctx.raw)}` },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: c.muted, font: { weight: '700', size: 11 } },
          border: { color: 'transparent' },
        },
        y: {
          grid: { color: alpha(c.line, 0.6) },
          ticks: {
            color: c.muted,
            font: { weight: '600', size: 10 },
            callback: (v) => (v >= 1000 ? `${v / 1000}K` : v),
          },
          border: { color: 'transparent' },
        },
      },
    }),
    [c, money]
  );

  const revenueChartData = useMemo(() => {
    if (!stats) return null;
    return {
      labels: stats.revenueTrend.map((d) => getMonthName(d.month).slice(0, 3)),
      datasets: [
        {
          label: 'Revenue',
          data: stats.revenueTrend.map((d) => d.revenue),
          backgroundColor: alpha(c.accent, 0.85),
          hoverBackgroundColor: c.accent,
          borderWidth: 0,
          borderRadius: 6,
        },
        {
          label: 'Expenses',
          data: stats.revenueTrend.map((d) => d.expenses),
          backgroundColor: alpha(c.danger, 0.6),
          hoverBackgroundColor: c.danger,
          borderWidth: 0,
          borderRadius: 6,
        },
      ],
    };
  }, [stats, c]);

  const donutSegments = useMemo(() => {
    if (!stats) return [];
    return [
      { label: 'Active', count: stats.activeMembers, color: c.success },
      { label: 'Due soon', count: stats.dueSoonCount, color: c.warning },
      { label: 'Expired', count: stats.expiredCount, color: c.danger },
      { label: 'No payment', count: stats.noPayment, color: c.line },
    ];
  }, [stats, c]);

  if (error) {
    return (
      <Page>
        <ErrorState title="Dashboard unavailable" description={error} onRetry={() => window.location.reload()} />
      </Page>
    );
  }

  const loading = !stats;

  const diff = (curr, prev, isMoney = false) => {
    if (loading) return { label: '', dir: 'neutral', value: 0 };
    const d = curr - prev;
    if (d === 0) return { label: 'Same as yesterday', dir: 'neutral', value: 0 };
    const sign = d > 0 ? '+' : '';
    const val = isMoney ? money(Math.abs(d)) : Math.abs(d);
    return { label: `${sign}${val} vs yesterday`, dir: d > 0 ? 'up' : 'down', value: d };
  };

  const cash = diff(stats?.currCash, stats?.prevCash, true);
  const added = diff(stats?.currMembersAdded, stats?.prevMembersAdded);
  const expiring = diff(stats?.currMembersExpiring, stats?.prevMembersExpiring);

  const DeltaIcon = ({ dir }) =>
    dir === 'up' ? <ArrowUpRight className="size-3.5" aria-hidden="true" />
      : dir === 'down' ? <ArrowDownRight className="size-3.5" aria-hidden="true" />
      : <Minus className="size-3.5" aria-hidden="true" />;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <Page>
      <PageHeader
        title={`${greeting}, ${user?.name || 'there'}`}
        subtitle={new Date().toLocaleDateString(undefined, {
          weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
        })}
      />

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-7">
        {QUICK_ACTIONS.map((qa) => (
          <button
            key={qa.label}
            type="button"
            onClick={() => navigate(qa.path)}
            className={cn(
              'group flex items-center gap-2.5 p-3 rounded-xl',
              'bg-surface-2 border border-line text-sm font-semibold text-body text-left',
              'transition-all hover:border-line-hover hover:-translate-y-px',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
            )}
          >
            <span className={cn('flex items-center justify-center size-8 rounded-lg shrink-0', qa.tone)}>
              <qa.icon className="size-4" aria-hidden="true" />
            </span>
            <span className="truncate grow">{qa.label}</span>
            <ChevronRight className="size-3.5 text-muted shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </button>
        ))}
      </div>

      {/* Daily snapshot */}
      <h2 className="text-xs font-bold uppercase tracking-wider text-muted mb-3">Daily snapshot</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-7">
        <StatCard
          label="Cash collected"
          tone="success"
          icon={DollarSign}
          loading={loading}
          value={money(stats?.currCash ?? 0)}
          delta={cash.value}
          deltaLabel={cash.label}
        >
          <DateFilter value={cashDate} onChange={setCashDate} label="Cash collected date" />
        </StatCard>

        <StatCard
          label="Members added"
          tone="accent"
          icon={UserPlus}
          loading={loading}
          value={stats?.currMembersAdded ?? 0}
          delta={added.value}
          deltaLabel={added.label}
        >
          <DateFilter value={membersAddedDate} onChange={setMembersAddedDate} label="Members added date" />
        </StatCard>

        <StatCard
          label="Memberships ending"
          tone="danger"
          icon={AlertTriangle}
          loading={loading}
          value={stats?.currMembersExpiring ?? 0}
          delta={expiring.value}
          deltaLabel={expiring.label}
        >
          <DateFilter value={membersExpiringDate} onChange={setMembersExpiringDate} label="Memberships ending date" />
        </StatCard>

        <StatCard
          label="Expiring in 3 days"
          tone="warning"
          icon={Clock}
          loading={loading}
          value={stats?.dueSoonCount ?? 0}
          deltaLabel="Needs attention"
        />
      </div>

      {/* Monthly strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-7">
        <MonthlyPill icon={TrendingUp} tone="text-success bg-success-soft" label="Monthly revenue"
          value={loading ? null : money(stats.revenue)} />
        <MonthlyPill icon={TrendingDown} tone="text-danger bg-danger-soft" label="Total expenses"
          value={loading ? null : money(stats.expenses)} />
        <MonthlyPill icon={Users} tone="text-accent bg-accent-soft" label="Active members"
          value={loading ? null : `${stats.activeMembers}`}
          suffix={loading ? null : `/ ${stats.totalMembers}`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4 items-start">
        <div className="flex flex-col gap-4 min-w-0">
          {/* Recent payments */}
          <Card>
            <CardHeader
              title="Recent payments"
              action={
                <Button variant="ghost" size="sm" onClick={() => navigate('/payments')}>
                  View all
                  <ChevronRight className="size-3.5" aria-hidden="true" />
                </Button>
              }
            />
            {loading ? (
              <div className="flex flex-col gap-3">
                {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}
              </div>
            ) : stats.recentActivity.length === 0 ? (
              <EmptyState icon={CreditCard} title="No payments yet" description="Collected fees will appear here." className="py-8" />
            ) : (
              <ul className="flex flex-col divide-y divide-line -my-2">
                {stats.recentActivity.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-2.5">
                    <Avatar name={p.member_name} size="sm" />
                    <div className="grow min-w-0">
                      <p className="text-sm font-semibold text-heading truncate">{p.member_name}</p>
                      <p className="text-xs text-muted">{formatDateShort(p.payment_date || p.created_at)}</p>
                    </div>
                    <span className="text-sm font-bold text-success tabular-nums shrink-0">
                      +{money(p.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Analytics */}
          <Card>
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <h2 className="text-base font-bold text-heading">Analytics</h2>
              <Tabs
                size="sm"
                value={activeTab}
                onChange={setActiveTab}
                items={[
                  { key: 'revenue', label: 'Revenue vs expenses' },
                  { key: 'members', label: 'Members' },
                ]}
              />
            </div>

            {loading ? (
              <Skeleton className="h-60" />
            ) : activeTab === 'revenue' ? (
              <>
                <div className="flex items-center gap-4 mb-3 text-xs text-muted">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-accent" aria-hidden="true" />
                    Revenue
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-danger" aria-hidden="true" />
                    Expenses
                  </span>
                  <span className="ml-auto">Last 6 months</span>
                </div>
                <div className="h-60">
                  <Bar data={revenueChartData} options={chartOptions} />
                </div>
              </>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="size-48 shrink-0">
                  <Doughnut
                    data={{
                      labels: donutSegments.map((s) => s.label),
                      datasets: [{
                        data: donutSegments.map((s) => s.count),
                        backgroundColor: donutSegments.map((s) => s.color),
                        borderColor: c.surface2,
                        borderWidth: 3,
                        hoverOffset: 8,
                      }],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      cutout: '72%',
                      plugins: {
                        legend: { display: false },
                        tooltip: { backgroundColor: c.surface3, titleColor: c.heading, bodyColor: c.body, cornerRadius: 8 },
                      },
                    }}
                  />
                </div>
                <ul className="flex flex-col gap-2.5 grow w-full">
                  {donutSegments.map((seg) => (
                    <li key={seg.label} className="flex items-center gap-2.5 text-sm">
                      <span className="size-2.5 rounded-sm shrink-0" style={{ background: seg.color }} aria-hidden="true" />
                      <span className="text-body grow">{seg.label}</span>
                      <span className="font-bold text-heading tabular-nums">{seg.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4 min-w-0">
          <Card>
            <CardHeader title="Membership status" />
            <div className="flex flex-col gap-2">
              <StatusRow
                icon={AlertCircle} tone="danger" label="Expired" hint="View and follow up"
                count={stats?.expiredCount} loading={loading}
                onClick={() => navigate('/members?status=expired')}
              />
              <StatusRow
                icon={Clock} tone="warning" label="Expiring in 3 days" hint="Needs attention"
                count={stats?.dueSoonCount} loading={loading}
                onClick={() => navigate('/members?status=due_soon')}
              />
              <StatusRow
                icon={Users} tone="success" label="Active" hint={loading ? '' : `of ${stats.totalMembers} total`}
                count={stats?.activeMembers} loading={loading}
                onClick={() => navigate('/members?status=active')}
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="This month" />
            {loading ? (
              <Skeleton className="h-28" />
            ) : (
              <dl className="flex flex-col gap-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-body font-medium">Revenue</dt>
                  <dd className="font-bold text-success tabular-nums">{money(stats.revenue)}</dd>
                </div>
                <div className="flex flex-col gap-1.5 pl-3 border-l-2 border-line">
                  <div className="flex items-center justify-between text-xs">
                    <dt className="text-muted">General expenses</dt>
                    <dd className="text-body tabular-nums">{money(stats.generalExpenses)}</dd>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <dt className="text-muted">Staff salaries</dt>
                    <dd className="text-body tabular-nums">{money(stats.salaryTotal)}</dd>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-body font-medium">Total expenses</dt>
                  <dd className="font-bold text-danger tabular-nums">{money(stats.expenses)}</dd>
                </div>
                <div className="flex items-center justify-between pt-2.5 border-t border-line">
                  <dt className="text-heading font-semibold">Profit</dt>
                  <dd className={cn('font-bold tabular-nums', stats.profit >= 0 ? 'text-success' : 'text-danger')}>
                    {money(stats.profit)}
                  </dd>
                </div>
              </dl>
            )}
          </Card>

          <Card>
            <CardHeader title="Popular plans" subtitle="This month" />
            {loading ? (
              <Skeleton className="h-24" />
            ) : stats.popularPlans.length === 0 ? (
              <EmptyState icon={Flame} title="No plans sold yet" description="Sales this month will show up here." className="py-6" />
            ) : (
              <ul className="flex flex-col gap-3">
                {stats.popularPlans.map((plan) => {
                  const max = stats.popularPlans[0].revenue;
                  const pct = max > 0 ? (plan.revenue / max) * 100 : 0;
                  return (
                    <li key={plan.label}>
                      <div className="flex items-baseline justify-between gap-2 mb-1.5">
                        <span className="text-sm font-semibold text-heading truncate">{plan.label}</span>
                        <span className="text-sm font-bold text-heading tabular-nums shrink-0">{money(plan.revenue)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                        <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-xs text-muted mt-1">
                        {plan.count} purchase{plan.count !== 1 ? 's' : ''}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </Page>
  );
}

function DateFilter({ value, onChange, label }) {
  return (
    <input
      type="date"
      value={value}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'mt-3 w-full bg-surface-3 border border-line rounded-md px-2 py-1',
        'text-xs text-body',
        'focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30'
      )}
    />
  );
}

function MonthlyPill({ icon: Icon, tone, label, value, suffix }) {
  return (
    <div className="flex items-center gap-3 p-3.5 bg-surface-2 border border-line rounded-xl">
      <span className={cn('flex items-center justify-center size-9 rounded-lg shrink-0', tone)}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted font-medium">{label}</p>
        {value === null ? (
          <Skeleton className="h-5 w-20 mt-1" />
        ) : (
          <p className="text-lg font-bold text-heading font-display tabular-nums leading-tight">
            {value}
            {suffix && <span className="text-sm font-medium text-muted ml-1">{suffix}</span>}
          </p>
        )}
      </div>
    </div>
  );
}

const STATUS_TONES = {
  danger: 'text-danger bg-danger-soft',
  warning: 'text-warning bg-warning-soft',
  success: 'text-success bg-success-soft',
};

function StatusRow({ icon: Icon, tone, label, hint, count, loading, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl border border-line text-left',
        'transition-colors hover:bg-surface-3 hover:border-line-hover',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
      )}
    >
      <span className={cn('flex items-center justify-center size-9 rounded-lg shrink-0', STATUS_TONES[tone])}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="grow min-w-0">
        <span className="block text-sm font-semibold text-heading">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      {loading ? (
        <Skeleton className="h-6 w-8" />
      ) : (
        <span className="text-xl font-bold text-heading font-display tabular-nums shrink-0">{count}</span>
      )}
    </button>
  );
}
