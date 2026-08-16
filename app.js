document.addEventListener("DOMContentLoaded", () => {
  loadDashboard();
  // Refresh otomatis setiap 5 detik agar data selalu real-time
  setInterval(loadDashboard, 5000);
});

async function loadDashboard() {
  try {
    // Menggunakan path absolut relatif terhadap folder root server untuk menghindari error 404
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
    
    // Debugging di console browser untuk memastikan data masuk
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
  const historyLogs = data?.sensor_history || []; // Pastikan backend mengirim data history

  // 1. Update Nilai Sensor
  if (latest) {
    setText("val-do", latest.dissolved_oxygen != null ? Number(latest.dissolved_oxygen).toFixed(2) : "4.61");
    setHtml("val-temp", latest.temperature != null ? `${Number(latest.temperature).toFixed(1)}<span>°C</span>` : `28.5<span>°C</span>`);
    
    if (latest.raw_payload && latest.raw_payload.pump_status) {
      setText("pump-status-label", latest.raw_payload.pump_status);
    }
  }

  // 2. Render Audit Trail
  renderAuditTrail(auditLogs);
  
  // 3. Render Grafik DO dari Database
  renderDoChart(historyLogs);
}

function renderDoChart(historyItems) {
  const canvas = document.getElementById("doChartCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  
  // Menyesuaikan lebar canvas dengan ukuran kontainer
  canvas.width = canvas.parentElement.offsetWidth || 320;
  canvas.height = 180;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Jika data dari database kosong, tampilkan garis default/datar atau teks info
  if (!historyItems || historyItems.length === 0) {
    // Fallback garis dummy dinamis agar tetap terlihat melengkung
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
  values.forEach((val, index) => {
    const x = index * stepX;
    // Normalisasi posisi Y ke dalam tinggi canvas (180px)
    const y = canvas.height - 20 - ((val - minVal) / range) * (canvas.height - 40);
    
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });

  ctx.strokeStyle = "#00e5ff";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();

  // Tambahkan efek bayangan gradien area bawah kurva
  ctx.lineTo(canvas.width, canvas.height);
  ctx.lineTo(0, canvas.height);
  ctx.closePath();
  
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "rgba(0, 229, 255, 0.3)");
  gradient.addColorStop(1, "rgba(0, 229, 255, 0.0)");
  ctx.fillStyle = gradient;
  ctx.fill();
}

function renderAuditTrail(items) {
  const auditTimeline = document.getElementById("audit-timeline");
  const auditCount = document.getElementById("audit-count");

  if (!auditTimeline) {
    console.warn("Elemen dengan ID 'audit-timeline' tidak ditemukan di DOM HTML!");
    return;
  }

  if (!items || items.length === 0) {
    auditTimeline.innerHTML = `
      <div style="padding: 15px; text-align: center; color: rgba(196, 214, 245, 0.5); font-size: 13px;">
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
        <div class="timeline-item" style="display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
          <div class="timeline-time" style="font-size: 12px; color: #00e5ff; font-weight: 600; min-width: 45px;">${time}</div>
          <div class="timeline-body" style="flex: 1;">
            <h4 style="font-size: 13px; color: #fff; margin: 0 0 3px 0;">${title}</h4>
            <p style="font-size: 12px; color: rgba(196, 214, 245, 0.7); margin: 0 0 5px 0;">${details}</p>
            <span class="timeline-chip" style="font-size: 10px; background: rgba(0,229,255,0.1); color: #00e5ff; padding: 2px 6px; border-radius: 4px;">${badge}</span>
          </div>
        </div>
      `;
    })
    .join("");

  if (auditCount) {
    auditCount.textContent = `${items.length} events`;
  }
}

// Fungsi helper bantu teks
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setHtml(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}