/* ============================================================
   app.js — Main init, page routing, auto-refresh
   香港城市儀表板 v3 (全方位版)
   ============================================================ */

"use strict";

/* ── Offline / Online Detection ──────────────────────────────────── */
(function initOfflineDetection() {
  // Create the offline banner element
  function getOrCreateBanner() {
    let el = document.getElementById("offline-banner");
    if (el) return el;
    el = document.createElement("div");
    el.id = "offline-banner";
    el.style.cssText = [
      "display:none",
      "position:fixed",
      "top:0",
      "left:0",
      "right:0",
      "z-index:9999",
      "background:linear-gradient(135deg,#78350f,#92400e)",
      "color:white",
      "padding:10px 20px",
      "text-align:center",
      "font-size:14px",
      "font-weight:600",
      "border-bottom:2px solid #f59e0b",
    ].join(";");
    el.textContent =
      "\u26a0 \u76ee\u524d\u6c92\u6709\u7db2\u7d61\u9023\u7dda \u00b7 \u986f\u793a\u4e0a\u6b21\u7de9\u5b58\u6578\u64da";
    // Insert before page-body or at start of body
    const pageBody = document.querySelector(".page-body");
    if (pageBody) {
      pageBody.parentNode.insertBefore(el, pageBody);
    } else if (document.body) {
      document.body.insertBefore(el, document.body.firstChild);
    }
    return el;
  }

  function showOfflineBanner() {
    const banner = getOrCreateBanner();
    banner.style.display = "block";
  }

  function hideOfflineBanner() {
    const banner = document.getElementById("offline-banner");
    if (banner) banner.style.display = "none";
  }

  // Check initial state after DOM ready
  document.addEventListener("DOMContentLoaded", function () {
    getOrCreateBanner();
    if (!navigator.onLine) {
      showOfflineBanner();
    }
  });

  window.addEventListener("offline", function () {
    showOfflineBanner();
  });

  window.addEventListener("online", function () {
    hideOfflineBanner();
    // Auto-refresh all data when connection restored
    console.log("[HK Dashboard] Back online — refreshing data…");
    if (typeof loadAllData === "function") loadAllData();
  });
})();

/* ── Bootstrap ───────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", async function () {
  console.log("[HK Dashboard v4] Initialising…");

  // 1. Show home page
  showPage("home");
  initHomeWidgets();
  initSummaryCards();

  // 2. Initial data load (parallel)
  await loadAllData();

  // 3. Start auto-refresh loop
  startAutoRefresh();

  // 4. Render bus preset slots
  initBusPresets();

  console.log("[HK Dashboard v4] Ready.");
});

/* ── Load all data ─────────────────────────────────────────────── */
async function loadAllData() {
  const tasks = [];
  if (typeof Weather !== "undefined") {
    tasks.push(safeRun("Weather", () => Weather.refresh()));
  }
  if (typeof Transport !== "undefined") {
    tasks.push(safeRun("Transport", () => Transport.refresh()));
  }
  if (typeof Health !== "undefined") {
    tasks.push(safeRun("Health", () => Health.refresh()));
  }
  if (typeof Environment !== "undefined") {
    tasks.push(safeRun("Environment", () => Environment.refresh()));
  }
  if (typeof Finance !== "undefined") {
    tasks.push(safeRun("Finance", () => Finance.refresh()));
  }
  await Promise.allSettled(tasks);
}

/* ── Bus preset init ──────────────────────────────────────────── */
function initBusPresets() {
  if (typeof Bus === "undefined") return;
  // Bus.refresh() now handles rendering preset grid internally
  safeRun("Bus", () => Bus.refresh());
}

