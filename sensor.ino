#include <ArduinoJson.h>
#include <DallasTemperature.h>
#include <HTTPClient.h>
#include <OneWire.h>
#include <WiFi.h>


const char *ssid = "Wokwi-GUEST";
const char *password = "";
const char *serverUrl = "http://192.168.0.200/aqualoop-web/api/ingest.php";

// Definisi Pin Hardware
const int TEMP_PIN = 16;       // Pin data sensor suhu DS18B20
const int FEED_STATUS_PIN = 4; // Pin Push Button (Simulasi status pakan)
const int LED_FULL_PIN = 5;    // LED menyala jika Pakan Full (Penuh)
const int BUZZER_PIN = 18;     // Buzzer menyala jika Pakan Habis (Empty)
const int LDR_PIN = 34; // Pin Analog (AO) modul LDR untuk simulasi Panel Surya

OneWire oneWire(TEMP_PIN);
DallasTemperature sensors(&oneWire);

void setup() {
  Serial.begin(115200);

  // Konfigurasi Pin I/O
  pinMode(FEED_STATUS_PIN, INPUT_PULLUP); // Tombol dengan pull-up internal
  pinMode(LED_FULL_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  // Kondisi awal (Aman)
  digitalWrite(LED_FULL_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);

  sensors.begin();

  Serial.print("Menghubungkan Wi-Fi");
  WiFi.begin(ssid, password);

  int timeout = 0;
  while (WiFi.status() != WL_CONNECTED && timeout < 10) {
    delay(500);
    Serial.print(".");
    timeout++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWi-Fi terhubung!");
  } else {
    Serial.println("\nSimulasi: Mode offline aktif.");
  }
}

void loop() {
  // --- 1. PEMBACAAN SENSOR SUHU ---
  sensors.requestTemperatures();
  float temperature = sensors.getTempCByIndex(0);
  if (temperature == DEVICE_DISCONNECTED_C) {
    temperature = 28.5; // Fallback jika sensor terlepas sementara
  }

  // --- 2. PEMBACAAN STATUS PAKAN (PUSH BUTTON) ---
  // Karena menggunakan INPUT_PULLUP: Ditekan = LOW (Habis), Dilepas = HIGH
  // (Penuh)
  bool isFeedEmpty = (digitalRead(FEED_STATUS_PIN) == LOW);

  String feedStatusStr;
  if (isFeedEmpty) {
    digitalWrite(BUZZER_PIN, HIGH);  // Buzzer berbunyi (Peringatan pakan habis)
    digitalWrite(LED_FULL_PIN, LOW); // LED mati
    feedStatusStr = "EMPTY (HABIS)";
  } else {
    digitalWrite(BUZZER_PIN, LOW);    // Buzzer mati
    digitalWrite(LED_FULL_PIN, HIGH); // LED menyala (Pakan penuh)
    feedStatusStr = "FULL (PENUH)";
  }

  // --- 3. PEMBACAAN PANEL SURYA (MODUL LDR VIA PIN AO) ---
  int ldrValue = analogRead(LDR_PIN); // Membaca nilai analog cahaya (0 - 4095)
  int solarBatteryPercent =
      map(ldrValue, 0, 4095, 0, 100); // Konversi ke persentase baterai

  // --- 4. KIRIM DATA KE SERVER DASHBOARD (HTTP POST) ---
  static unsigned long lastSendTime = 0;
  // Kirim data setiap 5 detik agar tidak membanjiri database (Spam), namun loop tetap cepat untuk tombol
  if (WiFi.status() == WL_CONNECTED && (millis() - lastSendTime >= 5000)) {
    lastSendTime = millis();
    
    // Debugging di Serial Monitor
    Serial.printf("Suhu: %.1f°C | Pakan: %s | Surya/Baterai: %d%% (LDR: %d)\n",
                  temperature, feedStatusStr.c_str(), solarBatteryPercent,
                  ldrValue);

    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<512> doc;
    doc["device_code"] = "ESP32_NODE_01";
    doc["device_name"] = "ESP32 Sensor Node";
    doc["device_type"] = "sensor_node";
    doc["temperature"] = temperature;
    doc["battery_percent"] = solarBatteryPercent; // Data tegangan hasil pembacaan LDR panel surya
    
    // Pindahkan metrik dari raw_payload ke root agar tersimpan di kolom fisik MySQL
    doc["feed_status"] = feedStatusStr;
    doc["solar_remaining_hours"] = solarBatteryPercent * 0.1; // Contoh simulasi: 10% = 1 Jam sisa

    JsonObject rawPayload = doc.createNestedObject("raw_payload");
    rawPayload["solar_power_status"] = "Active / Charging";
    rawPayload["note"] = "Integrated Feed Monitor & Solar Panel LDR";

    String requestBody;
    serializeJson(doc, requestBody);

    int httpResponseCode = http.POST(requestBody);
    if (httpResponseCode > 0) {
      Serial.printf("Data berhasil dikirim! HTTP Code: %d\n", httpResponseCode);
    } else {
      Serial.printf("Gagal kirim ke server. Error: %d\n", httpResponseCode);
    }
    http.end();
  }
  
  delay(100); // Cek tombol setiap 100 milidetik agar Buzzer dan LED sangat responsif
}