import { ActivityType } from 'discord.js';
import { config } from './config.js';
import { getPlayers } from './minecraft.js';

/** Keeps the bot's status in sync with the live player count. */
export function startPresence(client) {
  let lastText = null;

  const update = async () => {
    let presence;
    try {
      const { online, max } = await getPlayers();
      presence = {
        status: online > 0 ? 'online' : 'idle',
        activities: [{ type: ActivityType.Playing, name: `${online}/${max} online | ${config.serverIp}` }],
      };
    } catch {
      presence = {
        status: 'dnd',
        activities: [{ type: ActivityType.Watching, name: 'the server (offline)' }],
      };
    }
    const text = `${presence.status}|${presence.activities[0].name}`;
    if (text !== lastText) {
      client.user.setPresence(presence);
      lastText = text;
    }
  };

  update();
  setInterval(update, config.statusIntervalMs);
}
