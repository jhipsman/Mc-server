# Roadmap

The plan for growing the server from a solid survival base into a server with its own identity: skills, dungeons, raids, loot, events and a connected community.

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

## ⬜ Phase 6: Foundation, growth & protection

Quick wins that make the server feel modern and bring in players, plus the protection that has to be in place before valuable loot exists.

| Feature | Build | Notes |
|---|---|---|
| Voting rewards + streaks | [plugin] NuVotifier + VotingPlugin | Gives the website's vote page real rewards and helps grow the player base |
| Crates | [plugin] ExcellentCrates | Keys from votes, quests, events, dungeons and raids |
| Bedrock crossplay | [plugin] Geyser + Floodgate | Console/phone players can join; the biggest boost to reach |
| Live web map | [plugin] BlueMap | Embedded on the website, with claim overlays |
| Graves | [plugin] AngelChest | Items kept safe for 10 minutes after death |
| Scoreboard + tab list | [plugin] TAB | Level, balance, online count |
| Chat upgrades | [plugin] EssentialsX Chat | Formatting, `[item]` showcase, mention sounds |
| Resource world | [plugin] Multiverse | Monthly reset; main world stays pretty |
| **Anti-cheat** | [plugin] Grim | Flags go to a staff Discord channel. Must exist before loot and leaderboards do. |
| **Off-site backups** | [custom] script | Scheduled upload to cloud storage + one-click restore |

### Optional: Tier 1 dungeon prototype

Build **Tier 1 only** (abandoned mine + Rotjaw, about 6 rooms, solo/duo, simple loot table) right after Phase 6. It answers three questions before the big investment in Phase 9:

- [ ] Do players actually enjoy the dungeons?
- [ ] How do AI-generated rooms look in game, and how much polish do they need?
- [ ] How much RAM does one instance cost?

---

## ⬜ Phase 7: SurvivalPlus v2 + item framework (signature feature)

The custom content that sets the server apart, and the item system that all loot is built on.

### Skills

- [ ] **Separate skills:** Mining, Farming, Combat, Fishing, Woodcutting, Excavation, each with its own level
- [ ] **Skill perks:** double ore drops, auto-replant, lifesteal, better fishing loot
- [ ] **Active abilities** (right-click, with cooldowns): Super Breaker, Tree Feller, Berserk
- [ ] **Daily & weekly quests** with XP, money and crate-key rewards
- [ ] **Achievements & chat titles** (e.g. *[Deep Diver]*, *[Dragon Slayer]*)
- [ ] **GUI menus** for stats, skills and quests instead of chat output
- [ ] Data migration from v1 (current level → starting skill levels)

### Item framework (required before dungeons)

