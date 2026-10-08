package com.survivalplus.level;

import com.survivalplus.Settings;
import com.survivalplus.SurvivalPlus;
import com.survivalplus.util.Format;
import org.bukkit.NamespacedKey;
import org.bukkit.attribute.Attribute;
import org.bukkit.attribute.AttributeInstance;
import org.bukkit.attribute.AttributeModifier;
import org.bukkit.entity.Player;
import org.bukkit.inventory.EquipmentSlotGroup;
import org.bukkit.potion.PotionEffect;
import org.bukkit.potion.PotionEffectType;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Applies level perks:
 *  - extra hearts via a namespaced MAX_HEALTH attribute modifier
 *  - Speed / Haste via infinite, particle-free potion effects
 *
 * Perk effects are identified as "ours" by being infinite + ambient + particle-free,
 * so potions and beacons are never removed by mistake.
 */
public final class PerkManager {

    private final SurvivalPlus plugin;
    private final NamespacedKey healthKey;

    public PerkManager(SurvivalPlus plugin) {
        this.plugin = plugin;
        this.healthKey = new NamespacedKey(plugin, "extra_hearts");
    }

    private Settings settings() {
        return plugin.settings();
    }

    // ---- Perk values for a level -------------------------------------------

    public double extraHearts(int level) {
        Settings s = settings();
        if (!s.heartsEnabled) return 0;
        double hearts = (level / s.heartsEveryLevels) * s.heartsPerStep;
        return Math.min(hearts, s.maxExtraHearts);
    }

    public int speedLevel(int level) {
        Map.Entry<Integer, Integer> e = settings().speedTiers.floorEntry(level);
        return e == null ? 0 : e.getValue();
    }

    public int hasteLevel(int level) {
        Map.Entry<Integer, Integer> e = settings().hasteTiers.floorEntry(level);
        return e == null ? 0 : e.getValue();
    }

    // ---- Applying ----------------------------------------------------------

    public void apply(Player player, int level) {
        applyHealth(player, extraHearts(level));
        refreshEffects(player, level);
    }

    /** Re-adds Speed/Haste if milk, death or /effect clear removed them. Cheap; runs every few seconds. */
    public void refreshEffects(Player player, int level) {
        applyEffect(player, PotionEffectType.SPEED, speedLevel(level));
        applyEffect(player, PotionEffectType.HASTE, hasteLevel(level));
    }

    private void applyHealth(Player player, double hearts) {
        AttributeInstance attr = player.getAttribute(Attribute.MAX_HEALTH);
        if (attr == null) return;
        for (AttributeModifier mod : new ArrayList<>(attr.getModifiers())) {
            if (healthKey.equals(mod.getKey())) attr.removeModifier(mod);
        }
        if (hearts > 0) {
            attr.addModifier(new AttributeModifier(healthKey, hearts * 2,
                    AttributeModifier.Operation.ADD_NUMBER, EquipmentSlotGroup.ANY));
        }
        if (player.getHealth() > attr.getValue()) player.setHealth(attr.getValue());
    }

    private void applyEffect(Player player, PotionEffectType type, int effectLevel) {
        PotionEffect current = player.getPotionEffect(type);
        boolean ours = isPerkEffect(current);
        if (effectLevel <= 0) {
            if (ours) player.removePotionEffect(type);
            return;
        }
        int amplifier = effectLevel - 1;
        if (current != null) {
            if (ours && current.getAmplifier() == amplifier) return;
            // An equal or stronger potion/beacon effect is active: leave it, the refresher re-adds ours later.
            if (!ours && current.getAmplifier() >= amplifier) return;
            if (ours) player.removePotionEffect(type);
        }
        player.addPotionEffect(new PotionEffect(type, PotionEffect.INFINITE_DURATION, amplifier, true, false, true));
    }

    private static boolean isPerkEffect(PotionEffect effect) {
        return effect != null && effect.isInfinite() && effect.isAmbient() && !effect.hasParticles();
    }

    // ---- Descriptions ------------------------------------------------------

    public List<String> describe(int level) {
        List<String> perks = new ArrayList<>();
        double hearts = extraHearts(level);
        if (hearts > 0) perks.add("§c+" + Format.number(hearts) + " ❤");
        int speed = speedLevel(level);
        if (speed > 0) perks.add("§bSpeed " + Format.roman(speed));
        int haste = hasteLevel(level);
        if (haste > 0) perks.add("§eHaste " + Format.roman(haste));
        return perks;
    }

    /** Perks gained when moving from {@code oldLevel} to {@code newLevel}. */
    public List<String> unlockedBetween(int oldLevel, int newLevel) {
        List<String> unlocked = new ArrayList<>();
        double hearts = extraHearts(newLevel) - extraHearts(oldLevel);
        if (hearts > 0) unlocked.add("+" + Format.number(hearts) + " max health heart" + (hearts == 1 ? "" : "s"));
        if (speedLevel(newLevel) > speedLevel(oldLevel)) unlocked.add("Speed " + Format.roman(speedLevel(newLevel)));
        if (hasteLevel(newLevel) > hasteLevel(oldLevel)) unlocked.add("Haste " + Format.roman(hasteLevel(newLevel)));
        return unlocked;
    }

    /** Description of the next perk a player will unlock, or null at the end of the road. */
    public String nextUnlock(int level) {
        for (int l = level + 1; l <= settings().maxLevel; l++) {
            List<String> gained = unlockedBetween(level, l);
            if (!gained.isEmpty()) return String.join(", ", gained) + " §7at level §e" + l;
        }
        return null;
    }
}
