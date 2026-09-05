import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Wallet, Receipt, Layers, PieChart } from 'lucide-react';
import api from '../../lib/api';
import { getCurrentMonth, getCurrentYear, getMonthName } from '../../lib/utils';
import { EXPENSE_CATEGORIES } from '../../lib/constants';
import { cn } from '../../lib/cn';
import {
  Page, PageHeader, BackLink, Card, CardHeader,
  Select, StatCard, Skeleton, EmptyState,
} from '../../components/ui';
import { useMoney } from '../../hooks/useMoney';

/** Timezone-safe parse of a `YYYY-MM-DD` column; `m` is 1-indexed. */
const dateParts = (dateStr) => {
  if (!dateStr) return { y: 0, m: 0 };
  const [y, m] = String(dateStr).slice(0, 10).split('-').map(Number);
  return { y, m };
};

export default function ExpenseSummaryPage() {
  const money = useMoney();
  const [viewMode, setViewMode] = useState(String(getCurrentMonth()));
  const year = getCurrentYear();

  const [summary, setSummary] = useState(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      setSummary(null);
      try {
        const [paymentsRes, expensesRes, staffRes] = await Promise.all([
          api.get('/payments'),
          api.get('/expenses'),
          api.get('/staff'),
        ]);
        if (!isMounted) return;

        const payments = paymentsRes.data.data || [];
        const expenses = expensesRes.data.data || [];
        const staffPayments = (staffRes.data.data || []).flatMap((s) => s.staff_payments || []);

        let fExpenses = expenses;
        let fPayments = payments;
        let fStaff = staffPayments;

        if (viewMode === 'this_year') {
          fExpenses = expenses.filter((e) => dateParts(e.expense_date).y === year);
          fPayments = payments.filter((p) => dateParts(p.payment_date).y === year);
          fStaff = staffPayments.filter((p) => p.year === year);
        } else if (viewMode !== 'all_time') {
          const m = Number(viewMode);
          fExpenses = expenses.filter((e) => {
            const parts = dateParts(e.expense_date);
            return parts.y === year && parts.m === m;
          });
          fPayments = payments.filter((p) => {
            const parts = dateParts(p.payment_date);
            return parts.y === year && parts.m === m;
          });
          fStaff = staffPayments.filter((p) => p.year === year && p.month === m);
        }

        const revenue = fPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
        const generalExpenseOnly = fExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
        const salaryOnly = fStaff.reduce((s, p) => s + Number(p.amount_paid || 0), 0);
        const total = generalExpenseOnly + salaryOnly;

        const byCategory = {};
        for (const e of fExpenses) {
          byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount || 0);
        }

        setSummary({
          revenue,
          expenses: total,
          profit: revenue - total,
          salaryOnly,
          generalExpenseOnly,
          byCategory,
        });
      } catch (err) {
        console.error('Failed to compute summary:', err);
        if (isMounted) setSummary({ revenue: 0, expenses: 0, profit: 0, salaryOnly: 0, generalExpenseOnly: 0, byCategory: {} });
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [year, viewMode]);

  const loading = !summary;
  const profit = summary?.profit ?? 0;
  const categories = Object.entries(summary?.byCategory ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <Page>
      <PageHeader title="Profit &amp; loss" back={<BackLink to="/expenses" label="Expenses" />} />

      <Select
        aria-label="Reporting period"
        className="mb-5"
        value={viewMode}
        onChange={(e) => setViewMode(e.target.value)}
      >
        <option value="this_year">This year</option>
        <option value="all_time">All time</option>
        <optgroup label="Specific month (this year)">
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={String(i + 1)}>
              {getMonthName(i + 1)}
            </option>
          ))}
        </optgroup>
      </Select>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        <StatCard label="Revenue" tone="success" icon={TrendingUp} loading={loading}
          value={money(summary?.revenue ?? 0)} />
        <StatCard label="Staff salaries" tone="warning" icon={Wallet} loading={loading}
          value={money(summary?.salaryOnly ?? 0)} />
        <StatCard label="General expenses" tone="info" icon={Receipt} loading={loading}
          value={money(summary?.generalExpenseOnly ?? 0)} />
        <StatCard label="Total expenses" tone="danger" icon={Layers} loading={loading}
          value={money(summary?.expenses ?? 0)} />
      </div>

      <Card
        className={cn(
          'text-center mb-6 border-2',
          loading ? 'border-line' : profit >= 0 ? 'border-success/30' : 'border-danger/30'
        )}
        padding="lg"
      >
        {loading ? (
          <Skeleton className="h-14 w-48 mx-auto" />
        ) : (
          <>
            <span
              className={cn(
                'inline-flex items-center justify-center size-10 rounded-xl mb-2',
                profit >= 0 ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'
              )}
            >
              {profit >= 0 ? (
                <TrendingUp className="size-5" aria-hidden="true" />
              ) : (
                <TrendingDown className="size-5" aria-hidden="true" />
              )}
            </span>
            <p className="text-sm text-muted">Net profit</p>
            <p
              className={cn(
                'text-3xl font-bold font-display tabular-nums',
                profit >= 0 ? 'text-success' : 'text-danger'
              )}
            >
              {money(profit)}
            </p>
          </>
        )}
      </Card>

      <Card>
        <CardHeader title="Expense breakdown" subtitle="General expenses by category" />
        {loading ? (
          <Skeleton className="h-40" />
        ) : categories.length === 0 ? (
          <EmptyState icon={PieChart} title="No expenses" description="Nothing logged for this period." className="py-8" />
        ) : (
          <ul className="flex flex-col gap-3">
            {categories.map(([cat, amt]) => {
              const info = EXPENSE_CATEGORIES.find((c) => c.value === cat);
              const pct = summary.expenses > 0 ? Math.round((amt / summary.expenses) * 100) : 0;
              return (
                <li key={cat} className="flex items-center gap-3">
                  <span className="text-xl shrink-0" aria-hidden="true">
                    {info?.icon || '📦'}
                  </span>
                  <div className="grow min-w-0">
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <span className="text-sm font-medium text-body truncate">{info?.label || cat}</span>
                      <span className="text-sm font-bold text-heading tabular-nums shrink-0">
                        {money(amt)}
                        <span className="text-muted font-medium ml-1.5">{pct}%</span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent transition-[width] duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </Page>
  );
}
