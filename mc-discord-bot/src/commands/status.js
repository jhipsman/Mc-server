import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { config } from '../config.js';
import { getPlayers, getTps } from '../minecraft.js';

export const data = new SlashCommandBuilder()
  .setName('status')
  .setDescription('Show the Minecraft server address, player count and TPS.');

function tpsLabel(tps) {
  const v = Math.min(tps, 20).toFixed(1);
  if (tps >= 18) return `🟢 ${v}`;
  if (tps >= 15) return `🟡 ${v}`;
  return `🔴 ${v}`;
}

export async function execute(interaction) {
  await interaction.deferReply();

  let players;
  let tps = null;
  try {
    players = await getPlayers();
    tps = await getTps().catch(() => null);
  } catch {
    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle('🔴 Server offline')
      .setDescription(`The server at \`${config.serverIp}\` is not responding right now.`)
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const playerList = players.names.length
    ? players.names.map((n) => n.replace(/_/g, '\\_')).join(', ').slice(0, 1000)
    : '*Nobody online*';

  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle('🟢 Server online')
    .addFields(
      { name: 'Server IP', value: `\`${config.serverIp}\``, inline: true },
      { name: 'Players', value: `${players.online} / ${players.max}`, inline: true },
      {
        name: 'TPS (1m, 5m, 15m)',
        value: tps ? tps.map(tpsLabel).join('  ') : 'Unavailable',
        inline: true,
      },
      { name: 'Online now', value: playerList },
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
