import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { getInitials, getCurrentMonth, getCurrentYear } from '../../lib/utils';
import { STAFF_ROLES } from '../../lib/constants';
import { MemberSkeleton, StateView } from '../../components/common/StateView';
import { ModernLoader } from '../../components/common/ModernLoader';
import { useSync } from '../../hooks/useSync';
import '../../styles/members.css';
import '../../styles/loading.css';

export default function StaffListPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const month = getCurrentMonth();
  const year = getCurrentYear();
  const { isSyncing } = useSync();

  // ── LIVE QUERY: Reactive to Dexie changes (auto-refreshes on add/update/delete) ──
  const staffData = useLiveQuery(async () => {
    try {
      const localStaff = await db.staff.toArray();
      const localPayments = await db.staff_payments.toArray();

      // If DB is empty and we are syncing, return null so loader shows
      if (localStaff.length === 0 && isSyncing) return null;

      let results = localStaff.map(s => {
        const staffPayments = localPayments.filter(p => p.staff_id === s.id);
        const isPaid = staffPayments.some(p => p.month === month && p.year === year);
        return { ...s, staff_payments: staffPayments, isPaid };
      });

      if (filter !== 'all') {
        results = results.filter(s => s.status === filter);
      }

      return results;
    } catch (e) {
      console.error('Staff live query error:', e);
      return [];
    }
  }, [filter, month, year, isSyncing]);

  const loading = !staffData && isSyncing;
  const staff = staffData || [];

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
          <div style={{ padding: '60px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <ModernLoader type="morph" text="Syncing Staff..." />
          </div>
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
