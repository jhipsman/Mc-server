import { Rcon } from './rcon.js';

/** "TPS from last 1m, 5m, 15m: 20.0, 19.9, 19.8" (Paper/Spigot) or "Current TPS = 19.9" (Essentials) */
export function parseTps(out) {
  if (!out) return null;
  const paper = out.match(/:\s*\*?([\d.]+),\s*\*?([\d.]+),\s*\*?([\d.]+)/);
  if (paper) return paper.slice(1, 4).map((v) => Math.min(20, Number(v)));
  const ess = out.match(/TPS\s*=\s*([\d.]+)/i);
  if (ess) return [Math.min(20, Number(ess[1]))];
  return null;
}

/**
 * EssentialsX /gc output:
 *   Uptime: 2 hours 3 minutes 4 seconds
 *   Maximum memory: 6,144 MB.  Allocated memory: 6,144 MB.  Free memory: 3,000 MB.
 * "Used" = allocated - free (the heap actually in use).
 */
export function parseGc(out) {
  if (!out) return null;
  const mb = (label) => {
    const m = out.match(new RegExp(`${label} memory:\\s*([\\d,.]+)\\s*MB`, 'i'));
    return m ? Number(m[1].replace(/[,.](?=\d{3}\b)/g, '').replace(',', '.')) : null;
  };
  const max = mb('Maximum');
  const allocated = mb('Allocated');
  const free = mb('Free');

  let uptimeSec = null;
  const up = out.match(/Uptime:\s*([^\n]+)/i);
  if (up) {
    const units = { year: 31_536_000, month: 2_592_000, day: 86_400, hour: 3600, minute: 60, second: 1 };
    uptimeSec = 0;
    for (const [, n, unit] of up[1].matchAll(/(\d+)\s*(year|month|day|hour|minute|second)s?/gi)) {
      uptimeSec += Number(n) * units[unit.toLowerCase()];
    }
  }
  return {
    jvmMaxMB: max,
    jvmUsedMB: allocated != null && free != null ? allocated - free : null,
    uptimeSec,
  };
}

export function parseList(out) {
  const m = out?.match(/There are (\d+) of a max(?: of)? (\d+) players online:?\s*(.*)/i);
  if (!m) return null;
  return {
    online: Number(m[1]),
    max: Number(m[2]),
    players: m[3].split(',').map((s) => s.trim()).filter(Boolean),
  };
}

export function createRcon(rconConfig) {
  return new Rcon({ ...rconConfig, timeoutMs: 5000 });
}
