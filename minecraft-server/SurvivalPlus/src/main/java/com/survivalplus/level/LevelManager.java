package com.survivalplus.level;

import com.survivalplus.Settings;
import com.survivalplus.SurvivalPlus;
import com.survivalplus.data.Database;
import com.survivalplus.data.PlayerData;
import com.survivalplus.data.PlayerSnapshot;
import com.survivalplus.util.Format;
import net.md_5.bungee.api.ChatMessageType;
import net.md_5.bungee.api.chat.TextComponent;
import org.bukkit.Bukkit;
import org.bukkit.Sound;
import org.bukkit.Statistic;
import org.bukkit.entity.Player;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/**
 * Owns the in-memory progress of online players and all XP / level logic.
 * Must only be used from the server main thread (except {@link #preload}).
 */
public final class LevelManager {

    private final SurvivalPlus plugin;
    private final Database database;
    private final PerkManager perks;

    private final Map<UUID, PlayerData> online = new HashMap<>();
    /** Filled on the async pre-login thread, consumed on join. */
    private final Map<UUID, PlayerData> preloaded = new ConcurrentHashMap<>();

    private boolean actionBarSupported = true;

    public LevelManager(SurvivalPlus plugin, Database database, PerkManager perks) {
        this.plugin = plugin;
        this.database = database;
        this.perks = perks;
    }

    private Settings settings() {
        return plugin.settings();
    }

    // ---- Lifecycle ---------------------------------------------------------

    /** Called from AsyncPlayerPreLoginEvent; blocking here is allowed and avoids a "not loaded yet" window. */
    public void preload(UUID uuid, String name) throws Exception {
        preloaded.put(uuid, database.load(uuid, name).get(10, TimeUnit.SECONDS));
    }

    public void discardPreload(UUID uuid) {
        preloaded.remove(uuid);
    }

    public void join(Player player) {
        PlayerData data = preloaded.remove(player.getUniqueId());
        if (data == null) {
            // Only happens for players already online during /reload or plugin enable.
            data = database.load(player.getUniqueId(), player.getName()).join();
        }
        data.setName(player.getName());
        online.put(player.getUniqueId(), data);
        perks.apply(player, data.level());
    }

    public void quit(Player player) {
        // Perks are intentionally left on the player: the health modifier is saved with
        // their player data, and removing it here would clamp their current health on every logout.
        PlayerData data = online.remove(player.getUniqueId());
        if (data == null) return;
        updatePlaytime(player, data);
        database.save(List.of(data.snapshot()));
    }

    public PlayerData get(Player player) {
        return online.get(player.getUniqueId());
    }

    public boolean isLoaded(Player player) {
        return online.containsKey(player.getUniqueId());
    }

    // ---- XP ----------------------------------------------------------------

    public void addXp(Player player, double baseAmount, XpSource source) {
        PlayerData data = online.get(player.getUniqueId());
        if (data == null || baseAmount <= 0) return;
        Settings s = settings();
        double amount = source == XpSource.ADMIN ? baseAmount : baseAmount * s.globalMultiplier;
        if (amount <= 0) return;

        int oldLevel = data.level();
        double xp = data.xp() + amount;
        int level = oldLevel;
        while (level < s.maxLevel && xp >= s.xpForNextLevel(level)) {
            xp -= s.xpForNextLevel(level);
            level++;
        }
        if (level >= s.maxLevel) xp = 0;
        data.addTotalXp(amount);
        data.setXp(xp);
        if (level != oldLevel) {
            data.setLevel(level);
            onLevelUp(player, oldLevel, level);
        }

        if (s.showActionBar) sendActionBar(player, data, amount, source);
    }

    /** Admin: set an exact level, resetting progress inside the level. */
    public void setLevel(Player player, int level) {
        PlayerData data = online.get(player.getUniqueId());
        if (data == null) return;
        int clamped = Math.max(1, Math.min(level, settings().maxLevel));
        data.setLevel(clamped);
        data.setXp(0);
        perks.apply(player, clamped);
    }

