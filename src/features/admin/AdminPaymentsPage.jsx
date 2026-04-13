import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Filter, DollarSign, Calendar } from 'lucide-react';
import api from '../../lib/api';
import { formatPKR, formatDate } from '../../lib/utils';
import { useToast } from '../../contexts/ToastContext';
import { ModernLoader } from '../../components/common/ModernLoader';
import '../../styles/admin.css';

export default function AdminPaymentsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const initialType = searchParams.get('type') || '';
  
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState(initialType);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function fetchPayments() {
      setLoading(true);
      try {
        const res = await api.get('/admin/payments');
        setPayments(res.data.data);
      } catch (err) {
        toast.error('Failed to fetch global payments');
      } finally {
        setLoading(false);
      }
    }
    fetchPayments();
  }, []);

  const filteredPayments = payments.filter(p => {
    const payload = JSON.parse(p.text);
    const matchesType = !filterType || payload.type === filterType;
    const matchesSearch = !searchTerm || 
      p.gym?.gym_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payload.amount.toString().includes(searchTerm);
    return matchesType && matchesSearch;
  });

  return (
    <div className="admin-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
        <button className="btn btn-icon btn-secondary" onClick={() => navigate('/admin')}><ArrowLeft size={20} /></button>
        <div>
          <h1 className="page-title">Payments Log</h1>
          <p className="page-subtitle">Record of all gym payments</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)', flexWrap: 'wrap' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
          <Search />
          <input 
            placeholder="Search..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
          />
        </div>
        <select 
          className="form-select" 
          style={{ width: 'auto' }} 
          value={filterType} 
          onChange={e => setFilterType(e.target.value)}
        >
          <option value="">All Types</option>
          <option value="RECURRING">Subscription</option>
          <option value="SETUP">Initial Setup</option>
        </select>
      </div>

      {loading ? (
        <div style={{ padding: '60px 0' }}>
          <ModernLoader type="morph" text="Fetching platform revenue..." />
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Gym Name</th>
                <th>Amount</th>
                <th>Type</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map(p => {
                const payload = JSON.parse(p.text);
                return (
                  <tr key={p.id}>
                    <td>{p.gym?.gym_name || 'Deleted Gym'}</td>
                    <td>{formatPKR(payload.amount)}</td>
                    <td>
                      <span className={`badge ${payload.type === 'SETUP' ? 'badge-warning' : 'badge-active'}`}>
                        {payload.type === 'SETUP' ? 'Setup' : 'Subscription'}
                      </span>
                    </td>
                    <td>{formatDate(p.date)}</td>
                    <td>
                      <button className="btn btn-sm btn-secondary" onClick={() => navigate(`/admin/gyms/${p.gym_id}`)}>
                        Gym Details
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredPayments.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: 'var(--space-lg)', color: 'var(--text-muted)' }}>
                    No records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


