document.addEventListener("DOMContentLoaded", () => {
  if ("Notification" in window && Notification.permission !== "denied" && Notification.permission !== "granted") {
    Notification.requestPermission();
  }
  loadDashboard();
  setInterval(loadDashboard, 5000);

  window.addEventListener("resize", () => {
    if (window._lastHistoryData) {
      renderDoChart(window._lastHistoryData);
    }
  });
});

async function loadDashboard() {
  try {
    const response = await fetch("api/dashboard.php", {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const payload = await response.json();
    console.log("Payload dari API:", payload);

    if (payload.success && payload.data) {
      renderDashboard(payload.data);
    } else {
      console.warn("Struktur payload tidak valid:", payload);
    }
  } catch (error) {
    console.error("Gagal memuat data dashboard AquaLoop:", error);
  }
}

function renderDashboard(data) {
  const latest = data?.latest_reading || null;
  const auditLogs = data?.audit_logs || [];
  const historyLogs = data?.sensor_history || [];

  window._lastHistoryData = historyLogs;

  if (latest) {
    setText("val-do", latest.dissolved_oxygen != null ? Number(latest.dissolved_oxygen).toFixed(2) : "4.61");
    setHtml("val-temp", latest.temperature != null ? `${Number(latest.temperature).toFixed(1)}<span>°C</span>` : `28.5<span>°C</span>`);
    
    if (latest.pump_status) {
      setText("pump-status-label", latest.pump_status);
    }
    if (latest.yolo_confidence != null) {
      setText("ai-conf", latest.yolo_confidence);
      setText("stat-conf", `${latest.yolo_confidence}%`);
    }
    if (latest.battery_percent != null) {
      setText("solar-charge-val", `${latest.battery_percent}%`);
    }
    if (latest.solar_remaining_hours != null) {
      setText("solar-remaining-val", `${latest.solar_remaining_hours} Jam`);
    }

    // Tetap ambil fallback/metadata dari raw_payload (misal FPS)
    if (latest.raw_payload) {
      if (latest.raw_payload.ai_fps) {
        setText("ai-fps", latest.raw_payload.ai_fps);
      }
    }

    checkAlertsAndNotify(latest, auditLogs);
  }

  renderAuditTrail(auditLogs);
  renderDoChart(historyLogs);
}

let lastNotifiedEventTitle = null;

function sendPushNotification(title, body) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification(title, { body: body });
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then(permission => {
      if (permission === "granted") {
        new Notification(title, { body: body });
      }
    });
  }
}

function checkAlertsAndNotify(latest, auditLogs) {
  if (!auditLogs || auditLogs.length === 0) return;

  const latestEvent = auditLogs[0];
  const eventTitle = latestEvent.title || latestEvent.event_title;

  if ((latestEvent.severity === "warning" || latestEvent.severity === "danger") && lastNotifiedEventTitle !== eventTitle) {
    sendPushNotification("Peringatan AquaLoop", eventTitle);
    lastNotifiedEventTitle = eventTitle;
  }
}

function renderDoChart(historyItems) {
  const canvas = document.getElementById("doChartCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  
  const container = canvas.parentElement;
  canvas.width = container ? container.offsetWidth : 320;
  canvas.height = 160;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!historyItems || historyItems.length === 0) {
    historyItems = [
      { dissolved_oxygen: 4.2 }, { dissolved_oxygen: 4.5 }, 
      { dissolved_oxygen: 4.0 }, { dissolved_oxygen: 4.8 }, 
      { dissolved_oxygen: 5.1 }, { dissolved_oxygen: 4.6 }
    ];
  }

  const values = historyItems.map(item => Number(item.dissolved_oxygen || 4.5));
  const maxVal = Math.max(...values, 6.0);
  const minVal = Math.min(...values, 2.0);
  const range = maxVal - minVal || 1;

  const stepX = canvas.width / (values.length - 1 || 1);

  ctx.beginPath();
  
  if (values.length === 1) {
    const val = values[0];
    const y = canvas.height - 20 - ((val - minVal) / range) * (canvas.height - 40);
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
  } else {
    values.forEach((val, index) => {
      const x = index * stepX;
      const y = canvas.height - 20 - ((val - minVal) / range) * (canvas.height - 40);
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
  }

  ctx.strokeStyle = "#00e5ff";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
}

function renderAuditTrail(items) {
  const auditTimeline = document.getElementById("audit-timeline");
  const auditCount = document.getElementById("audit-count");

  if (!auditTimeline) return;

  if (!items || items.length === 0) {
    auditTimeline.innerHTML = `
      <div style="padding: 12px; text-align: center; color: rgba(196, 214, 245, 0.5); font-size: 12px;">
        Belum ada riwayat kejadian hari ini.
      </div>
    `;
    if (auditCount) auditCount.textContent = "0 events";
    return;
  }

  auditTimeline.innerHTML = items
    .map((item) => {
      const rawTime = item.event_time || item.created_at || "--:--";
      const time = String(rawTime).length >= 16 ? String(rawTime).slice(11, 16) : rawTime;
      const title = item.title || item.event_title || "Event";
      const details = item.details || item.event_details || "";
      const badge = item.severity ? String(item.severity).toUpperCase() : "INFO";

      return `
        <div class="timeline-item">
          <div class="timeline-time">${time}</div>
          <div class="timeline-body" style="flex: 1;">
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

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setHtml(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}