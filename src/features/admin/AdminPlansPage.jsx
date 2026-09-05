import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Layers, Users, Check, X } from 'lucide-react';
import api from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { cn } from '../../lib/cn';
import {
  Page, PageHeader, Card, Button, Badge, Modal, Input, Select, Field,
  EmptyState, ListSkeleton, ErrorState,
} from '../../components/ui';
import { SUPPORTED_CURRENCIES, formatMoney } from '../../lib/money';

/**
 * Platform subscription plans.
 *
 * Prices used to be a literal `{ free: 0, basic: 2000, pro: 5000 }` in two
 * places — the MRR calculation in admin.routes.js and AdminSubscriptionsPage —
 * so changing a price meant editing code in two files and hoping they agreed.
 */

/** The capability flags a plan can grant. Keys match `plans.features` JSONB. */
const FEATURE_KEYS = [
  { key: 'members', label: 'Members' },
  { key: 'payments', label: 'Payments' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'reports', label: 'Reports' },
  { key: 'trainers', label: 'Trainers' },
  { key: 'whatsapp', label: 'WhatsApp' },
];

const emptyPlan = () => ({
  code: '',
  name: '',
  description: '',
  price: '0',
  currency: 'PKR',
  billing_period: 'month',
  member_limit: '',
  staff_limit: '',
  features: Object.fromEntries(FEATURE_KEYS.map((f) => [f.key, false])),
  is_active: true,
  sort_order: 0,
});

