package com.survivalplus.data;

import java.util.UUID;

/** Immutable row of player progress, passed between the main thread and the database thread. */
public record PlayerSnapshot(UUID uuid, String name, int level, double xp, double totalXp, long playtimeSeconds) {
}
