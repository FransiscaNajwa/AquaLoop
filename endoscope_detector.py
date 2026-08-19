import cv2
import requests
import time
from ultralytics import YOLO

# ================= CONFIGURATION =================
# Path file model YOLO yang sudah dioptimasi untuk Edge-AI
MODEL_PATH = 'best.pt' 

# URL API Ingest backend PHP Anda (sesuaikan dengan IP server/lokal)
API_URL = "http://192.168.1.100/aqualoop/api/ingest.php"

# Kolam target dan kode perangkat edge (Sesuai spesifikasi STB HG680P di proposal)
POND_CODE = "A"
DEVICE_CODE = "STB_EDGECAM_01"
# ==================================================

def send_ai_event(confidence, latency_ms, feed_status):
    """Fungsi untuk mengirim data hasil deteksi AI ke server backend"""
    payload = {
        "pond_code": POND_CODE,
        "device_code": DEVICE_CODE,
        "device_name": "Edge-AI Endoscope Node (STB HG680P)",
        "device_type": "camera",
        "device_status": "online",
        "event_type": "warning" if feed_status == "Excess Feed" else "info",
        "severity": "medium" if feed_status == "Excess Feed" else "low",
        "event_title": f"YOLO Detection: {feed_status}",
        "event_details": f"Kamera endoskop mendeteksi sisa pakan dengan tingkat keyakinan {confidence}%. Latensi: {latency_ms}ms",
        "yolo_confidence": confidence,
        "feed_status": feed_status,
        "pump_status": "ON", # Status sirkulasi fitoremediasi kangkung tetap berjalan
        "raw_payload": {
            "latency_ms": latency_ms,
            "ai_fps": 12
        }
    }
    
    try:
        response = requests.post(API_URL, json=payload, timeout=3)
        print(f"[API] Terkirim! Status Code: {response.status_code}")
    except Exception as e:
        print(f"[API ERROR] Gagal mengirim data ke server: {e}")

def main():
    print("Memuat model YOLO-Shrimp (RepGhost / Edge Optimized)...")
    try:
        model = YOLO(MODEL_PATH)
    except Exception as e:
        print(f"Gagal memuat model YOLO: {e}")
        return

    # Membuka stream kamera (0 untuk webcam/USB, atau ganti RTSP/path video)
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        print("Error: Tidak dapat membuka kamera endoskop!")
        return

    print("Kamera endoskop aktif. Memulai pemantauan Edge-AI...")
    
    last_sent_time = 0
    interval_send = 15  # Jeda pengiriman log ke server (detik)

    while cap.isOpened():
        start_time = time.time()
        ret, frame = cap.read()
        
        if not ret:
            print("Peringatan: Gagal membaca frame dari kamera. Mencoba ulang...")
            time.sleep(1)
            continue

        # Jalankan inference YOLO dengan threshold conf sesuai proposal (mAP optimal)
        results = model(frame, conf=0.5, verbose=False)
        
        # Hitung latensi pemrosesan dalam milidetik (target < 500ms)
        latency_ms = int((time.time() - start_time) * 1000)

        detected_excess = False
        max_conf = 0

        for r in results:
            for box in r.boxes:
                conf = int(box.conf[0] * 100)
                cls_id = int(box.cls[0])
                class_name = model.names[cls_id]

                # Sesuaikan nama kelas ("excess_feed") dengan label training Anda
                if class_name == "excess_feed" and conf > 75:
                    detected_excess = True
                    if conf > max_conf:
                        max_conf = conf

        # Logika pengiriman data periodik atau saat terjadi anomali pakan berlebih
        current_time = time.time()
        if detected_excess and (current_time - last_sent_time > interval_send):
            print(f"[AI ALERT] Sisa pakan terdeteksi! Confidence: {max_conf}% | Latency: {latency_ms}ms")
            send_ai_event(confidence=max_conf, latency_ms=latency_ms, feed_status="Excess Feed")
            last_sent_time = current_time

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()