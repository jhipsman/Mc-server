# mc-admin-dashboard

A monitoring dashboard, Discord alerting and crash watchdog for the Minecraft server. It has a Node.js backend and a plain HTML/JS frontend with Chart.js.

| Feature | Details |
|---|---|
| Polling every 30 s | **Query protocol** (UDP) for players, version and MOTD. **RCON** for TPS (`tps`), JVM heap and uptime (EssentialsX `gc`). **OS** for host CPU % and RAM. |
| Live web dashboard | Stat tiles plus TPS and player-count charts (1h / 6h / 24h), updated live over server-sent events. Shows who's online, the join/leave log, alerts and watchdog status. |
| Discord alerts | Webhook alerts when **TPS < 15** (for 2 polls in a row), when the **server goes offline**, and when it recovers. Alerts have a cooldown so a bad hour doesn't spam the channel. |
| Auto-restart watchdog | `npm run watchdog` runs `start.bat`, restarts on crash, kills and restarts on hang, and stops after repeated crashes (crash-loop protection). |
| Join/leave log | `logs/players.log` (human-readable) and `data/player-events.jsonl` (machine-readable), with session lengths. |
| Public status API | `/api/public/status` (no login, CORS enabled) feeds the website's live player count. |

## Requirements

- Node.js 18.17+ (20 or 22 LTS recommended)
- Run it on the **same PC as the Minecraft server**. The watchdog launches `start.bat`, and the CPU/RAM figures are for the machine it runs on.
- In `minecraft-server/server.properties` (Phase 1 already sets these):
  ```properties
  enable-query=true
  query.port=25565
  enable-rcon=true
  rcon.port=25575
  rcon.password=<long random password>
  ```
- **EssentialsX** for JVM heap and exact uptime. Without it, those tiles show "–" and uptime is measured from when the dashboard first saw the server online.

## Setup

```bat
cd mc-admin-dashboard
copy .env.example .env
notepad .env          :: set RCON_PASSWORD, DASHBOARD_PASSWORD, DISCORD_WEBHOOK_URL
npm install
```

To create a Discord webhook: open your staff channel → **Edit Channel → Integrations → Webhooks → New Webhook → Copy Webhook URL**, and paste it into `DISCORD_WEBHOOK_URL`.

## Running

You need two windows (or two pm2 processes):

**1. The watchdog, which starts and babysits the Minecraft server.** Use it *instead of* double-clicking `start.bat`:

```bat
npm run watchdog
```

The server console appears in this window and you can type commands as usual. A few words are handled by the watchdog itself:

| Type | Effect |
|---|---|
| `stop` | Stops the server **for real** (no restart) and exits the watchdog |
| `!restart` | Stops the server cleanly and starts it again |
| `!status` | Shows watchdog state |
| `Ctrl+C` | Same as `stop` (press twice to force-kill) |

**2. The dashboard:**

```bat
npm start
```

Then open http://localhost:8080.

### How the watchdog decides to restart

| Situation | What happens |
|---|---|
| Java exits with an error (crash) | Discord alert, restart after `RESTART_DELAY_SECONDS` |
| Someone runs `/stop` in game or from RCON | Restarts if `RESTART_ON_CLEAN_EXIT=true` (default), so `/stop` acts as a restart. Type `stop` in the watchdog window to really stop. |
| Server process alive but not answering query **or** RCON for `HANG_TIMEOUT_SECONDS` (after `STARTUP_GRACE_SECONDS`) | Kills the process tree (`taskkill /T /F`), alerts, restarts |
| More than `MAX_RESTARTS` restarts within `RESTART_WINDOW_MINUTES` | Gives up and sends a critical alert, so a broken plugin doesn't restart forever |

The watchdog runs `start.bat --nopause`, so the `pause` at the end of the script doesn't block restarts. Its state is written to `data/watchdog-state.json` and shown on the dashboard.

## Configuration (`.env`)

