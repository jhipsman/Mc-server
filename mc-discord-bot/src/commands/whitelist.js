import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { config } from '../config.js';
import { rcon } from '../minecraft.js';

const NAME_PATTERN = /^[A-Za-z0-9_]{3,16}$/;
const COOLDOWN_MS = 10 * 60 * 1000;

/** discordUserId -> timestamp of their last request (simple spam protection) */
const lastRequest = new Map();

export const data = new SlashCommandBuilder()
  .setName('whitelist')
  .setDescription('Request to be whitelisted on the Minecraft server.')
  .addStringOption((o) =>
    o.setName('username').setDescription('Your exact Minecraft Java username').setRequired(true).setMinLength(3).setMaxLength(16),
  );

/** Looks the name up with Mojang so admins only see real accounts. Returns null if it doesn't exist. */
async function lookupMojang(name) {
  try {
    const res = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(name)}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 404 || res.status === 204) return null;
    if (!res.ok) return { name, id: null };
    const body = await res.json();
    return { name: body.name, id: body.id };
  } catch {
    return { name, id: null }; // Mojang API down: let an admin decide
  }
}

export async function execute(interaction) {
  const username = interaction.options.getString('username', true).trim();
  const reply = (content) => interaction.reply({ content, flags: MessageFlags.Ephemeral });

  if (!NAME_PATTERN.test(username)) {
    return reply('❌ Minecraft usernames are 3-16 characters: letters, numbers and underscores only.');
  }
  if (!config.adminChannelId) {
    return reply('⚠️ Whitelist requests are not set up yet (ADMIN_CHANNEL_ID is missing). Ask a staff member.');
  }
  const last = lastRequest.get(interaction.user.id);
  if (last && Date.now() - last < COOLDOWN_MS) {
    const mins = Math.ceil((COOLDOWN_MS - (Date.now() - last)) / 60000);
    return reply(`⏳ You already sent a request. You can send another in ${mins} minute(s).`);
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const profile = await lookupMojang(username);
  if (!profile) {
    await interaction.editReply(`❌ No Minecraft Java account named **${username}** exists. Check the spelling.`);
    return;
  }

  const channel = await interaction.client.channels.fetch(config.adminChannelId).catch(() => null);
  if (!channel?.isTextBased()) {
    await interaction.editReply('⚠️ Could not reach the staff channel. Please tell an admin.');
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle('📝 Whitelist request')
    .addFields(
      { name: 'Minecraft username', value: `\`${profile.name}\``, inline: true },
      { name: 'Requested by', value: `<@${interaction.user.id}>`, inline: true },
      { name: 'Account', value: profile.id ? `[NameMC](https://namemc.com/profile/${profile.id})` : 'Not verified', inline: true },
    )
    .setFooter({ text: 'Pending review' })
    .setTimestamp();
  if (profile.id) embed.setThumbnail(`https://mc-heads.net/avatar/${profile.id}/64`);

  // State lives in the button IDs, so pending requests survive bot restarts.
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`wl:approve:${profile.name}:${interaction.user.id}`).setLabel('Approve').setStyle(ButtonStyle.Success).setEmoji('✅'),
    new ButtonBuilder().setCustomId(`wl:deny:${profile.name}:${interaction.user.id}`).setLabel('Deny').setStyle(ButtonStyle.Danger).setEmoji('✖️'),
  );

  await channel.send({ embeds: [embed], components: [row], allowedMentions: { parse: [] } });
  lastRequest.set(interaction.user.id, Date.now());
  await interaction.editReply(`✅ Request for **${profile.name}** sent to the staff team. You'll get a DM when it's reviewed.`);
}

function isStaff(interaction) {
  const member = interaction.member;
  if (!member) return false;
  if (member.permissions?.has?.(PermissionFlagsBits.ManageGuild)) return true;
  if (!config.adminRoleId) return false;
  const roles = member.roles?.cache ?? member.roles; // cached GuildMember vs raw API member
  return Array.isArray(roles) ? roles.includes(config.adminRoleId) : roles.has(config.adminRoleId);
}

/** Handles the Approve / Deny buttons. Returns true if the interaction was ours. */
export async function handleButton(interaction) {
  const [prefix, action, username, requesterId] = interaction.customId.split(':');
  if (prefix !== 'wl') return false;

  if (!isStaff(interaction)) {
    await interaction.reply({ content: '🚫 Only staff can review whitelist requests.', flags: MessageFlags.Ephemeral });
    return true;
  }

  const approved = action === 'approve';
  let resultText;
  if (approved) {
    try {
      resultText = await rcon.send(`whitelist add ${username}`);
    } catch (err) {
      await interaction.reply({
        content: `⚠️ Could not reach the server over RCON (${err.message}). The request is still pending - try again when the server is up.`,
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }
  }

  const original = interaction.message.embeds[0];
  const embed = EmbedBuilder.from(original)
    .setColor(approved ? 0x57f287 : 0xed4245)
    .setTitle(approved ? '✅ Whitelist request approved' : '✖️ Whitelist request denied')
    .setFooter({ text: `${approved ? 'Approved' : 'Denied'} by ${interaction.user.tag}` })
    .setTimestamp();
  if (resultText) embed.addFields({ name: 'Server response', value: `\`${resultText.slice(0, 200) || 'OK'}\`` });

  await interaction.update({ embeds: [embed], components: [] });

  const requester = await interaction.client.users.fetch(requesterId).catch(() => null);
  await requester
    ?.send(
      approved
        ? `✅ Your whitelist request for **${username}** was approved! Join at \`${config.serverIp}\`.`
        : `✖️ Your whitelist request for **${username}** was denied. Ask a staff member if you think this is a mistake.`,
    )
    .catch(() => {}); // user has DMs closed
  return true;
}
