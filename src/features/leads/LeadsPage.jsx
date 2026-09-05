import { useState, useEffect, useCallback } from 'react';
import {
  UserPlus, Phone, MessageCircle, Plus, Trash2, PhoneCall,
  CalendarClock, TrendingUp, Target, Check,
} from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { formatDate, formatDateTime, getWhatsAppLink } from '../../lib/utils';
import { cn } from '../../lib/cn';
import {
  Page, PageHeader, Card, CardHeader, Button, Badge, Tabs, Modal, StatCard,
  Input, Select, Textarea, Avatar, EmptyState, ListSkeleton, ErrorState,
} from '../../components/ui';

const STATUSES = [
  { key: 'new', label: 'New', variant: 'info' },
  { key: 'contacted', label: 'Contacted', variant: 'accent' },
  { key: 'trial_booked', label: 'Trial booked', variant: 'warning' },
  { key: 'negotiating', label: 'Negotiating', variant: 'warning' },
  { key: 'converted', label: 'Converted', variant: 'success' },
  { key: 'lost', label: 'Lost', variant: 'neutral' },
];

const SOURCES = [
  { key: 'walk_in', label: 'Walk-in' },
  { key: 'referral', label: 'Referral' },
  { key: 'social', label: 'Social media' },
  { key: 'website', label: 'Website' },
  { key: 'phone', label: 'Phone' },
  { key: 'other', label: 'Other' },
];

const ACTIVITY_ICON = {
  call: PhoneCall,
  whatsapp: MessageCircle,
  visit: UserPlus,
  status_change: TrendingUp,
  note: Target,
};

const emptyLead = () => ({
  name: '', phone: '', email: '', source: 'walk_in', status: 'new',
  interest: '', assigned_to: '', follow_up_at: '', notes: '',
});

const statusOf = (key) => STATUSES.find((s) => s.key === key) ?? STATUSES[0];

