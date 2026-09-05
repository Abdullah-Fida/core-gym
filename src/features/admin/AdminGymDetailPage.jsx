import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Zap, Users, Building2, CreditCard, MessageSquare, Pencil, ExternalLink,
  Trash2, DollarSign, Plus, Activity, PieChart, Sparkles, Power, PowerOff,
} from 'lucide-react';
import api from '../../lib/api';
import { formatDate, calculateHealthScore } from '../../lib/utils';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/cn';
import {
  Page, PageHeader, BackLink, Card, CardHeader, Button, Badge, Tabs, Modal,
  Input, Select, Textarea, StatCard, Skeleton, ErrorState, EmptyState,
} from '../../components/ui';
import { useMoney } from '../../hooks/useMoney';

const todayStr = () => new Date().toISOString().split('T')[0];

const PAYMENT_KIND_LABEL = {
  subscription: 'Subscription',
  setup: 'Setup fee',
  refund: 'Refund',
  adjustment: 'Adjustment',
};

const BILLING_STATUS = {
  trialing: { variant: 'info', label: 'On trial' },
  active: { variant: 'success', label: 'Active' },
  past_due: { variant: 'warning', label: 'Past due' },
  suspended: { variant: 'danger', label: 'Suspended' },
  cancelled: { variant: 'neutral', label: 'Cancelled' },
};

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'payments', label: 'Payments' },
  { key: 'notes', label: 'Notes' },
];

function scoreTone(score) {
  if (score >= 60) return 'text-success';
  if (score >= 30) return 'text-warning';
  return 'text-danger';
}

function scoreBar(score) {
  if (score >= 60) return 'bg-success';
  if (score >= 30) return 'bg-warning';
  return 'bg-danger';
}

