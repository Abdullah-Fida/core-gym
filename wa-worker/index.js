require('dotenv').config();

const express = require('express');
const cron = require('node-cron');
const { createClient } = require('@supabase/supabase-js');
const { connect, disconnect, enqueue, getSession, restoreAll } = require('./sessions');
const { runOnce } = require('./scheduler');

/**
 * Batgos WhatsApp worker.
 *
 * A separate long-lived process, deliberately. Baileys holds a persistent
 * WebSocket per gym and keeps decryption state in memory; a serverless function
 * is frozen between invocations, so the socket would die and every gym would be
 * forced to re-scan a QR on each cold start. Deploy this on Railway, Render,
 * Fly or a VPS — never on Vercel alongside the API.
 *
 * It is reached only by the API, over a shared bearer token. It is not exposed
 * to browsers and has no user-facing auth of its own.
 */

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  WA_WORKER_TOKEN,
  PORT = 4100,
} = process.env;

for (const [name, value] of Object.entries({
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, WA_WORKER_TOKEN,
})) {
  if (!value) {
    console.error(`[wa-worker] ${name} is not set. Refusing to start.`);
    process.exit(1);
  }
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const app = express();
app.use(express.json({ limit: '1mb' }));

// Shared-secret gate. Compared in constant time so the token cannot be
// recovered by timing repeated requests.
app.use((req, res, next) => {
  if (req.path === '/health') return next();

  const provided = String(req.headers.authorization || '').replace(/^Bearer /, '');
  const expected = WA_WORKER_TOKEN;

  if (provided.length !== expected.length) {
    return res.status(401).json({ success: false, message: 'Unauthorised.' });
  }
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  if (diff !== 0) return res.status(401).json({ success: false, message: 'Unauthorised.' });

  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
});

app.post('/session/connect', async (req, res) => {
  const { gym_id: gymId } = req.body || {};
  if (!gymId) return res.status(400).json({ success: false, message: 'gym_id is required.' });

  try {
    const result = await connect(supabase, gymId);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[wa-worker] connect failed:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/session/disconnect', async (req, res) => {
  const { gym_id: gymId, forget } = req.body || {};
  if (!gymId) return res.status(400).json({ success: false, message: 'gym_id is required.' });

  const result = await disconnect(supabase, gymId, { forget: Boolean(forget) });
  res.json({ success: true, data: result });
});

app.get('/session/:gymId', (req, res) => {
  const entry = getSession(req.params.gymId);
  res.json({
    success: true,
    data: { status: entry?.status ?? 'disconnected', phone: entry?.phone ?? null },
  });
});

app.post('/send', async (req, res) => {
  const { gym_id: gymId, to, text } = req.body || {};
  if (!gymId || !to || !text) {
    return res.status(400).json({ success: false, message: 'gym_id, to and text are required.' });
  }

  const result = await enqueue(supabase, gymId, to, text);
  if (!result.ok) return res.status(409).json({ success: false, message: result.reason });
  res.json({ success: true });
});

/** Manual trigger, for testing the automations without waiting for the hour. */
app.post('/scheduler/run', async (req, res) => {
  try {
    const summary = await runOnce(supabase);
    res.json({ success: true, data: summary });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

const server = app.listen(PORT, async () => {
  console.log(`[wa-worker] listening on ${PORT}`);

  const restored = await restoreAll(supabase);
  if (restored) console.log(`[wa-worker] restored ${restored} session(s) from the database`);
});

// Hourly rather than daily: a restart between runs would otherwise skip a whole
// day of reminders. The per-day unique index makes repeat runs harmless.
let running = false;
cron.schedule('7 * * * *', async () => {
  if (running) {
    console.warn('[wa-worker] previous scheduler pass still running; skipping');
    return;
  }
  running = true;
  try {
    const summary = await runOnce(supabase);
    if (summary.sent || summary.failed) console.log('[wa-worker] scheduler:', summary);
  } catch (err) {
    console.error('[wa-worker] scheduler failed:', err.message);
  } finally {
    running = false;
  }
});

const shutdown = (signal) => {
  console.log(`[wa-worker] ${signal} received, closing`);
  server.close(() => process.exit(0));
  // Do not hang forever if a socket refuses to close.
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
