/*
 * ============================================================================
 *  SITE CONFIG - edit this file to customise the website.
 *  Everything marked "placeholder" should be replaced before going live.
 * ============================================================================
 */
window.SITE_CONFIG = {
  serverName: "My Survival Server",                  // placeholder
  tagline: "Community survival with skills, perks and protected land.",
  serverAddress: "play.example.com",                 // placeholder - what players type in Minecraft
  minecraftVersion: "1.21.x (Java Edition)",

  discordUrl: "https://discord.gg/your-invite",      // placeholder
  storeUrl: "https://your-store.tebex.io",           // placeholder - your Tebex/BuyCraft webstore

  /*
   * Live player count source.
   * Browsers can't speak the Minecraft query protocol (it is UDP), so the site
   * asks a small HTTP service that queries the server for it:
   *
   *   "mcsrvstat"  -> free public API (api.mcsrvstat.us). Uses the query
   *                   protocol when enable-query=true. Works on GitHub Pages
   *                   with zero setup. Results are cached for about 1 minute.
   *
   *   "https://dashboard.example.com/api/public/status"
   *                -> the mc-admin-dashboard's public endpoint, which queries
   *                   your server directly over the query protocol (live, no
   *                   third party). See mc-admin-dashboard/README.md.
   */
  statusApi: "mcsrvstat",
  refreshSeconds: 60,

  // Server list sites for the Vote page. Replace the URLs with your server's listing pages.
  voteSites: [
    { name: "Minecraft-Server-List.com", url: "https://minecraft-server-list.com/", note: "Vote every 24 hours" },
    { name: "Minecraft-MP.com", url: "https://minecraft-mp.com/", note: "Vote every 24 hours" },
    { name: "TopG.org", url: "https://topg.org/minecraft-servers/", note: "Vote every 12 hours" },
    { name: "PlanetMinecraft", url: "https://www.planetminecraft.com/servers/", note: "Vote every 24 hours" },
    { name: "MinecraftServers.org", url: "https://minecraftservers.org/", note: "Vote every 24 hours" },
    { name: "Minecraft-Server.net", url: "https://minecraft-server.net/", note: "Vote every 24 hours" },
  ],
};
