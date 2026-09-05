import { useState, useEffect, useCallback, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import '../../lib/chartSetup';
import { Ruler, Plus, TrendingDown, TrendingUp, Trash2, Minus } from 'lucide-react';
import api from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useThemeColors } from '../../hooks/useThemeColors';
import { formatDate } from '../../lib/utils';
import { cn } from '../../lib/cn';
import {
  Card, CardHeader, Button, Badge, Modal, Input, Textarea, Tabs, Spinner,
} from '../../components/ui';

const FIELDS = [
  { key: 'weight_kg', label: 'Weight', unit: 'kg', chartable: true },
  { key: 'body_fat_pct', label: 'Body fat', unit: '%', chartable: true },
  { key: 'muscle_mass_kg', label: 'Muscle mass', unit: 'kg', chartable: true },
  { key: 'waist_cm', label: 'Waist', unit: 'cm', chartable: true },
  { key: 'chest_cm', label: 'Chest', unit: 'cm', chartable: true },
  { key: 'hips_cm', label: 'Hips', unit: 'cm', chartable: true },
  { key: 'arm_cm', label: 'Arm', unit: 'cm', chartable: true },
  { key: 'thigh_cm', label: 'Thigh', unit: 'cm', chartable: true },
  { key: 'height_cm', label: 'Height', unit: 'cm', chartable: false },
];

const BMI_BAND = {
  underweight: { variant: 'warning', label: 'Underweight' },
  healthy: { variant: 'success', label: 'Healthy' },
  overweight: { variant: 'warning', label: 'Overweight' },
  obese: { variant: 'danger', label: 'Obese' },
};

// Down is progress for these; up is progress for the rest.
const LOWER_IS_BETTER = new Set(['weight_kg', 'body_fat_pct', 'waist_cm']);

const emptyEntry = () => ({
  recorded_on: new Date().toISOString().slice(0, 10),
  weight_kg: '', height_cm: '', body_fat_pct: '', muscle_mass_kg: '',
  chest_cm: '', waist_cm: '', hips_cm: '', arm_cm: '', thigh_cm: '', note: '',
});

