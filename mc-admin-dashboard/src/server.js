import crypto from 'node:crypto';
import path from 'node:path';
import express from 'express';
import { config, ROOT } from './config.js';
import { store } from './store.js';
import { startPolling } from './poller.js';

const app = express();
app.disable('x-powered-by');

// ---- Public endpoint (no auth, CORS) - used by mc-website for the live player count.
// Same JSON shape as api.mcsrvstat.us so the website can switch between them.
app.get('/api/public/status', (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Cache-Control', 'public, max-age=15');
  const s = store.latest;
  const fresh = s && Date.now() - s.t < config.pollMs * 3;
  if (!fresh || !s.online) {
    res.json({ online: false });
    return;
  }
  res.json({
    online: true,
    version: store.server.version || undefined,
    motd: { clean: [store.server.motd || ''] },
    players: {
      online: s.players,
      max: s.maxPlayers,
      list: (s.playerNames || []).map((name) => ({ name })),
    },
  });
});

// ---- Everything else sits behind HTTP basic auth when DASHBOARD_PASSWORD is set.
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

app.use((req, res, next) => {
  if (!config.auth.password) return next();
  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');
  if (scheme === 'Basic' && encoded) {
    const decoded = Buffer.from(encoded, 'base64').toString();
    const idx = decoded.indexOf(':');
    const user = decoded.slice(0, idx);
    const pass = decoded.slice(idx + 1);
    if (safeEqual(user, config.auth.user) && safeEqual(pass, config.auth.password)) return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="Minecraft Dashboard"');
  res.status(401).send('Authentication required');
});

app.use(express.static(path.join(ROOT, 'public')));

app.get('/api/status', (req, res) => {
  res.json({
    latest: store.latest,
    server: store.server,
    onlinePlayers: [...store.onlinePlayers].map(([name, since]) => ({ name, since })),
    watchdog: store.watchdogState(),
    config: {
      pollSeconds: config.pollMs / 1000,
      tpsThreshold: config.alerts.tpsThreshold,
      historyHours: config.historyHours,
      webhookConfigured: Boolean(config.alerts.webhookUrl),
      joinSource: config.logPath ? 'log' : 'poll',
    },
  });
});

app.get('/api/history', (req, res) => {
  const hours = Math.min(config.historyHours, Math.max(0.25, Number(req.query.hours) || 6));
  res.json(store.historySince(hours * 3_600_000).map(({ playerNames, ...rest }) => rest));
});

app.get('/api/players', (req, res) => {
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
  res.json(store.events.slice(-limit).reverse());
});

app.get('/api/alerts', (req, res) => {
  res.json(store.alerts.slice(-50).reverse());
});

// ---- Server-sent events: pushes new samples, joins/leaves and alerts to open dashboards.
app.get('/api/stream', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  const send = (event) => (data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  const onSample = (s) => {
    const { playerNames, ...rest } = s;
    send('sample')({ ...rest, onlinePlayers: [...store.onlinePlayers].map(([name, since]) => ({ name, since })), watchdog: store.watchdogState() });
  };
  const onPlayer = send('player');
  const onAlert = send('alert');
  store.on('sample', onSample);
  store.on('player', onPlayer);
  store.on('alert', onAlert);
  const ping = setInterval(() => res.write(': ping\n\n'), 25_000);
  req.on('close', () => {
    clearInterval(ping);
    store.off('sample', onSample);
    store.off('player', onPlayer);
    store.off('alert', onAlert);
  });
});

app.listen(config.port, config.host, () => {
  console.log(`Dashboard running at http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.port}`);
  if (!config.auth.password && config.host !== '127.0.0.1' && config.host !== 'localhost') {
    console.warn('WARNING: dashboard is reachable from the network without a password. Set DASHBOARD_PASSWORD in .env');
  }
  if (!config.rcon.password) console.warn('WARNING: RCON_PASSWORD not set - TPS and memory will be unavailable.');
  if (!config.alerts.webhookUrl) console.warn('Note: DISCORD_WEBHOOK_URL not set - alerts are only shown on the dashboard.');
  startPolling();
});
