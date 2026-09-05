import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, CalendarCheck, ChevronRight, SkipForward, Check } from 'lucide-react';
import api from '../../lib/api';
import { todayStr, calculateExpiryDate, formatDate, generateId } from '../../lib/utils';
import { printThermalReceipt } from '../../lib/thermalPrinter';
import { PLAN_DURATIONS, PAYMENT_METHODS, APP_NAME } from '../../lib/constants';
import { useToast } from '../../contexts/ToastContext';
import { useFormDraft } from '../../hooks/useFormDraft';
import { cn } from '../../lib/cn';
import {
  Page, PageHeader, BackLink, Card, Button, Badge, Avatar,
  Input, Textarea, Tabs, Toggle,
} from '../../components/ui';
import ReceiptModal from '../payments/ReceiptModal';
import { parseReceiptReason, stripReceiptMarkers } from '../payments/receiptText';

const DEFAULT_FEE_FALLBACK = '3000';

const INITIAL = {
  step: 1,
  memberForm: { name: '', phone: '', join_date: todayStr(), emergency_contact: '', notes: '' },
  payForm: {
    amount: DEFAULT_FEE_FALLBACK,
    payment_date: todayStr(),
    plan_duration_months: 1,
    custom_days: '',
    payment_method: 'cash',
    received_by: '',
    notes: '',
    include_registration: false,
    registration_amount: '',
    is_trial: false,
    trial_days: '',
  },
  newMember: null,
};