/* ── Auto-refresh ────────────────────────────────────────────── */
function startAutoRefresh() {
  const shouldRefresh = () => {
    return document.visibilityState === "visible" && navigator.onLine;
  };

  // Refresh weather/health/environment every 60 seconds
  setInterval(async () => {
    if (!shouldRefresh()) return;
    await Promise.allSettled([
      typeof Weather !== "undefined" && safeRun("Weather", () => Weather.refresh()),
      typeof Health !== "undefined" && safeRun("Health", () => Health.refresh()),
      typeof Environment !== "undefined" && safeRun("Environment", () => Environment.refresh()),
    ].filter(Boolean));
  }, 60000);

  // Transport-specific refresh every 10 seconds
  setInterval(async () => {
    if (!shouldRefresh()) return;
    if (typeof Transport !== "undefined") {
      await safeRun("Transport", () => Transport.refresh());
    }
  }, 10000);

  // Bus presets every 45 seconds
  setInterval(async () => {
    if (!shouldRefresh()) return;
    if (typeof Bus !== "undefined") {
      await safeRun("Bus", () => Bus.refresh());
    }
  }, 45000);

  // Parking every 5 minutes
  setInterval(async () => {
    if (!shouldRefresh() || window._currentPage !== "parking") return;
    if (typeof Parking !== "undefined") {
      await safeRun("Parking", () => Parking.refresh());
    }
  }, 300000);
}

function renderWidget(title, data, icon, link) {
  const container = document.getElementById("home-widgets");
  if (!container) return null;
  const card = document.createElement("a");
  card.className = "card widget-card";
  card.href = link || "#";
  if (link && !link.startsWith("http") && !link.startsWith("#")) {
    card.href = "#";
    card.addEventListener("click", function (event) {
      event.preventDefault();
      if (typeof showPage === "function") showPage(link);
      if (typeof toggleMoreMenu === "function") toggleMoreMenu(false);
    });
  }
  card.innerHTML = `
    <div style="display:flex;align-items:center;gap:var(--sp-3);">
      <div class="widget-card-icon">${icon}</div>
      <div>
        <div class="widget-card-title">${title}</div>
        <div class="widget-card-data">${data}</div>
      </div>
    </div>
  `;
  container.appendChild(card);
  return card;
}

function initHomeWidgets() {
  const widgets = [
    {
      title: "天氣總覽",
      data: "最新天氣警告與預報",
      icon: "☀️",
      link: "weather",
    },
    {
      title: "交通快訊",
      data: "即時巴士、港鐵與車況",
      icon: "🚌",
      link: "transport",
    },
    {
      title: "環保數據",
      data: "AQHI、空氣質素與海況",
      icon: "🌿",
      link: "environment",
    },
    {
      title: "醫療資訊",
      data: "急症室與醫療服務狀況",
      icon: "🏥",
      link: "health",
    },
  ];
  const container = document.getElementById("home-widgets");
  if (!container) return;
  container.innerHTML = "";
  widgets.forEach((widget) =>
    renderWidget(widget.title, widget.data, widget.icon, widget.link),
  );
}

function initSummaryCards() {
  updateSummaryTime();
  setInterval(updateSummaryTime, 1000);
  loadNewsSummary();
  renderTransportSummary("mtr");
  bindSummaryControls();
}

function bindSummaryControls() {
  document.querySelectorAll(".seg-btn[data-view]").forEach((btn) => {
    btn.addEventListener("click", function () {
      document
        .querySelectorAll(".seg-btn[data-view]")
        .forEach((b) => b.classList.remove("active"));
      this.classList.add("active");
      renderTransportSummary(this.dataset.view);
    });
  });
}

function updateSummaryTime() {
  const now = new Date();
  const timeEl = document.getElementById("summary-time");
  const dateEl = document.getElementById("summary-date");
  if (timeEl) {
    timeEl.textContent = now.toLocaleTimeString("zh-HK", { hour12: false });
  }
  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString("zh-HK", {
      weekday: "short",
      month: "long",
      day: "numeric",
    });
  }
}

/*
  ──old version code───────────────────────────────────── 
function getWeatherEmoji(desc) {
  const text = (desc || "").toLowerCase();
  if (text.includes("雷")) return "⛈️";
  if (text.includes("雨")) return "🌧️";
  if (text.includes("雪")) return "❄️";
  if (text.includes("雲")) return "⛅";
  if (text.includes("多雲")) return "⛅";
  if (text.includes("晴")) return "☀️";
  if (text.includes("霧") || text.includes("霧")) return "🌫️";
  if (text.includes("風")) return "🌬️";
  return "🌤️";
}
*/

