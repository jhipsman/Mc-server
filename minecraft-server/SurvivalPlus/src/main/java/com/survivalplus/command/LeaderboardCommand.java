package com.survivalplus.command;

import com.survivalplus.SurvivalPlus;
import com.survivalplus.data.PlayerSnapshot;
import com.survivalplus.level.LevelManager;
import com.survivalplus.util.Format;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabExecutor;
import org.bukkit.entity.Player;

import java.util.List;

/** /leaderboard - top 10 players by level, ties broken by lifetime XP. */
public final class LeaderboardCommand implements TabExecutor {

    private static final int SIZE = 10;
    private static final String[] MEDALS = {"§6", "§f", "§c"};

    private final SurvivalPlus plugin;
    private final LevelManager levels;

    public LeaderboardCommand(SurvivalPlus plugin, LevelManager levels) {
        this.plugin = plugin;
        this.levels = levels;
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        // Flush online players' latest progress in the same DB task so the board is live.
        List<PlayerSnapshot> pending = levels.collectSnapshots(false);
        plugin.database().top(SIZE, pending).thenAccept(top -> plugin.sync(() -> render(sender, top)))
                .exceptionally(plugin::logError);
        return true;
    }

    private void render(CommandSender sender, List<PlayerSnapshot> top) {
        sender.sendMessage("§8§m              §r §6§lSurvival§e§l+ §6Top " + SIZE + " §8§m              ");
        if (top.isEmpty()) {
            sender.sendMessage(" §7Nobody has earned any XP yet. Be the first!");
        }
        for (int i = 0; i < top.size(); i++) {
            PlayerSnapshot p = top.get(i);
            String color = i < MEDALS.length ? MEDALS[i] : "§7";
            boolean self = sender instanceof Player player && player.getUniqueId().equals(p.uuid());
            sender.sendMessage(String.format(" %s#%-2d %s%-16s §7Lvl §a%-3d §8(%s XP)",
                    color, i + 1, self ? "§e§l" : "§f", p.name(), p.level(), Format.number(p.totalXp())));
        }
        sender.sendMessage("§8§m                                                            ");
    }

    @Override
    public List<String> onTabComplete(CommandSender sender, Command command, String alias, String[] args) {
        return List.of();
    }
}
