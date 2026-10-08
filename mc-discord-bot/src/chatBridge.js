import { escapeMarkdown } from 'discord.js';
import { config } from './config.js';
import { LogTailer, parseLogLine } from './logTailer.js';
import { rcon } from './minecraft.js';

const MAX_MC_LENGTH = 256;

/**
 * Two-way chat bridge.
 *  Discord -> Minecraft: messages in BRIDGE_CHANNEL_ID are sent with RCON `tellraw`.
 *  Minecraft -> Discord: RCON can't push chat, so the bot follows logs/latest.log.
 */
export function startChatBridge(client) {
  if (!config.bridgeChannelId) {
    console.log('[bridge] BRIDGE_CHANNEL_ID not set - chat bridge disabled');
    return;
  }

  // ---- Discord -> Minecraft ----
  client.on('messageCreate', async (message) => {
    if (message.channelId !== config.bridgeChannelId) return;
    if (message.author.bot || message.webhookId) return;

    let text = message.cleanContent.replace(/\s+/g, ' ').trim();
    if (message.attachments.size) text = `${text} [attachment]`.trim();
    if (!text) return;
    if (text.length > MAX_MC_LENGTH) text = `${text.slice(0, MAX_MC_LENGTH - 1)}…`;

    const name = message.member?.displayName ?? message.author.username;
    const color = message.member?.displayHexColor && message.member.displayHexColor !== '#000000'
      ? message.member.displayHexColor
      : 'white';

    const components = [
      { text: '[Discord] ', color: 'blue', bold: true },
      { text: name, color, bold: false },
      { text: `: ${text}`, color: 'white', bold: false },
    ];
    try {
      await rcon.send(`tellraw @a ${JSON.stringify(components)}`);
    } catch (err) {
      console.warn(`[bridge] could not relay message to Minecraft: ${err.message}`);
      await message.react('⚠️').catch(() => {});
    }
  });

  // ---- Minecraft -> Discord ----
  if (!config.logPath) {
    console.log('[bridge] MC_LOG_PATH not set - Minecraft -> Discord relay disabled');
    return;
  }

  let channel = null;
  const getChannel = async () => {
    channel ??= await client.channels.fetch(config.bridgeChannelId).catch(() => null);
    return channel;
  };

  const tailer = new LogTailer(config.logPath);
  tailer.on('error', (err) => console.warn(`[bridge] log read error: ${err.message}`));
  tailer.on('line', async (line) => {
    const event = parseLogLine(line);
    if (!event) return;

    let content;
    switch (event.type) {
      case 'chat':
        content = `**${escapeMarkdown(event.player)}**: ${escapeMarkdown(event.message)}`;
        break;
      case 'join':
        content = `📥 **${escapeMarkdown(event.player)}** joined the server`;
        break;
      case 'leave':
        content = `📤 **${escapeMarkdown(event.player)}** left the server`;
        break;
      case 'advancement':
        content = `🏆 **${escapeMarkdown(event.player)}** earned **${escapeMarkdown(event.advancement)}**`;
        break;
      case 'started':
        content = '✅ **Server started**';
        break;
      case 'stopping':
        content = '🛑 **Server stopping**';
        break;
      default:
        return;
    }

    const target = await getChannel();
    // allowedMentions: nobody in Minecraft can ping @everyone or roles through the bridge
    await target?.send({ content: content.slice(0, 2000), allowedMentions: { parse: [] } }).catch((err) => {
      console.warn(`[bridge] could not post to Discord: ${err.message}`);
    });
  });
  tailer.start();
  console.log(`[bridge] following ${config.logPath}`);
}