// New version with switch-case for better readability//
function getWeatherEmoji(desc) {
  const text = (desc || "").toLowerCase();
  switch (true) {
    case text.includes("雷"):
      return "⛈️";
    case text.includes("雪"):
      return "❄️";
    case text.includes("雨"):
      return "🌧️";
    case text.includes("晴"):
      return "☀️";
    case text.includes("雲"):
      return "⛅";
    case text.includes("霧"):
      return "🌫️";
    case text.includes("風"):
      return "🌬️";
    default:
      return "🌤️";
  }
}

function updateSummaryWeather(
  currentTemp,
  aqhi,
  desc,
  updatedAt,
  humidity,
  uv,
  condition,
) {
  const tempEl = document.getElementById("summary-temp");
  const aqhiEl = document.getElementById("summary-aqhi");
  const descEl = document.getElementById("summary-weather-desc");
  const updatedEl = document.getElementById("summary-updated");
  const humidityEl = document.getElementById("summary-humidity");
  const uvEl = document.getElementById("summary-uv");
  const conditionEl = document.getElementById("summary-condition");
  const visualEl = document.getElementById("summary-weather-visual");
  if (tempEl)
    tempEl.textContent =
      currentTemp !== undefined ? `${currentTemp}°C` : "--°C";
  if (aqhiEl) aqhiEl.textContent = aqhi || "--";
  if (descEl) descEl.textContent = desc || "載入中...";
  if (updatedEl) updatedEl.textContent = updatedAt || "-- 分鐘前";
  if (humidityEl) humidityEl.textContent = humidity || "--%";
  if (uvEl) uvEl.textContent = uv || "--";
  if (conditionEl) conditionEl.textContent = condition || desc || "載入中...";
  if (visualEl) visualEl.textContent = getWeatherEmoji(condition || desc);
  if (currentTemp !== undefined) {
    saveHistoryRecord("weather", {
      timestamp: new Date().toISOString(),
      temperature: Number(currentTemp) || null,
      aqhi: aqhi || null,
    });
  }
}

function renderTransportSummary(view) {
  const target = document.getElementById("summary-transport");
  if (!target) return;
  target.innerHTML = '<div class="skel skel-p"></div>';
  if (
    view === "mtr" &&
    typeof Transport !== "undefined" &&
    typeof window.fetchMTR === "function"
  ) {
    window.fetchMTR("TML", "TUM", "summary-transport");
    return;
  }
  if (view === "bus" && typeof Bus !== "undefined") {
    if (typeof Bus.renderSummary === "function") {
      Bus.renderSummary("summary-transport");
      return;
    }
  }
  target.innerHTML =
    '<div class="row-item"><span style="color:var(--text-faint)">目前無法顯示交通摘要。</span></div>';
}

const NEWS_CACHE_KEY = "hk_dashboard_news_cache";

async function loadNewsSummary() {
  const container = document.getElementById("summary-news");
  if (!container) return;
  const sourceUrl = "https://www.hk01.com/feeds/rss";
  try {
    const items = await fetchNewsFeed(sourceUrl);
    if (!items.length) throw new Error("no news");
    saveNewsCache(items);
    renderNewsItems(container, items);
  } catch (e) {
    console.warn("News fetch error:", e);
    const cached = loadNewsCache();
    if (cached.length) {
      renderNewsItems(container, cached, true);
      return;
    }
    container.textContent = "新聞載入失敗，請稍後重試。";
  }
}

function renderNewsItems(container, items, isCache = false) {
  const inner = document.createElement("div");
  inner.className = "marquee-inner";
  inner.innerHTML = items
    .slice(0, 8)
    .map(
      (item) => `
      <a href="${item.link}" target="_blank" class="marquee-item">
        ${item.title}<time>${new Date(item.pubDate).toLocaleTimeString("zh-HK", { hour12: false, hour: "2-digit", minute: "2-digit" })}</time>
      </a>
    `,
    )
    .join("");
  container.innerHTML = "";
  container.appendChild(inner);
  if (isCache) {
    const note = document.createElement("div");
    note.style.cssText = "font-size:0.75rem;color:var(--text-faint);margin-top:8px";
    note.textContent = "使用離線緩存新聞。";
    container.appendChild(note);
  }
}

