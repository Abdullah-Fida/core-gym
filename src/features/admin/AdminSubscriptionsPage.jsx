import { useState, useEffect } from 'react';
import api from '../../lib/api';
import { formatDate, formatPKR } from '../../lib/utils';
import { useToast } from '../../contexts/ToastContext';
import { Loader2 } from 'lucide-react';
import '../../styles/admin.css';

export default function AdminSubscriptionsPage() {
  const toast = useToast();
  const [filter, setFilter] = useState('');
  const [gyms, setGyms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    async function fetchGyms() {
      setLoading(true);
      try {
        const res = await api.get('/admin/gyms');
        setGyms(res.data.data);
      } catch (err) {
        toast.error('Failed to fetch subscriptions');
      } finally {
        setLoading(false);
      }
    }
    fetchGyms();
  }, [refresh]);

  const filteredGyms = gyms.filter(g => {
    if (filter === 'active') return g.is_active && g.plan_type !== 'free';
    if (filter === 'trial') return !!g.trial_ends_at;
    if (filter === 'expired') return !g.is_active;
    return true;
  });

  const getPlanPrice = (plan) => {
    switch (plan) { case 'pro': return 5000; case 'basic': return 2000; default: return 0; }
  };

  const handleUpdatePlan = async (id, plan) => {
    try {
      await api.patch(`/admin/gyms/${id}/plan`, { plan_type: plan });
      toast.success('Plan updated');
      setRefresh(r => r + 1);
    } catch (err) {
      toast.error('Failed to update plan');
    }
  };

  const handleToggleStatus = async (id, status) => {
    try {
      await api.patch(`/admin/gyms/${id}/plan`, { is_active: !status });
      toast.success('Status updated');
      setRefresh(r => r + 1);
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  if (loading) return <div className="admin-container" style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}><Loader2 className="spin" size={40} /></div>;

  return (
    <div className="admin-container">
      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <h1 className="page-title">Subscriptions</h1>
        <p className="page-subtitle">Manage gym subscription plans</p>
      </div>

      <div className="filter-tabs" style={{ marginBottom: 'var(--space-lg)' }}>
        {[{ key: '', label: 'All' }, { key: 'active', label: 'Active' }, { key: 'trial', label: 'Trial' }, { key: 'expired', label: 'Expired' }].map(f => (
          <button key={f.key} className={`filter-tab ${filter === f.key ? 'active' : ''}`} onClick={() => setFilter(f.key)}>{f.label}</button>
        ))}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr><th>Gym</th><th>Plan</th><th>Monthly</th><th>Start</th><th>Expires</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {filteredGyms.map(g => (
              <tr key={g.id}>
                <td><div style={{ fontWeight: 600 }}>{g.gym_name}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{g.owner_name}</div></td>
                <td><span className={`badge ${g.plan_type === 'pro' ? 'badge-active' : g.plan_type === 'basic' ? 'badge-info' : 'badge-neutral'}`}>{g.plan_type}</span></td>
                <td>{formatPKR(getPlanPrice(g.plan_type))}</td>
                <td style={{ fontSize: 'var(--font-xs)' }}>{formatDate(g.created_at)}</td>
                <td style={{ fontSize: 'var(--font-xs)' }}>{g.subscription_ends_at ? formatDate(g.subscription_ends_at) : g.trial_ends_at ? formatDate(g.trial_ends_at) : '—'}</td>
                <td><span className={`badge ${g.is_active ? 'badge-active' : 'badge-danger'}`}>{g.is_active ? 'Active' : 'Expired'}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <select className="form-select" style={{ fontSize: 11, padding: '2px 4px' }} value={g.plan_type} onChange={(e) => handleUpdatePlan(g.id, e.target.value)}>
                      <option value="free">Free</option>
                      <option value="basic">Basic</option>
                      <option value="pro">Pro</option>
                    </select>
                    <button className={`btn btn-sm ${g.is_active ? 'btn-secondary' : 'btn-primary'}`} 
                      onClick={() => handleToggleStatus(g.id, g.is_active)}
                      style={{ fontSize: 11, padding: '4px 8px' }}>
                      {g.is_active ? 'Suspend' : 'Activate'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
