import { useState, useEffect, useCallback } from 'react';
import { Dumbbell, Plus, UserMinus, CheckCircle2, Package } from 'lucide-react';
import api from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useMoney } from '../../hooks/useMoney';
import { formatDate } from '../../lib/utils';
import { cn } from '../../lib/cn';
import {
  Card, CardHeader, Button, Badge, Modal, Select, Input, Avatar, Spinner,
} from '../../components/ui';

/**
 * Trainer and personal-training block on a member's detail page.
 *
 * Shows the assigned trainer, any PT packages the member holds with their
 * remaining balance, and lets staff log a delivered session.
 */
export default function MemberTrainerPanel({ memberId, memberName }) {
  const toast = useToast();
  const confirm = useConfirm();
  const money = useMoney();

  const [assignment, setAssignment] = useState(null);
  const [subscriptions, setSubscriptions] = useState(null);
  const [trainers, setTrainers] = useState([]);
  const [packages, setPackages] = useState([]);

  const [assignOpen, setAssignOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({ staff_id: '' });
  const [sellForm, setSellForm] = useState({ package_id: '', staff_id: '', price_paid: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [aRes, sRes] = await Promise.all([
        api.get('/trainers/assignments', { params: { member_id: memberId } }),
        api.get('/trainers/subscriptions', { params: { member_id: memberId } }),
      ]);
      setAssignment((aRes.data.data || []).find((a) => a.is_primary) || null);
      setSubscriptions(sRes.data.data || []);
    } catch (err) {
      console.error('Could not load trainer data', err);
      setSubscriptions([]);
    }
  }, [memberId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    Promise.all([
      api.get('/trainers').then((r) => r.data.data || []).catch(() => []),
      api.get('/trainers/packages').then((r) => (r.data.data || []).filter((p) => p.is_active)).catch(() => []),
    ]).then(([t, p]) => {
      setTrainers(t);
      setPackages(p);
    });
  }, []);

  const assign = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/trainers/assignments', {
        member_id: memberId,
        staff_id: assignForm.staff_id,
        is_primary: true,
      });
      toast.success('Trainer assigned.');
      setAssignOpen(false);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not assign a trainer.');
    } finally {
      setBusy(false);
    }
  };

  const unassign = async () => {
    const ok = await confirm({
      title: 'Remove this trainer?',
      message: `${assignment.staff?.name} will no longer be listed as ${memberName}'s trainer. Past commission is unaffected.`,
      confirmText: 'Remove',
    });
    if (!ok) return;
    try {
      await api.delete(`/trainers/assignments/${assignment.id}`);
      toast.success('Trainer removed.');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not remove the trainer.');
    }
  };

  const sell = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post('/trainers/subscriptions', {
        member_id: memberId,
        staff_id: sellForm.staff_id || assignment?.staff_id,
        package_id: sellForm.package_id,
        ...(sellForm.price_paid !== '' ? { price_paid: Number(sellForm.price_paid) } : {}),
      });
      toast.success(res.data.message);
      setSellOpen(false);
      setSellForm({ package_id: '', staff_id: '', price_paid: '' });
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not sell this package.');
    } finally {
      setBusy(false);
    }
  };

  const logSession = async (sub) => {
    try {
      const res = await api.post('/trainers/sessions', { subscription_id: sub.id });
      toast.success(res.data.message);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not log the session.');
    }
  };

  const selectedPackage = packages.find((p) => p.id === sellForm.package_id);
  const activeSubs = (subscriptions || []).filter((s) => s.status === 'active');
  const pastSubs = (subscriptions || []).filter((s) => s.status !== 'active');

  return (
    <Card>
      <CardHeader
        title="Trainer & personal training"
        action={
          assignment ? (
            <Button variant="ghost" size="sm" onClick={unassign}>
              <UserMinus className="size-3.5" aria-hidden="true" />
              Remove
            </Button>
          ) : null
        }
      />

      {/* ── Assignment ── */}
      {assignment ? (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-3 border border-line mb-4">
          <Avatar name={assignment.staff?.name} size="sm" />
          <div className="min-w-0 grow">
            <p className="text-sm font-semibold text-heading truncate">{assignment.staff?.name}</p>
            <p className="text-xs text-muted">Since {formatDate(assignment.assigned_at)}</p>
          </div>
          <Badge variant="accent">Primary</Badge>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-line mb-4">
          <span className="flex items-center justify-center size-9 rounded-full bg-surface-3 text-muted shrink-0">
            <Dumbbell className="size-4" aria-hidden="true" />
          </span>
          <p className="text-sm text-muted grow">No trainer assigned.</p>
          <Button size="sm" onClick={() => setAssignOpen(true)} disabled={trainers.length === 0}>
            Assign
          </Button>
        </div>
      )}

      {/* ── Packages ── */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted">PT packages</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSellForm((f) => ({ ...f, staff_id: assignment?.staff_id || '' }));
            setSellOpen(true);
          }}
          disabled={packages.length === 0 || trainers.length === 0}
        >
          <Plus className="size-3.5" aria-hidden="true" />
          Sell
        </Button>
      </div>

      {subscriptions === null ? (
        <Spinner label="Loading packages" />
      ) : subscriptions.length === 0 ? (
        <p className="text-sm text-muted py-2">No packages bought yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {[...activeSubs, ...pastSubs].map((sub) => {
            const remaining = sub.sessions_remaining ?? sub.sessions_total - sub.sessions_used;
            const pct = (sub.sessions_used / sub.sessions_total) * 100;
            const isActive = sub.status === 'active';
            return (
              <li
                key={sub.id}
                className={cn(
                  'p-3 rounded-lg border border-line bg-surface-3/50',
                  !isActive && 'opacity-60'
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-heading truncate">{sub.package_name}</p>
                    <p className="text-xs text-muted">
                      {sub.staff?.name} · expires {formatDate(sub.expires_at)}
                    </p>
                  </div>
                  <Badge
                    variant={
                      sub.status === 'active' ? 'success'
                        : sub.status === 'completed' ? 'info'
                          : sub.status === 'expired' ? 'warning' : 'neutral'
                    }
                  >
                    {sub.status}
                  </Badge>
                </div>

                <div className="flex items-center gap-3">
                  <div className="grow">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted">
                        {sub.sessions_used} of {sub.sessions_total} used
                      </span>
                      <span className="font-semibold text-heading tabular-nums">{remaining} left</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-[width] duration-500', isActive ? 'bg-accent' : 'bg-muted')}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>

                  {isActive && remaining > 0 && (
                    <Button size="sm" variant="secondary" onClick={() => logSession(sub)}>
                      <CheckCircle2 className="size-3.5" aria-hidden="true" />
                      Log
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* ── Assign modal ── */}
      <Modal open={assignOpen} onClose={() => setAssignOpen(false)} title="Assign a trainer">
        <form className="flex flex-col gap-4" onSubmit={assign}>
          <Select
            label="Trainer"
            required
            value={assignForm.staff_id}
            onChange={(e) => setAssignForm({ staff_id: e.target.value })}
          >
            <option value="">Choose a trainer…</option>
            {trainers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} — {t.member_count} member{t.member_count === 1 ? '' : 's'}
              </option>
            ))}
          </Select>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" block onClick={() => setAssignOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" block loading={busy} disabled={!assignForm.staff_id}>
              Assign
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Sell modal ── */}
      <Modal open={sellOpen} onClose={() => setSellOpen(false)} title="Sell a PT package">
        <form className="flex flex-col gap-4" onSubmit={sell}>
          <Select
            label="Package"
            required
            value={sellForm.package_id}
            onChange={(e) => setSellForm({ ...sellForm, package_id: e.target.value })}
          >
            <option value="">Choose a package…</option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {money(p.price)} / {p.sessions_total} sessions
              </option>
            ))}
          </Select>

          <Select
            label="Trainer"
            required
            hint="Whoever delivers the sessions earns the commission."
            value={sellForm.staff_id}
            onChange={(e) => setSellForm({ ...sellForm, staff_id: e.target.value })}
          >
            <option value="">Choose a trainer…</option>
            {trainers.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </Select>

          <Input
            label="Price paid"
            type="number"
            min="0"
            hint={
              selectedPackage
                ? `Leave blank to charge the list price of ${money(selectedPackage.price)}.`
                : 'Leave blank to use the list price.'
            }
            placeholder={selectedPackage ? String(selectedPackage.price) : ''}
            value={sellForm.price_paid}
            onChange={(e) => setSellForm({ ...sellForm, price_paid: e.target.value })}
          />

          {selectedPackage && (
            <p className="flex items-center gap-2 text-sm p-3 rounded-lg bg-accent-soft text-accent">
              <Package className="size-4 shrink-0" aria-hidden="true" />
              <span>
                {selectedPackage.sessions_total} sessions, valid {selectedPackage.validity_days} days · trainer earns{' '}
                <strong>
                  {selectedPackage.commission_type === 'percent'
                    ? money(
                      ((Number(sellForm.price_paid) || Number(selectedPackage.price))
                          * Number(selectedPackage.commission_value)) / 100
                    )
                    : `${money(selectedPackage.commission_value)} per session`}
                </strong>
              </span>
            </p>
          )}

          <div className="flex gap-2">
            <Button type="button" variant="secondary" block onClick={() => setSellOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              block
              loading={busy}
              disabled={!sellForm.package_id || !sellForm.staff_id}
            >
              Sell package
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}
