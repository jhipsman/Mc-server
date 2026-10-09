# Roadmap

The plan for growing the server from a solid survival base into a server with its own identity: skills, dungeons, events and a connected community.

> **Server name:** _TBD_. Shortlist: **Emberfall**, **Hearthcraft**, **Ascend SMP**.
> Once chosen, update the MOTD, website config, Discord bot and plugin messages.

**Legend:** ✅ done · 🔜 next · ⬜ planned · **[plugin]** existing plugin · **[custom]** our own code

---

## ✅ Completed: Phases 1–5

| Phase | Delivered |
|---|---|
| 1. Server foundation | `start.bat` (Aikar's flags), `backup.bat` (7-day rotation), `setup-plugins.bat`, tuned `server.properties` |
| 2. SurvivalPlus plugin | XP from mining/farming/combat/fishing, perks (hearts, Speed, Haste), `/stats`, `/leaderboard`, SQLite |
| 3. Discord bot | Live player count, two-way chat bridge, `/status`, `/whitelist` with approve/deny |
| 4. Website | Landing page, rules, how to join, vote, store link; GitHub Pages / Netlify ready |
| 5. Admin dashboard | Live TPS/player charts, Discord alerts, crash + hang watchdog, join/leave log |

---

## 🔜 Phase 0: Shakedown (before anything new)

Phases 1–5 were tested in a Linux sandbox. These parts need a first real run on the Windows host.

- [ ] Run `setup-plugins.bat` and confirm every download succeeds
- [ ] Build SurvivalPlus with `mvn package` against the real Spigot API
- [ ] Start through `npm run watchdog`; check `/stats`, `/leaderboard` and perks in game
- [ ] Dashboard shows TPS, memory and players; test alert received in Discord
- [ ] Bot: `/status`, `/whitelist` approve flow, chat both directions
- [ ] Pick the server name and replace all placeholders (MOTD, RCON password, website config, `.env` files)
- [ ] Add a GitHub Actions CI that builds the plugin and checks the Node projects on every push

---

## ⬜ Phase 6: Foundation plugins

Quick wins that make the server feel modern. Mostly install-and-configure work.

| Feature | Build | Notes |
|---|---|---|
| Voting rewards + streaks | [plugin] NuVotifier + VotingPlugin | Gives the website's vote page real rewards |
| Crates | [plugin] ExcellentCrates | Keys from votes, quests, events and dungeons |
| Bedrock crossplay | [plugin] Geyser + Floodgate | Console/phone players can join |
| Live web map | [plugin] BlueMap | Embedded on the website, with claim overlays |
| Graves | [plugin] AngelChest | Items kept safe for 10 minutes after death |
| Scoreboard + tab list | [plugin] TAB | Level, balance, online count |
| Chat upgrades | [plugin] EssentialsX Chat | Formatting, `[item]` showcase, mention sounds |
| Resource world | [plugin] Multiverse | Monthly reset; main world stays pretty |

---

## ⬜ Phase 7: SurvivalPlus v2 (signature feature)

The custom content that sets the server apart.

- [ ] **Separate skills:** Mining, Farming, Combat, Fishing, Woodcutting, Excavation, each with its own level
- [ ] **Skill perks:** double ore drops, auto-replant, lifesteal, better fishing loot
- [ ] **Active abilities** (right-click, with cooldowns): Super Breaker, Tree Feller, Berserk
- [ ] **Daily & weekly quests** with XP, money and crate-key rewards
- [ ] **Achievements & chat titles** (e.g. *[Deep Diver]*, *[Dragon Slayer]*)
- [ ] **GUI menus** for stats, skills and quests instead of chat output
- [ ] Data migration from v1 (current level → starting skill levels)

---

## ⬜ Phase 8: Community integration

Connects the game, Discord and website.

- [ ] `/link`: connect Discord and Minecraft accounts, with synced roles
- [ ] Discord `/stats <player>` and `/leaderboard` from the SurvivalPlus database
- [ ] `#milestones` channel: level-ups, achievements, dungeon clears
- [ ] Website **player profiles** (`/player/<name>`): skin, skills, playtime, titles
- [ ] Website **leaderboards page**: levels, votes, playtime, dungeon times
- [ ] Discord **ticket system** for reports, appeals and support
- [ ] Moderation from Discord (`/kick`, `/mute`, `/ban`) with a staff log

---

## ⬜ Phase 9: Economy

| Feature | Build | Notes |
|---|---|---|
| Jobs tied to skills | [custom] or [plugin] Jobs Reborn | Earn money from the same actions that give skill XP |
| Chest shops | [plugin] QuickShop-Hikari | Player-run shops |
| Auction house | [plugin] | GUI marketplace |
| Player warps | [plugin] PlayerWarps | Let players advertise their shops and builds |
| Towns / clans | [plugin] Towny or Lands | Group claims, shared bank, alliances |
| Tebex store | [plugin] Tebex | Ranks and cosmetics only (no pay-to-win), with purchase announcements in Discord |

---

## ⬜ Phase 10: Tiered dungeons & bosses

Repeatable PvE content that gives levels a purpose. Requires Phase 7 (skills and abilities make fights interesting).

### Tiers

| Tier | Unlock | Theme | Boss | Party |
|---|---|---|---|---|
| 1 | Level 10 | Abandoned mine | **Rotjaw**: giant zombie that summons adds | 1–2 |
| 2 | Level 25 | Sunken crypt | **The Drowned King**: room-flooding phase | 2–3 |
| 3 | Level 40 | Nether forge | **Cinderlord**: fire waves to dodge | 3–4 |
| 4 | Level 60 | Frozen citadel | **Frost Warden**: freezing floor slows players | 3–5 |
| 5 | Level 80 | The Void Spire | **The Hollow One**: 3 phases, arena changes | 4–5 |

### Approach: room-based procedural generation (hybrid)

- **Room templates** per theme (entrance, corridors, trap, loot, mini-boss, boss arena). AI generates the first draft of each as a schematic; a human polishes it in game.
- **Generator plugin** [custom] stitches rooms randomly per run, e.g. *Entrance → 3–6 rooms → mini-boss → 2–4 rooms → boss*. Around 15–20 rooms per tier gives hundreds of layouts.
- **Instanced:** each party gets its own copy, so there's no waiting or loot stealing.
- **Bosses and mobs:** [plugin] MythicMobs configs for phases and abilities.
- **SurvivalPlus hooks** [custom]: level gates, Combat XP, quest objectives, Discord announcements, fastest-clear leaderboards.
- **Weekly modifiers** to keep reruns fresh (e.g. *"mobs explode on death"*).

### Decisions to make

- [ ] Entry cost: keys, cooldown or both (prevents economy flooding)
- [ ] Death rules inside dungeons: keep inventory, or normal survival death
- [ ] Loot style: custom stat gear, upgrade materials, cosmetic trophies, or a mix

### Milestones

- [ ] **10a:** Tier 1 only (mine theme, ~6 rooms, Rotjaw) as a test with players
- [ ] **10b:** Generator plugin + instancing + level gates
- [ ] **10c:** Tiers 2–3
- [ ] **10d:** Tiers 4–5, leaderboards, weekly modifiers

### Risks

- RAM: each instance is a temporary world, so cap concurrent instances (important with 6 GB).
- Balance: playtest every boss with a real party before release.
- Build time: start with 2 tiers and add the rest as the player base grows.

---

## ⬜ Phase 11: Server events

| Event | Frequency | Build |
|---|---|---|
| **Blood Moon**: stronger mobs, double loot, Discord countdown | Weekly | [custom] |
| **Fishing tournament / mining race** with a live leaderboard | Weekly | [custom] |
| **World bosses**: summoned or scheduled, whole-server fights | Weekly | [plugin] MythicMobs + [custom] |
| **Double-XP weekend** (uses existing `global-multiplier`) | Monthly | [custom] small |
| **Build contests** with Discord voting | Monthly | [custom] bot |
| **Seasons**: crop growth, snow and mob changes | Rotating | [custom] |
| **Meteor showers**: rare ore drops | Random | [custom] |

---

## ⬜ Phase 12: Operations & scaling

- [ ] Off-site backups (cloud storage) + one-click restore script
- [ ] Anti-cheat [plugin] Grim, with flags piped to a staff Discord channel
- [ ] Dashboard: plugin update checker, per-world entity/chunk counts, spark profiler, console viewer, restart/backup/broadcast buttons
- [ ] Cloudflare Tunnel for the dashboard's public status endpoint
- [ ] Later: Velocity proxy with lobby, survival and minigame servers

---

## Suggested order

```
Phase 0  Shakedown + pick name
   │
Phase 6  Foundation plugins (voting, crates, crossplay, map, graves)
   │
Phase 7  SurvivalPlus v2 (skills, abilities, quests)
   │
   ├── Phase 8   Community integration  ─┐
   │                                     ├── can run in parallel
   ├── Phase 9   Economy                ─┘
   │
Phase 10 Dungeons & bosses (start with Tier 1)
   │
Phase 11 Events
   │
Phase 12 Ops & scaling (ongoing alongside everything)
```
