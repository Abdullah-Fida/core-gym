import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CalendarDays, Plus, Pencil, Trash2, Users, Clock, RefreshCw, X, Check,
  UserPlus, CalendarX,
} from 'lucide-react';
import api from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { cn } from '../../lib/cn';
import {
  Page, PageHeader, Card, CardHeader, Button, Badge, Tabs, Modal,
  Input, Select, Textarea, Toggle, Avatar, EmptyState, ListSkeleton, ErrorState,
} from '../../components/ui';

const WEEKDAYS = [
  { value: 0, short: 'Sun' }, { value: 1, short: 'Mon' }, { value: 2, short: 'Tue' },
  { value: 3, short: 'Wed' }, { value: 4, short: 'Thu' }, { value: 5, short: 'Fri' },
  { value: 6, short: 'Sat' },
];

const emptyTemplate = () => ({
  name: '',
  description: '',
  staff_id: '',
  capacity: 20,
  duration_min: 60,
  weekdays: [1, 3, 5],
  start_time: '07:00',
  is_active: true,
});

const timeOf = (iso) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

const dayLabel = (iso) => {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const same = (a, b) => a.toDateString() === b.toDateString();
  if (same(d, today)) return 'Today';
  if (same(d, tomorrow)) return 'Tomorrow';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
};

