import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const str = (name, fallback = '') => process.env[name]?.trim() || fallback;
const num = (name, fallback) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && process.env[name]?.trim() !== '' ? v : fallback;
};
const bool = (name, fallback) => {
  const v = process.env[name]?.trim().toLowerCase();
  return v ? ['1', 'true', 'yes', 'on'].includes(v) : fallback;
};
const resolvePath = (p) => (p ? path.resolve(ROOT, p) : '');

export const config = {
  mc: {
    host: str('MC_HOST', '127.0.0.1'),
    queryPort: num('QUERY_PORT', 25565),
  },
  rcon: {
    host: str('MC_HOST', '127.0.0.1'),
    port: num('RCON_PORT', 25575),
    password: str('RCON_PASSWORD'),
  },
  serverDir: resolvePath(str('SERVER_DIR', '../minecraft-server')),
  logPath: resolvePath(str('MC_LOG_PATH')),

  port: num('PORT', 8080),
  host: str('HOST', '127.0.0.1'),
  auth: { user: str('DASHBOARD_USER', 'admin'), password: str('DASHBOARD_PASSWORD') },
  pollMs: Math.max(5, num('POLL_INTERVAL_SECONDS', 30)) * 1000,
  historyHours: Math.max(1, num('HISTORY_HOURS', 24)),

  alerts: {
    webhookUrl: str('DISCORD_WEBHOOK_URL'),
    tpsThreshold: num('TPS_ALERT_THRESHOLD', 15),
    tpsConsecutive: Math.max(1, num('TPS_ALERT_CONSECUTIVE', 2)),
    offlineConsecutive: Math.max(1, num('OFFLINE_CONSECUTIVE', 2)),
    cooldownMs: Math.max(0, num('ALERT_COOLDOWN_MINUTES', 15)) * 60_000,
    roleId: str('ALERT_ROLE_ID'),
  },

  watchdog: {
    startScript: str('START_SCRIPT', 'start.bat'),
    restartDelayMs: Math.max(0, num('RESTART_DELAY_SECONDS', 10)) * 1000,
    maxRestarts: Math.max(1, num('MAX_RESTARTS', 5)),
    restartWindowMs: Math.max(1, num('RESTART_WINDOW_MINUTES', 15)) * 60_000,
    hangTimeoutMs: Math.max(0, num('HANG_TIMEOUT_SECONDS', 180)) * 1000,
    startupGraceMs: Math.max(0, num('STARTUP_GRACE_SECONDS', 300)) * 1000,
    restartOnCleanExit: bool('RESTART_ON_CLEAN_EXIT', true),
  },

  dataDir: path.join(ROOT, 'data'),
  logsDir: path.join(ROOT, 'logs'),
};
