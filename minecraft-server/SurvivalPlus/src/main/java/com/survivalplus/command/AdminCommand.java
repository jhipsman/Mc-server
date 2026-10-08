package com.survivalplus.command;

import com.survivalplus.SurvivalPlus;
import com.survivalplus.level.LevelManager;
import com.survivalplus.level.XpSource;
import org.bukkit.Bukkit;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabExecutor;
import org.bukkit.entity.Player;

import java.util.List;

/** /survivalplus reload | setlevel <player> <level> | addxp <player> <amount> */
public final class AdminCommand implements TabExecutor {

    private final SurvivalPlus plugin;
    private final LevelManager levels;

    public AdminCommand(SurvivalPlus plugin, LevelManager levels) {
        this.plugin = plugin;
        this.levels = levels;
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        String prefix = plugin.settings().prefix;
        if (args.length == 0) {
            sender.sendMessage(prefix + "§7Usage: /" + label + " <reload|setlevel|addxp>");
            return true;
        }
        switch (args[0].toLowerCase()) {
            case "reload" -> {
                plugin.reloadSettings();
                sender.sendMessage(prefix + "§aConfig reloaded.");
            }
            case "setlevel", "addxp" -> {
                if (args.length < 3) {
                    sender.sendMessage(prefix + "§7Usage: /" + label + " " + args[0] + " <player> <amount>");
                    return true;
                }
                Player target = Bukkit.getPlayerExact(args[1]);
                if (target == null || !levels.isLoaded(target)) {
                    sender.sendMessage(prefix + "§cPlayer must be online.");
                    return true;
                }
                double amount;
                try {
                    amount = Double.parseDouble(args[2]);
                } catch (NumberFormatException e) {
                    sender.sendMessage(prefix + "§c'" + args[2] + "' is not a number.");
                    return true;
                }
                if (args[0].equalsIgnoreCase("setlevel")) {
                    levels.setLevel(target, (int) amount);
                    sender.sendMessage(prefix + "§aSet " + target.getName() + " to level " + levels.get(target).level() + ".");
                } else {
                    levels.addXp(target, amount, XpSource.ADMIN);
                    sender.sendMessage(prefix + "§aGave " + target.getName() + " " + amount + " XP.");
                }
            }
            default -> sender.sendMessage(prefix + "§7Usage: /" + label + " <reload|setlevel|addxp>");
        }
        return true;
    }

    @Override
    public List<String> onTabComplete(CommandSender sender, Command command, String alias, String[] args) {
        if (args.length == 1) {
            return List.of("reload", "setlevel", "addxp").stream()
                    .filter(s -> s.startsWith(args[0].toLowerCase())).toList();
        }
        if (args.length == 2 && !args[0].equalsIgnoreCase("reload")) {
            return Bukkit.getOnlinePlayers().stream().map(Player::getName)
                    .filter(n -> n.toLowerCase().startsWith(args[1].toLowerCase())).toList();
        }
        return List.of();
    }
}
