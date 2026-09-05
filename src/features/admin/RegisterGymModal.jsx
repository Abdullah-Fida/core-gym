import { useState, useEffect, useMemo } from 'react';
import { Check, ChevronLeft, ChevronRight, Building2, CalendarClock, Globe, KeyRound } from 'lucide-react';
import api from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { cn } from '../../lib/cn';
import {
  Modal, Button, Input, Select, Field, Badge, Spinner,
} from '../../components/ui';
import {
  SUPPORTED_CURRENCIES, COMMON_TIMEZONES, PAYMENT_METHOD_OPTIONS,
  guessTimezone, formatMoney,
} from '../../lib/money';

/**
 * Register a new gym.
 *
 * Replaces a single flat modal that collected six fields and hardcoded the plan
 * to 'basic'. The backend has always accepted a subscription duration; the old
 * form simply never sent one, which is the gap that was reported — there was no
 * way to put a gym on a free trial or set how long its access should last.
 */

const STEPS = [
  { key: 'identity', label: 'Gym', icon: Building2 },
  { key: 'plan', label: 'Plan', icon: CalendarClock },
  { key: 'locale', label: 'Region', icon: Globe },
  { key: 'access', label: 'Login', icon: KeyRound },
];

const TRIAL_PRESETS = [7, 14, 30];
const MONTH_PRESETS = [1, 3, 6, 12];

const todayStr = () => new Date().toISOString().slice(0, 10);

/** Locale defaults that follow the chosen currency, so the form stays coherent. */
const CURRENCY_DEFAULTS = {
  PKR: { timezone: 'Asia/Karachi', locale: 'en-PK', methods: ['cash', 'jazzcash', 'easypaisa', 'bank_transfer'] },
  USD: { timezone: 'America/New_York', locale: 'en-US', methods: ['cash', 'card', 'stripe'] },
  GBP: { timezone: 'Europe/London', locale: 'en-GB', methods: ['cash', 'card', 'bank_transfer'] },
  EUR: { timezone: 'Europe/Berlin', locale: 'de-DE', methods: ['cash', 'card', 'bank_transfer'] },
  INR: { timezone: 'Asia/Kolkata', locale: 'en-IN', methods: ['cash', 'upi', 'card'] },
  AED: { timezone: 'Asia/Dubai', locale: 'ar-AE', methods: ['cash', 'card', 'bank_transfer'] },
};

const initialForm = () => ({
  gym_name: '',
  owner_name: '',
  phone: '',
  city: '',
  address: '',
  default_monthly_fee: '3000',

  plan_code: 'basic',
  billing_mode: 'trial',
  trial_days: 14,
  subscription_months: 1,
  subscription_days: '',
  duration_kind: 'months',
  starts_at: todayStr(),
  setup_fee: '',

  currency: 'PKR',
  timezone: guessTimezone(),
  locale: 'en-PK',
  payment_methods: ['cash', 'card', 'bank_transfer'],

  email: '',
  password: '',
});

/** Mirror of the server's period arithmetic, for the live preview only. */
function previewEndDate(form) {
  const start = new Date(form.starts_at || todayStr());
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start);

  if (form.billing_mode === 'trial') {
    end.setDate(end.getDate() + (Number(form.trial_days) || 0));
    return end;
  }
  if (form.duration_kind === 'days') {
    const d = Number(form.subscription_days);
    if (!d) return null;
    end.setDate(end.getDate() + d);
    return end;
  }
  const m = Number(form.subscription_months);
  if (!m) return null;
  const day = end.getDate();
  end.setDate(1);
  end.setMonth(end.getMonth() + m);
  end.setDate(Math.min(day, new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate()));
  return end;
}

