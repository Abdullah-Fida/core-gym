import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, UserPlus, Trash2 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, queueSyncTask } from '../../lib/db';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { getInitials, daysFromNow, formatDateShort } from '../../lib/utils';
import { MemberSkeleton, StateView } from '../../components/common/StateView';
import { ModernLoader } from '../../components/common/ModernLoader';
import { useSync } from '../../hooks/useSync';
import '../../styles/members.css';
import '../../styles/loading.css';

export default function MembersListPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [sort, setSort] = useState('name');
  const [errorDetail, setErrorDetail] = useState(null);
  
  const { isSyncing } = useSync();

  // ── LIVE QUERY: Reactive to Dexie + Filters ──
  const membersData = useLiveQuery(async () => {
    try {
      let query = db.members;

      if (search) {
        const s = search.toLowerCase();
        query = db.members.filter(m => {
          const nameMatch = (m.name || '').toLowerCase().includes(s);
          const phoneMatch = String(m.phone || '').includes(s);
          return nameMatch || phoneMatch;
        });
      }

      let results = await query.toArray();
      
      // IF DB IS EMPTY AND WE ARE ONLINE: Return null so loader shows
      if (results.length === 0 && isSyncing) return null;

      // Status calculation
      results = results.map(m => {
        const days = daysFromNow(m.latest_expiry);
        let status = m.status;
        if (status !== 'inactive' && status !== 'trial') {
          if (days === null) status = 'inactive';
          else if (days < 0) status = 'expired';
          else if (days <= 3) status = 'due_soon';
          else status = 'active';
        }
        return { ...m, status };
      });

      if (statusFilter !== 'all') {
        results = results.filter(m => m.status === statusFilter);
      }

      // Sort
      if (sort === 'name') {
        results.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      } else if (sort === 'join_date') {
        results.sort((a, b) => {
          const da = a.join_date ? new Date(a.join_date).getTime() : 0;
          const db = b.join_date ? new Date(b.join_date).getTime() : 0;
          return db - da;
        });
      }

      return results;
    } catch (e) {
      console.error(e);
      return [];
    }
  }, [search, statusFilter, sort, isSyncing]);

  const loading = !membersData && isSyncing;
  const members = membersData || [];
  const totalCount = members.length;

  const handleDeleteMember = async (e, id, name) => {
    e.stopPropagation();
    
    const isConfirmed = await confirm({
      title: 'Delete Member',
      message: `Are you sure you want to delete ${name}? All their data inclusive payments and attendance will be gone forever.`,
      confirmText: 'Yes, Delete',
      type: 'danger'
    });

    if (!isConfirmed) return;
    
    try {
      // Cascade delete local payments
      const localPayments = await db.payments.where('member_id').equals(id).toArray();
      for (const p of localPayments) {
        await db.payments.delete(p.id);
      }
      
      await db.members.delete(id);
      await queueSyncTask('member', 'DELETE', { id });
      
      toast.success('Member and all records deleted');
    } catch (err) {
      console.error('Failed to delete member locally', err);
      toast.error('Could not delete.');
    }
  };

  const tabs = [
    { key: 'all', label: `All` },
    { key: 'active', label: `Active` },
    { key: 'trial', label: `Trial` },
    { key: 'inactive', label: `Inactive` },
    { key: 'due_soon', label: `Due Soon` },
    { key: 'expired', label: `Expired` },
  ];

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Members</h1>
          <p className="page-subtitle">{totalCount} total members</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => navigate('/members/add')}>
          <UserPlus size={16} /> Add
        </button>
      </div>

      {/* Search */}
      <div className="search-bar">
        <Search />
        <input placeholder="Search by name or phone..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Filter Tabs */}
      <div className="filter-tabs">
        {tabs.map(t => (
          <button key={t.key} className={`filter-tab ${statusFilter === t.key ? 'active' : ''}`} onClick={() => setStatusFilter(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Sort */}
      <div style={{ marginBottom: 'var(--space-md)', display: 'flex', gap: 'var(--space-sm)' }}>
        <select className="form-select" style={{ padding: '8px 12px', fontSize: 'var(--font-xs)' }} value={sort} onChange={e => setSort(e.target.value)}>
          <option value="name">A → Z</option>
          <option value="join_date">Newest First</option>
          <option value="overdue">Most Overdue</option>
        </select>
      </div>

      {/* States: Loading -> Error -> Empty -> List */}
      <div className="members-content">
        {loading ? (
          <div style={{ padding: '60px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <ModernLoader type="morph" text="Syncing Member Directory..." />
          </div>
        ) : members.length === 0 ? (
          <StateView 
            type="empty" 
            title="No members found" 
            description={search || statusFilter !== 'all' ? "Try changing your search or filters." : "Start by adding your first gym member."}
          />
        ) : (
          members.map(member => {
            const days = member.latest_expiry ? daysFromNow(member.latest_expiry) : null;
            const isExpired = member.status === 'expired' || (days !== null && days < 0);
            const isDueSoon = member.status === 'due_soon' || (days !== null && days >= 0 && days <= 3);
            
            let lastPayDate = null;
            if (member.payments && Array.isArray(member.payments) && member.payments.length > 0) {
              lastPayDate = member.payments[0].payment_date;
            }

            return (
              <div key={member.id} className="member-card" onClick={() => navigate(`/members/${member.id}`)}>
                <div className="avatar" style={{
                  background: isExpired ? 'var(--status-danger-bg)' : isDueSoon ? 'var(--status-warning-bg)' : (member.status === 'inactive' || days === null) ? 'var(--bg-secondary)' : 'var(--accent-gradient)',
                  color: isExpired ? 'var(--status-danger)' : isDueSoon ? 'var(--status-warning)' : (member.status === 'inactive' || days === null) ? 'var(--text-muted)' : 'white'
                }}>
                  {getInitials(member.name || '??')}
                </div>
                <div className="member-info">
                  <div className="member-name">{member.name}</div>
                  <div className="member-phone">{member.phone}</div>
                  {member.status === 'trial' && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Trial Mode</div>
                  )}
                </div>
                <div className="member-meta">
                  <span className={`badge badge-${member.status === 'trial' ? 'secondary' : (member.status === 'active' && days !== null) ? 'active' : member.status === 'due_soon' ? 'warning' : member.status === 'expired' ? 'danger' : 'secondary'}`}>
                    <span className={`badge-dot ${member.status === 'trial' ? 'secondary' : (member.status === 'active' && days !== null) ? 'active' : member.status === 'due_soon' ? 'warning' : member.status === 'expired' ? 'danger' : 'secondary'}`}></span>
                    {(member.status === 'active' && days !== null) ? 'Active' : member.status === 'due_soon' ? 'Due Soon' : member.status === 'expired' ? 'Expired' : member.status === 'trial' ? 'Trial' : 'Inactive'}
                  </span>
                  <div className="member-days" style={{ color: isExpired ? 'var(--status-danger)' : isDueSoon ? 'var(--status-warning)' : member.status === 'inactive' ? 'var(--text-muted)' : 'var(--status-active)' }}>
                    {days === null ? 'No payment' : isExpired ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `${days}d left`}
                  </div>
                  {lastPayDate && (
                     <div className="member-last-pay">Last: {formatDateShort(lastPayDate)}</div>
                  )}
                </div>
                
                <button 
                  className="btn-icon-danger" 
                  style={{ marginLeft: 'var(--space-sm)', padding: 8, background: 'none', border: 'none', color: 'var(--status-danger)', cursor: 'pointer' }}
                  onClick={(e) => handleDeleteMember(e, member.id, member.name)}
                  title="Delete Member"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* ERROR DETAIL MODAL (The 'proper way to tell the issue') */}
      {errorDetail && (
        <div className="modal-backdrop" onClick={() => setErrorDetail(null)}>
          <div className="modal-content" style={{ maxWidth: 500, borderColor: 'var(--status-danger)', borderStyle: 'solid' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ color: 'var(--status-danger)', marginBottom: 'var(--space-md)' }}>❌ Link-data Conflict</h2>
            <div style={{ background: '#f8f8f8', padding: 'var(--space-md)', border: '1px solid #ddd', borderRadius: 4, fontFamily: 'monospace', fontSize: 12, marginBottom: 'var(--space-md)', color: '#444', overflowX: 'auto' }}>
              <p><strong>ISSUE:</strong> {errorDetail.title}</p>
              <hr style={{ margin: '10px 0' }} />
              <p><strong>DB DETAIL:</strong> {errorDetail.detail}</p>
              {errorDetail.hint && <p style={{ marginTop: 5, color: 'var(--primary)', fontWeight: 700 }}><strong>HINT:</strong> {errorDetail.hint}</p>}
            </div>
            <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-lg)' }}>
              This member cannot be deleted yet because they have hidden records (like old notifications or logs). Contact system support or try clearing their data first.
            </p>
            <button className="btn btn-primary btn-block" onClick={() => setErrorDetail(null)}>Close Diagnostic</button>
          </div>
        </div>
      )}
    </div>
  );
}