function StepIndicator({ step }) {
  const steps = ['Member details', 'Payment'];
  return (
    <ol className="flex items-center gap-2 mb-6">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = step > n;
        const current = step === n;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={cn(
                'flex items-center justify-center size-7 rounded-full text-xs font-bold shrink-0 transition-colors',
                done || current ? 'bg-accent text-accent-contrast' : 'bg-surface-3 text-muted'
              )}
              aria-current={current ? 'step' : undefined}
            >
              {done ? <Check className="size-3.5" aria-hidden="true" /> : n}
            </span>
            <span className={cn('text-xs font-semibold', current ? 'text-heading' : 'text-muted')}>
              {label}
            </span>
            {n < steps.length && (
              <span
                className={cn('w-8 h-px mx-1', step > n ? 'bg-accent' : 'bg-line')}
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default function AddMemberPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [receipts, setReceipts] = useState([]);
  const [showReceipts, setShowReceipts] = useState(false);
  const [gym, setGym] = useState(null);
  const [form, setForm] = useState(INITIAL);

  const { saveDraft, clearDraft } = useFormDraft('add-member', {}, (draft) => {
    if (!draft) return;
    setForm((prev) => ({
      ...prev,
      ...draft,
      memberForm: { ...prev.memberForm, ...(draft.memberForm || {}) },
      payForm: { ...prev.payForm, ...(draft.payForm || {}) },
    }));
  });

  useEffect(() => {
    saveDraft(form);
  }, [form, saveDraft]);

  const { memberForm, payForm, step, newMember } = form;

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/gym');
        const g = res.data.data || null;
        setGym(g);
        if (g?.default_monthly_fee) {
          setForm((prev) =>
            prev.payForm.amount === DEFAULT_FEE_FALLBACK || !prev.payForm.amount
              ? { ...prev, payForm: { ...prev.payForm, amount: String(g.default_monthly_fee) } }
              : prev
          );
        }
      } catch (err) {
        console.error('Failed to fetch gym settings', err);
      }
    })();
  }, []);

  const setMember = (k, v) => setForm((p) => ({ ...p, memberForm: { ...p.memberForm, [k]: v } }));
  const setPay = (k, v) => setForm((p) => ({ ...p, payForm: { ...p.payForm, [k]: v } }));

  const expiryDate = (() => {
    if (!payForm.payment_date) return null;
    if (payForm.is_trial) {
      return payForm.trial_days ? calculateExpiryDate(payForm.payment_date, 0, payForm.trial_days) : null;
    }
    if (!payForm.plan_duration_months) return null;
    return payForm.plan_duration_months === 'custom'
      ? payForm.custom_days
        ? calculateExpiryDate(payForm.payment_date, 0, payForm.custom_days)
        : null
      : calculateExpiryDate(payForm.payment_date, payForm.plan_duration_months);
  })();

  const handleMemberSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    if (!memberForm.name.trim()) {
      toast.error('Name is required.');
      return;
    }
    if (!memberForm.phone.trim()) {
      toast.error('Phone number is required.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/members', { ...memberForm, id: generateId() });
      const serverMember = res.data.data;
      setForm((p) => ({ ...p, newMember: serverMember, step: 2 }));
      toast.success(`${serverMember.name} added.`);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Could not add this member.');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (payForm.is_trial) {
      if (!payForm.trial_days || Number(payForm.trial_days) <= 0) {
        toast.error('Enter a valid number of trial days.');
        return;
      }
      setLoading(true);
      try {
        await api.post('/payments', {
          id: generateId(),
          member_id: newMember.id,
          amount: 0,
          payment_date: payForm.payment_date,
          plan_duration_months: 'custom',
          custom_days: Number(payForm.trial_days),
          payment_method: 'cash',
          received_by: payForm.received_by,
          notes: `payment_type:trial;${payForm.notes || ''}`,
          payment_type: 'trial',
          expiry_date: expiryDate,
        });
        toast.success(`${newMember.name} is now on a free trial.`);
        clearDraft();
        navigate(`/members/${newMember.id}`);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Could not start the trial.');
        setLoading(false);
      }
      return;
    }

    if (!payForm.amount || Number(payForm.amount) <= 0) {
      toast.error('Enter a valid amount.');
      return;
    }
    if (payForm.plan_duration_months === 'custom' && (!payForm.custom_days || Number(payForm.custom_days) <= 0)) {
      toast.error('Enter a valid number of days.');
      return;
    }

    setLoading(true);
    try {
      const membershipAmount = Number(payForm.amount);
      const registrationAmount =
        payForm.include_registration && payForm.registration_amount
          ? Number(payForm.registration_amount)
          : 0;
      const totalAmount = membershipAmount + registrationAmount;

      let notes = payForm.notes || '';
      if (registrationAmount > 0) {
        notes = `payment_type:membership;registration_fee:${registrationAmount};${notes}`;
      }

      const res = await api.post('/payments', {
        id: generateId(),
        member_id: newMember.id,
        amount: totalAmount,
        payment_date: payForm.payment_date,
        plan_duration_months:
          payForm.plan_duration_months === 'custom' ? 'custom' : Number(payForm.plan_duration_months),
        custom_days: Number(payForm.custom_days) || 0,
        payment_method: payForm.payment_method,
        received_by: payForm.received_by,
        notes,
        payment_type: 'membership',
        expiry_date: expiryDate,
        created_at: new Date().toISOString(),
      });

      const receipt = {
        ...res.data.data,
        member_name: newMember.name,
        member_phone: newMember.phone,
        expiry_date: expiryDate,
      };
      if (registrationAmount > 0) {
        receipt.items = [
          { label: 'Membership fee', amount: membershipAmount },
          { label: 'Registration fee', amount: registrationAmount },
        ];
        receipt.total = totalAmount;
      }

      setReceipts([receipt]);
      setShowReceipts(true);
      toast.success(`Payment saved for ${newMember.name}.`);
      clearDraft();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Could not log this payment.');
    } finally {
      setLoading(false);
    }
  };

  const finish = () => {
    setShowReceipts(false);
    navigate(`/members/${newMember.id}`);
  };

  const printReceipt = (r) => {
    try {
      printThermalReceipt({
        gymName: gym?.gym_name || gym?.name || APP_NAME,
        invoiceId: r.id,
        memberName: r.member_name || '',
        memberPhone: r.member_phone || '',
        amount: r.amount,
        paymentDate: r.payment_date,
        paymentMethod: r.payment_method,
        expiryDate: r.expiry_date,
        receivedBy: r.received_by || '',
        reason: parseReceiptReason(r.notes),
        notes: stripReceiptMarkers(r.notes) || undefined,
        items: r.items,
        total: r.total,
      });
      finish();
    } catch (err) {
      console.error(err);
      toast.error('Could not open the printer.');
    }
  };

  const handleSkip = () => {
    toast.info(`${newMember.name} added. You can log a payment later.`);
    clearDraft();
    navigate('/members');
  };

  return (
    <Page width="narrow">
      <PageHeader
        title={step === 1 ? 'Add member' : 'Log first payment'}
        subtitle={step === 1 ? 'Step 1 of 2' : 'Step 2 of 2'}
        back={<BackLink to="/members" label="Members" />}
      />

      <StepIndicator step={step} />

      {step === 1 && (
        <Card padding="lg">
          <form className="flex flex-col gap-4" onSubmit={handleMemberSubmit}>
            <Input
              label="Full name"
              required
              autoFocus
              placeholder="e.g. Ali Hassan"
              value={memberForm.name || ''}
              onChange={(e) => setMember('name', e.target.value)}
            />
            <Input
              label="Phone number"
              required
              type="tel"
              inputMode="tel"
              placeholder="03001234567"
              value={memberForm.phone || ''}
              onChange={(e) => setMember('phone', e.target.value)}
            />
            <Input
              label="Join date"
              type="date"
              value={memberForm.join_date || ''}
              onChange={(e) => setMember('join_date', e.target.value)}
            />
            <Input
              label="Emergency contact"
              placeholder="Contact name and phone (optional)"
              value={memberForm.emergency_contact || ''}
              onChange={(e) => setMember('emergency_contact', e.target.value)}
            />
            <Textarea
              label="Notes"
              placeholder="Any notes…"
              value={memberForm.notes || ''}
              onChange={(e) => setMember('notes', e.target.value)}
            />

            <Button type="submit" size="lg" block loading={loading} className="mt-2">
              Next — log payment
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </form>
        </Card>
      )}

      {step === 2 && newMember && (
        <>
          <Card className="flex items-center gap-3 mb-4">
            <Avatar name={newMember.name} size="sm" />
            <span className="grow min-w-0">
              <span className="block font-semibold text-heading truncate">{newMember.name}</span>
              <span className="block text-xs text-muted truncate">{newMember.phone}</span>
            </span>
            <Badge variant="success" dot>
              Added
            </Badge>
          </Card>

          <Card padding="lg">
            <form className="flex flex-col gap-4" onSubmit={handlePaymentSubmit}>
              <div>
                <span className="block text-xs font-semibold text-body mb-1.5">Type</span>
                <Tabs
                  value={payForm.is_trial ? 'trial' : 'payment'}
                  onChange={(key) => setPay('is_trial', key === 'trial')}
                  items={[
                    { key: 'payment', label: 'Payment' },
                    { key: 'trial', label: 'Free trial' },
                  ]}
                />
              </div>

              {payForm.is_trial ? (
                <Input
                  label="Trial days"
                  required
                  type="number"
                  min="1"
                  placeholder="Number of days"
                  value={payForm.trial_days || ''}
                  onChange={(e) => setPay('trial_days', e.target.value)}
                />
              ) : (
                <>
                  <Input
                    label="Membership amount"
                    required
                    type="text"
                    inputMode="numeric"
                    value={payForm.amount || ''}
                    onChange={(e) => setPay('amount', e.target.value)}
                  />

                  <Toggle
                    label="Include registration fee"
                    description="Added on top of the membership amount, itemised on the receipt."
                    checked={payForm.include_registration}
                    onChange={(v) => setPay('include_registration', v)}
                  />

                  {payForm.include_registration && (
                    <Input
                      label="Registration fee"
                      type="text"
                      inputMode="numeric"
                      value={payForm.registration_amount || ''}
                      onChange={(e) => setPay('registration_amount', e.target.value)}
                    />
                  )}
                </>
              )}

              <Input
                label="Payment date"
                type="date"
                value={payForm.payment_date || ''}
                onChange={(e) => setPay('payment_date', e.target.value)}
              />

              {!payForm.is_trial && (
                <>
                  <fieldset>
                    <legend className="text-xs font-semibold text-body mb-1.5">Plan duration</legend>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                      {PLAN_DURATIONS.map((d) => (
                        <Button
                          key={d.value}
                          type="button"
                          size="sm"
                          variant={
                            String(payForm.plan_duration_months) === String(d.value) ? 'primary' : 'secondary'
                          }
                          aria-pressed={String(payForm.plan_duration_months) === String(d.value)}
                          onClick={() => setPay('plan_duration_months', d.value)}
                        >
                          {d.label}
                        </Button>
                      ))}
                    </div>
                    {payForm.plan_duration_months === 'custom' && (
                      <Input
                        className="mt-2"
                        type="number"
                        min="1"
                        aria-label="Custom number of days"
                        placeholder="Enter number of days"
                        value={payForm.custom_days}
                        onChange={(e) => setPay('custom_days', e.target.value)}
                      />
                    )}
                  </fieldset>

                  <fieldset>
                    <legend className="text-xs font-semibold text-body mb-1.5">Payment method</legend>
                    <div className="grid grid-cols-2 gap-2">
                      {PAYMENT_METHODS.map((m) => (
                        <Button
                          key={m.value}
                          type="button"
                          size="sm"
                          variant={payForm.payment_method === m.value ? 'primary' : 'secondary'}
                          aria-pressed={payForm.payment_method === m.value}
                          onClick={() => setPay('payment_method', m.value)}
                        >
                          {m.label}
                        </Button>
                      ))}
                    </div>
                  </fieldset>
                </>
              )}

              {expiryDate && (
                <p className="flex items-center gap-2 p-3 rounded-lg bg-accent-soft text-accent text-sm">
                  <CalendarCheck className="size-4 shrink-0" aria-hidden="true" />
                  <span>
                    Membership valid until <strong>{formatDate(expiryDate)}</strong>
                  </span>
                </p>
              )}

              <Button type="submit" size="lg" block loading={loading} className="mt-2">
                <CreditCard className="size-4" aria-hidden="true" />
                {payForm.is_trial ? 'Start free trial' : 'Save payment and finish'}
              </Button>

              <Button type="button" variant="ghost" block onClick={handleSkip}>
                <SkipForward className="size-4" aria-hidden="true" />
                Skip — add payment later
              </Button>
            </form>
          </Card>
        </>
      )}

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
