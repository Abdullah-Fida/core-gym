import { useState, useEffect, useCallback } from 'react';
import {
  MessageCircle, QrCode, Power, RefreshCw, Plus, Pencil, Trash2,
  ShieldAlert, Check, X,
} from 'lucide-react';
import api from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { formatDateTime } from '../../lib/utils';
import { cn } from '../../lib/cn';
import {
  Page, PageHeader, Card, CardHeader, Button, Badge, Tabs, Modal,
  Input, Select, Textarea, Toggle, EmptyState, ListSkeleton, Spinner, Table,
} from '../../components/ui';

const EVENTS = [
  { key: 'expiry_reminder', label: 'Membership expiring', hint: 'Sent before a membership runs out.' },
  { key: 'payment_receipt', label: 'Payment receipt', hint: 'Sent when a payment is logged.' },
  { key: 'welcome', label: 'Welcome', hint: 'Sent after a member joins.' },
  { key: 'birthday', label: 'Birthday', hint: 'Sent on the member’s birthday.' },
  { key: 'winback', label: 'Win-back', hint: 'Sent to members who have lapsed.' },
];

const STATUS_BADGE = {
  connected: { variant: 'success', label: 'Connected' },
  pairing: { variant: 'warning', label: 'Waiting for scan' },
  disconnected: { variant: 'neutral', label: 'Not connected' },
  logged_out: { variant: 'danger', label: 'Logged out' },
  error: { variant: 'danger', label: 'Error' },
};

const LOG_BADGE = {
  sent: { variant: 'success', label: 'Sent' },
  delivered: { variant: 'success', label: 'Delivered' },
  queued: { variant: 'info', label: 'Queued' },
  failed: { variant: 'danger', label: 'Failed' },
  skipped_cap: { variant: 'warning', label: 'Cap reached' },
  fallback_link: { variant: 'neutral', label: 'Link' },
};

const emptyTemplate = () => ({
  event: 'expiry_reminder',
  name: '',
  body: 'Hi [Name], your membership at [GymName] expires in [Days] days on [ExpiryDate]. Renew for [Amount] to keep training.',
  offset_days: 7,
  is_active: true,
});

