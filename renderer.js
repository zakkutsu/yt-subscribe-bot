let queue = [];
let index = 0;
let timer = null;
let autoSubscribeEnabled = false;
let smartModeEnabled = true;
let subscribeStatus = {};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function debugLog(message, details) {
  if (window.api?.debugLog) {
    window.api.debugLog(message, details);
  }
}

function updateSmartModeButton() {
  const button = document.getElementById("smart-mode-toggle");
  if (!button) return;

  if (smartModeEnabled) {
    button.textContent = "Smart Mode: ON";
    button.className =
      "px-5 py-2.5 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 hover:border-emerald-300 transition-colors";
  } else {
    button.textContent = "Smart Mode: OFF";
    button.className =
      "px-5 py-2.5 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 hover:border-slate-300 transition-colors";
  }
}

function updateModeBadge() {
  const badge = document.getElementById("mode-badge");
  if (!badge) return;

  if (smartModeEnabled) {
    badge.textContent = "Smart Mode Active";
    badge.className =
      "mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border border-emerald-200 bg-emerald-50 text-emerald-700";
  } else {
    badge.textContent = "Manual Mode Active";
    badge.className =
      "mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border border-slate-200 bg-slate-50 text-slate-700";
  }
}

function toggleSmartMode() {
  smartModeEnabled = !smartModeEnabled;
  updateSmartModeButton();
  updateModeBadge();
  debugLog("toggleSmartMode", { smartModeEnabled });

  const status = document.getElementById("subscribe-status");
  if (status) {
    status.style.display = "block";
    status.className = smartModeEnabled
      ? "mb-4 p-4 rounded-xl border bg-emerald-50 border-emerald-200"
      : "mb-4 p-4 rounded-xl border bg-slate-50 border-slate-200";
    status.textContent = smartModeEnabled
      ? "Smart mode enabled. START will auto-subscribe."
      : "Smart mode disabled. START will open links for manual subscribe.";
    status.style.color = smartModeEnabled ? "#065f46" : "#334155";
  }
}

function updateSpeedWarning() {
  const profile = document.getElementById("speed-profile")?.value;
  const warning = document.getElementById("speed-warning");
  const watchContainer = document.getElementById("watch-video-container");
  const watchToggle = document.getElementById("watch-video-toggle");
  if (!warning) return;

  if (profile === "fast" || profile === "very-fast") {
    warning.style.display = "block";
  } else {
    warning.style.display = "none";
  }

  if (watchToggle && watchContainer) {
    if (profile === "very-fast") {
      watchToggle.checked = false;
      watchToggle.disabled = true;
      watchContainer.classList.add("opacity-50", "pointer-events-none");
    } else {
      watchToggle.disabled = false;
      watchContainer.classList.remove("opacity-50", "pointer-events-none");
    }
  }
}

async function init() {
  queue = await window.api.loadData();
  updateSmartModeButton();
  updateModeBadge();
  render();
}

function addLinks() {
  const raw = document.getElementById("link-input").value;

  const links = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !queue.includes(l));

  if (links.length === 0) return;

  queue.push(...links);

  window.api.saveData(queue);
  document.getElementById("link-input").value = "";
  render();
}

