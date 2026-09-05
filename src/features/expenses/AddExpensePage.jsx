import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save } from 'lucide-react';
import api from '../../lib/api';
import { todayStr, generateId } from '../../lib/utils';
import { useToast } from '../../contexts/ToastContext';
import { useFormDraft } from '../../hooks/useFormDraft';
import { Page, PageHeader, BackLink, Button, Card } from '../../components/ui';
import ExpenseForm from './ExpenseForm';

const EMPTY = {
  category: 'equipment_repair', custom_category: '', amount: '',
  expense_date: todayStr(), description: '', is_recurring: false,
  recurrence_day: 1, logged_by: '',
};

export default function AddExpensePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const { saveDraft, clearDraft } = useFormDraft('add-expense', {}, (draft) => {
    if (draft.form) setForm(draft.form);
  });

  useEffect(() => {
    saveDraft({ form });
  }, [form, saveDraft]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount) {
      toast.error('Enter an amount.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/expenses', {
        ...form,
        id: generateId(),
        amount: Number(form.amount),
        recurrence_day: form.is_recurring ? Number(form.recurrence_day) : null,
      });
      toast.success('Expense added.');
      clearDraft();
      navigate('/expenses');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not add this expense.');
      setLoading(false);
    }
  };

  return (
    <Page width="narrow">
      <PageHeader title="Add expense" back={<BackLink to="/expenses" label="Expenses" />} />

      <Card padding="lg">
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <ExpenseForm form={form} set={set} />
          <Button type="submit" size="lg" block loading={loading} className="mt-2">
            <Save className="size-4" aria-hidden="true" />
            Save expense
          </Button>
        </form>
      </Card>
    </Page>
  );
}
