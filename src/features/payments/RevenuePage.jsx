import { useState, useEffect, useMemo } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import api from '../../lib/api';
import { getMonthName } from '../../lib/utils';
import { PLAN_DURATIONS, PAYMENT_METHODS } from '../../lib/constants';
import { cn } from '../../lib/cn';
import {
  Page, PageHeader, BackLink, Card, CardHeader,
  Select, Skeleton, ErrorState,
} from '../../components/ui';
import { useMoney } from '../../hooks/useMoney';

/** Timezone-safe parse of a `YYYY-MM-DD` column. */
const dateParts = (dateStr) => {
  if (!dateStr) return { y: 0, m: 0, str: '' };
  const str = String(dateStr).slice(0, 10);
  const [y, m] = str.split('-').map(Number);
  return { y, m: m - 1, str };
};

const monthStart = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;

function selectPeriod(payments, period, now) {
  if (period === 'this_month') {
    return payments.filter((p) => {
      const { y, m } = dateParts(p.payment_date);
      return m === now.getMonth() && y === now.getFullYear();
    });
  }
  if (period === 'last_3_months' || period === 'last_6_months') {
    const back = period === 'last_3_months' ? 2 : 5;
    const cutoff = monthStart(new Date(now.getFullYear(), now.getMonth() - back, 1));
    return payments.filter((p) => dateParts(p.payment_date).str >= cutoff);
  }
  if (period === 'this_year') {
    return payments.filter((p) => dateParts(p.payment_date).y === now.getFullYear());
  }
  if (period.startsWith('month_')) {
    const targetM = parseInt(period.split('_')[1], 10) - 1;
    return payments.filter((p) => {
      const { y, m } = dateParts(p.payment_date);
      return m === targetM && y === now.getFullYear();
    });
  }
  return payments; // all_time
}

const sum = (rows) => rows.reduce((s, p) => s + Number(p.amount || 0), 0);

export default function RevenuePage() {
  const money = useMoney();
  const [period, setPeriod] = useState('this_month');
  const [allPayments, setAllPayments] = useState(null);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get('/payments');
        if (!alive) return;
        setAllPayments(res.data.data || []);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch payments', err);
        if (!alive) return;
        setError('Could not load payment data.');
        setAllPayments([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [reloadToken]);

  const retry = () => {
    setAllPayments(null);
    setError(null);
    setReloadToken((t) => t + 1);
  };

  const report = useMemo(() => {
    if (!allPayments) return null;
    const now = new Date();
    const payments = selectPeriod(allPayments, period, now);

    let prevTotal = 0;
    if (period === 'this_month' || period.startsWith('month_')) {
      const m1 = period === 'this_month' ? now.getMonth() + 1 : parseInt(period.split('_')[1], 10);
      const prevMonth = m1 === 1 ? 12 : m1 - 1;
      const prevYear = m1 === 1 ? now.getFullYear() - 1 : now.getFullYear();
      prevTotal = sum(
        allPayments.filter((p) => {
          const { y, m } = dateParts(p.payment_date);
          return m + 1 === prevMonth && y === prevYear;
        })
      );
    }

    const matchesDuration = (p, value) =>
      value === 'custom'
        ? p.plan_duration_months === 'custom' || p.plan_duration_months === 0
        : String(p.plan_duration_months) === String(value);

    const total = sum(payments);
    return {
      total,
      prevTotal,
      change: prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : 0,
      byDuration: PLAN_DURATIONS.map((d) => {
        const rows = payments.filter((p) => matchesDuration(p, d.value));
        return { label: d.label, count: rows.length, total: sum(rows) };
      }),
      byMethod: PAYMENT_METHODS.map((m) => {
        const rows = payments.filter((p) => p.payment_method === m.value);
        return { label: m.label, count: rows.length, total: sum(rows) };
      }),
    };
  }, [allPayments, period]);

  const loading = !report && !error;

  return (
    <Page>
      <PageHeader title="Revenue" back={<BackLink to="/payments" label="Payments" />} />

      <Select
        aria-label="Reporting period"
        className="mb-4"
        value={period}
        onChange={(e) => setPeriod(e.target.value)}
      >
        <option value="this_month">This month</option>
        <option value="last_3_months">Last 3 months</option>
        <option value="last_6_months">Last 6 months</option>
        <option value="this_year">This year</option>
        <option value="all_time">All time</option>
        <optgroup label="Specific month (this year)">
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={`month_${i + 1}`}>
              {getMonthName(i + 1)}
            </option>
          ))}
        </optgroup>
      </Select>

      {error ? (
        <ErrorState title="Revenue report unavailable" description={error} onRetry={retry} />
      ) : (
        <>
          <Card className="text-center mb-5">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">Total revenue</p>
            {loading ? (
              <Skeleton className="h-11 w-40 mx-auto my-2" />
            ) : (
              <p className="text-4xl font-bold text-success font-display tabular-nums my-1">
                {money(report.total)}
              </p>
            )}
            {!loading && report.prevTotal > 0 && (
              <p
                className={cn(
                  'flex items-center justify-center gap-1 text-sm font-semibold',
                  report.change >= 0 ? 'text-success' : 'text-danger'
                )}
              >
                {report.change >= 0 ? (
                  <TrendingUp className="size-4" aria-hidden="true" />
                ) : (
                  <TrendingDown className="size-4" aria-hidden="true" />
                )}
                {report.change >= 0 ? '+' : ''}
                {report.change}% vs previous month
              </p>
            )}
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader title="By plan duration" />
              {loading ? (
                <Skeleton className="h-40" />
              ) : (
                <BreakdownList rows={report.byDuration} />
              )}
            </Card>

            <Card>
              <CardHeader title="By payment method" />
              {loading ? <Skeleton className="h-40" /> : <BreakdownList rows={report.byMethod} />}
            </Card>
          </div>
        </>
      )}
    </Page>
  );
}

function BreakdownList({ rows }) {
  const money = useMoney();
  const max = Math.max(...rows.map((r) => r.total), 1);
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <span className="text-sm text-body truncate">
              {r.label}
              <span className="text-muted ml-1.5">({r.count})</span>
            </span>
            <span className="text-sm font-bold text-heading tabular-nums shrink-0">
              {money(r.total)}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-500"
              style={{ width: `${(r.total / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
