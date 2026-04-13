import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign, Receipt, PieChart, Activity } from 'lucide-react';
import { db } from '../../lib/db';
import { formatPKR, getMonthName } from '../../lib/utils';
import { ModernLoader } from '../../components/common/ModernLoader';

export default function FinancialReportsPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState('this_month');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ revenue: 0, expenses: 0, prevRevenue: 0, prevExpenses: 0 });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const payments = await db.payments.toArray();
        const expenses = await db.expenses.toArray();
        const now = new Date();

        const filterByPeriod = (items, dateField, targetDate) => {
           return items.filter(item => {
             const d = new Date(item[dateField]);
             return d.getMonth() === targetDate.getMonth() && d.getFullYear() === targetDate.getFullYear();
           }).reduce((acc, item) => acc + (item.amount || 0), 0);
        };

        const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        
        const currentRevenue = filterByPeriod(payments, 'payment_date', now);
        const currentExpenses = filterByPeriod(expenses, 'date', now);
        const prevRevenue = filterByPeriod(payments, 'payment_date', prevDate);
        const prevExpenses = filterByPeriod(expenses, 'date', prevDate);

        setData({ revenue: currentRevenue, expenses: currentExpenses, prevRevenue, prevExpenses });
      } catch (err) {
        console.error('Failed to fetch financial data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [period]);

  const profit = data.revenue - data.expenses;
  const prevProfit = data.prevRevenue - data.prevExpenses;
  const profitChange = prevProfit > 0 ? Math.round(((profit - prevProfit) / prevProfit) * 100) : 0;

  if (loading) return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <ModernLoader type="morph" text="Gathering Financial Data..." />
    </div>
  );

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
        <button className="btn btn-icon btn-secondary" onClick={() => navigate(-1)}><ArrowLeft size={20} /></button>
        <h1 className="page-title">Financial Summary</h1>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: '1fr', gap: 'var(--space-md)' }}>
        {/* Net Profit Card */}
        <div className="stat-card" style={{ background: 'var(--accent-gradient)', border: 'none', color: 'white', padding: 'var(--space-xl)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '12px', opacity: 0.8, textTransform: 'uppercase', fontWeight: 800, letterSpacing: 1 }}>Net Profit ({getMonthName(new Date().getMonth() + 1)})</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, marginTop: 4 }}>{formatPKR(profit)}</div>
            </div>
            <div style={{ padding: 12, background: 'rgba(255,255,255,0.2)', borderRadius: '12px' }}>
              <Activity size={24} />
            </div>
          </div>
          <div style={{ marginTop: 'var(--space-lg)', display: 'flex', alignItems: 'center', gap: 8, fontSize: '14px', background: 'rgba(0,0,0,0.1)', padding: '8px 12px', borderRadius: '8px', width: 'fit-content' }}>
            {profitChange >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            <span>{profitChange >= 0 ? '+' : ''}{profitChange}% vs last month</span>
          </div>
        </div>

        {/* Revenue & Expenses Split */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-md)' }}>
           <div className="card" style={{ borderLeft: '4px solid var(--status-active)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}>Revenue</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--status-active)', marginTop: 4 }}>
                {formatPKR(data.revenue)}
              </div>
           </div>
           <div className="card" style={{ borderLeft: '4px solid var(--status-danger)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}>Expenses</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--status-danger)', marginTop: 4 }}>
                {formatPKR(data.expenses)}
              </div>
           </div>
        </div>
      </div>

      <div style={{ marginTop: 'var(--space-xl)' }}>
        <h3 className="section-title">Analysis</h3>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
              <div style={{ width: 40, height: 40, borderRadius: '10px', background: 'var(--status-active-bg)', color: 'var(--status-active)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DollarSign size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Membership Collections</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total fees received this month</div>
              </div>
              <div style={{ fontWeight: 800 }}>{formatPKR(data.revenue)}</div>
           </div>

           <div style={{ borderTop: '1px solid var(--border-color)' }}></div>

           <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
              <div style={{ width: 40, height: 40, borderRadius: '10px', background: 'var(--status-danger-bg)', color: 'var(--status-danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Receipt size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Bills & Operations</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Spending for this month</div>
              </div>
              <div style={{ fontWeight: 800 }}>{formatPKR(data.expenses)}</div>
           </div>
        </div>
      </div>

      <button className="btn btn-secondary btn-block" style={{ marginTop: 'var(--space-xl)' }} onClick={() => navigate('/reports/new-members')}>
        <PieChart size={18} /> View Membership Growth Report
      </button>
    </div>
  );
}
