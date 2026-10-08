import dgram from 'node:dgram';

/**
 * Minecraft Query protocol (GameSpy 4 over UDP), "full stat" request.
 * Requires enable-query=true in server.properties.
 * https://minecraft.wiki/w/Query
 */
export function queryFull(host, port, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    const sessionId = (Math.floor(Math.random() * 0x7fffffff) & 0x0f0f0f0f) >>> 0;
    let stage = 'handshake';

    const done = (err, value) => {
      clearTimeout(timer);
      socket.close();
      if (err) reject(err);
      else resolve(value);
    };
    const timer = setTimeout(() => done(new Error('Query timed out')), timeoutMs);

    socket.on('error', (err) => done(err));
    socket.on('message', (msg) => {
      try {
        if (msg.readUInt32BE(1) !== sessionId) return;
        if (stage === 'handshake' && msg[0] === 0x09) {
          const challenge = parseInt(msg.toString('ascii', 5, msg.indexOf(0, 5)), 10);
          stage = 'stat';
          const req = Buffer.alloc(15);
          req.writeUInt16BE(0xfefd, 0);
          req[2] = 0x00;
          req.writeUInt32BE(sessionId, 3);
          req.writeInt32BE(challenge, 7);
          // 4 bytes of padding request the "full" stat
          socket.send(req, port, host);
        } else if (stage === 'stat' && msg[0] === 0x00) {
          done(null, parseFullStat(msg));
        }
      } catch (err) {
        done(err);
      }
    });

    const handshake = Buffer.alloc(7);
    handshake.writeUInt16BE(0xfefd, 0);
    handshake[2] = 0x09;
    handshake.writeUInt32BE(sessionId, 3);
    socket.send(handshake, port, host, (err) => err && done(err));
  });
}

function parseFullStat(msg) {
  // type(1) session(4) "splitnum\0\x80\0"(11)
  let pos = 16;
  const readString = () => {
    const end = msg.indexOf(0, pos);
    const s = msg.toString('utf8', pos, end === -1 ? msg.length : end);
    pos = end === -1 ? msg.length : end + 1;
    return s;
  };

  const kv = {};
  for (;;) {
    const key = readString();
    if (!key) break;
    kv[key] = readString();
  }
  // "\x01player_\0\0"
  pos += 10;
  const players = [];
  while (pos < msg.length) {
    const name = readString();
    if (!name) break;
    players.push(name);
  }

  return {
    motd: (kv.hostname || '').replace(/§[0-9a-fk-orx]/gi, ''),
    version: kv.version || '',
    software: kv.plugins || '',
    map: kv.map || '',
    online: Number(kv.numplayers) || 0,
    max: Number(kv.maxplayers) || 0,
    players,
  };
}