function render() {
  const list = document.getElementById("list");
  const emptyState = document.getElementById("empty-state");
  list.innerHTML = "";

  if (queue.length === 0) {
    emptyState.style.display = "block";
    return;
  }

  emptyState.style.display = "none";

  queue.forEach((link, i) => {
    const isActive = i === index;
    const subStatus = subscribeStatus[link];

    let statusBg = "bg-slate-100 text-slate-600";
    let statusText = "Pending";

    if (subStatus === "subscribed") {
      statusBg = "bg-emerald-100 text-emerald-700";
      statusText = "✓ Subscribed";
    } else if (subStatus === "not-subscribed") {
      statusBg = "bg-rose-100 text-rose-700";
      statusText = "Not Subscribed";
    }

    const div = document.createElement("div");
    div.className = `p-4 flex items-center justify-between ${
      isActive ? "bg-blue-50 border-l-4 border-blue-500" : "hover:bg-slate-50"
    } transition-colors`;

    div.innerHTML = `
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          ${isActive ? '<span class="text-xl">▶</span>' : '<span class="text-slate-300 text-lg">•</span>'}
          <p class="text-sm font-medium text-slate-900 truncate">${link}</p>
        </div>
        <p class="text-xs text-slate-500 mt-1">Item ${i + 1} of ${queue.length}</p>
      </div>
      <div class="flex items-center gap-3 ml-4">
        <span class="px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${statusBg}">${statusText}</span>
        <button onclick="removeQueueItem(${i})" class="text-slate-300 hover:text-red-500 transition-colors font-bold text-lg leading-none" title="Hapus channel ini">×</button>
      </div>
    `;

    list.appendChild(div);
  });
}

async function autoSubscribe() {
  const status = document.getElementById("subscribe-status");
  if (!status) return;

  debugLog("autoSubscribe:start", {
    queueLength: queue.length,
    index,
    smartModeEnabled,
  });

  if (autoSubscribeEnabled) {
    status.style.display = "block";
    status.className =
      "mb-4 p-4 rounded-xl border bg-amber-50 border-amber-200";
    status.textContent = "⚠️ Smart Auto Subscribe is already running.";
    status.style.color = "#92400e";
    return;
  }

  if (queue.length === 0) {
    status.style.display = "block";
    status.className =
      "mb-4 p-4 rounded-xl border bg-slate-50 border-slate-200";
    status.textContent = "No queue items to process.";
    status.style.color = "#475569";
    return;
  }

  autoSubscribeEnabled = true;
  status.style.display = "block";
  status.className = "mb-4 p-4 rounded-xl border bg-blue-50 border-blue-200";
  status.textContent = "🔍 Starting smart queue processing...";
  status.style.color = "#1e40af";

  try {
    for (let i = index; i < queue.length && autoSubscribeEnabled; i++) {
      index = i;
      render();

      const link = queue[i];
      debugLog("autoSubscribe:open-link", { index: i, link });
      status.className =
        "mb-4 p-4 rounded-xl border bg-blue-50 border-blue-200";
      status.textContent = `🔗 Opening ${i + 1} of ${queue.length}...`;
      status.style.color = "#1e40af";

      const openResult = await window.api.openLink(link);
      debugLog("autoSubscribe:open-result", { index: i, openResult });
      if (openResult?.status === "error") {
        subscribeStatus[link] = "not-subscribed";
        status.className =
          "mb-4 p-4 rounded-xl border bg-red-50 border-red-200";
        status.textContent = "❌ " + openResult.message;
        status.style.color = "#991b1b";
        render();
        continue;
      }

      await sleep(3500);

      status.className =
        "mb-4 p-4 rounded-xl border bg-blue-50 border-blue-200";
      status.textContent = `🔍 Checking subscribe status for item ${i + 1}...`;
      status.style.color = "#1e40af";

      const checkResult = await window.api.checkSubscribe();
      debugLog("autoSubscribe:check-result", { index: i, checkResult });
      if (checkResult.status === "error") {
        subscribeStatus[link] = "not-subscribed";
        status.className =
          "mb-4 p-4 rounded-xl border bg-red-50 border-red-200";
        status.textContent = "❌ " + checkResult.message;
        status.style.color = "#991b1b";
        render();
        continue;
      }

      if (checkResult.subscribed === "yes") {
        subscribeStatus[link] = "subscribed";
        status.className =
          "mb-4 p-4 rounded-xl border bg-emerald-50 border-emerald-200";
        status.textContent = `✅ Already subscribed for item ${i + 1}. Skipping...`;
        status.style.color = "#065f46";
        render();
        await sleep(500); // Skip instantly if already subscribed!
        continue;
      }

      // === WATCH VIDEO OPTION ===
      const watchVideoEnabled =
        document.getElementById("watch-video-toggle")?.checked;
      if (watchVideoEnabled) {
        status.className =
          "mb-4 p-4 rounded-xl border bg-violet-50 border-violet-200";
        status.textContent = `📺 Membuka video untuk ditonton...`;
        status.style.color = "#5b21b6";

        const watchResult = await window.api.watchVideo();
        if (watchResult.success) {
          const watchTime = Math.floor(Math.random() * 15000) + 20000; // 20s - 35s
          status.textContent = `📺 Menonton video selama ${Math.round(watchTime / 1000)} detik untuk keamanan...`;
          await sleep(watchTime);
        } else {
          status.textContent = `⚠️ Gagal mencari video di channel ini, lanjut subscribe...`;
          await sleep(2000);
        }
      }
      // ==========================

      status.className =
        "mb-4 p-4 rounded-xl border bg-violet-50 border-violet-200";
      status.textContent = `🤖 Auto-subscribing item ${i + 1}...`;
      status.style.color = "#5b21b6";

      const result = await window.api.autoSubscribe();
      debugLog("autoSubscribe:auto-result", { index: i, result });
      if (result.success) {
        subscribeStatus[link] = "subscribed";
        status.className =
          "mb-4 p-4 rounded-xl border bg-emerald-50 border-emerald-200";
        status.textContent = `✅ ${result.message}`;
        status.style.color = "#065f46";
      } else {
        subscribeStatus[link] = "not-subscribed";
        status.className =
          "mb-4 p-4 rounded-xl border bg-amber-50 border-amber-200";
        status.textContent = `⚠️ ${result.message}`;
        status.style.color = "#92400e";
      }

      render();
      await sleep(randomDelay());
    }

    index = queue.length;
    status.className =
      "mb-4 p-4 rounded-xl border bg-slate-50 border-slate-200";
    status.textContent = "Done processing queue.";
    status.style.color = "#334155";
    render();
  } catch (err) {
    status.className = "mb-4 p-4 rounded-xl border bg-red-50 border-red-200";
    status.textContent = "❌ Error: " + err.message;
    status.style.color = "#991b1b";
  } finally {
    autoSubscribeEnabled = false;
  }
}