- [ ] **Rarity tiers:** Common ⚪, Uncommon 🟢, Rare 🔵, Epic 🟣, Legendary 🟠, Mythic 🔴
- [ ] **Stats on items:** damage, defense, skill XP bonuses, special effects (e.g. *slows target 1s*)
- [ ] **Armor set bonuses** (2-piece / 4-piece)
- [ ] **Upgrades** (+1 to +10) and **stat rerolls** using upgrade materials
- [ ] **Soulbound** flag (can't be traded or dropped)
- [ ] **Level requirements** tied to skills (e.g. Combat 40 to equip Epic weapons)
- [ ] **Durability & repair costs** to take money out of circulation
- [ ] Item data stored in the item's persistent data, so it survives restarts and trades
- [ ] Loot tables defined in **config files**, so drop rates can be tuned without recompiling

---

## ⬜ Phase 8: Economy core

Loot only matters if players can trade it, so the core economy comes before dungeons.

| Feature | Build | Notes |
|---|---|---|
| Jobs tied to skills | [custom] or [plugin] Jobs Reborn | Earn money from the same actions that give skill XP |
| Chest shops | [plugin] QuickShop-Hikari | Player-run shops |
| Auction house | [plugin] | GUI marketplace for dungeon gear and materials |
| Player warps | [plugin] PlayerWarps | Let players advertise their shops and builds |
| Tebex store | [plugin] Tebex | Ranks and cosmetics only (no pay-to-win), with purchase announcements in Discord |

Towns / clans ([plugin] Towny or Lands) are nice to have and can be added any time after this phase.

---

## ⬜ Phase 9: Dungeons, raids & loot

Repeatable PvE content that gives levels and gear a purpose. **Requires Phases 6–8:** anti-cheat, skills/abilities, the item framework and a working economy.

### Dungeons vs. raids

| | Dungeons | Raids |
|---|---|---|
| Party size | 1–5 | 6–15 |
| Length | 10–25 min | 45–90 min, multiple bosses |
| Frequency | Anytime (keys and/or cooldown) | **Weekly lockout:** loot once per week |
| Loot | Steady upgrades, materials, set pieces | Best-in-game gear, rare cosmetics, titles |

### Dungeon tiers

| Tier | Unlock | Theme | Boss | Party | Armor set |
|---|---|---|---|---|---|
| 1 | Level 10 | Abandoned mine | **Rotjaw**: giant zombie that summons adds | 1–2 | *Miner's Garb* |
| 2 | Level 25 | Sunken crypt | **The Drowned King**: room-flooding phase | 2–3 | *Drowned Regalia* |
| 3 | Level 40 | Nether forge | **Cinderlord**: fire waves to dodge | 3–4 | *Cinder Plate* |
| 4 | Level 60 | Frozen citadel | **Frost Warden**: freezing floor slows players | 3–5 | *Frostbound Mail* |
| 5 | Level 80 | The Void Spire | **The Hollow One**: 3 phases, arena changes | 4–5 | *Hollow Shroud* |

### Raids

| Raid | Unlock | Bosses | Party |
|---|---|---|---|
| **Siege of the Void Spire** | Level 80 + Tier 5 clear | 4 bosses, ending in an empowered Hollow One | 6–15 |
| *(more raids added per season)* | | | |

### Loot system

**Types of loot**

1. **Gear with stats:** weapons, armor and tools with random bonuses
2. **Armor sets** with set bonuses, one theme per dungeon (e.g. *Drowned Regalia*: 2 pieces = water breathing, 4 pieces = faster swimming + Conduit Power)
3. **Upgrade materials** (*Rusted Gears*, *Frozen Cores*, *Void Shards*) for upgrades and rerolls, so lower-rarity drops stay useful
4. **Boss trophies:** decorative heads and banners
5. **Cosmetics:** particle trails, chat titles, pet companions (rarest from raids)
6. **Utility:** crate keys, money, skill XP boosts, keys for the next tier

**Drop rules**

- **Personal loot:** each player rolls their own drops, so there's no loot stealing or arguing
- **Bad-luck protection:** each failed roll slightly raises the chance at the boss's rare item
- **Guaranteed + chance drops:** every boss always drops materials, plus a chance at gear
- **First clear bonus:** guaranteed Rare or better the first time a player beats each boss
- **Weekly modifiers** give extra loot rolls on harder runs

**Rarity by source**

| Rarity | Source |
|---|---|
| ⚪ Common | Dungeon mobs, chests |
| 🟢 Uncommon | Tier 1–2 bosses |
| 🔵 Rare | Tier 2–4 bosses |
| 🟣 Epic | Tier 4–5 bosses, raids |
| 🟠 Legendary | Raid final bosses (very low drop rate) |
| 🔴 Mythic | One-of-a-kind: server-first raid clears, season rewards |

**Example: Tier 1 loot table (abandoned mine)**

| Source | Drop | Chance |
|---|---|---|
| Mobs | Coal, iron, Rusted Gear | Common |
| Loot room chests | Money, XP boost, crate key | 30% key |
| **Rotjaw** | 2–4 Rusted Gears | 100% |
| | 🟢 Miner's Helm (Mining XP +5%) | 20% |
| | 🔵 Rotjaw's Cleaver | 5% |
| | Rotjaw head trophy | 1% |
| | Title: *[Mine Delver]* | First clear |

**Economy balance**

- [ ] **Raid loot is soulbound**; dungeon gear and materials stay tradeable for shops and the auction house
- [ ] **Durability and repair costs** keep gear from flooding the server
- [ ] **Stat bonuses are stronger inside dungeons** than in the open world, so normal survival stays balanced
- [ ] Optional **seasonal resets** for Mythic items and leaderboards (regular gear is kept)

### Build approach: room-based procedural generation (hybrid)

- **Room templates** per theme (entrance, corridors, trap, loot, mini-boss, boss arena). AI generates the first draft of each as a schematic; a human polishes it in game.
- **Generator plugin** [custom] stitches rooms randomly per run, e.g. *Entrance → 3–6 rooms → mini-boss → 2–4 rooms → boss*. Around 15–20 rooms per tier gives hundreds of layouts. Raids use larger, hand-polished fixed layouts.
- **Instanced:** each party gets its own copy, so there's no waiting or loot stealing.
- **Bosses and mobs:** [plugin] MythicMobs configs for phases and abilities; drops handled by our loot tables.
- **SurvivalPlus hooks** [custom]: level gates, Combat XP, quest objectives, Discord announcements, fastest-clear leaderboards.
- **Weekly modifiers** keep reruns fresh (e.g. *"mobs explode on death"*).

### Decisions to make

- [ ] Entry cost: keys, cooldown or both
- [ ] Death rules inside dungeons/raids: keep inventory, or normal survival death
- [ ] Raid lockout: per player or per group
- [ ] Seasonal resets: yes/no, and what resets

### Milestones

- [ ] **9a:** Generator plugin + instancing + level gates + loot tables (rebuild the Tier 1 prototype on it)
- [ ] **9b:** Tiers 2–3 with their armor sets
- [ ] **9c:** Tiers 4–5, leaderboards, weekly modifiers
- [ ] **9d:** First raid: *Siege of the Void Spire*

### Risks

- **RAM:** each instance is a temporary world, so cap concurrent instances (about 2–3 on a 6 GB server; raids count extra).
- **Balance:** playtest every boss with a real party before release.
- **Player count:** raids need 6+ players online together. Launch them once there are regular groups that size.
- **Build time:** start with 2–3 tiers and add the rest as the player base grows.

---

## ⬜ Phase 10: Community integration

Connects the game, Discord and website. Can run alongside Phase 9.

- [ ] `/link`: connect Discord and Minecraft accounts, with synced roles
- [ ] Discord `/stats <player>` and `/leaderboard` from the SurvivalPlus database
- [ ] `#milestones` channel: level-ups, achievements, dungeon and raid clears (*worth adding early, alongside Phase 9*)
- [ ] `#loot-drops` channel: *"🟠 Steve got **Hollow Crown** (Legendary) from The Hollow One!"*
- [ ] Website **player profiles** (`/player/<name>`): skin, skills, playtime, best gear, trophies, titles
- [ ] Website **leaderboards page**: levels, votes, playtime, fastest dungeon clears, raid clears
- [ ] Discord **ticket system** for reports, appeals and support
- [ ] Moderation from Discord (`/kick`, `/mute`, `/ban`) with a staff log

---

## ⬜ Phase 11: Server events

| Event | Frequency | Build |
|---|---|---|
| **Blood Moon**: stronger mobs, double loot, Discord countdown | Weekly | [custom] |
| **Fishing tournament / mining race** with a live leaderboard | Weekly | [custom] |
| **World bosses**: summoned or scheduled, whole-server fights, shared loot table | Weekly | [plugin] MythicMobs + [custom] |
| **Double-XP weekend** (uses existing `global-multiplier`) | Monthly | [custom] small |
| **Build contests** with Discord voting | Monthly | [custom] bot |
| **Seasons**: crop growth, snow and mob changes | Rotating | [custom] |
| **Meteor showers**: rare ore drops | Random | [custom] |

---

## ⬜ Phase 12: Operations & scaling

Anti-cheat and off-site backups moved to Phase 6. The rest is ongoing:

- [ ] Dashboard: plugin update checker, per-world entity/chunk counts, active dungeon instances, spark profiler, console viewer, restart/backup/broadcast buttons
- [ ] Cloudflare Tunnel for the dashboard's public status endpoint
- [ ] RAM/hardware review once dungeons and raids are live
- [ ] Later: Velocity proxy with lobby, survival and minigame servers

---

## Suggested order

```
Phase 0   Shakedown + pick name
   │
Phase 6   Foundation, growth & protection
          (voting, crates, crossplay, map, graves, anti-cheat, off-site backups)
   │
   └── optional: Tier 1 dungeon prototype (mine + Rotjaw)
   │
Phase 7   SurvivalPlus v2 + item framework
          (skills, abilities, quests, rarity, stats, sets, upgrades)
   │
Phase 8   Economy core (jobs, chest shops, auction house, store)
   │
Phase 9   Dungeons, raids & loot ──┐
                                   ├── run in parallel
Phase 10  Community integration ───┘
   │
Phase 11  Events
   │
Phase 12  Ops & scaling (ongoing alongside everything)
```
