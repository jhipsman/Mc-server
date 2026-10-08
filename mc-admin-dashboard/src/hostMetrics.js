import os from 'node:os';

let last = snapshot();

function snapshot() {
  let idle = 0;
  let total = 0;
  for (const cpu of os.cpus()) {
    for (const [type, time] of Object.entries(cpu.times)) {
      total += time;
      if (type === 'idle') idle += time;
    }
  }
  return { idle, total };
}

/**
 * CPU % of the whole machine since the previous call, plus RAM usage.
 * The dashboard is meant to run on the same PC as the server, so this reflects
 * the server's load; per-JVM heap usage comes from EssentialsX /gc over RCON.
 */
export function hostMetrics() {
  const now = snapshot();
  const totalDiff = now.total - last.total;
  const idleDiff = now.idle - last.idle;
  last = now;
  const cpu = totalDiff > 0 ? Math.round((1 - idleDiff / totalDiff) * 1000) / 10 : null;
  const totalMB = Math.round(os.totalmem() / 1048576);
  const usedMB = Math.round((os.totalmem() - os.freemem()) / 1048576);
  return { cpu, memUsedMB: usedMB, memTotalMB: totalMB };
}