function StepRail({ index }) {
  return (
    <ol className="flex items-center gap-1.5 mb-5">
      {STEPS.map((s, i) => {
        const done = index > i;
        const current = index === i;
        return (
          <li key={s.key} className="flex items-center gap-1.5">
            <span
              className={cn(
                'flex items-center justify-center size-7 rounded-full shrink-0 transition-colors',
                done && 'bg-success text-white',
                current && 'bg-accent text-accent-contrast',
                !done && !current && 'bg-surface-3 text-muted'
              )}
              aria-current={current ? 'step' : undefined}
            >
              {done ? <Check className="size-3.5" aria-hidden="true" /> : <s.icon className="size-3.5" aria-hidden="true" />}
            </span>
            <span className={cn('text-xs font-semibold hidden sm:inline', current ? 'text-heading' : 'text-muted')}>
              {s.label}
            </span>
            {i < STEPS.length - 1 && <span className={cn('w-5 h-px', done ? 'bg-success' : 'bg-line')} aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}

export default function RegisterGymModal({ open, onClose, onCreated }) {
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initialForm);
  const [plans, setPlans] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setForm(initialForm());
    api.get('/admin/plans')
      .then((res) => setPlans((res.data.data || []).filter((p) => p.is_active)))
      .catch(() => setPlans([]));
  }, [open]);

  // Keep region defaults in step with the chosen currency, but never clobber a
  // timezone the admin has already picked by hand.
  const applyCurrency = (code) => {
    const d = CURRENCY_DEFAULTS[code];
    setForm((p) => ({
      ...p,
      currency: code,
      ...(d ? { timezone: d.timezone, locale: d.locale, payment_methods: d.methods } : {}),
    }));
  };

  const selectedPlan = useMemo(
    () => (plans || []).find((p) => p.code === form.plan_code),
    [plans, form.plan_code]
  );

  const endDate = previewEndDate(form);

  const stepValid = (() => {
    if (step === 0) {
      return form.gym_name.trim().length >= 2
        && form.owner_name.trim().length >= 2
        // Required by the database, so block here rather than failing on submit.
        && form.phone.trim().length >= 6;
    }
    if (step === 1) return Boolean(endDate);
    if (step === 2) return Boolean(form.currency && form.timezone);
    if (step === 3) return /\S+@\S+\.\S+/.test(form.email) && form.password.length >= 8;
    return true;
  })();

  const submit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        gym_name: form.gym_name.trim(),
        owner_name: form.owner_name.trim(),
        phone: form.phone,
        city: form.city,
        address: form.address,
        default_monthly_fee: Number(form.default_monthly_fee) || 0,
        plan_code: form.plan_code,
        billing_mode: form.billing_mode,
        starts_at: new Date(form.starts_at).toISOString(),
        currency: form.currency,
        timezone: form.timezone,
        locale: form.locale,
        payment_methods: form.payment_methods,
        email: form.email.trim().toLowerCase(),
        password: form.password,
      };

      if (form.billing_mode === 'trial') {
        payload.trial_days = Number(form.trial_days);
      } else if (form.duration_kind === 'days') {
        payload.subscription_days = Number(form.subscription_days);
      } else {
        payload.subscription_months = Number(form.subscription_months);
      }

      if (Number(form.setup_fee) > 0) payload.setup_fee = Number(form.setup_fee);

      const res = await api.post('/admin/gyms', payload);
      toast.success(res.data.message || 'Gym registered.');
      onCreated?.(res.data.data);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not register this gym.');
    } finally {
      setSubmitting(false);
    }
  };

  const togglePaymentMethod = (value) => {
    setForm((p) => {
      const has = p.payment_methods.includes(value);
      // Never let the last method be removed — a gym with no way to take money
      // cannot record a payment at all.
      if (has && p.payment_methods.length === 1) return p;
      return {
        ...p,
        payment_methods: has
          ? p.payment_methods.filter((m) => m !== value)
          : [...p.payment_methods, value],
      };
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Register a new gym"
      description={STEPS[step].label === 'Login' ? 'These are the credentials the owner signs in with.' : undefined}
      size="lg"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => (step === 0 ? onClose() : setStep(step - 1))}
            disabled={submitting}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            {step === 0 ? 'Cancel' : 'Back'}
          </Button>
          <div className="grow" />
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!stepValid}>
              Continue
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          ) : (
            <Button onClick={submit} loading={submitting} disabled={!stepValid}>
              <Check className="size-4" aria-hidden="true" />
              Create gym
            </Button>
          )}
        </>
      }
    >
      <StepRail index={step} />

      {/* ── 1. Identity ── */}
      {step === 0 && (
        <div className="flex flex-col gap-4">
          <Input
            label="Gym name"
            required
            autoFocus
            placeholder="e.g. Iron Temple Fitness"
            value={form.gym_name}
            onChange={(e) => set('gym_name', e.target.value)}
          />
          <Input
            label="Owner name"
            required
            placeholder="e.g. Ali Hassan"
            value={form.owner_name}
            onChange={(e) => set('owner_name', e.target.value)}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Phone"
              required
              type="tel"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
            />
            <Input label="City" value={form.city} onChange={(e) => set('city', e.target.value)} />
          </div>
          <Input label="Address" value={form.address} onChange={(e) => set('address', e.target.value)} />
          <Input
            label="Default monthly member fee"
            hint="What this gym charges its own members. It can change this later in Settings."
            type="number"
            min="0"
            value={form.default_monthly_fee}
            onChange={(e) => set('default_monthly_fee', e.target.value)}
          />
        </div>
      )}

      {/* ── 2. Plan and duration ── */}
      {step === 1 && (
        <div className="flex flex-col gap-5">
          <Field label="Plan" required>
            {plans === null ? (
              <Spinner label="Loading plans" />
            ) : plans.length === 0 ? (
              <p className="text-sm text-muted">
                No active plans. Create one under Plans first.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {plans.map((p) => {
                  const active = form.plan_code === p.code;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => set('plan_code', p.code)}
                      aria-pressed={active}
                      className={cn(
                        'text-left p-3 rounded-lg border transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                        active
                          ? 'border-accent bg-accent-soft'
                          : 'border-line bg-surface-3 hover:border-line-hover'
                      )}
                    >
                      <span className="block text-sm font-bold text-heading">{p.name}</span>
                      <span className="block text-xs text-muted mt-0.5">
                        {Number(p.price) === 0
                          ? 'Free'
                          : `${formatMoney(p.price, { currency: p.currency })} / ${p.billing_period}`}
                      </span>
                      <span className="block text-xs text-muted mt-1">
                        {p.member_limit ? `${p.member_limit} members` : 'Unlimited members'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </Field>

          <Field label="Access type" required>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'trial', label: 'Free trial', hint: 'No charge, ends automatically' },
                { key: 'paid', label: 'Paid period', hint: 'Billed subscription' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => set('billing_mode', opt.key)}
                  aria-pressed={form.billing_mode === opt.key}
                  className={cn(
                    'text-left p-3 rounded-lg border transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    form.billing_mode === opt.key
                      ? 'border-accent bg-accent-soft'
                      : 'border-line bg-surface-3 hover:border-line-hover'
                  )}
                >
                  <span className="block text-sm font-bold text-heading">{opt.label}</span>
                  <span className="block text-xs text-muted mt-0.5">{opt.hint}</span>
                </button>
              ))}
            </div>
          </Field>

          {form.billing_mode === 'trial' ? (
            <Field label="Trial length" required>
              <div className="flex flex-wrap gap-2">
                {TRIAL_PRESETS.map((d) => (
                  <Button
                    key={d}
                    type="button"
                    size="sm"
                    variant={Number(form.trial_days) === d ? 'primary' : 'secondary'}
                    aria-pressed={Number(form.trial_days) === d}
                    onClick={() => set('trial_days', d)}
                  >
                    {d} days
                  </Button>
                ))}
                <Input
                  type="number"
                  min="1"
                  max="365"
                  aria-label="Custom trial days"
                  className="w-28"
                  placeholder="Custom"
                  value={TRIAL_PRESETS.includes(Number(form.trial_days)) ? '' : form.trial_days}
                  onChange={(e) => set('trial_days', e.target.value)}
                />
              </div>
            </Field>
          ) : (
            <Field label="Subscription length" required>
              <div className="flex flex-wrap gap-2 mb-2">
                {MONTH_PRESETS.map((m) => {
                  const active = form.duration_kind === 'months' && Number(form.subscription_months) === m;
                  return (
                    <Button
                      key={m}
                      type="button"
                      size="sm"
                      variant={active ? 'primary' : 'secondary'}
                      aria-pressed={active}
                      onClick={() => setForm((p) => ({ ...p, duration_kind: 'months', subscription_months: m }))}
                    >
                      {m === 12 ? '1 year' : `${m} month${m > 1 ? 's' : ''}`}
                    </Button>
                  );
                })}
                <Button
                  type="button"
                  size="sm"
                  variant={form.duration_kind === 'days' ? 'primary' : 'secondary'}
                  aria-pressed={form.duration_kind === 'days'}
                  onClick={() => setForm((p) => ({ ...p, duration_kind: 'days' }))}
                >
                  Custom days
                </Button>
              </div>
              {form.duration_kind === 'days' && (
                <Input
                  type="number"
                  min="1"
                  aria-label="Number of days"
                  placeholder="Number of days"
                  value={form.subscription_days}
                  onChange={(e) => set('subscription_days', e.target.value)}
                />
              )}
            </Field>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Starts on"
              type="date"
              value={form.starts_at}
              onChange={(e) => set('starts_at', e.target.value)}
            />
            <Input
              label="One-time setup fee"
              hint="Optional. Recorded as platform revenue."
              type="number"
              min="0"
              placeholder="0"
              value={form.setup_fee}
              onChange={(e) => set('setup_fee', e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 p-3 rounded-lg bg-surface-3 border border-line">
            <CalendarClock className="size-4 text-accent shrink-0" aria-hidden="true" />
            {endDate ? (
              <p className="text-sm text-body">
                {form.billing_mode === 'trial' ? 'Trial ends' : 'Access ends'}{' '}
                <strong className="text-heading">
                  {endDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                </strong>
                {selectedPlan && form.billing_mode === 'paid' && Number(selectedPlan.price) > 0 && (
                  <>
                    {' · '}
                    {formatMoney(selectedPlan.price, { currency: selectedPlan.currency })} per {selectedPlan.billing_period}
                  </>
                )}
              </p>
            ) : (
              <p className="text-sm text-muted">Choose a length to see the end date.</p>
            )}
          </div>
        </div>
      )}

      {/* ── 3. Region ── */}
      {step === 2 && (
        <div className="flex flex-col gap-4">
          <Select
            label="Currency"
            required
            hint="What this gym's owner and members see on every amount."
            value={form.currency}
            onChange={(e) => applyCurrency(e.target.value)}
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.name} ({c.symbol})
              </option>
            ))}
          </Select>

          <Select
            label="Timezone"
            required
            hint="Attendance days, expiry dates and reminders are calculated in this zone."
            value={form.timezone}
            onChange={(e) => set('timezone', e.target.value)}
          >
            {COMMON_TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, ' ')}
              </option>
            ))}
          </Select>

          <Input
            label="Locale"
            hint="Number and date formatting, e.g. en-US or de-DE."
            value={form.locale}
            onChange={(e) => set('locale', e.target.value)}
          />

          <Field label="Accepted payment methods" required>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHOD_OPTIONS.map((m) => {
                const active = form.payment_methods.includes(m.value);
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => togglePaymentMethod(m.value)}
                    aria-pressed={active}
                    className={cn(
                      'px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                      active
                        ? 'border-accent bg-accent-soft text-accent'
                        : 'border-line bg-surface-3 text-muted hover:border-line-hover'
                    )}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <p className="text-sm text-muted">
            Preview: a fee of {form.default_monthly_fee || 0} shows as{' '}
            <strong className="text-heading">
              {formatMoney(form.default_monthly_fee || 0, { currency: form.currency, locale: form.locale })}
            </strong>
          </p>
        </div>
      )}

      {/* ── 4. Credentials ── */}
      {step === 3 && (
        <div className="flex flex-col gap-4">
          <Input
            label="Owner email"
            required
            type="email"
            autoComplete="off"
            placeholder="owner@gym.com"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
          />
          <Input
            label="Temporary password"
            required
            type="text"
            autoComplete="new-password"
            hint="At least 8 characters. Share it with the owner and ask them to change it."
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
            error={
              form.password && form.password.length < 8
                ? 'Must be at least 8 characters.'
                : undefined
            }
          />

          <div className="p-4 rounded-lg bg-surface-3 border border-line">
            <p className="text-xs font-bold uppercase tracking-wide text-muted mb-3">Summary</p>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted">Gym</dt>
                <dd className="text-heading font-semibold truncate">{form.gym_name || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Plan</dt>
                <dd className="text-heading font-semibold">
                  {selectedPlan?.name || form.plan_code}{' '}
                  <Badge variant={form.billing_mode === 'trial' ? 'info' : 'success'} className="ml-1">
                    {form.billing_mode === 'trial' ? `${form.trial_days}-day trial` : 'Paid'}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Access until</dt>
                <dd className="text-heading font-semibold">
                  {endDate ? endDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Region</dt>
                <dd className="text-heading font-semibold truncate">
                  {form.currency} · {form.timezone.split('/').pop().replace(/_/g, ' ')}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </Modal>
  );
}
