(function () {
  "use strict";

  const cfg = window.SITE_CONFIG || {};

  // ---- Fill in config values -------------------------------------------------
  document.querySelectorAll("[data-server-name]").forEach((el) => (el.textContent = cfg.serverName));
  document.querySelectorAll("[data-tagline]").forEach((el) => (el.textContent = cfg.tagline));
  document.querySelectorAll("[data-server-ip]").forEach((el) => (el.textContent = cfg.serverAddress));
  document.querySelectorAll("[data-mc-version]").forEach((el) => (el.textContent = cfg.minecraftVersion));
  document.querySelectorAll("[data-store-link]").forEach((el) => (el.href = cfg.storeUrl));
  document.querySelectorAll("[data-discord-link]").forEach((el) => (el.href = cfg.discordUrl));
  document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
  if (cfg.serverName) document.title = document.title.replace("My Survival Server", cfg.serverName);

  // ---- Mobile navigation -------------------------------------------------------
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
  }

  // ---- Click to copy the server address --------------------------------------
  const toast = document.getElementById("toast");
  let toastTimer;
  function showToast(text) {
    if (!toast) return;
    toast.textContent = text;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for older browsers / non-HTTPS previews
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    showToast("Server address copied!");
  }

  document.querySelectorAll("[data-copy-ip]").forEach((el) => {
    el.addEventListener("click", () => copy(cfg.serverAddress));
  });

  // ---- Vote page -------------------------------------------------------------
  const voteList = document.getElementById("vote-list");
  if (voteList && Array.isArray(cfg.voteSites)) {
    cfg.voteSites.forEach((site, i) => {
      const a = document.createElement("a");
      a.className = "vote-card";
      a.href = site.url;
      a.target = "_blank";
      a.rel = "noopener";
      a.innerHTML =
        '<span class="vote-num"></span><span class="vote-body"><strong></strong><small></small></span><span class="vote-go">Vote →</span>';
      a.querySelector(".vote-num").textContent = String(i + 1);
      a.querySelector("strong").textContent = site.name;
      a.querySelector("small").textContent = site.note || "";
      voteList.appendChild(a);
    });
  }

  // ---- Live server status ----------------------------------------------------
  const statusEls = document.querySelectorAll("[data-status]");
  if (!statusEls.length || !cfg.serverAddress) return;

  function statusUrl() {
    if (!cfg.statusApi || cfg.statusApi === "mcsrvstat") {
      return "https://api.mcsrvstat.us/3/" + encodeURIComponent(cfg.serverAddress);
    }
    return cfg.statusApi;
  }

  function render(state) {
    statusEls.forEach((el) => {
      const dot = el.querySelector(".status-dot");
      const label = el.querySelector(".status-label");
      el.classList.remove("is-online", "is-offline", "is-loading");
      el.classList.add("is-" + state.kind);
      if (label) label.textContent = state.text;
      if (dot) dot.setAttribute("aria-hidden", "true");
    });
    const countEl = document.getElementById("player-count");
    if (countEl) countEl.textContent = state.count ?? "–";
    const maxEl = document.getElementById("player-max");
    if (maxEl) maxEl.textContent = state.max ?? "–";
    const listEl = document.getElementById("player-list");
    if (listEl) {
      listEl.innerHTML = "";
      (state.names || []).slice(0, 24).forEach((name) => {
        const li = document.createElement("li");
        const img = document.createElement("img");
        img.src = "https://mc-heads.net/avatar/" + encodeURIComponent(name) + "/24";
        img.alt = "";
        img.width = 24;
        img.height = 24;
        img.loading = "lazy";
        li.appendChild(img);
        li.appendChild(document.createTextNode(name));
        listEl.appendChild(li);
      });
    }
  }

  async function refresh() {
    try {
      const res = await fetch(statusUrl(), { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      if (!data.online) {
        render({ kind: "offline", text: "Offline", count: 0, max: "–" });
        return;
      }
      const players = data.players || {};
      const names = (players.list || []).map((p) => (typeof p === "string" ? p : p.name)).filter(Boolean);
      render({
        kind: "online",
        text: players.online + (players.online === 1 ? " player" : " players") + " online",
        count: players.online,
        max: players.max,
        names,
      });
    } catch (err) {
      render({ kind: "offline", text: "Status unavailable" });
      console.warn("Status check failed:", err);
    }
  }

  render({ kind: "loading", text: "Checking…" });
  refresh();
  setInterval(refresh, Math.max(30, cfg.refreshSeconds || 60) * 1000);
})();
