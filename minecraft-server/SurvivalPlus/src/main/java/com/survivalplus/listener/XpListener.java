package com.survivalplus.listener;

import com.survivalplus.Settings;
import com.survivalplus.SurvivalPlus;
import com.survivalplus.level.LevelManager;
import com.survivalplus.level.XpSource;
import com.survivalplus.util.PlacedBlockTracker;
import org.bukkit.GameMode;
import org.bukkit.Material;
import org.bukkit.NamespacedKey;
import org.bukkit.Tag;
import org.bukkit.block.Block;
import org.bukkit.block.data.Ageable;
import org.bukkit.enchantments.Enchantment;
import org.bukkit.entity.Enemy;
import org.bukkit.entity.Entity;
import org.bukkit.entity.Item;
import org.bukkit.entity.LivingEntity;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.block.BlockBreakEvent;
import org.bukkit.event.block.BlockPlaceEvent;
import org.bukkit.event.entity.CreatureSpawnEvent;
import org.bukkit.event.entity.EntityDeathEvent;
import org.bukkit.event.player.PlayerFishEvent;
import org.bukkit.inventory.ItemStack;
import org.bukkit.persistence.PersistentDataType;

/** Awards XP for mining, farming, killing mobs and fishing. All handlers run at MONITOR so other plugins (claims, regions) get the final say. */
public final class XpListener implements Listener {

    private final SurvivalPlus plugin;
    private final LevelManager levels;
    private final PlacedBlockTracker placed;
    private final NamespacedKey spawnerKey;

    public XpListener(SurvivalPlus plugin, LevelManager levels, PlacedBlockTracker placed) {
        this.plugin = plugin;
        this.levels = levels;
        this.placed = placed;
        this.spawnerKey = new NamespacedKey(plugin, "from_spawner");
    }

    private Settings settings() {
        return plugin.settings();
    }

    private boolean canEarn(Player player) {
        if (!player.hasPermission("survivalplus.earn")) return false;
        if (!settings().ignoreCreative) return true;
        GameMode mode = player.getGameMode();
        return mode != GameMode.CREATIVE && mode != GameMode.SPECTATOR;
    }

    // ---- Mining & farming --------------------------------------------------

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onPlace(BlockPlaceEvent event) {
        Block block = event.getBlockPlaced();
        if (settings().isTrackedPlacement(block.getType())) placed.markPlaced(block);
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onBreak(BlockBreakEvent event) {
        Block block = event.getBlock();
        Material type = block.getType();
        Settings s = settings();

        boolean playerPlaced = s.isTrackedPlacement(type) && placed.isPlaced(block);
        if (playerPlaced) placed.unmark(block);

        Player player = event.getPlayer();
        if (playerPlaced || !canEarn(player)) return;

        Double mining = s.miningXp(type);
        if (mining != null) {
            if (s.ignoreSilkTouch && hasSilkTouch(player.getInventory().getItemInMainHand())) return;
            levels.addXp(player, mining, XpSource.MINING);
            return;
        }

        Double crop = s.cropXp(type);
        if (crop != null) {
            if (block.getBlockData() instanceof Ageable ageable && ageable.getAge() >= ageable.getMaximumAge()) {
                levels.addXp(player, crop, XpSource.FARMING);
            }
            return;
        }

        Double farmBlock = s.farmBlockXp(type);
        if (farmBlock != null) levels.addXp(player, farmBlock, XpSource.FARMING);
    }

    private static boolean hasSilkTouch(ItemStack tool) {
        return tool != null && tool.getEnchantmentLevel(Enchantment.SILK_TOUCH) > 0;
    }

    // ---- Combat ------------------------------------------------------------

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onSpawn(CreatureSpawnEvent event) {
        if (event.getSpawnReason() == CreatureSpawnEvent.SpawnReason.SPAWNER) {
            event.getEntity().getPersistentDataContainer().set(spawnerKey, PersistentDataType.BYTE, (byte) 1);
        }
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onKill(EntityDeathEvent event) {
        LivingEntity entity = event.getEntity();
        if (entity instanceof Player) return;
        Player killer = entity.getKiller();
        if (killer == null || !canEarn(killer)) return;

        double xp = settings().mobXp(entity.getType(), entity instanceof Enemy);
        if (entity.getPersistentDataContainer().has(spawnerKey, PersistentDataType.BYTE)) {
            xp *= settings().spawnerMultiplier;
        }
        levels.addXp(killer, xp, XpSource.COMBAT);
    }

    // ---- Fishing -----------------------------------------------------------

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onFish(PlayerFishEvent event) {
        if (event.getState() != PlayerFishEvent.State.CAUGHT_FISH) return;
        Player player = event.getPlayer();
        if (!canEarn(player)) return;
        Entity caught = event.getCaught();
        boolean isFish = caught instanceof Item item && Tag.ITEMS_FISHES.isTagged(item.getItemStack().getType());
        levels.addXp(player, isFish ? settings().fishXp : settings().fishingOtherXp, XpSource.FISHING);
    }
}
