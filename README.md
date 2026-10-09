# Mc-server

Everything for running a Minecraft survival server on Windows: the server itself, a custom plugin, a Discord bot, a website and an admin dashboard.

| Folder | What it is | Docs |
|---|---|---|
| [`minecraft-server/`](minecraft-server) | PaperMC server: `start.bat` (Aikar's flags), `backup.bat` (7-day rotation), `setup-plugins.bat` (EssentialsX, LuckPerms, GriefPrevention, Vault, CoreProtect, WorldGuard, WorldEdit), tuned `server.properties` | [README](minecraft-server/README.md) |
| [`minecraft-server/SurvivalPlus/`](minecraft-server/SurvivalPlus) | Custom Spigot/Paper plugin (Maven): skill XP from mining, farming, combat and fishing; perks (hearts, Speed, Haste); `/stats`, `/leaderboard`; SQLite storage | [README](minecraft-server/SurvivalPlus/README.md) |
| [`mc-discord-bot/`](mc-discord-bot) | discord.js v14 bot: live player count status, two-way chat bridge over RCON, `/status`, `/whitelist` requests with approve/deny buttons | [README](mc-discord-bot/README.md) |
| [`mc-website/`](mc-website) | Static site (HTML/CSS/JS): landing page with click-to-copy IP and live player count, rules, how to join, vote links, store link | [README](mc-website/README.md) |
| [`mc-admin-dashboard/`](mc-admin-dashboard) | Node.js monitoring dashboard: TPS, player, CPU and RAM charts; Discord webhook alerts; crash/hang watchdog; join/leave log | [README](mc-admin-dashboard/README.md) |

## Suggested order

1. **Server:** follow `minecraft-server/README.md` (Java 21 → `setup-plugins.bat` → EULA → `start.bat`).
2. **Plugin:** `cd minecraft-server/SurvivalPlus && mvn package`, then copy the jar into `minecraft-server/plugins/`.
3. **Dashboard + watchdog:** from now on, start the server with `npm run watchdog` in `mc-admin-dashboard`.
4. **Discord bot:** create the bot application, fill in `.env`, then `npm start`.
5. **Website:** edit `mc-website/assets/js/config.js` and deploy to GitHub Pages or Netlify.

## How the pieces connect

```
                 Discord  <───── webhook alerts ─────┐
                    ▲                                 │
     chat / status  │                                 │
                    │                                 │
            mc-discord-bot ──RCON──┐        mc-admin-dashboard ──► web UI (:8080)
                    │              ▼            │   │   │
                    └─ reads ──► minecraft-server ◄─┘   └─ watchdog runs start.bat
                       latest.log  (Paper)   query (UDP) + RCON
                                     ▲
     mc-website ── live count ── api.mcsrvstat.us  or  dashboard /api/public/status
```

Ports: **25565/TCP** is the only port to forward on your router (game). **25565/UDP** (query), **25575/TCP** (RCON) and **8080** (dashboard) should stay local.

See [ROADMAP.md](ROADMAP.md) for planned features.
