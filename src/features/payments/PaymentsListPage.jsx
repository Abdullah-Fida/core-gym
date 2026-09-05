import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, ArrowDownLeft, ArrowUpRight, Receipt } from 'lucide-react';
import { formatDateTime, getCurrentMonth, getCurrentYear, getMonthName } from '../../lib/utils';
import api from '../../lib/api';
import { cn } from '../../lib/cn';
import {
  Page, PageHeader, Button, Card, Input, Select, Tabs,
  EmptyState, ListSkeleton,
} from '../../components/ui';
import { useMoney } from '../../hooks/useMoney';

const TYPE_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'member_payment', label: 'Members' },
  { key: 'staff_payment', label: 'Staff' },
  { key: 'expense', label: 'Expenses' },
  { key: 'history', label: 'History' },
];

// Used only to break ties when two entries share a timestamp.
const PRIORITY = { member_payment: 3, staff_payment: 2, expense: 1, history: 0 };

function toTimestamp(val) {
  if (!val) return 0;
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  const t = Date.parse(val);
  if (!Number.isNaN(t)) return t;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(val))) return Date.parse(`${val}T00:00:00Z`);
  const alt = Date.parse(String(val).replace(' ', 'T'));
  return Number.isNaN(alt) ? 0 : alt;
}

export default function PaymentsListPage() {
  const money = useMoney();
  const navigate = useNavigate();
  const [month, setMonth] = useState(getCurrentMonth());
  const [year] = useState(getCurrentYear());
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');

  const [paymentsData, setPaymentsData] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchTransactions = async () => {
      setPaymentsData(null); // show the loading state for the new month
      try {
        const res = await api.get('/payments/all-transactions', { params: { month, year } });
        if (isMounted) setPaymentsData(res.data.data);
      } catch (err) {
        console.error(err);
        if (isMounted) setPaymentsData([]);
      }
    };
    fetchTransactions();
    return () => {
      isMounted = false;
    };
  }, [month, year]);

  // Stable identity so the memos below do not recompute on every render.
  const payments = useMemo(() => paymentsData ?? [], [paymentsData]);

  const totals = useMemo(
    () => ({
      income: payments.filter((p) => p.type === 'member_payment').reduce((s, p) => s + p.amount, 0),
      outgoing: payments
        .filter((p) => p.type !== 'member_payment' && p.type !== 'history')
        .reduce((s, p) => s + p.amount, 0),
    }),
    [payments]
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = payments.filter((p) => {
      if (filter !== 'all' && p.type !== filter) return false;
      if (!q) return true;
      const hay = `${p.title || ''} ${p.subtitle || ''} ${p.reason || ''} ${p.method || ''}`.toLowerCase();
      return hay.includes(q) || String(p.amount).includes(q);
    });

    return [...filtered].sort((a, b) => {
      const ta = toTimestamp(a.created_at || a.date);
      const tb = toTimestamp(b.created_at || b.date);
      const byDate = sortOrder === 'oldest' ? ta - tb : tb - ta;
      if (byDate !== 0) return byDate;
      return (PRIORITY[b.type] || 0) - (PRIORITY[a.type] || 0);
    });
  }, [payments, filter, search, sortOrder]);

  const loading = paymentsData === null;

  return (
    <Page>
      <PageHeader
        title="Payments"
        subtitle={`${getMonthName(month)} ${year}`}
        actions={
          <Button onClick={() => navigate('/payments/add')}>
            <Plus className="size-4" aria-hidden="true" />
            Log payment
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Card className="flex items-center gap-3">
          <span className="flex items-center justify-center size-10 rounded-xl bg-success-soft text-success shrink-0">
            <ArrowDownLeft className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-xs text-muted font-medium">Income</span>
            <span className="block text-lg font-bold text-success font-display tabular-nums truncate">
              {loading ? '—' : money(totals.income)}
            </span>
          </span>
        </Card>
        <Card className="flex items-center gap-3">
          <span className="flex items-center justify-center size-10 rounded-xl bg-danger-soft text-danger shrink-0">
            <ArrowUpRight className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-xs text-muted font-medium">Outgoing</span>
            <span className="block text-lg font-bold text-danger font-display tabular-nums truncate">
              {loading ? '—' : money(totals.outgoing)}
            </span>
          </span>
        </Card>
      </div>

      <div className="flex flex-col gap-3 mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted"
              aria-hidden="true"
            />
            <Input
              type="search"
              className="pl-9"
              placeholder="Search name, amount or method…"
              aria-label="Search transactions"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select aria-label="Month" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {getMonthName(i + 1)}
              </option>
            ))}
          </Select>
          <Select aria-label="Sort order" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </Select>
        </div>

        <Tabs items={TYPE_FILTERS} value={filter} onChange={setFilter} size="sm" />
      </div>

      {loading ? (
        <ListSkeleton rows={6} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No transactions"
          description={
            search || filter !== 'all'
              ? 'Try a different search or filter.'
              : `Nothing recorded for ${getMonthName(month)} yet.`
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((p) => {
            const isIncome = p.type === 'member_payment';
            const isHistory = p.type === 'history';
            return (
              <li
                key={p.id}
                className="flex items-center gap-3 p-3 sm:p-4 bg-surface-2 border border-line rounded-xl"
              >
                <span
                  className={cn(
                    'flex items-center justify-center size-10 rounded-xl shrink-0',
                    isIncome ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'
                  )}
                >
                  {isIncome ? (
                    <ArrowDownLeft className="size-5" aria-hidden="true" />
                  ) : (
                    <ArrowUpRight className="size-5" aria-hidden="true" />
                  )}
                </span>

                <div className="grow min-w-0">
                  <p className="font-semibold text-heading truncate">{p.title}</p>
                  <p className="text-xs text-muted truncate">
                    {formatDateTime(p.created_at || p.date)}
                    {p.subtitle ? ` · ${p.subtitle}` : ''}
                  </p>
                  {p.reason && p.reason !== 'N/A' && (
                    <p className="text-[0.6875rem] text-muted italic truncate mt-0.5">{p.reason}</p>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <p
                    className={cn(
                      'font-bold tabular-nums',
                      isHistory ? 'text-muted' : isIncome ? 'text-success' : 'text-danger'
                    )}
                  >
                    {isHistory ? '' : isIncome ? '+' : '−'}
                    {money(p.amount)}
                  </p>
                  {p.method && (
                    <p className="text-[0.625rem] uppercase tracking-wide text-muted font-semibold mt-0.5">
                      {p.method}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Page>
  );
}