export default function LeadsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [leads, setLeads] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [token, setToken] = useState(0);
  const [staff, setStaff] = useState([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyLead);
  const [busy, setBusy] = useState(false);

  const [detail, setDetail] = useState(null);
  const [activity, setActivity] = useState({ kind: 'call', body: '', follow_up_at: '' });

  const reload = useCallback(() => setToken((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const params = {};
        if (filter && filter !== 'due') params.status = filter;
        if (filter === 'due') params.due = 'true';
        if (search.trim()) params.search = search.trim();

        const res = await api.get('/leads', { params });
        if (!alive) return;
        setError(null);
        setLeads(res.data.data || []);
        setStats(res.data.stats);
      } catch (err) {
        if (!alive) return;
        setError(err.response?.data?.message || 'Could not load leads.');
        setLeads([]);
      }
    })();
    return () => { alive = false; };
  }, [token, filter, search]);

  useEffect(() => {
    api.get('/staff').then((r) => setStaff(r.data.data || [])).catch(() => setStaff([]));
  }, []);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        ...form,
        assigned_to: form.assigned_to || null,
        follow_up_at: form.follow_up_at || null,
      };
      if (editing) await api.patch(`/leads/${editing.id}`, payload);
      else await api.post('/leads', payload);
      toast.success('Lead saved.');
      setFormOpen(false);
      reload();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save this lead.');
    } finally {
      setBusy(false);
    }
  };

  const openDetail = async (lead) => {
    setDetail({ ...lead, activities: null });
    try {
      const res = await api.get(`/leads/${lead.id}`);
      setDetail(res.data.data);
    } catch {
      setDetail({ ...lead, activities: [] });
    }
  };

  const changeStatus = async (lead, status) => {
    try {
      await api.patch(`/leads/${lead.id}`, { status });
      toast.success('Status updated.');
      if (detail?.id === lead.id) openDetail({ ...lead, status });
      reload();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update the status.');
    }
  };

  const logActivity = async (e) => {
    e.preventDefault();
    if (!activity.body.trim()) return;
    setBusy(true);
    try {
      await api.post(`/leads/${detail.id}/activities`, {
        kind: activity.kind,
        body: activity.body.trim(),
        follow_up_at: activity.follow_up_at || null,
      });
      setActivity({ kind: 'call', body: '', follow_up_at: '' });
      await openDetail(detail);
      reload();
      toast.success('Logged.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not log that.');
    } finally {
      setBusy(false);
    }
  };

  const convert = async (lead) => {
    const ok = await confirm({
      title: `Convert ${lead.name} to a member?`,
      message: 'A member record is created with their name and phone. You can log their first payment afterwards.',
      confirmText: 'Convert',
    });
    if (!ok) return;
    try {
      const res = await api.post(`/leads/${lead.id}/convert`);
      toast.success(res.data.message);
      setDetail(null);
      reload();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not convert this lead.');
    }
  };

  const remove = async (lead) => {
    const ok = await confirm({ title: `Delete ${lead.name}?`, confirmText: 'Delete' });
    if (!ok) return;
    await api.delete(`/leads/${lead.id}`);
    toast.success('Lead deleted.');
    setDetail(null);
    reload();
  };

  const whatsapp = (lead) => {
    const link = getWhatsAppLink(
      lead.phone,
      `Hi ${lead.name}, thanks for your interest in ${user?.gym_name || 'our gym'}.`,
      user?.country_code
    );
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
  };

  const rows = leads ?? [];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Page>
      <PageHeader
        title="Enquiries"
        subtitle="Track walk-ins and follow-ups until they join."
        actions={
          <Button onClick={() => { setEditing(null); setForm(emptyLead()); setFormOpen(true); }}>
            <Plus className="size-4" aria-hidden="true" />
            New enquiry
          </Button>
        }
      />

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <StatCard label="Open" value={stats.open} tone="accent" icon={Target} />
          <StatCard
            label="Follow up today"
            value={stats.due_today}
            tone={stats.due_today > 0 ? 'warning' : 'success'}
            icon={CalendarClock}
          />
          <StatCard label="Converted" value={stats.converted} tone="success" icon={Check} />
          <StatCard
            label="Conversion rate"
            value={stats.total ? `${Math.round((stats.converted / stats.total) * 100)}%` : '—'}
            tone="info"
            icon={TrendingUp}
          />
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <Input
          type="search"
          className="sm:max-w-xs"
          placeholder="Search name, phone or email…"
          aria-label="Search enquiries"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Tabs
          items={[
            { key: '', label: 'All' },
            { key: 'due', label: 'Due' },
            ...STATUSES.map((s) => ({ key: s.key, label: s.label })),
          ]}
          value={filter}
          onChange={setFilter}
          size="sm"
        />
      </div>

      {leads === null ? <ListSkeleton rows={5} />
        : error ? <ErrorState description={error} onRetry={reload} />
          : rows.length === 0 ? (
            <EmptyState
              icon={UserPlus}
              title={search || filter ? 'Nothing matches' : 'No enquiries yet'}
              description={
                search || filter
                  ? 'Try a different filter.'
                  : 'Log every walk-in and phone enquiry so none are forgotten.'
              }
              action={
                !search && !filter
                  ? <Button onClick={() => { setEditing(null); setForm(emptyLead()); setFormOpen(true); }}>Add the first one</Button>
                  : undefined
              }
            />
          ) : (
            <div className="flex flex-col gap-2">
              {rows.map((lead) => {
                const st = statusOf(lead.status);
                const overdue = lead.follow_up_at
                  && lead.follow_up_at <= today
                  && !['converted', 'lost'].includes(lead.status);
                return (
                  <Card
                    key={lead.id}
                    as="button"
                    interactive
                    onClick={() => openDetail(lead)}
                    className="flex items-center gap-3"
                  >
                    <Avatar name={lead.name} tone={overdue ? 'warning' : 'accent'} size="sm" />
                    <span className="grow min-w-0">
                      <span className="block font-semibold text-heading truncate">{lead.name}</span>
                      <span className="block text-xs text-muted truncate">
                        {lead.phone || 'No phone'}
                        {lead.interest && ` · ${lead.interest}`}
                      </span>
                    </span>
                    <span className="flex flex-col items-end gap-1 shrink-0">
                      <Badge variant={st.variant}>{st.label}</Badge>
                      {lead.follow_up_at && !['converted', 'lost'].includes(lead.status) && (
                        <span className={cn('text-xs', overdue ? 'text-warning font-semibold' : 'text-muted')}>
                          {overdue ? 'Due ' : 'Follow up '}{formatDate(lead.follow_up_at)}
                        </span>
                      )}
                    </span>
                  </Card>
                );
              })}
            </div>
          )}

      {/* ── Add / edit ── */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit ${editing.name}` : 'New enquiry'}
      >
        <form className="flex flex-col gap-4" onSubmit={save}>
          <Input
            label="Name" required autoFocus placeholder="Who walked in?"
            value={form.name} onChange={(e) => set('name', e.target.value)}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Phone" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            <Input label="Email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="Source" value={form.source} onChange={(e) => set('source', e.target.value)}>
              {SOURCES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </Select>
            <Select label="Status" value={form.status} onChange={(e) => set('status', e.target.value)}>
              {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </Select>
          </div>
          <Input
            label="Interested in" placeholder="e.g. Monthly membership, personal training"
            value={form.interest} onChange={(e) => set('interest', e.target.value)}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="Assigned to" value={form.assigned_to} onChange={(e) => set('assigned_to', e.target.value)}>
              <option value="">Nobody</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Input
              label="Follow up on" type="date"
              value={form.follow_up_at || ''} onChange={(e) => set('follow_up_at', e.target.value)}
            />
          </div>
          <Textarea
            label="Notes" rows={3}
            value={form.notes} onChange={(e) => set('notes', e.target.value)}
          />

          <div className="flex gap-2 mt-2">
            <Button type="button" variant="secondary" block onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="submit" block loading={busy}>{editing ? 'Save' : 'Add enquiry'}</Button>
          </div>
        </form>
      </Modal>

      {/* ── Detail ── */}
      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.name}
        description={detail ? SOURCES.find((s) => s.key === detail.source)?.label : undefined}
        size="lg"
      >
        {detail && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {detail.phone && (
                <>
                  <Button variant="secondary" size="sm" onClick={() => window.open(`tel:${detail.phone}`)}>
                    <Phone className="size-4" aria-hidden="true" />
                    Call
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => whatsapp(detail)}>
                    <MessageCircle className="size-4" aria-hidden="true" />
                    WhatsApp
                  </Button>
                </>
              )}
              <Button
                variant="secondary" size="sm"
                onClick={() => {
                  setEditing(detail);
                  setForm({
                    ...emptyLead(), ...detail,
                    assigned_to: detail.assigned_to || '',
                    follow_up_at: detail.follow_up_at || '',
                  });
                  setDetail(null);
                  setFormOpen(true);
                }}
              >
                Edit
              </Button>
              <div className="grow" />
              {detail.status !== 'converted' && (
                <Button variant="success" size="sm" onClick={() => convert(detail)}>
                  <Check className="size-4" aria-hidden="true" />
                  Convert to member
                </Button>
              )}
              <Button
                variant="ghost" size="icon-sm" aria-label={`Delete ${detail.name}`}
                className="text-muted hover:text-danger hover:bg-danger-soft"
                onClick={() => remove(detail)}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </div>

            <div>
              <p className="text-xs font-semibold text-body mb-1.5">Status</p>
              <div className="flex flex-wrap gap-1.5">
                {STATUSES.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    aria-pressed={detail.status === s.key}
                    onClick={() => changeStatus(detail, s.key)}
                    className={cn(
                      'px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                      detail.status === s.key
                        ? 'border-accent bg-accent-soft text-accent'
                        : 'border-line bg-surface-3 text-muted hover:border-line-hover'
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {detail.notes && (
              <p className="text-sm text-body p-3 rounded-lg bg-surface-3 whitespace-pre-wrap">
                {detail.notes}
              </p>
            )}

            <form className="flex flex-col gap-2 p-3 rounded-lg border border-line" onSubmit={logActivity}>
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Log a follow-up</p>
              <div className="flex gap-2">
                <Select
                  aria-label="Activity type"
                  className="w-36 shrink-0"
                  value={activity.kind}
                  onChange={(e) => setActivity({ ...activity, kind: e.target.value })}
                >
                  <option value="call">Call</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="visit">Visit</option>
                  <option value="note">Note</option>
                </Select>
                <Input
                  aria-label="What happened"
                  className="grow"
                  placeholder="What happened?"
                  value={activity.body}
                  onChange={(e) => setActivity({ ...activity, body: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <Input
                  aria-label="Next follow-up date"
                  type="date"
                  className="grow"
                  value={activity.follow_up_at}
                  onChange={(e) => setActivity({ ...activity, follow_up_at: e.target.value })}
                />
                <Button type="submit" loading={busy} disabled={!activity.body.trim()}>Log</Button>
              </div>
            </form>

            {detail.activities === null ? (
              <ListSkeleton rows={2} />
            ) : detail.activities.length > 0 && (
              <ul className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                {detail.activities.map((a) => {
                  const Icon = ACTIVITY_ICON[a.kind] ?? Target;
                  return (
                    <li key={a.id} className="flex gap-3 p-2.5 rounded-lg bg-surface-3/50">
                      <span className="flex items-center justify-center size-7 rounded-full bg-surface-3 text-muted shrink-0">
                        <Icon className="size-3.5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm text-body">{a.body}</span>
                        <span className="block text-xs text-muted mt-0.5">
                          {formatDateTime(a.created_at)}{a.actor && ` · ${a.actor}`}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </Modal>
    </Page>
  );
}