export default function AdminPlansPage() {
  const toast = useToast();
  const confirm = useConfirm();

  const [plans, setPlans] = useState(null);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyPlan);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await api.get('/admin/plans');
      setPlans(res.data.data || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Could not load plans.');
      setPlans([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const toggleFeature = (key) =>
    setForm((p) => ({ ...p, features: { ...p.features, [key]: !p.features[key] } }));

  const openCreate = () => {
    setEditing(null);
    setForm(emptyPlan());
    setModalOpen(true);
  };

  const openEdit = (plan) => {
    setEditing(plan);
    setForm({
      ...emptyPlan(),
      ...plan,
      price: String(plan.price ?? '0'),
      // A null limit means unlimited; the input shows it as blank.
      member_limit: plan.member_limit ?? '',
      staff_limit: plan.staff_limit ?? '',
      description: plan.description ?? '',
      features: { ...emptyPlan().features, ...(plan.features || {}) },
    });
    setModalOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description?.trim() || '',
        price: Number(form.price) || 0,
        currency: form.currency,
        billing_period: form.billing_period,
        // Blank means unlimited, which the column stores as NULL. Sending 0
        // would mean "no members allowed" — a very different thing.
        member_limit: form.member_limit === '' ? null : Number(form.member_limit),
        staff_limit: form.staff_limit === '' ? null : Number(form.staff_limit),
        features: form.features,
        is_active: form.is_active,
        sort_order: Number(form.sort_order) || 0,
      };

      if (editing) {
        await api.patch(`/admin/plans/${editing.id}`, payload);
        toast.success('Plan updated.');
      } else {
        await api.post('/admin/plans', { ...payload, code: form.code.trim().toLowerCase() });
        toast.success('Plan created.');
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save this plan.');
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (plan) => {
    const ok = await confirm({
      title: `Delete "${plan.name}"?`,
      message:
        plan.gym_count > 0
          ? `${plan.gym_count} gym${plan.gym_count === 1 ? '' : 's'} are on this plan. Move them first.`
          : 'This cannot be undone.',
      confirmText: 'Delete',
    });
    if (!ok) return;

    try {
      await api.delete(`/admin/plans/${plan.id}`);
      toast.success('Plan deleted.');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete this plan.');
    }
  };

  return (
    <Page>
      <PageHeader
        title="Plans"
        subtitle="Subscription tiers offered to gyms. Prices here drive MRR and every invoice."
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" aria-hidden="true" />
            New plan
          </Button>
        }
      />

      {plans === null ? (
        <ListSkeleton rows={3} />
      ) : error ? (
        <ErrorState description={error} onRetry={load} />
      ) : plans.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No plans yet"
          description="Create at least one plan before registering gyms."
          action={<Button onClick={openCreate}>Create a plan</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <Card key={plan.id} className={cn(!plan.is_active && 'opacity-60')}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-heading truncate">{plan.name}</h2>
                    {!plan.is_active && <Badge variant="neutral">Inactive</Badge>}
                  </div>
                  <p className="text-xs text-muted font-mono mt-0.5">{plan.code}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon-sm" onClick={() => openEdit(plan)} aria-label={`Edit ${plan.name}`}>
                    <Pencil className="size-4" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted hover:text-danger hover:bg-danger-soft"
                    onClick={() => remove(plan)}
                    aria-label={`Delete ${plan.name}`}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>

              <p className="text-2xl font-bold text-heading font-display tabular-nums">
                {Number(plan.price) === 0 ? 'Free' : formatMoney(plan.price, { currency: plan.currency })}
                {Number(plan.price) > 0 && (
                  <span className="text-sm font-medium text-muted"> / {plan.billing_period}</span>
                )}
              </p>

              {plan.description && <p className="text-sm text-muted mt-2">{plan.description}</p>}

              <dl className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <Users className="size-3.5 text-muted" aria-hidden="true" />
                  <dt className="sr-only">Member limit</dt>
                  <dd className="text-body">{plan.member_limit ? `${plan.member_limit} members` : 'Unlimited members'}</dd>
                </div>
                <div className="flex items-center gap-1.5">
                  <Layers className="size-3.5 text-muted" aria-hidden="true" />
                  <dt className="sr-only">Gyms on this plan</dt>
                  <dd className="text-body">
                    {plan.gym_count} gym{plan.gym_count === 1 ? '' : 's'}
                  </dd>
                </div>
              </dl>

              <ul className="flex flex-wrap gap-1.5 mt-4 pt-3 border-t border-line">
                {FEATURE_KEYS.map((f) => {
                  const on = Boolean(plan.features?.[f.key]);
                  return (
                    <li
                      key={f.key}
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs',
                        on ? 'bg-success-soft text-success' : 'bg-surface-3 text-muted'
                      )}
                    >
                      {on ? <Check className="size-3" aria-hidden="true" /> : <X className="size-3" aria-hidden="true" />}
                      {f.label}
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit ${editing.name}` : 'New plan'}
        size="lg"
      >
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Name"
              required
              placeholder="e.g. Growth"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
            />
            <Input
              label="Code"
              required
              disabled={Boolean(editing)}
              hint={editing ? 'Codes cannot change — gyms reference them.' : 'Lowercase, no spaces.'}
              placeholder="growth"
              value={form.code}
              onChange={(e) => set('code', e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
            />
          </div>

          <Input
            label="Description"
            placeholder="Who this plan is for"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Price"
              required
              type="number"
              min="0"
              value={form.price}
              onChange={(e) => set('price', e.target.value)}
            />
            <Select label="Currency" value={form.currency} onChange={(e) => set('currency', e.target.value)}>
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>{c.code}</option>
              ))}
            </Select>
            <Select
              label="Billing period"
              value={form.billing_period}
              onChange={(e) => set('billing_period', e.target.value)}
            >
              <option value="month">Monthly</option>
              <option value="year">Yearly</option>
              <option value="one_time">One-time</option>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Member limit"
              hint="Blank = unlimited"
              type="number"
              min="0"
              placeholder="Unlimited"
              value={form.member_limit}
              onChange={(e) => set('member_limit', e.target.value)}
            />
            <Input
              label="Staff limit"
              hint="Blank = unlimited"
              type="number"
              min="0"
              placeholder="Unlimited"
              value={form.staff_limit}
              onChange={(e) => set('staff_limit', e.target.value)}
            />
            <Input
              label="Sort order"
              type="number"
              value={form.sort_order}
              onChange={(e) => set('sort_order', e.target.value)}
            />
          </div>

          <Field label="Included features">
            <div className="flex flex-wrap gap-2">
              {FEATURE_KEYS.map((f) => {
                const on = Boolean(form.features[f.key]);
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => toggleFeature(f.key)}
                    aria-pressed={on}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                      on
                        ? 'border-success bg-success-soft text-success'
                        : 'border-line bg-surface-3 text-muted hover:border-line-hover'
                    )}
                  >
                    {on ? <Check className="size-3" aria-hidden="true" /> : <X className="size-3" aria-hidden="true" />}
                    {f.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="size-4 accent-[var(--accent-primary)]"
              checked={form.is_active}
              onChange={(e) => set('is_active', e.target.checked)}
            />
            <span className="text-sm text-body">
              Available for new gyms
              <span className="block text-xs text-muted">
                Turning this off hides the plan from the register form but leaves existing gyms on it.
              </span>
            </span>
          </label>

          <div className="flex gap-2 mt-2">
            <Button type="button" variant="secondary" block onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" block loading={submitting}>
              {editing ? 'Save changes' : 'Create plan'}
            </Button>
          </div>
        </form>
      </Modal>
    </Page>
  );
}
