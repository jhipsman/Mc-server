import net from 'node:net';

const TYPE_RESPONSE = 0;
const TYPE_EXEC = 2;
const TYPE_AUTH = 3;
// Minecraft splits long responses into 4096-character packets.
const MAX_CHUNK = 4096;

/**
 * Minimal Source-RCON client for Minecraft.
 *  - connects lazily and reconnects automatically after errors
 *  - runs one command at a time (Minecraft answers in order anyway)
 *  - reassembles multi-packet responses
 */
export class Rcon {
  constructor({ host, port, password, timeoutMs = 5000 }) {
    this.host = host;
    this.port = port;
    this.password = password;
    this.timeoutMs = timeoutMs;
    this.socket = null;
    this.connecting = null;
    this.buffer = Buffer.alloc(0);
    this.nextId = 1;
    this.pending = null; // { id, chunks, resolve, reject, timer, quietTimer }
    this.queue = Promise.resolve();
  }

  /** Run a console command and return its output with colour codes removed. */
  send(command) {
    const run = () => this.#exec(command);
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => {});
    return result;
  }

  close() {
    this.socket?.destroy();
    this.socket = null;
  }

  async #ensureConnected() {
    if (this.socket) return;
    if (!this.connecting) {
      this.connecting = this.#connect().finally(() => {
        this.connecting = null;
      });
    }
    await this.connecting;
  }

  #connect() {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: this.host, port: this.port });
      socket.setNoDelay(true);
      // 'close' always follows 'error' and does the cleanup; this just prevents an unhandled 'error' crash.
      socket.on('error', () => {});
      this.buffer = Buffer.alloc(0);

      const fail = (err) => {
        clearTimeout(timer);
        socket.destroy();
        reject(err);
      };
      const timer = setTimeout(() => fail(new Error('RCON connection timed out')), this.timeoutMs);

      socket.once('error', fail);
      socket.once('connect', () => {
        const authId = this.#id();
        this.pending = {
          id: authId,
          auth: true,
          resolve: () => {
            clearTimeout(timer);
            socket.removeListener('error', fail);
            this.socket = socket;
            resolve();
          },
          reject: fail,
        };
        socket.write(encode(authId, TYPE_AUTH, this.password));
      });
      socket.on('data', (data) => this.#onData(data));
      socket.on('close', () => this.#teardown(new Error('RCON connection closed')));
    });
  }

  #exec(command) {
    return this.#ensureConnected().then(
      () =>
        new Promise((resolve, reject) => {
          const id = this.#id();
          const timer = setTimeout(() => {
            this.#teardown(new Error(`RCON command timed out: ${command}`));
          }, this.timeoutMs);
          this.pending = { id, chunks: [], resolve, reject, timer, quietTimer: null };
          this.socket.write(encode(id, TYPE_EXEC, command));
        }),
    );
  }

  #onData(data) {
    this.buffer = Buffer.concat([this.buffer, data]);
    while (this.buffer.length >= 4) {
      const length = this.buffer.readInt32LE(0);
      if (this.buffer.length < 4 + length) break;
      const id = this.buffer.readInt32LE(4);
      const type = this.buffer.readInt32LE(8);
      const body = this.buffer.toString('utf8', 12, 4 + length - 2);
      this.buffer = this.buffer.subarray(4 + length);
      this.#onPacket(id, type, body);
    }
  }

  #onPacket(id, type, body) {
    const p = this.pending;
    if (!p) return;

    if (p.auth) {
      if (type !== TYPE_EXEC) return; // auth replies use type 2
      this.pending = null;
      if (id === -1) p.reject(new Error('RCON authentication failed - check RCON_PASSWORD'));
      else p.resolve();
      return;
    }

    if (id !== p.id || type !== TYPE_RESPONSE) return;
    p.chunks.push(body);
    clearTimeout(p.quietTimer);
    if (body.length < MAX_CHUNK) {
      this.#finish();
    } else {
      // Exactly-full packet: more may follow. Wait briefly for the rest.
      p.quietTimer = setTimeout(() => this.#finish(), 150);
    }
  }

  #finish() {
    const p = this.pending;
    if (!p) return;
    this.pending = null;
    clearTimeout(p.timer);
    clearTimeout(p.quietTimer);
    p.resolve(stripColors(p.chunks.join('')));
  }

  #teardown(err) {
    if (this.socket) {
      this.socket.removeAllListeners('data');
      this.socket.destroy();
      this.socket = null;
    }
    const p = this.pending;
    this.pending = null;
    if (p) {
      clearTimeout(p.timer);
      clearTimeout(p.quietTimer);
      p.reject(err);
    }
  }

  #id() {
    this.nextId = (this.nextId % 0x7fffffff) + 1;
    return this.nextId;
  }
}

function encode(id, type, body) {
  const payload = Buffer.from(body, 'utf8');
  const packet = Buffer.alloc(14 + payload.length);
  packet.writeInt32LE(10 + payload.length, 0);
  packet.writeInt32LE(id, 4);
  packet.writeInt32LE(type, 8);
  payload.copy(packet, 12);
  // two trailing null bytes are already zero from Buffer.alloc
  return packet;
}

export function stripColors(text) {
  return text.replace(/§[0-9a-fk-orx]/gi, '');
}
