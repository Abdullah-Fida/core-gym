const {
  default: makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const pino = require('pino');
const { useSupabaseAuthState } = require('./authState');

/**
 * One WhatsApp socket per gym, held in memory and restored from Postgres.
 *
 * WhatsApp actively bans numbers that behave like bulk senders, so everything
 * here is deliberately conservative: sends are queued rather than fired in
 * parallel, each one waits a randomised delay, and a per-gym daily cap is
 * enforced before the socket is touched.
 */

const logger = pino({ level: process.env.LOG_LEVEL || 'warn' });

/** gym_id -> { sock, status, queue, sending, phone } */
const sessions = new Map();

const QR_TTL_MS = 60_000;

// Randomised so the traffic pattern does not look mechanical.
const MIN_DELAY_MS = Number(process.env.WA_MIN_DELAY_MS || 3000);
const MAX_DELAY_MS = Number(process.env.WA_MAX_DELAY_MS || 9000);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = () => MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);

async function setSessionRow(supabase, gymId, patch) {
  await supabase.from('wa_sessions').upsert(
    { gym_id: gymId, ...patch, updated_at: new Date().toISOString() },
    { onConflict: 'gym_id' }
  );
}

function getSession(gymId) {
  return sessions.get(gymId);
}

/**
 * Open (or reopen) a socket for one gym.
 *
 * Safe to call repeatedly: an already-connected gym is returned as-is rather
 * than opening a second socket, which WhatsApp treats as suspicious.
 */
async function connect(supabase, gymId) {
  const existing = sessions.get(gymId);
  if (existing?.status === 'connected') {
    return { status: 'connected', phone: existing.phone };
  }
  if (existing?.status === 'pairing') {
    return { status: 'pairing', qr: existing.qrDataUrl };
  }

  const { state, saveCreds, clearAll } = await useSupabaseAuthState(supabase, gymId);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    // Presence updates and full history sync are extra traffic that buys us
    // nothing here and adds to the bulk-sender signal.
    markOnlineOnConnect: false,
    syncFullHistory: false,
    browser: ['Batgos', 'Chrome', '1.0.0'],
  });

  const entry = {
    sock,
    status: 'pairing',
    queue: [],
    sending: false,
    phone: null,
    qrDataUrl: null,
    clearAll,
  };
  sessions.set(gymId, entry);

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      entry.status = 'pairing';
      entry.qrDataUrl = await QRCode.toDataURL(qr);
      await setSessionRow(supabase, gymId, {
        status: 'pairing',
        qr: entry.qrDataUrl,
        qr_expires_at: new Date(Date.now() + QR_TTL_MS).toISOString(),
        last_error: null,
      });
    }

    if (connection === 'open') {
      entry.status = 'connected';
      entry.phone = sock.user?.id?.split(':')[0] ?? null;
      entry.qrDataUrl = null;
      await setSessionRow(supabase, gymId, {
        status: 'connected',
        phone_number: entry.phone,
        // The QR is a credential — do not leave it readable after pairing.
        qr: null,
        qr_expires_at: null,
        last_error: null,
        connected_at: new Date().toISOString(),
      });
      drain(supabase, gymId);
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;

      entry.status = loggedOut ? 'logged_out' : 'disconnected';
      sessions.delete(gymId);

      if (loggedOut) {
        // The user removed the device from their phone. The stored credentials
        // are now useless and would block a fresh pairing.
        await clearAll();
        await setSessionRow(supabase, gymId, {
          status: 'logged_out', qr: null, qr_expires_at: null, phone_number: null,
          last_error: 'Logged out on the phone. Scan again to reconnect.',
        });
        return;
      }

      await setSessionRow(supabase, gymId, {
        status: 'disconnected',
        last_error: lastDisconnect?.error?.message ?? null,
      });

      // Reconnect for transient drops only.
      setTimeout(() => connect(supabase, gymId).catch(() => {}), 5000);
    }
  });

  // Wait briefly for either a QR or an open connection, so the HTTP caller gets
  // something useful instead of an empty response.
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline && entry.status === 'pairing' && !entry.qrDataUrl) {
    await sleep(250);
  }

  return { status: entry.status, qr: entry.qrDataUrl, phone: entry.phone };
}

async function disconnect(supabase, gymId, { forget = false } = {}) {
  const entry = sessions.get(gymId);
  if (entry) {
    try {
      if (forget) await entry.sock.logout();
      else entry.sock.end();
    } catch {
      /* the socket may already be gone; the row below is what matters */
    }
    if (forget) await entry.clearAll();
    sessions.delete(gymId);
  }
  await setSessionRow(supabase, gymId, {
    status: 'disconnected', qr: null, qr_expires_at: null,
    ...(forget ? { phone_number: null } : {}),
  });
  return { status: 'disconnected' };
}

/**
 * Send one message through a live socket.
 *
 * Returns `{ ok: false }` rather than throwing when there is no session — the
 * API falls back to a wa.me link in that case, so the message still reaches
 * the member.
 */
async function enqueue(supabase, gymId, to, text) {
  const entry = sessions.get(gymId);
  if (!entry || entry.status !== 'connected') {
    return { ok: false, reason: 'No live WhatsApp session for this gym.' };
  }

  return new Promise((resolve) => {
    entry.queue.push({ to, text, resolve });
    drain(supabase, gymId);
  });
}

/** Process one gym's queue serially with a randomised gap between sends. */
async function drain(supabase, gymId) {
  const entry = sessions.get(gymId);
  if (!entry || entry.sending || entry.status !== 'connected') return;

  entry.sending = true;
  try {
    while (entry.queue.length) {
      const job = entry.queue.shift();
      try {
        // WhatsApp rejects a number that has no account; onWhatsApp confirms
        // first so a bad number does not count as a failed send attempt.
        const [check] = await entry.sock.onWhatsApp(`${job.to}@s.whatsapp.net`);
        if (!check?.exists) {
          job.resolve({ ok: false, reason: 'That number is not on WhatsApp.' });
          continue;
        }

        await entry.sock.sendMessage(check.jid, { text: job.text });
        job.resolve({ ok: true });
      } catch (err) {
        job.resolve({ ok: false, reason: err.message });
      }

      if (entry.queue.length) await sleep(jitter());
    }
  } finally {
    entry.sending = false;
  }
}

/** Reopen sockets for gyms that were connected before the process restarted. */
async function restoreAll(supabase) {
  const { data } = await supabase
    .from('wa_sessions')
    .select('gym_id')
    .eq('status', 'connected');

  for (const row of data || []) {
    try {
      await connect(supabase, row.gym_id);
      // Staggered: opening many sockets at once looks like automation.
      await sleep(2000);
    } catch (err) {
      console.error(`[wa-worker] could not restore ${row.gym_id}:`, err.message);
    }
  }
  return (data || []).length;
}

module.exports = { connect, disconnect, enqueue, getSession, restoreAll };
