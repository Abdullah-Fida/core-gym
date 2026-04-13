import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Loader2, Clock } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { useSync } from '../../hooks/useSync';
import { formatPKR, formatDate, getCurrentMonth, getCurrentYear, getMonthName } from '../../lib/utils';
import { ModernLoader } from '../../components/common/ModernLoader';
import '../../styles/payments.css';
import '../../styles/loading.css';

export default function PaymentsListPage() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(getCurrentMonth());
  const [year] = useState(getCurrentYear());
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');

  const { isSyncing } = useSync();

  // ── LIVE QUERY: Reactive to Dexie + Date Filters ──
  const paymentsData = useLiveQuery(async () => {
    try {
      const allPayments = await db.payments.toArray();
      const allMembers = await db.members.toArray();
      const allExpenses = await db.expenses.toArray();
      const allStaffPayments = await db.staff_payments.toArray();
      const allStaff = await db.staff.toArray();
      
      // IF DB IS EMPTY AND WE ARE ONLINE: Return null so ModernLoader shows
      if (allMembers.length === 0 && allPayments.length === 0 && isSyncing) {
        return null;
      }

      const memberMap = {};
      allMembers.forEach(m => memberMap[m.id] = m.name);
      
      const staffMap = {};
      allStaff.forEach(s => staffMap[s.id] = s.name);

      // Filter by period
      const filteredPayments = allPayments.filter(p => {
        const d = new Date(p.payment_date);
        return (d.getMonth() + 1) === month && d.getFullYear() === year;
      });

      const filteredExpenses = allExpenses.filter(e => {
        const d = new Date(e.expense_date);
        return (d.getMonth() + 1) === month && d.getFullYear() === year;
      });

      const filteredStaffPayments = allStaffPayments.filter(p => p.month === month && p.year === year);

      // Map to transitions logic (keep it the same)
      const transactions = [
        ...filteredPayments.map(p => ({
          id: `pay_${p.id}`,
          type: 'member_payment',
          amount: p.amount,
          date: p.payment_date,
          created_at: p.created_at || p.payment_date,
          title: memberMap[p.member_id] || 'Unknown Member',
          subtitle: p.plan_duration_months === 'custom' ? 'Custom' : `${p.plan_duration_months}m Plan`,
          method: p.payment_method,
          reason: p.notes?.includes('registration_fee:') ? 'Fee + Reg' : 'Membership'
        })),
        ...filteredExpenses.map(e => ({
          id: `exp_${e.id}`,
          type: 'expense',
          amount: e.amount,
          date: e.expense_date,
          created_at: e.created_at || e.expense_date,
          title: (e.category || 'EXPENSE').replace(/_/g, ' ').toUpperCase(),
          subtitle: 'General Expense',
          method: 'cash',
          reason: e.description || 'N/A'
        })),
        ...filteredStaffPayments.map(p => ({
          id: `staff_${p.id}`,
          type: 'staff_payment',
          amount: p.amount_paid,
          date: `${p.year}-${String(p.month).padStart(2, '0')}-01`,
          created_at: p.payment_date || new Date().toISOString(),
          title: (staffMap[p.staff_id] || 'Staff').toUpperCase(),
          subtitle: 'Salary',
          method: p.payment_method || 'CASH',
          reason: `Salary for ${getMonthName(p.month)}`
        }))
      ];

      return transactions;
    } catch (e) {
      console.error(e);
      return [];
    }
  }, [month, year, isSyncing]);

  const loading = !paymentsData && isSyncing;
  const payments = paymentsData || [];

  // Prepare filtered + visible list (used for empty state and rendering)
  const q = search.trim().toLowerCase();
  const filtered = payments.filter(p => {
    if (!(filter === 'all' || p.type === filter)) return false;
    if (!q) return true;
    const hay = `${p.title || ''} ${p.subtitle || ''} ${p.reason || ''} ${p.method || ''} ${p.title || ''}`.toLowerCase();
    return hay.includes(q) || String(p.amount).includes(q);
  });

  // Sorting: when user chooses newest/oldest sort purely by date. Keep a fallback priority for equal dates.
  const priority = { member_payment: 3, staff_payment: 2, expense: 1, history: 0 };
  const getTimestamp = (val) => {
    if (!val) return 0;
    if (typeof val === 'number' && !isNaN(val)) return val;
    // Native parse should handle ISO timestamps
    const t = Date.parse(val);
    if (!isNaN(t)) return t;
    // If it's a date-only string like YYYY-MM-DD, append time to make it parseable as UTC
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(val))) return Date.parse(String(val) + 'T00:00:00Z');
    // Fallback: try replacing space with T
    const alt = String(val).replace(' ', 'T');
    const t2 = Date.parse(alt);
    return isNaN(t2) ? 0 : t2;
  };

  const visible = filtered.slice().sort((a, b) => {
    const ta = getTimestamp(a.created_at || a.date);
    const tb = getTimestamp(b.created_at || b.date);
    if (sortOrder === 'newest') {
      const diff = tb - ta;
      if (diff !== 0) return diff;
      return (priority[b.type] || 0) - (priority[a.type] || 0);
    }
    if (sortOrder === 'oldest') {
      const diff = ta - tb;
      if (diff !== 0) return diff;
      return (priority[b.type] || 0) - (priority[a.type] || 0);
    }
    // default: keep member payments first then date desc
    const pa = priority[a.type] || 0;
    const pb = priority[b.type] || 0;
    if (pa !== pb) return pb - pa;
    return tb - ta;
  });

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-lg)' }}>
        <div>
          <h1 className="page-title">Payments</h1>
          <p className="page-subtitle">{getMonthName(month)} {year}</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => navigate('/payments/add')}><Plus size={16} /> Log</button>
      </div>

      <select className="form-select" style={{ marginBottom: 'var(--space-md)' }} value={month} onChange={e => setMonth(Number(e.target.value))}>
        {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{getMonthName(i + 1)}</option>)}
      </select>

      {/* Summary Box */}
      <div className="card" style={{ marginBottom: 'var(--space-md)', textAlign: 'center' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)' }}>
          <div>
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Income</div>
            <div style={{ fontSize: 'var(--font-lg)', fontWeight: 800, color: 'var(--status-active)' }}>{formatPKR(payments.filter(p => p.type === 'member_payment').reduce((s, p) => s + p.amount, 0))}</div>
          </div>
          <div>
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Outgoing</div>
            <div style={{ fontSize: 'var(--font-lg)', fontWeight: 800, color: 'var(--status-danger)' }}>{formatPKR(payments.filter(p => p.type !== 'member_payment' && p.type !== 'history').reduce((s, p) => s + p.amount, 0))}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 'var(--space-md)', alignItems: 'center' }}>
        <input
          className="form-input"
          placeholder="Search name, amount, method..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1 }}
        />

        <select className="form-select" value={sortOrder} onChange={e => setSortOrder(e.target.value)} style={{ width: 160 }}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>

        <div className="filter-tabs">
        {[
          { key: 'all', label: 'All' },
          { key: 'member_payment', label: 'Members' },
          { key: 'staff_payment', label: 'Staff' },
          { key: 'expense', label: 'Expenses' },
          { key: 'history', label: 'History' },
        ].map(f => (
          <button key={f.key} className={`filter-tab ${filter === f.key ? 'active' : ''}`} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '60px 0' }}>
          <ModernLoader type="morph" text="Reconciling Accounts..." />
        </div>
      ) : visible.length === 0 ? (
        <div className="empty-state"><h3>No transactions found</h3></div>
      ) : (
        visible.map(p => {
          const isIncome = p.type === 'member_payment';
          return (
            <div key={p.id} className="payment-card">
              <div className="pay-icon" style={{ 
                background: isIncome ? 'var(--status-active-bg)' : 'var(--status-danger-bg)', 
                color: isIncome ? 'var(--status-active)' : 'var(--status-danger)' 
              }}>
                {isIncome ? '💰' : '💸'}
              </div>
              <div className="pay-details" style={{ flex: 1, minWidth: 0 }}>
                <h4 style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</h4>
                <p style={{ fontSize: 11 }}>{formatDate(p.date)} • {p.subtitle}</p>
                <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Reason: {p.reason}
                </p>
              </div>
              <div className="pay-right" style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
                <div className="amount" style={{ color: isIncome ? 'var(--status-active)' : (p.type === 'history' ? 'var(--text-muted)' : 'var(--status-danger)') }}>
                  {p.type === 'history' ? '' : (isIncome ? '+' : '-')}{formatPKR(p.amount)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <span className="method" style={{ fontSize: 10, textTransform: 'uppercase' }}>{p.method}</span>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
