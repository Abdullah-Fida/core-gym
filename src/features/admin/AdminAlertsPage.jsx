import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Phone, MessageCircle, X, Loader2 } from 'lucide-react';
import api from '../../lib/api';
import { getWhatsAppLink } from '../../lib/utils';
import '../../styles/admin.css';

export default function AdminAlertsPage() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState([]);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [renewalForm, setRenewalForm] = useState({ gymId: '', gymName: '', months: '1', customDays: '', amount: '3000' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function fetchAlerts() {
      setLoading(true);
      try {
        const res = await api.get('/admin/alerts');
        setAlerts(res.data.data);
      } catch (err) {
        console.error('Failed to fetch admin alerts', err);
      } finally {
        setLoading(false);
      }
    }
    fetchAlerts();
  }, []);

  const visibleAlerts = alerts.filter(a => !dismissed.includes(a.id));

  const getAlertConfig = (type) => {
    switch (type) {
      case 'trial_ending': return { icon: '⏰', bg: 'var(--status-warning-bg)', title: 'Subscription Ending Soon' };
      case 'no_login': return { icon: '😴', bg: 'var(--status-info-bg)', title: 'No Login (14+ days)' };
      case 'no_members': return { icon: '👤', bg: 'var(--status-warning-bg)', title: 'No Members Added' };
      case 'suspended_expired': return { icon: '🔴', bg: 'var(--status-danger-bg)', title: 'Gym Suspended (Expired)' };
      default: return { icon: '📢', bg: 'var(--bg-glass)', title: 'Alert' };
    }
  };

  const handleRenewClick = (gym) => {
    setRenewalForm({ 
      gymId: gym.id, 
      gymName: gym.gym_name, 
      months: '1', 
      customDays: '', 
      amount: '3000' 
    });
    setShowRenewModal(true);
  };

  const handleRenewSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        amount: Number(renewalForm.amount),
        months: renewalForm.months === 'custom' ? 0 : Number(renewalForm.months),
        customDays: renewalForm.months === 'custom' ? Number(renewalForm.customDays) : 0
      };

      await api.post(`/admin/gyms/${renewalForm.gymId}/renew`, payload);
      
      toast.success(`🎉 ${renewalForm.gymName} Renewed! Access Reactivated.`);
      setShowRenewModal(false);
      
      // Refresh list
      const res = await api.get('/admin/alerts');
      setAlerts(res.data.data);
    } catch (err) {
      toast.error('Failed to renew subscription');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="admin-container">
      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <h1 className="page-title">Alerts</h1>
        <p className="page-subtitle">{visibleAlerts.length} items requiring action</p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}><Loader2 className="spin" size={40} /></div>
      ) : visibleAlerts.length === 0 ? (
        <div className="empty-state"><h3>🎉 All Clear</h3><p>No alerts requiring attention</p></div>
      ) : (
        visibleAlerts.map(a => {
          const config = getAlertConfig(a.type);
          return (
            <div key={a.id} className="alert-card">
              <div className="alert-icon" style={{ background: config.bg }}>{config.icon}</div>
              <div className="alert-body">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h4>{config.title}</h4>
                  <button className="btn btn-icon btn-sm" style={{ width: 28, height: 28, background: 'none', border: 'none', color: 'var(--text-muted)' }}
                    onClick={() => setDismissed(p => [...p, a.id])}><X size={14} /></button>
                </div>
                <p><strong>{a.gym.gym_name}</strong> — {a.gym.owner_name} ({a.gym.city})</p>
                <p>{a.message}</p>
                <div className="alert-actions">
                  {(a.type === 'suspended_expired' || a.type === 'trial_ending') && (
                    <button className="btn btn-sm btn-primary" onClick={() => handleRenewClick(a.gym)}>Renew Access</button>
                  )}
                  <button className="btn btn-sm btn-secondary" onClick={() => navigate(`/admin/gyms/${a.gym.id}`)}>View Detail</button>
                  <button className="btn btn-sm btn-whatsapp" onClick={() => window.open(getWhatsAppLink(a.gym.phone, `Hello ${a.gym.owner_name}, your Core Gym subscription...`), '_blank')}>
                    <MessageCircle size={14} /> WhatsApp
                  </button>
                </div>
              </div>
            </div>
          );
        })
      )}

      {showRenewModal && (
        <div className="modal-backdrop" onClick={() => setShowRenewModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: 'var(--space-md)' }}>Renew Gym Access</h2>
            <p style={{ marginBottom: 'var(--space-md)', fontSize: 'var(--font-sm)', color: 'var(--text-muted)' }}>
              Renewing <strong>{renewalForm.gymName}</strong>. This will reactivate the gym and log the payment.
            </p>
            <form onSubmit={handleRenewSubmit}>
              <div className="form-group">
                <label className="form-label">Duration</label>
                <select className="form-select" value={renewalForm.months} onChange={e => setRenewalForm({...renewalForm, months: e.target.value})}>
                  <option value="1">1 Month</option>
                  <option value="3">3 Months</option>
                  <option value="6">6 Months</option>
                  <option value="12">1 Year</option>
                  <option value="custom">Custom Days</option>
                </select>
              </div>
              
              {renewalForm.months === 'custom' && (
                <div className="form-group">
                  <label className="form-label">Custom Days</label>
                  <input required type="number" className="form-input" placeholder="e.g. 15" value={renewalForm.customDays} onChange={e => setRenewalForm({...renewalForm, customDays: e.target.value})} />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Payment Amount Collected (PKR)*</label>
                <input required type="number" className="form-input" placeholder="e.g. 2500" value={renewalForm.amount} onChange={e => setRenewalForm({...renewalForm, amount: e.target.value})} />
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-lg)' }}>
                <button type="button" className="btn btn-secondary btn-block" onClick={() => setShowRenewModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-block" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="spin" size={18} /> : 'Complete Renewal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
