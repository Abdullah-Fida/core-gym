import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { db } from '../../lib/db';
import { getInitials, getCurrentMonth, getCurrentYear } from '../../lib/utils';
import { STAFF_ROLES } from '../../lib/constants';
import { MemberSkeleton, StateView } from '../../components/common/StateView';
import '../../styles/members.css';

export default function StaffListPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const month = getCurrentMonth();
  const year = getCurrentYear();
  
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStaff = async () => {
    setLoading(true);
    setError(null);
    try {
      const localStaff = await db.staff.toArray();
      const localPayments = await db.staff_payments.toArray();
      
      let results = localStaff.map(s => {
        s.staff_payments = localPayments.filter(p => p.staff_id === s.id);
        s.isPaid = s.staff_payments.some(p => p.month === month && p.year === year);
        return s;
      });

      if (filter !== 'all') {
        results = results.filter(s => s.status === filter);
      }

      setStaff(results);
    } catch (err) {
      console.error('Failed to fetch staff from local DB', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, [filter, month, year]);

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-lg)' }}>
        <div><h1 className="page-title">Staff</h1><p className="page-subtitle">{staff.length} staff members</p></div>
        <button className="btn btn-primary btn-sm" onClick={() => navigate('/staff/add')}><UserPlus size={16} /> Add</button>
      </div>

      <div className="filter-tabs">
        {['all', 'active', 'inactive'].map(f => (
          <button key={f} className={`filter-tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="staff-content">
        {loading ? (
          <div className="skeleton-container">
            {[1, 2, 3, 4].map(i => <MemberSkeleton key={i} />)}
          </div>
        ) : error ? (
          <StateView 
            type="error" 
            title="Failed to load staff" 
            description={error} 
            onRetry={fetchStaff} 
          />
        ) : staff.length === 0 ? (
          <StateView 
            type="empty" 
            title="No staff members found" 
            description={filter !== 'all' ? "Try changing your filter settings." : "Start by adding your first gym staff member."}
          />
        ) : (
          staff.map(s => {
            const roleInfo = STAFF_ROLES.find(r => r.value === s.role);
            const isPaid = s.isPaid;
            return (
              <div key={s.id} className="card card-clickable" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-sm)' }}
                onClick={() => navigate(`/staff/${s.id}`)}>
                <div className="avatar" style={{ background: roleInfo?.color || 'var(--accent-gradient)' }}>{getInitials(s.name)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                  <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>{s.phone}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="badge" style={{ background: roleInfo?.color + '22', color: roleInfo?.color, marginBottom: 4, display: 'block' }}>
                    {roleInfo?.label || s.custom_role || 'Staff'}
                  </span>
                  <span className={`badge ${isPaid ? 'badge-active' : 'badge-danger'}`} style={{ fontSize: 10 }}>
                    {isPaid ? '✓ PAID' : 'UNPAID'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
