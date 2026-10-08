/**
 * Watchdog: runs the Minecraft server via start.bat and keeps it alive.
 *
 *  - Crash (unexpected exit)  -> Discord alert, restart after RESTART_DELAY_SECONDS
 *  - Hang (process alive but not answering query/RCON for HANG_TIMEOUT_SECONDS)
 *                             -> kill the process tree, then restart
 *  - Crash loop (MAX_RESTARTS within RESTART_WINDOW_MINUTES) -> give up and alert
 *
 * The server console is passed through: type commands into this window as usual.
 *   stop      stop the server for real (no restart) and exit the watchdog
 *   !restart  stop the server and start it again
 *   !status   show watchdog state
 */
import { spawn, execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { config } from './config.js';
import { queryFull } from './query.js';
import { createRcon } from './minecraft.js';
import { sendAlert } from './alerts.js';

const wd = config.watchdog;
const isWindows = process.platform === 'win32';
const STATE_FILE = path.join(config.dataDir, 'watchdog-state.json');
const rcon = config.rcon.password ? createRcon(config.rcon) : null;

let child = null;
let startedAt = 0;
let intent = null; // null | 'stop' | 'restart' | 'hang'
let restarts = []; // timestamps of automatic restarts (crash-loop window)
let totalRestarts = 0;
let lastResponsiveAt = 0;
let lastCrash = null;
let status = 'starting';
let hangTimer = null;

function log(msg) {
  const ts = new Date().toLocaleTimeString();
  console.log(`\x1b[36m[watchdog ${ts}]\x1b[0m ${msg}`);
}

function writeState() {
  const state = {
    status,
    pid: child?.pid ?? null,
    startedAt: startedAt || null,
    totalRestarts,
    recentRestarts: restarts.length,
    lastCrash,
    updatedAt: Date.now(),
  };
  fs.mkdirSync(config.dataDir, { recursive: true });
  // sync: several call sites exit the process right after writing
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ---- Starting / stopping ---------------------------------------------------

function startServer() {
  const script = path.join(config.serverDir, wd.startScript);
  if (!fs.existsSync(script)) {
    log(`Start script not found: ${script} (check SERVER_DIR / START_SCRIPT in .env)`);
    process.exit(1);
  }

  log(`Starting server: ${script}`);
  const [cmd, args] = isWindows
    ? ['cmd.exe', ['/d', '/c', wd.startScript, '--nopause']]
    : ['bash', [wd.startScript, '--nopause']];

  child = spawn(cmd, args, {
    cwd: config.serverDir,
    stdio: ['pipe', 'inherit', 'inherit'],
    detached: !isWindows, // own process group on Linux/macOS so we can kill the whole tree
    windowsHide: false,
  });
  startedAt = Date.now();
  lastResponsiveAt = Date.now();
  intent = null;
  status = 'running';
  writeState();

  child.on('error', (err) => log(`Failed to start: ${err.message}`));
  child.on('exit', onExit);
}

function sendToConsole(line) {
  if (child?.stdin.writable) child.stdin.write(line + '\n');
}

function killTree() {
  if (!child?.pid) return;
  log(`Killing server process tree (pid ${child.pid})`);
  if (isWindows) {
    execFile('taskkill', ['/pid', String(child.pid), '/T', '/F'], () => {});
  } else {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      child.kill('SIGKILL');
    }
  }
}

/** Graceful stop: "stop" in the console, force-kill if it takes longer than 90s. */
function stopServer(reason) {
  if (!child) return;
  intent = reason;
  status = reason === 'restart' ? 'restarting' : 'stopping';
  writeState();
  log(reason === 'restart' ? 'Restarting server...' : 'Stopping server...');
  sendToConsole('stop');
  const c = child;
  setTimeout(() => {
    if (child === c) {
      log('Server did not stop within 90s');
      killTree();
    }
  }, 90_000).unref();
}

async function onExit(code, signal) {
  const exitIntent = intent;
  child = null;
  const ranFor = Math.round((Date.now() - startedAt) / 1000);
  log(`Server exited (code ${code ?? 'n/a'}${signal ? `, signal ${signal}` : ''}) after ${ranFor}s`);

  if (exitIntent === 'stop') {
    status = 'stopped';
    writeState();
    log('Server stopped by admin. Watchdog exiting.');
    await sendAlert({ key: 'wd-stop', level: 'info', title: '⏹️ Server stopped by an admin', force: true });
    process.exit(0);
  }

  if (exitIntent === 'restart') {
    startServer();
    return;
  }

  const clean = code === 0 && exitIntent !== 'hang';
  if (clean && !wd.restartOnCleanExit) {
    status = 'stopped';
    writeState();
    log('Clean shutdown and RESTART_ON_CLEAN_EXIT=false - not restarting.');
    process.exit(0);
  }

  const now = Date.now();
  restarts = restarts.filter((t) => now - t < wd.restartWindowMs);
  if (!clean) lastCrash = { at: now, code, reason: exitIntent === 'hang' ? 'hang' : 'crash' };

  if (restarts.length >= wd.maxRestarts) {
    status = 'gave-up';
    writeState();
    log(`Crash loop: ${restarts.length} restarts in ${wd.restartWindowMs / 60000} min. Giving up.`);
    await sendAlert({
      key: 'wd-loop',
      level: 'critical',
      title: '🛑 Server is crash-looping - watchdog gave up',
      description: `${restarts.length} restarts within ${wd.restartWindowMs / 60000} minutes. Check logs/latest.log and crash-reports/, then start the watchdog again.`,
      force: true,
    });
    process.exit(1);
  }

  restarts.push(now);
  totalRestarts++;
  status = 'restarting';
  writeState();

  const what = exitIntent === 'hang'
    ? `stopped responding for ${wd.hangTimeoutMs / 1000}s and was killed`
    : clean ? 'shut down (clean exit)' : `crashed (exit code ${code})`;
  await sendAlert({
    key: 'wd-restart',
    level: clean ? 'warning' : 'critical',
    title: `🔁 Server ${what} - restarting`,
    description: `Restarting in ${wd.restartDelayMs / 1000}s (restart ${restarts.length}/${wd.maxRestarts} in this window).`,
    force: true,
  });
  log(`Restarting in ${wd.restartDelayMs / 1000}s...`);
  setTimeout(startServer, wd.restartDelayMs);
}

// ---- Hang detection ----------------------------------------------------------

async function isResponsive() {
  try {
    await queryFull(config.mc.host, config.mc.queryPort, 5000);
    return true;
  } catch {
    // fall through to RCON
  }
  if (!rcon) return false;
  try {
    await rcon.send('minecraft:list');
    return true;
  } catch {
    return false;
  }
}

function startHangDetection() {
  if (!wd.hangTimeoutMs) {
    log('Hang detection disabled (HANG_TIMEOUT_SECONDS=0)');
    return;
  }
  hangTimer = setInterval(async () => {
    if (!child || intent) return;
    if (Date.now() - startedAt < wd.startupGraceMs) return; // still starting up
    if (await isResponsive()) {
      lastResponsiveAt = Date.now();
      if (status !== 'running') {
        status = 'running';
        writeState();
      }
      return;
    }
    const silentFor = Date.now() - Math.max(lastResponsiveAt, startedAt + wd.startupGraceMs);
    log(`Server not responding (${Math.round(silentFor / 1000)}s)`);
    status = 'unresponsive';
    writeState();
    if (silentFor >= wd.hangTimeoutMs) {
      intent = 'hang';
      killTree();
    }
  }, 30_000);
}

// ---- Console passthrough -----------------------------------------------------

const rl = readline.createInterface({ input: process.stdin, terminal: false });
rl.on('line', (line) => {
  const cmd = line.trim();
  if (cmd === '!status') {
    log(`status=${status} pid=${child?.pid ?? '-'} uptime=${child ? Math.round((Date.now() - startedAt) / 1000) : 0}s restarts=${totalRestarts}`);
  } else if (cmd === '!restart') {
    stopServer('restart');
  } else if (cmd === 'stop' || cmd === '/stop') {
    stopServer('stop');
  } else {
    sendToConsole(line);
  }
});

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  if (!child) process.exit(0);
  log('Watchdog interrupted - stopping the server cleanly (Ctrl+C again to force)...');
  stopServer('stop');
  // On Windows, Ctrl+C makes cmd.exe ask "Terminate batch job (Y/N)?" once Java exits; answer it.
  if (isWindows) setInterval(() => sendToConsole('Y'), 3000).unref();
  process.once('SIGINT', () => {
    killTree();
    process.exit(1);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

log(`Watchdog started. Server folder: ${config.serverDir}`);
log('Type "stop" to stop the server for good, "!restart" to restart, "!status" for info.');
startServer();
startHangDetection();