export default function MeasurementsPanel({ memberId, memberName }) {
  const toast = useToast();
  const confirm = useConfirm();
  const colors = useThemeColors();

  const [entries, setEntries] = useState(null);
  const [stats, setStats] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyEntry);
  const [busy, setBusy] = useState(false);
  const [metric, setMetric] = useState('weight_kg');

  const load = useCallback(async () => {
    try {
      const res = await api.get('/measurements', { params: { member_id: memberId } });
      setEntries(res.data.data || []);
      setStats(res.data.stats);
    } catch {
      setEntries([]);
    }
  }, [memberId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      // Blank inputs are sent as null, not 0 — an unrecorded waist is not a
      // waist of zero, and a 0 would poison the chart.
      const payload = { member_id: memberId, recorded_on: form.recorded_on, note: form.note || '' };
      for (const f of FIELDS) {
        payload[f.key] = form[f.key] === '' ? null : Number(form[f.key]);
      }
      await api.post('/measurements', payload);
      toast.success('Measurement saved.');
      setOpen(false);
      setForm(emptyEntry());
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save that measurement.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (entry) => {
    const ok = await confirm({
      title: `Delete the entry from ${formatDate(entry.recorded_on)}?`,
      confirmText: 'Delete',
    });
    if (!ok) return;
    await api.delete(`/measurements/${entry.id}`);
    toast.success('Entry removed.');
    await load();
  };

  /** Only metrics with at least two readings can show a trend. */
  const chartable = useMemo(() => {
    if (!entries?.length) return [];
    return FIELDS.filter(
      (f) => f.chartable && entries.filter((e) => e[f.key] != null).length >= 2
    );
  }, [entries]);

  const chartData = useMemo(() => {
    if (!entries?.length) return null;
    const points = entries.filter((e) => e[metric] != null);
    if (points.length < 2) return null;

    return {
      labels: points.map((e) => formatDate(e.recorded_on)),
      datasets: [{
        label: FIELDS.find((f) => f.key === metric)?.label ?? metric,
        data: points.map((e) => Number(e[metric])),
        borderColor: colors.accent,
        backgroundColor: `${colors.accent}22`,
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: colors.accent,
        tension: 0.3,
        fill: true,
      }],
    };
  }, [entries, metric, colors]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: colors.surface2,
        titleColor: colors.heading,
        bodyColor: colors.body,
        borderColor: colors.line,
        borderWidth: 1,
      },
    },
    scales: {
      x: { ticks: { color: colors.muted, font: { size: 10 } }, grid: { display: false } },
      y: {
        ticks: { color: colors.muted, font: { size: 10 } },
        grid: { color: colors.line },
        // Not zero-based: an 80→78 kg change is invisible on a 0-based axis.
        beginAtZero: false,
      },
    },
  }), [colors]);

  const latest = stats?.latest;

  const Delta = ({ field }) => {
    const value = stats?.since_first?.[field];
    if (value == null || value === 0) {
      return <span className="flex items-center gap-1 text-xs text-muted"><Minus className="size-3" aria-hidden="true" />No change</span>;
    }
    const good = LOWER_IS_BETTER.has(field) ? value < 0 : value > 0;
    const Icon = value < 0 ? TrendingDown : TrendingUp;
    return (
      <span className={cn('flex items-center gap-1 text-xs font-semibold', good ? 'text-success' : 'text-warning')}>
        <Icon className="size-3" aria-hidden="true" />
        {value > 0 ? '+' : ''}{value}
      </span>
    );
  };

  return (
    <Card>
      <CardHeader
        title="Body measurements"
        subtitle={entries?.length ? `${entries.length} recorded` : 'Track progress over time'}
        action={
          <Button size="sm" onClick={() => { setForm(emptyEntry()); setOpen(true); }}>
            <Plus className="size-4" aria-hidden="true" />
            Record
          </Button>
        }
      />

      {entries === null ? (
        <Spinner label="Loading measurements" />
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center text-center py-6">
          <span className="flex items-center justify-center size-12 rounded-2xl bg-surface-3 text-muted mb-3">
            <Ruler className="size-5" aria-hidden="true" />
          </span>
          <p className="text-sm text-muted">
            No measurements yet. Record a baseline so {memberName?.split(' ')[0] || 'they'} can see progress.
          </p>
        </div>
      ) : (
        <>
          {latest && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {['weight_kg', 'body_fat_pct', 'muscle_mass_kg', 'waist_cm']
                .filter((k) => latest[k] != null)
                .map((k) => {
                  const field = FIELDS.find((f) => f.key === k);
                  return (
                    <div key={k} className="p-3 rounded-lg bg-surface-3">
                      <p className="text-xs text-muted">{field.label}</p>
                      <p className="text-lg font-bold text-heading font-display tabular-nums">
                        {latest[k]}<span className="text-xs font-medium text-muted"> {field.unit}</span>
                      </p>
                      <Delta field={k} />
                    </div>
                  );
                })}
            </div>
          )}

          {latest?.bmi && (
            <div className="flex items-center gap-2 mb-4 p-3 rounded-lg border border-line">
              <span className="text-sm text-muted">BMI</span>
              <span className="text-lg font-bold text-heading tabular-nums">{latest.bmi}</span>
              {latest.bmi_band && (
                <Badge variant={BMI_BAND[latest.bmi_band]?.variant ?? 'neutral'}>
                  {BMI_BAND[latest.bmi_band]?.label ?? latest.bmi_band}
                </Badge>
              )}
            </div>
          )}

          {chartable.length > 0 && (
            <>
              <Tabs
                items={chartable.map((f) => ({ key: f.key, label: f.label }))}
                value={chartable.some((f) => f.key === metric) ? metric : chartable[0].key}
                onChange={setMetric}
                size="sm"
                className="mb-3"
              />
              {chartData ? (
                <div className="h-56 mb-4">
                  <Line data={chartData} options={chartOptions} />
                </div>
              ) : (
                <p className="text-sm text-muted mb-4">Record at least two entries to see a trend.</p>
              )}
            </>
          )}

          <ul className="flex flex-col gap-1.5 max-h-56 overflow-y-auto">
            {[...entries].reverse().map((e) => (
              <li key={e.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-3/50 text-sm">
                <span className="w-24 shrink-0 text-xs text-muted">{formatDate(e.recorded_on)}</span>
                <span className="grow min-w-0 text-body truncate">
                  {FIELDS.filter((f) => e[f.key] != null)
                    .map((f) => `${f.label} ${e[f.key]}${f.unit}`)
                    .join(' · ') || 'No values'}
                </span>
                <Button
                  variant="ghost" size="icon-sm"
                  aria-label={`Delete entry from ${formatDate(e.recorded_on)}`}
                  className="text-muted hover:text-danger hover:bg-danger-soft shrink-0"
                  onClick={() => remove(e)}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Record measurements"
        description="Leave anything you did not measure blank."
        size="lg"
      >
        <form className="flex flex-col gap-4" onSubmit={save}>
          <Input
            label="Date" type="date" required
            value={form.recorded_on}
            onChange={(e) => setForm({ ...form, recorded_on: e.target.value })}
          />

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {FIELDS.map((f) => (
              <Input
                key={f.key}
                label={`${f.label} (${f.unit})`}
                type="number"
                step="0.1"
                inputMode="decimal"
                placeholder="—"
                value={form[f.key]}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              />
            ))}
          </div>

          <Textarea
            label="Note" rows={2} placeholder="Optional"
            value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })}
          />

          <p className="text-xs text-muted">
            Recording the same date twice updates that entry rather than adding a second one.
          </p>

          <div className="flex gap-2">
            <Button type="button" variant="secondary" block onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" block loading={busy}>Save</Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}
