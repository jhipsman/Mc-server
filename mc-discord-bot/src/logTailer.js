import fs from 'node:fs';
import { EventEmitter } from 'node:events';

/**
 * Follows a growing log file (like `tail -F`) and emits each new line.
 * Copes with the file not existing yet and with Minecraft rotating latest.log
 * on restart (detected when the file shrinks or is replaced).
 */
export class LogTailer extends EventEmitter {
  constructor(file, { intervalMs = 1000 } = {}) {
    super();
    this.file = file;
    this.intervalMs = intervalMs;
    this.position = null; // null = start at the current end of the file
    this.inode = null;
    this.partial = '';
    this.timer = null;
    this.reading = false;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.#poll(), this.intervalMs);
    this.#poll();
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }

  async #poll() {
    if (this.reading) return;
    this.reading = true;
    try {
      let stat;
      try {
        stat = await fs.promises.stat(this.file);
      } catch {
        return; // not created yet (server never started)
      }

      const replaced = this.inode !== null && stat.ino !== 0 && stat.ino !== this.inode;
      if (this.position === null) {
        this.position = stat.size;
      } else if (stat.size < this.position || replaced) {
        this.position = 0; // rotated: read the new file from the start
        this.partial = '';
      }
      this.inode = stat.ino;
      if (stat.size === this.position) return;

      const handle = await fs.promises.open(this.file, 'r');
      try {
        const length = stat.size - this.position;
        const buffer = Buffer.alloc(length);
        await handle.read(buffer, 0, length, this.position);
        this.position = stat.size;
        const text = this.partial + buffer.toString('utf8');
        const lines = text.split(/\r?\n/);
        this.partial = lines.pop();
        for (const line of lines) if (line) this.emit('line', line);
      } finally {
        await handle.close();
      }
    } catch (err) {
      this.emit('error', err);
    } finally {
      this.reading = false;
    }
  }
}

const PREFIX = /^\[(\d{2}:\d{2}:\d{2})\] \[[^\]]+\/INFO\]: /;

/**
 * Parses a Paper/vanilla latest.log line into an event, or returns null.
 *   chat:        [12:00:00] [Async Chat Thread - #0/INFO]: <Steve> hello
 *   join/leave:  [12:00:00] [Server thread/INFO]: Steve joined the game
 */
export function parseLogLine(line) {
  const prefix = line.match(PREFIX);
  if (!prefix) return null;
  const time = prefix[1];
  const msg = line.slice(prefix[0].length).replace(/§[0-9a-fk-orx]/gi, '');

  let m;
  if ((m = msg.match(/^(?:\[Not Secure\] )?<([^>]+)> (.*)$/))) {
    return { type: 'chat', time, player: m[1], message: m[2] };
  }
  if ((m = msg.match(/^([A-Za-z0-9_.]{2,17}) joined the game$/))) {
    return { type: 'join', time, player: m[1] };
  }
  if ((m = msg.match(/^([A-Za-z0-9_.]{2,17}) left the game$/))) {
    return { type: 'leave', time, player: m[1] };
  }
  if ((m = msg.match(/^([A-Za-z0-9_.]{2,17}) has (?:made the advancement|completed the challenge|reached the goal) \[(.+)\]$/))) {
    return { type: 'advancement', time, player: m[1], advancement: m[2] };
  }
  if (/^Done \([\d.,]+s\)!/.test(msg)) return { type: 'started', time };
  if (/^Stopping (?:the )?server/.test(msg)) return { type: 'stopping', time };
  return null;
}
