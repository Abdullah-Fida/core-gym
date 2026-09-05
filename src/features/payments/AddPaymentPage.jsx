import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Save, CalendarCheck } from 'lucide-react';
import api from '../../lib/api';
import { todayStr, calculateExpiryDate, formatDate, generateId } from '../../lib/utils';
import { printThermalReceipt } from '../../lib/thermalPrinter';
import { PLAN_DURATIONS, PAYMENT_METHODS, APP_NAME } from '../../lib/constants';
import { useToast } from '../../contexts/ToastContext';
import { useFormDraft } from '../../hooks/useFormDraft';
import { useAuth } from '../../contexts/AuthContext';
import {
  Page, PageHeader, BackLink, Card, Button, Input, Select, Textarea, Tabs,
} from '../../components/ui';
import MemberPicker from './MemberPicker';
import ReceiptModal from './ReceiptModal';
import { parseReceiptReason, stripReceiptMarkers } from './receiptText';

const DEFAULT_FEE_FALLBACK = '3000';

export default function AddPaymentPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const preselectedMemberId = searchParams.get('member') || '';
  const returnUrl = searchParams.get('returnUrl');

  const [form, setForm] = useState({
    member_id: preselectedMemberId,
    amount: DEFAULT_FEE_FALLBACK,
    payment_date: todayStr(),
    plan_duration_months: 1,
    custom_days: '',
    payment_method: 'cash',
    received_by: '',
    notes: '',
    is_trial: false,
    trial_days: '',
  });

  const [selectedMember, setSelectedMember] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [receipts, setReceipts] = useState([]);
  const [showReceipts, setShowReceipts] = useState(false);
  const [gym, setGym] = useState(null);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const { saveDraft, clearDraft } = useFormDraft('add-payment', {}, (draft) => {
    if (draft.form) setForm((prev) => ({ ...prev, ...draft.form }));
    if (draft.selectedMember) setSelectedMember(draft.selectedMember);
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/gym');
        const g = res.data.data || null;
        setGym(g);
        if (g?.default_monthly_fee) {
          setForm((prev) =>
            prev.amount === DEFAULT_FEE_FALLBACK || !prev.amount
              ? { ...prev, amount: String(g.default_monthly_fee) }
              : prev
          );
        }
      } catch (err) {
        console.error('Failed to fetch gym settings', err);
      }
    })();
  }, []);

  useEffect(() => {
    saveDraft({ form, selectedMember });
  }, [form, selectedMember, saveDraft]);

  useEffect(() => {
    if (!preselectedMemberId) return;
    api
      .get(`/members/${preselectedMemberId}`)
      .then((res) => {
        if (res.data.data) setSelectedMember(res.data.data);
      })
      .catch((err) => console.error('Failed to fetch preselected member', err));
  }, [preselectedMemberId]);

  const expiryDate = (() => {
    if (!form.payment_date) return null;
    if (form.is_trial) {
      return form.trial_days ? calculateExpiryDate(form.payment_date, 0, form.trial_days) : null;
    }
    if (!form.plan_duration_months) return null;
    return form.plan_duration_months === 'custom'
      ? form.custom_days
        ? calculateExpiryDate(form.payment_date, 0, form.custom_days)
        : null
      : calculateExpiryDate(form.payment_date, form.plan_duration_months);
  })();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.member_id) {
      toast.error('Select a member first.');
      return;
    }

    if (form.is_trial) {
      if (!form.trial_days || Number(form.trial_days) <= 0) {
        toast.error('Enter a valid number of trial days.');
        return;
      }
      setIsSaving(true);
      try {
        await api.post('/payments', {
          id: generateId(),
          member_id: form.member_id,
          amount: 0,
          payment_date: form.payment_date,
          plan_duration_months: 'custom',
          custom_days: Number(form.trial_days),
          payment_method: 'cash',
          received_by: form.received_by,
          notes: `payment_type:trial;${form.notes || ''}`,
          payment_type: 'trial',
          expiry_date: expiryDate,
          created_at: new Date().toISOString(),
        });
        toast.success('Free trial started.');
        clearDraft();
        navigate(returnUrl || `/members/${form.member_id}`);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Could not start the trial.');
        setIsSaving(false);
      }
      return;
    }

    if (!form.amount || Number(form.amount) <= 0) {
      toast.error('Enter a valid amount.');
      return;
    }
    if (form.plan_duration_months === 'custom' && (!form.custom_days || Number(form.custom_days) <= 0)) {
      toast.error('Enter a valid number of days.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await api.post('/payments', {
        id: generateId(),
        member_id: form.member_id,
        amount: Number(form.amount),
        payment_date: form.payment_date,
        plan_duration_months:
          form.plan_duration_months === 'custom' ? 'custom' : Number(form.plan_duration_months),
        custom_days: Number(form.custom_days) || 0,
        payment_method: form.payment_method,
        received_by: form.received_by,
        notes: form.notes,
        payment_type: 'membership',
        expiry_date: expiryDate,
        created_at: new Date().toISOString(),
      });

      setReceipts([
        {
          ...res.data.data,
          member_name: selectedMember?.name || form.member_id,
          member_phone: selectedMember?.phone,
          expiry_date: expiryDate,
        },
      ]);
      setShowReceipts(true);
      toast.success('Payment saved.');
      clearDraft();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Could not log this payment.');
    } finally {
      setIsSaving(false);
    }
  };

  const finish = () => {
    setShowReceipts(false);
    navigate(returnUrl || `/members/${form.member_id}`);
  };

  const printReceipt = (r) => {
    try {
      printThermalReceipt({
        gymName: gym?.gym_name || gym?.name || user?.gym_name || APP_NAME,
        invoiceId: r.id,
        memberName: r.member_name || r.member_id,
        memberPhone: r.member_phone || '',
        amount: r.amount,
        paymentDate: r.payment_date,
        paymentMethod: r.payment_method,
        expiryDate: r.expiry_date,
        receivedBy: r.received_by || '',
        reason: parseReceiptReason(r.notes),
        notes: stripReceiptMarkers(r.notes) || undefined,
      });
      finish();
    } catch (err) {
      console.error(err);
      toast.error('Could not open the printer.');
    }
  };

  return (
    <Page width="narrow">
      <PageHeader title="Log payment" back={<BackLink label="Back" />} />

      <Card padding="lg">
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <MemberPicker
            selected={selectedMember}
            onSelect={(m) => {
              set('member_id', m.id);
              setSelectedMember(m);
            }}
            onClear={() => {
              set('member_id', '');
              setSelectedMember(null);
            }}
          />

          <div>
            <span className="block text-xs font-semibold text-body mb-1.5">Type</span>
            <Tabs
              value={form.is_trial ? 'trial' : 'payment'}
              onChange={(key) => set('is_trial', key === 'trial')}
              items={[
                { key: 'payment', label: 'Payment' },
                { key: 'trial', label: 'Free trial' },
              ]}
            />
          </div>

          {form.is_trial ? (
            <Input
              label="Trial days"
              required
              type="number"
              min="1"
              placeholder="Number of days"
              value={form.trial_days || ''}
              onChange={(e) => set('trial_days', e.target.value)}
            />
          ) : (
            <>
              <Input
                label="Amount"
                required
                type="text"
                inputMode="numeric"
                value={form.amount || ''}
                onChange={(e) => set('amount', e.target.value)}
              />

              <Input
                label="Payment date"
                type="date"
                value={form.payment_date}
                onChange={(e) => set('payment_date', e.target.value)}
              />

              <fieldset>
                <legend className="text-xs font-semibold text-body mb-1.5">Plan duration</legend>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {PLAN_DURATIONS.map((d) => (
                    <Button
                      key={d.value}
                      type="button"
                      size="sm"
                      variant={String(form.plan_duration_months) === String(d.value) ? 'primary' : 'secondary'}
                      aria-pressed={String(form.plan_duration_months) === String(d.value)}
                      onClick={() => set('plan_duration_months', d.value)}
                    >
                      {d.label}
                    </Button>
                  ))}
                </div>
                {form.plan_duration_months === 'custom' && (
                  <Input
                    className="mt-2"
                    type="number"
                    min="1"
                    aria-label="Custom number of days"
                    placeholder="Enter number of days"
                    value={form.custom_days}
                    onChange={(e) => set('custom_days', e.target.value)}
                  />
                )}
              </fieldset>

              <Select
                label="Payment method"
                value={form.payment_method}
                onChange={(e) => set('payment_method', e.target.value)}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </>
          )}

          {expiryDate && (
            <p className="flex items-center gap-2 p-3 rounded-lg bg-accent-soft text-accent text-sm">
              <CalendarCheck className="size-4 shrink-0" aria-hidden="true" />
              <span>
                Membership expires on <strong>{formatDate(expiryDate)}</strong>
              </span>
            </p>
          )}

          <Input
            label="Received by"
            placeholder="Staff name (optional)"
            value={form.received_by}
            onChange={(e) => set('received_by', e.target.value)}
          />

          <Textarea
            label="Notes"
            placeholder="Optional notes…"
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
          />

          <Button type="submit" size="lg" block loading={isSaving} className="mt-2">
            <Save className="size-4" aria-hidden="true" />
            {form.is_trial ? 'Start free trial' : 'Save payment'}
          </Button>
        </form>
      </Card>

      <ReceiptModal
        open={showReceipts}
        onClose={finish}
        onDone={finish}
        onPrint={printReceipt}
        receipts={receipts}
      />
    </Page>
  );
}
