package com.survivalplus.data;

import java.io.File;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * SQLite storage. Every query runs on a single dedicated thread, so the
 * connection is never shared between threads and the main thread never blocks
 * on disk I/O.
 */
public final class Database {

    private final Logger log;
    private final ExecutorService executor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "SurvivalPlus-DB");
        t.setDaemon(true);
        return t;
    });
    private Connection connection;

    public Database(Logger log) {
        this.log = log;
    }

    public void open(File file) throws SQLException {
        try {
            Class.forName("org.sqlite.JDBC"); // bundled with Spigot/Paper
        } catch (ClassNotFoundException e) {
            throw new SQLException("SQLite JDBC driver not found on the server", e);
        }
        file.getParentFile().mkdirs();
        connection = DriverManager.getConnection("jdbc:sqlite:" + file.getAbsolutePath());
        try (Statement st = connection.createStatement()) {
            st.execute("PRAGMA journal_mode=WAL");
            st.execute("PRAGMA synchronous=NORMAL");
            st.execute("""
                    CREATE TABLE IF NOT EXISTS players (
                        uuid             TEXT PRIMARY KEY,
                        name             TEXT NOT NULL,
                        level            INTEGER NOT NULL DEFAULT 1,
                        xp               REAL NOT NULL DEFAULT 0,
                        total_xp         REAL NOT NULL DEFAULT 0,
                        playtime_seconds INTEGER NOT NULL DEFAULT 0,
                        last_seen        INTEGER NOT NULL DEFAULT 0
                    )""");
            st.execute("CREATE INDEX IF NOT EXISTS idx_players_rank ON players(level DESC, total_xp DESC)");
            st.execute("CREATE INDEX IF NOT EXISTS idx_players_name ON players(name COLLATE NOCASE)");
        }
    }

    /** Loads a player's row, or a fresh record if they have never joined. */
    public CompletableFuture<PlayerData> load(UUID uuid, String name) {
        return CompletableFuture.supplyAsync(() -> {
            try (PreparedStatement ps = connection.prepareStatement(
                    "SELECT level, xp, total_xp, playtime_seconds FROM players WHERE uuid = ?")) {
                ps.setString(1, uuid.toString());
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) {
                        PlayerData data = new PlayerData(uuid, name, rs.getInt(1), rs.getDouble(2),
                                rs.getDouble(3), rs.getLong(4));
                        return data;
                    }
                }
                return PlayerData.fresh(uuid, name);
            } catch (SQLException e) {
                throw new RuntimeException("Failed to load " + name, e);
            }
        }, executor);
    }

    public CompletableFuture<Void> save(Collection<PlayerSnapshot> rows) {
        List<PlayerSnapshot> copy = List.copyOf(rows);
        if (copy.isEmpty()) return CompletableFuture.completedFuture(null);
        return CompletableFuture.runAsync(() -> upsert(copy), executor);
    }

    /**
     * Writes {@code flushFirst} (online players' unsaved progress) and then reads the
     * top players, in one task, so the leaderboard always reflects live progress.
     */
    public CompletableFuture<List<PlayerSnapshot>> top(int limit, Collection<PlayerSnapshot> flushFirst) {
        List<PlayerSnapshot> copy = List.copyOf(flushFirst);
        return CompletableFuture.supplyAsync(() -> {
            upsert(copy);
            List<PlayerSnapshot> result = new ArrayList<>();
            try (PreparedStatement ps = connection.prepareStatement(
                    "SELECT uuid, name, level, xp, total_xp, playtime_seconds FROM players "
                            + "ORDER BY level DESC, total_xp DESC LIMIT ?")) {
                ps.setInt(1, limit);
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) result.add(read(rs));
                }
            } catch (SQLException e) {
                throw new RuntimeException("Failed to read leaderboard", e);
            }
            return result;
        }, executor);
    }

    /** 1-based rank of a player by level / total XP. */
    public CompletableFuture<Integer> rank(PlayerSnapshot player) {
        return CompletableFuture.supplyAsync(() -> {
            try (PreparedStatement ps = connection.prepareStatement(
                    "SELECT COUNT(*) FROM players WHERE uuid != ? AND (level > ? OR (level = ? AND total_xp > ?))")) {
                ps.setString(1, player.uuid().toString());
                ps.setInt(2, player.level());
                ps.setInt(3, player.level());
                ps.setDouble(4, player.totalXp());
                try (ResultSet rs = ps.executeQuery()) {
                    return rs.next() ? rs.getInt(1) + 1 : 1;
                }
            } catch (SQLException e) {
                throw new RuntimeException("Failed to compute rank", e);
            }
        }, executor);
    }

    public CompletableFuture<Optional<PlayerSnapshot>> findByName(String name) {
        return CompletableFuture.supplyAsync(() -> {
            try (PreparedStatement ps = connection.prepareStatement(
                    "SELECT uuid, name, level, xp, total_xp, playtime_seconds FROM players "
                            + "WHERE name = ? COLLATE NOCASE ORDER BY last_seen DESC LIMIT 1")) {
                ps.setString(1, name);
                try (ResultSet rs = ps.executeQuery()) {
                    return rs.next() ? Optional.of(read(rs)) : Optional.<PlayerSnapshot>empty();
                }
            } catch (SQLException e) {
                throw new RuntimeException("Failed to look up " + name, e);
            }
        }, executor);
    }

    /** Waits for queued writes, then closes the connection. Called from onDisable. */
    public void close() {
        executor.shutdown();
        try {
            if (!executor.awaitTermination(15, TimeUnit.SECONDS)) {
                log.warning("Timed out waiting for database writes to finish");
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        try {
            if (connection != null) connection.close();
        } catch (SQLException e) {
            log.log(Level.WARNING, "Failed to close database", e);
        }
    }

    private void upsert(List<PlayerSnapshot> rows) {
        if (rows.isEmpty()) return;
        String sql = """
                INSERT INTO players (uuid, name, level, xp, total_xp, playtime_seconds, last_seen)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(uuid) DO UPDATE SET
                    name = excluded.name,
                    level = excluded.level,
                    xp = excluded.xp,
                    total_xp = excluded.total_xp,
                    playtime_seconds = excluded.playtime_seconds,
                    last_seen = excluded.last_seen""";
        long now = System.currentTimeMillis() / 1000;
        try {
            connection.setAutoCommit(false);
            try (PreparedStatement ps = connection.prepareStatement(sql)) {
                for (PlayerSnapshot r : rows) {
                    ps.setString(1, r.uuid().toString());
                    ps.setString(2, r.name());
                    ps.setInt(3, r.level());
                    ps.setDouble(4, r.xp());
                    ps.setDouble(5, r.totalXp());
                    ps.setLong(6, r.playtimeSeconds());
                    ps.setLong(7, now);
                    ps.addBatch();
                }
                ps.executeBatch();
            }
            connection.commit();
        } catch (SQLException e) {
            try {
                connection.rollback();
            } catch (SQLException ignored) {
                // nothing more we can do
            }
            log.log(Level.SEVERE, "Failed to save " + rows.size() + " player(s)", e);
        } finally {
            try {
                connection.setAutoCommit(true);
            } catch (SQLException ignored) {
                // connection is unusable; next call will report it
            }
        }
    }

    private static PlayerSnapshot read(ResultSet rs) throws SQLException {
        return new PlayerSnapshot(UUID.fromString(rs.getString(1)), rs.getString(2), rs.getInt(3),
                rs.getDouble(4), rs.getDouble(5), rs.getLong(6));
    }
}
