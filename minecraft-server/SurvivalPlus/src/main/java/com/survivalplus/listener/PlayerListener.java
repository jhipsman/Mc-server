package com.survivalplus.listener;

import com.survivalplus.SurvivalPlus;
import com.survivalplus.data.PlayerData;
import com.survivalplus.level.LevelManager;
import com.survivalplus.level.PerkManager;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.AsyncPlayerPreLoginEvent;
import org.bukkit.event.player.PlayerItemConsumeEvent;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerLoginEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.event.player.PlayerRespawnEvent;

import java.util.logging.Level;

public final class PlayerListener implements Listener {

    private final SurvivalPlus plugin;
    private final LevelManager levels;
    private final PerkManager perks;

    public PlayerListener(SurvivalPlus plugin, LevelManager levels, PerkManager perks) {
        this.plugin = plugin;
        this.levels = levels;
        this.perks = perks;
    }

    /** Load progress off the main thread before the player is in the world. */
    @EventHandler(priority = EventPriority.MONITOR)
    public void onPreLogin(AsyncPlayerPreLoginEvent event) {
        if (event.getLoginResult() != AsyncPlayerPreLoginEvent.Result.ALLOWED) return;
        try {
            levels.preload(event.getUniqueId(), event.getName());
        } catch (Exception e) {
            plugin.getLogger().log(Level.SEVERE, "Could not load data for " + event.getName(), e);
            event.disallow(AsyncPlayerPreLoginEvent.Result.KICK_OTHER,
                    "§cSurvivalPlus could not load your progress. Please try again in a moment.");
        }
    }

    /** Whitelist/ban checks happen after pre-login; drop the preload if the login was refused. */
    @EventHandler(priority = EventPriority.MONITOR)
    @SuppressWarnings("deprecation") // PlayerLoginEvent is still the only post-whitelist hook on Spigot
    public void onLogin(PlayerLoginEvent event) {
        if (event.getResult() != PlayerLoginEvent.Result.ALLOWED) {
            levels.discardPreload(event.getPlayer().getUniqueId());
        }
    }

    @EventHandler(priority = EventPriority.LOWEST)
    public void onJoin(PlayerJoinEvent event) {
        levels.join(event.getPlayer());
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onQuit(PlayerQuitEvent event) {
        levels.quit(event.getPlayer());
    }

    /** Death and milk clear potion effects; re-apply perk effects a tick later. */
    @EventHandler(priority = EventPriority.MONITOR)
    public void onRespawn(PlayerRespawnEvent event) {
        reapplyLater(event.getPlayer());
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onConsume(PlayerItemConsumeEvent event) {
        if (event.getItem().getType() == Material.MILK_BUCKET) reapplyLater(event.getPlayer());
    }

    private void reapplyLater(Player player) {
        plugin.getServer().getScheduler().runTaskLater(plugin, () -> {
            if (!player.isOnline()) return;
            PlayerData data = levels.get(player);
            if (data != null) perks.refreshEffects(player, data.level());
        }, 2L);
    }
}