    public double progress(PlayerData data) {
        if (data.level() >= settings().maxLevel) return 1;
        return data.xp() / settings().xpForNextLevel(data.level());
    }

    private void onLevelUp(Player player, int oldLevel, int newLevel) {
        Settings s = settings();
        perks.apply(player, newLevel);
        player.sendMessage(s.prefix + s.msgLevelUp.replace("{level}", String.valueOf(newLevel)));
        player.sendTitle("§6§lLEVEL UP", "§7Level §e" + newLevel, 5, 40, 10);
        player.playSound(player.getLocation(), Sound.ENTITY_PLAYER_LEVELUP, 1f, 1.2f);
        for (String perk : perks.unlockedBetween(oldLevel, newLevel)) {
            player.sendMessage(s.prefix + s.msgPerkUnlocked.replace("{perk}", perk));
        }
        if (s.broadcastEvery > 0 && newLevel / s.broadcastEvery > oldLevel / s.broadcastEvery) {
            int milestone = (newLevel / s.broadcastEvery) * s.broadcastEvery;
            Bukkit.broadcastMessage(s.prefix + s.msgLevelUpBroadcast
                    .replace("{player}", player.getName())
                    .replace("{level}", String.valueOf(milestone)));
        }
    }

    private void sendActionBar(Player player, PlayerData data, double amount, XpSource source) {
        if (!actionBarSupported) return;
        String text = settings().msgActionBar
                .replace("{xp}", Format.number(amount))
                .replace("{source}", source.displayName())
                .replace("{level}", String.valueOf(data.level()))
                .replace("{progress}", String.valueOf((int) Math.floor(progress(data) * 100)));
        try {
            player.spigot().sendMessage(ChatMessageType.ACTION_BAR, TextComponent.fromLegacyText(text));
        } catch (NoSuchMethodError | NoClassDefFoundError | UnsupportedOperationException e) {
            actionBarSupported = false; // server build without the BungeeCord chat API
            plugin.getLogger().warning("Action bar messages are not supported on this server; disabling them.");
        }
    }

    // ---- Persistence -------------------------------------------------------

    public void refreshEffects() {
        for (Player player : Bukkit.getOnlinePlayers()) {
            PlayerData data = online.get(player.getUniqueId());
            if (data != null) perks.refreshEffects(player, data.level());
        }
    }

    public void reapplyAll() {
        for (Player player : Bukkit.getOnlinePlayers()) {
            PlayerData data = online.get(player.getUniqueId());
            if (data != null) perks.apply(player, data.level());
        }
    }

    /** Snapshots online players (all of them, or only changed ones) and marks them clean. */
    public List<PlayerSnapshot> collectSnapshots(boolean all) {
        List<PlayerSnapshot> rows = new ArrayList<>();
        for (Player player : Bukkit.getOnlinePlayers()) {
            PlayerData data = online.get(player.getUniqueId());
            if (data == null) continue;
            updatePlaytime(player, data);
            if (all || data.isDirty()) {
                rows.add(data.snapshot());
                data.markClean();
            }
        }
        return rows;
    }

    public CompletableFuture<Void> saveDirty() {
        return database.save(collectSnapshots(false));
    }

    /** Saves everyone; used on plugin disable. */
    public void shutdown() {
        List<PlayerSnapshot> rows = collectSnapshots(true);
        online.clear();
        try {
            database.save(rows).get(15, TimeUnit.SECONDS);
        } catch (Exception e) {
            plugin.getLogger().severe("Failed to save player data on shutdown: " + e);
        }
    }

    private static void updatePlaytime(Player player, PlayerData data) {
        data.setPlaytimeSeconds(player.getStatistic(Statistic.PLAY_ONE_MINUTE) / 20L);
    }

    public static long playtimeSeconds(Player player) {
        return player.getStatistic(Statistic.PLAY_ONE_MINUTE) / 20L;
    }
}