function saveNewsCache(items) {
  try {
    localStorage.setItem(
      NEWS_CACHE_KEY,
      JSON.stringify({ timestamp: Date.now(), items: items.slice(0, 12) }),
    );
  } catch (e) {
    console.warn("Unable to save news cache", e);
  }
}

function loadNewsCache() {
  try {
    const stored = localStorage.getItem(NEWS_CACHE_KEY);
    if (!stored) return [];
    return JSON.parse(stored).items || [];
  } catch (e) {
    console.warn("Unable to read news cache", e);
    return [];
  }
}

async function fetchNewsFeed(url) {
  const proxies = [
    {
      url: `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`,
      parser: parseRss2JsonResponse,
    },
    {
      url: `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
      parser: parseAllOriginsResponse,
    },
    {
      url: `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
      parser: parseRssTextResponse,
    },
  ];

  for (const proxy of proxies) {
    try {
      const res = await fetch(proxy.url);
      if (!res.ok) throw new Error(`Proxy HTTP ${res.status}`);
      const text = await res.text();
      const items = proxy.parser(text);
      if (items.length) return items;
    } catch (e) {
      console.warn(`News proxy failed: ${proxy.url}`, e);
    }
  }
  throw new Error("All news proxies failed");
}

function parseRss2JsonResponse(text) {
  try {
    const data = JSON.parse(text);
    return (data.items || []).map((item) => ({
      title: item.title || item.title_noFormatting || "(無標題)",
      link: item.link || item.guid || "#",
      pubDate: item.pubDate || item.pubDate || new Date().toISOString(),
    }));
  } catch (e) {
    return [];
  }
}

function parseAllOriginsResponse(text) {
  try {
    const data = JSON.parse(text);
    return parseRssTextResponse(data.contents || "");
  } catch (e) {
    return [];
  }
}

function parseRssTextResponse(xmlText) {
  if (!xmlText) return [];
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "text/xml");
    return Array.from(doc.querySelectorAll("item")).slice(0, 8).map((item) => {
      const title = item.querySelector("title")?.textContent || "(無標題)";
      const link = item.querySelector("link")?.textContent || "#";
      const pubDate =
        item.querySelector("pubDate")?.textContent ||
        item.querySelector("dc\\:date")?.textContent ||
        new Date().toISOString();
      return { title, link, pubDate };
    });
  } catch (e) {
    return [];
  }
}

const DB_NAME = "hk_dashboard_history";
const DB_STORE = "history";
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = function (event) {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        const store = db.createObjectStore(DB_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("type", "type", { unique: false });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };
    req.onsuccess = function () {
      resolve(req.result);
    };
    req.onerror = function () {
      reject(req.error);
    };
  });
}

async function saveHistoryRecord(type, payload) {
  try {
    const db = await openDb();
    const tx = db.transaction(DB_STORE, "readwrite");
    const store = tx.objectStore(DB_STORE);
    store.add({ type, timestamp: new Date().toISOString(), payload });
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () =>
        reject(tx.error || new Error("IndexedDB transaction aborted"));
    });
  } catch (e) {
    console.error("IndexedDB save failed:", e);
  }
}

async function queryHistory(type, hours) {
  try {
    const db = await openDb();
    const tx = db.transaction(DB_STORE, "readonly");
    const store = tx.objectStore(DB_STORE);
    const idx = store.index("type");
    const req = idx.getAll(IDBKeyRange.only(type));
    return new Promise((resolve, reject) => {
      req.onsuccess = function () {
        const now = Date.now();
        const cutoff = now - hours * 3600000;
        const results = (req.result || []).filter(
          (item) => new Date(item.timestamp).getTime() >= cutoff,
        );
        resolve(
          results.map((item) => ({
            timestamp: item.timestamp,
            ...item.payload,
          })),
        );
      };
      req.onerror = function () {
        reject(req.error);
      };
    });
  } catch (e) {
    console.error("IndexedDB query failed:", e);
    return [];
  }
}

setInterval(async () => {
  if (
    document.visibilityState === "visible" &&
    typeof window._lastWeatherUpdate !== "undefined"
  ) {
    await saveHistoryRecord("weather", {
      timestamp: new Date().toISOString(),
      temperature: window._lastWeatherTemp ?? null,
      aqhi: window._lastWeatherAQHI ?? null,
    });
  }
}, 3600000);