export default function MessagingPage() {
  const toast = useToast();
  const confirm = useConfirm();

  const [tab, setTab] = useState('connection');
  const [status, setStatus] = useState(null);
  const [templates, setTemplates] = useState(null);
  const [log, setLog] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pollToken, setPollToken] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyTemplate);

  const refresh = useCallback(() => setPollToken((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get('/messaging/status');
        if (alive) setStatus(res.data.data);
      } catch {
        if (alive) setStatus({ provider: 'walink', session: { status: 'disconnected' } });
      }
    })();
    return () => { alive = false; };
  }, [pollToken]);

  // While a QR is on screen it expires after a minute, so poll for the moment
  // the phone completes the pairing.
  useEffect(() => {
    if (status?.session?.status !== 'pairing') return undefined;
    const timer = setInterval(refresh, 3000);
    return () => clearInterval(timer);
  }, [status?.session?.status, refresh]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [t, l] = await Promise.all([
          api.get('/messaging/templates'),
          api.get('/messaging/log'),
        ]);
        if (!alive) return;
        setTemplates(t.data.data || []);
        setLog(l.data.data || []);
      } catch {
        if (!alive) return;
        setTemplates([]);
        setLog([]);
      }
    })();
    return () => { alive = false; };
  }, [pollToken]);

  const saveSettings = async (patch) => {
    try {
      await api.patch('/messaging/settings', patch);
      toast.success('Saved.');
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save that.');
    }
  };

  const connect = async () => {
    setBusy(true);
    try {
      const res = await api.post('/messaging/connect');
      toast.success(res.data.message);
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not start pairing.');
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    const ok = await confirm({
      title: 'Disconnect WhatsApp?',
      message: 'Automated messages will stop. You can reconnect by scanning again.',
      confirmText: 'Disconnect',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api.post('/messaging/disconnect');
      toast.success('Disconnected.');
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const saveTemplate = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (editing) await api.patch(`/messaging/templates/${editing.id}`, form);
      else await api.post('/messaging/templates', form);
      toast.success('Template saved.');
      setModalOpen(false);
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save the template.');
    } finally {
      setBusy(false);
    }
  };

  const removeTemplate = async (t) => {
    const ok = await confirm({ title: `Delete "${t.name}"?`, confirmText: 'Delete' });
    if (!ok) return;
    await api.delete(`/messaging/templates/${t.id}`);
    toast.success('Template deleted.');
    refresh();
  };

  if (!status) {
    return <Page><ListSkeleton rows={3} /></Page>;
  }

  const session = status.session || { status: 'disconnected' };
  const badge = STATUS_BADGE[session.status] ?? STATUS_BADGE.disconnected;
  const automated = status.provider === 'baileys';

  return (
    <Page>
      <PageHeader
        title="WhatsApp"
        subtitle="Send reminders and receipts to members."
        actions={<Badge variant={badge.variant} dot>{badge.label}</Badge>}
      />

      <Tabs
        items={[
          { key: 'connection', label: 'Connection' },
          { key: 'templates', label: 'Automations', count: templates?.length },
          { key: 'log', label: 'History', count: log?.length },
        ]}
        value={tab}
        onChange={setTab}
        className="mb-5"
      />

      {/* ── Connection ── */}
      {tab === 'connection' && (
        <div className="flex flex-col gap-4">
          <Card padding="lg">
            <CardHeader
              title="How messages are sent"
              subtitle="Change this at any time."
            />

            <div className="flex flex-col gap-3">
              {[
                {
                  key: 'walink',
                  title: 'Click to send',
                  hint: 'Opens WhatsApp with the message ready. You tap send. No risk to your number.',
                },
                {
                  key: 'baileys',
                  title: 'Automated',
                  hint: 'Messages send on their own from your connected number.',
                },
                {
                  key: 'noop',
                  title: 'Off',
                  hint: 'No WhatsApp messages at all.',
                },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => saveSettings({ messaging_provider: opt.key })}
                  aria-pressed={status.provider === opt.key}
                  className={cn(
                    'text-left p-3 rounded-lg border transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    status.provider === opt.key
                      ? 'border-accent bg-accent-soft'
                      : 'border-line bg-surface-3 hover:border-line-hover'
                  )}
                >
                  <span className="block text-sm font-bold text-heading">{opt.title}</span>
                  <span className="block text-xs text-muted mt-0.5">{opt.hint}</span>
                </button>
              ))}
            </div>

            {automated && (
              <p className="flex items-start gap-2 mt-4 p-3 rounded-lg bg-warning-soft text-warning text-sm">
                <ShieldAlert className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  Automated sending connects your number through an unofficial WhatsApp
                  interface. WhatsApp does not permit this, and numbers that send in bulk
                  can be banned. Use a dedicated business number, keep the daily cap low,
                  and expect to reconnect from time to time.
                </span>
              </p>
            )}
          </Card>

          {automated && (
            <Card padding="lg">
              <CardHeader
                title="Connected number"
                action={
                  session.status === 'connected' ? (
                    <Button variant="danger-soft" size="sm" onClick={disconnect} loading={busy}>
                      <Power className="size-4" aria-hidden="true" />
                      Disconnect
                    </Button>
                  ) : (
                    <Button size="sm" onClick={connect} loading={busy} disabled={!status.worker_configured}>
                      <QrCode className="size-4" aria-hidden="true" />
                      Connect
                    </Button>
                  )
                }
              />

              {!status.worker_configured && (
                <p className="text-sm text-muted">
                  The WhatsApp worker is not running on this deployment, so automated
                  sending is unavailable. Messages will fall back to click-to-send links.
                </p>
              )}

              {session.status === 'connected' && (
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center size-10 rounded-xl bg-success-soft text-success shrink-0">
                    <Check className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-semibold text-heading">+{session.phone_number}</p>
                    <p className="text-xs text-muted">
                      Connected {session.connected_at ? formatDateTime(session.connected_at) : ''}
                    </p>
                  </div>
                </div>
              )}

              {session.status === 'pairing' && (
                <div className="flex flex-col items-center text-center py-4">
                  {session.qr ? (
                    <>
                      <img
                        src={session.qr}
                        alt="QR code — scan this with WhatsApp on your phone to connect"
                        className="size-56 rounded-xl bg-white p-3"
                      />
                      <p className="text-sm text-body mt-4 max-w-sm">
                        On your phone open WhatsApp → <strong>Settings</strong> →{' '}
                        <strong>Linked devices</strong> → <strong>Link a device</strong>, then scan this code.
                      </p>
                      <p className="text-xs text-muted mt-2">This code expires after a minute.</p>
                    </>
                  ) : (
                    <>
                      <Spinner label="Generating QR code" />
                      <p className="text-sm text-muted mt-3">Generating a code…</p>
                    </>
                  )}
                </div>
              )}

              {session.last_error && (
                <p className="text-sm text-danger mt-3" role="alert">{session.last_error}</p>
              )}
            </Card>
          )}

          <Card padding="lg">
            <CardHeader title="Limits" subtitle="Applies to automated sending only." />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Country dial code"
                hint="Used to turn local member numbers into international ones."
                value={status.country_code}
                onChange={(e) => setStatus({ ...status, country_code: e.target.value.replace(/\D/g, '') })}
                onBlur={() => saveSettings({ country_code: status.country_code })}
              />
              <Input
                label="Daily message cap"
                hint={`${status.sent_today} sent today.`}
                type="number"
                min="1"
                max="2000"
                value={status.daily_cap}
                onChange={(e) => setStatus({ ...status, daily_cap: e.target.value })}
                onBlur={() => saveSettings({ wa_daily_cap: Number(status.daily_cap) })}
              />
            </div>
          </Card>

          <Card padding="lg">
            <CardHeader title="Which automations run" />
            <div className="flex flex-col gap-3">
              {EVENTS.map((ev) => (
                <Toggle
                  key={ev.key}
                  label={ev.label}
                  description={ev.hint}
                  checked={Boolean(status.automation?.[ev.key])}
                  onChange={(v) =>
                    saveSettings({ wa_automation: { ...status.automation, [ev.key]: v } })
                  }
                />
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ── Templates ── */}
      {tab === 'templates' && (
        <>
          <div className="flex justify-between items-center gap-3 mb-4">
            <p className="text-sm text-muted">
              The message sent for each event. Use [Name], [GymName], [Days], [Amount], [ExpiryDate].
            </p>
            <Button
              size="sm"
              onClick={() => { setEditing(null); setForm(emptyTemplate()); setModalOpen(true); }}
            >
              <Plus className="size-4" aria-hidden="true" />
              New
            </Button>
          </div>

          {templates === null ? (
            <ListSkeleton rows={3} />
          ) : templates.length === 0 ? (
            <EmptyState
              icon={MessageCircle}
              title="No automations yet"
              description="Add a template so reminders send themselves."
              action={
                <Button onClick={() => { setEditing(null); setForm(emptyTemplate()); setModalOpen(true); }}>
                  Create one
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {templates.map((t) => (
                <Card key={t.id} className={cn(!t.is_active && 'opacity-60')}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-heading truncate">{t.name}</h3>
                        {!t.is_active && <Badge variant="neutral">Off</Badge>}
                      </div>
                      <p className="text-xs text-muted mt-0.5">
                        {EVENTS.find((e) => e.key === t.event)?.label || t.event}
                        {t.event === 'expiry_reminder' && ` · ${t.offset_days} days before`}
                        {t.event === 'winback' && ` · ${Math.abs(t.offset_days)} days after`}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost" size="icon-sm" aria-label={`Edit ${t.name}`}
                        onClick={() => { setEditing(t); setForm({ ...t }); setModalOpen(true); }}
                      >
                        <Pencil className="size-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost" size="icon-sm" aria-label={`Delete ${t.name}`}
                        className="text-muted hover:text-danger hover:bg-danger-soft"
                        onClick={() => removeTemplate(t)}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-body whitespace-pre-wrap p-3 rounded-lg bg-surface-3">
                    {t.body}
                  </p>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Log ── */}
      {tab === 'log' && (
        log === null ? <ListSkeleton rows={5} /> : log.length === 0 ? (
          <EmptyState icon={MessageCircle} title="Nothing sent yet" />
        ) : (
          <Table
            columns={[
              { key: 'member', header: 'To', render: (m) => m.member?.name || m.to_phone },
              { key: 'event', header: 'Event', render: (m) => m.event || 'Manual' },
              {
                key: 'status',
                header: 'Status',
                render: (m) => {
                  const b = LOG_BADGE[m.status] ?? { variant: 'neutral', label: m.status };
                  return <Badge variant={b.variant}>{b.label}</Badge>;
                },
              },
              { key: 'queued_at', header: 'When', render: (m) => formatDateTime(m.queued_at) },
            ]}
            rows={log}
            renderCard={(m) => (
              <div key={m.id} className="p-3 bg-surface-2 border border-line rounded-xl">
                <div className="flex justify-between gap-2">
                  <span className="font-semibold text-heading truncate">
                    {m.member?.name || m.to_phone}
                  </span>
                  <Badge variant={(LOG_BADGE[m.status] ?? {}).variant || 'neutral'}>
                    {(LOG_BADGE[m.status] ?? {}).label || m.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted mt-1">{formatDateTime(m.queued_at)}</p>
                {m.error && <p className="text-xs text-danger mt-1">{m.error}</p>}
              </div>
            )}
          />
        )
      )}

      {/* ── Template modal ── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit ${editing.name}` : 'New automation'}
      >
        <form className="flex flex-col gap-4" onSubmit={saveTemplate}>
          <Input
            label="Name"
            required
            placeholder="e.g. One week before expiry"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />

          <Select
            label="When it sends"
            value={form.event}
            onChange={(e) => setForm({ ...form, event: e.target.value })}
          >
            {EVENTS.map((ev) => (
              <option key={ev.key} value={ev.key}>{ev.label}</option>
            ))}
          </Select>

          {['expiry_reminder', 'winback', 'welcome'].includes(form.event) && (
            <Input
              label={
                form.event === 'expiry_reminder'
                  ? 'Days before expiry'
                  : form.event === 'winback'
                    ? 'Days after expiry'
                    : 'Days after joining'
              }
              type="number"
              min="0"
              max="365"
              value={Math.abs(form.offset_days)}
              onChange={(e) => setForm({ ...form, offset_days: Number(e.target.value) })}
            />
          )}

          <Textarea
            label="Message"
            required
            rows={5}
            hint="[Name] [GymName] [Days] [Amount] [ExpiryDate] are replaced automatically."
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />

          <Toggle
            label="Active"
            checked={form.is_active}
            onChange={(v) => setForm({ ...form, is_active: v })}
          />

          <div className="flex gap-2 mt-2">
            <Button type="button" variant="secondary" block onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" block loading={busy}>
              {editing ? 'Save' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </Page>
  );
}
