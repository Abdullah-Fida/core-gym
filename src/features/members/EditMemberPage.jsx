import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import api from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useFormDraft } from '../../hooks/useFormDraft';
import { db, queueSyncTask } from '../../lib/db';
import '../../styles/members.css';

export default function EditMemberPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const { saveDraft, clearDraft } = useFormDraft(`edit-member-${id}`, {}, (draft) => {
    if (draft.form) setForm(prev => ({ ...prev, ...(draft.form || {}) }));
  });

  useEffect(() => {
    if (form) saveDraft({ form });
  }, [form, saveDraft, id]);

  useEffect(() => {
    const fetchMember = async () => {
      setLoading(true);
      try {
        const m = await db.members.get(id);
        if (m) {
          setForm(prev => {
             if (prev) return prev; // Keep current form (potentially from draft)
             return { 
               name: m.name, 
               phone: m.phone, 
               join_date: m.join_date, 
               emergency_contact: m.emergency_contact || '', 
               notes: m.notes || '' 
             };
          });
        } else {
          toast.error('Member not found locally');
        }
      } catch (err) {
        console.error('Failed to fetch member', err);
        toast.error('Member not found');
      } finally {
        setLoading(false);
      }
    };
    fetchMember();
  }, [id]);

  if (loading) return (
    <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <Loader2 className="spin" size={48} style={{ color: 'var(--primary)' }} />
    </div>
  );

  if (!form) return <div className="page-container"><p>Member not found</p></div>;

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone) { toast.error('Name and phone are required'); return; }
    
    setIsSaving(true);
    try {
      const updatedData = { ...form };
      await db.members.update(id, updatedData);
      await queueSyncTask('member', 'UPDATE', { id, ...updatedData });
      toast.success('Member updated locally!');
      clearDraft();
      navigate(`/members/${id}`);
    } catch (err) {
      toast.error('Failed to update member');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
        <button className="btn btn-icon btn-secondary" onClick={() => navigate(-1)}><ArrowLeft size={20} /></button>
        <h1 className="page-title">Edit Member</h1>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="form-group"><label className="form-label">Full Name *</label><input className="form-input" value={form.name || ''} onChange={e => set('name', e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Phone Number *</label><input className="form-input" value={form.phone || ''} onChange={e => set('phone', e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Join Date</label><input className="form-input" type="date" value={form.join_date || ''} onChange={e => set('join_date', e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Emergency Contact</label><input className="form-input" value={form.emergency_contact || ''} onChange={e => set('emergency_contact', e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Notes</label><textarea className="form-textarea" value={form.notes || ''} onChange={e => set('notes', e.target.value)} /></div>
        <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={isSaving}>
          {isSaving ? <Loader2 className="spin" size={18} /> : <><Save size={18} /> Update Member</>}
        </button>
      </form>
    </div>
  );
}
