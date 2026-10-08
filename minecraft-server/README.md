# minecraft-server

A PaperMC survival server set up for Windows.

| File | Purpose |
|---|---|
| `start.bat` | Starts Paper with Aikar's optimized G1GC flags (6 GB by default) |
| `backup.bat` | Copies the worlds to `backups\world-<timestamp>\` and deletes backups older than 7 days |
| `setup-plugins.bat` | Downloads the latest Paper build and plugins: EssentialsX, LuckPerms, GriefPrevention, Vault, CoreProtect, WorldGuard, WorldEdit |
| `server.properties` | Tuned for survival: normal difficulty, view distance 12, whitelist on, RCON and query enabled |
| `SurvivalPlus/` | Custom leveling/perks plugin (Maven project). See [SurvivalPlus/README.md](SurvivalPlus/README.md). |

## First-time setup

### 1. Install Java 21

Paper 1.21 needs **Java 21**. In PowerShell or Command Prompt:

```bat
winget install EclipseAdoptium.Temurin.21.JDK
```

Or download it from https://adoptium.net/. Open a **new** terminal and check that `java -version` shows 21.

### 2. Download Paper and the plugins

Double-click **`setup-plugins.bat`**. It:

- downloads the latest stable **Paper** server jar (only if there's no `paper-*.jar` yet)
- downloads the latest **EssentialsX, LuckPerms, GriefPrevention, Vault, CoreProtect, WorldEdit and WorldGuard** into `plugins\`

Re-run it any time to update. New versions are downloaded and the old jars are moved to `plugins\.old-jars\`.

```bat
setup-plugins.bat -McVersion 1.21.8   :: pin Paper and plugins to one Minecraft version
setup-plugins.bat -UpdatePaper        :: also update Paper to its newest build
```

> **Tip:** right after a new Minecraft release, plugins can take a few days to catch up. If a plugin fails to load, pin an older version with `-McVersion`.

If a download fails (for example, if a project moved its files), get it manually:
[EssentialsX](https://essentialsx.net/downloads.html) ·
[LuckPerms](https://luckperms.net/download) ·
[GriefPrevention](https://github.com/GriefPrevention/GriefPrevention/releases) ·
[Vault](https://github.com/MilkBowl/Vault/releases) ·
[CoreProtect](https://modrinth.com/plugin/coreprotect) ·
[WorldEdit](https://modrinth.com/plugin/worldedit) ·
[WorldGuard](https://modrinth.com/plugin/worldguard) ·
[Paper](https://papermc.io/downloads/paper)

### 3. Accept the EULA

Open `eula.txt`, read https://aka.ms/MinecraftEULA, and change `eula=false` to `eula=true`.

### 4. Set the RCON password and MOTD

Edit `server.properties`:

- `rcon.password=`: set a **long random password**. The Discord bot and admin dashboard use it. Never share it, and **never port-forward 25575**.
- `motd=`: your server's message in the multiplayer list. `§` is the color code symbol (`§a` = green, `§l` = bold).

### 5. Allocate RAM

Open `start.bat` and set `MIN_RAM` / `MAX_RAM`. Following Aikar's advice, keep them **equal**:

| PC RAM | Set both to |
|---|---|
| 8 GB | `4G` |
| 12 GB | `5G` |
| 16 GB+ | `6G` (default) |

Always leave at least 2-3 GB for Windows.

### 6. Start the server

Double-click **`start.bat`**. The first start generates the world and config files (this takes a minute). When you see `Done (xx.xxxs)!`, the server is up.

For automatic crash recovery, start it through the watchdog in `../mc-admin-dashboard` instead (`npm run watchdog`).

### 7. Make yourself an operator and whitelist players

Type these into the server console (no `/` needed):

```
op YourName
whitelist add YourName
whitelist add FriendName
```

The whitelist is **on** (`white-list=true`, `enforce-whitelist=true`). The Discord bot's `/whitelist` command lets players request access.

### 8. Set up permissions with LuckPerms

Minimal setup that lets regular players use the basics:

```
lp group default permission set essentials.home true
lp group default permission set essentials.sethome true
lp group default permission set essentials.spawn true
lp group default permission set essentials.tpa true
lp group default permission set essentials.tpaccept true
lp group default permission set essentials.msg true
lp group default permission set essentials.balance true
lp group default permission set essentials.pay true
lp creategroup admin
lp group admin permission set * true
lp user YourName parent add admin
```

`lp editor` opens a web editor, which is much easier for bigger changes.

### 9. Protect spawn with WorldGuard

`spawn-protection` is set to `0` because WorldGuard is more flexible. With a WorldEdit wand (`//wand`), select the spawn area, then:

```
/rg define spawn
/rg flag spawn build deny
/rg flag spawn pvp deny
/rg flag spawn mob-spawning deny
```

### 10. Let friends connect (port forwarding)

Players outside your home network need you to forward **TCP 25565** on your router to this PC's local IP (`ipconfig` → IPv4 Address). Also allow Java through Windows Firewall when prompted. **Only** forward 25565. RCON (25575) must stay private.

Give players your public IP (https://whatismyip.com) or, better, a domain name (see `../mc-website/README.md`).

## Backups

Run **`backup.bat`** manually or schedule it:

1. Open **Task Scheduler → Create Basic Task**.
2. Trigger: **Daily** (e.g. 4:00 AM). Action: **Start a program** → browse to `backup.bat`.
3. Set **Start in** to this folder.

What it does:

- Copies `world`, `world_nether` and `world_the_end` into `backups\world-YYYY-MM-DD_HH-MM-SS\`
- Deletes backup folders older than **7 days** (change `KEEP_DAYS` at the top of the script)

**Backing up while the server runs:** put [`mcrcon.exe`](https://github.com/Tiiffi/mcrcon/releases) next to `backup.bat`. The script then reads the RCON settings from `server.properties` and runs `save-off` / `save-all flush` before copying and `save-on` afterwards, so the copy is consistent. Without mcrcon, back up while the server is stopped (or accept that a running server's backup may have a few partly-written chunks).

To restore: stop the server, rename the broken `world` folders, copy the folders from a backup back into this directory, and start the server.

## What's in `server.properties`

| Setting | Value | Why |
|---|---|---|
| `difficulty` | `normal` | Standard survival |
| `view-distance` | `12` | Render distance players see |
| `simulation-distance` | `8` | Chunks that tick (mobs, crops, redstone). Lower than view distance is the biggest performance win with almost no visible difference. |
| `white-list` / `enforce-whitelist` | `true` | Only approved players. Removing someone from the whitelist kicks them immediately. |
| `spawn-protection` | `0` | Use WorldGuard for spawn instead (vanilla spawn protection blocks non-ops entirely) |
| `network-compression-threshold` | `256` | Default; good balance of CPU and bandwidth |
| `sync-chunk-writes` | `false` | Writes chunks asynchronously for smoother ticks (a common optimization; set it to `true` if you value crash safety over performance) |
| `enable-rcon` / `rcon.port` | `true` / `25575` | Used by the Discord bot, dashboard and `backup.bat` |
| `enable-query` / `query.port` | `true` / `25565` | Used by the dashboard and website for live player counts (UDP) |
| `enforce-secure-profile` | `true` | Signed chat (default) |
| `max-players` | `20` | Adjust to taste |
| `enable-command-block` | `false` | Not needed in survival |

The server rewrites this file on startup and removes the comments at the top. That's normal.

## Further Paper tuning (optional)

After the first start, these files exist. Some commonly recommended survival tweaks:

- `config/paper-world-defaults.yml`
  - `chunks.max-auto-save-chunks-per-tick: 8`
  - `entities.armor-stands.tick: false`
  - `environment.optimize-explosions: true`
  - `tick-rates.mob-spawner: 2`
  - `hopper.disable-move-event: true` *(only if no plugin needs hopper events)*
- `spigot.yml` → `entity-activation-range` defaults are fine for most servers

Paper's docs: https://docs.papermc.io/paper/reference/configuration

## Folder layout after first run

```
minecraft-server/
  start.bat  backup.bat  setup-plugins.bat  server.properties  eula.txt
  paper-1.21.x-xxx.jar
  plugins/           <- plugin jars + their configs
  world/ world_nether/ world_the_end/
  backups/           <- created by backup.bat
  logs/latest.log    <- read by the Discord bot and dashboard
  SurvivalPlus/      <- plugin source (build with Maven)
  scripts/download-plugins.ps1
```