export default function AdminGymDetailPage() {
  const money = useMoney();
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { switchSession } = useAuth();

  const [gym, setGym] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [notes, setNotes] = useState([]);
  const [payments, setPayments] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState({});
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: '', kind: 'subscription', paid_at: todayStr() });
  const [editingPaymentId, setEditingPaymentId] = useState(null);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertForm, setConvertForm] = useState({ plan_code: '', months: '1', amount: '' });
  const [plans, setPlans] = useState([]);
  const [renewalForm, setRenewalForm] = useState({ months: '1', customDays: '', amount: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (gym?.default_monthly_fee) {
      setRenewalForm((prev) => ({ ...prev, amount: String(gym.default_monthly_fee) }));
    }
  }, [gym]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [gRes, nRes, pRes] = await Promise.all([
          api.get(`/admin/gyms/${id}`),
          api.get(`/admin/gyms/${id}/notes`),
          api.get(`/admin/gyms/${id}/payments`),
        ]);
        setGym(gRes.data.data);
        setEditData({ ...gRes.data.data, extend_duration: 'none', extend_days: '' });
        setNotes(nRes.data.data || []);
        setPayments(pRes.data.data || []);
      } catch (err) {
        console.error(err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    api.get('/admin/plans')
      .then((res) => setPlans((res.data.data || []).filter((pl) => pl.is_active && Number(pl.price) > 0)))
      .catch(() => setPlans([]));
  }, []);

  const refreshGym = async () => {
    const res = await api.get(`/admin/gyms/${id}`);
    setGym(res.data.data);
  };

  const handleProxyLogin = async () => {
    try {
      const res = await api.post(`/admin/gyms/${id}/login`);
      if (res.data.success) {
        await switchSession(res.data);
        toast.success(`Signed in as ${gym.gym_name}.`);
        navigate('/dashboard');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not sign in as this gym.');
    }
  };

  const handleUpdateGym = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        gym_name: editData.gym_name,
        owner_name: editData.owner_name,
        phone: editData.phone,
        city: editData.city,
        default_monthly_fee: editData.default_monthly_fee,
        email: editData.email,
        plan_type: editData.plan_type,
        subscription_ends_at: editData.subscription_ends_at,
      };

      if (editData.new_password) payload.new_password = editData.new_password;

      await api.patch(`/admin/gyms/${id}`, payload);

      // Extending goes through the lifecycle endpoint so the period arithmetic
      // stays on the server and the change lands in the audit trail. This form
      // used to recompute the end date itself and PATCH it straight in, which
      // both duplicated the logic and left no record of who changed it.
      if (editData.extend_duration && editData.extend_duration !== 'none') {
        await api.post(`/admin/gyms/${id}/renew`, {
          amount: 0,
          ...(editData.extend_duration === 'custom'
            ? { customDays: Number(editData.extend_days) }
            : { months: Number(editData.extend_duration) }),
          note: 'Extended from the edit form',
        });
      }
      toast.success('Gym updated.');
      setShowEditModal(false);
      setEditData((prev) => ({ ...prev, new_password: '', extend_duration: 'none', extend_days: '' }));
      await refreshGym();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update this gym.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const runLifecycle = async (action, body, successMessage) => {
    try {
      await api.post(`/admin/gyms/${id}/${action}`, body);
      toast.success(successMessage);
      await refreshGym();
    } catch (err) {
      toast.error(err.response?.data?.message || 'That did not work.');
    }
  };

  const handleSuspend = async () => {
    const ok = await confirm({
      title: `Suspend ${gym.gym_name}?`,
      message: 'The owner and their staff will be signed out and unable to log in until reactivated.',
      confirmText: 'Suspend',
    });
    if (ok) await runLifecycle('suspend', {}, 'Gym suspended.');
  };

  const handleReactivate = () => runLifecycle('reactivate', {}, 'Gym reactivated.');

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    try {
      const res = await api.post(`/admin/gyms/${id}/notes`, { text: newNote.trim() });
      setNotes([res.data.data, ...notes]);
      setNewNote('');
      toast.success('Note added.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not add the note.');
    }
  };

  const handleLogPayment = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingPaymentId) {
        await api.patch(`/admin/gyms/${id}/payments/${editingPaymentId}`, paymentForm);
        toast.success('Payment updated.');
      } else {
        await api.post(`/admin/gyms/${id}/payments`, paymentForm);
        toast.success('Payment recorded.');
      }
      const pRes = await api.get(`/admin/gyms/${id}/payments`);
      setPayments(pRes.data.data || []);
      await refreshGym();
      setShowPaymentModal(false);
      setPaymentForm({ amount: '', kind: 'subscription', paid_at: todayStr() });
      setEditingPaymentId(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not record this payment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditPayment = (p) => {
    setPaymentForm({
      amount: p.amount ?? '',
      kind: p.kind || 'subscription',
      paid_at: String(p.paid_at).split('T')[0],
    });
    setEditingPaymentId(p.id);
    setShowPaymentModal(true);
  };

  const handleDeletePayment = async (noteId) => {
    const ok = await confirm({
      title: 'Void this transaction?',
      message: 'The payment record will be permanently removed from the platform ledger.',
      confirmText: 'Void',
    });
    if (!ok) return;

    try {
      await api.delete(`/admin/gyms/${id}/payments/${noteId}`);
      setPayments((prev) => prev.filter((p) => p.id !== noteId));
      await refreshGym();
      toast.success('Transaction voided.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not void this transaction.');
    }
  };

  const handleRenewSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post(`/admin/gyms/${id}/renew`, {
        amount: Number(renewalForm.amount),
        months: renewalForm.months === 'custom' ? 0 : Number(renewalForm.months),
        customDays: renewalForm.months === 'custom' ? Number(renewalForm.customDays) : 0,
      });
      toast.success('Subscription renewed.');
      setShowRenewModal(false);
      const [gRes, pRes] = await Promise.all([
        api.get(`/admin/gyms/${id}`),
        api.get(`/admin/gyms/${id}/payments`),
      ]);
      setGym(gRes.data.data);
      setPayments(pRes.data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not renew this subscription.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Page>
        <Skeleton className="h-9 w-56 mb-6" />
        <Skeleton className="h-28 mb-4" />
        <Skeleton className="h-80" />
      </Page>
    );
  }

  if (notFound || !gym) {
    return (
      <Page>
        <ErrorState
          title="Gym not found"
          description="It may have been deleted."
          onRetry={() => navigate('/admin/gyms')}
        />
      </Page>
    );
  }

  const health = calculateHealthScore(gym);
  const isExpired = gym.subscription_ends_at && new Date(gym.subscription_ends_at) < new Date();
  const status = BILLING_STATUS[gym.billing_status] ?? (gym.is_active ? BILLING_STATUS.active : BILLING_STATUS.suspended);
  const onTrial = gym.trial_ends_at && new Date(gym.trial_ends_at) > new Date();
  const trialDaysLeft = onTrial
    ? Math.ceil((new Date(gym.trial_ends_at) - new Date()) / 86400000)
    : null;

  const reviewRows = [
    {
      label: 'System active (30%)',
      score: gym.last_login_at
        ? Math.max(0, 100 - Math.ceil((new Date() - new Date(gym.last_login_at)) / 86400000))
        : 0,
    },
    { label: 'New members (25%)', score: gym.members_added_this_month > 0 ? 100 : 0 },
    { label: 'Payment logs (25%)', score: gym.payments_this_month > 0 ? 100 : 0 },
    {
      label: 'Profile completeness (20%)',
      score:
        ([gym.gym_name, gym.phone, gym.address, gym.default_monthly_fee].filter(Boolean).length / 4) * 100,
    },
  ];

  const details = [
    { label: 'Email', value: gym.email || '—' },
    { label: 'Phone', value: gym.phone || '—' },
    { label: 'Members', value: gym.members?.[0]?.count || 0 },
    { label: 'Staff', value: gym.staff?.[0]?.count || 0 },
    { label: 'Revenue this month', value: money(gym.revenue_this_month || 0) },
    { label: 'Subscription ends', value: gym.subscription_ends_at ? formatDate(gym.subscription_ends_at) : '—' },
    { label: 'Joined', value: formatDate(gym.created_at) },
    { label: 'Last login', value: formatDate(gym.last_login_at) },
  ];

  return (
    <Page>
      <PageHeader
        title={gym.gym_name}
        subtitle={[gym.city, gym.owner_name].filter(Boolean).join(' · ')}
        back={<BackLink to="/admin/gyms" label="All gyms" />}
        actions={
          <div className="flex items-center gap-2">
            {trialDaysLeft !== null && trialDaysLeft >= 0 && (
              <Badge variant="info">
                {trialDaysLeft} trial day{trialDaysLeft === 1 ? '' : 's'} left
              </Badge>
            )}
            <Badge variant={status.variant} dot>{status.label}</Badge>
          </div>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        <StatCard
          label="Gym health"
          value={`${health}/100`}
          tone={health <= 30 ? 'danger' : health <= 60 ? 'warning' : 'success'}
          icon={Activity}
          deltaLabel={health > 70 ? 'Running well' : 'Needs attention'}
        />
        <StatCard label="Members" value={gym.members?.[0]?.count || 0} tone="accent" icon={Users} />
        <StatCard
          label="Revenue this month"
          value={money(gym.revenue_this_month || 0)}
          tone="success"
          icon={CreditCard}
        />
        <StatCard
          label="Plan"
          value={String(gym.plan_type || '').toUpperCase()}
          tone="warning"
          icon={Zap}
          deltaLabel={gym.subscription_ends_at ? `Ends ${formatDate(gym.subscription_ends_at)}` : 'No expiry'}
        />
      </div>

      <Card className="flex flex-wrap items-center gap-2 mb-5">
        <Button size="sm" onClick={handleProxyLogin}>
          <ExternalLink className="size-4" aria-hidden="true" />
          Sign in as this gym
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setShowEditModal(true)}>
          <Pencil className="size-4" aria-hidden="true" />
          Edit details
        </Button>
        <Button variant="success" size="sm" onClick={() => setShowRenewModal(true)}>
          <DollarSign className="size-4" aria-hidden="true" />
          {isExpired || !gym.is_active ? 'Renew now' : 'Extend'}
        </Button>

        {onTrial && (
          <Button variant="outline" size="sm" onClick={() => setShowConvertModal(true)}>
            <Sparkles className="size-4" aria-hidden="true" />
            Convert to paid
          </Button>
        )}

        <div className="grow" />

        {gym.is_active ? (
          <Button variant="danger-soft" size="sm" onClick={handleSuspend}>
            <PowerOff className="size-4" aria-hidden="true" />
            Suspend
          </Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={handleReactivate}>
            <Power className="size-4" aria-hidden="true" />
            Reactivate
          </Button>
        )}
      </Card>

      <Tabs items={TABS} value={activeTab} onChange={setActiveTab} className="mb-4" />

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
          <Card>
            <CardHeader title="Performance review" subtitle="How the health score is calculated" />
            <ul className="flex flex-col gap-3.5">
              {reviewRows.map((item) => (
                <li key={item.label}>
                  <div className="flex justify-between items-baseline gap-2 mb-1.5">
                    <span className="text-sm font-medium text-body">{item.label}</span>
                    <span className={cn('text-sm font-bold tabular-nums', scoreTone(item.score))}>
                      {Math.round(item.score)}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-[width] duration-500', scoreBar(item.score))}
                      style={{ width: `${Math.min(100, item.score)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Gym information" />
            <dl className="grid grid-cols-2 gap-4">
              {details.map((d) => (
                <div key={d.label} className="min-w-0">
                  <dt className="text-xs text-muted">{d.label}</dt>
                  <dd className="text-sm font-semibold text-heading mt-0.5 truncate">{d.value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      )}

      {activeTab === 'payments' && (
        <Card>
          <CardHeader
            title="Platform payments"
            subtitle="Setup fees and subscription income from this gym"
            action={
              <Button
                size="sm"
                onClick={() => {
                  setEditingPaymentId(null);
                  setPaymentForm({ amount: '', kind: 'subscription', paid_at: todayStr() });
                  setShowPaymentModal(true);
                }}
              >
                <Plus className="size-4" aria-hidden="true" />
                Add
              </Button>
            }
          />
          {payments.length === 0 ? (
            <EmptyState
              icon={PieChart}
              title="No payments yet"
              description="Setup fees and subscription payments will appear here."
              className="py-8"
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {payments.map((p) => {
                const isSetup = p.kind === 'setup';
                return (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-line bg-surface-3/50"
                  >
                    <span
                      className={cn(
                        'flex items-center justify-center size-10 rounded-xl shrink-0',
                        isSetup ? 'bg-warning-soft text-warning' : 'bg-success-soft text-success'
                      )}
                    >
                      {isSetup ? (
                        <Building2 className="size-5" aria-hidden="true" />
                      ) : (
                        <CreditCard className="size-5" aria-hidden="true" />
                      )}
                    </span>
                    <span className="grow min-w-0">
                      <span className="block text-sm font-semibold text-heading">
                        {PAYMENT_KIND_LABEL[p.kind] ?? p.kind}
                      </span>
                      <span className="block text-xs text-muted">{formatDate(p.paid_at)}</span>
                    </span>
                    <span className="font-bold text-success tabular-nums shrink-0">
                      {money(p.amount)}
                    </span>
                    <Button variant="ghost" size="icon-sm" onClick={() => openEditPayment(p)} aria-label="Edit payment">
                      <Pencil className="size-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted hover:text-danger hover:bg-danger-soft"
                      onClick={() => handleDeletePayment(p.id)}
                      aria-label="Void payment"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      {activeTab === 'notes' && (
        <Card>
          <CardHeader title="Notes and support log" />
          <div className="flex flex-col gap-2 mb-5">
            <Textarea
              aria-label="New note"
              rows={3}
              placeholder="Add a note about this gym…"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
            />
            <Button size="sm" className="self-end" disabled={!newNote.trim()} onClick={handleAddNote}>
              Save note
            </Button>
          </div>

          {notes.length === 0 ? (
            <EmptyState icon={MessageSquare} title="No notes yet" className="py-8" />
          ) : (
            <ul className="flex flex-col gap-2">
              {notes.map((n) => (
                <li key={n.id} className="p-3 rounded-lg border-l-4 border-l-accent border border-line bg-surface-3/50">
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <span className="text-[0.6875rem] font-bold uppercase tracking-wide text-accent">
                      {n.admin}
                    </span>
                    <span className="text-xs text-muted">{formatDate(n.date)}</span>
                  </div>
                  <p className="text-sm text-body">{n.text}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit gym"
        size="lg"
      >
        <form className="flex flex-col gap-4" onSubmit={handleUpdateGym}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Gym name" required value={editData.gym_name || ''}
              onChange={(e) => setEditData({ ...editData, gym_name: e.target.value })} />
            <Input label="Owner name" required value={editData.owner_name || ''}
              onChange={(e) => setEditData({ ...editData, owner_name: e.target.value })} />
            <Input label="Phone" required type="tel" value={editData.phone || ''}
              onChange={(e) => setEditData({ ...editData, phone: e.target.value })} />
            <Input label="Email (login)" required type="email" value={editData.email || ''}
              onChange={(e) => setEditData({ ...editData, email: e.target.value })} />
            <Input label="City" value={editData.city || ''}
              onChange={(e) => setEditData({ ...editData, city: e.target.value })} />
            <Select label="Plan" value={editData.plan_type || 'free'}
              onChange={(e) => setEditData({ ...editData, plan_type: e.target.value })}>
              <option value="free">Free</option>
              <option value="basic">Basic</option>
              <option value="pro">Pro</option>
            </Select>
          </div>

          {/*
            The extend-subscription controls: handleUpdateGym has always read
            `extend_duration` and `extend_days`, but no input ever set them, so
            that whole branch was unreachable.
          */}
          <div className="pt-4 border-t border-line">
            <p className="text-xs font-bold uppercase tracking-wide text-muted mb-3">Extend subscription</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Extend by"
                value={editData.extend_duration || 'none'}
                onChange={(e) => setEditData({ ...editData, extend_duration: e.target.value })}
              >
                <option value="none">Don't extend</option>
                <option value="1">1 month</option>
                <option value="3">3 months</option>
                <option value="6">6 months</option>
                <option value="12">1 year</option>
                <option value="custom">Custom days</option>
              </Select>
              {editData.extend_duration === 'custom' && (
                <Input
                  label="Days to add"
                  type="number"
                  min="1"
                  value={editData.extend_days || ''}
                  onChange={(e) => setEditData({ ...editData, extend_days: e.target.value })}
                />
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-line">
            {/* This heading previously read "SECURITY SECURITY SECURITY". */}
            <p className="text-xs font-bold uppercase tracking-wide text-muted mb-3">Security</p>
            <Input
              label="Reset password"
              hint="Leave blank to keep the current password."
              type="text"
              autoComplete="off"
              placeholder="New password"
              value={editData.new_password || ''}
              onChange={(e) => setEditData({ ...editData, new_password: e.target.value })}
            />
          </div>

          <div className="flex gap-2 mt-2">
            <Button type="button" variant="secondary" block onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button type="submit" block loading={isSubmitting}>
              Save changes
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title={editingPaymentId ? 'Edit ledger entry' : 'New ledger entry'}
      >
        <form className="flex flex-col gap-4" onSubmit={handleLogPayment}>
          <Input
            label="Amount"
            required
            type="text"
            inputMode="numeric"
            value={paymentForm.amount}
            onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
          />
          <Select
            label="Category"
            value={paymentForm.kind}
            onChange={(e) => setPaymentForm({ ...paymentForm, kind: e.target.value })}
          >
            {Object.entries(PAYMENT_KIND_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
          <Input
            label="Date"
            type="date"
            value={paymentForm.paid_at}
            onChange={(e) => setPaymentForm({ ...paymentForm, paid_at: e.target.value })}
          />

          <div className="flex gap-2 mt-2">
            <Button type="button" variant="secondary" block onClick={() => setShowPaymentModal(false)}>
              Cancel
            </Button>
            <Button type="submit" block loading={isSubmitting}>
              {editingPaymentId ? 'Save' : 'Record payment'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={showRenewModal}
        onClose={() => setShowRenewModal(false)}
        title="Renew gym access"
        description={`Extends ${gym.gym_name}'s subscription and logs the payment.`}
      >
        <form className="flex flex-col gap-4" onSubmit={handleRenewSubmit}>
          <Select
            label="Duration"
            value={renewalForm.months}
            onChange={(e) => setRenewalForm({ ...renewalForm, months: e.target.value })}
          >
            <option value="1">1 month</option>
            <option value="3">3 months</option>
            <option value="6">6 months</option>
            <option value="12">1 year</option>
            <option value="custom">Custom days</option>
          </Select>

          {/* The "Custom days" option had no matching input, so choosing it sent NaN. */}
          {renewalForm.months === 'custom' && (
            <Input
              label="Custom days"
              required
              type="number"
              min="1"
              placeholder="e.g. 15"
              value={renewalForm.customDays}
              onChange={(e) => setRenewalForm({ ...renewalForm, customDays: e.target.value })}
            />
          )}

          <Input
            label="Amount collected"
            required
            type="text"
            inputMode="numeric"
            value={renewalForm.amount}
            onChange={(e) => setRenewalForm({ ...renewalForm, amount: e.target.value })}
          />

          <div className="flex gap-2 mt-2">
            <Button type="button" variant="secondary" block onClick={() => setShowRenewModal(false)}>
              Cancel
            </Button>
            <Button type="submit" block loading={isSubmitting}>
              Confirm renewal
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={showConvertModal}
        onClose={() => setShowConvertModal(false)}
        title="Convert trial to paid"
        description={
          trialDaysLeft !== null
            ? `The paid period starts when the trial ends, so the ${trialDaysLeft} remaining trial day${trialDaysLeft === 1 ? '' : 's'} are not lost.`
            : undefined
        }
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setIsSubmitting(true);
            await runLifecycle(
              'convert-trial',
              {
                plan_code: convertForm.plan_code || plans[0]?.code,
                months: Number(convertForm.months),
                amount: Number(convertForm.amount) || 0,
              },
              'Trial converted.'
            );
            setIsSubmitting(false);
            setShowConvertModal(false);
          }}
        >
          <Select
            label="Plan"
            required
            value={convertForm.plan_code || plans[0]?.code || ''}
            onChange={(e) => setConvertForm({ ...convertForm, plan_code: e.target.value })}
          >
            {plans.map((pl) => (
              <option key={pl.id} value={pl.code}>
                {pl.name} — {money(pl.price)} / {pl.billing_period}
              </option>
            ))}
          </Select>

          <Select
            label="Length"
            value={convertForm.months}
            onChange={(e) => setConvertForm({ ...convertForm, months: e.target.value })}
          >
            <option value="1">1 month</option>
            <option value="3">3 months</option>
            <option value="6">6 months</option>
            <option value="12">1 year</option>
          </Select>

          <Input
            label="Amount collected"
            type="number"
            min="0"
            placeholder="0"
            hint="Leave at 0 if payment has not been taken yet."
            value={convertForm.amount}
            onChange={(e) => setConvertForm({ ...convertForm, amount: e.target.value })}
          />

          <div className="flex gap-2 mt-2">
            <Button type="button" variant="secondary" block onClick={() => setShowConvertModal(false)}>
              Cancel
            </Button>
            <Button type="submit" block loading={isSubmitting} disabled={plans.length === 0}>
              Convert
            </Button>
          </div>
        </form>
      </Modal>
    </Page>
  );
}
