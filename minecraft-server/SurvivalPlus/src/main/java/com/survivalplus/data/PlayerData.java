package com.survivalplus.data;

import java.util.UUID;

/**
 * Mutable progress for an online player. Only touched from the server main thread;
 * {@link #snapshot()} produces an immutable copy that is safe to hand to the database thread.
 */
public final class PlayerData {

    private final UUID uuid;
    private String name;
    private int level;
    private double xp;          // progress inside the current level
    private double totalXp;     // lifetime XP earned
    private long playtimeSeconds;
    private boolean dirty;

    public PlayerData(UUID uuid, String name, int level, double xp, double totalXp, long playtimeSeconds) {
        this.uuid = uuid;
        this.name = name;
        this.level = Math.max(1, level);
        this.xp = Math.max(0, xp);
        this.totalXp = Math.max(0, totalXp);
        this.playtimeSeconds = Math.max(0, playtimeSeconds);
    }

    public static PlayerData fresh(UUID uuid, String name) {
        return new PlayerData(uuid, name, 1, 0, 0, 0);
    }

    public UUID uuid() { return uuid; }
    public String name() { return name; }
    public int level() { return level; }
    public double xp() { return xp; }
    public double totalXp() { return totalXp; }
    public long playtimeSeconds() { return playtimeSeconds; }
    public boolean isDirty() { return dirty; }

    public void setName(String name) {
        if (!name.equals(this.name)) {
            this.name = name;
            dirty = true;
        }
    }

    public void setLevel(int level) { this.level = Math.max(1, level); dirty = true; }
    public void setXp(double xp) { this.xp = Math.max(0, xp); dirty = true; }
    public void addTotalXp(double amount) { this.totalXp += amount; dirty = true; }
    public void setPlaytimeSeconds(long seconds) {
        if (seconds != playtimeSeconds) {
            this.playtimeSeconds = seconds;
            dirty = true;
        }
    }

    public PlayerSnapshot snapshot() {
        return new PlayerSnapshot(uuid, name, level, xp, totalXp, playtimeSeconds);
    }

    public void markClean() { dirty = false; }
}
