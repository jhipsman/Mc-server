import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`[config] Missing required setting ${name} - copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
  return value;
}

function optional(name, fallback = '') {
  return process.env[name]?.trim() || fallback;
}

export const config = {
  token: required('DISCORD_TOKEN'),
  clientId: required('CLIENT_ID'),
  guildId: required('GUILD_ID'),
  bridgeChannelId: optional('BRIDGE_CHANNEL_ID'),
  adminChannelId: optional('ADMIN_CHANNEL_ID'),
  adminRoleId: optional('ADMIN_ROLE_ID'),

  serverIp: optional('SERVER_IP', 'play.example.com'),
  rcon: {
    host: optional('RCON_HOST', '127.0.0.1'),
    port: Number(optional('RCON_PORT', '25575')),
    password: required('RCON_PASSWORD'),
  },
  logPath: process.env.MC_LOG_PATH?.trim()
    ? path.resolve(root, process.env.MC_LOG_PATH.trim())
    : '',
  statusIntervalMs: Math.max(10, Number(optional('STATUS_INTERVAL', '30'))) * 1000,
};