export default function ClassesPage() {
  const toast = useToast();
  const confirm = useConfirm();

  const [tab, setTab] = useState('schedule');
  const [sessions, setSessions] = useState(null);
  const [templates, setTemplates] = useState(null);
  const [trainers, setTrainers] = useState([]);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState(null);
  const [token, setToken] = useState(0);
  const [busy, setBusy] = useState(false);

  const [templateModal, setTemplateModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyTemplate);

  const [rosterSession, setRosterSession] = useState(null);
  const [roster, setRoster] = useState(null);
  const [bookMemberId, setBookMemberId] = useState('');

  const reload = useCallback(() => setToken((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const to = new Date();
        to.setDate(to.getDate() + 14);
        const [s, t] = await Promise.all([
          api.get('/classes/sessions', { params: { to: to.toISOString().slice(0, 10) } }),
          api.get('/classes/templates'),
        ]);
        if (!alive) return;
        setError(null);
        setSessions(s.data.data || []);
        setTemplates(t.data.data || []);
      } catch (err) {
        if (!alive) return;
        setError(err.response?.data?.message || 'Could not load classes.');
        setSessions([]);
        setTemplates([]);
      }
    })();
    return () => { alive = false; };
  }, [token]);

  useEffect(() => {
    Promise.all([
      api.get('/trainers').then((r) => r.data.data || []).catch(() => []),
      api.get('/members').then((r) => r.data.data || []).catch(() => []),
    ]).then(([t, m]) => {
      setTrainers(t);
      setMembers(m.filter((x) => x.status !== 'deleted'));
    });
  }, []);

  /** Group upcoming sessions by day for the schedule view. */
  const byDay = useMemo(() => {
    const groups = new Map();
    for (const s of sessions || []) {
      const key = new Date(s.starts_at).toDateString();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(s);
    }
    return [...groups.entries()];
  }, [sessions]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const toggleWeekday = (day) =>
    setForm((p) => ({
      ...p,
      weekdays: p.weekdays.includes(day)
        ? p.weekdays.filter((d) => d !== day)
        : [...p.weekdays, day].sort(),
    }));

  const saveTemplate = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { ...form, staff_id: form.staff_id || null };
      if (editing) await api.patch(`/classes/templates/${editing.id}`, payload);
      else await api.post('/classes/templates', payload);
      toast.success('Class saved.');
      setTemplateModal(false);
      reload();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save this class.');
    } finally {
      setBusy(false);
    }
  };

  const removeTemplate = async (t) => {
    const ok = await confirm({ title: `Delete "${t.name}"?`, confirmText: 'Delete' });
    if (!ok) return;
    try {
      const res = await api.delete(`/classes/templates/${t.id}`);
      toast.success(res.data.message);
      reload();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete this class.');
    }
  };

  const generate = async () => {
    setBusy(true);
    try {
      const res = await api.post('/classes/sessions/generate', { days: 28 });
      toast.success(res.data.message);
      reload();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not build the schedule.');
    } finally {
      setBusy(false);
    }
  };

  const openRoster = async (session) => {
    setRosterSession(session);
    setRoster(null);
    setBookMemberId('');
    try {
      const res = await api.get(`/classes/sessions/${session.id}/bookings`);
      setRoster(res.data.data || []);
    } catch {
      setRoster([]);
    }
  };

  const refreshRoster = async (sessionId) => {
    const res = await api.get(`/classes/sessions/${sessionId}/bookings`);
    setRoster(res.data.data || []);
    reload();
  };

  const book = async () => {
    if (!bookMemberId) return;
    try {
      const res = await api.post(`/classes/sessions/${rosterSession.id}/book`, { member_id: bookMemberId });
      toast.success(res.data.message);
      setBookMemberId('');
      await refreshRoster(rosterSession.id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not book that member.');
    }
  };

  const cancelBooking = async (booking) => {
    try {
      const res = await api.post(`/classes/bookings/${booking.id}/cancel`);
      toast.success(res.data.message);
      await refreshRoster(rosterSession.id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not cancel that booking.');
    }
  };

  const markAttendance = async (booking, attended) => {
    try {
      await api.post(`/classes/bookings/${booking.id}/attend`, { attended });
      await refreshRoster(rosterSession.id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update attendance.');
    }
  };

  const cancelSession = async (session) => {
    const ok = await confirm({
      title: 'Cancel this class?',
      message: 'Everyone booked will have their booking cancelled.',
      confirmText: 'Cancel class',
    });
    if (!ok) return;
    await api.patch(`/classes/sessions/${session.id}`, { status: 'cancelled' });
    toast.success('Class cancelled.');
    setRosterSession(null);
    reload();
  };

  return (
    <Page>
      <PageHeader
        title="Classes"
        subtitle="Timetable, bookings and attendance."
        actions={
          <>
            <Button variant="secondary" onClick={generate} loading={busy}>
              <RefreshCw className="size-4" aria-hidden="true" />
              Build schedule
            </Button>
            <Button onClick={() => { setEditing(null); setForm(emptyTemplate()); setTemplateModal(true); }}>
              <Plus className="size-4" aria-hidden="true" />
              New class
            </Button>
          </>
        }
      />

      <Tabs
        items={[
          { key: 'schedule', label: 'Schedule', count: sessions?.length },
          { key: 'classes', label: 'Classes', count: templates?.length },
        ]}
        value={tab}
        onChange={setTab}
        className="mb-5"
      />

      {/* ── Schedule ── */}
      {tab === 'schedule' && (
        sessions === null ? <ListSkeleton rows={5} />
          : error ? <ErrorState description={error} onRetry={reload} />
            : sessions.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="Nothing scheduled"
                description={
                  templates?.length
                    ? 'Your classes are set up — build the schedule to create bookable sessions.'
                    : 'Create a class first, then build the schedule.'
                }
                action={
                  templates?.length
                    ? <Button onClick={generate} loading={busy}>Build schedule</Button>
                    : <Button onClick={() => { setEditing(null); setForm(emptyTemplate()); setTemplateModal(true); }}>New class</Button>
                }
              />
            ) : (
              <div className="flex flex-col gap-5">
                {byDay.map(([day, items]) => (
                  <section key={day}>
                    <h2 className="text-xs font-bold uppercase tracking-wide text-muted mb-2">
                      {dayLabel(items[0].starts_at)}
                    </h2>
                    <div className="flex flex-col gap-2">
                      {items.map((s) => {
                        const full = s.spots_left === 0;
                        const cancelled = s.status === 'cancelled';
                        return (
                          <Card
                            key={s.id}
                            as="button"
                            interactive
                            onClick={() => openRoster(s)}
                            className={cn('flex items-center gap-3', cancelled && 'opacity-60')}
                          >
                            <span className="flex flex-col items-center justify-center shrink-0 w-16 py-1 rounded-lg bg-surface-3">
                              <span className="text-sm font-bold text-heading tabular-nums">
                                {timeOf(s.starts_at)}
                              </span>
                              <span className="text-[0.625rem] text-muted">{s.duration_min}m</span>
                            </span>

                            <span className="grow min-w-0">
                              <span className="flex items-center gap-2">
                                <span className="font-semibold text-heading truncate">{s.name}</span>
                                {cancelled && <Badge variant="danger">Cancelled</Badge>}
                              </span>
                              <span className="block text-xs text-muted truncate">
                                {s.staff?.name || 'No trainer assigned'}
                              </span>
                            </span>

                            <span className="flex flex-col items-end gap-1 shrink-0">
                              <Badge variant={cancelled ? 'neutral' : full ? 'warning' : 'success'}>
                                {cancelled ? '—' : full ? 'Full' : `${s.spots_left} left`}
                              </Badge>
                              <span className="flex items-center gap-1 text-xs text-muted tabular-nums">
                                <Users className="size-3" aria-hidden="true" />
                                {s.booked_count}/{s.capacity}
                                {s.waitlist_count > 0 && ` +${s.waitlist_count}`}
                              </span>
                            </span>
                          </Card>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )
      )}

      {/* ── Class definitions ── */}
      {tab === 'classes' && (
        templates === null ? <ListSkeleton rows={3} />
          : templates.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No classes yet"
              description="Define a class with its days, time and capacity."
              action={<Button onClick={() => { setEditing(null); setForm(emptyTemplate()); setTemplateModal(true); }}>Create one</Button>}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {templates.map((t) => (
                <Card key={t.id} className={cn(!t.is_active && 'opacity-60')}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-heading truncate">{t.name}</h3>
                        {!t.is_active && <Badge variant="neutral">Inactive</Badge>}
                      </div>
                      <p className="text-xs text-muted mt-0.5">{t.staff?.name || 'No trainer'}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost" size="icon-sm" aria-label={`Edit ${t.name}`}
                        onClick={() => {
                          setEditing(t);
                          setForm({ ...t, staff_id: t.staff_id || '', start_time: String(t.start_time).slice(0, 5) });
                          setTemplateModal(true);
                        }}
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

                  {t.description && <p className="text-sm text-muted mb-3">{t.description}</p>}

                  <div className="flex flex-wrap gap-1 mb-3">
                    {WEEKDAYS.map((d) => (
                      <span
                        key={d.value}
                        className={cn(
                          'inline-flex items-center justify-center size-7 rounded-md text-[0.625rem] font-bold',
                          t.weekdays?.includes(d.value)
                            ? 'bg-accent text-accent-contrast'
                            : 'bg-surface-3 text-muted'
                        )}
                      >
                        {d.short[0]}
                      </span>
                    ))}
                  </div>

                  <dl className="flex gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                      <Clock className="size-3.5 text-muted" aria-hidden="true" />
                      <dd className="text-body">{String(t.start_time).slice(0, 5)} · {t.duration_min}m</dd>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="size-3.5 text-muted" aria-hidden="true" />
                      <dd className="text-body">{t.capacity} spots</dd>
                    </div>
                  </dl>
                </Card>
              ))}
            </div>
          )
      )}

      {/* ── Class definition modal ── */}
      <Modal
        open={templateModal}
        onClose={() => setTemplateModal(false)}
        title={editing ? `Edit ${editing.name}` : 'New class'}
      >
        <form className="flex flex-col gap-4" onSubmit={saveTemplate}>
          <Input
            label="Name" required autoFocus placeholder="e.g. Morning HIIT"
            value={form.name} onChange={(e) => set('name', e.target.value)}
          />
          <Textarea
            label="Description" rows={2} placeholder="Optional"
            value={form.description || ''} onChange={(e) => set('description', e.target.value)}
          />
          <Select label="Trainer" value={form.staff_id} onChange={(e) => set('staff_id', e.target.value)}>
            <option value="">No trainer</option>
            {trainers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>

          <fieldset>
            <legend className="text-xs font-semibold text-body mb-1.5">Days</legend>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((d) => {
                const on = form.weekdays.includes(d.value);
                return (
                  <button
                    key={d.value} type="button" aria-pressed={on}
                    onClick={() => toggleWeekday(d.value)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                      on ? 'border-accent bg-accent-soft text-accent'
                        : 'border-line bg-surface-3 text-muted hover:border-line-hover'
                    )}
                  >
                    {d.short}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Start" type="time" required
              value={form.start_time} onChange={(e) => set('start_time', e.target.value)}
            />
            <Input
              label="Minutes" type="number" min="5" required
              value={form.duration_min} onChange={(e) => set('duration_min', e.target.value)}
            />
            <Input
              label="Capacity" type="number" min="1" required
              value={form.capacity} onChange={(e) => set('capacity', e.target.value)}
            />
          </div>

          <Toggle label="Active" checked={form.is_active} onChange={(v) => set('is_active', v)} />

          <div className="flex gap-2 mt-2">
            <Button type="button" variant="secondary" block onClick={() => setTemplateModal(false)}>
              Cancel
            </Button>
            <Button type="submit" block loading={busy} disabled={form.weekdays.length === 0}>
              {editing ? 'Save' : 'Create class'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Roster modal ── */}
      <Modal
        open={Boolean(rosterSession)}
        onClose={() => setRosterSession(null)}
        title={rosterSession?.name}
        description={
          rosterSession
            ? `${dayLabel(rosterSession.starts_at)} at ${timeOf(rosterSession.starts_at)} · ${rosterSession.booked_count}/${rosterSession.capacity} booked`
            : undefined
        }
        size="lg"
      >
        {rosterSession && (
          <div className="flex flex-col gap-4">
            {rosterSession.status === 'scheduled' && (
              <div className="flex gap-2">
                <Select
                  aria-label="Member to book"
                  className="grow"
                  value={bookMemberId}
                  onChange={(e) => setBookMemberId(e.target.value)}
                >
                  <option value="">Add a member…</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </Select>
                <Button onClick={book} disabled={!bookMemberId}>
                  <UserPlus className="size-4" aria-hidden="true" />
                  Book
                </Button>
              </div>
            )}

            {roster === null ? (
              <ListSkeleton rows={3} />
            ) : roster.length === 0 ? (
              <p className="text-sm text-muted py-4 text-center">Nobody booked yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {roster.map((b) => (
                  <li key={b.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-line bg-surface-3/50">
                    <Avatar name={b.member?.name} size="sm" />
                    <span className="grow min-w-0">
                      <span className="block text-sm font-semibold text-heading truncate">
                        {b.member?.name}
                      </span>
                      <span className="block text-xs text-muted">
                        {b.status === 'waitlisted' ? `Waitlist #${b.waitlist_pos}` : b.member?.phone}
                      </span>
                    </span>

                    {b.status === 'waitlisted' && <Badge variant="warning">Waiting</Badge>}
                    {b.status === 'attended' && <Badge variant="success" dot>Present</Badge>}
                    {b.status === 'no_show' && <Badge variant="danger" dot>Absent</Badge>}

                    <div className="flex gap-1 shrink-0">
                      {b.status === 'booked' && (
                        <>
                          <Button
                            variant="ghost" size="icon-sm" aria-label={`Mark ${b.member?.name} present`}
                            className="text-muted hover:text-success hover:bg-success-soft"
                            onClick={() => markAttendance(b, true)}
                          >
                            <Check className="size-4" aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost" size="icon-sm" aria-label={`Mark ${b.member?.name} absent`}
                            className="text-muted hover:text-danger hover:bg-danger-soft"
                            onClick={() => markAttendance(b, false)}
                          >
                            <X className="size-4" aria-hidden="true" />
                          </Button>
                        </>
                      )}
                      {['booked', 'waitlisted'].includes(b.status) && (
                        <Button
                          variant="ghost" size="icon-sm" aria-label={`Cancel ${b.member?.name}'s booking`}
                          className="text-muted hover:text-danger"
                          onClick={() => cancelBooking(b)}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {rosterSession.status === 'scheduled' && (
              <Button variant="danger-soft" block onClick={() => cancelSession(rosterSession)}>
                <CalendarX className="size-4" aria-hidden="true" />
                Cancel this class
              </Button>
            )}
          </div>
        )}
      </Modal>
    </Page>
  );
}
