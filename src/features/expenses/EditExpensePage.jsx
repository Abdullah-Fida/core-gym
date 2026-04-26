import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import api from '../../lib/api';
import { db, queueSyncTask } from '../../lib/db';
import { EXPENSE_CATEGORIES } from '../../lib/constants';
import { useToast } from '../../contexts/ToastContext';
import { useFormDraft } from '../../hooks/useFormDraft';
import { useSync } from '../../hooks/useSync';
import '../../styles/members.css';

export default function EditExpensePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { online } = useSync();
  
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const { saveDraft, clearDraft } = useFormDraft(`edit-expense-${id}`, {}, (draft) => {
    if (draft.form) setForm(prev => ({ ...prev, ...(draft.form || {}) }));
  });

  useEffect(() => {
    if (form) saveDraft({ form });
  }, [form, saveDraft, id]);

  useEffect(() => {
    const fetchExpense = async () => {
      setLoading(true);
      try {
        if (!online) {
          // Load from local Dexie DB when offline
          const localExpense = await db.expenses.get(id);
          if (localExpense) {
            setForm(prev => {
              if (prev && prev.amount) return prev;
              return localExpense;
            });
          } else {
            toast.error('Expense not found locally');
          }
        } else {
          const res = await api.get(`/expenses/${id}`);
          setForm(prev => {
            if (prev && prev.amount) return prev;
            return res.data.data;
          });
        }
      } catch (err) {
        console.error('Failed to fetch expense', err);
        // Fallback: try local DB even if online fetch failed
        try {
          const localExpense = await db.expenses.get(id);
          if (localExpense) {
            setForm(prev => {
              if (prev && prev.amount) return prev;
              return localExpense;
            });
          } else {
            toast.error('Expense not found');
          }
        } catch (localErr) {
          toast.error('Expense not found');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchExpense();
  }, [id, online]);

  if (loading) return (
    <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <Loader2 className="spin" size={48} style={{ color: 'var(--primary)' }} />
    </div>
  );

  if (!form) return <div className="page-container"><p>Expense not found</p></div>;

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updatedData = { ...form, amount: Number(form.amount) };

      // Always save to local DB first, then queue for sync (same pattern as all other pages)
      await db.expenses.put({ ...updatedData, last_sync: null });
      await queueSyncTask('expense', 'UPDATE', updatedData);

      toast.success('Expense updated!');
      clearDraft();
      navigate('/expenses');
    } catch (err) {
      toast.error('Failed to update expense');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
        <button className="btn btn-icon btn-secondary" onClick={() => navigate(-1)}><ArrowLeft size={20} /></button>
        <h1 className="page-title">Edit Expense</h1>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="form-group"><label className="form-label">Category</label><select className="form-select" value={form.category || 'equipment_repair'} onChange={e => set('category', e.target.value)}>{EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}</select></div>
        {form.category === 'custom' && <div className="form-group"><label className="form-label">Custom Category</label><input className="form-input" value={form.custom_category || ''} onChange={e => set('custom_category', e.target.value)} /></div>}
        <div className="form-group"><label className="form-label">Amount (PKR)</label><input className="form-input" type="number" value={form.amount || ''} onChange={e => set('amount', e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Date</label><input className="form-input" type="date" value={form.expense_date || ''} onChange={e => set('expense_date', e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={form.description || ''} onChange={e => set('description', e.target.value)} /></div>
        <div className="form-group" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label className="form-label" style={{ marginBottom: 0 }}>Is Recurring?</label>
          <label className="form-toggle"><input type="checkbox" checked={form.is_recurring} onChange={e => set('is_recurring', e.target.checked)} /><span className="slider"></span></label>
        </div>
        {form.is_recurring && (
          <div className="form-group"><label className="form-label">Recurring Day of Month</label><input className="form-input" type="number" min="1" max="31" value={form.recurrence_day ?? ''} onChange={e => set('recurrence_day', e.target.value)} /></div>
        )}
        <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
          <button type="submit" className="btn btn-primary btn-lg" style={{ flex: 1 }} disabled={isSaving}>
            {isSaving ? <Loader2 className="spin" size={18} /> : <><Save size={18} /> Update</>}
          </button>
        </div>
      </form>
    </div>
  );
}
