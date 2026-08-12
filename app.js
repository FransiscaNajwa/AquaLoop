const screens = Array.from(document.querySelectorAll(".screen"));
const navItems = Array.from(document.querySelectorAll(".nav-item"));
const content = document.getElementById("main-content");
const screenTitle = document.getElementById("screen-title");
const screenSubtitle = document.getElementById("screen-subtitle");
const activePondLabel = document.getElementById("active-pond-label");
const pondButtons = Array.from(document.querySelectorAll("[data-pond]"));
const auditTimeline = document.getElementById("audit-timeline");
const auditCount = document.getElementById("audit-count");
const activeSensorCount = document.getElementById("active-sensor-count");
const pondSyncStatus = document.getElementById("pond-sync-status");

const screenMeta = {
  dashboard: {
    title: "Dashboard",
    subtitle: "Ringkasan kualitas air, kontrol pond, dan audit trail.",
  },
  analytics: {
    title: "AI Analytics",
    subtitle: "Deteksi kamera, alarm feeding, dan interlocking.",
  },
  hardware: {
    title: "Hardware",
    subtitle: "Kondisi node edge, panel surya, dan aktuator.",
  },
  sustainability: {
    title: "Sustainability",
    subtitle: "Efisiensi air, panen, dan ekonomi sirkular.",
  },
};

const state = {
  activePond: "A",
  loading: false,
  latestData: null,
};

function switchTab(tabName) {
  screens.forEach((screen) => {
    const active = screen.dataset.screen === tabName;
    screen.hidden = !active;
    screen.classList.toggle("active", active);
  });

  navItems.forEach((item) => {
    const active = item.dataset.target === tabName;
    item.classList.toggle("active", active);
    item.setAttribute("aria-selected", active ? "true" : "false");
  });

  const meta = screenMeta[tabName];
  if (meta && screenTitle && screenSubtitle) {
    screenTitle.textContent = meta.title;
    screenSubtitle.textContent = meta.subtitle;
  }

  if (content) {
    content.scrollTop = 0;
  }
}

function setPondButtonState(code) {
  pondButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.pond === code);
  });
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value;
  }
}

function setHtml(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.innerHTML = value;
  }
}

function renderAuditTrail(items) {
  if (!auditTimeline) return;

  if (!items || items.length === 0) {
    auditTimeline.innerHTML = `
      <div class="empty-state">
        <h4>Belum ada audit trail</h4>
        <p>Setelah data sensor atau event disimpan ke database, riwayat kejadian akan muncul di sini.</p>
      </div>
    `;
    if (auditCount) auditCount.textContent = "0 events";
    return;
  }

  auditTimeline.innerHTML = items
    .map((item) => {
      const time = item.event_time ? String(item.event_time).slice(11, 16) : "--:--";
      const title = item.title || "Event";
      const details = item.details || "";
      const badge = item.severity ? String(item.severity).toUpperCase() : "INFO";

      return `
        <div class="timeline-item">
          <div class="timeline-time">${time}</div>
          <div class="timeline-body">
            <h4>${title}</h4>
            <p>${details}</p>
            <span class="timeline-chip">${badge}</span>
          </div>
        </div>
      `;
    })
    .join("");

  if (auditCount) {
    auditCount.textContent = `${items.length} events`;
  }
}

function renderDashboard(data) {
  state.latestData = data;
  const currentPond = data?.current_pond || null;
  const latest = data?.latest_reading || null;
  const auditLogs = data?.audit_logs || [];

  if (currentPond) {
    setText("active-pond-label", `${currentPond.name || `Pond ${currentPond.code}`}`);
    setPondButtonState(currentPond.code);
  } else {
    setText("active-pond-label", "No pond selected");
  }

  setText("active-sensor-count", data?.devices ? `${data.devices.length} nodes` : "0 nodes");
  setText("pond-sync-status", state.loading ? "Syncing" : "Live");

  if (latest) {
    setText("val-do", latest.dissolved_oxygen != null ? Number(latest.dissolved_oxygen).toFixed(1) : "—");
    setText("val-ph", latest.ph != null ? Number(latest.ph).toFixed(1) : "—");
    setHtml("val-salinity", latest.salinity != null ? `${Number(latest.salinity).toFixed(0)} <span>ppt</span>` : `— <span>ppt</span>`);
    setHtml("val-temp", latest.temperature != null ? `${Number(latest.temperature).toFixed(1)}<span>°C</span>` : `—<span>°C</span>`);
  } else {
    setText("val-do", "—");
    setText("val-ph", "—");
    setHtml("val-salinity", `— <span>ppt</span>`);
    setHtml("val-temp", `—<span>°C</span>`);
  }

  renderAuditTrail(auditLogs);
}

async function loadDashboard(pondCode) {
  state.loading = true;
  setText("pond-sync-status", "Syncing");

  try {
    const response = await fetch(`api/dashboard.php?pond=${encodeURIComponent(pondCode)}`, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    renderDashboard(payload.data || null);
  } catch (error) {
    console.error("Failed to load AquaLoop dashboard:", error);
    renderDashboard({
      current_pond: null,
      latest_reading: null,
      audit_logs: [],
      devices: [],
    });
  } finally {
    state.loading = false;
    setText("pond-sync-status", "Live");
  }
}

function startAutoRefresh() {
  setInterval(() => {
    loadDashboard(state.activePond);
  }, 5000);
}

navItems.forEach((item) => {
  item.addEventListener("click", () => switchTab(item.dataset.target));
});

pondButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.activePond = button.dataset.pond;
    setPondButtonState(button.dataset.pond);
    loadDashboard(button.dataset.pond);
  });
});

window.switchTab = switchTab;

switchTab("dashboard");
setPondButtonState(state.activePond);
loadDashboard(state.activePond);
startAutoRefresh();

