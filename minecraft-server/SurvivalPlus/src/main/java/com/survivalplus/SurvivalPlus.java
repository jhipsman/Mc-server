package com.survivalplus;

import com.survivalplus.command.AdminCommand;
import com.survivalplus.command.LeaderboardCommand;
import com.survivalplus.command.StatsCommand;
import com.survivalplus.data.Database;
import com.survivalplus.level.LevelManager;
import com.survivalplus.level.PerkManager;
import com.survivalplus.listener.PlayerListener;
import com.survivalplus.listener.XpListener;
import com.survivalplus.util.PlacedBlockTracker;
import org.bukkit.Bukkit;
import org.bukkit.command.PluginCommand;
import org.bukkit.command.TabExecutor;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.File;
import java.util.logging.Level;

public final class SurvivalPlus extends JavaPlugin {

    private volatile Settings settings;
    private Database database;
    private LevelManager levels;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        settings = new Settings(getConfig(), getLogger());

        database = new Database(getLogger());
        try {
            database.open(new File(getDataFolder(), settings.databaseFile));
        } catch (Exception e) {
            getLogger().log(Level.SEVERE, "Could not open the SQLite database - disabling SurvivalPlus", e);
            getServer().getPluginManager().disablePlugin(this);
            return;
        }

        PerkManager perks = new PerkManager(this);
        levels = new LevelManager(this, database, perks);

        getServer().getPluginManager().registerEvents(new PlayerListener(this, levels, perks), this);
        getServer().getPluginManager().registerEvents(new XpListener(this, levels, new PlacedBlockTracker(this)), this);

        register("stats", new StatsCommand(this, levels, perks));
        register("leaderboard", new LeaderboardCommand(this, levels));
        register("survivalplus", new AdminCommand(this, levels));

        // Players already online (e.g. after /reload)
        for (Player player : Bukkit.getOnlinePlayers()) levels.join(player);

        long autosaveTicks = settings.autosaveMinutes * 60L * 20L;
        Bukkit.getScheduler().runTaskTimer(this, () -> levels.saveDirty().exceptionally(this::logError),
                autosaveTicks, autosaveTicks);
        // Re-apply Speed/Haste if something removed them (milk, /effect clear, ...)
        Bukkit.getScheduler().runTaskTimer(this, levels::refreshEffects, 100L, 100L);

        getLogger().info("SurvivalPlus enabled - max level " + settings.maxLevel);
    }

    @Override
    public void onDisable() {
        if (levels != null) levels.shutdown();
        if (database != null) database.close();
    }

    private void register(String name, TabExecutor executor) {
        PluginCommand command = getCommand(name);
        if (command == null) {
            getLogger().severe("Command /" + name + " missing from plugin.yml");
            return;
        }
        command.setExecutor(executor);
        command.setTabCompleter(executor);
    }

    public void reloadSettings() {
        reloadConfig();
        settings = new Settings(getConfig(), getLogger());
        levels.reapplyAll();
    }

    public Settings settings() {
        return settings;
    }

    public Database database() {
        return database;
    }

    /** Runs a task on the main thread (used for database callbacks). */
    public void sync(Runnable task) {
        if (Bukkit.isPrimaryThread()) {
            task.run();
        } else if (isEnabled()) {
            Bukkit.getScheduler().runTask(this, task);
        }
    }

    public <T> T logError(Throwable error) {
        getLogger().log(Level.SEVERE, "Database task failed", error);
        return null;
    }
}