async function openNext() {
  if (index >= queue.length) return;

  const link = queue[index];

  debugLog("openNext", { index, link });
  await window.api.openLink(link);
  index++;
  render();
}

function startQueue() {
  if (timer) clearTimeout(timer);

  if (smartModeEnabled) {
    autoSubscribe();
    return;
  }

  runQueue();
}

async function runQueue() {
  if (index >= queue.length) return;

  debugLog("runQueue:step", {
    index,
    queueLength: queue.length,
    smartModeEnabled,
  });
  await openNext();

  const delay = randomDelay();

  timer = setTimeout(runQueue, delay);
}

function clearQueue() {
  queue = [];
  index = 0;

  window.api.saveData(queue);

  render();
}

function removeQueueItem(i) {
  queue.splice(i, 1);
  if (index > i) {
    index--;
  } else if (index === i && index >= queue.length && queue.length > 0) {
    index = queue.length - 1;
  }
  window.api.saveData(queue);
  render();
}

function stopQueue() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }

  autoSubscribeEnabled = false;
}

function restartQueue() {
  // reset dari awal
  index = 0;

  // stop dulu kalau lagi jalan
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }

  // mulai lagi dari awal
  startQueue();
}

function resetIndex() {
  index = 0;
  render();
}

function randomDelay() {
  const profile = document.getElementById("speed-profile")?.value || "normal";

  let min = 15000,
    max = 30000; // normal

  if (profile === "very-fast") {
    min = 3000;
    max = 5000;
  } else if (profile === "fast") {
    min = 5000;
    max = 10000;
  } else if (profile === "safe") {
    min = 30000;
    max = 60000;
  }

  return Math.floor(Math.random() * (max - min)) + min;
}

init();
