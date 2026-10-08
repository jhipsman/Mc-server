package com.survivalplus.util;

import org.bukkit.NamespacedKey;
import org.bukkit.block.Block;
import org.bukkit.persistence.PersistentDataContainer;
import org.bukkit.persistence.PersistentDataType;
import org.bukkit.plugin.Plugin;

import java.util.Arrays;

/**
 * Remembers which XP-giving blocks (ores, melons, pumpkins...) were placed by players,
 * so they can't be placed and re-mined for XP. Positions are stored in each chunk's
 * PersistentDataContainer, so the data survives restarts and is cleaned up with the chunk.
 */
public final class PlacedBlockTracker {

    private final NamespacedKey key;

    public PlacedBlockTracker(Plugin plugin) {
        this.key = new NamespacedKey(plugin, "placed_blocks");
    }

    public boolean isPlaced(Block block) {
        long[] positions = container(block).get(key, PersistentDataType.LONG_ARRAY);
        return positions != null && indexOf(positions, pack(block)) >= 0;
    }

    public void markPlaced(Block block) {
        PersistentDataContainer pdc = container(block);
        long[] positions = pdc.get(key, PersistentDataType.LONG_ARRAY);
        long packed = pack(block);
        if (positions == null) {
            pdc.set(key, PersistentDataType.LONG_ARRAY, new long[]{packed});
        } else if (indexOf(positions, packed) < 0) {
            long[] grown = Arrays.copyOf(positions, positions.length + 1);
            grown[positions.length] = packed;
            pdc.set(key, PersistentDataType.LONG_ARRAY, grown);
        }
    }

    public void unmark(Block block) {
        PersistentDataContainer pdc = container(block);
        long[] positions = pdc.get(key, PersistentDataType.LONG_ARRAY);
        if (positions == null) return;
        int idx = indexOf(positions, pack(block));
        if (idx < 0) return;
        if (positions.length == 1) {
            pdc.remove(key);
            return;
        }
        long[] shrunk = new long[positions.length - 1];
        System.arraycopy(positions, 0, shrunk, 0, idx);
        System.arraycopy(positions, idx + 1, shrunk, idx, positions.length - idx - 1);
        pdc.set(key, PersistentDataType.LONG_ARRAY, shrunk);
    }

    private static PersistentDataContainer container(Block block) {
        return block.getChunk().getPersistentDataContainer();
    }

    /** Chunk-relative x/z (4 bits each) plus offset y (supports any world height). */
    private static long pack(Block block) {
        return (block.getX() & 15L) | ((block.getZ() & 15L) << 4) | ((long) (block.getY() + 4096) << 8);
    }

    private static int indexOf(long[] values, long value) {
        for (int i = 0; i < values.length; i++) {
            if (values[i] == value) return i;
        }
        return -1;
    }
}
