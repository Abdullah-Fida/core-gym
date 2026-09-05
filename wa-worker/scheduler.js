const { enqueue } = require('./sessions');

/**
 * Automation scheduler.
 *
 * Runs hourly rather than once a day so a restart cannot miss a window. Safe to
 * run repeatedly: `message_log` carries a unique index on
 * (gym_id, member_id, event, queued_at::date), so a member can only receive a
 * given automation once per day no matter how often this fires.
 */

const DAY_MS = 86_400_000;

/** Fill the placeholder tokens. Mirrors backend/services/messaging/render.js. */
function render(template, { member = {}, gym = {}, days, expiryDate } = {}) {
  const money = (value) => {
    const n = Number(value ?? 0);
    try {
      return new Intl.NumberFormat(gym.locale || 'en-US', {
        style: 'currency', currency: gym.currency || 'PKR',
        minimumFractionDigits: 0, maximumFractionDigits: n % 1 === 0 ? 0 : 2,
      }).format(n);
    } catch {
      return `${gym.currency || 'PKR'} ${n.toLocaleString()}`;
    }
  };

  return String(template || '')
    .replace(/\[Name\]/gi, member.name || '')
    .replace(/\[GymName\]/gi, gym.gym_name || '')
    .replace(/\[Days\]/gi, days != null ? String(Math.abs(days)) : '0')
    .replace(/\[Amount\]/gi, money(gym.default_monthly_fee))
    .replace(/\[Phone\]/gi, gym.phone || '')
    .replace(/\[ExpiryDate\]/gi, expiryDate
      ? new Date(expiryDate).toLocaleDateString(gym.locale || 'en-GB',
        { day: '2-digit', month: 'short', year: 'numeric' })
      : '')
    .trim();
}

function normalisePhone(raw, dialCode = '92') {
  let digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return null;
  const cc = String(dialCode).replace(/\D/g, '') || '92';
  if (digits.startsWith(cc) && digits.length > cc.length + 6) return digits;
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length >= 11 && !digits.startsWith(cc)) return digits;
  return cc + digits;
}

/** Whole days from today to a date, in the gym's own timezone. */
function daysUntil(dateStr, timezone) {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) return null;

  // Comparing in the gym's zone matters: a 23:00 UTC run would otherwise put a
  // gym in Karachi on tomorrow's date and fire reminders a day early.
  const fmt = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: timezone || 'UTC' }).format(d);
  const today = new Date(`${fmt(new Date())}T00:00:00Z`);
  const due = new Date(`${fmt(target)}T00:00:00Z`);
  return Math.round((due - today) / DAY_MS);
}

async function sentTodayCount(supabase, gymId) {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const { count } = await supabase
    .from('message_log')
    .select('id', { count: 'exact', head: true })
    .eq('gym_id', gymId)
    .in('status', ['sent', 'delivered'])
    .gte('queued_at', since.toISOString());
  return count || 0;
}

/**
 * Record the attempt first, then send.
 *
 * The unique index rejects a duplicate before anything reaches WhatsApp, so a
 * retry after a crash cannot double-message a member.
 */
async function deliver(supabase, gym, member, template, text) {
  const to = normalisePhone(member.phone, gym.country_code);
  if (!to) return 'invalid';

  const { data: logRow, error } = await supabase.from('message_log').insert({
    gym_id: gym.id,
    member_id: member.id,
    template_id: template.id,
    event: template.event,
    provider: 'baileys',
    to_phone: to,
    body: text,
    status: 'queued',
  }).select().single();

  if (error) {
    // 23505 = already sent to this member for this event today.
    return error.code === '23505' ? 'duplicate' : 'log_failed';
  }

  const result = await enqueue(supabase, gym.id, to, text);

  await supabase.from('message_log').update({
    status: result.ok ? 'sent' : 'failed',
    error: result.ok ? null : result.reason,
    sent_at: result.ok ? new Date().toISOString() : null,
  }).eq('id', logRow.id);

  return result.ok ? 'sent' : 'failed';
}

/** One pass over every gym with automation switched on. */
async function runOnce(supabase) {
  const { data: gyms } = await supabase
    .from('gyms')
    .select('*')
    .eq('messaging_provider', 'baileys')
    .eq('is_active', true);

  const summary = { gyms: 0, sent: 0, skipped: 0, failed: 0 };

  for (const gym of gyms || []) {
    const automation = gym.wa_automation || {};
    if (!Object.values(automation).some(Boolean)) continue;

    const { data: templates } = await supabase
      .from('message_templates')
      .select('*')
      .eq('gym_id', gym.id)
      .eq('is_active', true);

    if (!templates?.length) continue;

    let budget = (gym.wa_daily_cap ?? 200) - (await sentTodayCount(supabase, gym.id));
    if (budget <= 0) continue;

    summary.gyms += 1;

    const { data: members } = await supabase
      .from('members')
      .select('id, name, phone, status, expiry_date, join_date, date_of_birth')
      .eq('gym_id', gym.id)
      .neq('status', 'deleted');

    for (const template of templates) {
      if (!automation[template.event]) continue;

      for (const member of members || []) {
        if (budget <= 0) {
          summary.skipped += 1;
          continue;
        }
        if (!member.phone) continue;

        let matches = false;
        let days = null;

        if (template.event === 'expiry_reminder') {
          days = daysUntil(member.expiry_date, gym.timezone);
          // offset_days 7 means "7 days before expiry"; -1 means "1 day after".
          matches = days !== null && days === template.offset_days;
        } else if (template.event === 'winback') {
          days = daysUntil(member.expiry_date, gym.timezone);
          matches = member.status === 'expired'
            && days !== null
            && days === -Math.abs(template.offset_days);
        } else if (template.event === 'welcome') {
          days = daysUntil(member.join_date, gym.timezone);
          matches = days === -Math.abs(template.offset_days);
        } else if (template.event === 'birthday') {
          if (!member.date_of_birth) continue;
          const dob = new Date(member.date_of_birth);
          const now = new Date();
          matches = dob.getMonth() === now.getMonth() && dob.getDate() === now.getDate();
        }

        if (!matches) continue;

        const text = render(template.body, {
          member, gym, days, expiryDate: member.expiry_date,
        });

        const outcome = await deliver(supabase, gym, member, template, text);
        if (outcome === 'sent') {
          summary.sent += 1;
          budget -= 1;
        } else if (outcome === 'failed') {
          summary.failed += 1;
        }
      }
    }
  }

  return summary;
}

module.exports = { runOnce, render, normalisePhone, daysUntil };
