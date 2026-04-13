import { useState, useEffect } from 'react';
import { Building2, Users, CreditCard, TrendingUp, AlertTriangle, RefreshCcw, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { formatPKR, calculateHealthScore } from '../../lib/utils';
import '../../styles/admin.css';

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState(null);
  const [gyms, setGyms] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [mRes, gRes, aRes] = await Promise.all([
          api.get('/admin/metrics'),
          api.get('/admin/gyms', { params: { limit: 100 } }),
          api.get('/admin/alerts')
        ]);
        setMetrics(mRes.data.data);
        setGyms(gRes.data.data);
        setAlerts(aRes.data.data);
      } catch (err) {
        console.error('Failed to fetch admin dashboard data', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading || !metrics) {
    return (
      <div className="admin-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Loader2 className="spin" size={48} />
      </div>
    );
  }

  // Top 5 most active (by member count)
  const topActive = [...gyms].sort((a, b) => (b.members?.[0]?.count || 0) - (a.members?.[0]?.count || 0)).slice(0, 5);
  // Top 5 lowest health
  const lowHealth = [...gyms].map(g => ({ ...g, healthScore: calculateHealthScore(g) })).sort((a, b) => a.healthScore - b.healthScore).slice(0, 5);

  const stats = [
    { label: 'Total Gyms', value: metrics.totalGyms, color: 'var(--accent-primary)', path: '/admin/gyms' },
    { label: 'Monthly Revenue', value: formatPKR(metrics.totalMonthlyRevenue || 0), color: 'var(--status-active)', path: '/admin/payments?type=RECURRING' },
    { label: 'Setup Fees', value: formatPKR(metrics.totalSetupRevenue || 0), color: 'var(--status-warning)', path: '/admin/payments?type=SETUP' },
    { label: 'Total Income', value: formatPKR(metrics.totalCombinedRevenue || 0), color: 'var(--text-primary)', path: '/admin/payments' },
    { label: 'MRR (Estimated)', value: formatPKR(metrics.mrr || 0), color: 'var(--status-info)' },
    { label: 'Renewals Due (7d)', value: metrics.renewalsDue, color: 'var(--status-warning)', path: '/admin/alerts' },
  ];

  return (
    <div className="admin-container">
      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <h1 className="page-title" style={{ fontSize: 'var(--font-2xl)' }}>Admin Dashboard</h1>
        <p className="page-subtitle">Platform overview & business intelligence</p>
      </div>

      <div className="admin-stats-grid">
        {stats.map((s, i) => (
          <div 
            key={i} 
            className={`admin-stat-card ${s.path ? 'clickable' : ''}`} 
            onClick={() => s.path && navigate(s.path)}
            style={{ cursor: s.path ? 'pointer' : 'default' }}
          >
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color, fontSize: s.value?.toString().length > 10 ? '1.4rem' : 'var(--font-2xl)' }}>{s.value}</div>
            {s.path && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>View Details →</div>}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-xl)' }}>
        {/* Top Active Gyms */}
        <div className="admin-section">
          <div className="admin-section-header"><h2>🏆 Most Active Gyms</h2></div>
          {topActive.map((g, i) => (
            <div key={g.id} className="card card-clickable" style={{ marginBottom: 'var(--space-sm)', display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}
              onClick={() => navigate(`/admin/gyms/${g.id}`)}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 12 }}>{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>{g.gym_name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{g.city} • {g.members?.[0]?.count || 0} members</div>
              </div>
              <span className="badge badge-active">{g.plan_type}</span>
            </div>
          ))}
        </div>

        {/* Low Health Score */}
        <div className="admin-section">
          <div className="admin-section-header"><h2>⚠️ Action Needed</h2></div>
          {lowHealth.map(g => {
            const hClass = g.healthScore <= 30 ? 'red' : g.healthScore <= 60 ? 'yellow' : 'green';
            return (
              <div key={g.id} className="card card-clickable" style={{ marginBottom: 'var(--space-sm)', display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}
                onClick={() => navigate(`/admin/gyms/${g.id}`)}>
                <span className={`health-badge ${hClass}`}>{g.healthScore}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>{g.gym_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{g.owner_name} • {g.city}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Alerts */}
      {alerts.length > 0 && (
        <div className="admin-section">
          <div className="admin-section-header">
            <h2>🔔 Active Alerts ({alerts.length})</h2>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/admin/alerts')}>View All</button>
          </div>
          {alerts.slice(0, 3).map(a => (
            <div key={a.id} className="alert-card">
              <div className="alert-icon" style={{ background: a.type === 'trial_ending' ? 'var(--status-warning-bg)' : a.type === 'subscription_expired' ? 'var(--status-danger-bg)' : 'var(--status-info-bg)' }}>
                {a.type === 'trial_ending' ? '⏰' : a.type === 'no_login' ? '😴' : a.type === 'no_members' ? '👤' : '🔴'}
              </div>
              <div className="alert-body">
                <h4>{a.gym.gym_name}</h4>
                <p>{a.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
