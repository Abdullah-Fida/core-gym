# Batgos WhatsApp worker

A separate long-lived Node process that holds one WhatsApp Web socket per gym.

## Why it is not part of the API

Baileys keeps a persistent WebSocket and in-memory decryption state. A
serverless runtime (Vercel, Lambda) freezes the process between invocations, so
the socket dies and every gym is forced to re-scan a QR code on each cold start.
This must run somewhere with a always-on process: Railway, Render, Fly.io, or a
plain VPS.

## Read this before switching a gym to automated sending

Baileys drives **WhatsApp Web**, not the official WhatsApp Business Cloud API.
It is an unofficial client, its use is against WhatsApp's terms of service, and
numbers that send at volume get banned — sometimes permanently, sometimes
without warning.

That is a real commercial risk for a product you intend to sell, so:

- The default provider stays `walink` (click-to-send links). It carries no
  risk at all and needs none of this.
- Automated sending is opt-in per gym, and the UI states the risk plainly.
- Sends are queued serially with a randomised 3–9 second gap and a per-gym
  daily cap, because a mechanical cadence is the clearest ban signal.
- Every send falls back to a `wa.me` link when the session is down, so a
  message is never silently lost.

If you want automation without the ban risk, the supported path is the official
**WhatsApp Business Cloud API** (Meta). It costs per conversation and requires
business verification, but it is permitted and stable. The provider abstraction
in `backend/services/messaging/` is where a `cloudapi.js` would slot in beside
`baileys.js` and `walink.js` with no other changes.

## Setup

```bash
cd wa-worker
cp .env.example .env      # fill in Supabase creds and a shared token
npm install
npm start
```

Generate the shared token with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set the **same value** as `WA_WORKER_TOKEN` in `backend/.env`, and point the API
at the worker with `WA_WORKER_URL=https://your-worker-host`.

The API is the only thing that talks to this service, over that bearer token.
Do not expose it to browsers.

## Endpoints

| Method | Path                  | Purpose                                  |
| ------ | --------------------- | ---------------------------------------- |
| GET    | `/health`             | Liveness. The only unauthenticated route |
| POST   | `/session/connect`    | Open a socket, return a pairing QR       |
| POST   | `/session/disconnect` | Close it; `forget: true` also logs out   |
| GET    | `/session/:gymId`     | Current status                           |
| POST   | `/send`               | Queue one message                        |
| POST   | `/scheduler/run`      | Run the automations now, for testing     |

## Sessions survive restarts

Credentials are stored in the `whatsapp_auth` table via a custom
`AuthenticationState` (`authState.js`) rather than Baileys' file-based default,
so a redeploy restores every session without a re-scan. On boot the worker
reopens sockets for gyms whose `wa_sessions.status` is `connected`, staggered by
two seconds each.

## Scheduler

`node-cron` runs the automations hourly, not daily, so a restart cannot skip a
whole day of reminders. Re-running is harmless: `message_log` has a unique index
on `(gym_id, member_id, event, queued_at::date)`, so a member receives a given
automation at most once per day regardless of how often the pass fires.