/* ── Safe run wrapper ────────────────────────────────────────── */
async function safeRun(label, fn) {
  try {
    await fn();
  } catch (e) {
    console.error(`[${label}] refresh error:`, e);
  }
}

/* ── Page change hook ────────────────────────────────────────── */
const _origShowPage = typeof window.showPage === "function" ? window.showPage : function () {};
window.showPage = function (name) {
  _origShowPage(name);
  // Trigger immediate refresh for the newly visible page
  switch (name) {
    case "weather":
      safeRun("Weather", () => Weather.refresh());
      loadWeatherForecastText();
      break;
    case "transport":
      safeRun("Transport", () => Transport.refresh());
      break;
    case "health":
      safeRun("Health", () => Health.refresh());
      break;
    case "environment":
      safeRun("Environment", () => Environment.refresh());
      break;
    case "bus":
      // Only reload if presets are empty
      break;
    case "tides":
      safeRun("Tides", () => Tides.refresh());
      break;
    case "parking":
      // Only load on first visit
      if (!window._parkingLoaded) {
        window._parkingLoaded = true;
        safeRun("Parking", () => Parking.refresh());
      }
      break;
    case "ferry":
      if (!window._ferryLoaded) {
        window._ferryLoaded = true;
        safeRun("Ferry", () => Ferry.refresh());
      }
      break;
    case "beach":
      if (!window._beachLoaded) {
        window._beachLoaded = true;
        safeRun("Beach", () => Beach.refresh());
      }
      break;
    case "map":
      safeRun("Map", () => MapView.refresh());
      break;
    case "holidays":
      // Load on first visit
      if (!window._holidaysLoaded) {
        window._holidaysLoaded = true;
        safeRun("Holidays", () => Holidays.refresh());
      }
      break;
    case "climate":
      // Load on first visit
      if (!window._climateLoaded) {
        window._climateLoaded = true;
        safeRun("Climate", () => Climate.refresh());
      }
      break;
    // CCTV: don't auto-load, let user choose cameras
    case "waste":
      if (!window._wasteLoaded) {
        window._wasteLoaded = true;
        safeRun("Waste", () => Waste.refresh());
      }
      break;
  }
};

