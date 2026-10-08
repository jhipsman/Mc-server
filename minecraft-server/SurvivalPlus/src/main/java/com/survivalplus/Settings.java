package com.survivalplus;

import org.bukkit.ChatColor;
import org.bukkit.Material;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.entity.EntityType;

import java.util.Collections;
import java.util.EnumMap;
import java.util.Locale;
import java.util.Map;
import java.util.NavigableMap;
import java.util.TreeMap;
import java.util.logging.Logger;

/**
 * Immutable snapshot of config.yml. A new instance is built on every reload,
 * so listeners always read a consistent set of values.
 */
public final class Settings {

    public final double globalMultiplier;
    public final boolean ignoreCreative;
    public final boolean showActionBar;

    public final boolean ignoreSilkTouch;
    private final Map<Material, Double> miningXp;
    private final Map<Material, Double> cropXp;
    private final Map<Material, Double> farmBlockXp;

    public final double spawnerMultiplier;
    public final double defaultHostileXp;
    public final double defaultPassiveXp;
    private final Map<EntityType, Double> mobXp;

    public final double fishXp;
    public final double fishingOtherXp;

    public final int maxLevel;
    public final double baseXp;
    public final double exponent;

    public final boolean heartsEnabled;
    public final int heartsEveryLevels;
    public final double heartsPerStep;
    public final double maxExtraHearts;
    public final NavigableMap<Integer, Integer> speedTiers;
    public final NavigableMap<Integer, Integer> hasteTiers;

    public final String databaseFile;
    public final int autosaveMinutes;

    public final String prefix;
    public final String msgLevelUp;
    public final String msgLevelUpBroadcast;
    public final int broadcastEvery;
    public final String msgPerkUnlocked;
    public final String msgActionBar;

    public Settings(FileConfiguration c, Logger log) {
        globalMultiplier = Math.max(0, c.getDouble("xp.global-multiplier", 1.0));
        ignoreCreative = c.getBoolean("xp.ignore-creative", true);
        showActionBar = c.getBoolean("xp.show-action-bar", true);

        ignoreSilkTouch = c.getBoolean("xp.mining.ignore-silk-touch", true);
        miningXp = materialMap(c.getConfigurationSection("xp.mining.blocks"), log);
        cropXp = materialMap(c.getConfigurationSection("xp.farming.crops"), log);
        farmBlockXp = materialMap(c.getConfigurationSection("xp.farming.blocks"), log);

        spawnerMultiplier = Math.max(0, c.getDouble("xp.mobs.spawner-multiplier", 0.25));
        defaultHostileXp = c.getDouble("xp.mobs.default-hostile", 4);
        defaultPassiveXp = c.getDouble("xp.mobs.default-passive", 0.5);
        mobXp = entityMap(c.getConfigurationSection("xp.mobs.entities"), log);

        fishXp = c.getDouble("xp.fishing.fish", 8);
        fishingOtherXp = c.getDouble("xp.fishing.other", 12);

        maxLevel = Math.max(1, c.getInt("leveling.max-level", 100));
        baseXp = Math.max(1, c.getDouble("leveling.base-xp", 100));
        exponent = Math.max(0, c.getDouble("leveling.exponent", 1.5));

        heartsEnabled = c.getBoolean("perks.extra-hearts.enabled", true);
        heartsEveryLevels = Math.max(1, c.getInt("perks.extra-hearts.every-levels", 5));
        heartsPerStep = Math.max(0, c.getDouble("perks.extra-hearts.hearts-per-step", 1));
        maxExtraHearts = Math.max(0, c.getDouble("perks.extra-hearts.max-extra-hearts", 10));
        speedTiers = c.getBoolean("perks.speed.enabled", true)
                ? tierMap(c.getConfigurationSection("perks.speed.tiers"), "speed", log) : emptyTiers();
        hasteTiers = c.getBoolean("perks.haste.enabled", true)
                ? tierMap(c.getConfigurationSection("perks.haste.tiers"), "haste", log) : emptyTiers();

        databaseFile = c.getString("storage.file", "survivalplus.db");
        autosaveMinutes = Math.max(1, c.getInt("storage.autosave-minutes", 5));

        prefix = color(c.getString("messages.prefix", "&8[&6Survival&e+&8] &r"));
        msgLevelUp = color(c.getString("messages.level-up", "&aLevel up! &7You are now level &e{level}&7."));
        msgLevelUpBroadcast = color(c.getString("messages.level-up-broadcast", "&e{player} &7reached level &6{level}&7!"));
        broadcastEvery = Math.max(0, c.getInt("messages.broadcast-every", 10));
        msgPerkUnlocked = color(c.getString("messages.perk-unlocked", "&bPerk unlocked: &f{perk}"));
        msgActionBar = color(c.getString("messages.action-bar", "&a+{xp} XP &7({source})"));
    }

    public Double miningXp(Material m) { return miningXp.get(m); }
    public Double cropXp(Material m) { return cropXp.get(m); }
    public Double farmBlockXp(Material m) { return farmBlockXp.get(m); }

    /** Blocks whose player placement must be remembered so they never give XP when broken. */
    public boolean isTrackedPlacement(Material m) {
        return miningXp.containsKey(m) || farmBlockXp.containsKey(m);
    }

    public double mobXp(EntityType type, boolean hostile) {
        Double xp = mobXp.get(type);
        if (xp != null) return xp;
        return hostile ? defaultHostileXp : defaultPassiveXp;
    }

    /** XP required to advance from {@code level} to {@code level + 1}. */
    public double xpForNextLevel(int level) {
        return Math.ceil(baseXp * Math.pow(Math.max(1, level), exponent));
    }

    public static String color(String s) {
        return ChatColor.translateAlternateColorCodes('&', s == null ? "" : s);
    }

    private static Map<Material, Double> materialMap(ConfigurationSection sec, Logger log) {
        Map<Material, Double> map = new EnumMap<>(Material.class);
        if (sec == null) return map;
        for (String key : sec.getKeys(false)) {
            Material m = Material.matchMaterial(key);
            if (m == null) {
                log.warning("Unknown material in config.yml: " + key);
                continue;
            }
            map.put(m, sec.getDouble(key));
        }
        return Collections.unmodifiableMap(map);
    }

    private static Map<EntityType, Double> entityMap(ConfigurationSection sec, Logger log) {
        Map<EntityType, Double> map = new EnumMap<>(EntityType.class);
        if (sec == null) return map;
        for (String key : sec.getKeys(false)) {
            try {
                map.put(EntityType.valueOf(key.toUpperCase(Locale.ROOT)), sec.getDouble(key));
            } catch (IllegalArgumentException e) {
                log.warning("Unknown entity type in config.yml: " + key);
            }
        }
        return Collections.unmodifiableMap(map);
    }

    private static NavigableMap<Integer, Integer> tierMap(ConfigurationSection sec, String name, Logger log) {
        TreeMap<Integer, Integer> map = new TreeMap<>();
        if (sec == null) return map;
        for (String key : sec.getKeys(false)) {
            try {
                int level = Integer.parseInt(key.trim());
                int effectLevel = sec.getInt(key);
                if (effectLevel > 0) map.put(level, effectLevel);
            } catch (NumberFormatException e) {
                log.warning("Invalid " + name + " tier level in config.yml: " + key);
            }
        }
        return Collections.unmodifiableNavigableMap(map);
    }

    private static NavigableMap<Integer, Integer> emptyTiers() {
        return Collections.unmodifiableNavigableMap(new TreeMap<>());
    }
}
