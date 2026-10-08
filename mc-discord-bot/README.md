# mc-discord-bot

A Discord bot for the Minecraft server, built with **discord.js v14**.

| Feature | How it works |
|---|---|
| Live player count in the bot's status | Runs `minecraft:list` over RCON every 30 s, shows e.g. *Playing 5/20 online \| play.example.com*. The status turns red (Do Not Disturb) when the server is offline. |
| Two-way chat bridge | **Discord → Minecraft:** messages in the bridge channel are sent with RCON `tellraw`, shown as `[Discord] Name: message`. **Minecraft → Discord:** RCON can't push chat to the bot, so the bot follows `logs/latest.log` and relays chat, joins/leaves, advancements and server start/stop. |
| `/status` | Server IP, online/offline, player count, who's online, TPS (1m/5m/15m) |
| `/whitelist <username>` | Checks that the Mojang account exists, then posts the request to the staff channel with **Approve** / **Deny** buttons. Approve runs `whitelist add <name>` over RCON. The requester gets a DM either way. |

## Requirements

- **Node.js 18.17 or newer** (Node 20 or 22 LTS recommended): https://nodejs.org
- The Minecraft server from `../minecraft-server` with RCON enabled
- Run the bot **on the same PC as the Minecraft server** if you want Minecraft → Discord chat, because it reads the server's log file. Everything else works from any machine that can reach the RCON port.

## Setup

### 1. Create the Discord application

1. Go to https://discord.com/developers/applications → **New Application**.
2. **Bot** tab:
   - Click **Reset Token** and copy the token (this is `DISCORD_TOKEN`).
   - Under **Privileged Gateway Intents**, turn on **Message Content Intent**. The chat bridge needs it to read messages.
3. **General Information** tab: copy the **Application ID** (`CLIENT_ID`).
4. **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot permissions: *View Channels*, *Send Messages*, *Embed Links*, *Read Message History*, *Add Reactions*
   - Open the generated URL and invite the bot to your server.

### 2. Get the IDs

In Discord, go to **User Settings → Advanced** and turn on **Developer Mode**. Then right-click to **Copy ID**:

- your server icon → `GUILD_ID`
- the public chat-bridge channel → `BRIDGE_CHANNEL_ID`
- a **private staff-only** channel → `ADMIN_CHANNEL_ID`
- *(optional)* your staff role → `ADMIN_ROLE_ID`. Members with the **Manage Server** permission can always approve requests.

### 3. Enable RCON on the Minecraft server

In `minecraft-server/server.properties` (already set up by Phase 1):

```properties
enable-rcon=true
rcon.port=25575
rcon.password=<a long random password>
```

Restart the server after changing it.

> ⚠️ **Never port-forward 25575.** RCON gives full console access. Only the bot and the dashboard on your own machine or network should reach it.

### 4. Configure and run

```bat
cd mc-discord-bot
copy .env.example .env
notepad .env
npm install
npm start
```

You should see:

```
Logged in as YourBot#1234
Registered /status, /whitelist in guild 1234...
[bridge] following C:\...\minecraft-server\logs\latest.log
```

Slash commands are registered automatically for your guild every time the bot starts, so changes show up instantly.

## Configuration (`.env`)

| Variable | Required | Description |
|---|---|---|
| `DISCORD_TOKEN` | ✅ | Bot token |
| `CLIENT_ID` | ✅ | Application ID |
| `GUILD_ID` | ✅ | Your Discord server ID |
| `BRIDGE_CHANNEL_ID` | | Channel that mirrors in-game chat. Leave it empty to turn off the bridge. |
| `ADMIN_CHANNEL_ID` | | Staff channel for whitelist requests |
| `ADMIN_ROLE_ID` | | Role allowed to approve/deny (in addition to Manage Server) |
| `SERVER_IP` | | Address shown in `/status` and the bot's status |
| `RCON_HOST` / `RCON_PORT` / `RCON_PASSWORD` | ✅ password | Must match `server.properties` |
| `MC_LOG_PATH` | | Path to `logs/latest.log`. Relative paths are resolved from this folder. The default `../minecraft-server/logs/latest.log` works with this repo's layout. |
| `STATUS_INTERVAL` | | Seconds between player-count updates (default 30) |

## Keeping it running

**Simple:** leave a terminal open with `npm start`.

**Recommended (restarts automatically and starts on boot)**, using [pm2](https://pm2.keymetrics.io/):

```bat
npm install -g pm2 pm2-windows-startup
pm2 start src/index.js --name mc-discord-bot
pm2 save
pm2-startup install
```

## Troubleshooting

| Problem | Fix |
|---|---|
| `Used disallowed intents` on startup | Turn on **Message Content Intent** in the Developer Portal (Bot tab). |
| Status says *offline* but the server is up | Check that `enable-rcon=true`, the port and the password match, and that the server was restarted after you edited `server.properties`. |
| `RCON authentication failed` | `RCON_PASSWORD` doesn't match `rcon.password`. |
| Discord → MC works, MC → Discord doesn't | `MC_LOG_PATH` is wrong, or the bot is on a different machine from the server. |
| Slash commands don't appear | Make sure the invite included the `applications.commands` scope and `GUILD_ID` is correct, then restart the bot. |
| Whitelist buttons reply "Only staff can review" | Give yourself **Manage Server** or set `ADMIN_ROLE_ID`. |
| Chat plugin changes the chat format | The relay understands vanilla/Paper `<Name> message` lines. If a chat plugin rewrites the console format, adjust the regex in `src/logTailer.js` → `parseLogLine`. |

## Project layout

```
src/
  index.js            client setup, slash-command registration, interaction routing
  config.js           .env loading and validation
  rcon.js             dependency-free RCON client (auto-reconnect, multi-packet responses)
  minecraft.js        getPlayers() / getTps() helpers
  logTailer.js        follows latest.log and parses chat/join/leave lines
  chatBridge.js       Discord <-> Minecraft relay
  presence.js         player count in the bot status
  commands/status.js
  commands/whitelist.js   /whitelist + approve/deny buttons
```
