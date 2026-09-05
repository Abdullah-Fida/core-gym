import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save } from 'lucide-react';
import api from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useFormDraft } from '../../hooks/useFormDraft';
import { Page, PageHeader, BackLink, Button, Card, Skeleton, ErrorState } from '../../components/ui';
import ExpenseForm from './ExpenseForm';

export default function EditExpensePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const { saveDraft, clearDraft } = useFormDraft(`edit-expense-${id}`, {}, (draft) => {
    if (draft.form) setForm((prev) => ({ ...prev, ...draft.form }));
  });

  useEffect(() => {
    if (form) saveDraft({ form });
  }, [form, saveDraft]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await api.get(`/expenses/${id}`);
        if (!res.data.data) {
          setNotFound(true);
          return;
        }
        setForm((prev) => (prev?.amount ? prev : res.data.data));
      } catch (err) {
        console.error('Failed to fetch expense', err);
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
      await api.put(`/expenses/${id}`, {
        ...form,
        amount: Number(form.amount),
        recurrence_day: form.is_recurring ? Number(form.recurrence_day) : null,
      });
      toast.success('Expense updated.');
      clearDraft();
      navigate('/expenses');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update this expense.');
      setIsSaving(false);
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
          title="Expense not found"
          description="It may have been deleted."
          onRetry={() => navigate('/expenses')}
        />
      </Page>
    );
  }

  return (
    <Page width="narrow">
      <PageHeader title="Edit expense" back={<BackLink to="/expenses" label="Expenses" />} />

      <Card padding="lg">
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <ExpenseForm form={form} set={set} />
          <Button type="submit" size="lg" block loading={isSaving} className="mt-2">
            <Save className="size-4" aria-hidden="true" />
            Save changes
          </Button>
        </form>
      </Card>
    </Page>
  );
}
