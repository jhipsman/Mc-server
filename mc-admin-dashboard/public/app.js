(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const css = getComputedStyle(document.documentElement);
  const token = (name) => css.getPropertyValue(name).trim();

  let hours = 6;
  let threshold = 15;
  let history = [];

  // ---- Formatting ---------------------------------------------------------------
  const fmtTime = (t) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const fmtDateTime = (t) =>
    new Date(t).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  function fmtDuration(sec) {
    if (sec == null) return "–";
    const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
    if (d) return `${d}d ${h}h`;
    if (h) return `${h}h ${m}m`;
    return m ? `${m}m` : "<1m";
  }
  const fmtGB = (mb) => (mb / 1024).toFixed(1);

  // ---- Charts -----------------------------------------------------------------
  // Dashed reference line for the TPS alert threshold.
  const thresholdLine = {
    id: "thresholdLine",
    afterDatasetsDraw(chart) {
      const y = chart.scales.y.getPixelForValue(threshold);
      const { left, right } = chart.chartArea;
      const ctx = chart.ctx;
      ctx.save();
      ctx.strokeStyle = token("--warning");
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = token("--text-2");
      ctx.font = "11px system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(`alert < ${threshold}`, right - 4, y - 5);
      ctx.restore();
    },
  };

  // Vertical crosshair under the hovered point.
  const crosshair = {
    id: "crosshair",
    afterDraw(chart) {
      const active = chart.tooltip?.getActiveElements?.();
      if (!active?.length) return;
      const x = active[0].element.x;
      const { top, bottom } = chart.chartArea;
      const ctx = chart.ctx;
      ctx.save();
      ctx.strokeStyle = token("--muted");
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
      ctx.restore();
    },
  };

  function makeChart(canvas, color, { min, max, label, unit, extraPlugins = [] }) {
    return new Chart(canvas, {
      type: "line",
      data: { datasets: [{ label, data: [], borderColor: color, backgroundColor: color + "22", fill: true, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, pointHoverBorderWidth: 2, pointHoverBorderColor: token("--surface"), tension: 0.25, spanGaps: false }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        parsing: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false }, // single series: the panel title names it
          tooltip: {
            backgroundColor: token("--surface-2"),
            borderColor: token("--border"),
            borderWidth: 1,
            titleColor: token("--text"),
            bodyColor: token("--text-2"),
            displayColors: false,
            callbacks: {
              title: (items) => fmtDateTime(items[0].parsed.x),
              label: (item) => (item.parsed.y == null ? "offline" : `${label}: ${item.parsed.y}${unit || ""}`),
            },
          },
        },
        scales: {
          x: {
            type: "linear",
            grid: { color: token("--grid") },
            border: { color: token("--border") },
            ticks: { color: token("--muted"), maxTicksLimit: 7, callback: (v) => fmtTime(v) },
          },
          y: {
            min,
            max,
            grid: { color: token("--grid") },
            border: { display: false },
            ticks: { color: token("--muted"), precision: 0 },
          },
        },
      },
      plugins: [crosshair, ...extraPlugins],
    });
  }

  const tpsChart = makeChart($("tps-chart"), token("--series-2"), { min: 0, max: 20, label: "TPS", extraPlugins: [thresholdLine] });
  const playersChart = makeChart($("players-chart"), token("--series"), { min: 0, label: "Players" });

  function renderCharts() {
    const cutoff = Date.now() - hours * 3600e3;
    const rows = history.filter((s) => s.t >= cutoff);
    // null y-values break the line while the server was offline
    tpsChart.data.datasets[0].data = rows.map((s) => ({ x: s.t, y: s.online ? s.tps1 : null }));
    playersChart.data.datasets[0].data = rows.map((s) => ({ x: s.t, y: s.online ? s.players : null }));
    for (const c of [tpsChart, playersChart]) {
      c.options.scales.x.min = cutoff;
      c.options.scales.x.max = Date.now();
      c.update("none");
    }
    const maxPlayers = rows.reduce((m, s) => Math.max(m, s.players || 0), 0);
    playersChart.options.scales.y.suggestedMax = Math.max(5, maxPlayers + 1);
    playersChart.update("none");
  }

  // ---- Tiles ------------------------------------------------------------------
  function statusClass(tps) {
    if (tps == null) return "";
    if (tps >= 18) return "good";
    if (tps >= threshold) return "warning";
    return "critical";
  }
  const STATUS_WORD = { good: "✓ good", warning: "▲ fair", critical: "✕ low" };

  function renderTiles(s) {
    const pill = $("status-pill");
    if (!s) return;
    pill.className = "pill " + (s.online ? "online" : "offline");
    $("status-text").textContent = s.online ? "Online" : "Offline";

    $("t-players").textContent = s.online ? s.players : "–";
    $("t-players-max").textContent = s.maxPlayers ? `of ${s.maxPlayers} max` : "";

    const cls = statusClass(s.tps1);
    const tpsEl = $("t-tps");
    tpsEl.textContent = s.tps1 != null ? s.tps1.toFixed(1) : "–";
    $("t-tps-hint").innerHTML = s.tps5 != null
      ? `<span class="${cls}">${STATUS_WORD[cls]}</span> · 5m ${s.tps5.toFixed(1)} · 15m ${s.tps15.toFixed(1)}`
      : s.tps1 != null ? `<span class="${cls}">${STATUS_WORD[cls]}</span>` : "via RCON";

    $("t-cpu").textContent = s.cpu != null ? `${Math.round(s.cpu)}%` : "–";
    $("t-ram").textContent = `${fmtGB(s.memUsedMB)} GB`;
    $("t-ram-hint").textContent = `of ${fmtGB(s.memTotalMB)} GB`;
    if (s.jvmUsedMB != null) {
      $("t-jvm").textContent = `${fmtGB(s.jvmUsedMB)} GB`;
      $("t-jvm-hint").textContent = `of ${fmtGB(s.jvmMaxMB)} GB allocated`;
    } else {
      $("t-jvm").textContent = "–";
    }
    $("t-uptime").textContent = s.online ? fmtDuration(s.uptimeSec) : "–";
    $("t-updated").textContent = `updated ${fmtTime(s.t)}`;
  }

  function renderOnline(players) {
    const list = $("online-list");
    $("online-count").textContent = players.length;
    list.replaceChildren();
    if (!players.length) {
      const li = document.createElement("li");
      li.className = "muted";
      li.textContent = "Nobody online";
      list.appendChild(li);
      return;
    }
    for (const p of players) {
      const li = document.createElement("li");
      const img = document.createElement("img");
      img.src = `https://mc-heads.net/avatar/${encodeURIComponent(p.name)}/24`;
      img.alt = "";
      const name = document.createElement("span");
      name.textContent = p.name;
      const since = document.createElement("small");
      since.textContent = fmtDuration(Math.round((Date.now() - p.since) / 1000));
      li.append(img, name, since);
      list.appendChild(li);
    }
  }

  function renderWatchdog(w) {
    const dl = $("watchdog");
    dl.replaceChildren();
    const add = (k, v) => {
      const dt = document.createElement("dt");
      dt.textContent = k;
      const dd = document.createElement("dd");
      dd.textContent = v;
      dl.append(dt, dd);
    };
    if (!w) {
      add("Status", "Not running (start it with npm run watchdog)");
      return;
    }
    const stale = Date.now() - w.updatedAt > 10 * 60e3 && w.status !== "running";
    add("Status", stale ? `${w.status} (last update ${fmtDateTime(w.updatedAt)})` : w.status);
    if (w.pid) add("PID", String(w.pid));
    if (w.startedAt) add("Started", fmtDateTime(w.startedAt));
    add("Auto-restarts", `${w.totalRestarts} total`);
    if (w.lastCrash) add("Last crash", `${fmtDateTime(w.lastCrash.at)} (${w.lastCrash.reason}, exit ${w.lastCrash.code ?? "n/a"})`);
  }

  let playerEvents = [];
  function renderPlayerLog() {
    const body = $("player-log");
    body.replaceChildren();
    if (!playerEvents.length) {
      body.innerHTML = '<tr><td colspan="4" class="muted">No activity yet</td></tr>';
      return;
    }
    for (const e of playerEvents.slice(0, 200)) {
      const tr = document.createElement("tr");
      const cells = [fmtDateTime(e.t), e.player, null, e.sessionSec != null ? fmtDuration(e.sessionSec) : e.reason || ""];
      cells.forEach((text, i) => {
        const td = document.createElement("td");
        if (i === 2) {
          const tag = document.createElement("span");
          tag.className = "tag " + e.type;
          tag.textContent = e.type === "join" ? "joined" : "left";
          td.appendChild(tag);
        } else {
          td.textContent = text;
        }
        tr.appendChild(td);
      });
      body.appendChild(tr);
    }
  }

  let alerts = [];
  function renderAlerts() {
    const list = $("alerts");
    list.replaceChildren();
    if (!alerts.length) {
      list.innerHTML = '<li class="muted">No alerts</li>';
      return;
    }
    for (const a of alerts) {
      const li = document.createElement("li");
      li.className = a.level;
      const time = document.createElement("time");
      time.textContent = fmtDateTime(a.t);
      const title = document.createElement("strong");
      title.textContent = a.title;
      li.append(time, title);
      if (a.description) {
        const d = document.createElement("span");
        d.className = "desc";
        d.textContent = a.description;
        li.appendChild(d);
      }
      list.appendChild(li);
    }
  }

  // ---- Data loading -------------------------------------------------------------
  async function getJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    return res.json();
  }

  async function loadAll() {
    const [status, hist, players, alertList] = await Promise.all([
      getJson("api/status"),
      getJson(`api/history?hours=24`),
      getJson("api/players?limit=200"),
      getJson("api/alerts"),
    ]);
    threshold = status.config.tpsThreshold;
    $("tps-caption").textContent = `Dashed line = alert threshold (${threshold})`;
    const info = [status.server.motd, status.server.version, status.server.software].filter(Boolean).join(" · ");
    $("server-info").textContent = info || `Polling every ${status.config.pollSeconds}s`;
    history = hist;
    playerEvents = players;
    alerts = alertList;
    renderTiles(status.latest);
    renderOnline(status.onlinePlayers);
    renderWatchdog(status.watchdog);
    renderCharts();
    renderPlayerLog();
    renderAlerts();
  }

  function connectStream() {
    const es = new EventSource("api/stream");
    es.addEventListener("sample", (ev) => {
      const s = JSON.parse(ev.data);
      history.push(s);
      const cutoff = Date.now() - 24 * 3600e3;
      while (history.length && history[0].t < cutoff) history.shift();
      renderTiles(s);
      renderOnline(s.onlinePlayers || []);
      renderWatchdog(s.watchdog);
      renderCharts();
    });
    es.addEventListener("player", (ev) => {
      playerEvents.unshift(JSON.parse(ev.data));
      renderPlayerLog();
    });
    es.addEventListener("alert", (ev) => {
      alerts.unshift(JSON.parse(ev.data));
      renderAlerts();
    });
    es.onerror = () => {
      $("status-text").textContent = "Dashboard disconnected";
      $("status-pill").className = "pill offline";
    };
    es.onopen = () => loadAll().catch(console.error); // resync after reconnects
  }

  document.querySelectorAll(".range button").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".range button").forEach((b) => b.classList.toggle("active", b === btn));
      hours = Number(btn.dataset.hours);
      renderCharts();
    });
  });

  loadAll().catch((err) => {
    console.error(err);
    $("server-info").textContent = "Could not load data from the dashboard server";
  });
  connectStream();
})();
