import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Package } from 'lucide-react';
import api from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useMoney } from '../../hooks/useMoney';
import { cn } from '../../lib/cn';
import {
  Card, Button, Badge, Modal, Input, Select, Textarea, Toggle,
  EmptyState, ListSkeleton, ErrorState,
} from '../../components/ui';

const emptyPackage = () => ({
  name: '',
  description: '',
  sessions_total: '12',
  price: '',
  validity_days: '90',
  commission_type: 'percent',
  commission_value: '20',
  is_active: true,
});

export default function PtPackagesPanel() {
  const toast = useToast();
  const confirm = useConfirm();
  const money = useMoney();

  const [packages, setPackages] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyPackage);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/trainers/packages');
      setError(null);
      setPackages(res.data.data || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Could not load packages.');
      setPackages([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const openCreate = () => {
    setEditing(null);
    setForm(emptyPackage());
    setOpen(true);
  };

  const openEdit = (pkg) => {
    setEditing(pkg);
    setForm({
      ...emptyPackage(),
      ...pkg,
      sessions_total: String(pkg.sessions_total),
      price: String(pkg.price),
      validity_days: String(pkg.validity_days),
      commission_value: String(pkg.commission_value),
      description: pkg.description ?? '',
    });
    setOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description?.trim() || '',
        sessions_total: Number(form.sessions_total),
        price: Number(form.price) || 0,
        validity_days: Number(form.validity_days),
        commission_type: form.commission_type,
        commission_value: Number(form.commission_value) || 0,
        is_active: form.is_active,
      };
      if (editing) {
        await api.patch(`/trainers/packages/${editing.id}`, payload);
        toast.success('Package updated.');
      } else {
        await api.post('/trainers/packages', payload);
        toast.success('Package created.');
      }
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save this package.');
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (pkg) => {
    const ok = await confirm({
      title: `Delete "${pkg.name}"?`,
      message: 'If members have already bought it, it will be deactivated instead so their history is kept.',
      confirmText: 'Delete',
    });
    if (!ok) return;
    try {
      const res = await api.delete(`/trainers/packages/${pkg.id}`);
      toast.success(res.data.message);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete this package.');
    }
  };

  // What the trainer takes home, shown live so the owner can see the margin
  // before saving rather than working it out afterwards.
  const previewCommission = () => {
    const price = Number(form.price) || 0;
    const value = Number(form.commission_value) || 0;
    const sessions = Number(form.sessions_total) || 0;
    if (form.commission_type === 'percent') {
      return { total: (price * Math.min(value, 100)) / 100, when: 'on sale' };
    }
    return { total: value * sessions, when: 'across all sessions' };
  };

  const rows = packages ?? [];

  return (
    <>
      <div className="flex justify-between items-center gap-3 mb-4">
        <p className="text-sm text-muted">
          Packages a trainer sells to a member. Commission accrues automatically.
        </p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-4" aria-hidden="true" />
          New package
        </Button>
      </div>

      {packages === null ? (
        <ListSkeleton rows={3} />
      ) : error ? (
        <ErrorState description={error} onRetry={load} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No PT packages"
          description="Create one so trainers can sell personal-training sessions."
          action={<Button onClick={openCreate}>Create a package</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {rows.map((pkg) => (
            <Card key={pkg.id} className={cn(!pkg.is_active && 'opacity-60')}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-heading truncate">{pkg.name}</h3>
                    {!pkg.is_active && <Badge variant="neutral">Inactive</Badge>}
                  </div>
                  {pkg.description && <p className="text-xs text-muted mt-0.5">{pkg.description}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon-sm" onClick={() => openEdit(pkg)} aria-label={`Edit ${pkg.name}`}>
                    <Pencil className="size-4" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted hover:text-danger hover:bg-danger-soft"
                    onClick={() => remove(pkg)}
                    aria-label={`Delete ${pkg.name}`}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>

              <p className="text-xl font-bold text-heading font-display tabular-nums">
                {money(pkg.price)}
                <span className="text-sm font-medium text-muted"> · {pkg.sessions_total} sessions</span>
              </p>

              <dl className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs">
                <div className="flex gap-1.5">
                  <dt className="text-muted">Valid</dt>
                  <dd className="text-body">{pkg.validity_days} days</dd>
                </div>
                <div className="flex gap-1.5">
                  <dt className="text-muted">Trainer earns</dt>
                  <dd className="text-body font-semibold">
                    {pkg.commission_type === 'percent'
                      ? `${pkg.commission_value}% of sale`
                      : `${money(pkg.commission_value)} per session`}
                  </dd>
                </div>
              </dl>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? `Edit ${editing.name}` : 'New PT package'}>
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <Input
            label="Name"
            required
            placeholder="e.g. 12-session strength block"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
          />
          <Textarea
            label="Description"
            rows={2}
            placeholder="Optional"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
          />

          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Sessions"
              required
              type="number"
              min="1"
              value={form.sessions_total}
              onChange={(e) => set('sessions_total', e.target.value)}
            />
            <Input
              label="Price"
              required
              type="number"
              min="0"
              value={form.price}
              onChange={(e) => set('price', e.target.value)}
            />
            <Input
              label="Valid (days)"
              required
              type="number"
              min="1"
              value={form.validity_days}
              onChange={(e) => set('validity_days', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Commission type"
              hint={
                form.commission_type === 'percent'
                  ? 'Paid once, when sold.'
                  : 'Paid per session delivered.'
              }
              value={form.commission_type}
              onChange={(e) => set('commission_type', e.target.value)}
            >
              <option value="percent">Percent of sale</option>
              <option value="flat">Flat per session</option>
            </Select>
            <Input
              label={form.commission_type === 'percent' ? 'Percent' : 'Amount per session'}
              required
              type="number"
              min="0"
              max={form.commission_type === 'percent' ? '100' : undefined}
              value={form.commission_value}
              onChange={(e) => set('commission_value', e.target.value)}
              error={
                form.commission_type === 'percent' && Number(form.commission_value) > 100
                  ? 'Cannot exceed 100%.'
                  : undefined
              }
            />
          </div>

          <p className="text-sm p-3 rounded-lg bg-accent-soft text-accent">
            Trainer earns <strong>{money(previewCommission().total)}</strong> {previewCommission().when}
            {form.commission_type === 'percent' && Number(form.price) > 0 && (
              <> · gym keeps {money(Number(form.price) - previewCommission().total)}</>
            )}
          </p>

          <Toggle
            label="Available to sell"
            checked={form.is_active}
            onChange={(v) => set('is_active', v)}
          />

          <div className="flex gap-2 mt-2">
            <Button type="button" variant="secondary" block onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" block loading={submitting}>
              {editing ? 'Save' : 'Create package'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