| Variable | Default | Description |
|---|---|---|
| `MC_HOST` | `127.0.0.1` | Server address for query and RCON |
| `QUERY_PORT` | `25565` | `query.port` |
| `RCON_PORT` / `RCON_PASSWORD` | `25575` / – | RCON connection details |
| `SERVER_DIR` | `../minecraft-server` | Folder containing `start.bat` |
| `MC_LOG_PATH` | `../minecraft-server/logs/latest.log` | If set, join/leave times come from the log (exact to the second). If empty, they're detected by comparing player lists every poll. |
| `PORT` / `HOST` | `8080` / `127.0.0.1` | Where the dashboard listens. Use `0.0.0.0` for LAN access. |
| `DASHBOARD_USER` / `DASHBOARD_PASSWORD` | `admin` / – | HTTP basic auth. **Set a password if the dashboard is reachable by anyone else.** |
| `POLL_INTERVAL_SECONDS` | `30` | Poll frequency |
| `HISTORY_HOURS` | `24` | Chart history kept (saved to `data/history.json`, survives restarts) |
| `DISCORD_WEBHOOK_URL` | – | Alerts go here. If empty, alerts only show on the dashboard. |
| `TPS_ALERT_THRESHOLD` | `15` | Low-TPS alert level |
| `TPS_ALERT_CONSECUTIVE` | `2` | Polls below the threshold before alerting (ignores one-off lag spikes) |
| `OFFLINE_CONSECUTIVE` | `2` | Failed polls before declaring the server offline |
| `ALERT_COOLDOWN_MINUTES` | `15` | Minimum gap between repeat alerts |
| `ALERT_ROLE_ID` | – | Role to @mention on critical alerts |
| `START_SCRIPT` | `start.bat` | Script the watchdog runs |
| `RESTART_DELAY_SECONDS` | `10` | Pause before restarting |
| `MAX_RESTARTS` / `RESTART_WINDOW_MINUTES` | `5` / `15` | Crash-loop protection |
| `HANG_TIMEOUT_SECONDS` | `180` | `0` disables hang detection |
| `STARTUP_GRACE_SECONDS` | `300` | World loading time before hang checks begin |
| `RESTART_ON_CLEAN_EXIT` | `true` | See the table above |

## Run on boot (Windows)

With [pm2](https://pm2.keymetrics.io/):

```bat
npm install -g pm2 pm2-windows-startup
pm2 start src/server.js --name mc-dashboard
pm2 save
pm2-startup install
```

Run the **watchdog** in a normal console window instead of under pm2, so you can type server commands into it. To start it at login, create a shortcut in `shell:startup` with:

- Target: `cmd /k "cd /d C:\path\to\mc-admin-dashboard && npm run watchdog"`

## Using the public status endpoint on the website

`GET /api/public/status` returns the same JSON shape as api.mcsrvstat.us:

```json
{ "online": true, "version": "1.21.8", "players": { "online": 3, "max": 20, "list": [{ "name": "Steve" }] } }
```

To use it from the website, it must be reachable over **HTTPS** from the internet. GitHub Pages and Netlify sites are HTTPS, and browsers block calls from them to plain HTTP. The easiest option is a [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) that exposes only that path. Then set `statusApi` in `mc-website/assets/js/config.js` to `https://your-tunnel-domain/api/public/status`.

Don't expose the rest of the dashboard publicly without a password.

## API

| Endpoint | Auth | Returns |
|---|---|---|
| `GET /api/status` | ✅ | latest sample, server info, online players, watchdog state |
| `GET /api/history?hours=6` | ✅ | samples for the charts |
| `GET /api/players?limit=100` | ✅ | recent join/leave events |
| `GET /api/alerts` | ✅ | recent alerts |
| `GET /api/stream` | ✅ | server-sent events: `sample`, `player`, `alert` |
| `GET /api/public/status` | – | public status (CORS) |

## Files

```
src/server.js        Express server, auth, API, SSE
src/poller.js        30 s poll loop + alert rules
src/watchdog.js      start.bat runner with crash/hang restarts
src/query.js         Minecraft query protocol client (UDP)
src/rcon.js          RCON client
src/minecraft.js     parsers for tps / gc / list output
src/hostMetrics.js   CPU and RAM
src/alerts.js        Discord webhook sender with cooldowns
src/store.js         history, join/leave log and alert persistence
public/              dashboard UI
data/                history.json, player-events.jsonl, alerts.json, watchdog-state.json (generated)
logs/players.log     human-readable join/leave log (generated)
```
