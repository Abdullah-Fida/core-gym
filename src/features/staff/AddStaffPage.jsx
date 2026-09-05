import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save } from 'lucide-react';
import api from '../../lib/api';
import { generateId, todayStr } from '../../lib/utils';
import { useToast } from '../../contexts/ToastContext';
import { useFormDraft } from '../../hooks/useFormDraft';
import { Page, PageHeader, BackLink, Button, Card } from '../../components/ui';
import StaffForm from './StaffForm';

const EMPTY = {
  name: '', phone: '', role: 'trainer', custom_role: '',
  join_date: todayStr(), monthly_salary: '', status: 'active', notes: '',
};

export default function AddStaffPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const { saveDraft, clearDraft } = useFormDraft('add-staff', {}, (draft) => {
    if (draft.form) setForm(draft.form);
  });

  useEffect(() => {
    saveDraft({ form });
  }, [form, saveDraft]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone) {
      toast.error('Name and phone are required.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/staff', {
        id: generateId(),
        ...form,
        monthly_salary: Number(form.monthly_salary) || 0,
      });
      toast.success(`${form.name} added to staff.`);
      clearDraft();
      navigate('/staff');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not add this staff member.');
      setLoading(false);
    }
  };

  return (
    <Page width="narrow">
      <PageHeader title="Add staff" back={<BackLink to="/staff" label="Staff" />} />

      <Card padding="lg">
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <StaffForm form={form} set={set} />
          <Button type="submit" size="lg" block loading={loading} className="mt-2">
            <Save className="size-4" aria-hidden="true" />
            Save staff member
          </Button>
        </form>
      </Card>
    </Page>
  );
}
