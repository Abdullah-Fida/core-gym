import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save } from 'lucide-react';
import api from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useFormDraft } from '../../hooks/useFormDraft';
import {
  Page, PageHeader, BackLink, Button, Card,
  Input, Textarea, Skeleton, ErrorState,
} from '../../components/ui';

export default function EditMemberPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const { saveDraft, clearDraft } = useFormDraft(`edit-member-${id}`, {}, (draft) => {
    if (draft.form) setForm((prev) => ({ ...prev, ...draft.form }));
  });

  useEffect(() => {
    if (form) saveDraft({ form });
  }, [form, saveDraft]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await api.get(`/members/${id}`);
        const m = res.data.data;
        if (!m) {
          setNotFound(true);
          return;
        }
        setForm((prev) => prev ?? {
          name: m.name,
          phone: m.phone,
          join_date: m.join_date || '',
          emergency_contact: m.emergency_contact || '',
          notes: m.notes || '',
        });
      } catch (err) {
        console.error('Failed to fetch member', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone) {
      toast.error('Name and phone are required.');
      return;
    }

    setIsSaving(true);
    try {
      await api.put(`/members/${id}`, form);
      toast.success('Member updated.');
      clearDraft();
      navigate(`/members/${id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update this member.');
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <Page width="narrow">
        <Skeleton className="h-9 w-48 mb-6" />
        <Skeleton className="h-80" />
      </Page>
    );
  }

  if (notFound || !form) {
    return (
      <Page width="narrow">
        <ErrorState
          title="Member not found"
          description="They may have been removed."
          onRetry={() => navigate('/members')}
        />
      </Page>
    );
  }

  return (
    <Page width="narrow">
      <PageHeader title="Edit member" back={<BackLink to={`/members/${id}`} label="Back" />} />

      <Card padding="lg">
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <Input
            label="Full name"
            required
            value={form.name || ''}
            onChange={(e) => set('name', e.target.value)}
          />
          <Input
            label="Phone number"
            required
            type="tel"
            inputMode="tel"
            value={form.phone || ''}
            onChange={(e) => set('phone', e.target.value)}
          />
          <Input
            label="Join date"
            type="date"
            value={form.join_date || ''}
            onChange={(e) => set('join_date', e.target.value)}
          />
          <Input
            label="Emergency contact"
            type="tel"
            inputMode="tel"
            placeholder="Optional"
            value={form.emergency_contact || ''}
            onChange={(e) => set('emergency_contact', e.target.value)}
          />
          <Textarea
            label="Notes"
            placeholder="Optional notes…"
            value={form.notes || ''}
            onChange={(e) => set('notes', e.target.value)}
          />

          <Button type="submit" size="lg" block loading={isSaving} className="mt-2">
            <Save className="size-4" aria-hidden="true" />
            Save changes
          </Button>
        </form>
      </Card>
    </Page>
  );
}
