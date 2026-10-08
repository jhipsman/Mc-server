# SurvivalPlus

A custom Spigot/Paper plugin that adds a skill-leveling system to survival.

- **XP from mining, farming, mob kills and fishing**, with every rate configurable in `config.yml`
- **Level perks:** extra hearts, Speed and Haste, unlocked at configurable levels
- **`/stats [player]`:** level, XP progress bar, rank, lifetime XP, time played, active perks and the next unlock
- **`/leaderboard`:** top 10 players by level (ties broken by lifetime XP)
- **SQLite storage** (`plugins/SurvivalPlus/survivalplus.db`), so progress survives restarts

## Building

Requires **JDK 21** and **Maven 3.9+**.

```bat
cd SurvivalPlus
mvn package
copy target\SurvivalPlus-1.0.0.jar ..\plugins\
```

Then restart the server. The plugin targets the Spigot API 1.21.4 (`api-version: 1.21`) and runs on **Paper or Spigot 1.21.4 and newer**. To build against a different API version, change `spigot.version` in `pom.xml`.

Installing JDK 21 and Maven on Windows:

```bat
winget install EclipseAdoptium.Temurin.21.JDK
winget install Apache.Maven
```

You can also open the folder in IntelliJ IDEA (it detects the Maven project) and run the `package` goal.

## Commands & permissions

| Command | Aliases | Permission | Default |
|---|---|---|---|
| `/stats` | `/level`, `/skills` | `survivalplus.stats` | everyone |
| `/stats <player>` (works for offline players too) | | `survivalplus.stats.others` | everyone |
| `/leaderboard` | `/lb`, `/top` | `survivalplus.leaderboard` | everyone |
| `/survivalplus reload` | `/splus` | `survivalplus.admin` | op |
| `/survivalplus setlevel <player> <level>` | | `survivalplus.admin` | op |
| `/survivalplus addxp <player> <amount>` | | `survivalplus.admin` | op |
| *(earning XP at all)* | | `survivalplus.earn` | everyone |

With LuckPerms, for example: `lp group default permission set survivalplus.stats.others false`.

## How XP works

| Source | Rule |
|---|---|
| Mining | Blocks listed in `xp.mining.blocks`. **Player-placed blocks never give XP** (tracked in each chunk's persistent data, so it survives restarts), and silk-touching an ore gives none by default. |
| Farming | Crops in `xp.farming.crops` only count when **fully grown**. Melons and pumpkins count unless a player placed them. |
| Combat | Per-mob values in `xp.mobs.entities`. Unlisted mobs use `default-hostile` or `default-passive`. Mobs from **spawners** give `spawner-multiplier` × XP (default 25%) so mob grinders don't dominate. |
| Fishing | `fish` for cod/salmon/pufferfish/tropical fish, `other` for treasure and junk |

Everything is multiplied by `xp.global-multiplier` (set it to 2.0 for a double-XP weekend), and players in creative or spectator mode earn nothing.

**Level curve:** going from level *N* to *N+1* costs `base-xp × N^exponent`. With the defaults (100, 1.5): level 2 costs 100 XP, level 11 costs 3,162 XP, level 51 costs 35,355 XP. The max level is 100.

## Perks (defaults)

| Perk | Rule |
|---|---|
| Extra hearts | +1 heart every 5 levels, up to +10 (a namespaced `max_health` attribute modifier) |
| Speed | Speed I at level 10, Speed II at level 40 |
| Haste | Haste I at level 15, Haste II at level 50 |

Speed and Haste are infinite, particle-free effects. If milk, death or `/effect clear` removes them, they're re-applied within a few seconds. Stronger potions and beacon effects are never overwritten.

**Uninstalling:** extra hearts are stored on the player as the modifier `survivalplus:extra_hearts`. If you remove the plugin, either set `perks.extra-hearts.enabled: false` and run `/survivalplus reload` while players are online first, or remove the modifier manually:

```
/attribute <player> minecraft:max_health modifier remove survivalplus:extra_hearts
```

## Storage

- One `players` table: `uuid, name, level, xp, total_xp, playtime_seconds, last_seen`
- Data is loaded during async pre-login (before the player spawns), saved on quit, autosaved every `storage.autosave-minutes`, and flushed on shutdown.
- All queries run on a dedicated database thread, so the main server thread never waits on disk.
- The SQLite JDBC driver ships with Spigot and Paper, so nothing extra needs to be installed.
- Time played comes from Minecraft's own `play_one_minute` statistic, so it includes time played before the plugin was installed.

## Code layout

```
src/main/java/com/survivalplus/
  SurvivalPlus.java          plugin entry point, scheduling, reload
  Settings.java              immutable snapshot of config.yml
  data/Database.java         SQLite access on a single background thread
  data/PlayerData.java       mutable per-player progress (main thread only)
  data/PlayerSnapshot.java   immutable copy handed to the DB thread
  level/LevelManager.java    XP gain, level-ups, saving
  level/PerkManager.java     hearts / Speed / Haste
  level/XpSource.java
  listener/XpListener.java   mining, farming, combat, fishing
  listener/PlayerListener.java  load/save on login/quit, re-apply effects
  command/StatsCommand.java, LeaderboardCommand.java, AdminCommand.java
  util/PlacedBlockTracker.java  anti place-and-mine exploit
  util/Format.java
src/main/resources/plugin.yml, config.yml
```
