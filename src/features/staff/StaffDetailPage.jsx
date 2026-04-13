import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, CreditCard, Trash2, CalendarCheck, Loader2 } from 'lucide-react';
import { db, queueSyncTask } from '../../lib/db';
import { useAuth } from '../../contexts/AuthContext';
import { getInitials, formatPKR, formatDate, getCurrentMonth, getCurrentYear, getMonthName, generateId } from '../../lib/utils';
import { STAFF_ROLES, PAYMENT_METHODS } from '../../lib/constants';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { ModernLoader } from '../../components/common/ModernLoader';
import '../../styles/members.css';

export default function StaffDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();
  
  const [staff, setStaff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPayForm, setShowPayForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [payForm, setPayForm] = useState({ 
    amount_paid: '', 
    paid_date: new Date().toISOString().split('T')[0], 
    payment_method: 'cash', 
    notes: '' 
  });

  const month = getCurrentMonth();
  const year = getCurrentYear();

  useEffect(() => {
    const fetchStaff = async () => {
      setLoading(true);
      try {
        const s = await db.staff.get(id);
        if (s) {
          s.staff_payments = await db.staff_payments.where('staff_id').equals(id).toArray() || [];
          setStaff(s);
          setPayForm(p => ({ ...p, amount_paid: String(s.monthly_salary) }));
        } else {
          toast.error('Staff member not found locally');
        }
      } catch (err) {
        console.error('Failed to fetch staff member', err);
        toast.error('Staff member not found');
      } finally {
        setLoading(false);
      }
    };
    fetchStaff();
  }, [id]);

  if (loading) return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <ModernLoader type="morph" text="Loading Staff Profile..." />
    </div>
  );

  if (!staff) return <div className="page-container"><p>Staff not found</p></div>;

  const salaryHistory = staff.staff_payments || [];
  const isPaid = salaryHistory.some(p => p.month === month && p.year === year);
  const roleInfo = STAFF_ROLES.find(r => r.value === staff.role);

  const handlePaySalary = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const pid = generateId();
      const payload = { 
        id: pid,
        staff_id: id,
        month, 
        year, 
        amount_paid: Number(payForm.amount_paid), 
        paid_date: payForm.paid_date, 
        payment_method: payForm.payment_method, 
        notes: payForm.notes 
      };
      await db.staff_payments.add(payload);
      await queueSyncTask('staff_payment', 'CREATE', payload);

      toast.success(`Salary marked as paid for ${staff.name} locally!`);
      setShowPayForm(false);
      
      // Refresh local data
      const s = await db.staff.get(id);
      if (s) {
        s.staff_payments = await db.staff_payments.where('staff_id').equals(id).toArray() || [];
        setStaff(s);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to log salary payment');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    const isConfirmed = await confirm({
      title: 'Remove Staff',
      message: `Are you sure you want to remove ${staff.name}? This will delete their profile and salary history.`,
      confirmText: 'Yes, Remove Staff',
      type: 'danger'
    });

    if (isConfirmed) {
      try {
        // Cascade delete local staff payments
        const localPayments = await db.staff_payments.where('staff_id').equals(id).toArray();
        for (const p of localPayments) {
          await db.staff_payments.delete(p.id);
        }
        
        await db.staff.delete(id);
        await queueSyncTask('staff', 'DELETE', { id });
        toast.success('Staff removed locally');
        navigate('/staff');
      } catch (err) {
        toast.error('Failed to remove staff');
      }
    }
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
        <button className="btn btn-icon btn-secondary" onClick={() => navigate(-1)}><ArrowLeft size={20} /></button>
        <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>Staff Profile</span>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 'var(--space-lg)' }}>
        <div className="avatar avatar-xl" style={{ background: roleInfo?.color || 'var(--accent-gradient)', margin: '0 auto var(--space-md)' }}>{getInitials(staff.name)}</div>
        <h2>{staff.name}</h2>
        <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>{staff.phone}</div>
        <div style={{ marginTop: 'var(--space-sm)', display: 'flex', gap: 'var(--space-sm)', justifyContent: 'center' }}>
          <span className="badge" style={{ background: (roleInfo?.color || '#6c5ce7') + '22', color: roleInfo?.color }}>{roleInfo?.label || staff.custom_role}</span>
          <span className={`badge ${isPaid ? 'badge-active' : 'badge-danger'}`}>{isPaid ? 'Paid' : 'Unpaid'} ({getMonthName(month)})</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Monthly Salary</div>
          <div style={{ fontSize: 'var(--font-lg)', fontWeight: 700 }}>{formatPKR(staff.monthly_salary)}</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Joined Date</div>
          <div style={{ fontSize: 'var(--font-sm)' }}>{formatDate(staff.join_date)}</div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
        <button className="btn btn-secondary" onClick={() => navigate(`/staff/${id}/edit`)}><Edit size={16} /> Edit</button>
        {!isPaid && <button className="btn btn-primary" onClick={() => setShowPayForm(true)}><CreditCard size={16} /> Pay Salary</button>}
        {isPaid && <button className="btn btn-secondary" disabled>✓ Paid</button>}
        <button className="btn btn-danger" onClick={handleDelete}><Trash2 size={16} /> Delete</button>
      </div>

      {/* Pay Salary Form */}
      {showPayForm && (
        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
          <h3 style={{ marginBottom: 'var(--space-md)' }}>Log Salary Payment</h3>
          <form onSubmit={handlePaySalary}>
            <div className="form-group"><label className="form-label">Amount Paid</label><input className="form-input" type="number" value={payForm.amount_paid} onChange={e => setPayForm(p => ({ ...p, amount_paid: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Date</label><input className="form-input" type="date" value={payForm.paid_date} onChange={e => setPayForm(p => ({ ...p, paid_date: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Payment Method</label><select className="form-select" value={payForm.payment_method} onChange={e => setPayForm(p => ({ ...p, payment_method: e.target.value }))}>{PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}</select></div>
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <button type="submit" className="btn btn-primary btn-block" disabled={isSaving}>
                {isSaving ? <Loader2 className="spin" size={18} /> : 'Log Salary'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowPayForm(false)} disabled={isSaving}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Salary History */}
      <h3 className="section-title">Salary History</h3>
      <div className="card">
        {salaryHistory.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--space-md)' }}>No payments yet</p>
        ) : (
          salaryHistory.map(sp => (
            <div key={sp.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{getMonthName(sp.month)} {sp.year}</div>
                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>{formatDate(sp.paid_date)} • {sp.payment_method}</div>
              </div>
              <div style={{ fontWeight: 700, color: 'var(--status-active)' }}>{formatPKR(sp.amount_paid)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