/* ── Load weather forecast text for weather page ─────────────── */
async function loadWeatherForecastText() {
  const cont = document.getElementById("w-flw-content");
  if (!cont) return;
  cont.innerHTML = `<div class="skel skel-p"></div><div class="skel skel-p" style="margin-top:8px"></div>`;
  try {
    const r = await fetch(
      "https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=flw&lang=tc",
    );
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    const { generalSituation, forecastDesc, outlook } = data;
    cont.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:var(--sp-4)">
        ${
          generalSituation
            ? `
          <div>
            <div style="font-size:var(--text-xs);color:var(--text-faint);font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:var(--sp-2)">天氣概況 General Situation</div>
            <div style="font-size:var(--text-sm);line-height:1.7;color:var(--text-muted)">${generalSituation}</div>
          </div>
        `
            : ""
        }
        ${
          forecastDesc
            ? `
          <div>
            <div style="font-size:var(--text-xs);color:var(--text-faint);font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:var(--sp-2)">天氣預測 Forecast</div>
            <div style="font-size:var(--text-sm);line-height:1.7;color:var(--text-muted)">${forecastDesc}</div>
          </div>
        `
            : ""
        }
        ${
          outlook
            ? `
          <div>
            <div style="font-size:var(--text-xs);color:var(--text-faint);font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:var(--sp-2)">展望 Outlook</div>
            <div style="font-size:var(--text-sm);line-height:1.7;color:var(--text-muted)">${outlook}</div>
          </div>
        `
            : ""
        }
      </div>
    `;
  } catch (e) {
    cont.innerHTML = `<div style="color:var(--error);font-size:var(--text-xs)">載入失敗：${e.message}</div>`;
  }
}

/* ── Refresh indicator in footer ─────────────────────────────── */
(function initRefreshIndicator() {
  const footer = document.querySelector(".footer-inner");
  if (!footer) return;
  const div = document.createElement("div");
  div.id = "footer-refresh";
  div.style.cssText = "font-size:10px;color:var(--text-faint)";
  div.textContent = `載入中…`;
  footer.appendChild(div);

  function updateIndicator() {
    const now = new Date().toLocaleTimeString("zh-HK", { hour12: false });
    const el = document.getElementById("footer-refresh");
    if (el) el.textContent = `最後更新 Last updated: ${now}`;
  }

  setTimeout(updateIndicator, 2000);
  setInterval(updateIndicator, 60000);
})();

/* ── PWA Install Prompt ──────────────────────────────────────── */
(function initPWAPrompt() {
  let _deferredPrompt = null;

  // iOS detection
  const isIOS =
    /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  const isInStandaloneMode =
    window.navigator.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;

  // Don't show if already installed or already shown this session
  if (isInStandaloneMode) return;

  function createBanner(message, onInstall, onDismiss) {
    const existing = document.getElementById("pwa-install-banner");
    if (existing) existing.remove();

    const banner = document.createElement("div");
    banner.id = "pwa-install-banner";
    banner.style.cssText = `
      position: fixed;
      bottom: 70px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--r-lg);
      box-shadow: 0 4px 24px rgba(0,0,0,0.3);
      padding: 14px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      max-width: min(420px, calc(100vw - 32px));
      width: 100%;
      animation: slideUp 0.3s ease;
    `;

    banner.innerHTML = `
      <span style="font-size:1.4rem">📱</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:var(--text-sm);font-weight:600;color:var(--text)">
          加入主屏幕 Add to Home Screen
        </div>
        <div style="font-size:var(--text-xs);color:var(--text-muted);margin-top:2px;line-height:1.4">
          ${message}
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-shrink:0">
        ${
          onInstall
            ? `<button id="pwa-install-btn"
          style="background:var(--primary);color:white;border:none;border-radius:var(--r-md);
                 padding:6px 14px;font-size:var(--text-xs);font-weight:700;cursor:pointer">
          安裝
        </button>`
            : ""
        }
        <button id="pwa-dismiss-btn"
          style="background:var(--surface-2);color:var(--text-muted);border:1px solid var(--border);
                 border-radius:var(--r-md);padding:6px 10px;font-size:var(--text-xs);cursor:pointer">
          ✕
        </button>
      </div>
    `;

    document.body.appendChild(banner);

    if (onInstall) {
      document
        .getElementById("pwa-install-btn")
        ?.addEventListener("click", () => {
          onInstall();
          banner.remove();
        });
    }

    document
      .getElementById("pwa-dismiss-btn")
      ?.addEventListener("click", () => {
        onDismiss?.();
        banner.remove();
      });
  }

  // Android/Chrome: listen for beforeinstallprompt
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    _deferredPrompt = e;

    if (window._pwaPromptShown) return;
    window._pwaPromptShown = true;

    // Delay slightly to not interrupt initial load
    setTimeout(() => {
      createBanner(
        "像App一樣使用 — 快速存取、離線瀏覽",
        async () => {
          if (_deferredPrompt) {
            _deferredPrompt.prompt();
            const { outcome } = await _deferredPrompt.userChoice;
            _deferredPrompt = null;
            console.log("[PWA] Install outcome:", outcome);
          }
        },
        () => {
          console.log("[PWA] Prompt dismissed");
        },
      );
    }, 3000);
  });

  // iOS: show manual instructions (no beforeinstallprompt event)
  if (isIOS) {
    if (window._pwaPromptShown) return;

    setTimeout(() => {
      if (window._pwaPromptShown) return;
      window._pwaPromptShown = true;

      createBanner(
        "點擊 Safari 分享按鈕 → 加入主畫面",
        null, // no programmatic install on iOS
        () => {
          console.log("[PWA] iOS prompt dismissed");
        },
      );
    }, 4000);
  }

  // Add slideUp animation if not present
  if (!document.getElementById("pwa-style")) {
    const style = document.createElement("style");
    style.id = "pwa-style";
    style.textContent = `
      @keyframes slideUp {
        from { opacity: 0; transform: translateX(-50%) translateY(20px); }
        to   { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }
})();
