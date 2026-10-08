package com.survivalplus.command;

import com.survivalplus.Settings;
import com.survivalplus.SurvivalPlus;
import com.survivalplus.data.PlayerData;
import com.survivalplus.data.PlayerSnapshot;
import com.survivalplus.level.LevelManager;
import com.survivalplus.level.PerkManager;
import com.survivalplus.util.Format;
import org.bukkit.Bukkit;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabExecutor;
import org.bukkit.entity.Player;

import java.util.List;

/** /stats [player] */
public final class StatsCommand implements TabExecutor {

    private final SurvivalPlus plugin;
    private final LevelManager levels;
    private final PerkManager perks;

    public StatsCommand(SurvivalPlus plugin, LevelManager levels, PerkManager perks) {
        this.plugin = plugin;
        this.levels = levels;
        this.perks = perks;
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        Settings s = plugin.settings();

        if (args.length == 0) {
            if (!(sender instanceof Player player)) {
                sender.sendMessage("Usage: /" + label + " <player>");
                return true;
            }
            showOnline(sender, player);
            return true;
        }

        if (!sender.hasPermission("survivalplus.stats.others")) {
            sender.sendMessage(s.prefix + "§cYou don't have permission to view other players' stats.");
            return true;
        }

        Player target = Bukkit.getPlayerExact(args[0]);
        if (target != null && levels.isLoaded(target)) {
            showOnline(sender, target);
            return true;
        }

        // Offline player: look them up in the database without blocking the main thread.
        plugin.database().findByName(args[0]).thenAccept(found -> plugin.sync(() -> {
            if (found.isEmpty()) {
                sender.sendMessage(s.prefix + "§cNo stats found for §f" + args[0] + "§c.");
                return;
            }
            plugin.database().rank(found.get()).thenAccept(rank -> plugin.sync(() ->
                    show(sender, found.get(), found.get().playtimeSeconds(), rank, false)))
                    .exceptionally(plugin::logError);
        })).exceptionally(plugin::logError);
        return true;
    }

    private void showOnline(CommandSender sender, Player player) {
        PlayerData data = levels.get(player);
        if (data == null) {
            sender.sendMessage(plugin.settings().prefix + "§cStats are still loading, try again in a second.");
            return;
        }
        PlayerSnapshot snap = data.snapshot();
        long playtime = LevelManager.playtimeSeconds(player);
        plugin.database().rank(snap).thenAccept(rank -> plugin.sync(() -> show(sender, snap, playtime, rank, true)))
                .exceptionally(plugin::logError);
    }

    private void show(CommandSender sender, PlayerSnapshot p, long playtime, int rank, boolean online) {
        Settings s = plugin.settings();
        boolean maxed = p.level() >= s.maxLevel;
        double needed = s.xpForNextLevel(p.level());
        double fraction = maxed ? 1 : p.xp() / needed;

        sender.sendMessage("§8§m                    §r §6§lSurvival§e§l+ §6Stats §8§m                    ");
        sender.sendMessage(" §7Player: §f" + p.name() + (online ? " §a●" : " §8●"));
        sender.sendMessage(" §7Level: §a" + p.level() + " §8/ §7" + s.maxLevel + "   §7Rank: §6#" + rank);
        if (maxed) {
            sender.sendMessage(" §7XP: §6§lMAX LEVEL");
        } else {
            sender.sendMessage(" §7XP: §e" + Format.number(p.xp()) + " §8/ §e" + Format.number(needed)
                    + " §7(" + (int) Math.floor(fraction * 100) + "%)");
        }
        sender.sendMessage(" " + Format.bar(fraction, 30));
        sender.sendMessage(" §7Total XP earned: §f" + Format.number(p.totalXp()));
        sender.sendMessage(" §7Time played: §f" + Format.duration(playtime));
        List<String> active = perks.describe(p.level());
        sender.sendMessage(" §7Perks: " + (active.isEmpty() ? "§8none yet" : String.join("§7, ", active)));
        String next = perks.nextUnlock(p.level());
        if (next != null) sender.sendMessage(" §7Next perk: §f" + next);
        sender.sendMessage("§8§m                                                                      ");
    }

    @Override
    public List<String> onTabComplete(CommandSender sender, Command command, String alias, String[] args) {
        if (args.length == 1 && sender.hasPermission("survivalplus.stats.others")) {
            String prefix = args[0].toLowerCase();
            return Bukkit.getOnlinePlayers().stream()
                    .map(Player::getName)
                    .filter(n -> n.toLowerCase().startsWith(prefix))
                    .toList();
        }
        return List.of();
    }
}
