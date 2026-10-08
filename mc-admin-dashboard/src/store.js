import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { config } from './config.js';

const HISTORY_FILE = path.join(config.dataDir, 'history.json');
const PLAYER_JSONL = path.join(config.dataDir, 'player-events.jsonl');
const PLAYER_LOG = path.join(config.logsDir, 'players.log');
const ALERTS_FILE = path.join(config.dataDir, 'alerts.json');
const MAX_RECENT_EVENTS = 500;
const MAX_ALERTS = 100;

/** In-memory state with simple JSON persistence. Emits 'sample', 'player' and 'alert'. */
class Store extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100); // one set per open dashboard tab
    fs.mkdirSync(config.dataDir, { recursive: true });
    fs.mkdirSync(config.logsDir, { recursive: true });
    this.history = readJson(HISTORY_FILE, []);
    this.alerts = readJson(ALERTS_FILE, []);
    this.events = readRecentEvents();
    this.latest = this.history.at(-1) || null;
    this.server = {}; // motd, version, software from the last successful query
    this.onlinePlayers = new Map(); // name -> joined timestamp
    this.saving = false;
  }

  addSample(sample) {
    this.history.push(sample);
    const cutoff = Date.now() - config.historyHours * 3_600_000;
    while (this.history.length && this.history[0].t < cutoff) this.history.shift();
    this.latest = sample;
    this.emit('sample', sample);
    this.#persistHistory();
  }

  historySince(ms) {
    const cutoff = Date.now() - ms;
    return this.history.filter((s) => s.t >= cutoff);
  }

  /** Records a join/leave. `source` is "log" or "poll". Ignores duplicates. */
  playerEvent(type, name, { at = Date.now(), reason } = {}) {
    if (type === 'join') {
      if (this.onlinePlayers.has(name)) return;
      this.onlinePlayers.set(name, at);
    } else {
      if (!this.onlinePlayers.has(name)) return;
    }
    const joinedAt = this.onlinePlayers.get(name);
    if (type === 'leave') this.onlinePlayers.delete(name);

    const event = { t: at, type, player: name };
    if (type === 'leave' && joinedAt) event.sessionSec = Math.round((at - joinedAt) / 1000);
    if (reason) event.reason = reason;

    this.events.push(event);
    if (this.events.length > MAX_RECENT_EVENTS) this.events.shift();

    fs.appendFile(PLAYER_JSONL, JSON.stringify(event) + '\n', () => {});
    const line = `${formatTime(at)}  ${type.toUpperCase().padEnd(5)}  ${name}` +
      (event.sessionSec != null ? `  (session ${formatDuration(event.sessionSec)})` : '') +
      (reason ? `  [${reason}]` : '') + '\n';
    fs.appendFile(PLAYER_LOG, line, () => {});
    this.emit('player', event);
  }

  /** Marks everyone as left, e.g. when the server goes offline/crashes. */
  allLeft(reason) {
    for (const name of [...this.onlinePlayers.keys()]) this.playerEvent('leave', name, { reason });
  }

  addAlert(alert) {
    const entry = { t: Date.now(), ...alert };
    this.alerts.push(entry);
    if (this.alerts.length > MAX_ALERTS) this.alerts.shift();
    fs.writeFile(ALERTS_FILE, JSON.stringify(this.alerts), () => {});
    this.emit('alert', entry);
  }

  watchdogState() {
    return readJson(path.join(config.dataDir, 'watchdog-state.json'), null);
  }

  #persistHistory() {
    if (this.saving) return;
    this.saving = true;
    const tmp = HISTORY_FILE + '.tmp';
    fs.writeFile(tmp, JSON.stringify(this.history), (err) => {
      if (!err) fs.rename(tmp, HISTORY_FILE, () => (this.saving = false));
      else this.saving = false;
    });
  }
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function readRecentEvents() {
  try {
    const lines = fs.readFileSync(PLAYER_JSONL, 'utf8').trim().split('\n');
    return lines.slice(-MAX_RECENT_EVENTS).flatMap((l) => {
      try {
        return [JSON.parse(l)];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

function formatTime(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function formatDuration(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m ${sec % 60}s`;
}

export const store = new Store();
