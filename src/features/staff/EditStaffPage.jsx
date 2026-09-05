import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Trash2 } from 'lucide-react';
import api from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useFormDraft } from '../../hooks/useFormDraft';
import { Page, PageHeader, BackLink, Button, Card, Skeleton, ErrorState } from '../../components/ui';
import StaffForm from './StaffForm';

export default function EditStaffPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();

  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const { saveDraft, clearDraft } = useFormDraft(`edit-staff-${id}`, {}, (draft) => {
    if (draft.form) setForm((prev) => ({ ...prev, ...draft.form }));
  });

  useEffect(() => {
    if (form) saveDraft({ form });
  }, [form, saveDraft]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await api.get(`/staff/${id}`);
        const s = res.data.data;
        if (!s) {
          setNotFound(true);
          return;
        }
        setForm((prev) => {
          if (prev?.name) return prev; // a restored draft wins over the server copy
          return {
            name: s.name,
            phone: s.phone,
            role: s.role,
            custom_role: s.custom_role || '',
            join_date: s.join_date || '',
            monthly_salary: String(s.monthly_salary ?? ''),
            status: s.status,
            notes: s.notes || '',
          };
        });
      } catch (err) {
        console.error('Failed to fetch staff member', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.put(`/staff/${id}`, { ...form, monthly_salary: Number(form.monthly_salary) || 0 });
      toast.success('Staff member updated.');
      clearDraft();
      navigate(`/staff/${id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update this staff member.');
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    // Replaces window.confirm(), which is unstyled, blocks the main thread and
    // cannot be themed or translated.
    const ok = await confirm({
      title: 'Remove staff member?',
      message: `${form?.name} will be removed from your staff list. Their salary history is preserved.`,
      confirmText: 'Remove',
    });
    if (!ok) return;

    try {
      await api.delete(`/staff/${id}`);
      toast.success('Staff member removed.');
      navigate('/staff');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not remove this staff member.');
    }
  };

  if (loading) {
    return (
      <Page width="narrow">
        <Skeleton className="h-9 w-48 mb-6" />
        <Skeleton className="h-96" />
      </Page>
    );
  }

  if (notFound || !form) {
    return (
      <Page width="narrow">
        <ErrorState
          title="Staff member not found"
          description="They may have been removed."
          onRetry={() => navigate('/staff')}
        />
      </Page>
    );
  }

  return (
    <Page width="narrow">
      <PageHeader title="Edit staff" back={<BackLink to={`/staff/${id}`} label="Back" />} />

      <Card padding="lg">
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <StaffForm form={form} set={set} showStatus />

          <div className="flex gap-2 mt-2">
            <Button type="submit" size="lg" className="grow" loading={isSaving}>
              <Save className="size-4" aria-hidden="true" />
              Save changes
            </Button>
            <Button type="button" variant="danger-soft" size="lg" onClick={handleDelete}>
              <Trash2 className="size-4" aria-hidden="true" />
              Remove
            </Button>
          </div>
        </form>
      </Card>
    </Page>
  );
}
