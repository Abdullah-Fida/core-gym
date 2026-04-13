import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import api from '../../lib/api';
import { formatPKR, getCurrentMonth, getCurrentYear, getMonthName } from '../../lib/utils';
import { EXPENSE_CATEGORIES } from '../../lib/constants';
import { useSync } from '../../hooks/useSync';
import { db } from '../../lib/db';
import '../../styles/members.css';

export default function ExpenseSummaryPage() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(getCurrentMonth());
  const year = getCurrentYear();
  
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const { isSyncing, online } = useSync();

  useEffect(() => {
    const fetchSummary = async () => {
      setLoading(true);
      try {
        const localExpenses = await db.expenses.toArray();
        const localPayments = await db.payments.toArray();
        const localStaffPayments = await db.staff_payments.toArray();

        const allExpenses = localExpenses.filter(e => new Date(e.expense_date).getFullYear() === year);
        const allPayments = localPayments.filter(p => new Date(p.payment_date).getFullYear() === year);
        const allStaffPayments = localStaffPayments.filter(p => p.year === year);

        const monthly = Array.from({ length: 12 }, (_, i) => {
          const m = i + 1;
          const rev = allPayments.filter(p => new Date(p.payment_date).getMonth() === i).reduce((s, p) => s + p.amount, 0);
          const exp = allExpenses.filter(e => new Date(e.expense_date).getMonth() === i).reduce((s, e) => s + e.amount, 0);
          const sal = allStaffPayments.filter(p => p.month === m).reduce((s, p) => s + p.amount_paid, 0);
          const totalExp = exp + sal;
          return { month: m, revenue: rev, expenses: totalExp, profit: rev - totalExp, salaryOnly: sal, generalExpenseOnly: exp };
        });

        const byCategory = {};
        allExpenses.forEach(e => { byCategory[e.category] = (byCategory[e.category] || 0) + e.amount; });

        const totalRevenue = allPayments.reduce((s, p) => s + p.amount, 0);
        const totalGeneralExpenses = allExpenses.reduce((s, e) => s + e.amount, 0);
        const totalSalaries = allStaffPayments.reduce((s, p) => s + p.amount_paid, 0);

        setSummary({
          monthly,
          byCategory,
          totals: {
            revenue: totalRevenue,
            expenses: totalGeneralExpenses + totalSalaries,
            salaries: totalSalaries,
            generalExpenses: totalGeneralExpenses,
            profit: totalRevenue - (totalGeneralExpenses + totalSalaries)
          }
        });
      } catch (err) {
        console.error('Failed to compute summary from local DB:', err);
      } finally {
        setLoading(false);
      }
    };
    
    if (!isSyncing) fetchSummary();
  }, [year, isSyncing]);

  if (loading || !summary) return (
    <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <Loader2 className="spin" size={48} style={{ color: 'var(--primary)' }} />
    </div>
  );

  const monthData = summary.monthly.find(m => m.month === month) || { revenue: 0, expenses: 0, profit: 0 };
  const revenue = monthData.revenue;
  const expenses = monthData.expenses;
  const profit = monthData.profit;
  const byCategory = summary.byCategory || {};

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
        <button className="btn btn-icon btn-secondary" onClick={() => navigate(-1)}><ArrowLeft size={20} /></button>
        <h1 className="page-title">Profit / Loss</h1>
      </div>

      <select className="form-select" style={{ marginBottom: 'var(--space-lg)' }} value={month} onChange={e => setMonth(Number(e.target.value))}>
        {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{getMonthName(i + 1)}</option>)}
      </select>

      {/* 4 Boxes Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <TrendingUp size={20} style={{ color: 'var(--status-active)', margin: '0 auto var(--space-xs)' }} />
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Revenue</div>
          <div style={{ fontSize: 'var(--font-md)', fontWeight: 800, color: 'var(--status-active)' }}>{formatPKR(revenue)}</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <Minus size={20} style={{ color: '#e84393', margin: '0 auto var(--space-xs)' }} />
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Staff Salaries</div>
          <div style={{ fontSize: 'var(--font-md)', fontWeight: 800, color: '#e84393' }}>{formatPKR(monthData.salaryOnly || 0)}</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <Minus size={20} style={{ color: '#fdcb6e', margin: '0 auto var(--space-xs)' }} />
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>General Expenses</div>
          <div style={{ fontSize: 'var(--font-md)', fontWeight: 800, color: '#fdcb6e' }}>{formatPKR(monthData.generalExpenseOnly || 0)}</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <Minus size={20} style={{ color: 'var(--status-danger)', margin: '0 auto var(--space-xs)' }} />
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Total All Expenses</div>
          <div style={{ fontSize: 'var(--font-md)', fontWeight: 800, color: 'var(--status-danger)' }}>{formatPKR(expenses)}</div>
        </div>
      </div>

      <div className="card" style={{ textAlign: 'center', border: `2px solid ${profit >= 0 ? 'rgba(0,184,148,0.3)' : 'rgba(255,118,117,0.3)'}`, marginBottom: 'var(--space-lg)' }}>
        {profit >= 0 ? <TrendingUp size={24} style={{ color: 'var(--status-active)', margin: '0 auto var(--space-xs)' }} /> : <TrendingDown size={24} style={{ color: 'var(--status-danger)', margin: '0 auto var(--space-xs)' }} />}
        <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)' }}>Net Profit</div>
        <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 900, color: profit >= 0 ? 'var(--status-active)' : 'var(--status-danger)' }}>{formatPKR(profit)}</div>
      </div>

      {/* Category Breakdown */}
      <h3 className="section-title">Expense Breakdown</h3>
      <div className="card">
        {Object.entries(byCategory).map(([cat, amt]) => {
          const catInfo = EXPENSE_CATEGORIES.find(c => c.value === cat);
          const pct = expenses > 0 ? Math.round((amt / expenses) * 100) : 0;
          return (
            <div key={cat} style={{ padding: '12px 0', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
              <span style={{ fontSize: 20 }}>{catInfo?.icon || '📦'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 'var(--font-sm)', fontWeight: 500 }}>{catInfo?.label || cat}</span>
                  <span style={{ fontSize: 'var(--font-sm)', fontWeight: 700 }}>{formatPKR(amt)}</span>
                </div>
                <div style={{ height: 4, background: 'var(--bg-tertiary)', borderRadius: 2 }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent-gradient)', borderRadius: 2, transition: 'width 0.5s ease' }}></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
