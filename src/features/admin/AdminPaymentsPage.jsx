import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, Receipt } from 'lucide-react';
import api from '../../lib/api';
import { formatDate } from '../../lib/utils';
import { useToast } from '../../contexts/ToastContext';
import {
  Page, PageHeader, BackLink, Button, Badge, Table,
  Input, Select, EmptyState, ListSkeleton,
} from '../../components/ui';
import { useMoney } from '../../hooks/useMoney';

/**
 * Rows come from the `platform_payments` table: `amount` is a numeric column
 * and `kind` is a checked enum.
 *
 * They were previously JSON strings inside `admin_notes.text`, discriminated by
 * the magic value `admin = 'PaymentSystem'`, which meant this page had to parse
 * every row defensively and totals could not be computed in SQL.
 */
const PAYMENT_KIND_LABEL = {
  subscription: 'Subscription',
  setup: 'Setup',
  refund: 'Refund',
  adjustment: 'Adjustment',
};

const PAYMENT_KIND_VARIANT = {
  subscription: 'success',
  setup: 'warning',
  refund: 'danger',
  adjustment: 'info',
};

export default function AdminPaymentsPage() {
  const money = useMoney();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [payments, setPayments] = useState(null);
  const [filterType, setFilterType] = useState(searchParams.get('type') || '');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get('/admin/payments');
        if (alive) setPayments(res.data.data || []);
      } catch (err) {
        console.error(err);
        if (alive) {
          setPayments([]);
          toast.error('Could not load platform payments.');
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [toast]);

  const filtered = useMemo(() => {
    if (!payments) return null;
    const q = searchTerm.trim().toLowerCase();
    return payments.filter((p) => {
      if (filterType && p.kind !== filterType) return false;
      if (!q) return true;
      return (
        (p.gym?.gym_name || '').toLowerCase().includes(q) || String(p.amount).includes(q)
      );
    });
  }, [payments, filterType, searchTerm]);

  const loading = filtered === null;
  const rows = filtered ?? [];

  const columns = [
    {
      key: 'gym',
      header: 'Gym',
      render: (p) => (
        <span className="font-semibold text-heading">{p.gym?.gym_name || 'Deleted gym'}</span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (p) => <span className="font-bold tabular-nums">{money(p.amount)}</span>,
    },
    {
      key: 'type',
      header: 'Type',
      render: (p) => (
        <Badge variant={PAYMENT_KIND_VARIANT[p.kind] ?? 'neutral'}>
          {PAYMENT_KIND_LABEL[p.kind] ?? p.kind}
        </Badge>
      ),
    },
    { key: 'date', header: 'Date', render: (p) => <span className="text-xs">{formatDate(p.paid_at)}</span> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (p) => (
        <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/gyms/${p.gym_id}`)}>
          Details
        </Button>
      ),
    },
  ];

  const total = rows.reduce((s, p) => s + Number(p.amount || 0), 0);

  return (
    <Page>
      <PageHeader
        title="Platform payments"
        subtitle={loading ? 'Loading…' : `${rows.length} records · ${money(total)}`}
        back={<BackLink to="/admin/dashboard" label="Overview" />}
      />

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 mb-5">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted"
            aria-hidden="true"
          />
          <Input
            type="search"
            className="pl-9"
            placeholder="Search gym or amount…"
            aria-label="Search payments"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select aria-label="Payment type" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">All types</option>
          {Object.entries(PAYMENT_KIND_LABEL).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
      </div>

      {loading ? (
        <ListSkeleton rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No payments recorded"
          description={searchTerm || filterType ? 'Try a different filter.' : 'Platform revenue will appear here.'}
        />
      ) : (
        <Table
          columns={columns}
          rows={rows}
          renderCard={(p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => navigate(`/admin/gyms/${p.gym_id}`)}
              className="flex items-center gap-3 w-full p-3 text-left bg-surface-2 border border-line rounded-xl transition-colors hover:border-line-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span className="grow min-w-0">
                <span className="block font-semibold text-heading truncate">
                  {p.gym?.gym_name || 'Deleted gym'}
                </span>
                <span className="block text-xs text-muted">{formatDate(p.paid_at)}</span>
              </span>
              <span className="flex flex-col items-end gap-1 shrink-0">
                <span className="font-bold text-heading tabular-nums">{money(p.amount)}</span>
                <Badge variant={PAYMENT_KIND_VARIANT[p.kind] ?? 'neutral'}>
                  {PAYMENT_KIND_LABEL[p.kind] ?? p.kind}
                </Badge>
              </span>
            </button>
          )}
        />
      )}
    </Page>
  );
}
