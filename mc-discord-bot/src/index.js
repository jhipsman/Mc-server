import { Client, Events, GatewayIntentBits, MessageFlags, Partials } from 'discord.js';
import { config } from './config.js';
import { startChatBridge } from './chatBridge.js';
import { startPresence } from './presence.js';
import { rcon } from './minecraft.js';
import * as status from './commands/status.js';
import * as whitelist from './commands/whitelist.js';

const commands = new Map([status, whitelist].map((c) => [c.data.name, c]));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // privileged: enable it in the Developer Portal (see README)
  ],
  partials: [Partials.Channel],
});

client.once(Events.ClientReady, async (c) => {
  console.log(`Logged in as ${c.user.tag}`);

  // Register slash commands for this guild (updates instantly, unlike global commands).
  try {
    await c.application.commands.set([...commands.values()].map((cmd) => cmd.data.toJSON()), config.guildId);
    console.log(`Registered /${[...commands.keys()].join(', /')} in guild ${config.guildId}`);
  } catch (err) {
    console.error('Failed to register slash commands:', err.message);
  }

  startPresence(client);
  startChatBridge(client);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      await commands.get(interaction.commandName)?.execute(interaction);
    } else if (interaction.isButton()) {
      await whitelist.handleButton(interaction);
    }
  } catch (err) {
    console.error(`Interaction ${interaction.id} failed:`, err);
    const payload = { content: '⚠️ Something went wrong handling that.', flags: MessageFlags.Ephemeral };
    if (interaction.isRepliable()) {
      if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => {});
      else await interaction.reply(payload).catch(() => {});
    }
  }
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log('Shutting down...');
    rcon.close();
    client.destroy();
    process.exit(0);
  });
}

client.login(config.token);
