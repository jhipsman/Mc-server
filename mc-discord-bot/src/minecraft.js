import { Rcon } from './rcon.js';
import { config } from './config.js';

export const rcon = new Rcon(config.rcon);

/**
 * Online players via the vanilla list command. "minecraft:list" is used on purpose:
 * EssentialsX overrides plain "list" with a different output format.
 */
export async function getPlayers() {
  const out = await rcon.send('minecraft:list');
  const match = out.match(/There are (\d+) of a max(?: of)? (\d+) players online:?\s*(.*)/i);
  if (!match) throw new Error(`Unexpected list output: ${out}`);
  const names = match[3]
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean);
  return { online: Number(match[1]), max: Number(match[2]), names };
}

/**
 * TPS for the last 1m / 5m / 15m. Understands Paper/Spigot's "tps" output and
 * EssentialsX's "Current TPS = 19.98" in case Essentials handles the command.
 * Returns null if neither format is found.
 */
export async function getTps() {
  const out = await rcon.send('tps');
  const paper = out.match(/:\s*\*?([\d.]+),\s*\*?([\d.]+),\s*\*?([\d.]+)/);
  if (paper) return paper.slice(1, 4).map(Number);
  const ess = out.match(/TPS\s*=\s*([\d.]+)/i);
  if (ess) return [Number(ess[1])];
  return null;
}

/** Runs a command and returns its output, or null if the server is unreachable. */
export async function tryCommand(command) {
  try {
    return await rcon.send(command);
  } catch {
    return null;
  }
}
