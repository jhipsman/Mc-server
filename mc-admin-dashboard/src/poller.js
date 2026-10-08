import { config } from './config.js';
import { queryFull } from './query.js';
import { createRcon, parseGc, parseList, parseTps } from './minecraft.js';
import { hostMetrics } from './hostMetrics.js';
import { sendAlert } from './alerts.js';
import { store } from './store.js';
import { LogTailer, parseLogLine } from './logTailer.js';

const rcon = createRcon(config.rcon);

let failedPolls = 0;
let lowTpsPolls = 0;
let offlineAlerted = false;
let tpsAlerted = false;
let onlineSince = null;
const useLog = Boolean(config.logPath);

/** One poll: query protocol for players, RCON for TPS / JVM memory / uptime, OS for CPU/RAM. */
export async function poll() {
  const t = Date.now();
  const host = hostMetrics();

  let q = null;
  try {
    q = await queryFull(config.mc.host, config.mc.queryPort);
  } catch {
    // query disabled or server down - RCON can still tell us
  }

  let tps = null;
  let gc = null;
  let list = null;
  if (config.rcon.password) {
    const [tpsOut, gcOut, listOut] = await Promise.all([
      rcon.send('tps').catch(() => null),
      rcon.send('essentials:gc').catch(() => null),
      q ? null : rcon.send('minecraft:list').catch(() => null),
    ]);
    tps = parseTps(tpsOut);
    gc = parseGc(gcOut);
    list = parseList(listOut);
  }

  const online = Boolean(q || tps || list);
  const players = q ? q.players : list?.players ?? [];

  if (online) {
    if (q) store.server = { motd: q.motd, version: q.version, software: q.software, map: q.map };
    if (!onlineSince) onlineSince = t;
  } else {
    onlineSince = null;
  }

  const sample = {
    t,
    online,
    players: online ? (q?.online ?? list?.online ?? players.length) : 0,
    maxPlayers: q?.max ?? list?.max ?? null,
    tps1: tps?.[0] ?? null,
    tps5: tps?.[1] ?? null,
    tps15: tps?.[2] ?? null,
    cpu: host.cpu,
    memUsedMB: host.memUsedMB,
    memTotalMB: host.memTotalMB,
    jvmUsedMB: gc?.jvmUsedMB ?? null,
    jvmMaxMB: gc?.jvmMaxMB ?? null,
    uptimeSec: gc?.uptimeSec ?? (onlineSince ? Math.round((t - onlineSince) / 1000) : null),
    playerNames: players,
  };
  store.addSample(sample);

  // Join/leave detection by diffing lists (only when not following the log file)
  if (online && !useLog && (q || list)) {
    const now = new Set(players);
    for (const name of now) store.playerEvent('join', name);
    for (const name of store.onlinePlayers.keys()) if (!now.has(name)) store.playerEvent('leave', name);
  }

  await checkAlerts(sample);
  return sample;
}

async function checkAlerts(sample) {
  const a = config.alerts;

  // ---- offline / back online ----
  if (!sample.online) {
    failedPolls++;
    if (failedPolls >= a.offlineConsecutive && !offlineAlerted) {
      offlineAlerted = true;
      store.allLeft('server offline');
      const alert = {
        key: 'offline',
        level: 'critical',
        title: '🔴 Minecraft server is OFFLINE',
        description: `No response to query or RCON for ${failedPolls} checks in a row.`,
      };
      store.addAlert(alert);
      await sendAlert(alert);
    }
    return;
  }
  if (offlineAlerted) {
    const alert = { key: 'online', level: 'ok', title: '🟢 Minecraft server is back online', force: true };
    store.addAlert(alert);
    await sendAlert(alert);
  }
  failedPolls = 0;
  offlineAlerted = false;

  // ---- low TPS ----
  if (sample.tps1 == null) return;
  if (sample.tps1 < a.tpsThreshold) {
    lowTpsPolls++;
    if (lowTpsPolls >= a.tpsConsecutive && !tpsAlerted) {
      const alert = {
        key: 'tps',
        level: 'warning',
        title: `🟡 Low TPS: ${sample.tps1.toFixed(1)}`,
        description: `TPS has been below ${a.tpsThreshold} for ${lowTpsPolls} checks in a row.`,
        fields: [
          { name: 'Players', value: String(sample.players), inline: true },
          { name: 'CPU', value: sample.cpu != null ? `${sample.cpu}%` : 'n/a', inline: true },
          { name: 'JVM memory', value: sample.jvmUsedMB != null ? `${sample.jvmUsedMB} / ${sample.jvmMaxMB} MB` : 'n/a', inline: true },
        ],
      };
      // Only stays "alerted" if it was actually sent (respects cooldown)
      if (await sendAlert(alert)) {
        tpsAlerted = true;
        store.addAlert(alert);
      }
    }
  } else {
    if (tpsAlerted) {
      const alert = { key: 'tps-ok', level: 'ok', title: `🟢 TPS recovered: ${sample.tps1.toFixed(1)}`, force: true };
      store.addAlert(alert);
      await sendAlert(alert);
    }
    lowTpsPolls = 0;
    tpsAlerted = false;
  }
}

export function startPolling() {
  if (useLog) {
    const tailer = new LogTailer(config.logPath);
    tailer.on('line', (line) => {
      const e = parseLogLine(line);
      if (e?.type === 'join') store.playerEvent('join', e.player);
      else if (e?.type === 'leave') store.playerEvent('leave', e.player);
      else if (e?.type === 'stopping') store.allLeft('server stopped');
    });
    tailer.on('error', (err) => console.warn(`[log] ${err.message}`));
    tailer.start();
    console.log(`[log] following ${config.logPath} for joins/leaves`);

    // Seed players who were already online when the dashboard started
    queryFull(config.mc.host, config.mc.queryPort)
      .then((q) => q.players.forEach((p) => store.playerEvent('join', p, { reason: 'already online' })))
      .catch(() => {});
  }

  const run = () => poll().catch((err) => console.error('[poll] failed:', err));
  run();
  setInterval(run, config.pollMs);
}
